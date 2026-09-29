const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const generator = require('./generator');

function activate(context) {
  const editCommand = vscode.commands.registerCommand('aeca.criadorDePaginas.editar', () => openExistingPage(context));
  context.subscriptions.push(editCommand);
  const command = vscode.commands.registerCommand('aeca.criadorDePaginas.abrir', async () => {
    const extensionRoot = context.extensionPath;
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.resolve(extensionRoot, '../..');
    if (!fs.existsSync(path.join(workspaceRoot, 'index.html'))) {
      vscode.window.showErrorMessage('Não encontrei a raiz do site AECA. Abra o workspace correto ou verifique a pasta da extensão.');
      return;
    }
    const folderUri = vscode.Uri.file(workspaceRoot);
    const root = workspaceRoot;
    const catalog = JSON.parse(fs.readFileSync(path.join(extensionRoot, 'templates', 'catalog.json'), 'utf8'));
    const panel = vscode.window.createWebviewPanel('aecaPageCreator', 'AECA — Criar página', vscode.ViewColumn.One, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.file(path.join(extensionRoot, 'ui')), vscode.Uri.file(extensionRoot), vscode.Uri.file(root)]
    });
    const previewImageRoot = path.join(extensionRoot, '.preview-images');
    panel.onDidDispose(() => { fs.promises.rm(previewImageRoot, { recursive: true, force: true }).catch(() => undefined); }, undefined, context.subscriptions);
    const siteCssUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(root, 'css', 'styles', 'style.css'))).toString();
    panel.webview.html = getWebviewHtml(panel.webview, extensionRoot, root, catalog);
    panel.webview.onDidReceiveMessage(async message => {
      try {
        if (message.command === 'pickImages') {
          const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: Boolean(message.multiple),
            openLabel: 'Selecionar imagem(ns)',
            filters: { Imagens: ['webp', 'jpg', 'jpeg', 'png', 'gif', 'svg'] },
            defaultUri: folderUri
          });
          if (!files?.length) return;
          await fs.promises.mkdir(previewImageRoot, { recursive: true });
          const selected = await Promise.all(files.map(async file => {
            const token = `@aeca-image-${crypto.randomUUID()}`;
            const previewPath = path.join(previewImageRoot, `${token}${path.extname(file.fsPath).toLowerCase() || '.img'}`);
            await fs.promises.copyFile(file.fsPath, previewPath);
            return { token, sourcePath: file.fsPath, label: path.basename(file.fsPath), thumbnail: panel.webview.asWebviewUri(vscode.Uri.file(previewPath)).toString() };
          }));
          await panel.webview.postMessage({ command: 'imagesSelected', fieldId: message.fieldId, multiple: Boolean(message.multiple), images: selected.map(({ token, sourcePath, label }) => ({ token, sourcePath, label })) });
          await panel.webview.postMessage({ command: 'imageThumbnailsReady', fieldId: message.fieldId, thumbnails: selected.map(({ token, thumbnail }) => ({ token, thumbnail })) });
          return;
        }
        if (message.command === 'pickDirectory') {
          const directories = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Escolher pasta de destino', defaultUri: folderUri });
          if (!directories?.length) return;
          const relative = path.relative(root, directories[0].fsPath).replace(/\\/g, '/');
          if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) throw new Error('A pasta precisa estar dentro do workspace do site.');
          panel.webview.postMessage({ command: 'directorySelected', directory: relative || '.' });
          return;
        }
        if (message.command === 'editExistingPage') {
          await openExistingPage(context, root, panel);
          return;
        }
        if (message.command === 'createPage') {
          const definition = catalog.templates.find(item => item.id === message.templateId);
          if (!definition) throw new Error('O modelo selecionado não existe.');
          const fields = { ...(message.fields || {}) };
          const title = String(fields.title || '').trim();
          if (!title) throw new Error('Informe o título da página.');
          if (!String(fields.description || '').trim()) throw new Error('Informe a descrição para buscadores.');
          const slug = String(message.slug || generator.slugify(title)).trim();
          generator.validateSlug(slug);
          const relativeDirectory = generator.resolveDestination(message.directory);
          const relativeFile = generator.destinationPath(relativeDirectory, slug);
          const target = path.resolve(root, ...relativeFile.split('/'));
          if (target !== root && !target.startsWith(root + path.sep)) throw new Error('O caminho calculado sai da pasta do site.');
          if (fs.existsSync(target)) throw new Error(`A página já existe e não será sobrescrita: ${relativeFile}`);
          for (const field of definition.fields) {
            const value = fields[field.id];
            if (field.required && !String(value || '').trim()) throw new Error(`Preencha o campo obrigatório: ${field.label}.`);
          }
          const imagePlan = planImageImports(root, definition.id, relativeDirectory, slug, message.imageSources || {});
          for (const item of imagePlan) {
            for (const source of item.sourceEntries) {
              if (source.dataUrl) continue;
              if (!source.sourcePath || !fs.existsSync(source.sourcePath) || !fs.statSync(source.sourcePath).isFile()) throw new Error(`A imagem selecionada não existe mais: ${source.sourcePath || source.label}`);
            }
            fields[item.fieldId] = item.publicPaths.join('\n');
            for (const publicPath of item.publicPaths) {
              const imageTarget = path.resolve(root, ...publicPath.slice(1).split('/'));
              if (fs.existsSync(imageTarget)) throw new Error(`A imagem de destino já existe: ${publicPath}`);
            }
          }
          for (const field of definition.fields.filter(item => item.type === 'image' || item.type === 'imageList')) {
            if (!imagePlan.some(item => item.fieldId === field.id) && fields[field.id]) {
              const existing = String(fields[field.id]).split(/\r?\n/).filter(Boolean).map(generator.imagePath);
              fields[field.id] = existing.join('\n');
            }
          }
          const template = fs.readFileSync(path.join(extensionRoot, 'templates', definition.file), 'utf8');
          const html = generator.generatePage({ templateId: definition.id, template, fields, slug, pagePath: relativeFile, siteBaseUrl: catalog.siteBaseUrl });
          await copyImageImports(imagePlan);
          const imageReferences = [...html.matchAll(/<img\b[^>]*\bsrc="(\/[^"\s]+)"/gi)].map(match => match[1]);
          for (const reference of imageReferences) {
            const imageFile = path.resolve(root, ...reference.slice(1).split('/').map(segment => decodeURIComponent(segment)));
            if (!imageFile.startsWith(root + path.sep) || !fs.existsSync(imageFile) || !fs.statSync(imageFile).isFile()) throw new Error(`A página referencia uma imagem inexistente: ${reference}`);
          }
          await fs.promises.mkdir(path.dirname(target), { recursive: true });
          const handle = await fs.promises.open(target, 'wx');
          try { await handle.writeFile(html, 'utf8'); } finally { await handle.close(); }
          const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
          await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
          panel.webview.postMessage({ command: 'created', path: relativeFile });
          vscode.window.showInformationMessage(`Página criada: ${relativeFile}. Atualize manualmente o índice/listagens e sitemap, se aplicável.`);
        }
        if (message.command === 'previewPage') {
          const definition = catalog.templates.find(item => item.id === message.templateId);
          if (!definition) throw new Error('O modelo selecionado não existe.');
          const fields = { ...(message.fields || {}) };
          const previewSlug = generator.slugify(fields.title || 'preview') || 'preview';
          const relativeDirectory = generator.resolveDestination(message.directory || definition.defaultDirectory.replace('{year}', String(new Date().getFullYear())));
          const imagePlan = planImageImports(root, definition.id, relativeDirectory, previewSlug, message.imageSources || {});
          for (const item of imagePlan) {
            for (const source of item.sourceEntries) if (!source.dataUrl && !source.sourcePath) throw new Error(`Os dados da imagem ${source.label || 'selecionada'} ainda não foram carregados.`);
            fields[item.fieldId] = item.publicPaths.join('\n');
          }
          const template = fs.readFileSync(path.join(extensionRoot, 'templates', definition.file), 'utf8');
          let html = generator.generatePage({ templateId: definition.id, template, fields, slug: previewSlug, pagePath: path.posix.join(relativeDirectory, `${previewSlug}.html`), siteBaseUrl: catalog.siteBaseUrl });
          for (const item of imagePlan) {
            item.publicPaths.forEach((publicPath, index) => {
              const source = item.sourceEntries[index];
              const fallbackExtension = path.extname(source.sourcePath || source.label || '.webp');
              const dataUri = source.dataUrl || (source.sourcePath ? `data:${mimeType(fallbackExtension)};base64,${fs.readFileSync(source.sourcePath).toString('base64')}` : '');
              html = html.split(`src="${publicPath}"`).join(`src="${dataUri}"`);
            });
          }
          let siteCss = fs.readFileSync(path.join(root, 'css', 'styles', 'style.css'), 'utf8');
          const fontPath = path.join(root, 'css', 'fonts', 'Nunito.ttf');
          if (fs.existsSync(fontPath)) siteCss = siteCss.replace(/url\(["']?\/css\/fonts\/Nunito\.ttf["']?\)/gi, `url(data:font/ttf;base64,${fs.readFileSync(fontPath).toString('base64')})`);
          siteCss += '\n.header { position: sticky !important; top: 0 !important; z-index: 1000 !important; }';
          siteCss = siteCss.replace(/<\/style/gi, '<\\/style');
          const headerHtml = embedPreviewImages(fs.readFileSync(path.join(root, 'html', 'cabecalho.html'), 'utf8'), root);
          const footerHtml = embedPreviewImages(fs.readFileSync(path.join(root, 'html', 'footer.html'), 'utf8'), root);
          html = html.replace(/<link[^>]+href="\/css\/styles\/style\.css"[^>]*>/i, `<style>${siteCss}</style>`).replace('<div id="cabecalho"></div>', headerHtml).replace('<div id="footer"></div>', footerHtml).replace(/<script[\s\S]*?<\/script>/gi, '');
          panel.webview.postMessage({ command: 'previewReady', html });
        }
      } catch (error) {
        panel.webview.postMessage({ command: 'error', message: error.message || 'Não foi possível concluir a operação.' });
      }
    }, undefined, context.subscriptions);
  });
  context.subscriptions.push(command);
}

async function openExistingPage(context, knownRoot, panel) {
  const extensionRoot = context.extensionPath;
  const root = knownRoot || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.resolve(extensionRoot, '../..');
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    vscode.window.showErrorMessage('Não encontrei a raiz do site AECA.');
    return;
  }
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    defaultUri: vscode.Uri.file(root),
    openLabel: 'Abrir página para editar',
    filters: { 'Páginas HTML': ['html'] }
  });
  if (!files?.length) return;
  const selected = files[0].fsPath;
  const relative = path.relative(root, selected);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    vscode.window.showErrorMessage('Escolha uma página HTML dentro da pasta do site AECA.');
    return;
  }
  if (panel) {
    const content = await fs.promises.readFile(files[0], 'utf8');
    const templateId = content.includes('show-infobox') ? 'espetaculo' : content.includes('galeria') || content.includes('main-galeria') ? 'galeria' : content.includes('tabela-ficha') ? 'perfil' : 'institucional';
    const imageSources = extractImportedImages(content, root);
    await panel.webview.postMessage({ command: 'pageImported', templateId, path: relative.replace(/\\/g, '/'), content, imageSources });
    return;
  }
  const document = await vscode.workspace.openTextDocument(files[0]);
  await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
}

function extractImportedImages(content, root) {
  const poster = content.match(/<figure[^>]*class="[^"]*show-infobox-poster[^"]*"[^>]*>[\s\S]*?<img\b[^>]*\bsrc="(\/[^"\s]+)"/i)?.[1];
  const galleryBlock = content.match(/<div[^>]*class="[^"]*main-galeria[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '';
  const gallery = [...galleryBlock.matchAll(/<img\b[^>]*\bsrc="(\/[^"\s]+)"/gi)].map(match => match[1]);
  const selected = {};
  if (poster) selected.poster = [{ token: `@imported-${crypto.randomUUID()}`, label: path.basename(poster), sourcePath: path.resolve(root, ...poster.slice(1).split('/')) }];
  if (gallery.length) selected.gallery = gallery.map(image => ({ token: `@imported-${crypto.randomUUID()}`, label: path.basename(image), sourcePath: path.resolve(root, ...image.slice(1).split('/')) }));
  return selected;
}

function imageTargetDirectory(templateId, relativeDirectory) {
  if (templateId === 'perfil' || templateId === 'institucional') return 'css/img';
  return path.posix.join(relativeDirectory || '.', 'img');
}

function imageBaseName(fieldId, slug, index) {
  if (fieldId === 'poster') return `${slug}-cartaz`;
  if (fieldId === 'socialImage') return `${slug}-og`;
  if (fieldId === 'portrait') return `${slug}-retrato`;
  if (fieldId === 'image') return `${slug}-capa`;
  return `${slug}-${index + 1}`;
}

function mimeType(extension) {
  return ({ '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' })[extension.toLowerCase()] || 'application/octet-stream';
}

function embedPreviewImages(markup, root) {
  return markup.replace(/src="(\/[^"]+)"/gi, (match, publicPath) => {
    const assetPath = path.resolve(root, ...publicPath.slice(1).split('/'));
    if (!assetPath.startsWith(root + path.sep) || !fs.existsSync(assetPath)) return match;
    return `src="data:${mimeType(path.extname(assetPath))};base64,${fs.readFileSync(assetPath).toString('base64')}"`;
  });
}

function planImageImports(root, templateId, relativeDirectory, slug, imageSources) {
  return Object.entries(imageSources).filter(([, sources]) => Array.isArray(sources) && sources.length).map(([fieldId, sources]) => {
    const targetDirectory = imageTargetDirectory(templateId, relativeDirectory);
    const sourceEntries = sources.map(source => typeof source === 'string' ? { sourcePath: source, label: path.basename(source) } : source);
    const publicPaths = sourceEntries.map((source, index) => {
      const extension = path.extname(source.sourcePath || source.label || '').toLowerCase() || '.webp';
      const name = imageBaseName(fieldId, slug, index) + extension;
      return '/' + path.posix.join(targetDirectory, name).replace(/\\/g, '/');
    });
    return { fieldId, sourceEntries, publicPaths, targetDirectory, slug, root };
  });
}

async function copyImageImports(imagePlan) {
  for (const item of imagePlan) {
    const targetDirectory = path.resolve(item.root, ...item.targetDirectory.split('/'));
    await fs.promises.mkdir(targetDirectory, { recursive: true });
    for (let index = 0; index < item.sourceEntries.length; index += 1) {
      const source = item.sourceEntries[index];
      const publicPath = item.publicPaths[index];
      const targetPath = path.resolve(item.root, ...publicPath.slice(1).split('/'));
      const sourceData = source.dataUrl ? Buffer.from(source.dataUrl.split(',')[1], 'base64') : null;
      const writeOperation = sourceData ? fs.promises.writeFile(targetPath, sourceData, { flag: 'wx' }) : fs.promises.copyFile(source.sourcePath, targetPath, fs.constants.COPYFILE_EXCL);
      await writeOperation.catch(error => {
        if (error.code === 'EEXIST') throw new Error(`A imagem de destino já existe: ${publicPath}`);
        throw error;
      });
    }
  }
}

function getWebviewHtml(webview, extensionRoot, root, catalog) {
  const uiRoot = path.join(extensionRoot, 'ui');
  const cssUri = webview.asWebviewUri(vscode.Uri.file(path.join(uiRoot, 'style.css')));
  const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(uiRoot, 'app.js')));
  const nonce = crypto.randomBytes(16).toString('base64');
  const safeCatalog = JSON.stringify(catalog).replace(/</g, '\\u003c').replace(/-->/g, '--\\u003e');
  const siteCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(root, 'css', 'styles', 'style.css')));
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; frame-src ${webview.cspSource};"><link rel="stylesheet" href="${cssUri}"><title>Criar página do AECA</title></head>
<body><main class="workspace"><aside class="sidebar"><div class="brand"><span class="brand-mark">A</span><div><strong>AECA</strong><small>Criador de páginas</small></div></div><nav class="steps" aria-label="Etapas da página"><button class="step active" data-section="basicos"><span>1</span>Dados básicos</button><button class="step" data-section="conteudo"><span>2</span>Conteúdo</button><button class="step" data-section="midia"><span>3</span>Mídia</button><button class="step" data-section="publicacao"><span>4</span>Publicação</button></nav><div class="sidebar-bottom"><span class="status-dot"></span>Workspace AECA</div></aside><section class="editor"><header class="editor-header"><div><p class="eyebrow">EDITOR DE PÁGINA</p><h1>Criar página</h1><p id="template-description">Escolha um modelo para começar.</p></div><div class="header-actions"><button type="button" class="secondary" id="preview-button">Pré-visualizar</button><button type="submit" form="page-form" id="create-button">Publicar página</button></div></header><div id="notice" role="status" aria-live="polite"></div><div class="editor-layout"><form id="page-form" novalidate><section class="form-card" data-form-section="basicos"><div class="card-heading"><div><h2>Estrutura da página</h2><p>Defina o modelo e a identificação pública.</p></div></div><label class="field"><span>Modelo de página</span><select id="template" required></select></label><div class="grid"><label class="field"><span>Título</span><input id="title" name="title" required maxlength="120" autocomplete="off"></label><label class="field"><span>Slug / nome do arquivo</span><input id="slug" autocomplete="off" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*"><small>Gerado automaticamente em kebab-case.</small></label></div><label class="field"><span>Pasta de destino</span><div class="inline"><input id="directory" autocomplete="off" required><button type="button" class="secondary" id="browse-directory">Escolher</button></div><small>A página será criada em <strong id="path-preview"></strong></small></label></section><section id="dynamic-fields" class="dynamic-fields"></section><aside class="notice-info"><strong>Antes de publicar:</strong> revise a prévia, confira os caminhos de imagens e atualize manualmente índices e sitemap quando a página precisar aparecer neles.</aside></form><aside class="preview-pane"><div class="preview-toolbar"><strong>Pré-visualização</strong><span id="preview-status">Ainda não gerada</span></div><iframe id="preview-frame" title="Pré-visualização da página" sandbox="allow-same-origin"></iframe></aside></div></section></main><script nonce="${nonce}">window.AECA_TEMPLATES=${safeCatalog};</script><script nonce="${nonce}" src="${scriptUri}"></script></body></html>`;
}

function deactivate() {}
module.exports = { activate, deactivate };
