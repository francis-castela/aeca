$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$espetaculosPath = Join-Path $root 'espetaculos'
$files = Get-ChildItem -Recurse -Path $espetaculosPath -Filter *.html | Where-Object { $_.FullName -match '\\espetaculos\\\d{4}\\' }

$updated = 0

foreach ($file in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $file.FullName
    $original = $content

    $obraBlockMatch = [regex]::Match(
        $content,
        '(?is)<blockquote[^>]*class="[^"]*apoio-card[^"]*"[^>]*aria-label="\s*Obra de refer[^\"]*"[^>]*>[\s\S]*?</blockquote>'
    )

    if ($obraBlockMatch.Success) {
        $obraBlock = $obraBlockMatch.Value

        $obra = ''
        $autor = ''

        $obraMatch = [regex]::Match($obraBlock, '(?is)<p[^>]*class="[^"]*obra-referencia-citacao[^"]*"[^>]*>([\s\S]*?)</p>')
        if ($obraMatch.Success) {
            $obra = $obraMatch.Groups[1].Value.Trim()
        }

        $autorMatch = [regex]::Match($obraBlock, '(?is)<cite[^>]*class="[^"]*obra-referencia-autor[^"]*"[^>]*>([\s\S]*?)</cite>')
        if ($autorMatch.Success) {
            $autor = $autorMatch.Groups[1].Value.Trim()
        }

        $rowsHtml = ''
        if (-not [string]::IsNullOrWhiteSpace($obra)) {
            $rowsHtml += "`r`n`t`t`t`t`t`t<tr>`r`n`t`t`t`t`t`t`t<th scope=""row"">Obra</th>`r`n`t`t`t`t`t`t`t<td><span>$obra</span></td>`r`n`t`t`t`t`t`t</tr>"
        }
        if (-not [string]::IsNullOrWhiteSpace($autor)) {
            $rowsHtml += "`r`n`t`t`t`t`t`t<tr>`r`n`t`t`t`t`t`t`t<th scope=""row"">Autor(es)</th>`r`n`t`t`t`t`t`t`t<td><span>$autor</span></td>`r`n`t`t`t`t`t`t</tr>"
        }

        if (-not [string]::IsNullOrWhiteSpace($rowsHtml)) {
            $content = [regex]::Replace(
                $content,
                '(?is)(<table class="show-infobox-meta">[\s\S]*?<tbody>)([\s\S]*?)(</tbody>\s*</table>)',
                {
                    param($m)
                    $start = $m.Groups[1].Value
                    $body = $m.Groups[2].Value
                    $end = $m.Groups[3].Value

                    # Remove linhas existentes para evitar duplicidade
                    $body = [regex]::Replace(
                        $body,
                        '(?is)\s*<tr>\s*<th\s+scope="row">\s*(?:Obra|Autor\(es\)|Autores)\s*</th>[\s\S]*?</tr>',
                        ''
                    )

                    if ([regex]::IsMatch($body, '(?is)<tr>\s*<th\s+scope="row">\s*Locais\s*</th>[\s\S]*?</tr>')) {
                        $body = [regex]::Replace(
                            $body,
                            '(?is)(<tr>\s*<th\s+scope="row">\s*Locais\s*</th>[\s\S]*?</tr>)',
                            ('$1' + $rowsHtml),
                            1
                        )
                    }
                    else {
                        $body += $rowsHtml
                    }

                    return $start + $body + $end
                },
                1
            )
        }

        # Remove bloco antigo de obra de referencia da pagina
        $content = [regex]::Replace(
            $content,
            '(?is)\s*<blockquote[^>]*class="[^\"]*apoio-card[^\"]*"[^>]*aria-label="\s*Obra de refer[^\"]*"[^>]*>[\s\S]*?</blockquote>\s*',
            "`r`n"
        )
    }

    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Encoding UTF8 -Value $content
        $updated++
    }
}

Write-Output "UPDATED=$updated"
