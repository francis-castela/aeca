const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const generator = require('../generator');

test('slugifica acentos e pontuação em kebab-case', () => {
  assert.equal(generator.slugify('Coração, Selvagem!'), 'coracao-selvagem');
});

test('escapa conteúdo e produz parágrafos, subtítulos e listas seguras', () => {
  const html = generator.renderRichText('Olá <script>alert(1)</script>\n\n## História\n- primeiro\n- segundo');
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /<h2>História<\/h2>/);
  assert.match(html, /<ul>/);
});

test('renderiza blocos universais com tabelas, links seguros e galerias', () => {
  const html = generator.generatePage({
    templateId: 'geral',
    template: '<!DOCTYPE html><main><h1>{{title}}</h1>{{contentHtml}}</main>',
    fields: { title: 'Acervo', description: 'Registro' },
    blocks: [
      { type: 'heading', level: 3, text: 'Ficha técnica' },
      { type: 'table', headers: ['Função', 'Responsável'], rows: [['Direção', 'Nome'], ['Luz e som', 'Outra pessoa']] },
      { type: 'infobox', label: 'Informações do espetáculo', poster: { src: '/espetaculos/2026/img/cartaz.webp', alt: 'Cartaz', caption: 'Cartaz do espetáculo' }, rows: [{ label: 'Local', value: '<a href="https://example.org/">Teatro</a>' }] },
      { type: 'table', className: 'tabela-vitrine tabela-elenco', headers: ['Personagem', 'Ator / Atriz'], rows: [['Corujinha', 'Ágatha Batista']] },
      { type: 'list', className: 'apoio-grid', items: ['Fundação Cultural'] },
      { type: 'supporters', label: 'Apoiadores do espetáculo', items: [{ category: 'Institucional', name: 'Prefeitura de Itajaí', url: 'https://itajai.sc.gov.br/' }] },
      { type: 'list', items: ['[Prefeitura](https://itajai.sc.gov.br/)', 'Fundação Cultural'] },
      { type: 'paragraph', text: 'Texto <script> sem HTML executável. <b>Importante</b>, <i>ênfase</i>, <u>sublinhado</u> e <a href="https://example.org/">link</a>.' },
      { type: 'paragraph', text: 'Antes<ul><li>item com marcador</li></ul>entre<ol><li>item numerado</li></ol>depois' },
        { type: 'image', src: '/espetaculos/2026/img/elenco.webp', alt: 'Elenco', imageClassName: 'elenco-foto' },
        { type: 'gallery', caption: 'Fotos', images: [{ src: '/espetaculos/2026/img/foto.webp', alt: 'Cena' }] }
    ],
    slug: 'acervo',
    pagePath: 'acervo.html',
    siteBaseUrl: 'https://aeca.com.br'
  });
  assert.match(html, /<th scope="col">Função<\/th>/);
  assert.match(html, /<section class="show-infobox" aria-label="Informações do espetáculo">/);
  assert.match(html, /<figure class="show-infobox-poster">/);
  assert.match(html, /<table class="tabela-vitrine tabela-elenco">/);
  assert.match(html, /<ul class="apoio-grid">/);
  assert.match(html, /<ul class="apoio-grid" aria-label="Apoiadores do espetáculo"><li><a class="apoio-card apoio-card-link" href="https:\/\/itajai\.sc\.gov\.br\/" target="_blank" rel="noopener noreferrer"><span class="apoio-categoria">Institucional<\/span><strong>Prefeitura de Itajaí<\/strong><\/a><\/li><\/ul>/);
  assert.match(html, /<td data-label="Responsável">Outra pessoa<\/td>/);
  assert.match(html, /href="https:\/\/itajai\.sc\.gov\.br\/"/);
  assert.match(html, /<b>Importante<\/b>/);
  assert.match(html, /<i>ênfase<\/i>/);
  assert.match(html, /<u>sublinhado<\/u>/);
  assert.match(html, /<a href="https:\/\/example\.org\/">link<\/a>/);
  assert.match(html, /<p>Antes<\/p>\n<ul><li>item com marcador<\/li><\/ul>\n<p>entre<\/p>\n<ol><li>item numerado<\/li><\/ol>\n<p>depois<\/p>/);
  assert.match(html, /<img class="elenco-foto" src="\/espetaculos\/2026\/img\/elenco\.webp" alt="Elenco">/);
  assert.match(html, /<div class="main-galeria"><img src="\/espetaculos\/2026\/img\/foto\.webp" alt="Cena"><\/div>/);
  assert.match(html, /class="main-galeria"/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script> sem HTML/);
});

test('preserva conteúdo expansível e aceita apenas vídeos incorporados confiáveis', () => {
  const html = generator.renderBlocks([
    { type: 'table', rowHeaders: true, rows: [['Apresentações', '27/06 - Sábado - 16:00\n28/06 - Domingo - 16:00'], ['Obra', '<b>Título</b>'], ['Nota', '<script>alert(1)</script>']] },
    { type: 'list', ordered: false, items: ['<b>Item formatado</b>'] },
    { type: 'list', ordered: true, items: ['Etapa numerada'] },
    { type: 'details', summary: 'Lotes', text: 'Informações adicionais.' },
    { type: 'video', title: 'Documentário', src: 'https://www.youtube.com/embed/abc123?si=token' },
    { type: 'video', title: 'Inseguro', src: 'https://example.org/embed/video' }
  ]);
  assert.match(html, /<th scope="row">Apresentações<\/th>/);
  assert.match(html, /<td data-label="Apresentações">27\/06 - Sábado - 16:00<br>28\/06 - Domingo - 16:00<\/td>/);
  assert.match(html, /<ul><li><b>Item formatado<\/b><\/li><\/ul>/);
  assert.match(html, /<ol><li>Etapa numerada<\/li><\/ol>/);
  assert.match(html, /<td data-label="Obra"><b>Título<\/b><\/td>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /<details><summary>Lotes<\/summary>/);
  assert.match(html, /youtube\.com\/embed\/abc123/);
  assert.doesNotMatch(html, /example\.org/);
});

test('mantém parágrafo e lista vazios visíveis para edição no canvas', () => {
  const html = generator.renderBlocks([{ type: 'paragraph', text: '' }, { type: 'list', items: [] }]);
  assert.match(html, /<p><br><\/p>/);
  assert.match(html, /<ul><li><br><\/li><\/ul>/);
});

test('renderiza bloco de imagem com tamanho, alinhamento e proporção de corte seguros', () => {
  const html = generator.renderBlocks([
    {
      type: 'image',
      src: '/espetaculos/2026/img/cena.webp',
      alt: 'Cena do espetáculo',
      caption: 'Foto de ensaio',
      width: '50%',
      align: 'center',
      aspectRatio: '16/9',
      objectPosition: 'top'
    }
  ]);
  assert.match(html, /<figure style="max-width:50%;width:100%;margin-left:auto;margin-right:auto;text-align:center">/);
  assert.match(html, /<img style="aspect-ratio:16\/9;object-fit:cover;object-position:top" src="\/espetaculos\/2026\/img\/cena\.webp" alt="Cena do espetáculo">/);
  assert.match(html, /<figcaption>Foto de ensaio<\/figcaption>/);
});

test('renderiza bloco infobox lateral com ou sem poster e com linhas flexíveis', () => {
  const htmlWithPoster = generator.renderBlocks([
    {
      type: 'infobox',
      label: 'Ficha da peça',
      poster: { src: '/espetaculos/2026/img/cartaz.webp', alt: 'Cartaz', caption: 'Cartaz oficial' },
      rows: [
        { label: 'Estreia', value: '2026' },
        ['Local', 'Teatro Municipal'],
        { label: 'Apresentações', value: '11/07 - Sábado - 20:00\n12/07 - Domingo - 20:00<br>18/07 - Sábado - 20:00' }
      ]
    }
  ]);
  assert.match(htmlWithPoster, /<section class="show-infobox" aria-label="Ficha da peça">/);
  assert.match(htmlWithPoster, /<figure class="show-infobox-poster"><img src="\/espetaculos\/2026\/img\/cartaz\.webp" alt="Cartaz"><figcaption>Cartaz oficial<\/figcaption><\/figure>/);
  assert.match(htmlWithPoster, /<th scope="row">Estreia<\/th><td>2026<\/td>/);
  assert.match(htmlWithPoster, /<th scope="row">Local<\/th><td>Teatro Municipal<\/td>/);
  assert.match(htmlWithPoster, /<th scope="row">Apresentações<\/th><td>11\/07 - Sábado - 20:00<br>12\/07 - Domingo - 20:00<br>18\/07 - Sábado - 20:00<\/td>/);

  const htmlWithoutPoster = generator.renderBlocks([
    {
      type: 'infobox',
      rows: [{ label: 'Classificação', value: 'Livre' }]
    }
  ]);
  assert.match(htmlWithoutPoster, /<section class="show-infobox"/);
  assert.doesNotMatch(htmlWithoutPoster, /<figure class="show-infobox-poster">/);
  assert.match(htmlWithoutPoster, /<th scope="row">Classificação<\/th><td>Livre<\/td>/);
});

test('renderiza tachado e alinhamento de texto em parágrafos e títulos', () => {
  const html = generator.renderBlocks([
    {
      type: 'heading',
      level: 2,
      text: 'Título Central',
      align: 'center'
    },
    {
      type: 'paragraph',
      text: 'Texto com <s>tachado</s> e <del>deletado</del> e ~~markdown~~.',
      align: 'right'
    }
  ]);
  assert.match(html, /<h2 style="text-align:center">Título Central<\/h2>/);
  assert.match(html, /<p style="text-align:right">Texto com <del>tachado<\/del> e <del>deletado<\/del> e <del>markdown<\/del>\.<\/p>/);
});

test('renderiza botão de ingressos, botão de WhatsApp, tabela de lotes e classificação indicativa', () => {
  const html = generator.renderBlocks([
    {
      type: 'ticketButton',
      url: 'https://www.sympla.com.br/evento/ainda-me-lembro-de-voce/3360195',
      title: 'Comprar ingresso agora',
      subtitle: 'Pagamento seguro via Sympla'
    },
    {
      type: 'ticketLots',
      notice: '<b>MEIA ENTRADA</b> válida para beneficiados.',
      lots: [
        { name: '1º LOTE', dates: 'até XX/XX', inteira: 'R$ 30,00', inteiraTaxa: '+ R$ 3,99 taxa', meia: 'R$ 15,00', meiaTaxa: '+ R$ 3,99 taxa' }
      ],
      infoSummary: 'Entenda como funcionam os lotes',
      infoItems: ['Quanto antes você compra, menor é o valor do ingresso.']
    },
    {
      type: 'whatsapp',
      url: 'https://wa.me/5547997085692',
      intro: 'Dúvidas? Entre em contato com Francis via WhatsApp:',
      label: 'SUPORTE VIA WHATSAPP'
    },
    {
      type: 'classification',
      title: 'Autoclassificação indicativa',
      rating: '14',
      description: 'Não recomendado para menores de 14 anos.',
      details: 'Contém: violência, sangue, sofrimento.'
    }
  ]);
  assert.match(html, /class="btn-cta-sympla btn-cta-ticket"/);
  assert.match(html, /<span class="cta-titulo">Comprar ingresso agora<\/span>/);
  assert.match(html, /class="lotes-secao"/);
  assert.match(html, /<th scope="row">1º LOTE<br><span class="lote-vigencia">26\/04 a 16\/05\/2026<\/span><\/th>/);
  assert.match(html, /class="btn-cta-whatsapp"/);
  assert.match(html, /SUPORTE VIA WHATSAPP/);
  assert.match(html, /class="classificacao-box"/);
  assert.match(html, /\/css\/classificacao\/classificacao-14\.png/);
  assert.match(html, /Não recomendado para menores de 14 anos\./);
});

test('renderiza corretamente cada faixa etária de classificação indicativa', () => {
  ['livre', '6', '10', '12', '14', '16', '18'].forEach(rating => {
    const html = generator.renderBlocks([
      {
        type: 'classification',
        rating
      }
    ]);
    assert.match(html, new RegExp(`/css/classificacao/classificacao-${rating}\\.png`));
  });
});

test('embute imagens do site na prévia e rejeita caminhos fora da raiz', () => {
  const root = path.resolve(__dirname, '../../..');
  const html = generator.embedLocalImages('<img src="/css/logos/favicon.webp">', root);
  assert.match(html, /^<img src="data:image\/webp;base64,[A-Za-z0-9+/]+=*">$/);
  assert.equal(generator.embedLocalImages('<img src="/../../package.json">', root), '<img src="/../../package.json">');
});

test('rejeita slug e caminho de destino fora das regras', () => {
  assert.throws(() => generator.validateSlug('../fora'), /slug/i);
  assert.throws(() => generator.resolveDestination('..\\fora'), /destino/i);
});

test('só permite URLs HTTP e HTTPS', () => {
  assert.equal(generator.safeHttpUrl('https://example.org/inscricao', 'Link'), 'https://example.org/inscricao');
  assert.throws(() => generator.safeHttpUrl('javascript:alert(1)', 'Link'), /https/i);
});

test('monta HTML de espetáculo com metadados e componentes de galeria', () => {
  const html = generator.generatePage({
    templateId: 'espetaculo',
    template: '<!DOCTYPE html><main><h1>{{title}}</h1>{{synopsisHtml}}{{galleryBlock}}<script type="application/ld+json">{{jsonLd}}</script></main>',
    fields: { title: 'Peça <Nova>', description: 'Resumo & detalhe', synopsis: 'Uma história.', poster: '/espetaculos/2026/img/cartaz.webp', gallery: '/espetaculos/2026/img/foto.webp', year: '2026' },
    slug: 'peca-nova',
    pagePath: 'espetaculos/2026/peca-nova.html',
    siteBaseUrl: 'https://aeca.com.br'
  });
  assert.match(html, /Peça &lt;Nova&gt;/);
  assert.match(html, /https:\/\/aeca\.com\.br\/espetaculos\/2026\/peca-nova\.html/);
  assert.match(html, /class="main-galeria"/);
  const jsonLd = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)?.[1];
  assert.equal(JSON.parse(jsonLd).name, 'Peça <Nova>');
  assert.doesNotMatch(html, /\{\{\w+\}\}/);
});
