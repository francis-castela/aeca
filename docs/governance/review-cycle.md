# Ciclo de governanca

O objetivo deste ciclo e reduzir retrabalho, evitar regressao silenciosa e separar claramente o que e revisao tecnica, editorial e de acessibilidade.

## Quando aplicar

- Sempre antes de publicar uma pagina nova.
- Sempre antes de atualizar paginas de espetaculos em cartaz.
- Em revisoes mensais do acervo e da home.

## Ordem de revisao

1. Revisao tecnica
2. Revisao editorial
3. Revisao de acessibilidade

Se a etapa tecnica falhar, as proximas nao devem ser consideradas concluidas.

## Revisao tecnica

Objetivo: garantir que a entrega esteja integra, segura e consistente.

Checklist:

- Executar `./scripts/validate-site.ps1`.
- Executar `./scripts/audit-performance.ps1`.
- Conferir links internos, externos e CTAs principais.
- Confirmar canonical, meta description e h1 nas paginas publicas.
- Verificar estrutura de imagens, carregamento e ausencia de assets quebrados.
- Revisar se houve impacto de layout em desktop e mobile.

## Revisao editorial

Objetivo: garantir clareza, atualizacao e consistencia da comunicacao.

Checklist:

- Conferir ortografia, nomes proprios, datas, horarios e locais.
- Validar precos, lotes, sessoes, classificacao e status de venda.
- Revisar coerencia entre titulo da pagina, chamada principal e CTA.
- Evitar duplicacao de texto ou bloco desatualizado de campanha antiga.
- Garantir que o tom institucional esteja alinhado com o restante do site.

## Revisao de acessibilidade

Objetivo: reduzir barreiras de uso e melhorar robustez sem depender de percepcao visual apenas.

Checklist:

- Confirmar hierarquia semantica de headings.
- Verificar textos alternativos em imagens relevantes.
- Validar contraste em botoes, links e textos pequenos.
- Testar navegacao por teclado em menu, CTA, spoiler e modal.
- Conferir foco visivel em elementos interativos.
- Revisar tabelas, listas e detalhes expansivos para leitura coerente.

## Registro minimo por publicacao

Cada publicacao ou rodada de manutencao deve registrar, ao menos internamente:

- data;
- paginas afetadas;
- responsavel pela revisao tecnica;
- responsavel pela revisao editorial;
- responsavel pela revisao de acessibilidade;
- pendencias aceitas para rodada futura.

## Criterio para publicar

Publicar apenas quando:

- nao houver falhas tecnicas criticas;
- conteudo estiver atualizado e coerente;
- nao existir barreira de acessibilidade evidente nas interacoes principais.
