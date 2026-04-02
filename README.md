# A.E.C.A - Site Oficial

Este repositório contém o site do A.E.C.A (Alunos do Exercício Cênico Anchieta), com páginas institucionais, acervo histórico de espetáculos e páginas de divulgação de montagens em cartaz.

## Objetivo do projeto

- Preservar a memória artística do grupo teatral.
- Divulgar novas produções e comercializar ingressos quando necessário.
- Manter um padrão visual único em todo o site.

## Como funcionam as páginas de espetáculo

Há dois cenários:

1. Divulgação (espetáculo futuro)
- Página focada em venda e comunicação.
- Pode incluir: venda de ingressos, lotes, sessões, local, classificação indicativa.

2. Registro histórico (espetáculo encerrado)
- Página focada em memória do processo e da montagem.
- Pode incluir: texto de contexto, ficha técnica final, elenco final, galeria de fotos e cartaz.

A transição natural é: página nasce como divulgação e, após o período de apresentações, é convertida em registro histórico.

## Padrão da seção de apoiadores

Ordem recomendada dos cards:
1. Patrocinador
2. Institucional
3. Espaço cultural
4. Parceria local

Tipos de card:
- Card simples: sem link.
- Card-link: card inteiro clicável com classe apoio-card-link.

Links institucionais frequentes:
- Prefeitura de Itajaí: https://itajai.sc.gov.br/
- Fundação Cultural de Itajaí: https://fundacaocultural.itajai.sc.gov.br/
- Casa da Cultura Dide Brandão: https://fundacaocultural.itajai.sc.gov.br/casa-da-cultura/
- UNIVALI: https://portal.univali.br/
- Tupã Contabilidade: https://www.instagram.com/tupa_contabilidadeitajai/

## CSS global (style.css)

A folha de estilo está organizada por seções temáticas, com comentários descritivos em cada bloco:

- Fontes
- Base e variáveis (tema claro e escuro)
- Cabeçalho e navegação
- Links interativos
- Layout
- Sistema de cards
- Cartazes e galerias
- Sidebar
- Rodapé
- Modal de imagens
- Botões
- Classificação indicativa
- Tabelas
- Obra de referência
- Countdown
- Scroll-top
- Apoiadores
- Blocos específicos de páginas (CBT e currículo)
- Ajustes do tema escuro
- Responsividade

### Boas práticas de manutenção do CSS

- Reutilizar variáveis do :root em vez de hardcode de cor.
- Evitar duplicação de seletores e regras.
- Manter componentes semelhantes juntos por categoria.
- Comentar apenas o que ajuda quem vai manter o projeto.
- Antes de criar nova classe, verificar se já existe padrão equivalente no arquivo.

## Convenções de conteúdo

- Nome de arquivo de espetáculo: sempre em kebab-case.
- Páginas de espetáculo por ano: espetaculos/AAAA/nome-do-espetaculo.html.
- Imagens de espetáculo: espetaculos/AAAA/img/.
- Texto em português brasileiro.
- Links externos com target _blank e rel noopener noreferrer quando aplicável.

## Publicação e manutenção

Como é um site estático, as alterações são feitas diretamente nos arquivos HTML, CSS e JS do repositório.

Checklist mínimo antes de publicar:
- Ortografia e nomes próprios conferidos.
- Links funcionando.
- Imagens carregando corretamente.
- Ordem dos apoiadores correta.
- Layout aceitável em desktop e mobile.

### Validação técnica rápida

Antes de publicar, execute no PowerShell dentro da raiz do projeto:

```powershell
./ferramentas/scripts/validar-site.ps1
```

O script valida os principais pontos críticos:
- Links externos com `target="_blank"` sem `rel="noopener noreferrer"`.
- Estrutura com `<div id="footer"></div>` fora do `<body>`.
- Páginas públicas sem `meta description`, `canonical` ou `h1`.
- Presença de barra invertida no `sitemap.xml`.

### Rotina contínua de performance

Para manter o site saudável ao longo do tempo, execute também:

```powershell
./ferramentas/scripts/auditar-performance.ps1
```

Esse script gera o relatório em `ferramentas/relatorios/relatorio-performance.md` com:
- Imagens mais pesadas do repositório.
- Imagens acima do limite de alerta.
- Possíveis assets órfãos sem referência estática.
- Checklist de revisão manual de Core Web Vitals.

### Verificações complementares

Scripts adicionais disponíveis em `ferramentas/scripts/`:

- `./ferramentas/scripts/verificar-links.ps1`: encontra links internos quebrados e âncoras sem `id` correspondente.
- `./ferramentas/scripts/verificar-seo-basico.ps1`: valida `title`, `meta description`, `canonical`, `h1` e presença em `sitemap.xml`.
- `./ferramentas/scripts/verificar-acessibilidade.ps1`: checa pontos básicos de acessibilidade (lang, alt, labels e nome acessível).
- `./ferramentas/scripts/verificar-assets-referenciados.ps1`: detecta referências para assets inexistentes e possíveis órfãos.
- `./ferramentas/scripts/verificar-ortografia.ps1`: roda corretor ortográfico com foco em pt-BR apenas nos arquivos HTML, gera `ferramentas/relatorios/relatorio-ortografia.md` e aceita termos personalizados em `ferramentas/scripts/verificar-ortografia.ignore.txt`. Em Windows com bloqueio de `ExecutionPolicy`, prefira `./ferramentas/scripts/verificar-ortografia.cmd`.

O processo completo está documentado em `ferramentas/relatorios/performance-routine.md`.

### Ciclo de governança

Antes de publicar páginas novas ou atualizar páginas em cartaz, adote este fluxo:

1. Revisão técnica.
2. Revisão editorial.
3. Revisão de acessibilidade.

O checklist detalhado está em `ferramentas/relatorios/review-cycle.md`.

## Contato e contexto

Projeto mantido pelo grupo A.E.C.A com foco em memória, circulação e formação teatral em Itajaí. Contato: https://www.instagram.com/direct/t/119143752809428
