# Rotina continua de performance

Esta rotina transforma performance em processo recorrente, nao em correcao eventual antes de publicar.

## Frequencia recomendada

- Antes de cada publicacao: executar a validacao tecnica e a auditoria de performance.
- Semanalmente durante periodos de campanha: revisar paginas de maior conversao e ingresso.
- Mensalmente: revisar imagens pesadas, ativos orfaos e historico de Core Web Vitals.

## Comandos da rotina

Na raiz do projeto, execute:

```powershell
./ferramentas/scripts/validar-site.ps1
./ferramentas/scripts/auditar-performance.ps1
./ferramentas/scripts/verificar-links.ps1
./ferramentas/scripts/verificar-seo-basico.ps1
./ferramentas/scripts/verificar-assets-referenciados.ps1
```

O segundo comando gera o relatorio [ferramentas/relatorios/relatorio-performance.md](ferramentas/relatorios/relatorio-performance.md) com:

- ranking das imagens mais pesadas;
- imagens acima do limite configurado;
- lista de possiveis assets orfaos;
- checklist para revisar Core Web Vitals.

## Auditoria de imagens

Objetivo: impedir que novas imagens grandes degradem o carregamento das paginas.

Acao esperada quando o relatorio apontar arquivos pesados:

1. Redimensionar o arquivo para o tamanho maximo realmente usado no layout.
2. Preferir WebP ou AVIF quando a qualidade final permanecer aceitavel.
3. Evitar substituir uma imagem otimizada por exportacao original de camera ou design.
4. Revalidar as paginas mais afetadas apos a troca.

## Revisao de Core Web Vitals

Os indicadores reais precisam ser verificados fora do repositorio, principalmente em:

- PageSpeed Insights;
- Google Search Console;
- CrUX, quando houver volume suficiente.

Paginas minimas por rodada:

- pagina inicial;
- acervo de espetaculos;
- cada pagina em cartaz com CTA de ingresso.

Registrar por pagina:

- data da medicao;
- LCP e elemento responsavel;
- INP e interacao mais lenta;
- CLS e componente com instabilidade;
- correcao priorizada e prazo.

## Limpeza de assets orfaos

O relatorio lista possiveis assets sem referencia estatica. Essa lista deve ser tratada com cuidado, porque alguns arquivos podem ser usados de forma indireta.

Antes de excluir qualquer item:

1. Confirmar que nao ha uso em HTML, CSS, JS e documentos auxiliares.
2. Verificar se o asset nao e referenciado manualmente por campanhas externas.
3. Validar se nao existe uso futuro planejado para uma temporada ja anunciada.
4. Excluir em lote pequeno e revisar visualmente as paginas afetadas.

## Criterio de sucesso da rotina

- novas paginas entram sem regressao evidente de peso visual;
- imagens pesadas deixam de se acumular entre publicacoes;
- o site mantem revisao recorrente de LCP, INP e CLS;
- assets sem uso deixam de crescer de forma descontrolada.
