const test = require('node:test');
const assert = require('node:assert/strict');
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
    template: '<title>{{title}}</title>{{synopsisHtml}}{{galleryBlock}}<script type="application/ld+json">{{jsonLd}}</script>',
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
