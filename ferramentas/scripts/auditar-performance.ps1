[CmdletBinding()]
param(
    [double]$LimiteMB = 0.5,
    [int]$Top = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ferramentasRoot = Split-Path -Parent $scriptRoot
$repoRoot = Split-Path -Parent $ferramentasRoot
$relatoriosDir = Join-Path $ferramentasRoot "relatorios"
$reportPath = Join-Path $relatoriosDir "relatorio-performance.md"

if (-not (Test-Path -LiteralPath $relatoriosDir)) {
    New-Item -ItemType Directory -Path $relatoriosDir | Out-Null
}

function ConvertTo-RepoRelativePath {
    param([string]$PathValue)

    if ([string]::IsNullOrWhiteSpace($PathValue)) {
        return ""
    }

    $normalized = $PathValue.Trim()
    $normalized = $normalized -replace '^["'']|["'']$', ''
    $normalized = $normalized.Split('#')[0].Split('?')[0]
    $normalized = $normalized -replace '\\', '/'

    while ($normalized.StartsWith("./")) {
        $normalized = $normalized.Substring(2)
    }

    if ($normalized.StartsWith("/")) {
        $normalized = $normalized.Substring(1)
    }

    return $normalized
}

function Get-AssetRefsFromContent {
    param(
        [string]$Content,
        [string]$BaseDirRelative,
        [string[]]$Extensions
    )

    $results = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

    $pattern = '(?i)(?:src|href)\s*=\s*"([^"]+)"|(?:src|href)\s*=\s*''([^'']+)''|url\(\s*"([^"]+)"\s*\)|url\(\s*''([^'']+)''\s*\)|url\(\s*([^\)\s]+)\s*\)'
    $allMatches = [regex]::Matches($Content, $pattern)

    foreach ($match in $allMatches) {
        $candidate = ""
        for ($i = 1; $i -lt $match.Groups.Count; $i++) {
            if ($match.Groups[$i].Success) {
                $candidate = $match.Groups[$i].Value
                break
            }
        }

        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if ($candidate -match '^(?i)(https?:|mailto:|tel:|javascript:|data:)') {
            continue
        }

        $normalized = ConvertTo-RepoRelativePath -PathValue $candidate
        if ([string]::IsNullOrWhiteSpace($normalized)) {
            continue
        }

        $ext = [System.IO.Path]::GetExtension($normalized)
        if ([string]::IsNullOrWhiteSpace($ext)) {
            continue
        }

        if ($Extensions -notcontains $ext.ToLowerInvariant()) {
            continue
        }

        if ($candidate.StartsWith("/")) {
            $null = $results.Add($normalized)
            continue
        }

        $joined = Join-Path $BaseDirRelative $normalized
        $joined = $joined -replace '\\', '/'
        $parts = $joined.Split('/')
        $stack = New-Object System.Collections.Generic.List[string]
        foreach ($part in $parts) {
            if ($part -eq '' -or $part -eq '.') { continue }
            if ($part -eq '..') {
                if ($stack.Count -gt 0) {
                    $stack.RemoveAt($stack.Count - 1)
                }
                continue
            }
            $stack.Add($part)
        }
        $resolved = ($stack -join '/')
        if (-not [string]::IsNullOrWhiteSpace($resolved)) {
            $null = $results.Add($resolved)
        }
    }

    return $results
}

$imageExtensions = @('.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg')
$limitBytes = [Math]::Round($LimiteMB * 1MB)

$imageFiles = Get-ChildItem -Path $repoRoot -Recurse -File | Where-Object {
    $imageExtensions -contains $_.Extension.ToLowerInvariant()
}

$referenced = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
$sourceFiles = Get-ChildItem -Path $repoRoot -Recurse -File | Where-Object {
    @('.html', '.css', '.js') -contains $_.Extension.ToLowerInvariant()
}

foreach ($source in $sourceFiles) {
    $content = Get-Content -LiteralPath $source.FullName -Raw
    $baseDir = Split-Path -Parent $source.FullName
    $baseRel = $baseDir.Substring($repoRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar).Replace([IO.Path]::DirectorySeparatorChar, '/')
    $found = Get-AssetRefsFromContent -Content $content -BaseDirRelative $baseRel -Extensions $imageExtensions
    foreach ($item in $found) {
        $null = $referenced.Add($item)
    }
}

$ranked = $imageFiles | Sort-Object Length -Descending
$topRanked = $ranked | Select-Object -First $Top
$heavy = $ranked | Where-Object { $_.Length -ge $limitBytes }

$possibleOrphans = New-Object System.Collections.Generic.List[string]
foreach ($file in $imageFiles) {
    $relative = $file.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')
    if (-not $referenced.Contains($relative)) {
        $possibleOrphans.Add($relative)
    }
}

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Relatorio de performance")
$lines.Add("")
$lines.Add("Data da analise: $timestamp")
$lines.Add("")
$lines.Add("## Ranking das imagens mais pesadas")
$lines.Add("")
$lines.Add("| # | Arquivo | Tamanho (KB) |")
$lines.Add("|---:|---|---:|")

$index = 1
foreach ($img in $topRanked) {
    $relative = $img.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')
    $kb = [Math]::Round($img.Length / 1KB, 2)
    $lines.Add("| $index | $relative | $kb |")
    $index += 1
}

if ($topRanked.Count -eq 0) {
    $lines.Add("| - | Nenhuma imagem encontrada | 0 |")
}

$lines.Add("")
$lines.Add("## Imagens acima do limite configurado")
$lines.Add("")
$lines.Add("Limite atual: $LimiteMB MB")
$lines.Add("")

if ($heavy.Count -gt 0) {
    $lines.Add("| Arquivo | Tamanho (KB) |")
    $lines.Add("|---|---:|")
    foreach ($img in $heavy) {
        $relative = $img.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')
        $kb = [Math]::Round($img.Length / 1KB, 2)
        $lines.Add("| $relative | $kb |")
    }
}
else {
    $lines.Add("Nenhuma imagem acima do limite.")
}

$lines.Add("")
$lines.Add("## Possiveis assets orfaos (imagens)")
$lines.Add("")

if ($possibleOrphans.Count -gt 0) {
    foreach ($orphan in ($possibleOrphans | Sort-Object)) {
        $lines.Add("- $orphan")
    }
}
else {
    $lines.Add("Nenhum possivel asset orfao identificado para imagens.")
}

$lines.Add("")
$lines.Add("## Checklist para revisar Core Web Vitals")
$lines.Add("")
$lines.Add("- [ ] Medir pagina inicial em ferramenta externa (PageSpeed/Search Console/CrUX).")
$lines.Add("- [ ] Medir acervo de espetaculos.")
$lines.Add("- [ ] Medir cada pagina em cartaz com CTA de ingresso.")
$lines.Add("- [ ] Registrar por pagina: data, LCP, INP, CLS, correcao priorizada e prazo.")

Set-Content -LiteralPath $reportPath -Value $lines -Encoding UTF8

Write-Host "[OK] Relatorio gerado em: $reportPath" -ForegroundColor Green
Write-Host "[INFO] Imagens avaliadas: $($imageFiles.Count)"
Write-Host "[INFO] Imagens acima do limite: $($heavy.Count)"
Write-Host "[INFO] Possiveis orfaos: $($possibleOrphans.Count)"

exit 0
