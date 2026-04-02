param(
    [int]$TopImages = 30,
    [int]$ImageWarningKB = 250,
    [string]$ReportPath = "ferramentas/relatorios/relatorio-performance.md"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$imageExtensions = @(".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif")
$assetExtensions = $imageExtensions + @(".ico", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf")
$skipDirPattern = "\\.git\\"

function Get-RelativePath {
    param([string]$fullPath)

    $normalizedRoot = [System.IO.Path]::GetFullPath($root).TrimEnd("\\")
    $normalizedFullPath = [System.IO.Path]::GetFullPath($fullPath)

    if ($normalizedFullPath.StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        return ($normalizedFullPath.Substring($normalizedRoot.Length).TrimStart("\\") -replace '\\', '/')
    }

    return ($normalizedFullPath -replace '\\', '/')
}

function Resolve-AssetReference {
    param(
        [System.IO.FileInfo]$sourceFile,
        [string]$reference
    )

    if ([string]::IsNullOrWhiteSpace($reference)) {
        return $null
    }

    $cleanReference = $reference.Trim().Split("?")[0].Split("#")[0]

    # URLs absolutas do proprio dominio: extrair o caminho e resolver normalmente
    if ($cleanReference -match '^(?i:https?://(www\.)?aeca\.com\.br)') {
        $sitePath = $cleanReference -replace '(?i:^https?://(www\.)?aeca\.com\.br)', ''
        if ([string]::IsNullOrEmpty($sitePath) -or $sitePath -eq "/") {
            return $null
        }
        $candidate = Join-Path $root $sitePath.TrimStart("/").Replace("/", "\\")
        $resolved = [System.IO.Path]::GetFullPath($candidate)
        if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $null
        }
        return $resolved
    }

    if (
        $cleanReference -match '^(?i:https?:|mailto:|tel:|data:|javascript:)' -or
        $cleanReference.StartsWith("//") -or
        $cleanReference.StartsWith("{{")
    ) {
        return $null
    }

    if ($cleanReference.StartsWith("/")) {
        $candidate = Join-Path $root $cleanReference.TrimStart("/").Replace("/", "\\")
    }
    else {
        $candidate = Join-Path $sourceFile.DirectoryName $cleanReference.Replace("/", "\\")
    }

    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    return $resolved
}

function Get-AssetReferences {
    param([string]$content)

    $pattern = '(?<path>(?:https?:)?//[^"''\s)<>]+\.(?:png|jpe?g|webp|gif|svg|avif|ico|mp4|webm|woff2?|ttf|otf)|(?:/|\.{1,2}/)?[^"''\s()<>]+\.(?:png|jpe?g|webp|gif|svg|avif|ico|mp4|webm|woff2?|ttf|otf))'

    foreach ($match in [regex]::Matches($content, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $value = $match.Groups["path"].Value
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $value
        }
    }
}

$sourceFiles = Get-ChildItem -Recurse -File -Include *.html, *.css, *.js | Where-Object {
    $_.FullName -notmatch $skipDirPattern
}

$assets = Get-ChildItem -Recurse -File | Where-Object {
    $_.FullName -notmatch $skipDirPattern -and $assetExtensions -contains $_.Extension.ToLowerInvariant()
}

$images = $assets | Where-Object { $imageExtensions -contains $_.Extension.ToLowerInvariant() }
$referencedAssets = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

foreach ($sourceFile in $sourceFiles) {
    $content = [System.IO.File]::ReadAllText($sourceFile.FullName)
    foreach ($reference in Get-AssetReferences -content $content) {
        $resolved = Resolve-AssetReference -sourceFile $sourceFile -reference $reference
        if ($null -ne $resolved -and (Test-Path $resolved -PathType Leaf)) {
            [void]$referencedAssets.Add($resolved)
        }
    }
}

$largestImages = $images |
    Sort-Object Length -Descending |
    Select-Object -First $TopImages |
    ForEach-Object {
        [PSCustomObject]@{
            Path = Get-RelativePath $_.FullName
            SizeKB = [math]::Round($_.Length / 1KB, 1)
            SizeMB = [math]::Round($_.Length / 1MB, 2)
        }
    }

$heavyImages = $images |
    Where-Object { $_.Length -ge ($ImageWarningKB * 1KB) } |
    Sort-Object Length -Descending |
    ForEach-Object {
        [PSCustomObject]@{
            Path = Get-RelativePath $_.FullName
            SizeKB = [math]::Round($_.Length / 1KB, 1)
        }
    }

$possibleOrphans = $assets |
    Where-Object { -not $referencedAssets.Contains($_.FullName) } |
    Sort-Object FullName |
    ForEach-Object {
        [PSCustomObject]@{
            Path = Get-RelativePath $_.FullName
            Type = $_.Extension.ToLowerInvariant()
            SizeKB = [math]::Round($_.Length / 1KB, 1)
        }
    }

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# Auditoria de performance")
$reportLines.Add("")
$reportLines.Add("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$reportLines.Add("")
$reportLines.Add("## Resumo")
$reportLines.Add("")
$reportLines.Add("- Imagens analisadas: $($images.Count)")
$reportLines.Add("- Assets analisados: $($assets.Count)")
$reportLines.Add("- Imagens acima de $ImageWarningKB KB: $($heavyImages.Count)")
$reportLines.Add("- Possiveis assets orfaos: $($possibleOrphans.Count)")
$reportLines.Add("")
$reportLines.Add("## Imagens mais pesadas")
$reportLines.Add("")
$reportLines.Add("| Arquivo | KB | MB |")
$reportLines.Add("| --- | ---: | ---: |")
foreach ($item in $largestImages) {
    $reportLines.Add("| $($item.Path) | $($item.SizeKB) | $($item.SizeMB) |")
}

$reportLines.Add("")
$reportLines.Add("## Imagens acima do limite")
$reportLines.Add("")
if ($heavyImages.Count -eq 0) {
    $reportLines.Add("Nenhuma imagem acima do limite configurado.")
}
else {
    $reportLines.Add("| Arquivo | KB |")
    $reportLines.Add("| --- | ---: |")
    foreach ($item in $heavyImages) {
        $reportLines.Add("| $($item.Path) | $($item.SizeKB) |")
    }
}

$reportLines.Add("")
$reportLines.Add("## Possiveis assets orfaos")
$reportLines.Add("")
$reportLines.Add("Estes arquivos nao foram encontrados em referencias estaticas de HTML, CSS ou JS. Revise antes de excluir.")
$reportLines.Add("")
if ($possibleOrphans.Count -eq 0) {
    $reportLines.Add("Nenhum asset orfao encontrado pelos criterios atuais.")
}
else {
    $reportLines.Add("| Arquivo | Tipo | KB |")
    $reportLines.Add("| --- | --- | ---: |")
    foreach ($item in $possibleOrphans) {
        $reportLines.Add("| $($item.Path) | $($item.Type) | $($item.SizeKB) |")
    }
}

$reportLines.Add("")
$reportLines.Add("## Revisao manual de Core Web Vitals")
$reportLines.Add("")
$reportLines.Add("Revise pelo menos estas paginas no PageSpeed Insights e registre LCP, INP e CLS em mobile e desktop:")
$reportLines.Add("")
$reportLines.Add("- /")
$reportLines.Add("- /espetaculos/")
$reportLines.Add("- /espetaculos/2026/quando-voce-nao-estiver-mais-aqui.html")
$reportLines.Add("- /espetaculos/2026/12-jurados-e-uma-sentenca.html")
$reportLines.Add("- /espetaculos/2026/as-bruxas-de-salem.html")
$reportLines.Add("")
$reportLines.Add("A cada rodada, anote:")
$reportLines.Add("")
$reportLines.Add("- Pagina e data da medicao")
$reportLines.Add("- LCP e elemento candidato")
$reportLines.Add("- INP e principal interacao afetada")
$reportLines.Add("- CLS e componente que gerou instabilidade")
$reportLines.Add("- Acao corretiva priorizada")

$reportFullPath = Join-Path $root $ReportPath.Replace("/", "\\")
$reportDir = Split-Path -Parent $reportFullPath
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

[System.IO.File]::WriteAllLines($reportFullPath, $reportLines)

Write-Host "Performance audit complete." -ForegroundColor Green
Write-Host "Report: $(Get-RelativePath $reportFullPath)"
Write-Host "Heavy images: $($heavyImages.Count)"
Write-Host "Possible orphan assets: $($possibleOrphans.Count)"
exit 0