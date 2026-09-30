# Criador de páginas AECA (extensão local do VS Code)

Ferramenta local para gerar HTML estático que continua compatível com GitHub Pages. Não requer framework nem dependências npm externas; usa apenas APIs oficiais do VS Code e Node.js disponibilizado pela extensão.

## Executar no VS Code

1. Abra a pasta raiz do repositório AECA.
2. Pressione `F5` e escolha **Executar extensão Criador de Páginas AECA** para iniciar um Extension Development Host.
3. No host, execute **AECA: Criar página HTML** pela Paleta de Comandos.
4. Monte a página com blocos, importe uma página existente se desejar, e gere o HTML.

A extensão pode também ser carregada em modo de desenvolvimento a partir deste diretório pela opção `--extensionDevelopmentPath` do VS Code. Não está empacotada nem publicada no Marketplace.

## Editor geral

O editor não exige escolher um tipo de página. A marca AECA fica num cabeçalho horizontal, os metadados permanecem numa coluna lateral e a própria prévia é o canvas WYSIWYG. Os controles de mover/arrastar e X aparecem junto ao bloco selecionado; o seletor converte esse bloco, enquanto `+ Bloco` insere outro. Ferramentas de tabela aparecem somente quando uma tabela está selecionada. A barra oferece formatação, listas e os modos Desktop/Mobile. O conteúdo é sincronizado com blocos estruturados antes de publicar. Na importação, infobox, grade de apoiadores, tabelas estilizadas, fotos e galerias preservam as classes do site.

**Editar existente** importa o conteúdo de `<main>` para esses blocos. Títulos, parágrafos, tabelas com cabeçalho ou rótulo por linha, listas, figuras, galerias, links, vídeos do YouTube/Vimeo e `<details>` são reconhecidos. Ao publicar, a página original só é substituída depois de uma confirmação explícita; cancelar não altera o arquivo. Elementos personalizados e estilos locais não são reproduzidos como HTML arbitrário, então revise a prévia antes de substituir.

Os modelos anteriores permanecem no catálogo e nos templates para compatibilidade com a geração já existente, mas não são apresentados como escolha no editor geral.

## Imagens e pré-visualização

O seletor de imagens pode abrir qualquer pasta do computador. Ao publicar, a ferramenta copia os arquivos para a estrutura do site e usa nomes previsíveis:

- páginas gerais: pasta de destino + `img/`;
- perfil e página institucional: `css/img/`;
- cartaz: `slug-cartaz.ext`;
- imagem social: `slug-og.ext`;
- retrato: `slug-retrato.ext`;
- capa: `slug-capa.ext`;
- galerias: `slug-1.ext`, `slug-2.ext` etc.

Arquivos existentes nunca são sobrescritos sem confirmação. A tela também tem uma prévia baseada no template geral; ela carrega o `css/styles/style.css` real e converte as imagens escolhidas para recursos locais do Webview, sem publicar nem alterar o site durante a visualização.

## Segurança e limites

- Slug restrito a kebab-case ASCII; o destino deve ficar dentro do workspace.
- O arquivo é criado em modo exclusivo: se já existir, nada é substituído.
- Imagens podem vir de qualquer pasta; antes da publicação são copiadas para a pasta de mídia adequada e gravadas como URLs iniciadas pela raiz do site.
- Texto é escapado e URLs fornecidas pelo usuário só aceitam HTTP/HTTPS.
- CSS global e `/js/app.js` são referenciados como nas páginas existentes. Cabeçalho e rodapé vêm dos fragmentos globais injetados pelo script.
- A ferramenta **não altera** home, `espetaculos/index.html`, índices de outras seções ou `sitemap.xml`. Como esses registros são listas manuais, a interface lembra de atualizá-los após a revisão, quando aplicável.
- O modelo de evento cria uma página editorial de divulgação, não as páginas transacionais de confirmação/pagamento nem a landing especial `cbt/new-index.html`.

## Testes

Na pasta da extensão, execute `npm test` (requer Node.js). Os testes exercitam slug, escaping, destinos, montagem HTML e proteção de links.
