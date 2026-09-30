# Auditoria de compatibilidade com o editor geral

Auditoria estrutural das páginas HTML do repositório, em 30/09/2026. Foram encontrados 130 arquivos HTML; 3 são fragmentos compartilhados em `html/` (cabeçalho, rodapé e countdown), restando 127 páginas publicadas.

## Padrões encontrados

As ocorrências abaixo se sobrepõem; uma página pode conter vários padrões.

| Estrutura | Páginas |
| --- | ---: |
| `<main>` | 127 |
| `show-infobox` | 116 |
| `<table>` | 118 |
| `main-galeria` | 111 |
| `apoio-grid` | 110 |
| `page-subtitle` | 123 |
| `tabela-elenco` | 57 |
| `tabela-ficha` | 57 |

A leitura dos elementos dentro de `<main>` encontrou 1.529 imagens, 1.719 linhas de tabela, 502 itens de lista, 650 títulos `h3` e 917 separadores `<hr>`. A estrutura se repete, mas as classes e os agrupamentos não são uniformes o suficiente para depender de um formulário rígido por tipo de página.

## Exceções observadas

- `quem-somos.html` tem vários títulos principais e um vídeo do YouTube.
- Três páginas de espetáculos usam `<details>` e `<summary>` para explicar lotes.
- Infoboxes usam tabelas sem `<thead>`, com `<th scope="row">` para identificar cada linha.
- Listas aparecem em marcação inválida como itens `<li>` fora de `<ul>`/`<ol>`; o parser do navegador corrige parte dessa estrutura ao importar.
- Há classes de apresentação próprias, como `apoio-grid`, `show-infobox` e `main-galeria`, cuja aparência não é transportada como HTML arbitrário pelo editor geral.

## Decisão de compatibilidade

O editor geral usa um único template semântico e transforma o conteúdo de `<main>` em blocos editáveis: títulos, parágrafos/links, listas, tabelas, figuras/galerias, citações, vídeos confiáveis, conteúdo expansível e separadores. Assim, a página pode ser normalizada quando for importada e revisada, sem regravar todo o acervo de uma vez.

Nenhuma das 127 páginas foi alterada nesta auditoria. A substituição de uma página importada exige confirmação e deve ser precedida da revisão da prévia. Componentes ou estilos muito específicos podem precisar de ajuste manual após a importação.
