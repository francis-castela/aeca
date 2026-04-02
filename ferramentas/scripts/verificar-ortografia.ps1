param(
    [string[]]$Pastas = @(".")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$alvos = New-Object System.Collections.Generic.List[string]
foreach ($pasta in $Pastas) {
    $target = Join-Path $root $pasta
    if (-not (Test-Path $target)) {
        continue
    }

    Get-ChildItem -Path $target -Recurse -File -Include *.html, *.md, *.txt |
        Where-Object {
            $_.FullName -notmatch "\\.git\\" -and
            $_.FullName -notmatch "\\node_modules\\"
        } |
        ForEach-Object {
            $alvos.Add($_.FullName) | Out-Null
        }
}

$alvos = $alvos | Sort-Object -Unique
if ($alvos.Count -eq 0) {
    Write-Host "Nenhum arquivo encontrado para verificar ortografia." -ForegroundColor Yellow
    exit 0
}

$tmpList = Join-Path $env:TEMP ("cspell-arquivos-" + [System.Guid]::NewGuid().ToString() + ".txt")
$tmpConfig = Join-Path $env:TEMP ("cspell-config-" + [System.Guid]::NewGuid().ToString() + ".json")

try {
    $alvos | Set-Content -Path $tmpList -Encoding UTF8

    $config = [pscustomobject]@{
        version = "0.2"
        language = "pt-BR,en"
        allowCompoundWords = $true
        ignorePaths = @(
            "**/node_modules/**",
            "**/.git/**"
        )
        words = @(
            "AECA",
            "Itajai",
            "espetaculos",
            "ingressos",
            "classificacao",
            "noreferrer",
            "noopener"
        )
    } | ConvertTo-Json -Depth 3

    Set-Content -Path $tmpConfig -Value $config -Encoding UTF8

    if (Get-Command cspell -ErrorAction SilentlyContinue) {
        & cspell --no-progress --config $tmpConfig --file-list $tmpList
    }
    elseif (Get-Command npx.cmd -ErrorAction SilentlyContinue) {
        & npx.cmd --yes cspell@latest --no-progress --config $tmpConfig --file-list $tmpList
    }
    elseif (Get-Command npx -ErrorAction SilentlyContinue) {
        & npx --yes cspell@latest --no-progress --config $tmpConfig --file-list $tmpList
    }
    else {
        Write-Host "[ERRO] Nem cspell, npx.cmd nem npx estao disponiveis no ambiente." -ForegroundColor Red
        Write-Host "Instale Node.js ou cspell para habilitar a verificacao ortografica automatica." -ForegroundColor Yellow
        exit 1
    }

    $exitCode = $LASTEXITCODE
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
}
