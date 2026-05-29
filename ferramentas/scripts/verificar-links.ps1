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
$reportPath = Join-Path $relatoriosDir "relatorio-links.md"

if (-not (Test-Path -LiteralPath $relatoriosDir)) {
    New-Item -ItemType Directory -Path $relatoriosDir | Out-Null
}

function Resolve-RelativePath {
    param(
        [string]$BaseDir,
        [string]$Candidate,
        [switch]$Absolute
    )

    $rawValue = if ($null -eq $Candidate) { "" } else { [string]$Candidate }
    $value = $rawValue.Trim()
    if ([string]::IsNullOrWhiteSpace($value)) {
        return ""
    }

    $value = $value -replace '\\', '/'

    if ($Absolute) {
        while ($value.StartsWith('/')) { $value = $value.Substring(1) }
        return $value
    }

    $joined = if ([string]::IsNullOrWhiteSpace($BaseDir)) { $value } else { Join-Path $BaseDir $value }
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

function Resolve-TargetPath {
    param(
        [string]$CurrentFileRelative,
        [string]$RawUrl
    )

    if ([string]::IsNullOrWhiteSpace($RawUrl)) {
        return $null
    }

    $url = $RawUrl.Trim()
    if ($url -match '^(?i)(https?:|mailto:|tel:|javascript:|data:)') {
        return $null
    }

    if ($url.StartsWith('#')) {
        return $null
    }

    $pathPart = $url.Split('?')[0].Split('#')[0]
    try {
        $pathPart = [System.Uri]::UnescapeDataString($pathPart)
    }
    catch {
        # Mantem o valor original caso a URL esteja malformada.
    }
    if ([string]::IsNullOrWhiteSpace($pathPart)) {
        return $null
    }

    $currentDir = Split-Path -Parent $CurrentFileRelative
    if ([string]::IsNullOrWhiteSpace($currentDir)) { $currentDir = "" }

    if ($pathPart.StartsWith('/')) {
        return Resolve-RelativePath -BaseDir "" -Candidate $pathPart -Absolute
    }

    return Resolve-RelativePath -BaseDir $currentDir -Candidate $pathPart
}

function Test-ResolvedPath {
    param([string]$RepoRelativePath)

    if ([string]::IsNullOrWhiteSpace($RepoRelativePath)) {
        return $true
    }

    $full = Join-Path $repoRoot $RepoRelativePath
    if (Test-Path -LiteralPath $full) {
        return $true
    }

    if ($RepoRelativePath.EndsWith('/')) {
        $indexPath = Join-Path $repoRoot ($RepoRelativePath + "index.html")
        return (Test-Path -LiteralPath $indexPath)
    }

    $asIndex = Join-Path $repoRoot ($RepoRelativePath.TrimEnd('/') + "/index.html")
    if (Test-Path -LiteralPath $asIndex) {
        return $true
    }

    if (-not [System.IO.Path]::HasExtension($RepoRelativePath) -and -not $RepoRelativePath.EndsWith('/')) {
        $asHtml = Join-Path $repoRoot ($RepoRelativePath + ".html")
        if (Test-Path -LiteralPath $asHtml) {
            return $true
        }
    }

    return $false
}

$htmlFiles = Get-ChildItem -Path $repoRoot -Recurse -File -Filter "*.html"
$broken = New-Object System.Collections.Generic.List[object]

$pattern = '(?is)<a\b[^>]*\bhref\s*=\s*"([^"]+)"|<a\b[^>]*\bhref\s*=\s*''([^'']+)''' 

foreach ($file in $htmlFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $relative = $file.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')

    $allMatches = [regex]::Matches($content, $pattern)
    foreach ($match in $allMatches) {
        $raw = ""
        if ($match.Groups[1].Success) { $raw = $match.Groups[1].Value }
        elseif ($match.Groups[2].Success) { $raw = $match.Groups[2].Value }

        if ([string]::IsNullOrWhiteSpace($raw)) {
            continue
        }

        $resolved = Resolve-TargetPath -CurrentFileRelative $relative -RawUrl $raw
        if ($null -eq $resolved) {
            continue
        }

        if (-not (Test-ResolvedPath -RepoRelativePath $resolved)) {
            $broken.Add([PSCustomObject]@{
                Origem = $relative
                Link = $raw
                Resolvido = $resolved
            })
        }
    }
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Relatorio de links")
$lines.Add("")
$lines.Add("Data da analise: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
$lines.Add("")

if ($broken.Count -eq 0) {
    $lines.Add("Nenhum link interno quebrado encontrado.")
}
else {
    $lines.Add("Total de links internos quebrados: $($broken.Count)")
    $lines.Add("")
    $lines.Add("| Origem | Link | Caminho resolvido |")
    $lines.Add("|---|---|---|")

    foreach ($item in $broken) {
        $lines.Add("| $($item.Origem) | $($item.Link) | $($item.Resolvido) |")
    }
}

Set-Content -LiteralPath $reportPath -Value $lines -Encoding UTF8

if ($broken.Count -eq 0) {
    Write-Host "[OK] Nenhum link interno quebrado encontrado." -ForegroundColor Green
    Write-Host "[OK] Relatorio salvo em: $reportPath" -ForegroundColor Green
    exit 0
}

Write-Host "[ERRO] Foram encontrados links internos quebrados: $($broken.Count)" -ForegroundColor Red
Write-Host "[INFO] Relatorio salvo em: $reportPath"
exit 1
