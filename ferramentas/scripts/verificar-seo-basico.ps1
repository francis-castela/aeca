Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

function Get-RelativePath {
    param([string]$fullPath)

    $normalizedRoot = [System.IO.Path]::GetFullPath($root).TrimEnd("\\")
    $normalizedFullPath = [System.IO.Path]::GetFullPath($fullPath)

    if ($normalizedFullPath.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return ($normalizedFullPath.Substring($normalizedRoot.Length).TrimStart("\\") -replace '\\', '/')
    }

    return ($normalizedFullPath -replace '\\', '/')
}

function Get-PublicRoute {
    param([string]$relativePath)

    $path = "/" + $relativePath.TrimStart("/")
    if ($path.EndsWith("/index.html", [System.StringComparison]::OrdinalIgnoreCase)) {
        $base = $path.Substring(0, $path.Length - "index.html".Length)
        if ([string]::IsNullOrWhiteSpace($base)) {
            return "/"
        }
        return $base
    }

    return $path
}

$htmlFiles = Get-ChildItem -Path $root -Recurse -File -Filter *.html | Where-Object {
    $_.FullName -notmatch "\\html\\" -and $_.FullName -notmatch "\\.git\\"
}

$missingTitle = New-Object System.Collections.Generic.List[string]
$missingDescription = New-Object System.Collections.Generic.List[string]
$missingCanonical = New-Object System.Collections.Generic.List[string]
$missingH1 = New-Object System.Collections.Generic.List[string]
$multipleH1 = New-Object System.Collections.Generic.List[string]

$reportPath = Join-Path (Split-Path -Parent $PSScriptRoot) "relatorios"
$reportPath = Join-Path $reportPath "relatorio-seo.md"
$reportDir = Split-Path $reportPath -Parent
if (-not (Test-Path $reportDir -PathType Container)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$sitemapPath = Join-Path $root "sitemap.xml"
$sitemapRoutes = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
if (Test-Path $sitemapPath -PathType Leaf) {
    $sitemapContent = [System.IO.File]::ReadAllText($sitemapPath)
    foreach ($loc in [regex]::Matches($sitemapContent, '<loc>\s*(?<url>[^<]+)\s*</loc>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $url = $loc.Groups["url"].Value.Trim()
        if ($url -match '^(?i:https?://[^/]+)(?<path>/.*)?$') {
            $route = if ([string]::IsNullOrWhiteSpace($Matches['path'])) { "/" } else { $Matches['path'] }
            [void]$sitemapRoutes.Add($route)
            if ($route.EndsWith("/index.html", [System.StringComparison]::OrdinalIgnoreCase)) {
                [void]$sitemapRoutes.Add($route.Substring(0, $route.Length - "index.html".Length))
            }
        }
    }
}

$notInSitemap = New-Object System.Collections.Generic.List[string]

foreach ($file in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $relPath = Get-RelativePath $file.FullName

    $titleMatch = [regex]::Match($content, '<title>\s*(?<title>[^<]+?)\s*</title>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $titleMatch.Success -or [string]::IsNullOrWhiteSpace($titleMatch.Groups['title'].Value)) {
        $missingTitle.Add($relPath)
    }

    if ($content -notmatch '<meta\s+name\s*=\s*["'']description["''][^>]*content\s*=\s*["''][^"'']+["'']') {
        $missingDescription.Add($relPath)
    }

    if ($content -notmatch '<link\s+rel\s*=\s*["'']canonical["''][^>]*href\s*=\s*["''][^"'']+["'']') {
        $missingCanonical.Add($relPath)
    }

    $h1Count = [regex]::Matches($content, '<h1[\s>]', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase).Count
    if ($h1Count -eq 0) {
        $missingH1.Add($relPath)
    }
    elseif ($h1Count -gt 1) {
        $multipleH1.Add($relPath)
    }

    $route = Get-PublicRoute -relativePath $relPath
    if ($sitemapRoutes.Count -gt 0 -and -not $sitemapRoutes.Contains($route) -and -not $sitemapRoutes.Contains(($route.TrimEnd("/") + "/"))) {
        $notInSitemap.Add($relPath)
    }
}

$hasFailures = $false

function WriteIssue {
    param([string]$Title, [System.Collections.Generic.List[string]]$Items, [switch]$WarningOnly)
    if ($Items.Count -eq 0) { return }
    if (-not $WarningOnly) { $script:hasFailures = $true }
    $fc = if ($WarningOnly) { 'Yellow' } else { 'Red' }
    Write-Host "$Title`n" -ForegroundColor $fc
    $Items | Select-Object -First 50 | ForEach-Object { Write-Host $_ }
}

WriteIssue -Title "Pagina_sem_title_tag" -Items $missingTitle
WriteIssue -Title "Pagina_sem_meta_description" -Items $missingDescription
WriteIssue -Title "Pagina_sem_canonical" -Items $missingCanonical
WriteIssue -Title "Pagina_sem_h1" -Items $missingH1
WriteIssue -Title "Pagina_com_multiplos_h1" -Items $multipleH1 -WarningOnly
WriteIssue -Title "Pagina_ausente_sitemap" -Items $notInSitemap -WarningOnly

if ($hasFailures) {
    Write-Host "`nVerificacao SEO basico finalizou com erros." -ForegroundColor Red
    exit 1
}

function WriteReportSection {
    param([System.Collections.Generic.List[string]]$Lines, [string]$Title, [System.Collections.Generic.List[string]]$Items, [string]$correction, [switch]$Warning)
    if ($Items.Count -eq 0) { return }
    $Lines.Add("## $Title") | Out-Null
    $Lines.Add("Total: $($Items.Count) pagina(s)") | Out-Null
    if ($correction) {
        $Lines.Add("Correcao: $correction") | Out-Null
    }
    foreach ($item in $Items) {
        $Lines.Add("- $item") | Out-Null
    }
    $Lines.Add("") | Out-Null
}

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# Auditoria SEO basico") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
$reportLines.Add("") | Out-Null

$title_corr = "1. Abra o arquivo HTML
2. Localize a tag <title> no <head>
3. Se nao existir, adicione: <title>Nome do Site - Descricao</title>
4. Se existir vazia, preecha com um titulo descritivo de ate 60 caracteres"

$desc_corr = "1. Abra o arquivo HTML
2. Localize a tag <meta name='description'> no <head>
3. Se nao existir, adicione: <meta name='description' content='Descricao com ate 160 caracteres'>
4. A descricao deve resumir o conteudo da pagina para os mecanismos de busca"

$can_corr = "1. Abra o arquivo HTML
2. Localize a tag <link rel='canonical'> no <head>
3. Se nao existir, adicione: <link rel='canonical' href='https://seusite.com/pagina'>
4. Use a URL completa e absoluta do site"

$h1_corr = "1. Abra o arquivo HTML
2. Procure por tags <h1> no documento
3. Se nao encontrar nenhuma, adicione uma no inicio do conteudo principal: <h1>Titulo da pagina</h1>
4. Cada pagina deve ter exatamente um <h1>"

$multi_corr = "1. Abra o arquivo HTML
2. Procure por multiplas tags <h1>
3. Mantenha apenas uma <h1> principal no inicio
4. Converta as demais em <h2>, <h3>, etc conforme a hierarquia apropriada"

$sitemap_corr = "1. Abra ou crie o arquivo sitemap.xml na raiz do site
2. Para cada pagina, adicione uma entrada: <url><loc>https://seusite.com/pagina</loc></url>
3. Atualize o sitemap sempre que novas paginas forem criadas"

WriteReportSection -Lines $reportLines -Title "Paginas sem title" -Items $missingTitle -correction $title_corr
WriteReportSection -Lines $reportLines -Title "Paginas sem description" -Items $missingDescription -correction $desc_corr
WriteReportSection -Lines $reportLines -Title "Paginas sem canonical" -Items $missingCanonical -correction $can_corr
WriteReportSection -Lines $reportLines -Title "Paginas sem h1" -Items $missingH1 -correction $h1_corr
WriteReportSection -Lines $reportLines -Title "Paginas multiplos h1" -Items $multipleH1 -correction $multi_corr -Warning
WriteReportSection -Lines $reportLines -Title "Paginas ausentes sitemap" -Items $notInSitemap -correction $sitemap_corr -Warning

$reportLines.Add("Relatorio gerado automaticamente") | Out-Null

[System.IO.File]::WriteAllLines($reportPath, $reportLines)
Write-Host "`nRelatorio salvo em: $reportPath" -ForegroundColor Green

Write-Host "Verificacao SEO basico concluida sem erros criticos." -ForegroundColor Green
exit 0
