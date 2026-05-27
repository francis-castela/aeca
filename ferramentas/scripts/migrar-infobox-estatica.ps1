$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$espetaculosPath = Join-Path $root 'espetaculos'
$files = Get-ChildItem -Recurse -Path $espetaculosPath -Filter *.html | Where-Object { $_.FullName -match '\\espetaculos\\\d{4}\\' }

function Strip-Html([string]$html) {
    if (-not $html) { return '' }
    $text = $html -replace '<br\s*/?>', "`n"
    $text = $text -replace '<[^>]+>', ''
    $text = [System.Net.WebUtility]::HtmlDecode($text)
    $text = ($text -replace '\s+', ' ').Trim()
    return $text
}

$updated = 0
$skipped = 0

foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file.FullName

    if ($content -match 'class="show-infobox"') {
        $skipped++
        continue
    }

    $mainMatch = [regex]::Match($content, '(?s)<main class="main-content">(.*?)</main>')
    if (-not $mainMatch.Success) {
        $skipped++
        continue
    }

    $mainInner = $mainMatch.Groups[1].Value

    $h1Match = [regex]::Match($mainInner, '(?s)<h1>(.*?)</h1>')
    $title = if ($h1Match.Success) { Strip-Html $h1Match.Groups[1].Value } else { 'Espetáculo' }

    $posterSrc = ''
    $posterAlt = "Cartaz de $title"

    $mainPosterMatch = [regex]::Match($mainInner, '<img[^>]*src="([^"]+)"[^>]*>')
    if ($mainPosterMatch.Success) {
        $posterSrc = $mainPosterMatch.Groups[1].Value
        $posterAltMatch = [regex]::Match($mainPosterMatch.Value, 'alt="([^"]*)"')
        if ($posterAltMatch.Success -and $posterAltMatch.Groups[1].Value.Trim() -ne '') {
            $posterAlt = $posterAltMatch.Groups[1].Value.Trim()
        }
    }

    if (-not $posterSrc) {
        $sidebarPosterMatch = [regex]::Match($content, '(?s)sidebar-titulo">\s*Cartaz do espetáculo\s*</div>.*?<img[^>]*src="([^"]+)"[^>]*>')
        if ($sidebarPosterMatch.Success) {
            $posterSrc = $sidebarPosterMatch.Groups[1].Value
        }
    }

    $dates = New-Object System.Collections.Generic.List[string]
    $agendaBlockMatch = [regex]::Match($mainInner, '(?is)<table[^>]*class="[^"]*tabela-agenda[^"]*"[^>]*>(.*?)</table>')
    if ($agendaBlockMatch.Success) {
        $rows = [regex]::Matches($agendaBlockMatch.Groups[1].Value, '(?is)<tr>(.*?)</tr>')
        foreach ($row in $rows) {
            $cells = [regex]::Matches($row.Groups[1].Value, '(?is)<t[hd][^>]*>(.*?)</t[hd]>') | ForEach-Object { Strip-Html $_.Groups[1].Value }
            if ($cells.Count -ge 3 -and $cells[0] -notmatch '^\s*Data\s*$') {
                $dates.Add(($cells[0..2] -join ' - '))
            }
        }
    }

    $locations = @()

    $localSectionMatch = [regex]::Match($mainInner, '(?is)<h[23]>\s*Local(?:es)?\s*</h[23]>.*?(<ul[^>]*class="[^"]*apoio-grid[^"]*"[^>]*>.*?</ul>)')
    if ($localSectionMatch.Success) {
        $liMatches = [regex]::Matches($localSectionMatch.Groups[1].Value, '(?is)<li[^>]*>(.*?)</li>')
        foreach ($li in $liMatches) {
            $liHtml = $li.Groups[1].Value
            $name = ''
            $address = ''
            $url = ''

            $nameMatch = [regex]::Match($liHtml, '(?is)<strong>(.*?)</strong>')
            if ($nameMatch.Success) {
                $name = Strip-Html $nameMatch.Groups[1].Value
            }

            $spanMatches = [regex]::Matches($liHtml, '(?is)<span[^>]*>(.*?)</span>')
            if ($spanMatches.Count -ge 2) {
                $address = Strip-Html $spanMatches[$spanMatches.Count - 1].Groups[1].Value
            }

            $urlMatch = [regex]::Match($liHtml, 'href="([^"]+)"')
            if ($urlMatch.Success) {
                $url = $urlMatch.Groups[1].Value
            }

            if ($name -or $address) {
                $locations += [pscustomobject]@{
                    Name = $name
                    Address = $address
                    Url = $url
                }
            }
        }
    }

    if ($dates.Count -eq 0 -or $locations.Count -eq 0) {
        $legacyParagraph = [regex]::Matches($mainInner, '(?is)<p[^>]*>(.*?)</p>') |
            Where-Object { (Strip-Html $_.Groups[1].Value) -match '(?i)apresenta|teve' } |
            Select-Object -First 1

        if ($legacyParagraph) {
            $legacyHtml = $legacyParagraph.Groups[1].Value
            $legacyText = Strip-Html $legacyHtml

            $linkMatch = [regex]::Match($legacyHtml, '(?is)<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>')
            $locationName = ''
            $locationUrl = ''

            if ($linkMatch.Success) {
                $locationUrl = $linkMatch.Groups[1].Value
                $locationName = Strip-Html $linkMatch.Groups[2].Value
            }

            if (-not $locationName) {
                $locationGuess = [regex]::Match($legacyText, '(?i)na\s+([^,]+)')
                if ($locationGuess.Success) {
                    $locationName = $locationGuess.Groups[1].Value.Trim()
                }
            }

            $datesMatch = [regex]::Match($legacyText, '(?i)(nos dias?|no dia|em)\s+(.+)$')
            $datePhrase = if ($datesMatch.Success) { $datesMatch.Groups[2].Value.Trim().TrimEnd('.') } else { '' }

            if ($dates.Count -eq 0 -and $datePhrase) {
                if ($locationName) {
                    $dates.Add("${locationName}: $datePhrase")
                } else {
                    $dates.Add($datePhrase)
                }
            }

            if ($locations.Count -eq 0 -and $locationName) {
                $locations += [pscustomobject]@{
                    Name = $locationName
                    Address = ''
                    Url = $locationUrl
                }
            }
        }
    }

    if ($dates.Count -eq 0) {
        $dates.Add('Datas em atualização')
    }

    if ($locations.Count -eq 0) {
        $locations += [pscustomobject]@{
            Name = 'Locais em atualização'
            Address = ''
            Url = ''
        }
    }

    if (-not $posterSrc) {
        $posterSrc = '/css/img/instagram.webp'
    }

    $datesHtml = ($dates | ForEach-Object { "<span>$($_)</span>" }) -join '<br>'

    $locationsHtmlParts = foreach ($location in $locations) {
        $nameHtml = if ($location.Url) {
            '<a class="show-infobox-location-link" href="{0}" target="_blank" rel="noopener noreferrer" aria-label="Abrir local no mapa">{1}</a>' -f $location.Url, $location.Name
        } else {
            '<span>{0}</span>' -f $location.Name
        }

        if ($location.Address) {
            '<div class="show-infobox-location">{0}<span class="show-infobox-location-address">{1}</span></div>' -f $nameHtml, $location.Address
        } else {
            '<div class="show-infobox-location">{0}</div>' -f $nameHtml
        }
    }

    $locationsHtml = ($locationsHtmlParts -join '<br>')

    $infobox = @"

			<aside class="show-infobox" aria-label="Infobox de $title">
				<figure class="show-infobox-poster">
					<img src="$posterSrc" alt="$posterAlt">
					<figcaption>Cartaz do espetáculo</figcaption>
				</figure>
				<table class="show-infobox-meta">
					<tbody>
						<tr>
							<th scope="row">Apresentações</th>
							<td>$datesHtml</td>
						</tr>
						<tr>
							<th scope="row">Locais</th>
							<td>$locationsHtml</td>
						</tr>
					</tbody>
				</table>
			</aside>
"@

    $firstParagraphMatch = [regex]::Match($mainInner, '(?is)<p[^>]*>.*?</p>')
    if ($firstParagraphMatch.Success) {
        $insertPosition = $firstParagraphMatch.Index + $firstParagraphMatch.Length
        $mainInner = $mainInner.Insert($insertPosition, $infobox)
    } else {
        $mainInner = $infobox + $mainInner
    }

    if ($mainPosterMatch.Success) {
        $mainInner = [regex]::Replace($mainInner, [regex]::Escape($mainPosterMatch.Value), '', 1)
    }

    $newContent = $content.Substring(0, $mainMatch.Groups[1].Index) + $mainInner + $content.Substring($mainMatch.Groups[1].Index + $mainMatch.Groups[1].Length)
    Set-Content -Path $file.FullName -Encoding UTF8 -Value $newContent
    $updated++
}

Write-Output "UPDATED=$updated SKIPPED=$skipped"
