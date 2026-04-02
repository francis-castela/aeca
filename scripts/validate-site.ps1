Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$htmlFiles = Get-ChildItem -Recurse -File -Filter *.html | Where-Object { $_.FullName -notmatch "\\html\\" }

$missingRel = @()
$footerOutsideBody = @()
$missingDescription = @()
$missingCanonical = @()
$missingH1 = @()

foreach ($file in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $relPath = $file.FullName.Replace($root + "\\", "").Replace("\\", "/")

    foreach ($match in [regex]::Matches($content, '<a[^>]*target="_blank"[^>]*>')) {
        if ($match.Value -notmatch 'rel="[^"]*(noopener|noreferrer)[^"]*"') {
            $missingRel += $relPath
            break
        }
    }

    if ($content -match '</body>\s*<div id="footer"></div>') {
        $footerOutsideBody += $relPath
    }

    if ($content -notmatch '<meta\s+name="description"') {
        $missingDescription += $relPath
    }

    if ($content -notmatch '<link\s+rel="canonical"') {
        $missingCanonical += $relPath
    }

    if ($content -notmatch '<h1[\s>]') {
        $missingH1 += $relPath
    }
}

$sitemapPath = Join-Path $root "sitemap.xml"
$sitemapText = [System.IO.File]::ReadAllText($sitemapPath)
$sitemapHasBackslash = $sitemapText.Contains("\\")

$hasFailures = $false

function Write-Issue {
    param(
        [string]$title,
        [string[]]$items
    )

    if ($items.Count -eq 0) {
        return
    }

    $script:hasFailures = $true
    Write-Host "[FAIL] $title" -ForegroundColor Red
    $items | Select-Object -First 20 | ForEach-Object { Write-Host "  - $_" }
    if ($items.Count -gt 20) {
        Write-Host "  ... +$($items.Count - 20) item(s)" -ForegroundColor DarkYellow
    }
}

Write-Issue "target=_blank sem rel noopener/noreferrer" $missingRel
Write-Issue "footer fora do body" $footerOutsideBody
Write-Issue "faltando meta description" $missingDescription
Write-Issue "faltando canonical" $missingCanonical
Write-Issue "faltando h1" $missingH1

if ($sitemapHasBackslash) {
    $hasFailures = $true
    Write-Host "[FAIL] sitemap.xml contem barra invertida (\\)" -ForegroundColor Red
}

if ($hasFailures) {
    Write-Host "\nValidacao finalizou com erros." -ForegroundColor Red
    exit 1
}

Write-Host "Validacao concluida sem erros criticos." -ForegroundColor Green
exit 0
