[CmdletBinding()]
param(
    [switch]$ContinuarEmFalha,
    [switch]$PermitirScriptsAusentes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptRoot
$relatoriosDir = Join-Path $scriptRoot "relatorios"

if (-not (Test-Path -LiteralPath $relatoriosDir)) {
    New-Item -ItemType Directory -Path $relatoriosDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $relatoriosDir "rotina-performance-$timestamp.log"
$reportFile = Join-Path $relatoriosDir "relatorio-performance.md"

function Escrever-Log {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Mensagem,

        [ValidateSet("INFO", "OK", "WARN", "ERRO")]
        [string]$Nivel = "INFO"
    )

    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Nivel, $Mensagem
    $line | Tee-Object -FilePath $logFile -Append | Out-Host
}

$etapas = @(
    @{ Nome = "Validar site"; Script = Join-Path $scriptRoot "scripts/validar-site.ps1" },
    @{ Nome = "Auditar performance"; Script = Join-Path $scriptRoot "scripts/auditar-performance.ps1" },
    @{ Nome = "Verificar links"; Script = Join-Path $scriptRoot "scripts/verificar-links.ps1" },
    @{ Nome = "Verificar SEO basico"; Script = Join-Path $scriptRoot "scripts/verificar-seo-basico.ps1" },
    @{ Nome = "Verificar assets referenciados"; Script = Join-Path $scriptRoot "scripts/verificar-assets-referenciados.ps1" }
)

Escrever-Log -Mensagem "Iniciando rotina continua de performance."
Escrever-Log -Mensagem "Raiz do repositorio: $repoRoot"
Escrever-Log -Mensagem "Log da execucao: $logFile"

$ausentes = @()
foreach ($etapa in $etapas) {
    if (-not (Test-Path -LiteralPath $etapa.Script)) {
        $ausentes += $etapa.Script
    }
}

if ($ausentes.Count -gt 0) {
    Escrever-Log -Nivel "WARN" -Mensagem "Scripts ausentes detectados:"
    foreach ($arquivo in $ausentes) {
        Escrever-Log -Nivel "WARN" -Mensagem " - $arquivo"
    }

    if (-not $PermitirScriptsAusentes) {
        Escrever-Log -Nivel "ERRO" -Mensagem "Execucao interrompida. Use -PermitirScriptsAusentes para seguir mesmo com faltas."
        exit 1
    }
}

$falhas = @()

foreach ($etapa in $etapas) {
    if (-not (Test-Path -LiteralPath $etapa.Script)) {
        Escrever-Log -Nivel "WARN" -Mensagem "Pulando etapa ausente: $($etapa.Nome)"
        continue
    }

    Escrever-Log -Mensagem "Executando etapa: $($etapa.Nome)"
    Escrever-Log -Mensagem "Comando: powershell -NoProfile -ExecutionPolicy Bypass -File $($etapa.Script)"

    $stepOutput = $null
    try {
        $stepOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File $etapa.Script 2>&1
        if ($null -ne $stepOutput) {
            $stepOutput | Tee-Object -FilePath $logFile -Append | Out-Host
        }

        if ($LASTEXITCODE -ne 0) {
            throw "Etapa retornou codigo de saida $LASTEXITCODE"
        }

        Escrever-Log -Nivel "OK" -Mensagem "Etapa concluida: $($etapa.Nome)"
    }
    catch {
        Escrever-Log -Nivel "ERRO" -Mensagem "Falha na etapa $($etapa.Nome): $($_.Exception.Message)"
        $falhas += $etapa.Nome

        if (-not $ContinuarEmFalha) {
            Escrever-Log -Nivel "ERRO" -Mensagem "Execucao interrompida na primeira falha. Use -ContinuarEmFalha para executar todas as etapas."
            exit 1
        }
    }
}

if (Test-Path -LiteralPath $reportFile) {
    Escrever-Log -Nivel "OK" -Mensagem "Relatorio de performance localizado em: $reportFile"
}
else {
    Escrever-Log -Nivel "WARN" -Mensagem "Relatorio de performance nao encontrado em: $reportFile"
}

Escrever-Log -Mensagem "Checklist manual recomendado apos a execucao:"
Escrever-Log -Mensagem "1. Revisar ranking de imagens pesadas no relatorio."
Escrever-Log -Mensagem "2. Revisar LCP, INP e CLS em PageSpeed Insights, Search Console e CrUX."
Escrever-Log -Mensagem "3. Revisar com cuidado a lista de possiveis assets orfaos antes de excluir."

if ($falhas.Count -gt 0) {
    Escrever-Log -Nivel "ERRO" -Mensagem ("Rotina finalizada com falhas em {0} etapa(s): {1}" -f $falhas.Count, ($falhas -join ", "))
    exit 1
}

Escrever-Log -Nivel "OK" -Mensagem "Rotina finalizada com sucesso."
exit 0
