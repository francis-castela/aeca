Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$MaxWidthPx  = 1400
$QualityWebP = 75
$QualityJpeg = 82
$ThresholdKB = 250
$DryRun      = $false

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$skipDirPattern = "\\.git\\"
$thresholdBytes = $ThresholdKB * 1024

$blacklistPath = Join-Path $PSScriptRoot "comprimir-imagens-blacklist.txt"
$blacklist = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
if (Test-Path $blacklistPath) {
    Get-Content $blacklistPath -Encoding UTF8 | Where-Object { $_.Trim() -ne "" } | ForEach-Object { [void]$blacklist.Add($_.Trim()) }
    Write-Host "Blacklist carregada: $($blacklist.Count) entrada(s) ignorada(s)." -ForegroundColor DarkGray
}

if (-not (Get-Command magick -ErrorAction SilentlyContinue)) {
    Write-Host "[ERRO] ImageMagick nao encontrado." -ForegroundColor Red
    Write-Host "Instale com: winget install ImageMagick.ImageMagick" -ForegroundColor Yellow
    exit 1
}

$magickVersion = (magick --version 2>&1)[0]
Write-Host "ImageMagick: $magickVersion" -ForegroundColor DarkGray

$allImages = Get-ChildItem -Path $root -Recurse -File | Where-Object {
    $_.FullName -notmatch $skipDirPattern -and
    $_.Length -ge $thresholdBytes -and
    ($_.Extension -eq ".webp" -or $_.Extension -eq ".jpg" -or $_.Extension -eq ".jpeg")
}

Write-Host ""
Write-Host "Imagens acima de $ThresholdKB KB: $($allImages.Count)" -ForegroundColor Cyan
if ($DryRun) { Write-Host "[DRY RUN] Nenhum arquivo sera alterado." -ForegroundColor Yellow }
Write-Host ""

$processed = 0
$skipped   = 0
$failed    = 0
$savedKB   = 0.0

foreach ($img in ($allImages | Sort-Object Length -Descending)) {
    $relPath  = $img.FullName.Substring($root.Length).TrimStart("\").Replace("\", "/")
    $ext      = $img.Extension.ToLowerInvariant()
    $beforeKB = [math]::Round($img.Length / 1024.0, 1)
    $quality  = if ($ext -eq ".webp") { $QualityWebP } else { $QualityJpeg }

    if ($blacklist.Contains($relPath)) {
        Write-Host ("[SKIP] {0}  {1} KB (blacklist)" -f $relPath, $beforeKB) -ForegroundColor DarkYellow
        $skipped++
        continue
    }

    if ($DryRun) {
        Write-Host "[DRY] $relPath ($beforeKB KB)" -ForegroundColor DarkGray
        $processed++
        continue
    }

    try {
        $resizeArg = "$($MaxWidthPx)x>"

        if ($ext -eq ".webp") {
            $magickArgs = @($img.FullName, "-resize", $resizeArg, "-quality", $quality, "-define", "webp:method=6", "-strip", $img.FullName)
        } else {
            $magickArgs = @($img.FullName, "-resize", $resizeArg, "-quality", $quality, "-strip", $img.FullName)
        }

        & magick @magickArgs 2>&1 | Out-Null

        $afterKB  = [math]::Round((Get-Item $img.FullName).Length / 1024.0, 1)
        $deltaKB  = $beforeKB - $afterKB
        $savedKB += $deltaKB

        if ($deltaKB -gt 0) {
            Write-Host ("[OK] {0}  {1} KB -> {2} KB  (-{3} KB)" -f $relPath, $beforeKB, $afterKB, [math]::Round($deltaKB, 1)) -ForegroundColor Green
        } else {
            Write-Host ("[=] {0}  {1} KB (adicionado a blacklist)" -f $relPath, $beforeKB) -ForegroundColor DarkGray
            [void]$blacklist.Add($relPath)
            Add-Content -Path $blacklistPath -Value $relPath -Encoding UTF8
        }
        $processed++
    } catch {
        Write-Host ("[ERRO] {0} - {1}" -f $relPath, $_.Exception.Message) -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Concluido." -ForegroundColor Cyan
Write-Host ("Processadas : {0}" -f $processed)
Write-Host ("Ignoradas   : {0}" -f $skipped)
Write-Host ("Erros       : {0}" -f $failed)
if (-not $DryRun) {
    Write-Host ("Espaco liberado: {0} MB" -f [math]::Round($savedKB / 1024.0, 2)) -ForegroundColor Green
}