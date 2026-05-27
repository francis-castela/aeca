$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$espetaculosPath = Join-Path $root 'espetaculos'
$files = Get-ChildItem -Recurse -Path $espetaculosPath -Filter *.html | Where-Object { $_.FullName -match '\\espetaculos\\\d{4}\\' }

$updated = 0

function Get-PreferredPosterSrc {
    param(
        [string]$html,
        [System.IO.FileInfo]$file
    )

    $imgDir = Join-Path $file.DirectoryName 'img'
    $fallbackSrc = '/espetaculos/erro.webp'

    if (Test-Path $imgDir) {
        $candidates = Get-ChildItem -Path $imgDir -File | Where-Object { $_.Name -match '(?i)cartaz' }
        if ($candidates.Count -gt 0) {
            $slug = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            $stopwords = @('a','as','o','os','de','da','do','das','dos','e','um','uma')
            $tokens = ($slug.ToLower() -split '[^a-z0-9]+') | Where-Object { $_ -and $_.Length -gt 1 -and $_ -notin $stopwords }

            $best = $null
            $bestScore = -1
            foreach ($candidate in $candidates) {
                $name = [System.IO.Path]::GetFileNameWithoutExtension($candidate.Name).ToLower()
                $score = 0
                foreach ($t in $tokens) {
                    if ($name.Contains($t)) {
                        $score++
                    }
                }

                if ($score -gt $bestScore) {
                    $best = $candidate
                    $bestScore = $score
                }
            }

            if ($null -ne $best -and $bestScore -gt 0) {
                $year = Split-Path -Leaf $file.DirectoryName
                return '/espetaculos/' + $year + '/img/' + $best.Name
            }
        }
    }

    return $fallbackSrc
}

foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file.FullName
    $original = $content

    $title = 'Espetaculo'
    $titleMatch = [regex]::Match($content, '(?is)<h1>\s*([^<]+?)\s*</h1>')
    if ($titleMatch.Success) {
        $title = $titleMatch.Groups[1].Value.Trim()
    }

    # Remove cabecalho generico do apendice (nao usar "Conteudo complementar")
    $content = [regex]::Replace(
        $content,
        '(?is)(<section\s+class="show-appendix"[^>]*>\s*)(?:<h3>\s*Conteudo\s+complementar\s*</h3>\s*<hr>\s*)+',
        '$1'
    )

    $content = [regex]::Replace(
        $content,
        '(?is)<p\s+class="show-appendix-text"\s+style="[^"]*">',
        '<p class="show-appendix-text">'
    )

    # Limpa artefatos de whitespace/indentacao gerados em migracoes em lote
    $content = [regex]::Replace(
        $content,
        '(?is)<section class="show-appendix" aria-label="Conteudo complementar do espetaculo">\s*<h3>Conteudo complementar</h3>\s*',
        '<section class="show-appendix" aria-label="Conteudo complementar do espetaculo">' + "`r`n"
    )

    $content = $content.Replace('`t`t<section class="show-appendix" aria-label="Conteudo complementar do espetaculo">', '<section class="show-appendix" aria-label="Conteudo complementar do espetaculo">')
    $content = $content.Replace('`t`t`t<h3>Conteudo complementar</h3>', '')

    $content = [regex]::Replace(
        $content,
        '(?is)(<figure\s+class="show-infobox-poster">)\s*(<img\b[^>]*>)\s*(<figcaption>)',
        ('$1' + "`r`n`t`t`t`t`t" + '$2' + "`r`n`t`t`t`t`t" + '$3')
    )

    $content = [regex]::Replace($content, '(?m)(?:\r?\n){3,}', "`r`n`r`n")

    # Corrige cartaz da infobox para imagem cujo nome contenha "cartaz"
    $preferredPoster = Get-PreferredPosterSrc -html $content -file $file
    if (-not [string]::IsNullOrWhiteSpace($preferredPoster) -and [regex]::IsMatch($content, '(?is)<section\s+class="show-infobox"')) {
        $safeTitle = $title.Replace('"', '&quot;')
        $replacementImg = '<img src="' + $preferredPoster + '" alt="Cartaz de ' + $safeTitle + '">' 

        $hasPosterImg = [regex]::IsMatch(
            $content,
            '(?is)<section\s+class="show-infobox"[^>]*>[\s\S]*?<figure\s+class="show-infobox-poster">[\s\S]*?<img\b[\s\S]*?</figure>'
        )

        if ($hasPosterImg) {
            $content = [regex]::Replace(
                $content,
                '(?is)(<section\s+class="show-infobox"[^>]*>[\s\S]*?<figure\s+class="show-infobox-poster">[\s\S]*?)<img\b[^>]*>',
                ('$1' + $replacementImg),
                1
            )
        }
        else {
            $content = [regex]::Replace(
                $content,
                '(?is)(<section\s+class="show-infobox"[^>]*>[\s\S]*?<figure\s+class="show-infobox-poster">\s*)',
                ('$1' + $replacementImg + "`r`n"),
                1
            )
        }
    }

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Encoding UTF8 -Value $content
        $updated++
    }
}

Write-Output "UPDATED=$updated"
