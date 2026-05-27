$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$espetaculosPath = Join-Path $root 'espetaculos'
$files = Get-ChildItem -Recurse -Path $espetaculosPath -Filter *.html | Where-Object { $_.FullName -match '\\espetaculos\\\d{4}\\' }

$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file.FullName
    $original = $content

    # Padroniza rotulos da infobox com entidades HTML para evitar novo problema de encoding
    $content = [regex]::Replace(
        $content,
        '(?is)<figcaption>\s*Cartaz\s+do\s+espet[^<]*</figcaption>',
        '<figcaption>Cartaz do espet&aacute;culo</figcaption>'
    )
    $content = [regex]::Replace(
        $content,
        '(?is)<th\s+scope="row">\s*[^<]*resenta[^<]*</th>',
        '<th scope="row">Apresenta&ccedil;&otilde;es</th>'
    )
    $content = [regex]::Replace(
        $content,
        '(?is)<span>\s*Datas\s+em\s+atualiza[^<]*</span>',
        '<span>Datas em atualiza&ccedil;&atilde;o</span>'
    )
    $content = [regex]::Replace(
        $content,
        '(?is)<span>\s*Locais\s+em\s+atualiza[^<]*</span>',
        '<span>Locais em atualiza&ccedil;&atilde;o</span>'
    )

    # Corrige data verbosa em alguns textos legados inline
    $content = [regex]::Replace(
        $content,
        '(?is)(<td><span>)([^:<]+):\s*[^<]*?\bnos?\s+dias?\s+([^<.]+)(</span></td>)',
        '$1$2: $3$4'
    )

    # Substitui cartaz fallback pela imagem do cartaz da sidebar quando existir
    if ($content -match '<aside class="show-infobox"' -and $content -match '<img src="/css/img/instagram\.webp"') {
        $sidebarPosterMatch = [regex]::Match($content, '(?s)sidebar-titulo">\s*Cartaz do espetáculo\s*</div>.*?<img[^>]*src="([^"]+)"[^>]*>')
        if ($sidebarPosterMatch.Success) {
            $sidebarPosterSrc = $sidebarPosterMatch.Groups[1].Value
            $content = $content.Replace('<img src="/css/img/instagram.webp"', '<img src="' + $sidebarPosterSrc + '"')
        }
    }

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Encoding UTF8 -Value $content
        $updated++
    }
}

Write-Output "UPDATED=$updated"
