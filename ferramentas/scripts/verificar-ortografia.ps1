param(
    [string[]]$Pastas = @("."),
    [string]$ReportPath = "ferramentas/relatorios/relatorio-ortografia.md",
    [string]$IgnoreWordsPath = "ferramentas/scripts/verificar-ortografia.ignore.txt"
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

function Get-DependencyHint {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        return "Instale o Node.js com: winget install OpenJS.NodeJS.LTS"
    }

    return "Instale o Node.js LTS em https://nodejs.org/ ou disponibilize o comando cspell no PATH."
}

function Find-Executable {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }

    $windowsFallbackDirs = @(
        "C:\Program Files\nodejs",
        "C:\Program Files (x86)\nodejs",
        (Join-Path $env:LOCALAPPDATA "Programs\nodejs")
    )

    foreach ($dir in $windowsFallbackDirs) {
        if (-not (Test-Path $dir -PathType Container)) {
            continue
        }

        foreach ($name in $Names) {
            $candidate = Join-Path $dir $name
            if (Test-Path $candidate -PathType Leaf) {
                return $candidate
            }
        }
    }

    return $null
}

function Add-DirectoryToPath {
    param([string]$Directory)

    if ([string]::IsNullOrWhiteSpace($Directory) -or -not (Test-Path $Directory -PathType Container)) {
        return
    }

    $pathEntries = @($env:Path -split ';' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    foreach ($entry in $pathEntries) {
        if ($entry.TrimEnd('\\') -ieq $Directory.TrimEnd('\\')) {
            return
        }
    }

    $env:Path = $Directory + ';' + $env:Path
}

function Get-IgnoreWords {
    param([string]$FilePath)

    if ([string]::IsNullOrWhiteSpace($FilePath)) {
        return @()
    }

    $fullPath = Join-Path $root $FilePath.Replace('/', '\\')
    if (-not (Test-Path $fullPath -PathType Leaf)) {
        return @()
    }

    return @(
        Get-Content -Path $fullPath -Encoding UTF8 |
            ForEach-Object { $_.Trim() } |
            Where-Object {
                -not [string]::IsNullOrWhiteSpace($_) -and
                -not $_.StartsWith('#')
            } |
            Sort-Object -Unique
    )
}

function Write-OrthographyReport {
    param(
        [string]$ReportFile,
        [string[]]$Targets,
        [string[]]$OutputLines,
        [int]$ExitCode,
        [string]$IgnoreListPath,
        [object[]]$Issues
    )

    $reportFullPath = Join-Path $root $ReportFile.Replace('/', '\\')
    $reportDir = Split-Path -Parent $reportFullPath
    if (-not (Test-Path $reportDir -PathType Container)) {
        New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
    }

    $reportLines = New-Object System.Collections.Generic.List[string]
    $reportLines.Add('# Relatorio de ortografia') | Out-Null
    $reportLines.Add('') | Out-Null
    $reportLines.Add("Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')") | Out-Null
    $reportLines.Add('') | Out-Null
    $reportLines.Add('## Resumo') | Out-Null
    $reportLines.Add('') | Out-Null
    $reportLines.Add("- Arquivos HTML analisados: $($Targets.Count)") | Out-Null
    $reportLines.Add("- Arquivos com ocorrencias: $((@($Issues | ForEach-Object { $_.File } | Sort-Object -Unique)).Count)") | Out-Null
    $reportLines.Add("- Ocorrencias encontradas: $($Issues.Count)") | Out-Null
    $reportLines.Add("- Codigo de saida do cspell: $ExitCode") | Out-Null
    $reportLines.Add("- Lista de termos aceitos: $IgnoreListPath") | Out-Null
    $reportLines.Add('') | Out-Null

    if ($Issues.Count -eq 0 -and $ExitCode -eq 0) {
        $reportLines.Add('## Resultado') | Out-Null
        $reportLines.Add('') | Out-Null
        $reportLines.Add('Nenhum erro ortografico encontrado.') | Out-Null
        $reportLines.Add('') | Out-Null
    }
    elseif ($Issues.Count -gt 0) {
        $groupedIssues = @($Issues | Group-Object File | Sort-Object Name)

        $reportLines.Add('## Ocorrencias por arquivo') | Out-Null
        $reportLines.Add('') | Out-Null

        foreach ($group in $groupedIssues) {
            $reportLines.Add("### $($group.Name)") | Out-Null
            $reportLines.Add('') | Out-Null

            foreach ($issue in $group.Group) {
                $reportLines.Add("- Linha $($issue.Line), coluna $($issue.Column): $($issue.Word)") | Out-Null
            }

            $reportLines.Add('') | Out-Null
        }
    }
    else {
        $reportLines.Add('## Falha de execucao') | Out-Null
        $reportLines.Add('') | Out-Null
        $reportLines.Add('O corretor ortografico nao conseguiu concluir a analise.') | Out-Null
        $reportLines.Add('') | Out-Null
    }

    if ($OutputLines.Count -gt 0) {
        $reportLines.Add('## Saida bruta') | Out-Null
        $reportLines.Add('') | Out-Null
        $reportLines.Add('```text') | Out-Null
        foreach ($line in $OutputLines) {
            $reportLines.Add($line) | Out-Null
        }
        $reportLines.Add('```') | Out-Null
        $reportLines.Add('') | Out-Null
    }

    [System.IO.File]::WriteAllLines($reportFullPath, $reportLines)
    return $reportFullPath
}

function Invoke-SpellChecker {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$StdOutPath,
        [string]$StdErrPath
    )

    $process = Start-Process -FilePath $FilePath -ArgumentList $Arguments -NoNewWindow -Wait -PassThru -RedirectStandardOutput $StdOutPath -RedirectStandardError $StdErrPath

    $lines = New-Object System.Collections.Generic.List[string]
    foreach ($path in @($StdOutPath, $StdErrPath)) {
        if (-not (Test-Path $path -PathType Leaf)) {
            continue
        }

        foreach ($line in [System.IO.File]::ReadAllLines($path)) {
            $lines.Add($line) | Out-Null
        }
    }

    foreach ($line in $lines) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            Write-Host $line
        }
    }

    return [PSCustomObject]@{
        ExitCode = $process.ExitCode
        OutputLines = @($lines)
    }
}

$alvos = New-Object System.Collections.Generic.List[string]
foreach ($pasta in $Pastas) {
    $target = Join-Path $root $pasta
    if (-not (Test-Path $target)) {
        continue
    }

    Get-ChildItem -Path $target -Recurse -File -Include *.html |
        Where-Object {
            $_.FullName -notmatch "\\.git\\" -and
            $_.FullName -notmatch "\\node_modules\\" -and
            $_.FullName -notmatch "\\html\\"
        } |
        ForEach-Object {
            $alvos.Add($_.FullName) | Out-Null
        }
}

$alvos = @($alvos | Sort-Object -Unique)
if ($alvos.Count -eq 0) {
    $reportFile = Write-OrthographyReport -ReportFile $ReportPath -Targets $alvos -OutputLines @("Nenhum arquivo HTML encontrado para verificar ortografia.") -ExitCode 0 -IgnoreListPath $IgnoreWordsPath -Issues @()
    Write-Host "Nenhum arquivo HTML encontrado para verificar ortografia." -ForegroundColor Yellow
    Write-Host "Relatorio: $(Get-RelativePath $reportFile)" -ForegroundColor DarkGray
    exit 0
}

$tmpList = Join-Path $env:TEMP ("cspell-arquivos-" + [System.Guid]::NewGuid().ToString() + ".txt")
$tmpConfig = Join-Path $env:TEMP ("cspell-config-" + [System.Guid]::NewGuid().ToString() + ".json")
$tmpOutput = Join-Path $env:TEMP ("cspell-output-" + [System.Guid]::NewGuid().ToString() + ".txt")
$tmpError = Join-Path $env:TEMP ("cspell-error-" + [System.Guid]::NewGuid().ToString() + ".txt")

try {
    $alvos | Set-Content -Path $tmpList -Encoding UTF8

    $nodeExe = Find-Executable @("node.exe", "node")
    if ($nodeExe) {
        Add-DirectoryToPath (Split-Path -Parent $nodeExe)
    }

    $cspellCmd = Find-Executable @("cspell.cmd", "cspell")
    $npxCmd = Find-Executable @("npx.cmd", "npx")
    $npmCmd = Find-Executable @("npm.cmd", "npm")
    $ignoreWords = Get-IgnoreWords -FilePath $IgnoreWordsPath

    $config = [pscustomobject]@{
        version = "0.2"
        language = "pt-BR,en"
        import = @(
            "@cspell/dict-pt-br/cspell-ext.json"
        )
        allowCompoundWords = $true
        ignorePaths = @(
            "**/node_modules/**",
            "**/.git/**"
        )
        words = @(
            "AECA",
            "Dide",
            "Itajai",
            "espetaculo",
            "espetaculos",
            "ingressos",
            "classificacao",
            "noreferrer",
            "noopener"
        ) + $ignoreWords
    } | ConvertTo-Json -Depth 3

    Set-Content -Path $tmpConfig -Value $config -Encoding UTF8

    $spellResult = $null

    if ($npmCmd) {
        $spellResult = Invoke-SpellChecker -FilePath $npmCmd -Arguments @('exec', '--yes', '--package=cspell@latest', '--package=@cspell/dict-pt-br', '--', 'cspell', '--no-progress', '--config', $tmpConfig, '--file-list', $tmpList) -StdOutPath $tmpOutput -StdErrPath $tmpError
    }
    elseif ($npxCmd) {
        $spellResult = Invoke-SpellChecker -FilePath $npxCmd -Arguments @('--yes', '--package', 'cspell@latest', '--package', '@cspell/dict-pt-br', 'cspell', '--no-progress', '--config', $tmpConfig, '--file-list', $tmpList) -StdOutPath $tmpOutput -StdErrPath $tmpError
    }
    elseif ($cspellCmd) {
        $spellResult = Invoke-SpellChecker -FilePath $cspellCmd -Arguments @('--no-progress', '--config', $tmpConfig, '--file-list', $tmpList) -StdOutPath $tmpOutput -StdErrPath $tmpError
    }
    else {
        $dependencyMessage = @(
            "[ERRO] Nenhum executor compativel foi encontrado para rodar o cspell.",
            "Comandos procurados: cspell, npx.cmd, npm.cmd, npx, npm.",
            (Get-DependencyHint),
            "Se o PowerShell bloquear .ps1, use: .\ferramentas\scripts\verificar-ortografia.cmd"
        )
        $reportFile = Write-OrthographyReport -ReportFile $ReportPath -Targets $alvos -OutputLines $dependencyMessage -ExitCode 1 -IgnoreListPath $IgnoreWordsPath -Issues @()
        Write-Host "[ERRO] Nenhum executor compativel foi encontrado para rodar o cspell." -ForegroundColor Red
        Write-Host "Comandos procurados: cspell, npx.cmd, npm.cmd, npx, npm." -ForegroundColor Yellow
        Write-Host (Get-DependencyHint) -ForegroundColor Yellow
        Write-Host "Se o PowerShell bloquear .ps1, use: .\ferramentas\scripts\verificar-ortografia.cmd" -ForegroundColor Yellow
        Write-Host "Relatorio: $(Get-RelativePath $reportFile)" -ForegroundColor DarkGray
        exit 1
    }

    $exitCode = $spellResult.ExitCode
    $outputLines = @($spellResult.OutputLines)

    $issues = New-Object System.Collections.Generic.List[object]
    foreach ($line in $outputLines) {
        if ($line -match '^(?<file>.+?):(?<line>\d+):(?<column>\d+) - Unknown word \((?<word>.+?)\)') {
            $issues.Add([PSCustomObject]@{
                File = $Matches['file']
                Line = [int]$Matches['line']
                Column = [int]$Matches['column']
                Word = $Matches['word']
            }) | Out-Null
        }
    }

    $reportFile = Write-OrthographyReport -ReportFile $ReportPath -Targets $alvos -OutputLines $outputLines -ExitCode $exitCode -IgnoreListPath $IgnoreWordsPath -Issues $issues
    Write-Host "Relatorio: $(Get-RelativePath $reportFile)" -ForegroundColor DarkGray

    if ($exitCode -ne 0) {
        Write-Host "`nVerificacao ortografica encontrou possiveis erros." -ForegroundColor Red
        exit $exitCode
    }

    Write-Host "Verificacao ortografica concluida sem erros." -ForegroundColor Green
    exit 0
}
finally {
    if (Test-Path $tmpList) {
        Remove-Item $tmpList -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tmpConfig) {
        Remove-Item $tmpConfig -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tmpOutput) {
        Remove-Item $tmpOutput -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tmpError) {
        Remove-Item $tmpError -Force -ErrorAction SilentlyContinue
    }
}
