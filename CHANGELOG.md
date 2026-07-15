change(): # Changelog

## [v1.0.7] - [2026-07-15]
- atualizada a página [index.html] removendo o espetáculo "Quando Você Não Estiver Mais Aqui".
- atualizada a página [espetaculos/2026/as-bruxas-de-salem.html] adicionando sessão extra.
- atualizada a página [espetaculos/2026/quando-voce-nao-estiver-mais-aqui.html] removendo link para pagamento e informações de compra de ingressos.

## [v1.0.6] - [2026-07-09]
- atualizada a página [index.html] com link para o CBT.

## [v1.0.5] - [2026-06-30]
- atualizada a página do espetáculo [espetaculos/2026/quando-voce-nao-estiver-mais-aqui.html] com novo bloco de elenco, crédito de fotografia e ampliação da galeria.
- migrada a galeria de "Quando Você Não Estiver Mais Aqui" de PNG para WEBP, com remoção dos arquivos antigos [espetaculos/2026/img/quando-1.png](espetaculos/2026/img/quando-1.png) a [espetaculos/2026/img/quando-7.png](espetaculos/2026/img/quando-7.png) e inclusão de novos arquivos em [espetaculos/2026/img](espetaculos/2026/img) (quando-1.webp a quando-9.webp e quando-elenco.webp).
- padronizados os blocos de "Apresentações e locais" e "Apoiadores" em páginas de 2025 ([espetaculos/2025/a-mulher-sem-pecado.html](espetaculos/2025/a-mulher-sem-pecado.html), [espetaculos/2025/album-de-familia.html](espetaculos/2025/album-de-familia.html), [espetaculos/2025/o-bem-do-mar.html](espetaculos/2025/o-bem-do-mar.html) e [espetaculos/2025/paraiso-perdido.html](espetaculos/2025/paraiso-perdido.html)), com ajuste de marcação e links institucionais.
- removida duplicidade de texto descritivo em [espetaculos/2025/o-bem-do-mar.html](espetaculos/2025/o-bem-do-mar.html), consolidando as informações de apresentação na infobox.
- atualizado o comportamento do CTA rápido em [js/app.js](js/app.js) para reconhecer também a rota /cbt/ sem index explícito e manter o rótulo "Inscreva-se" na landing do CBT.
- incluído link clicável para o parceiro "Casarão 83" na seção de apoiadores de [espetaculos/2026/as-bruxas-de-salem.html](espetaculos/2026/as-bruxas-de-salem.html).

## [v1.0.4] - [2026-06-25]
- incluídas novas formações complementares no perfil de Francis Castela em [francis-castela.html](francis-castela.html), com os cursos "Economia Cultural e Criativa, Indicadores e Patrimônio Cultural" e "Video Mapping: Vídeo Projeção, Palco e Artes".
- padronizado o link do curso "Trilha Sonora para as Artes ao Vivo" em [francis-castela.html](francis-castela.html), removendo o parâmetro de compartilhamento da URL.

## [v1.0.3] - [2026-06-14]
- corrigida a grafia do título "As Bruxas de Salém" para "As Bruxas de Salem" (sem acento) em todas as ocorrências: [espetaculos/2026/as-bruxas-de-salem.html](espetaculos/2026/as-bruxas-de-salem.html), [espetaculos/2016/as-bruxas-de-salem.html](espetaculos/2016/as-bruxas-de-salem.html), [espetaculos/index.html](espetaculos/index.html) e [index.html](index.html).
- reescrita a sinopse do espetáculo em [espetaculos/2026/as-bruxas-de-salem.html](espetaculos/2026/as-bruxas-de-salem.html), com nova contextualização histórica da montagem.
- ajustada a autoclassificação indicativa de 16 para 14 anos, com atualização da descrição de conteúdo em [espetaculos/2026/as-bruxas-de-salem.html](espetaculos/2026/as-bruxas-de-salem.html).
- adicionada galeria de fotos com 5 imagens promocionais (bruxas-1 a bruxas-5.webp) em [espetaculos/2026/img](espetaculos/2026/img), substituindo o aviso de registros indisponíveis.

## [v1.0.2] - [2026-06-01]
- reformulada a landing do CBT em [cbt/index.html](cbt/index.html), com foco na 26ª edição de inverno, nova hierarquia de seções e CTA de inscrição em destaque.
- incluídas novas seções de conteúdo no CBT (infobox estruturada, dúvidas rápidas, equipe e suporte), mantendo a galeria de fotos com textos alternativos mais descritivos.
- implementado carrossel automático de cartazes na infobox em [cbt/index.html](cbt/index.html), com preload das imagens e transição suave entre peças.
- atualizados metadados sociais/SEO do CBT (Open Graph, Twitter, canonical e JSON-LD) para uso da imagem [cbt/img/cbt-og.jpg](cbt/img/cbt-og.jpg).
- substituído o cartaz antigo [cbt/img/cartaz-cbt-40edicao.webp](cbt/img/cartaz-cbt-40edicao.webp) por uma nova sequência de cartazes da 26ª edição em [cbt/img](cbt/img).
- preservada a versão anterior da página do curso em [cbt/old-index.html](cbt/old-index.html), com remoção do arquivo legado [cbt/new-index.html](cbt/new-index.html).

## [v1.0.1] - [2026-05-29]
- criada a automacao da rotina continua de performance em [ferramentas/rotina-performance.ps1](ferramentas/rotina-performance.ps1), com log por execucao, controle de falhas e orquestracao por etapas.
- implementados os scripts de base da rotina em [ferramentas/scripts](ferramentas/scripts): validar-site.ps1, auditar-performance.ps1, verificar-links.ps1, verificar-seo-basico.ps1 e verificar-assets-referenciados.ps1.
- adicionados relatorios tecnicos gerados pela rotina em [ferramentas/relatorios](ferramentas/relatorios), incluindo performance, links, SEO basico e assets referenciados.
- atualizada a documentacao operacional da rotina de performance em [ferramentas/relatorios/performance-routine.md](ferramentas/relatorios/performance-routine.md).
- removidas copias de governanca em docs/governance (performance-routine.md e review-cycle.md), consolidando o fluxo em [ferramentas/relatorios](ferramentas/relatorios).
- restringida a persistencia de scroll do script global para funcionar somente na index de espetaculos ([espetaculos/index.html](espetaculos/index.html)) via ajuste em [js/app.js](js/app.js).
- corrigidos links internos e padronizados caminhos para .html/.rota correta em paginas institucionais e navegacao global (cabecalho, rodape, quem-somos, valentim, CBT e galeria Anchieta).
- ajustada hierarquia semantica de headings em paginas com h1 duplicado (quem-somos e espetaculos especificos), eliminando falhas criticas de SEO basico.
- corrigidos slugs/URLs de espetaculos no indice quando divergiam do nome real de arquivo.
- aplicado saneamento de acessibilidade em lote com insercao de atributo alt em imagens sem descricao em paginas do acervo e institucionais, zerando os avisos da etapa validar-site.

## [v1.0.0] - [2026-05-28]
- versão oficial do site nomeada como v1.0.0.
- a partir desta data, a mensagem de commit passa a ser a versão de lançamento.
- criado o arquivo CHANGELOG.md na raiz do projeto.
- padronizadas seções iniciais do changelog.
- reorganizado css/styles/style.css por seções documentadas (fontes, tema, base, layout, componentes e responsividade).
- padronizada a ordem de propriedades CSS em todo o arquivo, seguindo a convenção Wikifluent.
- formalizado no CSS o nome do sistema visual como Design System Wikifluent.
- incluídas orientações de manutenção do CSS no topo do arquivo (boas práticas, especificidade e uso de breakpoints).
- saneamento em lote do HTML de páginas de espetáculos (1995-2026), com padronização de marcação em blocos complementares e parágrafos de apêndice.
- ajustes estruturais em páginas institucionais para alinhamento com o padrão de conteúdo complementar (francis-castela e valentim).
- revisão de marcação e formatação de trechos da home (metadados/grade de espetáculos) para consistência de layout.
- atualização de mídia do espetáculo "12 Jurados e Uma Sentença" (cartaz e imagem OG) e inclusão de novas imagens de galeria.

## [2026-05-27]
- rodada de modernização visual e estrutural (Wikifluent).

## [2026-05-20]
- novos cursos de formação na seção de apoio do perfil de Francis Castela.
- atualização de estilo e estrutura de cards.
- correção de erro de digitação.

## [2026-05-15]
- inclusão da parceria local Casarão 83 em múltiplas páginas.

## [2026-05-06]
- atualização de links e informações de perfil de Francis Castela.

## [2026-05-05]
- atualização de título e subtítulo da seção de espetáculos na página inicial.
- reordenação de cartazes na página inicial.

## [2026-05-04]
- inclusão do cartaz de "As Bruxas de Salem".
- ajuste da ordem de exibição de espetáculos no index.
- atualização da sitemap.

## [2026-04-28]
- atualização de cartazes na página de espetáculos.

## [2026-04-27]
- atualização de cartazes de espetáculos (incluindo "Jurados" e "Quando").

## [2026-04-26]
- atualização do cartaz de "Bruxas".

## [2026-04-25]
- atualização da imagem OG e de cartazes relacionados.

## [2026-04-24]
- ajuste de margens e formatação de HTML/CSS na página "Quem somos".

## [2026-04-20]
- ajustes de classificação indicativa e descrição correspondente.

## [2026-04-04]
- ajuste de nome artístico.

## [2026-04-03]
- atualização de cartazes e imagem de espetáculo (incluindo peça "Barca").
- melhorias na busca de espetáculos e na integração de links de pessoas (CSV).
- correção de nomes de artistas e ajustes de seletores CSS.
- correção de erros de ortografia e padronização textual.

## [2026-04-02]
- scripts de validação SEO, auditoria de performance, compressão de imagens e verificação ortográfica em ferramentas/scripts.
- filtro de busca de espetáculos e melhorias de dicas de performance para mídia.
- melhorias de acessibilidade com links de pular conteudo e atributos ARIA.
- reorganização de estrutura HTML, níveis de títulos e metadados para maior consistência entre páginas.
- atualização de imagens para produções de 2024 e 2025.
- padronização de classes de botões com foco em acessibilidade.
- correção de formatação de comentários em imagens e inconsistências estruturais em HTML.

## [2026-04-01]
- refatoração de páginas de espetáculos para consistência e clareza.
- reorganização de informações de local em formato de lista para melhor acessibilidade.
- atualização de metadados, blocos de referência e seção de apoiadores com links.
- correção de erros de digitação e melhora de clareza textual em HTML.

## [2026-03-31]
- rodada de modernização visual e estrutural (Fluent 2).
- melhorias de SEO e acessibilidade nas paginas quem-somos e valentim.

## [2026-03-24]
- inclusão de links para venda de ingressos.
- ajuste visual no rodapé (remoção de border-radius na âncora).
- remoção de linha duplicada.

## [2026-03-19]
- atualização de informações sobre lotes de ingressos.
- correção de nomes de personagens, elenco e diretores.
- remoção de entrada duplicada.

## [2023-10-25]
- commit inicial do repositorio ("Add files via upload").
