[CmdletBinding()]
param(
    [switch]$FalharSeEncontrarOrfaos
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ferramentasRoot = Split-Path -Parent $scriptRoot
$repoRoot = Split-Path -Parent $ferramentasRoot
$relatoriosDir = Join-Path $ferramentasRoot "relatorios"
$reportPath = Join-Path $relatoriosDir "relatorio-assets-referenciados.md"

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

function Resolve-ReferencePath {
    param(
        [string]$Candidate,
        [string]$BaseDirRelative
    )

    if ([string]::IsNullOrWhiteSpace($Candidate)) {
        return ""
    }

    if ($Candidate.StartsWith('/')) {
        return ConvertTo-RepoRelativePath -PathValue $Candidate
    }

    $norm = ConvertTo-RepoRelativePath -PathValue $Candidate
    if ([string]::IsNullOrWhiteSpace($norm)) {
        return ""
    }

    $joined = if ([string]::IsNullOrWhiteSpace($BaseDirRelative)) { $norm } else { Join-Path $BaseDirRelative $norm }
    $joined = $joined -replace '\\', '/'
    $parts = $joined.Split('/')
    $stack = New-Object System.Collections.Generic.List[string]

    foreach ($part in $parts) {
        if ($part -eq '' -or $part -eq '.') { continue }
        if ($part -eq '..') {
            if ($stack.Count -gt 0) { $stack.RemoveAt($stack.Count - 1) }
            continue
        }
        $stack.Add($part)
    }

    return ($stack -join '/')
}

$assetExtensions = @(
    '.css', '.js', '.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg',
    '.woff', '.woff2', '.ttf', '.otf', '.eot', '.mp4', '.webm', '.pdf'
)

$assets = Get-ChildItem -Path $repoRoot -Recurse -File | Where-Object {
    $ext = $_.Extension.ToLowerInvariant()
    $assetExtensions -contains $ext
} | ForEach-Object {
    $_.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')
}

$assetSet = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
foreach ($a in $assets) { $null = $assetSet.Add($a) }

$referenced = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)
$sourceFiles = Get-ChildItem -Path $repoRoot -Recurse -File | Where-Object {
    @('.html', '.css', '.js', '.xml', '.md', '.txt') -contains $_.Extension.ToLowerInvariant()
}

$pattern = '(?i)(?:src|href)\s*=\s*"([^"]+)"|(?:src|href)\s*=\s*''([^'']+)''|url\(\s*"([^"]+)"\s*\)|url\(\s*''([^'']+)''\s*\)|url\(\s*([^\)\s]+)\s*\)|([A-Za-z0-9_\-\/\.]+\.(?:css|js|png|jpe?g|webp|avif|gif|svg|woff2?|ttf|otf|eot|mp4|webm|pdf))'

foreach ($source in $sourceFiles) {
    $content = Get-Content -LiteralPath $source.FullName -Raw
    $baseDir = Split-Path -Parent $source.FullName
    $baseRel = $baseDir.Substring($repoRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar).Replace([IO.Path]::DirectorySeparatorChar, '/')

    $allMatches = [regex]::Matches($content, $pattern)
    foreach ($m in $allMatches) {
        $candidate = ""
        for ($i = 1; $i -lt $m.Groups.Count; $i++) {
            if ($m.Groups[$i].Success) {
                $candidate = $m.Groups[$i].Value
                break
            }
        }

        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if ($candidate -match '^(?i)(https?:|mailto:|tel:|javascript:|data:)') {
            continue
        }

        $resolved = Resolve-ReferencePath -Candidate $candidate -BaseDirRelative $baseRel
        if ([string]::IsNullOrWhiteSpace($resolved)) {
            continue
        }

        if ($assetSet.Contains($resolved)) {
            $null = $referenced.Add($resolved)
        }
    }
}

$possibleOrphans = New-Object System.Collections.Generic.List[string]
foreach ($asset in $assets) {
    if (-not $referenced.Contains($asset)) {
        $possibleOrphans.Add($asset)
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Relatorio de assets referenciados")
$lines.Add("")
$lines.Add("Data da analise: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("")
$lines.Add("Total de assets mapeados: $($assets.Count)")
$lines.Add("Total de assets referenciados estaticamente: $($referenced.Count)")
$lines.Add("Total de possiveis orfaos: $($possibleOrphans.Count)")
$lines.Add("")
$lines.Add("## Possiveis assets orfaos")
$lines.Add("")

if ($possibleOrphans.Count -eq 0) {
    $lines.Add("Nenhum possivel asset orfao encontrado.")
}
else {
    foreach ($item in ($possibleOrphans | Sort-Object)) {
        $lines.Add("- $item")
    }
}

$lines.Add("")
$lines.Add("## Observacao")
$lines.Add("")
$lines.Add("A lista e baseada em referencias estaticas. Revise manualmente antes de excluir arquivos.")

Set-Content -LiteralPath $reportPath -Value $lines -Encoding UTF8

Write-Host "[INFO] Relatorio salvo em: $reportPath"
Write-Host "[INFO] Possiveis orfaos encontrados: $($possibleOrphans.Count)"

if ($FalharSeEncontrarOrfaos -and $possibleOrphans.Count -gt 0) {
    Write-Host "[ERRO] Falha solicitada por parametro devido a possiveis orfaos." -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Verificacao de assets referenciados concluida." -ForegroundColor Green
exit 0
