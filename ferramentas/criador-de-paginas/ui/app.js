(() => {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
  const catalog = window.AECA_TEMPLATES || { templates: [] };
  const form = document.getElementById('page-form');
  const templateSelect = document.getElementById('template');
  const fieldsContainer = document.getElementById('dynamic-fields');
  const titleInput = document.getElementById('title');
  const slugInput = document.getElementById('slug');
  const directoryInput = document.getElementById('directory');
  const pathPreview = document.getElementById('path-preview');
  const notice = document.getElementById('notice');
  const previewFrame = document.getElementById('preview-frame');
  const previewStatus = document.getElementById('preview-status');
  let activeDefinition;
  let slugWasEdited = false;
  let pendingImageReads = 0;
  let noticeTimer;
  const imageSources = {};
  const byId = id => document.getElementById(id);
  const slugify = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const sidebar = document.querySelector('.sidebar');
  const headerActions = document.querySelector('.header-actions');
  const sidebarBottom = document.querySelector('.sidebar-bottom');
  const editButton = document.createElement('button');
  editButton.type = 'button'; editButton.className = 'secondary'; editButton.textContent = 'Editar existente';
  editButton.addEventListener('click', () => vscode?.postMessage({ command: 'editExistingPage' }));
  headerActions?.prepend(editButton);
  if (sidebar && headerActions && sidebarBottom) {
    const sidebarFooter = document.createElement('div');
    sidebarFooter.className = 'sidebar-footer';
    const steps = document.querySelector('.steps');
    if (steps) { steps.style.marginBottom = '14px'; sidebarFooter.append(steps); }
    sidebarFooter.append(headerActions, sidebarBottom);
    sidebar.append(sidebarFooter);
  }

  const responsiveStyles = document.createElement('style');
  responsiveStyles.textContent = `
    @media (max-width: 900px) {
      .workspace { display: block; }
      .sidebar { position: fixed; inset: auto 0 0; z-index: 20; display: block; width: 100%; height: auto; padding: 8px 12px; border-right: 0; border-top: 1px solid var(--line); }
      .sidebar .brand { display: none; }
      .sidebar-footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "steps actions" "status actions"; align-items: center; gap: 5px 10px; margin: 0; }
      .sidebar-footer .steps { grid-area: steps; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; width: 100%; margin: 0 !important; overflow: visible; }
      .sidebar-footer .step { justify-content: center; gap: 2px; min-width: 0; padding: 5px 3px; font-size: 11px; line-height: 1.15; text-align: center; white-space: normal; }
      .sidebar-footer .step span { width: 20px; height: 20px; }
      .sidebar-footer .header-actions { grid-area: actions; display: grid; gap: 5px; width: 118px; margin: 0; }
      .sidebar-footer .header-actions button { width: 100%; padding: 8px 6px; font-size: 12px; line-height: 1.15; }
      .sidebar-footer .sidebar-bottom { grid-area: status; padding: 0 4px; font-size: 11px; }
      .editor { padding-bottom: 150px; }
      .preview-pane { margin-bottom: 10px; }
      #notice.toast { position: fixed !important; right: 24px; bottom: 86px; z-index: 1000; width: min(420px, calc(100vw - 48px)); margin: 0; box-shadow: 0 12px 30px rgba(36,26,23,.18); }
      #notice.toast.error { border-color: #d48c8c; background: #fff5f3; color: #9b3030; }
      #notice.toast.success { border-color: #8eb99b; background: #f2fbf4; color: #286b45; }
    }
    @media (min-width: 901px) {
      #notice.toast { position: fixed !important; right: 28px; bottom: 28px; z-index: 1000; width: min(420px, calc(100vw - 48px)); margin: 0; box-shadow: 0 12px 30px rgba(36,26,23,.18); }
    }
  `;
  document.head.append(responsiveStyles);

  function showNotice(message, type = '') { clearTimeout(noticeTimer); notice.textContent = message; notice.className = message ? `toast ${type}` : 'toast'; if (message) noticeTimer = setTimeout(() => { notice.textContent = ''; notice.className = 'toast'; }, 5000); }
  function updatePath() { pathPreview.textContent = `${directoryInput.value.trim().replace(/[\\/]+$/, '') || '.'}/${slugInput.value || 'nome-da-pagina'}.html`; }
  function imageDestination() { return ['perfil', 'institucional'].includes(activeDefinition?.id) ? 'css/img' : `${directoryInput.value.trim().replace(/[\\/]+$/, '') || '.'}/img`.replace(/^\.\//, ''); }
  function imageName(fieldId, source, index) {
    const slug = slugInput.value || 'nome-da-pagina';
    const extension = (source.sourcePath || source.label || '').split('.').pop().toLowerCase() || 'webp';
    const base = fieldId === 'poster' ? `${slug}-cartaz` : fieldId === 'socialImage' ? `${slug}-og` : fieldId === 'portrait' ? `${slug}-retrato` : fieldId === 'image' ? `${slug}-capa` : `${slug}-${index + 1}`;
    return `${base}.${extension}`;
  }
  function fieldSection(field) {
    if (['title', 'description', 'year', 'status', 'subtitle', 'role'].includes(field.id)) return 'basicos';
    if (['poster', 'portrait', 'socialImage', 'image', 'gallery', 'groups', 'photographer'].includes(field.id)) return 'midia';
    if (['sessions', 'venue', 'address', 'mapUrl', 'work', 'author', 'ticketUrl', 'dates', 'price', 'registrationUrl'].includes(field.id)) return 'publicacao';
    return 'conteudo';
  }
  function renderImageValue(fieldId) {
    const box = byId(`image-chips-${fieldId}`);
    if (!box) return;
    box.replaceChildren();
    const selected = imageSources[fieldId] || [];
    if (!selected.length) return;
    const table = document.createElement('table'); table.className = 'image-list-table'; table.style.width = '100%'; table.style.borderCollapse = 'collapse';
    table.innerHTML = '<thead><tr><th style="text-align:left;padding:8px 4px">Arquivo selecionado</th><th style="text-align:left;padding:8px 4px">Nome no site</th><th style="text-align:left;padding:8px 4px">Ação</th></tr></thead>';
    const body = document.createElement('tbody');
    selected.forEach((source, index) => {
      const row = document.createElement('tr');
      const original = document.createElement('td'); original.textContent = source.label || 'imagem'; original.style.padding = '8px 4px'; original.style.overflowWrap = 'anywhere';
      const finalName = document.createElement('td'); finalName.textContent = `/${imageDestination()}/${imageName(fieldId, source, index)}`; finalName.style.padding = '8px 4px'; finalName.style.overflowWrap = 'anywhere'; finalName.style.fontFamily = 'monospace';
      const action = document.createElement('td'); action.style.padding = '8px 4px';
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'chip-remove'; remove.textContent = 'Remover'; remove.title = 'Remover imagem'; remove.style.padding = '4px 8px';
      remove.addEventListener('click', () => { imageSources[fieldId] = (imageSources[fieldId] || []).filter(item => item.token !== source.token); const control = byId(`field-${fieldId}`); if (control) control.value = imageSources[fieldId].map(item => item.token).join('\n'); renderImageValue(fieldId); });
      action.append(remove); row.append(original, finalName, action); body.append(row);
    });
    table.append(body); box.append(table);
  }
  function makeField(field) {
    const wrapper = document.createElement(field.type === 'image' || field.type === 'imageList' ? 'div' : 'label'); wrapper.className = `field field-row section-${fieldSection(field)}`;
    const title = document.createElement('span'); title.innerHTML = `${field.label}${field.required ? ' <em>*</em>' : ''}`; wrapper.append(title);
    let control;
    if (field.type === 'textarea' || field.type === 'imageList') { control = document.createElement('textarea'); control.rows = field.rows || 4; }
    else if (field.type === 'select') { control = document.createElement('select'); (field.options || []).forEach(option => { const item = document.createElement('option'); item.value = option.value; item.textContent = option.label; control.append(item); }); }
    else { control = document.createElement('input'); control.type = field.type === 'image' ? 'text' : field.type; }
    control.id = `field-${field.id}`; control.required = Boolean(field.required); control.placeholder = field.placeholder || '';
    if (field.default === 'currentYear') control.value = String(new Date().getFullYear()); else if (field.default) control.value = field.default;
    if (field.type === 'image' || field.type === 'imageList') {
      control.readOnly = true; control.className = 'image-value'; control.hidden = true;
      const picker = document.createElement('div'); picker.className = 'image-picker';
      const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*'; fileInput.multiple = field.type === 'imageList'; fileInput.className = 'image-file-input'; fileInput.style.display = 'block'; fileInput.style.width = '100%'; fileInput.style.padding = '10px'; fileInput.style.border = '1px dashed var(--line)'; fileInput.style.borderRadius = '6px';
      const chips = document.createElement('div'); chips.id = `image-chips-${field.id}`; chips.className = 'image-chips';
      fileInput.addEventListener('change', () => {
        const files = Array.from(fileInput.files || []);
        if (!files.length) return;
        const images = files.map(file => ({ token: `@browser-image-${Date.now()}-${Math.random().toString(16).slice(2)}`, label: file.name, dataUrl: '' }));
        imageSources[field.id] = field.type === 'imageList' ? [...(imageSources[field.id] || []), ...images] : images.slice(0, 1);
        control.value = imageSources[field.id].map(item => item.token).join('\n'); renderImageValue(field.id); showNotice(`${images.length} imagem(ns) selecionada(s).`);
        images.forEach((image, index) => { const file = files[index]; const reader = new FileReader(); pendingImageReads += 1; reader.onload = () => { image.dataUrl = reader.result; pendingImageReads -= 1; }; reader.onerror = () => { pendingImageReads -= 1; showNotice(`Não foi possível carregar ${image.label}.`, 'error'); }; reader.readAsDataURL(file); });
        fileInput.value = '';
      });
      picker.append(fileInput, chips); wrapper.append(control, picker);
    } else wrapper.append(control);
    if (field.min) control.min = field.min; if (field.max) control.max = field.max;
    return wrapper;
  }
  function renderFields(definition) {
    activeDefinition = definition; Object.keys(imageSources).forEach(key => delete imageSources[key]);
    const grouped = ['basicos', 'conteudo', 'midia', 'publicacao'].map(section => ({ section, fields: definition.fields.filter(field => fieldSection(field) === section && field.id !== 'title') })).filter(group => group.fields.length);
    const nodes = [];
    grouped.forEach(group => { if (group.section === 'basicos') { nodes.push(...group.fields.map(makeField)); return; } const heading = document.createElement('div'); heading.className = 'form-section-heading'; heading.dataset.formSection = group.section; heading.innerHTML = `<h2>${group.section === 'conteudo' ? 'Conteúdo' : group.section === 'midia' ? 'Mídia e imagens' : 'Publicação'}</h2><p>Preencha os dados desta etapa para compor a página.</p>`; nodes.push(heading, ...group.fields.map(makeField)); });
    fieldsContainer.replaceChildren(...nodes); directoryInput.value = definition.defaultDirectory.replace('{year}', String(new Date().getFullYear())); byId('template-description').textContent = definition.description; showNotice(''); updatePath(); observeSections();
  }
  function collect() {
    const fields = {}; const selectedImages = {};
    activeDefinition.fields.forEach(field => { const control = field.id === 'title' ? titleInput : byId(`field-${field.id}`); fields[field.id] = control?.value.trim() || ''; if (field.type === 'image' || field.type === 'imageList') selectedImages[field.id] = (imageSources[field.id] || []).map(item => ({ token: item.token, label: item.label, sourcePath: item.sourcePath, dataUrl: item.dataUrl })); });
    return { fields, imageSources: selectedImages, slug: slugInput.value.trim(), directory: directoryInput.value.trim(), templateId: activeDefinition.id };
  }
  function importPage(message) {
    const documentParser = new DOMParser();
    const imported = documentParser.parseFromString(message.content, 'text/html');
    const definition = catalog.templates.find(item => item.id === message.templateId) || catalog.templates[0];
    templateSelect.value = definition.id;
    renderFields(definition);
    const setValue = (fieldId, value) => { const control = fieldId === 'title' ? titleInput : byId(`field-${fieldId}`); if (control && value) control.value = value.trim(); };
    setValue('title', imported.querySelector('main h1')?.textContent || imported.querySelector('h1')?.textContent || '');
    setValue('description', imported.querySelector('meta[name="description"]')?.getAttribute('content') || '');
    setValue('subtitle', imported.querySelector('.page-subtitle')?.textContent || '');
    const synopsis = imported.querySelector('.show-infobox')?.previousElementSibling;
    setValue(definition.id === 'espetaculo' ? 'synopsis' : 'content', synopsis?.tagName === 'P' ? synopsis.textContent : Array.from(imported.querySelectorAll('main > p')).map(item => item.textContent.trim()).filter(Boolean).join('\n\n'));
    const relativePath = message.path.replace(/\\/g, '/');
    const directory = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '.';
    directoryInput.value = directory;
    slugInput.value = relativePath.split('/').pop().replace(/\.html$/i, ''); slugWasEdited = true;
    Object.keys(imageSources).forEach(key => delete imageSources[key]);
    Object.entries(message.imageSources || {}).forEach(([fieldId, sources]) => { imageSources[fieldId] = sources; const control = byId(`field-${fieldId}`); if (control) control.value = sources.map(item => item.token).join('\n'); renderImageValue(fieldId); });
    updatePath(); showNotice(`Página importada: ${message.path}`, 'success');
  }
  function validate(data) { if (!titleInput.value.trim()) return 'Informe o título da página.'; if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) return 'Slug inválido: use letras sem acento, números e hífens.'; if (!data.directory || data.directory.startsWith('/') || data.directory.includes('..')) return 'Informe uma pasta de destino relativa à raiz do site.'; for (const field of activeDefinition.fields) if (field.required && !data.fields[field.id] && !(field.type === 'image' && data.imageSources[field.id]?.length)) return `Preencha o campo obrigatório: ${field.label}.`; return ''; }
  catalog.templates.forEach(definition => { const option = document.createElement('option'); option.value = definition.id; option.textContent = definition.label; templateSelect.append(option); });
  templateSelect.addEventListener('change', () => renderFields(catalog.templates.find(item => item.id === templateSelect.value)));
  function refreshImageCards() { activeDefinition?.fields.filter(field => field.type === 'image' || field.type === 'imageList').forEach(field => renderImageValue(field.id)); }
  titleInput.addEventListener('input', () => { if (!slugWasEdited) slugInput.value = slugify(titleInput.value); updatePath(); refreshImageCards(); }); slugInput.addEventListener('input', () => { slugWasEdited = true; updatePath(); refreshImageCards(); }); directoryInput.addEventListener('input', () => { updatePath(); refreshImageCards(); });
  byId('browse-directory').addEventListener('click', () => vscode?.postMessage({ command: 'pickDirectory' }));
  byId('preview-button').addEventListener('click', () => { if (pendingImageReads > 0) return showNotice('Aguarde o carregamento das imagens selecionadas.', 'error'); const data = collect(); const error = validate(data); if (error) return showNotice(error, 'error'); previewStatus.textContent = 'Gerando…'; vscode?.postMessage({ command: 'previewPage', ...data }); });
  form.addEventListener('submit', event => { event.preventDefault(); if (pendingImageReads > 0) return showNotice('Aguarde o carregamento das imagens selecionadas.', 'error'); const data = collect(); const error = validate(data); if (error) return showNotice(error, 'error'); byId('create-button').disabled = true; showNotice('Validando imagens e gerando a página…'); vscode?.postMessage({ command: 'createPage', ...data }); });
  window.addEventListener('message', event => { const message = event.data; if (message.command === 'pageImported') { importPage(message); } else if (message.command === 'imagesSelected') { imageSources[message.fieldId] = message.multiple ? [...(imageSources[message.fieldId] || []), ...message.images.filter(item => !(imageSources[message.fieldId] || []).some(existing => existing.sourcePath === item.sourcePath))] : message.images.slice(0, 1); const control = byId(`field-${message.fieldId}`); control.value = imageSources[message.fieldId].map(item => item.token).join('\n'); renderImageValue(message.fieldId); showNotice(`${message.images.length} imagem(ns) adicionada(s) à biblioteca da página.`); } else if (message.command === 'imageThumbnailsReady') { const selected = imageSources[message.fieldId] || []; message.thumbnails.forEach(item => { const target = selected.find(source => source.token === item.token); if (target) target.thumbnail = item.thumbnail; }); renderImageValue(message.fieldId); } else if (message.command === 'directorySelected') { directoryInput.value = message.directory; updatePath(); } else if (message.command === 'previewReady') { previewFrame.srcdoc = message.html; previewStatus.textContent = 'Atualizada agora'; } else if (message.command === 'error') { byId('create-button').disabled = false; previewStatus.textContent = 'Não disponível'; showNotice(message.message, 'error'); } else if (message.command === 'created') { showNotice(`Página criada e aberta: ${message.path}`, 'success'); byId('create-button').disabled = false; } });
  let sectionObserver;
  function observeSections() {
    sectionObserver?.disconnect();
    sectionObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      document.querySelectorAll('.step').forEach(step => step.classList.toggle('active', step.dataset.section === visible.target.dataset.formSection));
    }, { rootMargin: '-18% 0px -62% 0px', threshold: 0 });
    document.querySelectorAll('[data-form-section]:not(.field)').forEach(section => sectionObserver.observe(section));
  }
  document.querySelectorAll('.step').forEach(step => step.addEventListener('click', () => { document.querySelector(`[data-form-section="${step.dataset.section}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.querySelectorAll('.step').forEach(item => item.classList.toggle('active', item === step)); }));
  renderFields(catalog.templates[0]);
  observeSections();
})();
