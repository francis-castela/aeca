$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$espetaculosPath = Join-Path $root 'espetaculos'
$files = Get-ChildItem -Recurse -Path $espetaculosPath -Filter *.html | Where-Object { $_.FullName -match '\\espetaculos\\\d{4}\\' }

$bad = @()
foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file.FullName
    $match = [regex]::Match($content, '(?is)<section\s+class="show-infobox"[^>]*>[\s\S]*?<figure\s+class="show-infobox-poster">[\s\S]*?<img[^>]*src="([^"]+)"')
    if ($match.Success) {
        $src = $match.Groups[1].Value
        if ($src -notmatch '(?i)cartaz') {
            $bad += [pscustomobject]@{ File = $file.FullName; Src = $src }
        }
    }
}

Write-Output ("BAD_COUNT={0}" -f $bad.Count)
$bad | Select-Object -First 20 | ForEach-Object { Write-Output ("{0} => {1}" -f $_.File, $_.Src) }
