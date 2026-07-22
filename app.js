(() => {
  "use strict";

  const config = window.TRI_CONFIG || {};
  const state = { data: null, lead: null };
  const qs = (selector, root = document) => root.querySelector(selector);
  const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

  const fallbackData = {
    is_demo: true,
    score: 38,
    score_change: 1,
    status: "Baixo risco",
    headline: "Mercado ainda saudável",
    summary: "O mercado segue aquecido, mas ainda sem uma combinação intensa de sinais especulativos. Momentum, concentração e volatilidade permanecem em níveis que exigem acompanhamento, não alarme.",
    updated_at: new Date().toISOString(),
    market_cards: [
      { label: "NVIDIA", symbol: "NVDA", value: "—", change: "Aguardando atualização", direction: "neutral" },
      { label: "Nasdaq", symbol: "IXIC", value: "—", change: "Aguardando atualização", direction: "neutral" },
      { label: "VIX", symbol: "VIX", value: "—", change: "Aguardando atualização", direction: "neutral" },
      { label: "Semicondutores", symbol: "SMH", value: "—", change: "Aguardando atualização", direction: "neutral" }
    ],
    components: [
      { name: "Momentum Nasdaq", score: 42, weight: 20, note: "Retorno e aceleração" },
      { name: "Momentum NVIDIA", score: 48, weight: 20, note: "Proxy de euforia em IA" },
      { name: "Semicondutores vs. Nasdaq", score: 36, weight: 15, note: "Força relativa" },
      { name: "Concentração Big Tech", score: 44, weight: 15, note: "Liderança do mercado" },
      { name: "Complacência do VIX", score: 30, weight: 15, note: "Baixa volatilidade" },
      { name: "Distância da média de 200 dias", score: 28, weight: 15, note: "Alongamento de preço" }
    ],
    history: Array.from({ length: 45 }, (_, i) => ({
      date: new Date(Date.now() - (44 - i) * 86400000).toISOString().slice(0, 10),
      score: Math.max(20, Math.min(65, Math.round(31 + Math.sin(i / 6) * 7 + i * .13)))
    }))
  };

  function isSupabaseConfigured() {
    return Boolean(
      config.supabaseUrl &&
      config.supabaseAnonKey &&
      !config.supabaseUrl.includes("COLE_AQUI") &&
      !config.supabaseAnonKey.includes("COLE_AQUI")
    );
  }

  function sanitize(value) {
    return String(value ?? "").trim();
  }

  function getStoredLead() {
    try {
      const raw = localStorage.getItem("tri_ai_bubble_lead");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function storeLead(lead) {
    localStorage.setItem("tri_ai_bubble_lead", JSON.stringify(lead));
    localStorage.setItem("tri_ai_bubble_access", "granted");
  }

  function showGate() {
    const gate = qs("#registrationGate");
    gate.classList.add("is-open");
    gate.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    setTimeout(() => qs("#leadName")?.focus(), 100);
  }

  function closeGate() {
    const gate = qs("#registrationGate");
    gate.classList.remove("is-open");
    gate.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function setFieldError(id, message = "") {
    const input = qs(`#${id}`);
    const error = qs(`[data-error-for="${id}"]`);
    input?.classList.toggle("invalid", Boolean(message));
    if (error) error.textContent = message;
  }

  function validateLeadForm() {
    const name = sanitize(qs("#leadName").value);
    const email = sanitize(qs("#leadEmail").value).toLowerCase();
    const phone = sanitize(qs("#leadPhone").value);
    const consent = qs("#leadConsent").checked;
    let valid = true;

    qsa(".field-error").forEach(el => el.textContent = "");
    qsa(".invalid").forEach(el => el.classList.remove("invalid"));

    if (name.length < 2) { setFieldError("leadName", "Informe seu nome."); valid = false; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setFieldError("leadEmail", "Informe um e-mail válido."); valid = false; }
    if (phone.replace(/\D/g, "").length < 10) { setFieldError("leadPhone", "Informe um WhatsApp com DDD."); valid = false; }
    if (!consent) { setFieldError("leadConsent", "É necessário aceitar para continuar."); valid = false; }

    return valid ? { name, email, phone, consent } : null;
  }

  async function registerLead(lead) {
    if (!isSupabaseConfigured()) {
      return { ...lead, id: `local-${Date.now()}`, storage: "local" };
    }

    const response = await fetch(`${config.supabaseUrl}/rest/v1/leads`, {
      method: "POST",
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${config.supabaseAnonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        marketing_consent: lead.consent,
        source: new URLSearchParams(location.search).get("utm_source") || document.referrer || "direct",
        landing_page: location.pathname,
        user_agent: navigator.userAgent
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Falha no cadastro: ${detail}`);
    }

    const rows = await response.json();
    return { ...lead, id: rows?.[0]?.id, storage: "supabase" };
  }

  async function logAccess(lead) {
    if (!lead?.id || lead.storage !== "supabase" || !isSupabaseConfigured()) return;
    try {
      await fetch(`${config.supabaseUrl}/rest/v1/access_logs`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          lead_id: lead.id,
          page_path: location.pathname + location.search,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent,
          screen_size: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });
    } catch (error) {
      console.warn("Não foi possível registrar o acesso.", error);
    }
  }

  function formatPhoneInput(event) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, 11);
    let output = digits;
    if (digits.length > 2) output = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if (digits.length > 7) output = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    event.target.value = output;
  }

  async function handleLeadSubmit(event) {
    event.preventDefault();
    const lead = validateLeadForm();
    if (!lead) return;

    const button = qs("#accessButton");
    const message = qs("#formMessage");
    button.disabled = true;
    message.textContent = "Liberando seu acesso...";

    try {
      state.lead = await registerLead(lead);
      storeLead(state.lead);
      closeGate();
      await logAccess(state.lead);
      showToast("Acesso liberado. Bem-vindo ao radar da TRI.");
    } catch (error) {
      console.error(error);
      message.textContent = "Não foi possível concluir o cadastro. Verifique a configuração do Supabase.";
    } finally {
      button.disabled = false;
    }
  }

  async function loadDashboardData() {
    try {
      const dataPath = config.dataFile || "data/dashboard.json";
      const response = await fetch(`${dataPath}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Arquivo de dados indisponível");
      state.data = await response.json();
    } catch (error) {
      console.warn("Usando dados de demonstração.", error);
      state.data = fallbackData;
    }
    renderDashboard(state.data);
  }

  function clamp(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function riskMeta(score) {
    if (score <= 40) return { label: "BAIXO RISCO", className: "risk-low", color: "#49d17d", title: "Mercado ainda saudável" };
    if (score <= 70) return { label: "ATENÇÃO", className: "risk-medium", color: "#f2c45d", title: "Mercado aquecido" };
    return { label: "RISCO ELEVADO", className: "risk-high", color: "#f36f6f", title: "Sinais fortes de exuberância" };
  }

  function formatDateTime(value) {
    try {
      return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(value)).replace(",", " •");
    } catch {
      return "Data indisponível";
    }
  }

  function formatDate(value) {
    try {
      return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function animateNumber(element, target) {
    const duration = 800;
    const start = performance.now();
    const end = clamp(target);
    function frame(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.round(end * eased);
      if (progress < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderDashboard(data) {
    const score = clamp(data.score);
    const meta = riskMeta(score);
    const gauge = qs("#scoreGauge");
    gauge.style.setProperty("--score", score);
    gauge.style.setProperty("--risk-color", meta.color);
    animateNumber(qs("#scoreValue"), score);

    const badge = qs("#riskBadge");
    badge.className = `risk-badge ${meta.className}`;
    badge.textContent = (data.status || meta.label).toUpperCase();
    qs("#riskHeadline").textContent = data.headline || meta.title;
    qs("#riskSummary").textContent = data.summary || fallbackData.summary;
    qs("#summaryTitle").textContent = data.summary_title || "Leitura do mercado";
    qs("#executiveSummary").textContent = data.summary || fallbackData.summary;
    qs("#scaleMarker").style.left = `${score}%`;

    const change = Number(data.score_change || 0);
    const changeElement = qs("#scoreChange");
    changeElement.className = change > 0 ? "positive" : change < 0 ? "negative" : "neutral";
    changeElement.textContent = `${change > 0 ? "+" : ""}${change.toFixed(0)} ponto${Math.abs(change) === 1 ? "" : "s"}`;

    qs("#headerUpdatedAt").textContent = formatDateTime(data.updated_at);
    qs("#marketDate").textContent = formatDate(data.updated_at);
    qs("#demoBadge").hidden = !data.is_demo;

    renderMarketCards(data.market_cards || fallbackData.market_cards);
    renderComponents(data.components || fallbackData.components);
    renderHistory(data.history || fallbackData.history);
    renderMethodology(data.components || fallbackData.components);
  }

  function renderMarketCards(cards) {
    const root = qs("#marketCards");
    root.innerHTML = cards.slice(0, 4).map(card => {
      const direction = ["positive", "negative", "neutral"].includes(card.direction) ? card.direction : "neutral";
      const arrow = direction === "positive" ? "↗" : direction === "negative" ? "↘" : "→";
      return `
        <article class="market-card" style="--card-color:${direction === "positive" ? "#49d17d" : direction === "negative" ? "#f36f6f" : "#c8a35c"}">
          <div class="market-card-head">
            <span class="market-card-label">${escapeHtml(card.label)}</span>
            <span class="market-card-symbol">${escapeHtml(card.symbol || "")}</span>
          </div>
          <div class="market-card-value">${escapeHtml(card.value)}</div>
          <div class="market-card-change ${direction}"><span>${arrow}</span><span>${escapeHtml(card.change)}</span></div>
        </article>`;
    }).join("");
  }

  function renderComponents(components) {
    const root = qs("#componentList");
    root.innerHTML = components.map(component => {
      const score = clamp(component.score);
      const color = riskMeta(score).color;
      return `
        <div class="component-row">
          <div class="component-head"><span>${escapeHtml(component.name)}</span><strong>${Math.round(score)}/100</strong></div>
          <div class="component-track"><div class="component-fill" style="--component-color:${color};width:${score}%"></div></div>
          <div class="component-meta"><span>${escapeHtml(component.note || "")}</span><span>Peso ${Number(component.weight || 0)}%</span></div>
        </div>`;
    }).join("");
  }

  function renderMethodology(components) {
    qs("#methodologyComponents").innerHTML = components.map(component => `
      <div class="methodology-item"><span>${escapeHtml(component.name)}</span><strong>${Number(component.weight || 0)}%</strong></div>
    `).join("");
  }

  function renderHistory(history) {
    const svg = qs("#historyChart");
    const clean = history.filter(point => Number.isFinite(Number(point.score))).slice(-180);
    if (clean.length < 2) {
      svg.innerHTML = `<text x="450" y="160" fill="#737d8c" text-anchor="middle">Histórico ainda não disponível</text>`;
      return;
    }

    const W = 900, H = 320, L = 48, R = 18, T = 18, B = 38;
    const innerW = W - L - R, innerH = H - T - B;
    const x = i => L + (i / (clean.length - 1)) * innerW;
    const y = value => T + (100 - clamp(value)) / 100 * innerH;
    const path = clean.map((point, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(point.score).toFixed(1)}`).join(" ");
    const area = `${path} L${x(clean.length - 1)},${T + innerH} L${x(0)},${T + innerH} Z`;
    const yTicks = [0, 25, 40, 70, 100];
    const dateIndexes = [0, Math.floor((clean.length - 1) / 2), clean.length - 1];

    svg.innerHTML = `
      <defs>
        <linearGradient id="chartArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dfbd78" stop-opacity=".23"/><stop offset="1" stop-color="#dfbd78" stop-opacity="0"/></linearGradient>
        <filter id="chartGlow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x="${L}" y="${y(100)}" width="${innerW}" height="${y(70)-y(100)}" fill="#f36f6f" opacity=".035"/>
      <rect x="${L}" y="${y(70)}" width="${innerW}" height="${y(40)-y(70)}" fill="#f2c45d" opacity=".035"/>
      <rect x="${L}" y="${y(40)}" width="${innerW}" height="${y(0)-y(40)}" fill="#49d17d" opacity=".025"/>
      ${yTicks.map(tick => `<line x1="${L}" x2="${W-R}" y1="${y(tick)}" y2="${y(tick)}" stroke="#ffffff" stroke-opacity=".06"/><text x="${L-10}" y="${y(tick)+4}" fill="#737d8c" font-size="11" text-anchor="end">${tick}</text>`).join("")}
      <path d="${area}" fill="url(#chartArea)"/>
      <path d="${path}" fill="none" stroke="#dfbd78" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="url(#chartGlow)"/>
      ${dateIndexes.map(index => `<text x="${x(index)}" y="${H-10}" fill="#737d8c" font-size="11" text-anchor="${index === 0 ? "start" : index === clean.length-1 ? "end" : "middle"}">${formatShortDate(clean[index].date)}</text>`).join("")}
      <circle cx="${x(clean.length-1)}" cy="${y(clean.at(-1).score)}" r="5" fill="#dfbd78" stroke="#101620" stroke-width="3"/>
    `;
  }

  function formatShortDate(value) {
    try { return new Intl.DateTimeFormat("pt-BR", { day:"2-digit", month:"short" }).format(new Date(`${value}T12:00:00`)); }
    catch { return value; }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function showToast(message) {
    const toast = qs("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
  }

  async function shareDashboard() {
    const shareData = { title: document.title, text: "Acompanhe o TRI AI Bubble Index.", url: location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(location.href); showToast("Link copiado."); }
    } catch (error) {
      if (error?.name !== "AbortError") showToast("Não foi possível compartilhar.");
    }
  }

  function openMethodology() {
    const modal = qs("#methodologyModal");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeMethodology() {
    const modal = qs("#methodologyModal");
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function bindEvents() {
    qs("#leadForm")?.addEventListener("submit", handleLeadSubmit);
    qs("#leadPhone")?.addEventListener("input", formatPhoneInput);
    qs("#shareButton")?.addEventListener("click", shareDashboard);
    qs("#methodologyButton")?.addEventListener("click", openMethodology);
    qsa("[data-close-modal]").forEach(el => el.addEventListener("click", closeMethodology));
    document.addEventListener("keydown", event => { if (event.key === "Escape") closeMethodology(); });
  }

  async function init() {
    qs("#currentYear").textContent = new Date().getFullYear();
    bindEvents();
    await loadDashboardData();

    state.lead = getStoredLead();
    if (config.requireRegistration !== false && !state.lead) showGate();
    else if (state.lead) logAccess(state.lead);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
