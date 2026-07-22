$ErrorActionPreference = 'Stop'

Write-Host ''
Write-Host '====================================================' -ForegroundColor Yellow
Write-Host ' CONFIGURAR SUPABASE - TRI AI BUBBLE INDEX' -ForegroundColor Yellow
Write-Host '====================================================' -ForegroundColor Yellow
Write-Host ''

$configPath = Join-Path $PSScriptRoot 'config.js'

if (-not (Test-Path $configPath)) {
    Write-Host 'ERRO: o arquivo config.js nao foi encontrado.' -ForegroundColor Red
    Write-Host 'Mantenha este configurador dentro da pasta principal do projeto.' -ForegroundColor Red
    Read-Host 'Pressione ENTER para fechar'
    exit 1
}

$url = Read-Host 'Cole a Project URL do Supabase'
$key = Read-Host 'Cole a Publishable key (ou anon public key) do Supabase'

$url = $url.Trim()
$key = $key.Trim()

if (-not $url.StartsWith('https://') -or -not $url.Contains('.supabase.co')) {
    Write-Host ''
    Write-Host 'A Project URL parece incorreta. Exemplo: https://abcdefgh.supabase.co' -ForegroundColor Red
    Read-Host 'Pressione ENTER para fechar'
    exit 1
}

if ($key.Length -lt 20) {
    Write-Host ''
    Write-Host 'A chave parece incompleta. Copie a Publishable key inteira.' -ForegroundColor Red
    Read-Host 'Pressione ENTER para fechar'
    exit 1
}

$content = Get-Content -Raw -LiteralPath $configPath

$content = [regex]::Replace(
    $content,
    'supabaseUrl:\s*"[^"]*"',
    'supabaseUrl: "' + $url.Replace('"','\"') + '"'
)

$content = [regex]::Replace(
    $content,
    'supabaseAnonKey:\s*"[^"]*"',
    'supabaseAnonKey: "' + $key.Replace('"','\"') + '"'
)

Set-Content -LiteralPath $configPath -Value $content -Encoding UTF8

Write-Host ''
Write-Host 'CONFIGURACAO CONCLUIDA!' -ForegroundColor Green
Write-Host 'O arquivo config.js foi atualizado automaticamente.' -ForegroundColor Green
Write-Host ''
Write-Host 'Proximo passo: enviar todos os arquivos desta pasta ao GitHub.' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Pressione ENTER para fechar'
