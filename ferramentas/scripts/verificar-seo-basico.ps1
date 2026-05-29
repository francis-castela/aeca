[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Get-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ferramentasRoot = Split-Path -Parent $scriptRoot
$repoRoot = Split-Path -Parent $ferramentasRoot
$relatoriosDir = Join-Path $ferramentasRoot "relatorios"
$reportPath = Join-Path $relatoriosDir "relatorio-seo-basico.md"

if (-not (Test-Path -LiteralPath $relatoriosDir)) {
    New-Item -ItemType Directory -Path $relatoriosDir | Out-Null
}

function Get-FirstRegexMatch {
    param(
        [string]$Content,
        [string]$Pattern
    )

    $m = [regex]::Match($Content, $Pattern)
    if ($m.Success) {
        return $m.Groups[1].Value.Trim()
    }

    return ""
}

$htmlFiles = Get-ChildItem -Path $repoRoot -Recurse -File -Filter "*.html"
$results = New-Object System.Collections.Generic.List[object]
$criticalFailures = 0

foreach ($file in $htmlFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $relative = $file.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')

    if ($relative -like "html/*") {
        continue
    }

    $title = Get-FirstRegexMatch -Content $content -Pattern '(?is)<title>\s*([^<]+?)\s*</title>'
    $description = Get-FirstRegexMatch -Content $content -Pattern '(?is)<meta\s+name\s*=\s*["'']description["'']\s+content\s*=\s*["'']([^"'']+)["'']'
    if ([string]::IsNullOrWhiteSpace($description)) {
        $description = Get-FirstRegexMatch -Content $content -Pattern '(?is)<meta\s+content\s*=\s*["'']([^"'']+)["'']\s+name\s*=\s*["'']description["'']'
    }

    $canonical = Get-FirstRegexMatch -Content $content -Pattern '(?is)<link\s+rel\s*=\s*["'']canonical["'']\s+href\s*=\s*["'']([^"'']+)["'']'
    if ([string]::IsNullOrWhiteSpace($canonical)) {
        $canonical = Get-FirstRegexMatch -Content $content -Pattern '(?is)<link\s+href\s*=\s*["'']([^"'']+)["'']\s+rel\s*=\s*["'']canonical["'']'
    }

    $h1Count = ([regex]::Matches($content, '(?is)<h1\b')).Count

    $status = New-Object System.Collections.Generic.List[string]

    if ([string]::IsNullOrWhiteSpace($title)) {
        $status.Add("Sem title")
        $criticalFailures += 1
    }

    if ([string]::IsNullOrWhiteSpace($description)) {
        $status.Add("Sem meta description")
        $criticalFailures += 1
    }

    if ([string]::IsNullOrWhiteSpace($canonical)) {
        $status.Add("Sem canonical")
    }

    if ($h1Count -eq 0) {
        $status.Add("Sem h1")
        $criticalFailures += 1
    }
    elseif ($h1Count -gt 1) {
        $status.Add("Multiplos h1")
        $criticalFailures += 1
    }

    if ($status.Count -eq 0) {
        $status.Add("OK")
    }

    $results.Add([PSCustomObject]@{
        Pagina = $relative
        Title = if ([string]::IsNullOrWhiteSpace($title)) { "NAO" } else { "OK" }
        Description = if ([string]::IsNullOrWhiteSpace($description)) { "NAO" } else { "OK" }
        Canonical = if ([string]::IsNullOrWhiteSpace($canonical)) { "NAO" } else { "OK" }
        H1 = if ($h1Count -eq 1) { "OK" } elseif ($h1Count -eq 0) { "NAO" } else { "MULTIPLO" }
        Status = ($status -join "; ")
    })
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Relatorio SEO basico")
$lines.Add("")
$lines.Add("Data da analise: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("")
$lines.Add("| Pagina | Title | Meta description | Canonical | H1 | Status |")
$lines.Add("|---|---|---|---|---|---|")

foreach ($item in ($results | Sort-Object Pagina)) {
    $lines.Add("| $($item.Pagina) | $($item.Title) | $($item.Description) | $($item.Canonical) | $($item.H1) | $($item.Status) |")
}

Set-Content -LiteralPath $reportPath -Value $lines -Encoding UTF8

if ($criticalFailures -gt 0) {
    Write-Host "[ERRO] Falhas SEO criticas encontradas: $criticalFailures" -ForegroundColor Red
    Write-Host "[INFO] Relatorio salvo em: $reportPath"
    exit 1
}

Write-Host "[OK] Verificacao SEO basico concluida sem falhas criticas." -ForegroundColor Green
Write-Host "[OK] Relatorio salvo em: $reportPath" -ForegroundColor Green
exit 0
