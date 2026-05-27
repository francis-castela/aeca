$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$espetaculosPath = Join-Path $root 'espetaculos'
$files = Get-ChildItem -Recurse -Path $espetaculosPath -Filter *.html | Where-Object { $_.FullName -match '\\espetaculos\\\d{4}\\' }

$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file.FullName
    $original = $content

    $title = 'Espetaculo'
    $titleMatch = [regex]::Match($content, '(?is)<h1>\s*([^<]+?)\s*</h1>')
    if ($titleMatch.Success) {
        $title = $titleMatch.Groups[1].Value.Trim()
    }

    $sidebarPosterSrc = ''
    $sidebarBlock = [regex]::Match($content, '(?is)<aside\s+class="sidebar">([\s\S]*?)</aside>')
    if ($sidebarBlock.Success) {
        $posterMatch = [regex]::Match($sidebarBlock.Value, '(?is)<img[^>]*src="([^"]+)"')
        if ($posterMatch.Success) {
            $sidebarPosterSrc = $posterMatch.Groups[1].Value.Trim()
        }
    }

    if ([string]::IsNullOrWhiteSpace($sidebarPosterSrc)) {
        $ogImageMatch = [regex]::Match($content, '(?is)<meta\s+property="og:image"\s+content="([^"]+)"')
        if ($ogImageMatch.Success) {
            $sidebarPosterSrc = $ogImageMatch.Groups[1].Value.Trim()
        }
    }

    if ([string]::IsNullOrWhiteSpace($sidebarPosterSrc)) {
        $sidebarPosterSrc = '/css/img/instagram.webp'
    }

    # Converte infobox de <aside> para <section>
    $content = [regex]::Replace($content, '(?is)<aside(\s+class="show-infobox"[^>]*)>', '<section$1>')
    $content = [regex]::Replace($content, '(?is)(<section\s+class="show-infobox"[^>]*>[\s\S]*?)</aside>', '$1</section>')

    # Garante cartaz dentro da infobox
    $hasPoster = [regex]::IsMatch(
        $content,
        '(?is)<section\s+class="show-infobox"[^>]*>[\s\S]*?<figure\s+class="show-infobox-poster">[\s\S]*?<img\b[\s\S]*?</figure>'
    )

    if (-not $hasPoster -and [regex]::IsMatch($content, '(?is)<section\s+class="show-infobox"')) {
        $safeTitle = $title.Replace('"', '&quot;')
        $injectedPoster = ('$1<img src="{0}" alt="Cartaz de {1}">' + "`r`n") -f $sidebarPosterSrc, $safeTitle
        $content = [regex]::Replace(
            $content,
            '(?is)(<section\s+class="show-infobox"[^>]*>[\s\S]*?<figure\s+class="show-infobox-poster">\s*)',
            $injectedPoster,
            1
        )
    }

    # Move o antigo sidebar para o final do main como secao complementar
    $sidebarMatch = [regex]::Match($content, '(?is)<aside\s+class="sidebar">([\s\S]*?)</aside>')
    if ($sidebarMatch.Success) {
        $inner = $sidebarMatch.Groups[1].Value.Trim()

        $inner = [regex]::Replace($inner, '(?is)<div\s+class="sidebar-titulo">\s*([\s\S]*?)\s*</div>', '<h3>$1</h3>')
        $inner = [regex]::Replace($inner, '(?is)<div\s+class="sidebar-titulo-menor">\s*([\s\S]*?)\s*</div>', '<p class="show-appendix-note">$1</p>')
        $inner = [regex]::Replace($inner, '(?is)<div\s+class="sidebar-texto"([^>]*)>\s*([\s\S]*?)\s*</div>', '<p class="show-appendix-text"$1>$2</p>')
        $inner = [regex]::Replace($inner, '(?is)<p\s+class="show-appendix-text"[^>]*>\s*</p>', '')
        $inner = $inner.Replace('class="sidebar-galeria"', 'class="main-galeria"')

        $appendix = @"
<section class="show-appendix" aria-label="Conteudo complementar do espetaculo">
$inner
</section>
"@

        $content = $content.Remove($sidebarMatch.Index, $sidebarMatch.Length)
        $content = [regex]::Replace($content, '(?is)</main>', "$appendix`r`n`t`t</main>", 1)
    }

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Encoding UTF8 -Value $content
        $updated++
    }
}

Write-Output "UPDATED=$updated"
