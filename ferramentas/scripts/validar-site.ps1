[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$PSDefaultParameterValues['Get-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Set-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Add-Content:Encoding'] = 'utf8'
$PSDefaultParameterValues['Out-File:Encoding'] = 'utf8'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent (Split-Path -Parent $scriptRoot)

function Write-Info([string]$Message) {
    Write-Host "[INFO] $Message"
}

function Write-Ok([string]$Message) {
    Write-Host "[OK]   $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host "[ERRO] $Message" -ForegroundColor Red
}

Write-Info "Validando estrutura basica do site..."
Write-Info "Raiz detectada: $repoRoot"

$requiredPaths = @(
    "index.html",
    "css/styles/style.css",
    "js/app.js",
    "html/cabecalho.html",
    "html/footer.html",
    "robots.txt",
    "sitemap.xml"
)

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

foreach ($relativePath in $requiredPaths) {
    $fullPath = Join-Path $repoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        $errors.Add("Arquivo obrigatorio ausente: $relativePath")
    }
}

$allHtmlFiles = Get-ChildItem -Path $repoRoot -Recurse -File -Filter "*.html"
if ($allHtmlFiles.Count -eq 0) {
    $errors.Add("Nenhum arquivo HTML encontrado no repositorio.")
}

# Fragmentos em /html nao sao paginas completas e nao devem ser validados como documento inteiro.
$htmlFiles = $allHtmlFiles | Where-Object {
    $_.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/') -notmatch '^html/'
}

foreach ($file in $htmlFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $relative = $file.FullName.Substring($repoRoot.Length + 1).Replace([IO.Path]::DirectorySeparatorChar, '/')

    if ($content -notmatch '(?i)<!DOCTYPE\s+html>') {
        $warnings.Add("Sem doctype html: $relative")
    }

    if ($content -notmatch '(?is)<title>\s*[^<]+\s*</title>') {
        $errors.Add("Sem tag title valida: $relative")
    }

    if ($content -notmatch '(?is)<body\b') {
        $errors.Add("Sem tag body: $relative")
    }

    if ($content -match '(?is)<img\b' -and $content -match '(?is)<img\b(?![^>]*\balt\s*=)') {
        $warnings.Add("Existe imagem sem atributo alt: $relative")
    }
}

if ($warnings.Count -gt 0) {
    Write-Warn "Avisos encontrados: $($warnings.Count)"
    foreach ($item in $warnings) {
        Write-Warn " - $item"
    }
}
else {
    Write-Ok "Nenhum aviso estrutural encontrado."
}

if ($errors.Count -gt 0) {
    Write-Err "Falhas criticas encontradas: $($errors.Count)"
    foreach ($item in $errors) {
        Write-Err " - $item"
    }
    exit 1
}

Write-Ok "Validacao estrutural concluida sem falhas criticas."
exit 0
