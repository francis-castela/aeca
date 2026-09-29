const path = require('node:path');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function slugify(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function validateSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error('O slug deve usar apenas letras sem acento, números e hífens, sem hífen no início ou no fim.');
  }
}

function resolveDestination(directory) {
  const normalized = String(directory ?? '').trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return '';
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.split('/').some(part => part === '..' || part === '.')) {
    throw new Error('O destino deve ser uma pasta relativa dentro do workspace e não pode conter segmentos . ou ...');
  }
  if (!/^[\p{L}\p{N} _.-]+(?:\/[\p{L}\p{N} _.-]+)*$/u.test(normalized)) {
    throw new Error('O destino contém caracteres inválidos.');
  }
  return normalized;
}

function renderRichText(text) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let paragraph = [];
  let list = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push(`<p>${paragraph.map(escapeHtml).join('<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(`<ul>${list.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`);
    list = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { flushParagraph(); flushList(); continue; }
    const heading = trimmed.match(/^##\s+(.+)$/);
    const item = trimmed.match(/^-\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      blocks.push(`<h2>${escapeHtml(heading[1])}</h2><hr>`);
    } else if (item) {
      flushParagraph(); list.push(item[1]);
    } else {
      flushList(); paragraph.push(trimmed);
    }
  }
  flushParagraph(); flushList();
  return blocks.join('\n');
}

function parseRows(value, separator = '|') {
  return String(value ?? '').split(/\r?\n/).map(row => row.trim()).filter(Boolean).map(row => {
    const parts = row.split(separator).map(part => part.trim());
    return [parts[0] || '', parts.slice(1).join(separator).trim()];
  }).filter(([first, second]) => first && second);
}

function imagePath(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('..') || /[\r\n"<>]/.test(trimmed)) {
    throw new Error(`Caminho de imagem inválido: ${trimmed}`);
  }
  return trimmed;
}

function absoluteImageUrl(value, baseUrl) {
  const image = imagePath(value);
  return image ? `${baseUrl}${image}` : `${baseUrl}/css/logos/logo-AECA-preto.png`;
}

      function safeHttpUrl(value, label) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  let parsed;
  try { parsed = new URL(trimmed); } catch { throw new Error(`${label} deve ser uma URL válida iniciada por https:// ou http://.`); }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error(`${label} deve usar o protocolo https:// ou http://.`);
  return parsed.href;
}

function tableBlock(title, className, firstHeading, secondHeading, rows) {
  if (!rows.length) return '';
  const body = rows.map(([left, right]) => `<tr><th scope="row">${escapeHtml(left)}</th><td data-label="${escapeHtml(secondHeading)}">${escapeHtml(right)}</td></tr>`).join('\n');
  return `<h3>${escapeHtml(title)}</h3>\n<hr>\n<table class="tabela-vitrine ${className}"><thead><tr><th scope="col">${escapeHtml(firstHeading)}</th><th scope="col">${escapeHtml(secondHeading)}</th></tr></thead><tbody>${body}</tbody></table>`;
}

function generatePage({ templateId, template, fields, slug, pagePath, siteBaseUrl }) {
  const values = { ...fields };
  const title = escapeHtml(values.title);
  const description = escapeHtml(values.description);
  const canonicalUrl = `${siteBaseUrl}/${pagePath.replace(/\\/g, '/')}`;
  const socialImage = values.socialImage || values.poster || values.portrait || values.image;
  const replacements = {
    title,
    description,
    canonicalUrl: escapeHtml(canonicalUrl),
    socialImageUrl: escapeHtml(absoluteImageUrl(socialImage, siteBaseUrl)),
    jsonLd: '',
    subtitle: escapeHtml(values.subtitle),
    subtitleBlock: values.subtitle ? `<h2 class="page-subtitle">${escapeHtml(values.subtitle)}</h2>` : '',
    synopsisHtml: renderRichText(values.synopsis),
    contentHtml: renderRichText(values.content),
    biographyHtml: renderRichText(values.biography),
    poster: escapeHtml(imagePath(values.poster)),
    portrait: escapeHtml(imagePath(values.portrait)),
    imageBlock: values.image ? `<figure><img src="${escapeHtml(imagePath(values.image))}" alt="${title}"></figure>` : '',
    roleBlock: values.role ? `<p class="page-subtitle">${escapeHtml(values.role)}</p>` : '',
    showDetailsRows: '',
    ticketBlock: '',
    castBlock: '',
    crewBlock: '',
    galleryBlock: '',
    timelineBlock: '',
    groupsHtml: '',
    eventDetails: '',
    registrationBlock: '',
    faqBlock: ''
  };

  if (templateId === 'espetaculo') {
    const mapUrl = safeHttpUrl(values.mapUrl, 'Link do mapa');
    const ticketUrl = safeHttpUrl(values.ticketUrl, 'Link de ingressos');
    const rows = [];
    if (values.sessions) rows.push(['Apresentações', String(values.sessions).split(/\r?\n/).map(escapeHtml).join('<br>')]);
    if (values.venue) rows.push(['Local', `${mapUrl ? `<a class="show-infobox-location-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(values.venue)}</a>` : escapeHtml(values.venue)}${values.address ? `<br><span>${escapeHtml(values.address)}</span>` : ''}`]);
    if (values.work) rows.push(['Obra', escapeHtml(values.work)]);
    if (values.author) rows.push(['Autor(es)', escapeHtml(values.author)]);
    if (values.year) rows.push(['Ano', escapeHtml(values.year)]);
    replacements.showDetailsRows = rows.map(([key, value]) => `<tr><th scope="row">${key}</th><td>${value}</td></tr>`).join('\n');
    if (values.status === 'divulgacao' && ticketUrl) replacements.ticketBlock = `<p><a class="btn-cta-whatsapp" href="${escapeHtml(ticketUrl)}" target="_blank" rel="noopener noreferrer">COMPRE SEU INGRESSO</a></p>`;
    replacements.castBlock = tableBlock('Elenco', 'tabela-elenco', 'Personagem', 'Ator / Atriz', parseRows(values.cast));
    replacements.crewBlock = tableBlock('Ficha Técnica', 'tabela-ficha', 'Função', 'Responsável', parseRows(values.crew));
    const images = String(values.gallery ?? '').split(/\r?\n/).map(imagePath).filter(Boolean);
    if (images.length) replacements.galleryBlock = `<h3>Galeria de fotos</h3><hr>${values.photographer ? `<p class="fotografo">Fotografia: ${escapeHtml(values.photographer)}</p>` : ''}<div class="main-galeria">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="Registro fotográfico ${index + 1} do espetáculo ${title}">`).join('\n')}</div>`;
  }

  if (templateId === 'perfil') {
    replacements.timelineBlock = tableBlock('Trajetória', 'tabela-ficha', 'Ano', 'Atividade', parseRows(values.timeline));
    const images = String(values.gallery ?? '').split(/\r?\n/).map(imagePath).filter(Boolean);
    if (images.length) replacements.galleryBlock = `<h3>Galeria de fotos</h3><hr><div class="main-galeria">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="Registro de ${escapeHtml(values.title)} ${index + 1}">`).join('\n')}</div>`;
  }

  if (templateId === 'galeria') {
    replacements.groupsHtml = String(values.groups ?? '').split(/\r?\n/).map(row => {
      const [period, name, imagesText] = row.split('|').map(part => part.trim());
      if (!period || !name || !imagesText) return '';
      const images = imagesText.split(',').map(imagePath).filter(Boolean);
      if (!images.length) return '';
      const anchor = slugify(`${period}-${name}`);
      return `<h3 id="${escapeHtml(anchor)}">${escapeHtml(name)}</h3><h2>${escapeHtml(period)}</h2><hr><div class="main-galeria">${images.map((image, index) => `<img src="${escapeHtml(image)}" alt="Registro ${index + 1} de ${escapeHtml(name)} (${escapeHtml(period)})">`).join('\n')}</div>`;
    }).filter(Boolean).join('\n');
  }

  if (templateId === 'evento') {
    const mapUrl = safeHttpUrl(values.mapUrl, 'Link do mapa');
    const registrationUrl = safeHttpUrl(values.registrationUrl, 'Link de inscrição');
    const detailRows = [];
    if (values.dates) detailRows.push(['Datas e horários', renderRichText(values.dates)]);
    if (values.venue) detailRows.push(['Local', `${escapeHtml(values.venue)}${values.address ? `<br>${escapeHtml(values.address)}` : ''}${mapUrl ? `<br><a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">Ver no mapa</a>` : ''}`]);
    if (values.price) detailRows.push(['Investimento', escapeHtml(values.price)]);
    replacements.eventDetails = detailRows.length ? `<h2>Informações</h2><hr><table><tbody>${detailRows.map(([key, value]) => `<tr><th scope="row">${key}</th><td>${value}</td></tr>`).join('')}</tbody></table>` : '';
    replacements.registrationBlock = registrationUrl ? `<p><a class="btn-cta-whatsapp" href="${escapeHtml(registrationUrl)}" target="_blank" rel="noopener noreferrer">FAÇA SUA INSCRIÇÃO</a></p>` : '';
    const faqs = parseRows(values.faq);
    replacements.faqBlock = faqs.length ? `<h2>Perguntas frequentes</h2><hr>${faqs.map(([question, answer]) => `<section><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></section>`).join('')}` : '';
  }

  replacements.jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: values.title, description: values.description, url: canonicalUrl }).replace(/</g, '\\u003c');
  const output = template.replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (match, key) => Object.hasOwn(replacements, key) ? replacements[key] : '');
  if (output.includes('{{')) throw new Error('O template contém placeholders sem substituição.');
  if (!output.includes('<!DOCTYPE html>') || !output.includes('<main')) throw new Error('O template gerado não contém a estrutura HTML esperada.');
  return output;
}

function destinationPath(directory, slug) {
  const safeDirectory = resolveDestination(directory);
  validateSlug(slug);
  return path.posix.join(safeDirectory, `${slug}.html`);
}

module.exports = { escapeHtml, slugify, validateSlug, resolveDestination, renderRichText, parseRows, imagePath, safeHttpUrl, generatePage, destinationPath };
