param(
    [switch]$FalharSeOrfao
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$assetExtensions = @(
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif", ".ico",
    ".css", ".js", ".mp4", ".webm", ".woff", ".woff2", ".ttf", ".otf", ".pdf"
)

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

    $clean = $reference.Trim().Split("?")[0].Split("#")[0]
    if ([string]::IsNullOrWhiteSpace($clean)) {
        return $null
    }

    if (
        $clean -match '^(?i:https?:|mailto:|tel:|data:|javascript:)' -or
        $clean.StartsWith("//") -or
        $clean.StartsWith("{{")
    ) {
        return $null
    }

    if ($clean.StartsWith("/")) {
        $candidate = Join-Path $root $clean.TrimStart("/").Replace("/", "\\")
    }
    else {
        $candidate = Join-Path $sourceFile.DirectoryName $clean.Replace("/", "\\")
    }

    $resolved = [System.IO.Path]::GetFullPath($candidate)
    if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    return $resolved
}

function Is-AssetReference {
    param([string]$reference)

    if ([string]::IsNullOrWhiteSpace($reference)) {
        return $false
    }

    $clean = $reference.Trim().Split("?")[0].Split("#")[0]
    if ([string]::IsNullOrWhiteSpace($clean)) {
        return $false
    }

    $extension = [System.IO.Path]::GetExtension($clean).ToLowerInvariant()
    return $assetExtensions -contains $extension
}

$sourceFiles = Get-ChildItem -Path $root -Recurse -File -Include *.html, *.css, *.js | Where-Object {
    $_.FullName -notmatch "\\.git\\"
}

$allAssets = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $_.FullName -notmatch "\\.git\\" -and $assetExtensions -contains $_.Extension.ToLowerInvariant()
}

$referencedAssets = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
$missingReferences = New-Object System.Collections.Generic.List[object]

$reportPath = Join-Path (Split-Path -Parent $PSScriptRoot) "relatorios"
$reportPath = Join-Path $reportPath "relatorio-assets.md"
$reportDir = Split-Path $reportPath -Parent
if (-not (Test-Path $reportDir -PathType Container)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

$regexes = @(
    'href\s*=\s*["''](?<path>[^"'']+)["'']',
    'src\s*=\s*["''](?<path>[^"'']+)["'']',
    'srcset\s*=\s*["''](?<path>[^"'']+)["'']',
    'url\(\s*["'']?(?<path>[^)"'']+)["'']?\s*\)'
)

foreach ($sourceFile in $sourceFiles) {
    $content = [System.IO.File]::ReadAllText($sourceFile.FullName)
    $seenInFile = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($rx in $regexes) {
        foreach ($match in [regex]::Matches($content, $rx, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $rawPath = $match.Groups['path'].Value.Trim()
            if ([string]::IsNullOrWhiteSpace($rawPath)) { continue }

            # srcset pode vir com largura/densidade: imagem.webp 2x
            $firstPart = $rawPath.Split(',') | Select-Object -First 1
            $candidateRef = ($firstPart.Trim().Split(' ')[0]).Trim()
            if (-not (Is-AssetReference -reference $candidateRef)) { continue }

            $resolved = Resolve-AssetReference -sourceFile $sourceFile -reference $candidateRef
            if ($null -eq $resolved) { continue }

            if (-not $seenInFile.Add($resolved)) { continue }

            if (Test-Path $resolved -PathType Leaf) {
                [void]$referencedAssets.Add($resolved)
            }
            else {
                $missingReferences.Add([PSCustomObject]@{
                    Source = Get-RelativePath $sourceFile.FullName
                    Referencia = $candidateRef
                    Esperado = Get-RelativePath $resolved
                })
            }
        }
    }
}

$orphans = $allAssets | Where-Object { -not $referencedAssets.Contains($_.FullName) } | Sort-Object FullName

$hasFailures = $false

function Write-ReportSection {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Title,
        [System.Collections.Generic.List[object]]$Items,
        [string]$correction,
        [switch]$Warning
    )

    if ($Items.Count -eq 0) { return }

    $level = if ($Warning) { "⚠️" } else { "❌" }
    $Lines.Add("## $level $Title") | Out-Null
    $Lines.Add("") | Out-Null
    $Lines.Add("**Total:** $($Items.Count) item(ns)") | Out-Null
    $Lines.Add("") | Out-Null

    if ($correction) {
        $Lines.Add("### Como corrigir:") | Out-Null
        $Lines.Add("$correction") | Out-Null
        $Lines.Add("") | Out-Null
    }

    $Lines.Add("### Detalhes:") | Out-Null
    $Lines.Add("") | Out-Null
    foreach ($item in $Items) {
        if ($item -is [string]) {
            $Lines.Add("- " + $item) | Out-Null
        }
        else {
            $Lines.Add("- Arquivo " + $item.Source) | Out-Null
            $Lines.Add("Ref = " + $item.Referencia) | Out-Null
            $Lines.Add("Esperado = " + $item.Esperado) | Out-Null
        }
    }

    $Lines.Add("") | Out-Null
}

if ($missingReferences.Count -gt 0) {
    $hasFailures = $true
    Write-Host "[FALHA] Referencias para assets inexistentes:" -ForegroundColor Red
    $missingReferences | Select-Object -First 80 | ForEach-Object {
        Write-Host "  - $($_.Source) -> $($_.Referencia) (esperado: $($_.Esperado))"
    }
    if ($missingReferences.Count -gt 80) {
        Write-Host "  ... +$($missingReferences.Count - 80) item(ns)" -ForegroundColor DarkYellow
    }
}

if ($orphans.Count -gt 0) {
    $tag = if ($FalharSeOrfao) { "FALHA" } else { "AVISO" }
    $color = if ($FalharSeOrfao) { "Red" } else { "Yellow" }
    Write-Host "[$tag] Possiveis assets orfaos (sem referencia estatica):" -ForegroundColor $color
    $orphans | Select-Object -First 80 | ForEach-Object {
        Write-Host "  - $(Get-RelativePath $_.FullName)"
    }
    if ($orphans.Count -gt 80) {
        Write-Host "  ... +$($orphans.Count - 80) item(ns)" -ForegroundColor DarkYellow
    }

    if ($FalharSeOrfao) {
        $hasFailures = $true
    }
}

# Gerar relatório Markdown SEMPRE
Write-Host "Debug: Iniciando geração de relatório..." -ForegroundColor Cyan
$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# Auditoria de assets referenciados") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
$reportLines.Add("") | Out-Null

$reportLines.Add("## Resumo") | Out-Null
$reportLines.Add("Ref faltantes: $($missingReferences.Count)") | Out-Null
$reportLines.Add("Assets orfaos: $($orphans.Count)") | Out-Null
$reportLines.Add("") | Out-Null

if ($missingReferences.Count -gt 0) {
    $reportLines.Add("## Refs faltantes") | Out-Null
    $reportLines.Add("") | Out-Null
    $reportLines.Add("Como corrigir:") | Out-Null
    $reportLines.Add("1. Verifique se o arquivo de imagem/recurso existe no caminho esperado") | Out-Null
    $reportLines.Add("2. Se nao existe, copie/crie o arquivo no local correto OU corrija o caminho no HTML") | Out-Null
    $reportLines.Add("3. Abra o arquivo HTML mencionado e procure pela referencia") | Out-Null
    $reportLines.Add("4. Corrija o caminho para apontar para o arquivo correto") | Out-Null
    $reportLines.Add("") | Out-Null
    $reportLines.Add("Lista das primeiras 50 referencias faltantes:") | Out-Null
    $reportLines.Add("") | Out-Null
    foreach ($item in $missingReferences | Select-Object -First 50) {
        $reportLines.Add("- Arquivo: $($item.Source)") | Out-Null
        $reportLines.Add("  Referencia: $($item.Referencia)") | Out-Null
        $reportLines.Add("  Esperado em: $($item.Esperado)") | Out-Null
    }
    if ($missingReferences.Count -gt 50) {
        $reportLines.Add("") | Out-Null
        $reportLines.Add("... e mais $($missingReferences.Count - 50) referencias faltantes") | Out-Null
    }
    $reportLines.Add("") | Out-Null
}

if ($orphans.Count -gt 0) {
    $reportLines.Add("## Assets orfaos (possivelmente sem referencia)") | Out-Null
    $reportLines.Add("") | Out-Null
    $reportLines.Add("Como corrigir:") | Out-Null
    $reportLines.Add("1. Revise se estes arquivos ainda sao realmente necessarios") | Out-Null
    $reportLines.Add("2. ANTES DE DELETAR, pesquise se estao referenciados via JavaScript ou dinamicamente") | Out-Null
    $reportLines.Add("3. Se nao sao usados, delete com seguranca ou mova para pasta 'deprecated'") | Out-Null
    $reportLines.Add("4. Considere fazer backup antes de remover") | Out-Null
    $reportLines.Add("") | Out-Null
    $reportLines.Add("Assets encontrados (mostrando 50 primeiros):") | Out-Null
    $reportLines.Add("") | Out-Null
    $cnt = 0
    foreach ($item in $orphans) {
        if ($cnt -ge 50) { break }
        $rel = Get-RelativePath $item.FullName
        $reportLines.Add("- $rel") | Out-Null
        $cnt++
    }
    if ($orphans.Count -gt 50) {
        $reportLines.Add("") | Out-Null
        $reportLines.Add("... e mais $($orphans.Count - 50) arquivos orphaos") | Out-Null
    }
    $reportLines.Add("") | Out-Null
}

$reportLines.Add("Relatorio gerado automaticamente") | Out-Null

Write-Host "Debug: reportPath = $reportPath" -ForegroundColor Cyan
try {
    [System.IO.File]::WriteAllLines($reportPath, $reportLines)
    Write-Host "Relatorio salvo com sucesso em: $reportPath" -ForegroundColor Green
} catch {
    Write-Host "Error ao salvar: $_" -ForegroundColor Red
}

if ($hasFailures) {
    Write-Host "`nVerificacao de assets finalizou com erros." -ForegroundColor Red
    exit 1
}
