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
