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

function Resolve-LocalReference {
    param(
        [System.IO.FileInfo]$sourceFile,
        [string]$reference
    )

    if ([string]::IsNullOrWhiteSpace($reference)) {
        return $null
    }

    $clean = $reference.Trim().Split("?")[0]
    if ($clean.StartsWith("#")) {
        return [PSCustomObject]@{
            Path = $sourceFile.FullName
            Fragment = $clean.TrimStart("#")
        }
    }

    $parts = $clean.Split("#", 2)
    $pathPart = $parts[0]
    $fragment = if ($parts.Count -gt 1) { $parts[1] } else { "" }

    if ($pathPart.StartsWith("/")) {
        $baseCandidate = Join-Path $root $pathPart.TrimStart("/").Replace("/", "\\")
    }
    else {
        $baseCandidate = Join-Path $sourceFile.DirectoryName $pathPart.Replace("/", "\\")
    }

    $candidates = New-Object System.Collections.Generic.List[string]
    $normalizedBase = [System.IO.Path]::GetFullPath($baseCandidate)
    $candidates.Add($normalizedBase) | Out-Null

    if ([string]::IsNullOrWhiteSpace($pathPart) -or $pathPart -eq "/") {
        $candidates.Add([System.IO.Path]::GetFullPath((Join-Path $root "index.html"))) | Out-Null
    }
    elseif (-not [System.IO.Path]::GetExtension($normalizedBase)) {
        $candidates.Add($normalizedBase + ".html") | Out-Null
        $candidates.Add([System.IO.Path]::GetFullPath((Join-Path $normalizedBase "index.html"))) | Out-Null
    }
    elseif ($pathPart.EndsWith("/")) {
        $candidates.Add([System.IO.Path]::GetFullPath((Join-Path $normalizedBase "index.html"))) | Out-Null
    }

    $resolved = $null
    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if ($candidate.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $candidate -PathType Leaf)) {
            $resolved = $candidate
            break
        }
    }

    if ($null -eq $resolved) {
        $resolved = $normalizedBase
    }

    if (-not $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $null
    }

    return [PSCustomObject]@{
        Path = $resolved
        Fragment = $fragment
    }
}

function Test-FragmentExists {
    param(
        [string]$filePath,
        [string]$fragment
    )

    if ([string]::IsNullOrWhiteSpace($fragment)) {
        return $true
    }

    if (-not (Test-Path $filePath -PathType Leaf)) {
        return $false
    }

    $raw = [System.IO.File]::ReadAllText($filePath)
    $escaped = [regex]::Escape($fragment)
    return ($raw -match ('id\s*=\s*"' + $escaped + '"') -or $raw -match ("id\s*=\s*'" + $escaped + "'"))
}

$htmlFiles = Get-ChildItem -Path $root -Recurse -File -Filter *.html | Where-Object {
    $_.FullName -notmatch "\\html\\" -and $_.FullName -notmatch "\\.git\\"
}

$missingFiles = New-Object System.Collections.Generic.List[object]
$missingFragments = New-Object System.Collections.Generic.List[object]

$reportPath = Join-Path (Split-Path -Parent $PSScriptRoot) "relatorios"
$reportPath = Join-Path $reportPath "relatorio-links.md"
$reportDir = Split-Path $reportPath -Parent
if (-not (Test-Path $reportDir -PathType Container)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

foreach ($file in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $relSource = Get-RelativePath $file.FullName

    foreach ($match in [regex]::Matches($content, '<a[^>]+href\s*=\s*["''](?<href>[^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $href = $match.Groups["href"].Value.Trim()
        if ([string]::IsNullOrWhiteSpace($href)) { continue }

        if (
            $href -match '^(?i:https?:|mailto:|tel:|data:|javascript:)' -or
            $href.StartsWith("//") -or
            $href.StartsWith("{{")
        ) {
            continue
        }

        $target = Resolve-LocalReference -sourceFile $file -reference $href
        if ($null -eq $target) {
            continue
        }

        if (-not (Test-Path $target.Path -PathType Leaf)) {
            $missingFiles.Add([PSCustomObject]@{
                Source = $relSource
                Link = $href
                Target = Get-RelativePath $target.Path
            })
            continue
        }

        if (-not (Test-FragmentExists -filePath $target.Path -fragment $target.Fragment)) {
            $missingFragments.Add([PSCustomObject]@{
                Source = $relSource
                Link = $href
                Target = Get-RelativePath $target.Path
                Fragment = $target.Fragment
            })
        }
    }
}

$hasFailures = $false

function Write-ReportSection {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Title,
        [System.Collections.Generic.List[object]]$Items,
        [string]$correction
    )

    if ($Items.Count -eq 0) { return }

    $Lines.Add("## $Title") | Out-Null
    $Lines.Add("") | Out-Null
    $Lines.Add("**Total:** $($Items.Count) item(ns)") | Out-Null
    $Lines.Add("") | Out-Null

    if ($correction) {
        $Lines.Add("### Como corrigir:") | Out-Null
        $Lines.Add("$correction") | Out-Null
        $Lines.Add("") | Out-Null
    }

    foreach ($item in $Items) {
        if ($item -is [string]) {
            $Lines.Add("- $item") | Out-Null
        }
        else {
            $Lines.Add("- **Arquivo:** " + $item.Source) | Out-Null
            if ($item.Link) {
                $Lines.Add("LinkedRef = " + $item.Link) | Out-Null
            }
            if ($item.Target) {
                $Lines.Add("TargetRef = " + $item.Target) | Out-Null
            }
            if ($item.Fragment) {
                $Lines.Add("Fragment = #" + $item.Fragment) | Out-Null
            }
        }
    }

    $Lines.Add("") | Out-Null
}

if ($missingFiles.Count -gt 0) {
    $hasFailures = $true
    Write-Host "[FALHA] Links internos apontando para arquivo inexistente:" -ForegroundColor Red
    $missingFiles | Select-Object -First 50 | ForEach-Object {
        Write-Host "  - $($_.Source) -> $($_.Link) (alvo: $($_.Target))"
    }
    if ($missingFiles.Count -gt 50) {
        Write-Host "  ... +$($missingFiles.Count - 50) item(ns)" -ForegroundColor DarkYellow
    }
}

if ($missingFragments.Count -gt 0) {
    $hasFailures = $true
    Write-Host "[FALHA] Links com ancora para id inexistente:" -ForegroundColor Red
    $missingFragments | Select-Object -First 50 | ForEach-Object {
        Write-Host "  - $($_.Source) -> $($_.Link) (id: $($_.Fragment))"
    }
    if ($missingFragments.Count -gt 50) {
        Write-Host "  ... +$($missingFragments.Count - 50) item(ns)" -ForegroundColor DarkYellow
    }
}

if ($hasFailures) {
    Write-Host "`nVerificacao de links finalizou com erros." -ForegroundColor Red
    exit 1
}

# Gerar relatório Markdown
$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# Auditoria de links internos") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
$reportLines.Add("") | Out-Null

$reportLines.Add("## Resumo") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("- **Links quebrados (arquivo inexistente):** $($missingFiles.Count)") | Out-Null
$reportLines.Add("- **Links com âncora inválida:** $($missingFragments.Count)") | Out-Null
$reportLines.Add("") | Out-Null

$correctionFiles = "1. Localize o arquivo HTML que contem o link quebrado (arquivo-source indicado)
2. Procure pelo link invalido (link-inválido)
3. Verifique se o alvo (arquivo-target) realmente existe no diretorio esperado
4. Se nao existe, crie-o ou corrija o caminho do link com a rota correta
5. Use caminhos absolutos (/) para links globais ou relativos para locais
6. Teste o link apos a correcao"

$correctionFragments = "1. Abra o arquivo HTML que contem o link (arquivo-source)
2. Procure pelo link com ancora (link-invalido)
3. Abra o arquivo alvo (arquivo-target) e procure pelo id desejado
4. Se o id nao existir, adicione-o ao elemento HTML relevante usando id='nome-id'
5. Retorne e teste o link com ancora apos a correcao"

Write-ReportSection -Lines $reportLines -Title "Links para arquivos inexistentes" -Items $missingFiles -correction $correctionFiles
Write-ReportSection -Lines $reportLines -Title "Links com âncoras inválidas" -Items $missingFragments -correction $correctionFragments

$reportLines.Add("---") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("**Relatório gerado automaticamente pelo script verificar-links.ps1**") | Out-Null

[System.IO.File]::WriteAllLines($reportPath, $reportLines)
Write-Host "`nRelatório salvo em: $reportPath" -ForegroundColor Green

Write-Host "Verificacao de links concluida sem erros." -ForegroundColor Green
exit 0
