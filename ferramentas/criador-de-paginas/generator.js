const path = require('node:path');
const fs = require('node:fs');

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

function embedLocalImages(markup, root) {
  const siteRoot = path.resolve(root);
  return String(markup ?? '').replace(/src="(\/[^"\s]+)"/gi, (match, publicPath) => {
    let assetPath;
    try { assetPath = path.resolve(siteRoot, ...publicPath.slice(1).split('/').map(decodeURIComponent)); } catch { return match; }
    if (!assetPath.startsWith(siteRoot + path.sep) || !fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) return match;
    const mime = ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' })[path.extname(assetPath).toLowerCase()] || 'application/octet-stream';
    return `src="data:${mime};base64,${fs.readFileSync(assetPath).toString('base64')}"`;
  });
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

function safeContentUrl(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  if (/^#[a-zA-Z0-9_.:-]+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..') && !/[\r\n"<>]/.test(trimmed)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function safeVideoUrl(value) {
  const url = safeContentUrl(value);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (!['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'].includes(parsed.hostname)) return '';
    return /^\/(embed|video)\/[a-zA-Z0-9_-]+$/.test(parsed.pathname) ? parsed.href : '';
  } catch {
    return '';
  }
}

function renderInlineText(value) {
  const text = String(value ?? '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
      const href = safeContentUrl(url);
      return href ? `<a href="${href}">${label}</a>` : label;
    })
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>');
  const pattern = /<\/?(?:b|i|u|s|del|strong|em|ul|ol|li)\s*>|<a\s+href\s*=\s*(?:"([^"]*)"|'([^']*)')\s*>|<\/a>/gi;
  const tagNames = { b: 'b', strong: 'b', i: 'i', em: 'i', u: 'u', s: 'del', del: 'del', ul: 'ul', ol: 'ol', li: 'li' };
  let output = '';
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text))) {
    output += escapeHtml(text.slice(cursor, match.index));
    if (/^<a\s/i.test(match[0])) {
      const href = safeContentUrl(match[1] ?? match[2]);
      if (href) output += `<a href="${escapeHtml(href)}">`;
    } else if (/^<\/a/i.test(match[0])) output += '</a>';
    else {
      const name = match[0].match(/^<\/?([a-z]+)/i)?.[1]?.toLowerCase();
      const safeName = tagNames[name];
      if (safeName) output += match[0].startsWith('</') ? `</${safeName}>` : `<${safeName}>`;
    }
    cursor = pattern.lastIndex;
  }
  return (output + escapeHtml(text.slice(cursor))).replace(/\r?\n/g, '<br>');
}

function safeClassNames(value, fallback = '') {
  const classes = String(value ?? '').split(/\s+/).filter(name => /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name));
  return classes.length ? classes.join(' ') : fallback;
}

function renderBlocks(blocks) {
  return (Array.isArray(blocks) ? blocks : []).map(block => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'heading') {
      const level = Math.min(6, Math.max(2, Number(block.level) || 2));
      return `<h${level}>${escapeHtml(block.text)}</h${level}>`;
    }
    if (block.type === 'paragraph') {
      const text = renderInlineText(block.text);
      if (!text.trim()) return '<p><br></p>';
      const className = safeClassNames(block.className, '');
      return text.split(/(<(?:ul|ol)>[\s\S]*?<\/(?:ul|ol)>)/gi).map(part => {
        if (!part) return '';
        return /^<(?:ul|ol)>/i.test(part) ? part : part.trim() ? `<p${className ? ` class="${escapeHtml(className)}"` : ''}>${part}</p>` : '';
      }).filter(Boolean).join('\n');
    }
    if (block.type === 'infobox') {
      const poster = block.poster?.src ? `<figure class="show-infobox-poster"><img src="${escapeHtml(imagePath(block.poster.src))}" alt="${escapeHtml(block.poster.alt || '')}">${block.poster.caption ? `<figcaption>${escapeHtml(block.poster.caption)}</figcaption>` : ''}</figure>` : '';
      const rows = (Array.isArray(block.rows) ? block.rows : []).map(row => `<tr><th scope="row">${escapeHtml(row.label)}</th><td>${renderInlineText(row.value)}</td></tr>`).join('');
      return `<section class="show-infobox" aria-label="${escapeHtml(block.label || 'Informações da página')}">${poster}${rows ? `<table class="show-infobox-meta"><tbody>${rows}</tbody></table>` : ''}</section>`;
    }
    if (block.type === 'quote') return `<blockquote><p>${escapeHtml(block.text)}</p>${block.cite ? `<cite>${escapeHtml(block.cite)}</cite>` : ''}</blockquote>`;
    if (block.type === 'details') return `<details><summary>${escapeHtml(block.summary || 'Mais informações')}</summary>${renderRichText(block.text)}</details>`;
    if (block.type === 'video') {
      const src = safeVideoUrl(block.src);
      return src ? `<div class="video-embed"><iframe src="${escapeHtml(src)}" title="${escapeHtml(block.title || 'Vídeo incorporado')}" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>` : '';
    }
    if (block.type === 'list') {
      const tag = block.ordered ? 'ol' : 'ul';
      const items = (Array.isArray(block.items) ? block.items : []).map(item => {
        const text = typeof item === 'string' ? item : item?.text;
        const href = typeof item === 'object' ? safeContentUrl(item.href) : '';
        const content = href ? `<a href="${escapeHtml(href)}">${renderInlineText(text)}</a>` : renderInlineText(text);
        return `<li>${content || '<br>'}</li>`;
      }).join('');
      const className = safeClassNames(block.className, '');
      return items ? `<${tag}${className ? ` class="${escapeHtml(className)}"` : ''}>${items}</${tag}>` : `<${tag}${className ? ` class="${escapeHtml(className)}"` : ''}><li><br></li></${tag}>`;
    }
    if (block.type === 'supporters') {
      const items = (Array.isArray(block.items) ? block.items : []).map(item => {
        const name = escapeHtml(item.name || '');
        const category = item.category ? `<span class="apoio-categoria">${escapeHtml(item.category)}</span>` : '';
        const href = safeContentUrl(item.url);
        const content = `${category}<strong>${name}</strong>`;
        return name ? `<li>${href ? `<a class="apoio-card apoio-card-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<div class="apoio-card">${content}</div>`}</li>` : '';
      }).filter(Boolean).join('');
      return `<ul class="apoio-grid" aria-label="${escapeHtml(block.label || 'Apoiadores')}">${items}</ul>`;
    }
    if (block.type === 'table') {
      const headers = Array.isArray(block.headers) ? block.headers : [];
      const rows = Array.isArray(block.rows) ? block.rows : [];
      if (!rows.length) return '';
      const head = headers.length ? `<thead><tr>${headers.map(value => `<th scope="col">${escapeHtml(value)}</th>`).join('')}</tr></thead>` : '';
      const body = rows.map(row => `<tr>${(Array.isArray(row) ? row : []).map((value, index) => {
        if (index === 0 && (headers.length || block.rowHeaders)) return `<th scope="row">${renderInlineText(value)}</th>`;
        const label = headers[index] || (block.rowHeaders && index > 0 ? row[0] : '');
        return `<td${label ? ` data-label="${escapeHtml(label)}"` : ''}>${renderInlineText(value)}</td>`;
      }).join('')}</tr>`).join('');
      const className = safeClassNames(block.className, 'tabela-vitrine');
      return `${block.caption ? `<h3>${escapeHtml(block.caption)}</h3>` : ''}<table class="${escapeHtml(className)}">${head}<tbody>${body}</tbody></table>`;
    }
    if (block.type === 'image') {
      const src = String(block.src || '').startsWith('/') ? imagePath(block.src) : safeContentUrl(block.src);
      if (src && !src.startsWith('/') && !/^https?:/i.test(src)) return '';
      const className = safeClassNames(block.className, '');
      const imageClass = safeClassNames(block.imageClassName, '');
      return src ? `<figure${className ? ` class="${escapeHtml(className)}"` : ''}><img${imageClass ? ` class="${escapeHtml(imageClass)}"` : ''} src="${escapeHtml(src)}" alt="${escapeHtml(block.alt || '')}">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ''}</figure>` : '';
    }
    if (block.type === 'gallery') {
      const images = (Array.isArray(block.images) ? block.images : []).map(image => {
        const src = String(image.src || '').startsWith('/') ? imagePath(image.src) : safeContentUrl(image.src);
        if (src && !src.startsWith('/') && !/^https?:/i.test(src)) return '';
        return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(image.alt || '')}">` : '';
      }).filter(Boolean);
      return images.length ? `${block.caption ? `<h3>${escapeHtml(block.caption)}</h3>` : ''}<div class="main-galeria">${images.join('')}</div>` : '';
    }
    if (block.type === 'link') {
      const href = safeContentUrl(block.url);
      return href && block.label ? `<p><a href="${escapeHtml(href)}">${escapeHtml(block.label)}</a></p>` : '';
    }
    if (block.type === 'divider') return '<hr>';
    return '';
  }).filter(Boolean).join('\n');
}

function generatePage({ templateId, template, fields, blocks, slug, pagePath, siteBaseUrl }) {
  const values = { ...fields };
  const title = escapeHtml(values.title);
  const description = escapeHtml(values.description);
  const canonicalUrl = `${siteBaseUrl}/${pagePath.replace(/\\/g, '/')}`;
  const contentImage = (Array.isArray(blocks) ? blocks : []).flatMap(block => block.type === 'gallery' ? block.images || [] : block.type === 'image' ? [block] : block.type === 'infobox' && block.poster ? [block.poster] : []).find(image => String(image.src || '').startsWith('/'))?.src;
  const socialImage = values.socialImage || values.poster || values.portrait || values.image || contentImage;
  const replacements = {
    title,
    description,
    canonicalUrl: escapeHtml(canonicalUrl),
    socialImageUrl: escapeHtml(absoluteImageUrl(socialImage, siteBaseUrl)),
    jsonLd: '',
    subtitle: escapeHtml(values.subtitle),
    subtitleBlock: values.subtitle ? `<h2 class="page-subtitle">${escapeHtml(values.subtitle)}</h2>` : '',
    synopsisHtml: renderRichText(values.synopsis),
    contentHtml: Array.isArray(blocks) ? renderBlocks(blocks) : renderRichText(values.content),
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

module.exports = { escapeHtml, slugify, validateSlug, resolveDestination, renderRichText, renderBlocks, parseRows, imagePath, embedLocalImages, safeHttpUrl, safeVideoUrl, generatePage, destinationPath };
