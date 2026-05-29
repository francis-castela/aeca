# Changelog

## [v1.0.1] - [2026-05-29]
- add(): criada a automacao da rotina continua de performance em [ferramentas/rotina-performance.ps1](ferramentas/rotina-performance.ps1), com log por execucao, controle de falhas e orquestracao por etapas.
- add(): implementados os scripts de base da rotina em [ferramentas/scripts](ferramentas/scripts): validar-site.ps1, auditar-performance.ps1, verificar-links.ps1, verificar-seo-basico.ps1 e verificar-assets-referenciados.ps1.
- add(): adicionados relatorios tecnicos gerados pela rotina em [ferramentas/relatorios](ferramentas/relatorios), incluindo performance, links, SEO basico e assets referenciados.
- change(): atualizada a documentacao operacional da rotina de performance em [ferramentas/relatorios/performance-routine.md](ferramentas/relatorios/performance-routine.md).
- change(): removidas copias de governanca em docs/governance (performance-routine.md e review-cycle.md), consolidando o fluxo em [ferramentas/relatorios](ferramentas/relatorios).
- change(): restringida a persistencia de scroll do script global para funcionar somente na index de espetaculos ([espetaculos/index.html](espetaculos/index.html)) via ajuste em [js/app.js](js/app.js).
- fix(): corrigidos links internos e padronizados caminhos para .html/.rota correta em paginas institucionais e navegacao global (cabecalho, rodape, quem-somos, valentim, CBT e galeria Anchieta).
- fix(): ajustada hierarquia semantica de headings em paginas com h1 duplicado (quem-somos e espetaculos especificos), eliminando falhas criticas de SEO basico.
- fix(): corrigidos slugs/URLs de espetaculos no indice quando divergiam do nome real de arquivo.
- fix(): aplicado saneamento de acessibilidade em lote com insercao de atributo alt em imagens sem descricao em paginas do acervo e institucionais, zerando os avisos da etapa validar-site.

## [v1.0.0] - [2026-05-28]
- change(): versão oficial do site nomeada como v1.0.0.
- change(): a partir desta data, a mensagem de commit passa a ser a versão de lançamento.
- add(): criado o arquivo CHANGELOG.md na raiz do projeto.
- change(): padronizadas seções iniciais do changelog.
- change(): reorganizado css/styles/style.css por seções documentadas (fontes, tema, base, layout, componentes e responsividade).
- change(): padronizada a ordem de propriedades CSS em todo o arquivo, seguindo a convenção Wikifluent.
- add(): formalizado no CSS o nome do sistema visual como Design System Wikifluent.
- add(): incluídas orientações de manutenção do CSS no topo do arquivo (boas práticas, especificidade e uso de breakpoints).
- change(): saneamento em lote do HTML de páginas de espetáculos (1995-2026), com padronização de marcação em blocos complementares e parágrafos de apêndice.
- change(): ajustes estruturais em páginas institucionais para alinhamento com o padrão de conteúdo complementar (francis-castela e valentim).
- change(): revisão de marcação e formatação de trechos da home (metadados/grade de espetáculos) para consistência de layout.
- change(): atualização de mídia do espetáculo "12 Jurados e Uma Sentença" (cartaz e imagem OG) e inclusão de novas imagens de galeria.

## [2026-05-27]
- change(): rodada de modernização visual e estrutural (Wikifluent).

## [2026-05-20]
- add(): novos cursos de formação na seção de apoio do perfil de Francis Castela.
- change(): atualização de estilo e estrutura de cards.
- fix(): correção de erro de digitação.

## [2026-05-15]
- add(): inclusão da parceria local Casarão 83 em múltiplas páginas.

## [2026-05-06]
- change(): atualização de links e informações de perfil de Francis Castela.

## [2026-05-05]
- change(): atualização de título e subtítulo da seção de espetáculos na página inicial.
- change(): reordenação de cartazes na página inicial.

## [2026-05-04]
- add(): inclusão do cartaz de "As Bruxas de Salem".
- change(): ajuste da ordem de exibição de espetáculos no index.
- change(): atualização da sitemap.

## [2026-04-28]
- change(): atualização de cartazes na página de espetáculos.

## [2026-04-27]
- change(): atualização de cartazes de espetáculos (incluindo "Jurados" e "Quando").

## [2026-04-26]
- change(): atualização do cartaz de "Bruxas".

## [2026-04-25]
- change(): atualização da imagem OG e de cartazes relacionados.

## [2026-04-24]
- fix(): ajuste de margens e formatação de HTML/CSS na página "Quem somos".

## [2026-04-20]
- change(): ajustes de classificação indicativa e descrição correspondente.

## [2026-04-04]
- change(): ajuste de nome artístico.

## [2026-04-03]
- change(): atualização de cartazes e imagem de espetáculo (incluindo peça "Barca").
- change(): melhorias na busca de espetáculos e na integração de links de pessoas (CSV).
- fix(): correção de nomes de artistas e ajustes de seletores CSS.
- fix(): correção de erros de ortografia e padronização textual.

## [2026-04-02]
- add(): scripts de validação SEO, auditoria de performance, compressão de imagens e verificação ortográfica em ferramentas/scripts.
- add(): filtro de busca de espetáculos e melhorias de dicas de performance para mídia.
- add(): melhorias de acessibilidade com links de pular conteudo e atributos ARIA.
- change(): reorganização de estrutura HTML, níveis de títulos e metadados para maior consistência entre páginas.
- change(): atualização de imagens para produções de 2024 e 2025.
- change(): padronização de classes de botões com foco em acessibilidade.
- fix(): correção de formatação de comentários em imagens e inconsistências estruturais em HTML.

## [2026-04-01]
- change(): refatoração de páginas de espetáculos para consistência e clareza.
- change(): reorganização de informações de local em formato de lista para melhor acessibilidade.
- change(): atualização de metadados, blocos de referência e seção de apoiadores com links.
- fix(): correção de erros de digitação e melhora de clareza textual em HTML.

## [2026-03-31]
- change(): rodada de modernização visual e estrutural (Fluent 2).
- change(): melhorias de SEO e acessibilidade nas paginas quem-somos e valentim.

## [2026-03-24]
- add(): inclusão de links para venda de ingressos.
- change(): ajuste visual no rodapé (remoção de border-radius na âncora).
- fix(): remoção de linha duplicada.

## [2026-03-19]
- change(): atualização de informações sobre lotes de ingressos.
- fix(): correção de nomes de personagens, elenco e diretores.
- fix(): remoção de entrada duplicada.

## [2023-10-25]
- add(): commit inicial do repositorio ("Add files via upload").
