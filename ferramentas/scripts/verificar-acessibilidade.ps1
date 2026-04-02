param(
    [string]$ReportPath = "ferramentas/relatorios/relatorio-acessibilidade.md"
)

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

function Strip-Tags {
    param([string]$text)
    $withoutTags = [regex]::Replace($text, '<[^>]+>', ' ')
    return [regex]::Replace($withoutTags, '\s+', ' ').Trim()
}

function Write-ReportSection {
    param(
        [System.Collections.Generic.List[string]]$Lines,
        [string]$Title,
        [System.Collections.Generic.List[string]]$Items,
        [switch]$WarningOnly
    )

    $Lines.Add("## $Title") | Out-Null
    $Lines.Add("") | Out-Null

    if ($Items.Count -eq 0) {
        $Lines.Add("Nenhum problema encontrado.") | Out-Null
        $Lines.Add("") | Out-Null
        return
    }

    $status = if ($WarningOnly) { "Aviso" } else { "Falha" }
    $Lines.Add("Status: $status") | Out-Null
    $Lines.Add("") | Out-Null

    foreach ($item in ($Items | Sort-Object -Unique)) {
        $Lines.Add("- $item") | Out-Null
    }

    $Lines.Add("") | Out-Null
}

$htmlFiles = Get-ChildItem -Path $root -Recurse -File -Filter *.html | Where-Object {
    $_.FullName -notmatch "\\html\\" -and $_.FullName -notmatch "\\.git\\"
}

$missingLang = New-Object System.Collections.Generic.List[string]
$imgWithoutAlt = New-Object System.Collections.Generic.List[string]
$buttonsWithoutName = New-Object System.Collections.Generic.List[string]
$linksWithoutName = New-Object System.Collections.Generic.List[string]
$inputsWithoutLabel = New-Object System.Collections.Generic.List[string]
$headingSkips = New-Object System.Collections.Generic.List[string]
$missingMain = New-Object System.Collections.Generic.List[string]

foreach ($file in $htmlFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)
    $relPath = Get-RelativePath $file.FullName

    if ($content -notmatch '<html[^>]*\slang\s*=\s*["'']pt(-BR)?["'']') {
        $missingLang.Add($relPath)
    }

    foreach ($img in [regex]::Matches($content, '<img\b[^>]*>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $tag = $img.Value
        if ($tag -notmatch '\salt\s*=\s*["''][^"'']*["'']') {
            $imgWithoutAlt.Add($relPath)
            break
        }
    }

    foreach ($btn in [regex]::Matches($content, '<button\b[^>]*>(?<inner>[\s\S]*?)</button>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $full = $btn.Value
        $innerText = Strip-Tags $btn.Groups['inner'].Value
        $hasAria = $full -match 'aria-label\s*=\s*["''][^"'']+["'']'
        $hasTitle = $full -match 'title\s*=\s*["''][^"'']+["'']'
        if ([string]::IsNullOrWhiteSpace($innerText) -and -not $hasAria -and -not $hasTitle) {
            $buttonsWithoutName.Add($relPath)
            break
        }
    }

    foreach ($link in [regex]::Matches($content, '<a\b[^>]*href\s*=\s*["''][^"'']+["''][^>]*>(?<inner>[\s\S]*?)</a>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $full = $link.Value
        $innerText = Strip-Tags $link.Groups['inner'].Value
        $hasAria = $full -match 'aria-label\s*=\s*["''][^"'']+["'']'
        $hasTitle = $full -match 'title\s*=\s*["''][^"'']+["'']'
        if ([string]::IsNullOrWhiteSpace($innerText) -and -not $hasAria -and -not $hasTitle) {
            $linksWithoutName.Add($relPath)
            break
        }
    }

    $labelsByFor = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($label in [regex]::Matches($content, '<label\b[^>]*for\s*=\s*["''](?<for>[^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        [void]$labelsByFor.Add($label.Groups['for'].Value)
    }

    foreach ($input in [regex]::Matches($content, '<(input|select|textarea)\b(?<attrs>[^>]*)>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $attrs = $input.Groups['attrs'].Value
        if ($attrs -match 'type\s*=\s*["'']hidden["'']') { continue }

        $idMatch = [regex]::Match($attrs, '\sid\s*=\s*["''](?<id>[^"'']+)["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        $hasAria = $attrs -match 'aria-label\s*=\s*["''][^"'']+["'']'

        if ($hasAria) { continue }

        if ($idMatch.Success) {
            if (-not $labelsByFor.Contains($idMatch.Groups['id'].Value)) {
                $inputsWithoutLabel.Add($relPath)
                break
            }
        }
        else {
            $inputsWithoutLabel.Add($relPath)
            break
        }
    }

    $headingLevels = @(
        [regex]::Matches($content, '<h(?<lvl>[1-6])[\s>]', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase) |
            ForEach-Object { [int]$_.Groups['lvl'].Value }
    )

    if ($headingLevels.Count -gt 1) {
        for ($i = 1; $i -lt $headingLevels.Count; $i++) {
            if (($headingLevels[$i] - $headingLevels[$i - 1]) -gt 1) {
                $headingSkips.Add($relPath)
                break
            }
        }
    }

    if ($content -notmatch '<main[\s>]') {
        $missingMain.Add($relPath)
    }
}

$hasFailures = $false
$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add("# Auditoria de acessibilidade") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("## Resumo") | Out-Null
$reportLines.Add("") | Out-Null
$reportLines.Add("- Paginas analisadas: $($htmlFiles.Count)") | Out-Null
$reportLines.Add("- Paginas com img sem alt: $($imgWithoutAlt.Count)") | Out-Null
$reportLines.Add("- Paginas com links sem nome acessivel: $($linksWithoutName.Count)") | Out-Null
$reportLines.Add("- Paginas com botoes sem nome acessivel: $($buttonsWithoutName.Count)") | Out-Null
$reportLines.Add("- Paginas com campos sem label: $($inputsWithoutLabel.Count)") | Out-Null
$reportLines.Add("- Paginas sem main: $($missingMain.Count)") | Out-Null
$reportLines.Add("- Paginas com salto de headings: $($headingSkips.Count)") | Out-Null
$reportLines.Add("") | Out-Null

function Show-Issue {
    param(
        [string]$Title,
        [System.Collections.Generic.List[string]]$Items,
        [switch]$WarningOnly
    )

    if ($Items.Count -eq 0) { return }

    if (-not $WarningOnly) { $script:hasFailures = $true }
    $color = if ($WarningOnly) { "Yellow" } else { "Red" }
    $tag = if ($WarningOnly) { "AVISO" } else { "FALHA" }

    Write-Host "[$tag] $Title" -ForegroundColor $color
    $Items | Select-Object -First 50 | Sort-Object -Unique | ForEach-Object { Write-Host "  - $_" }
    if ($Items.Count -gt 50) {
        Write-Host "  ... +$($Items.Count - 50) item(ns)" -ForegroundColor DarkYellow
    }
}

Show-Issue -Title "Pagina sem atributo lang=pt/pt-BR no <html>" -Items $missingLang
Show-Issue -Title "Pagina com <img> sem alt" -Items $imgWithoutAlt
Show-Issue -Title "Pagina com <button> sem nome acessivel" -Items $buttonsWithoutName
Show-Issue -Title "Pagina com <a> sem nome acessivel" -Items $linksWithoutName
Show-Issue -Title "Formulario com campo sem label/aria-label" -Items $inputsWithoutLabel
Show-Issue -Title "Pagina sem <main>" -Items $missingMain -WarningOnly
Show-Issue -Title "Possivel salto de hierarquia de headings" -Items $headingSkips -WarningOnly

Write-ReportSection -Lines $reportLines -Title "Pagina sem atributo lang=pt/pt-BR no html" -Items $missingLang
Write-ReportSection -Lines $reportLines -Title "Pagina com img sem alt" -Items $imgWithoutAlt
Write-ReportSection -Lines $reportLines -Title "Pagina com button sem nome acessivel" -Items $buttonsWithoutName
Write-ReportSection -Lines $reportLines -Title "Pagina com link sem nome acessivel" -Items $linksWithoutName
Write-ReportSection -Lines $reportLines -Title "Formulario com campo sem label ou aria-label" -Items $inputsWithoutLabel
Write-ReportSection -Lines $reportLines -Title "Pagina sem main" -Items $missingMain -WarningOnly
Write-ReportSection -Lines $reportLines -Title "Possivel salto de hierarquia de headings" -Items $headingSkips -WarningOnly

$reportFullPath = Join-Path $root $ReportPath.Replace("/", "\\")
$reportDir = Split-Path -Parent $reportFullPath
if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
}

[System.IO.File]::WriteAllLines($reportFullPath, $reportLines)
Write-Host "Relatorio: $(Get-RelativePath $reportFullPath)" -ForegroundColor DarkGray

if ($hasFailures) {
    Write-Host "`nVerificacao de acessibilidade finalizou com erros." -ForegroundColor Red
    exit 1
}

Write-Host "Verificacao de acessibilidade concluida sem erros criticos." -ForegroundColor Green
exit 0
