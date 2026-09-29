# Criador de páginas AECA (extensão local do VS Code)

Ferramenta local para gerar HTML estático que continua compatível com GitHub Pages. Não requer framework nem dependências npm externas; usa apenas APIs oficiais do VS Code e Node.js disponibilizado pela extensão.

## Executar no VS Code

1. Abra a pasta raiz do repositório AECA.
2. Pressione `F5` e escolha **Executar extensão Criador de Páginas AECA** para iniciar um Extension Development Host.
3. No host, execute **AECA: Criar página HTML** pela Paleta de Comandos.
4. Escolha o modelo, preencha os dados, selecione imagens de qualquer pasta do computador e gere a página.

A extensão pode também ser carregada em modo de desenvolvimento a partir deste diretório pela opção `--extensionDevelopmentPath` do VS Code. Não está empacotada nem publicada no Marketplace.

## Modelos disponíveis

- **Espetáculo:** divulgação ou registro histórico; destino sugerido `espetaculos/AAAA/`; inclui infobox, sessões, local, obra, elenco, ficha técnica e galeria opcionais.
- **Institucional / artigo:** destino sugerido na raiz; transforma texto simples em parágrafos, títulos `##` e listas `-` sem aceitar HTML digitado.
- **Perfil / currículo:** destino sugerido na raiz; foto, biografia e trajetória em linhas `Ano | Atividade`.
- **Galeria histórica:** destino sugerido `anchieta/`; grupos no formato `Período | Título | caminho/imagem, caminho/imagem`.
- **Evento / curso:** destino sugerido `cbt/`; apresentação, data, local, inscrição e perguntas no formato `Pergunta | Resposta`.

Os modelos ficam separados da extensão em `templates/`, e seus campos/destinos estão definidos em `templates/catalog.json`.

## Imagens e pré-visualização

O seletor de imagens pode abrir qualquer pasta do computador. Ao publicar, a ferramenta copia os arquivos para a estrutura do site e usa nomes previsíveis:

- espetáculo, evento e galeria: pasta de destino + `img/`;
- perfil e página institucional: `css/img/`;
- cartaz: `slug-cartaz.ext`;
- imagem social: `slug-og.ext`;
- retrato: `slug-retrato.ext`;
- capa: `slug-capa.ext`;
- galerias: `slug-1.ext`, `slug-2.ext` etc.

Arquivos existentes nunca são sobrescritos. A tela também tem uma prévia baseada no template atual; ela carrega o `css/styles/style.css` real e converte as imagens escolhidas para recursos locais do Webview, sem publicar nem alterar o site durante a visualização.

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
