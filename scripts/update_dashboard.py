#!/usr/bin/env python3
"""Atualiza o TRI AI Bubble Index usando dados públicos via Yahoo Finance/yfinance.

O objetivo é produzir um indicador transparente, repetível e sem custo de API.
A metodologia usa proxies de preço e volatilidade. Não é recomendação de investimento.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "dashboard.json"

TICKERS = {
    "nasdaq": "^IXIC",
    "vix": "^VIX",
    "nvda": "NVDA",
    "semis": "SMH",
    "msft": "MSFT",
    "meta": "META",
    "amzn": "AMZN",
    "googl": "GOOGL",
    "avgo": "AVGO",
}

WEIGHTS = {
    "Momentum Nasdaq": 20,
    "Momentum NVIDIA": 20,
    "Semicondutores vs. Nasdaq": 15,
    "Concentração Big Tech": 15,
    "Complacência do VIX": 15,
    "Distância da média de 200 dias": 15,
}


def clip(value: float, low: float = 0, high: float = 100) -> float:
    return float(max(low, min(high, value)))


def linear_score(value: float, low: float, high: float) -> float:
    if high == low:
        return 0.0
    return clip((value - low) / (high - low) * 100)


def pct_change(series: pd.Series, periods: int) -> float:
    clean = series.dropna()
    if len(clean) <= periods:
        raise ValueError(f"Histórico insuficiente: {len(clean)} pontos")
    return float(clean.iloc[-1] / clean.iloc[-periods - 1] - 1)


def latest(series: pd.Series) -> float:
    clean = series.dropna()
    if clean.empty:
        raise ValueError("Série vazia")
    return float(clean.iloc[-1])


def format_number(value: float, decimals: int = 2) -> str:
    return f"{value:,.{decimals}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def format_percent(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value * 100:.2f}%".replace(".", ",")


def direction(value: float, tolerance: float = 0.0005) -> str:
    if value > tolerance:
        return "positive"
    if value < -tolerance:
        return "negative"
    return "neutral"


def download_prices() -> pd.DataFrame:
    symbols = list(TICKERS.values())
    raw = yf.download(
        symbols,
        period="18mo",
        interval="1d",
        auto_adjust=True,
        progress=False,
        threads=True,
        group_by="column",
    )
    if raw.empty:
        raise RuntimeError("Nenhum dado foi retornado pelo provedor.")

    close = raw["Close"] if isinstance(raw.columns, pd.MultiIndex) else raw[["Close"]]
    if isinstance(close, pd.Series):
        close = close.to_frame(symbols[0])
    close = close.rename(columns={v: k for k, v in TICKERS.items()})
    required = {"nasdaq", "vix", "nvda", "semis"}
    missing = required - set(close.columns)
    if missing:
        raise RuntimeError(f"Séries obrigatórias ausentes: {sorted(missing)}")
    return close.sort_index().ffill(limit=3)


def compute_components(prices: pd.DataFrame) -> list[dict[str, Any]]:
    nasdaq_6m = pct_change(prices["nasdaq"], 126)
    nasdaq_1m = pct_change(prices["nasdaq"], 21)
    nvda_6m = pct_change(prices["nvda"], 126)
    nvda_1m = pct_change(prices["nvda"], 21)
    semis_6m = pct_change(prices["semis"], 126)

    # 1) Retorno de 6 meses, com bônus para aceleração de 1 mês.
    momentum_nasdaq = clip(linear_score(nasdaq_6m, -0.05, 0.35) * 0.75 + linear_score(nasdaq_1m, -0.04, 0.12) * 0.25)

    # 2) NVIDIA funciona como proxy de exuberância no principal ativo associado ao tema IA.
    momentum_nvda = clip(linear_score(nvda_6m, -0.15, 0.90) * 0.75 + linear_score(nvda_1m, -0.10, 0.25) * 0.25)

    # 3) Força relativa dos semicondutores contra o Nasdaq.
    semis_relative = semis_6m - nasdaq_6m
    semis_score = linear_score(semis_relative, -0.12, 0.35)

    # 4) Big Tech contra Nasdaq: quando poucas líderes carregam o índice, a concentração sobe.
    big_tech_cols = [c for c in ["msft", "meta", "amzn", "googl", "avgo", "nvda"] if c in prices]
    big_returns = [pct_change(prices[c], 126) for c in big_tech_cols]
    big_tech_equal = float(np.mean(big_returns)) if big_returns else nasdaq_6m
    concentration_relative = big_tech_equal - nasdaq_6m
    concentration_score = linear_score(concentration_relative, -0.10, 0.35)

    # 5) VIX muito baixo por período prolongado aumenta a complacência.
    vix_current = latest(prices["vix"])
    vix_score = clip(100 - linear_score(vix_current, 11, 35))

    # 6) Distância acima da média móvel de 200 dias captura alongamento de preço.
    nasdaq = prices["nasdaq"].dropna()
    ma200 = float(nasdaq.tail(200).mean())
    distance_ma200 = latest(nasdaq) / ma200 - 1
    distance_score = linear_score(distance_ma200, -0.05, 0.28)

    return [
        {"name": "Momentum Nasdaq", "score": round(momentum_nasdaq), "weight": 20, "note": "Retorno e aceleração"},
        {"name": "Momentum NVIDIA", "score": round(momentum_nvda), "weight": 20, "note": "Proxy de euforia em IA"},
        {"name": "Semicondutores vs. Nasdaq", "score": round(semis_score), "weight": 15, "note": "Força relativa"},
        {"name": "Concentração Big Tech", "score": round(concentration_score), "weight": 15, "note": "Liderança do mercado"},
        {"name": "Complacência do VIX", "score": round(vix_score), "weight": 15, "note": "Baixa volatilidade"},
        {"name": "Distância da média de 200 dias", "score": round(distance_score), "weight": 15, "note": "Alongamento de preço"},
    ]


def weighted_score(components: list[dict[str, Any]]) -> int:
    numerator = sum(float(c["score"]) * float(c["weight"]) for c in components)
    denominator = sum(float(c["weight"]) for c in components)
    return int(round(numerator / denominator))


def status_for(score: int) -> tuple[str, str, str]:
    if score <= 40:
        return (
            "Baixo risco",
            "Mercado ainda saudável",
            "Os sinais de preço e volatilidade ainda não formam uma combinação típica de bolha. O mercado pode estar aquecido, mas o quadro geral permanece em zona saudável.",
        )
    if score <= 70:
        return (
            "Atenção",
            "Mercado aquecido",
            "A combinação de momentum, concentração e complacência ganhou força. O cenário pede maior seletividade e disciplina, embora ainda não configure risco extremo.",
        )
    return (
        "Risco elevado",
        "Sinais fortes de exuberância",
        "Diversos sinais de euforia aparecem simultaneamente. O ambiente exige cautela adicional, gestão de risco e atenção à sustentabilidade dos preços.",
    )


def build_market_cards(prices: pd.DataFrame) -> list[dict[str, Any]]:
    specs = [
        ("NVIDIA", "NVDA", "nvda"),
        ("Nasdaq", "IXIC", "nasdaq"),
        ("VIX", "VIX", "vix"),
        ("Semicondutores", "SMH", "semis"),
    ]
    cards: list[dict[str, Any]] = []
    for label, symbol, column in specs:
        series = prices[column].dropna()
        value = latest(series)
        day = pct_change(series, 1)
        cards.append({
            "label": label,
            "symbol": symbol,
            "value": format_number(value, 2),
            "change": f"{format_percent(day)} no último pregão",
            "direction": direction(day),
        })
    return cards


def load_previous() -> dict[str, Any]:
    if not OUTPUT.exists():
        return {}
    try:
        return json.loads(OUTPUT.read_text(encoding="utf-8"))
    except Exception:
        return {}


def build_history(previous: dict[str, Any], score: int) -> list[dict[str, Any]]:
    history = list(previous.get("history") or [])
    today = datetime.now(timezone.utc).date().isoformat()
    history = [p for p in history if p.get("date") != today]
    history.append({"date": today, "score": score})
    return history[-180:]


def main() -> None:
    previous = load_previous()
    prices = download_prices()
    components = compute_components(prices)
    score = weighted_score(components)
    previous_score = int(previous.get("score", score))
    status, headline, summary = status_for(score)

    payload = {
        "is_demo": False,
        "score": score,
        "score_change": score - previous_score,
        "status": status,
        "headline": headline,
        "summary_title": "Leitura do mercado",
        "summary": summary,
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "market_cards": build_market_cards(prices),
        "components": components,
        "history": build_history(previous, score),
        "methodology_version": "1.0-price-proxy",
        "data_provider": "Yahoo Finance via yfinance",
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"TABI atualizado: {score}/100 — {status}")


if __name__ == "__main__":
    main()
