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
  let blocks = [];
  let importedPagePath = '';
  let importedBaseDirectory = '';
  let canvasDirty = false;
  let noticeTimer;
  const imageSources = {};
  const byId = id => document.getElementById(id);
  const slugify = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const sidebar = document.querySelector('.sidebar');
  templateSelect.closest('.field').hidden = true;
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
    .block-toolbar { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0; }
    .block-toolbar select, .block-toolbar button { min-height:36px; }
    .block-card { margin:10px 0; padding:10px; border:1px solid var(--line); border-radius:6px; background:var(--surface); }
    .block-card-header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:7px; }
    .block-card-header strong { color:var(--accent); }
    .block-actions { display:flex; gap:4px; }
    .block-actions button { min-width:26px; min-height:26px; padding:3px 6px; font-size:12px; }
    .block-card textarea, .block-card input { width:100%; margin:4px 0 8px; }
    .block-card label { display:block; margin:6px 0; color:var(--muted); font-size:12px; }
    .block-card .block-inline { display:grid; grid-template-columns:1fr 110px; gap:8px; }
    .block-empty { padding:18px; border:1px dashed var(--line); color:var(--muted); text-align:center; }
    .block-file-input { max-width:100%; }
    .general-editor-layout { grid-template-columns:minmax(250px,320px) minmax(0,1fr); max-width:none; }
    .general-editor-layout .block-editor { display:none; }
    .general-editor-layout .grid { grid-template-columns:1fr; }
    .field[hidden] { display:none !important; }
    .workspace.general-page-creator { display:block; min-height:100vh; animation:canvas-enter .32s ease both; }
    .general-page-creator > .sidebar { position:sticky; top:0; z-index:50; display:flex; width:100%; height:auto; min-height:60px; flex-direction:row; align-items:center; justify-content:space-between; gap:18px; padding:8px 20px; border-right:0; border-bottom:1px solid var(--line); background:rgba(255,252,247,.96); backdrop-filter:blur(14px); }
    .general-page-creator > .sidebar .brand { display:flex; flex:0 0 auto; }
    .general-page-creator .sidebar-footer { display:flex; align-items:center; gap:14px; margin:0; }
    .general-page-creator .sidebar-footer .steps { display:flex; gap:4px; margin:0 !important; }
    .general-page-creator .sidebar-footer .step { width:auto; padding:6px 9px; font-size:12px; }
    .general-page-creator .sidebar-footer .header-actions { display:flex; gap:6px; margin:0; }
    .general-page-creator .sidebar-footer .header-actions button { width:auto; min-height:34px; padding:6px 10px; font-size:12px; }
    .general-page-creator .sidebar-bottom { padding:0; white-space:nowrap; }
    .general-page-creator .editor { min-width:0; padding:12px 18px 28px; }
    .general-page-creator .editor-header { max-width:none; margin:0 auto 12px; padding:0; }
    .general-page-creator .editor-header h1 { font-size:22px; }
    .general-page-creator .editor-header #template-description { margin:2px 0; font-size:12px; }
    .general-page-creator .header-actions { display:none; }
    .general-page-creator .editor-layout { grid-template-columns:minmax(245px,290px) minmax(0,1fr); align-items:start; gap:14px; max-width:none; }
    .general-page-creator #page-form { display:grid; gap:10px; min-width:0; }
    .general-page-creator .form-card, .general-page-creator .dynamic-fields { margin:0; padding:14px; border-radius:7px; box-shadow:none; }
    .general-page-creator .card-heading { margin-bottom:12px; }
    .general-page-creator .dynamic-fields { display:block; }
    .general-page-creator #dynamic-fields { display:none; }
    .general-page-creator .general-metadata { display:grid; gap:5px; }
    .general-page-creator .general-metadata .field { margin:0; }
    .general-page-creator .notice-info { margin:0; padding:10px; box-shadow:none; }
    .general-page-creator .preview-pane { position:sticky; top:72px; min-width:0; border-radius:7px; }
    .preview-edit-toolbar { position:sticky; top:0; z-index:10; }
    .preview-edit-toolbar button, .general-page-creator button { transition:transform .14s ease, box-shadow .18s ease, background-color .18s ease, opacity .18s ease; }
    .preview-edit-toolbar button:hover, .general-page-creator .sidebar button:hover { transform:translateY(-1px); box-shadow:0 3px 9px rgba(50,30,20,.12); }
    .preview-edit-toolbar button:active, .general-page-creator button:active { transform:scale(.96); }
    .general-page-creator .form-card, .general-page-creator .dynamic-fields, .general-page-creator .preview-pane { animation:canvas-enter .32s ease both; }
    .general-page-creator .dynamic-fields { animation-delay:.06s; }
    .general-page-creator .preview-pane { animation-delay:.1s; }
    @keyframes canvas-enter { from { opacity:0; transform:translateY(7px); } to { opacity:1; transform:translateY(0); } }
      .preview-mode-control { display:flex; flex:0 0 auto; gap:2px; padding:2px; border:1px solid var(--line); border-radius:5px; background:var(--surface); }
      .preview-mode-control button { min-height:25px; padding:2px 8px; border:0; border-radius:3px; background:transparent; color:var(--muted); font-size:11px; }
      .preview-mode-control button[aria-pressed="true"] { background:var(--accent); color:#fff; }
      .preview-pane.mobile-preview #preview-frame { box-shadow:0 0 0 1px var(--line),0 12px 30px rgba(36,26,23,.13); }
    .preview-pane.is-rendering .preview-toolbar span:last-child { animation:status-pulse .8s ease-in-out infinite alternate; }
      .preview-edit-toolbar button[draggable="true"] { cursor:grab; }
      .preview-edit-toolbar button[draggable="true"]:active { cursor:grabbing; }
    @keyframes status-pulse { from { opacity:.45; } to { opacity:1; } }
    @media (prefers-reduced-motion:reduce) { .workspace.general-page-creator, .general-page-creator .form-card, .general-page-creator .dynamic-fields, .general-page-creator .preview-pane { animation:none; } .general-page-creator button, .preview-edit-toolbar button { transition:none; } }
    .preview-pane { position:sticky; top:8px; }
    .preview-edit-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:4px; padding:7px 9px; border-bottom:1px solid var(--line); background:var(--surface-2); }
    .preview-edit-toolbar button { min-width:30px; min-height:30px; padding:3px 8px; font-size:12px; }
    .preview-edit-toolbar select { width:auto; min-width:120px; min-height:30px; padding:3px 6px; }
    .preview-edit-toolbar .preview-link-input { width:190px; min-height:30px; margin:0; padding:4px 7px; }
    .preview-edit-toolbar .preview-link-input[hidden] { display:none; }
    .preview-edit-toolbar .toolbar-divider { width:1px; height:23px; margin:0 3px; background:var(--line); }
    .preview-edit-toolbar .toolbar-spacer { flex:1; }
    .preview-edit-toolbar .canvas-state { color:var(--muted); font-size:11px; }
    .preview-edit-toolbar .table-operations { display:none; align-items:center; gap:3px; }
    .preview-edit-toolbar .table-operations.is-active { display:flex; }
    .preview-edit-toolbar .table-operations button { min-width:28px; padding-inline:6px; }
    .preview-edit-toolbar .table-operations { order:20; }
    .preview-toolbar { flex-wrap:wrap; align-items:center; }
    .general-editor-layout #preview-frame { height:calc(100vh - 185px); min-height:560px; }
    @media (max-width:1050px) { .general-editor-layout { grid-template-columns:1fr; } .general-editor-layout #preview-frame { height:70vh; min-height:520px; } .general-page-creator .editor-layout { grid-template-columns:minmax(220px,280px) minmax(0,1fr); } }
    .rich-toolbar { display:flex; flex-wrap:wrap; gap:4px; margin:8px 0; }
    .rich-toolbar button { min-width:28px; min-height:28px; padding:3px 7px; font-size:12px; }
    .format-bold { font-weight:800 !important; }
    .format-italic { font-style:italic !important; }
    .format-underline { text-decoration:underline !important; }
    .rich-link-fields { display:grid; grid-template-columns:minmax(100px,1fr) minmax(130px,2fr) auto; gap:6px; margin:6px 0; }
    .rich-link-fields[hidden] { display:none; }
    .editable-table-wrap { max-width:100%; overflow:auto; margin:8px 0; border:1px solid var(--line); }
    .editable-table { width:100%; min-width:360px; table-layout:fixed; border-collapse:collapse; }
    .editable-table th, .editable-table td { min-width:120px; padding:3px; border:1px solid var(--line); }
    .editable-table th { background:var(--surface-2); }
    .editable-table thead tr > th:first-child, .editable-table tbody tr > th[scope="row"] { width:30px; min-width:30px; max-width:30px; padding:0; text-align:center; }
    .editable-table thead tr > th:last-child, .editable-table tbody tr > .table-cell-actions { width:28px; min-width:28px; max-width:28px; padding:0; text-align:center; }
    .editable-table input, .editable-table textarea { display:block; width:100%; min-width:100px; min-height:30px; margin:0; padding:5px 7px; border:0; border-radius:2px; background:transparent; font:inherit; }
    .editable-table textarea { min-height:30px; max-height:160px; overflow:auto; resize:vertical; line-height:1.35; }
    .editable-table input:focus, .editable-table textarea:focus { background:#fff; outline:2px solid var(--accent); outline-offset:-2px; }
    .editable-table th input { display:inline-block; width:calc(100% - 20px); min-width:0; font-weight:700; text-align:center; vertical-align:middle; }
    .table-cell-actions button, .table-column-delete { display:inline-grid; place-items:center; width:18px; min-width:18px !important; height:18px; min-height:18px; padding:0; border-radius:3px; font-size:11px; line-height:1; }
    .table-controls { display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin:6px 0; }
    .table-controls > button { min-height:28px; padding:4px 8px; font-size:12px; }
    .table-controls label { display:flex; align-items:center; gap:4px; margin:0; font-size:12px; }
    .steps .step[data-section="midia"], .steps .step[data-section="publicacao"] { display:none; }
    .sidebar-footer .steps { grid-template-columns:repeat(2,minmax(0,1fr)) !important; }
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
      .general-page-creator > .sidebar { position:sticky !important; inset:auto; display:flex; height:auto; flex-direction:row; padding:7px 10px; border-top:0; border-bottom:1px solid var(--line); }
      .general-page-creator > .sidebar .brand { display:flex; }
      .general-page-creator .sidebar-footer { display:flex; gap:7px; }
      .general-page-creator .sidebar-footer .steps { display:none; }
      .general-page-creator .sidebar-footer .sidebar-bottom { display:none; }
      .general-page-creator .sidebar-footer .header-actions { display:flex; width:auto; }
      .general-page-creator .editor { padding:10px; }
      .general-page-creator .editor-layout { grid-template-columns:1fr; }
      .general-page-creator .preview-pane { position:relative; top:0; }
      .general-page-creator #preview-frame { height:70vh; min-height:500px; }
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

  const previewPane = document.querySelector('.preview-pane');
  const workspace = document.querySelector('.workspace');
  byId('preview-button').textContent = 'Atualizar canvas';
  const previewPaneTitle = previewPane?.querySelector('.preview-toolbar strong');
  if (previewPaneTitle) previewPaneTitle.textContent = 'Canvas editável';
  const previewModes = document.createElement('div'); previewModes.className = 'preview-mode-control'; previewModes.setAttribute('role', 'group'); previewModes.setAttribute('aria-label', 'Tamanho da pré-visualização');
  const setPreviewMode = mode => {
    previewFrame.dataset.view = mode;
    const mobile = mode === 'mobile';
    previewFrame.style.width = mobile ? '390px' : '100%';
    previewFrame.style.maxWidth = '100%';
    previewFrame.style.margin = mobile ? '0 auto' : '0';
    previewPane.classList.toggle('mobile-preview', mobile);
    previewModes.querySelectorAll('button').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.view === mode)); });
  };
  [['desktop','Desktop'],['mobile','Mobile']].forEach(([mode,label]) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = label; button.dataset.view = mode; button.addEventListener('click', () => setPreviewMode(mode)); previewModes.append(button); });
  previewPaneTitle?.after(previewModes);
  setPreviewMode('desktop');
  const previewEditToolbar = document.createElement('div');
  previewEditToolbar.className = 'preview-edit-toolbar';
  previewEditToolbar.setAttribute('aria-label', 'Ferramentas de edição do conteúdo');
  const canvasState = document.createElement('span'); canvasState.className = 'canvas-state'; canvasState.textContent = 'Gere a prévia para editar o conteúdo';
  const addBlockType = document.createElement('select'); addBlockType.setAttribute('aria-label', 'Tipo de bloco');
  [['paragraph','Parágrafo'],['heading','Título de seção'],['quote','Citação'],['list','Lista'],['table','Tabela'],['supporters','Apoiadores'],['image','Imagem'],['gallery','Galeria'],['divider','Separador']].forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; addBlockType.append(option); });
  const addCanvasBlock = document.createElement('button'); addCanvasBlock.type = 'button'; addCanvasBlock.className = 'secondary'; addCanvasBlock.textContent = '+ Bloco'; addCanvasBlock.title = 'Adicionar bloco ao final do conteúdo';
  addCanvasBlock.addEventListener('click', () => { if (!previewFrame.contentDocument?.querySelector('main')) return showNotice('Gere a prévia antes de adicionar blocos.', 'error'); blocks.push(makeBlock(addBlockType.value)); renderBlockEditor(); requestPreview(false); });
  addBlockType.addEventListener('change', () => { if (activeCanvasBlock) convertActiveCanvasBlock(addBlockType.value); });
  const canvasButton = (text, title, command, className = '') => { const button = document.createElement('button'); button.type = 'button'; button.className = `secondary format-button ${className}`; button.textContent = text; button.title = title; button.setAttribute('aria-label', title); button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', () => applyCanvasCommand(command)); previewEditToolbar.append(button); return button; };
  const previewLinkInput = document.createElement('input'); previewLinkInput.className = 'preview-link-input'; previewLinkInput.type = 'url'; previewLinkInput.placeholder = 'https://…'; previewLinkInput.setAttribute('aria-label', 'Endereço do link'); previewLinkInput.hidden = true;
  const applyPreviewLink = document.createElement('button'); applyPreviewLink.type = 'button'; applyPreviewLink.className = 'secondary'; applyPreviewLink.textContent = 'Aplicar'; applyPreviewLink.title = 'Aplicar link ao texto selecionado'; applyPreviewLink.hidden = true;
  let savedCanvasRange;
  applyPreviewLink.addEventListener('mousedown', event => event.preventDefault());
  applyPreviewLink.addEventListener('click', () => {
    const doc = previewFrame.contentDocument; const url = previewLinkInput.value.trim();
    if (!doc || !savedCanvasRange || !url) return showNotice('Selecione um texto e informe o endereço do link.', 'error');
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url) || url.startsWith('//')) return showNotice('Use um link HTTP, HTTPS, e-mail ou uma referência local.', 'error');
    const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(savedCanvasRange);
    doc.execCommand('createLink', false, url); previewLinkInput.hidden = true; applyPreviewLink.hidden = true; syncPreviewToBlocks();
  });
  previewEditToolbar.append(addBlockType, addCanvasBlock);
  const dividerOne = document.createElement('span'); dividerOne.className = 'toolbar-divider'; previewEditToolbar.append(dividerOne);
  canvasButton('B', 'Negrito', 'bold', 'format-bold');
  canvasButton('I', 'Itálico', 'italic', 'format-italic');
  canvasButton('U', 'Sublinhado', 'underline', 'format-underline');
  canvasButton('Link', 'Criar link', 'link');
  previewEditToolbar.append(previewLinkInput, applyPreviewLink);
  const dividerTwo = document.createElement('span'); dividerTwo.className = 'toolbar-divider'; previewEditToolbar.append(dividerTwo);
  canvasButton('•', 'Lista com marcadores', 'insertUnorderedList');
  canvasButton('1.', 'Lista numerada', 'insertOrderedList');
  let activeCanvasBlock;
  let activeCanvasTable;
  let activeCanvasControls;
  let draggingCanvasBlock;
  let draggingCanvasControls;
  const tableOperations = document.createElement('span'); tableOperations.className = 'table-operations'; tableOperations.setAttribute('aria-label', 'Operações da tabela selecionada');
  const tableAction = (text, title, callback) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = text; button.title = title; button.setAttribute('aria-label', title); button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', callback); tableOperations.append(button); return button; };
  tableAction('+ Linha', 'Adicionar linha à tabela selecionada', () => {
    if (!activeCanvasTable) return showNotice('Selecione uma tabela para adicionar uma linha.');
    const table = activeCanvasTable; const row = table.tBodies[0]?.insertRow(); if (!row) return;
    const columnCount = table.rows[0]?.cells.length || 2;
    for (let column = 0; column < columnCount; column += 1) { const cell = row.insertCell(); cell.contentEditable = 'true'; cell.innerHTML = '<br>'; }
    syncPreviewToBlocks();
  });
  tableAction('− Linha', 'Remover a linha selecionada', () => {
    if (!activeCanvasTable) return showNotice('Selecione uma célula da tabela para remover a linha.');
    const selection = previewFrame.contentDocument.getSelection(); let node = selection?.anchorNode;
    if (node?.nodeType !== Node.ELEMENT_NODE) node = node?.parentElement;
    const row = node?.closest('tr');
    if (!row || row.parentElement.tagName !== 'TBODY') return showNotice('Selecione uma linha de dados para removê-la.');
    if (row.parentElement.rows.length <= 1) return showNotice('A tabela precisa manter ao menos uma linha.');
    row.remove(); syncPreviewToBlocks();
  });
  tableAction('+ Coluna', 'Adicionar coluna à tabela selecionada', () => {
    if (!activeCanvasTable) return showNotice('Selecione uma tabela para adicionar uma coluna.');
    const table = activeCanvasTable;
    Array.from(table.rows).forEach((row, rowIndex) => { const cell = row.insertCell(); if (row.parentElement.tagName === 'THEAD') { cell.outerHTML = '<th scope="col" contenteditable="true">Nova coluna</th>'; } else { cell.contentEditable = 'true'; cell.innerHTML = '<br>'; } });
    syncPreviewToBlocks();
  });
  tableAction('− Coluna', 'Remover a coluna selecionada', () => {
    if (!activeCanvasTable) return showNotice('Selecione uma célula da tabela para remover a coluna.');
    const selection = previewFrame.contentDocument.getSelection(); let node = selection?.anchorNode;
    if (node?.nodeType !== Node.ELEMENT_NODE) node = node?.parentElement;
    const cell = node?.closest('th,td'); if (!cell) return showNotice('Selecione a célula da coluna que deseja remover.');
    const index = cell.cellIndex; if (cell.parentElement.cells.length <= 1) return showNotice('A tabela precisa manter ao menos uma coluna.');
    Array.from(activeCanvasTable.rows).forEach(row => row.cells[index]?.remove()); syncPreviewToBlocks();
  });
  previewEditToolbar.append(tableOperations);
  const canvasImageInput = document.createElement('input'); canvasImageInput.type = 'file'; canvasImageInput.accept = 'image/*'; canvasImageInput.multiple = true; canvasImageInput.hidden = true;
  const canvasImageButton = document.createElement('button'); canvasImageButton.type = 'button'; canvasImageButton.className = 'secondary'; canvasImageButton.textContent = 'Imagem'; canvasImageButton.addEventListener('click', () => canvasImageInput.click());
  canvasImageInput.addEventListener('change', () => {
    const files = Array.from(canvasImageInput.files || []); if (!files.length) return;
    const entries = files.map(file => ({ token: `@browser-image-${Date.now()}-${Math.random().toString(16).slice(2)}`, label: file.name, dataUrl: '' }));
    imageSources.media = [...(imageSources.media || []), ...entries];
    entries.forEach((entry, index) => { const reader = new FileReader(); pendingImageReads += 1; reader.onload = () => { entry.dataUrl = reader.result; pendingImageReads -= 1; if (!pendingImageReads) requestPreview(false); }; reader.onerror = () => { pendingImageReads -= 1; showNotice(`Não foi possível carregar ${entry.label}.`, 'error'); }; reader.readAsDataURL(files[index]); });
    blocks.push(entries.length === 1 ? { type: 'image', src: entries[0].token, alt: entries[0].label, caption: '' } : { type: 'gallery', caption: 'Galeria de imagens', images: entries.map(entry => ({ src: entry.token, alt: entry.label })) });
    canvasImageInput.value = ''; renderBlockEditor(); canvasState.textContent = 'Carregando imagem…';
  });
  previewEditToolbar.append(canvasImageButton, canvasImageInput);
  const toolbarSpacer = document.createElement('span'); toolbarSpacer.className = 'toolbar-spacer'; previewEditToolbar.append(toolbarSpacer, canvasState);
  previewPane?.querySelector('.preview-toolbar')?.after(previewEditToolbar);

  function applyCanvasCommand(command) {
    const doc = previewFrame.contentDocument;
    if (!doc?.querySelector('main')) return showNotice('Gere a prévia para editar o conteúdo.', 'error');
    if (command === 'link') {
      const selection = doc.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return showNotice('Selecione o texto que receberá o link.', 'error');
      savedCanvasRange = selection.getRangeAt(0).cloneRange(); previewLinkInput.hidden = false; applyPreviewLink.hidden = false; previewLinkInput.focus(); return;
    }
    doc.execCommand(command, false, null); syncPreviewToBlocks();
  }

  function setActiveCanvasBlock(block, table) {
    const doc = previewFrame.contentDocument;
    activeCanvasControls?.remove(); activeCanvasControls = null;
    activeCanvasBlock = block || null; activeCanvasTable = table || null;
    tableOperations.classList.toggle('is-active', Boolean(activeCanvasTable));
    const tag = activeCanvasBlock?.tagName;
    const type = activeCanvasBlock?.classList.contains('apoio-grid') ? 'supporters' : activeCanvasBlock?.classList.contains('main-galeria') ? 'gallery' : tag === 'TABLE' ? 'table' : tag === 'UL' || tag === 'OL' ? 'list' : /^H[2-6]$/.test(tag) ? 'heading' : tag === 'BLOCKQUOTE' ? 'quote' : tag === 'FIGURE' || tag === 'IMG' ? 'image' : tag === 'HR' ? 'divider' : 'paragraph';
    if (Array.from(addBlockType.options).some(option => option.value === type)) addBlockType.value = type;
    if (!activeCanvasBlock || activeCanvasBlock.tagName === 'H1' || activeCanvasBlock.classList.contains('aeca-canvas-controls')) return;
    const tools = doc.createElement('div'); tools.className = 'aeca-canvas-controls'; tools.contentEditable = 'false'; tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', 'Ações do bloco selecionado');
    const button = (text, label, callback, draggable = false) => { const action = doc.createElement('button'); action.type = 'button'; action.textContent = text; action.title = label; action.setAttribute('aria-label', label); action.contentEditable = 'false'; action.addEventListener('mousedown', event => event.preventDefault()); action.addEventListener('click', callback); if (draggable) { action.draggable = true; action.addEventListener('dragstart', event => { draggingCanvasBlock = activeCanvasBlock; draggingCanvasControls = activeCanvasControls; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', 'aeca-canvas-block'); draggingCanvasBlock.classList.add('aeca-block-dragging'); }); action.addEventListener('dragend', () => { draggingCanvasBlock?.classList.remove('aeca-block-dragging'); draggingCanvasBlock = null; draggingCanvasControls = null; syncPreviewToBlocks(); }); } tools.append(action); };
    const move = direction => {
      const blockNode = activeCanvasBlock; const controlsNode = activeCanvasControls;
      if (direction < 0) {
        let previous = blockNode.previousElementSibling;
        if (previous?.classList.contains('aeca-canvas-controls')) previous = previous.previousElementSibling;
        if (!previous || previous.tagName === 'H1') return;
        const group = doc.createDocumentFragment(); group.append(blockNode, controlsNode); previous.before(group);
      } else {
        let next = controlsNode.nextElementSibling;
        if (next?.classList.contains('aeca-canvas-controls')) next = next.nextElementSibling;
        if (!next) return;
        const group = doc.createDocumentFragment(); group.append(blockNode, controlsNode); next.after(group);
      }
      syncPreviewToBlocks();
    };
    button('↑', 'Mover bloco para cima', () => move(-1));
    button('↓', 'Mover bloco para baixo', () => move(1));
    button('⠿', 'Arrastar bloco', () => {}, true);
    button('×', 'Remover bloco', () => { const removed = activeCanvasBlock; activeCanvasBlock = null; activeCanvasControls = null; removed.remove(); tools.remove(); syncPreviewToBlocks(); });
    activeCanvasControls = tools; activeCanvasBlock.after(tools);
  }

  function convertActiveCanvasBlock(type) {
    const block = activeCanvasBlock; const doc = previewFrame.contentDocument;
    if (!block || !doc || block.tagName === 'H1') return;
    if (type === 'table' && block.matches('table')) return;
    if (type === 'list' && (block.matches('ul') || block.matches('ol'))) return;
    const text = block.textContent.trim(); let replacement;
    if (type === 'heading') { replacement = doc.createElement('h2'); replacement.textContent = text || 'Título de seção'; }
    else if (type === 'paragraph') { replacement = doc.createElement('p'); replacement.textContent = text; }
    else if (type === 'quote') { replacement = doc.createElement('blockquote'); const paragraph = doc.createElement('p'); paragraph.textContent = text; replacement.append(paragraph); }
    else if (type === 'list') { replacement = doc.createElement('ul'); const item = doc.createElement('li'); item.textContent = text; replacement.append(item); }
    else if (type === 'table') { replacement = doc.createElement('table'); replacement.className = 'tabela-vitrine'; const body = replacement.createTBody(); const row = body.insertRow(); const cell = row.insertCell(); cell.textContent = text; }
    else if (type === 'supporters') { replacement = doc.createElement('ul'); replacement.className = 'apoio-grid'; const item = doc.createElement('li'); const card = doc.createElement('a'); card.className = 'apoio-card apoio-card-link'; card.href = '#'; const name = doc.createElement('strong'); name.textContent = text; card.append(name); item.append(card); replacement.append(item); }
    else if (type === 'image' || type === 'gallery') {
      const images = block.matches('img') ? [block.cloneNode(true)] : Array.from(block.querySelectorAll('img')).map(image => image.cloneNode(true));
      if (!images.length) return showNotice('O bloco ativo não contém imagem para converter.');
      replacement = type === 'gallery' ? doc.createElement('div') : doc.createElement('figure');
      if (type === 'gallery') replacement.className = 'main-galeria';
      images.forEach(image => replacement.append(image));
    }
    else { replacement = doc.createElement('hr'); }
    block.replaceWith(replacement); replacement.contentEditable = type === 'divider' ? 'false' : 'true';
    setActiveCanvasBlock(replacement, null); syncPreviewToBlocks(); replacement.focus?.();
  }

  function preserveImageSources(nextBlocks, previousBlocks) {
    const previousImages = (Array.isArray(previousBlocks) ? previousBlocks : []).flatMap(block => block.type === 'image' ? [block] : block.type === 'gallery' ? block.images || [] : block.type === 'infobox' && block.poster ? [block.poster] : []);
    let imageIndex = 0;
    return nextBlocks.map(block => {
      if (block.type === 'image') {
        const previous = previousImages[imageIndex++];
        if (String(block.src || '').startsWith('data:image/') && previous) block.src = previous.src;
      } else if (block.type === 'gallery') {
        block.images = block.images.map(image => { const previous = previousImages[imageIndex++]; return String(image.src || '').startsWith('data:image/') && previous ? { ...image, src: previous.src } : image; });
      }
      return block;
    });
  }

  function syncPreviewToBlocks() {
    const doc = previewFrame.contentDocument; const main = doc?.querySelector('main');
    if (!main || activeDefinition?.id !== 'geral') return;
    const previous = blocks;
    blocks = preserveImageSources(extractContentBlocks(main), previous);
    canvasDirty = true;
    canvasState.textContent = 'Alterações no canvas';
  }

  function enablePreviewEditing() {
    const doc = previewFrame.contentDocument; const main = doc?.querySelector('main');
    if (!doc || !main || activeDefinition?.id !== 'geral') return;
    let style = doc.getElementById('aeca-canvas-editor-style');
    if (!style) { style = doc.createElement('style'); style.id = 'aeca-canvas-editor-style'; style.textContent = '[contenteditable="true"]{outline:1px solid transparent;outline-offset:3px;cursor:text;transition:outline-color .15s ease,background-color .15s ease}[contenteditable="true"]:hover{outline-color:#ad7a48}[contenteditable="true"]:focus{outline:2px solid #7d2630;outline-offset:3px;background:rgba(255,250,225,.35)}main td[contenteditable="true"],main th[contenteditable="true"]{min-width:28px}.aeca-canvas-controls{display:flex;position:relative;z-index:20;gap:4px;width:max-content;margin:3px 0;padding:3px;border:1px solid #d8c9bc;border-radius:6px;background:#fffaf4;box-shadow:0 3px 9px rgba(36,26,23,.12)}.aeca-canvas-controls button{min-width:24px;min-height:24px;padding:2px 6px;border:1px solid #d8c9bc;border-radius:4px;background:#fffaf4;color:#241a17;font:600 12px system-ui;cursor:pointer;transition:transform .14s ease,box-shadow .18s ease}.aeca-canvas-controls button:hover{transform:translateY(-1px);box-shadow:0 3px 8px rgba(36,26,23,.16)}.aeca-canvas-controls button:active{transform:scale(.94)}.aeca-canvas-controls button[draggable="true"]{cursor:grab}.aeca-block-dragging{opacity:.4}.aeca-drop-target{box-shadow:inset 0 3px #7d2630}.aeca-drag-transition{transition:transform .16s ease,opacity .16s ease}'; doc.head.append(style); }
    main.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,summary,blockquote,figure,.main-galeria').forEach(element => { element.contentEditable = 'true'; element.spellcheck = true; });
    const originalImages = blocks.flatMap(block => block.type === 'image' ? [block] : block.type === 'gallery' ? block.images || [] : block.type === 'infobox' && block.poster ? [block.poster] : []);
    main.querySelectorAll('img').forEach((image, index) => { if (originalImages[index]?.src) image.dataset.aecaOriginalSrc = originalImages[index].src; });
    main.addEventListener('focusin', event => { let block = event.target; while (block && block.parentElement !== main) block = block.parentElement; if (block?.classList.contains('aeca-canvas-controls')) block = block.previousElementSibling; setActiveCanvasBlock(block || null, event.target.closest('table')); });
    doc.addEventListener('dragover', event => {
      if (!draggingCanvasBlock) return;
      event.preventDefault();
      let target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      while (target && target.parentElement !== main) target = target.parentElement;
      if (target?.classList.contains('aeca-canvas-controls')) target = target.previousElementSibling;
      if (!target || target === draggingCanvasBlock || target.tagName === 'H1') return;
      doc.querySelectorAll('.aeca-drop-target').forEach(element => element.classList.remove('aeca-drop-target'));
      target.classList.add('aeca-drop-target');
      const bounds = target.getBoundingClientRect();
      const group = doc.createDocumentFragment(); group.append(draggingCanvasBlock); if (draggingCanvasControls?.isConnected) group.append(draggingCanvasControls);
      if (event.clientY < bounds.top + bounds.height / 2) target.before(group); else target.after(group);
    });
    doc.addEventListener('drop', event => { if (draggingCanvasBlock) { event.preventDefault(); syncPreviewToBlocks(); } });
    doc.addEventListener('click', event => { if (event.target.closest('a')) event.preventDefault(); });
    doc.addEventListener('input', event => {
      if (event.target.closest('h1')) { titleInput.value = main.querySelector('h1')?.textContent.trim() || ''; if (!slugWasEdited) slugInput.value = slugify(titleInput.value); updatePath(); }
      const subtitle = event.target.closest('.page-subtitle'); const subtitleControl = byId('field-subtitle');
      if (subtitle && subtitleControl) subtitleControl.value = subtitle.textContent.trim();
      syncPreviewToBlocks();
    });
    doc.addEventListener('keyup', event => { if (event.key === 'Enter') syncPreviewToBlocks(); });
    canvasDirty = false;
    canvasState.textContent = 'Clique no conteúdo para editar';
    previewFrame.classList.add('canvas-ready');
  }

  function requestPreview(syncCanvas = true) {
    if (pendingImageReads > 0) return showNotice('Aguarde o carregamento das imagens selecionadas.', 'error');
    const data = collect(syncCanvas); const error = validate(data); if (error) return showNotice(error, 'error');
    previewStatus.textContent = 'Gerando…'; canvasState.textContent = 'Atualizando canvas…';
    previewPane?.classList.add('is-rendering');
    vscode?.postMessage({ command: 'previewPage', ...data });
  }
  previewFrame.addEventListener('load', () => { previewPane?.classList.remove('is-rendering'); enablePreviewEditing(); });
  window.addEventListener('message', event => { if (event.data?.command === 'error') previewPane?.classList.remove('is-rendering'); });

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
  function makeBlock(type) {
    if (type === 'heading') return { type, level: 2, text: '' };
    if (type === 'paragraph') return { type, text: '' };
    if (type === 'quote') return { type, text: '', cite: '' };
    if (type === 'details') return { type, summary: '', text: '' };
    if (type === 'video') return { type, title: '', src: '' };
    if (type === 'list') return { type, items: [], ordered: false };
    if (type === 'table') return { type, caption: '', headers: ['Coluna 1', 'Coluna 2'], rows: [['', '']] };
    if (type === 'supporters') return { type, label: 'Apoiadores', items: [{ category: '', name: 'Apoiador', url: '' }] };
    if (type === 'image') return { type, src: '', alt: '', caption: '' };
    if (type === 'gallery') return { type, caption: 'Galeria de fotos', images: [] };
    if (type === 'link') return { type, label: '', url: '' };
    return { type: 'divider' };
  }
  function renderBlockEditor() {
    const host = byId('content-blocks');
    if (!host) return;
    host.replaceChildren();
    if (!blocks.length) { const empty = document.createElement('p'); empty.className = 'block-empty'; empty.textContent = 'Adicione blocos para montar o conteúdo da página.'; host.append(empty); }
    const labels = { heading: 'Título de seção', paragraph: 'Parágrafo', quote: 'Citação', details: 'Conteúdo expansível', video: 'Vídeo', list: 'Lista', table: 'Tabela', image: 'Imagem', gallery: 'Galeria de imagens', link: 'Link', divider: 'Separador' };
    blocks.forEach((block, index) => {
      const card = document.createElement('article'); card.className = 'block-card';
      const header = document.createElement('div'); header.className = 'block-card-header';
      const title = document.createElement('strong'); title.textContent = labels[block.type] || 'Bloco';
      const actions = document.createElement('div'); actions.className = 'block-actions';
      const action = (text, label, callback, disabled) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = text; button.title = label; button.setAttribute('aria-label', label); button.disabled = disabled; button.addEventListener('click', callback); return button; };
      actions.append(action('↑', 'Mover para cima', () => { [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]; renderBlockEditor(); }, index === 0));
      actions.append(action('↓', 'Mover para baixo', () => { [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]; renderBlockEditor(); }, index === blocks.length - 1));
      actions.append(action('Remover', 'Remover bloco', () => { blocks.splice(index, 1); renderBlockEditor(); }));
      header.append(title, actions); card.append(header);
      const field = (label, value, update, multiline = false, rows = 3) => {
        const wrapper = document.createElement('label'); wrapper.textContent = label;
        const input = document.createElement(multiline ? 'textarea' : 'input');
        if (multiline) input.rows = rows; else input.type = 'text';
        input.value = value ?? ''; input.addEventListener('input', () => update(input.value)); wrapper.append(input); card.append(wrapper);
      };
      const richTextField = (labelText, value, update, allowLists = false) => {
        const label = document.createElement('label'); label.textContent = labelText; card.append(label);
        const toolbar = document.createElement('div'); toolbar.className = 'rich-toolbar';
        const textarea = document.createElement('textarea'); textarea.rows = 5; textarea.value = value ?? ''; textarea.setAttribute('aria-label', labelText);
        textarea.addEventListener('input', () => update(textarea.value));
        const button = (text, titleText, callback, className = '') => { const item = document.createElement('button'); item.type = 'button'; item.className = `secondary format-button ${className}`; item.textContent = text; item.title = titleText; item.setAttribute('aria-label', titleText); item.addEventListener('mousedown', event => event.preventDefault()); item.addEventListener('click', callback); toolbar.append(item); };
        const wrapSelection = tag => {
          const start = textarea.selectionStart; const end = textarea.selectionEnd; const selected = textarea.value.slice(start, end);
          const replacement = `<${tag}>${selected}</${tag}>`;
          textarea.setRangeText(replacement, start, end, 'select'); update(textarea.value); textarea.focus();
          if (!selected) textarea.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
        };
        button('B', 'Negrito', () => wrapSelection('b'), 'format-bold');
        button('I', 'Itálico', () => wrapSelection('i'), 'format-italic');
        button('U', 'Sublinhado', () => wrapSelection('u'), 'format-underline');
        let linkSelection = { start: 0, end: 0 };
        const linkPanel = document.createElement('div'); linkPanel.className = 'rich-link-fields'; linkPanel.hidden = true;
        const linkText = document.createElement('input'); linkText.placeholder = 'Texto do link';
        const linkUrl = document.createElement('input'); linkUrl.placeholder = 'https://…'; linkUrl.type = 'url';
        const insertLink = document.createElement('button'); insertLink.type = 'button'; insertLink.className = 'secondary'; insertLink.textContent = 'Inserir';
        insertLink.addEventListener('click', () => { const selected = textarea.value.slice(linkSelection.start, linkSelection.end); const text = linkText.value.trim() || selected; const url = linkUrl.value.trim(); if (!text || !url) return showNotice('Informe o texto e a URL do link.', 'error'); const syntax = `<a href="${url}">${text}</a>`; textarea.setRangeText(syntax, linkSelection.start, linkSelection.end, 'end'); update(textarea.value); linkPanel.hidden = true; textarea.focus(); });
        linkPanel.append(linkText, linkUrl, insertLink);
        button('Link', 'Inserir link', () => { linkSelection = { start: textarea.selectionStart, end: textarea.selectionEnd }; linkText.value = textarea.value.slice(linkSelection.start, linkSelection.end); linkPanel.hidden = !linkPanel.hidden; if (!linkPanel.hidden) linkUrl.focus(); });
        if (allowLists) {
          const insertList = tag => {
            const start = textarea.selectionStart; const end = textarea.selectionEnd; const source = textarea.value;
            const selected = start === end ? source : source.slice(start, end);
            const items = selected ? selected.split(/\r?\n/).filter(item => item.trim()) : [''];
            const markup = `<${tag}>${items.map(item => `<li>${item}</li>`).join('')}</${tag}>`;
            textarea.setRangeText(markup, start, end, 'select'); update(textarea.value); textarea.focus();
            if (!selected) textarea.setSelectionRange(start + tag.length + 6, start + tag.length + 6);
          };
          button('• Lista', 'Inserir lista com marcadores no texto', () => insertList('ul'));
          button('1. Lista', 'Inserir lista numerada no texto', () => insertList('ol'));
        }
        card.append(toolbar, linkPanel, textarea);
      };
      if (block.type === 'heading') {
        const inline = document.createElement('div'); inline.className = 'block-inline';
        field('Título', block.text, value => { block.text = value; });
        const label = document.createElement('label'); label.textContent = 'Nível'; const select = document.createElement('select');
        [2, 3, 4].forEach(level => { const option = document.createElement('option'); option.value = String(level); option.textContent = `H${level}`; select.append(option); });
        select.value = String(block.level || 2); select.addEventListener('change', () => { block.level = Number(select.value); }); label.append(select); inline.append(label); card.append(inline);
      } else if (block.type === 'paragraph') richTextField('Texto', block.text, value => { block.text = value; }, true);
      else if (block.type === 'quote') { richTextField('Citação', block.text, value => { block.text = value; }); field('Autoria (opcional)', block.cite, value => { block.cite = value; }); }
      else if (block.type === 'details') { field('Título expansível', block.summary, value => { block.summary = value; }); richTextField('Conteúdo', block.text, value => { block.text = value; }); }
      else if (block.type === 'video') { field('Título do vídeo', block.title, value => { block.title = value; }); field('URL de incorporação do YouTube ou Vimeo', block.src, value => { block.src = value; }); }
      else if (block.type === 'list') {
        richTextField('Um item por linha', (block.items || []).map(item => typeof item === 'string' ? item : item.text).join('\n'), value => { block.items = value.split(/\r?\n/).map(item => item.trim()).filter(Boolean); });
      } else if (block.type === 'table') {
        field('Legenda (opcional)', block.caption, value => { block.caption = value; });
        block.headers = Array.isArray(block.headers) ? block.headers : []; block.rows = Array.isArray(block.rows) ? block.rows : [];
        const columnCount = Math.max(2, block.headers.length, ...block.rows.map(row => row.length));
        const gridWrap = document.createElement('div'); gridWrap.className = 'editable-table-wrap';
        const grid = document.createElement('table'); grid.className = 'editable-table';
        const head = document.createElement('thead'); const headRow = document.createElement('tr');
        const corner = document.createElement('th'); corner.textContent = '#'; headRow.append(corner);
        for (let column = 0; column < columnCount; column += 1) {
          const cell = document.createElement('th');
          if (block.headers.length) { const input = document.createElement('input'); input.value = block.headers[column] || ''; input.setAttribute('aria-label', `Cabeçalho da coluna ${column + 1}`); input.addEventListener('input', () => { block.headers[column] = input.value; }); cell.append(input); }
          else cell.textContent = `Coluna ${column + 1}`;
          const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary table-column-delete'; remove.textContent = '×'; remove.title = `Remover coluna ${column + 1}`; remove.setAttribute('aria-label', remove.title); remove.disabled = columnCount <= 1;
          remove.addEventListener('click', () => { if (block.headers.length) block.headers.splice(column, 1); block.rows.forEach(row => row.splice(column, 1)); renderBlockEditor(); }); cell.append(remove); headRow.append(cell);
        }
        const headActions = document.createElement('th'); headActions.setAttribute('aria-label', 'Ações das linhas'); headRow.append(headActions); head.append(headRow); grid.append(head);
        const formatToolbar = document.createElement('div'); formatToolbar.className = 'rich-toolbar table-format-toolbar';
        let activeCell;
        let cellLinkSelection;
        const formatCell = tag => {
          if (!activeCell) return showNotice('Selecione uma célula antes de aplicar a formatação.', 'error');
          const start = activeCell.input.selectionStart; const end = activeCell.input.selectionEnd; const selected = activeCell.input.value.slice(start, end);
          const markup = `<${tag}>${selected}</${tag}>`; activeCell.input.setRangeText(markup, start, end, 'select'); activeCell.row[activeCell.column] = activeCell.input.value; activeCell.input.focus();
          if (!selected) activeCell.input.setSelectionRange(start + tag.length + 2, start + tag.length + 2);
        };
        const formatButton = (text, label, callback, className = '') => { const button = document.createElement('button'); button.type = 'button'; button.className = `secondary format-button ${className}`; button.textContent = text; button.title = label; button.setAttribute('aria-label', label); button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', callback); formatToolbar.append(button); };
        formatButton('B', 'Negrito', () => formatCell('b'), 'format-bold');
        formatButton('I', 'Itálico', () => formatCell('i'), 'format-italic');
        formatButton('U', 'Sublinhado', () => formatCell('u'), 'format-underline');
        const cellLinkPanel = document.createElement('div'); cellLinkPanel.className = 'rich-link-fields'; cellLinkPanel.hidden = true;
        const cellLinkText = document.createElement('input'); cellLinkText.placeholder = 'Texto do link';
        const cellLinkUrl = document.createElement('input'); cellLinkUrl.type = 'url'; cellLinkUrl.placeholder = 'https://…';
        const insertCellLink = document.createElement('button'); insertCellLink.type = 'button'; insertCellLink.className = 'secondary'; insertCellLink.textContent = 'Inserir';
        insertCellLink.addEventListener('click', () => {
          const { input, row, column, start, end } = cellLinkSelection || {};
          const selected = input?.value.slice(start, end) || ''; const label = cellLinkText.value.trim() || selected; const url = cellLinkUrl.value.trim();
          if (!input || !label || !url) return showNotice('Selecione uma célula e informe o texto e a URL do link.', 'error');
          input.setRangeText(`<a href="${url}">${label}</a>`, start, end, 'end'); row[column] = input.value; cellLinkPanel.hidden = true; input.focus();
        });
        cellLinkPanel.append(cellLinkText, cellLinkUrl, insertCellLink);
        formatButton('Link', 'Inserir link na célula selecionada', () => {
          if (!activeCell) return showNotice('Selecione uma célula antes de inserir um link.', 'error');
          cellLinkSelection = { ...activeCell, start: activeCell.input.selectionStart, end: activeCell.input.selectionEnd };
          cellLinkText.value = activeCell.input.value.slice(cellLinkSelection.start, cellLinkSelection.end); cellLinkPanel.hidden = !cellLinkPanel.hidden;
          if (!cellLinkPanel.hidden) cellLinkUrl.focus();
        });
        const body = document.createElement('tbody');
        block.rows.forEach((row, rowIndex) => {
          const tr = document.createElement('tr'); const rowNumber = document.createElement('th'); rowNumber.scope = 'row'; rowNumber.textContent = String(rowIndex + 1); tr.append(rowNumber);
          for (let column = 0; column < columnCount; column += 1) { const td = document.createElement('td'); const input = document.createElement('textarea'); input.rows = Math.min(5, Math.max(1, String(row[column] || '').split('\n').length)); input.value = row[column] || ''; input.setAttribute('aria-label', `Linha ${rowIndex + 1}, coluna ${column + 1}`); input.addEventListener('focus', () => { activeCell = { input, row, column }; }); input.addEventListener('input', () => { while (row.length <= column) row.push(''); row[column] = input.value; input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 160)}px`; }); td.append(input); tr.append(td); }
          const actions = document.createElement('td'); actions.className = 'table-cell-actions'; const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary table-delete-button'; remove.textContent = '×'; remove.title = `Remover linha ${rowIndex + 1}`; remove.setAttribute('aria-label', remove.title); remove.disabled = block.rows.length <= 1; remove.addEventListener('click', () => { block.rows.splice(rowIndex, 1); renderBlockEditor(); }); actions.append(remove); tr.append(actions); body.append(tr);
        });
        grid.append(body); gridWrap.append(grid); card.append(formatToolbar, cellLinkPanel, gridWrap);
        const controls = document.createElement('div'); controls.className = 'table-controls';
        const addRow = document.createElement('button'); addRow.type = 'button'; addRow.className = 'secondary'; addRow.textContent = '＋ Linha'; addRow.addEventListener('click', () => { block.rows.push(Array(columnCount).fill('')); renderBlockEditor(); });
        const addColumn = document.createElement('button'); addColumn.type = 'button'; addColumn.className = 'secondary'; addColumn.textContent = '＋ Coluna'; addColumn.addEventListener('click', () => { if (block.headers.length) block.headers.push(`Coluna ${columnCount + 1}`); block.rows.forEach(row => row.push('')); renderBlockEditor(); });
        const headerLabel = document.createElement('label'); const headerToggle = document.createElement('input'); headerToggle.type = 'checkbox'; headerToggle.checked = block.headers.length > 0; headerToggle.addEventListener('change', () => { block.headers = headerToggle.checked ? Array.from({ length: columnCount }, (_, i) => `Coluna ${i + 1}`) : []; renderBlockEditor(); }); headerLabel.append(headerToggle, ' Cabeçalhos');
        const rowHeaderLabel = document.createElement('label'); const rowHeaderToggle = document.createElement('input'); rowHeaderToggle.type = 'checkbox'; rowHeaderToggle.checked = Boolean(block.rowHeaders); rowHeaderToggle.addEventListener('change', () => { block.rowHeaders = rowHeaderToggle.checked; }); rowHeaderLabel.append(rowHeaderToggle, ' Primeira coluna como rótulo');
        controls.append(addRow, addColumn, headerLabel, rowHeaderLabel); card.append(controls);
      } else if (block.type === 'image') { field('Caminho ou URL da imagem', block.src, value => { block.src = value; }); field('Texto alternativo', block.alt, value => { block.alt = value; }); field('Legenda (opcional)', block.caption, value => { block.caption = value; }); }
      else if (block.type === 'gallery') {
        field('Legenda (opcional)', block.caption, value => { block.caption = value; });
        field('Uma imagem por linha: caminho | texto alternativo', (block.images || []).map(image => `${image.src}${image.alt ? ` | ${image.alt}` : ''}`).join('\n'), value => { block.images = value.split(/\r?\n/).map(line => { const [src, ...alt] = line.split('|').map(part => part.trim()); return src ? { src, alt: alt.join('|') } : null; }).filter(Boolean); }, true, 5);
      } else if (block.type === 'link') { field('Texto do link', block.label, value => { block.label = value; }); field('URL', block.url, value => { block.url = value; }); }
      host.append(card);
    });
  }
  function renderGeneralFields(definition) {
    activeDefinition = definition;
    workspace?.classList.add('general-page-creator');
    document.querySelector('.editor-layout')?.classList.add('general-editor-layout');
    Object.keys(imageSources).forEach(key => delete imageSources[key]);
    blocks = [];
    const heading = document.createElement('div'); heading.className = 'form-section-heading'; heading.dataset.formSection = 'conteudo'; heading.innerHTML = '<h2>Conteúdo</h2><p>Combine blocos e reorganize-os para compor a página.</p>';
    const metadata = document.createElement('div'); metadata.className = 'general-metadata';
    metadata.append(makeField(definition.fields.find(field => field.id === 'description')));
    metadata.append(makeField(definition.fields.find(field => field.id === 'subtitle')));
    const editor = document.createElement('div'); editor.className = 'block-editor';
    const toolbar = document.createElement('div'); toolbar.className = 'block-toolbar';
    const typeSelect = document.createElement('select');
    [['heading','Título de seção'],['paragraph','Parágrafo'],['quote','Citação'],['details','Conteúdo expansível'],['video','Vídeo'],['list','Lista'],['table','Tabela'],['image','Imagem'],['gallery','Galeria'],['link','Link'],['divider','Separador']].forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; typeSelect.append(option); });
    const addButton = document.createElement('button'); addButton.type = 'button'; addButton.className = 'secondary'; addButton.textContent = 'Adicionar bloco'; addButton.addEventListener('click', () => { blocks.push(makeBlock(typeSelect.value)); renderBlockEditor(); });
    const filePicker = document.createElement('input'); filePicker.type = 'file'; filePicker.accept = 'image/*'; filePicker.multiple = true; filePicker.className = 'block-file-input'; filePicker.setAttribute('aria-label', 'Selecionar imagens');
    filePicker.addEventListener('change', () => {
      const files = Array.from(filePicker.files || []); if (!files.length) return;
      const images = files.map(file => ({ token: `@browser-image-${Date.now()}-${Math.random().toString(16).slice(2)}`, label: file.name, dataUrl: '' }));
      imageSources.media = [...(imageSources.media || []), ...images];
      const imported = images.map(image => ({ src: image.token, alt: image.label }));
      blocks.push(imported.length === 1 ? { type: 'image', ...imported[0], caption: '' } : { type: 'gallery', caption: 'Galeria de fotos', images: imported });
      images.forEach((image, index) => { const reader = new FileReader(); pendingImageReads += 1; reader.onload = () => { image.dataUrl = reader.result; pendingImageReads -= 1; }; reader.onerror = () => { pendingImageReads -= 1; showNotice(`Não foi possível carregar ${image.label}.`, 'error'); }; reader.readAsDataURL(files[index]); });
      filePicker.value = ''; renderBlockEditor(); showNotice(`${images.length} imagem(ns) adicionada(s) ao conteúdo.`);
    });
    toolbar.append(typeSelect, addButton, filePicker);
    const host = document.createElement('div'); host.id = 'content-blocks';
    editor.append(toolbar, host);
    document.querySelector('.form-card')?.append(metadata);
    fieldsContainer.replaceChildren(heading, editor);
    directoryInput.value = '.'; byId('template-description').textContent = definition.description; showNotice(''); updatePath(); renderBlockEditor(); observeSections();
  }
  function renderFields(definition) {
    if (definition.id === 'geral') { renderGeneralFields(definition); return; }
    workspace?.classList.remove('general-page-creator');
    document.querySelector('.editor-layout')?.classList.remove('general-editor-layout');
    activeDefinition = definition; Object.keys(imageSources).forEach(key => delete imageSources[key]);
    const grouped = ['basicos', 'conteudo', 'midia', 'publicacao'].map(section => ({ section, fields: definition.fields.filter(field => fieldSection(field) === section && field.id !== 'title') })).filter(group => group.fields.length);
    const nodes = [];
    grouped.forEach(group => { if (group.section === 'basicos') { nodes.push(...group.fields.map(makeField)); return; } const heading = document.createElement('div'); heading.className = 'form-section-heading'; heading.dataset.formSection = group.section; heading.innerHTML = `<h2>${group.section === 'conteudo' ? 'Conteúdo' : group.section === 'midia' ? 'Mídia e imagens' : 'Publicação'}</h2><p>Preencha os dados desta etapa para compor a página.</p>`; nodes.push(heading, ...group.fields.map(makeField)); });
    fieldsContainer.replaceChildren(...nodes); directoryInput.value = definition.defaultDirectory.replace('{year}', String(new Date().getFullYear())); byId('template-description').textContent = definition.description; showNotice(''); updatePath(); observeSections();
  }
  function collect(syncCanvas = true) {
    if (syncCanvas && canvasDirty) syncPreviewToBlocks();
    const fields = {}; const selectedImages = {};
    activeDefinition.fields.forEach(field => { const control = field.id === 'title' ? titleInput : byId(`field-${field.id}`); fields[field.id] = control?.value.trim() || ''; if (field.type === 'image' || field.type === 'imageList') selectedImages[field.id] = (imageSources[field.id] || []).map(item => ({ token: item.token, label: item.label, sourcePath: item.sourcePath, dataUrl: item.dataUrl })); });
    if (activeDefinition.id === 'geral') selectedImages.media = (imageSources.media || []).map(item => ({ token: item.token, label: item.label, sourcePath: item.sourcePath, dataUrl: item.dataUrl }));
    return { fields, blocks, imageSources: selectedImages, slug: slugInput.value.trim(), directory: directoryInput.value.trim(), templateId: activeDefinition.id, sourcePath: importedPagePath };
  }
  function inlineMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.tagName === 'BR') return '\n';
    const content = Array.from(node.childNodes).map(inlineMarkdown).join('');
    if (node.tagName === 'A') return `<a href="${normalizeImportedUrl(node.getAttribute('href') || '')}">${content}</a>`;
    if (['B', 'STRONG'].includes(node.tagName)) return `<b>${content}</b>`;
    if (['I', 'EM'].includes(node.tagName)) return `<i>${content}</i>`;
    if (node.tagName === 'U') return `<u>${content}</u>`;
    if (['S', 'STRIKE', 'DEL'].includes(node.tagName)) return `<del>${content}</del>`;
    if (node.tagName === 'UL' || node.tagName === 'OL') return `<${node.tagName.toLowerCase()}>${content}</${node.tagName.toLowerCase()}>`;
    if (node.tagName === 'LI') return `<li>${content}</li>`;
    return content;
  }
  function normalizeImportedUrl(value) {
    const url = String(value || '').trim();
    if (!url || url.startsWith('/') || url.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
    try { const resolved = new URL(url, `https://aeca.com.br/${importedBaseDirectory.replace(/^\/+|\/+$/g, '')}/`); return `${resolved.pathname}${resolved.search}${resolved.hash}`; } catch { return url; }
  }
  function importedTable(table) {
    const headerRow = table.querySelector('thead tr');
    const headers = headerRow ? Array.from(headerRow.querySelectorAll('th,td')).map(cell => inlineMarkdown(cell).trim()) : [];
    const rows = Array.from(table.querySelectorAll('tr')).filter(row => row !== headerRow).map(row => Array.from(row.querySelectorAll(':scope > th, :scope > td')).map(cell => inlineMarkdown(cell).replace(/[ \t]+/g, ' ').trim())).filter(row => row.some(Boolean));
    const rowHeaders = !headers.length && Boolean(table.querySelector('tbody tr th[scope="row"], tr th[scope="row"]'));
    return { type: 'table', caption: table.querySelector('caption')?.textContent.trim() || '', headers, rows, rowHeaders, className: table.className };
  }
  function importedInfobox(section) {
    const posterFigure = section.querySelector('.show-infobox-poster');
    const posterImage = posterFigure?.querySelector('img');
    const table = section.querySelector('.show-infobox-meta');
    const rows = table ? Array.from(table.querySelectorAll('tbody > tr')).map(row => ({ label: inlineMarkdown(row.querySelector(':scope > th') || row.querySelector(':scope > td:first-child')).trim(), value: inlineMarkdown(row.querySelector(':scope > td:last-child') || row.querySelector(':scope > th:last-child')).trim() })).filter(row => row.label || row.value) : [];
    return { type: 'infobox', label: section.getAttribute('aria-label') || 'Informações da página', poster: posterImage ? { src: posterImage.dataset.aecaOriginalSrc || normalizeImportedUrl(posterImage.getAttribute('src') || ''), alt: posterImage.getAttribute('alt') || '', caption: posterFigure.querySelector('figcaption')?.textContent.trim() || '' } : null, rows };
  }
  function importedSupporters(list) {
    const items = Array.from(list.querySelectorAll(':scope > li')).map(item => {
      const anchor = item.querySelector(':scope > a, a.apoio-card');
      return { category: item.querySelector('.apoio-categoria')?.textContent.trim() || '', name: item.querySelector('strong')?.textContent.trim() || item.textContent.trim(), url: anchor?.getAttribute('href') || '' };
    }).filter(item => item.name);
    return { type: 'supporters', label: list.getAttribute('aria-label') || 'Apoiadores', items };
  }
  function extractContentBlocks(main) {
    const result = [];
    if (!main) return result;
    let skippedTitle = false;
    let skippedSubtitle = false;
    let skippedIntroDivider = false;
    const consume = node => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.matches('script,style,template,.image-modal,.aeca-canvas-controls')) return;
      if (node.tagName === 'H1') { if (!skippedTitle) { skippedTitle = true; return; } result.push({ type: 'heading', level: 2, text: node.textContent.trim() }); return; }
      if (node.classList.contains('page-subtitle')) { if (!skippedSubtitle) { skippedSubtitle = true; return; } result.push({ type: 'heading', level: 3, text: node.textContent.trim() }); return; }
      if (/^H[2-6]$/.test(node.tagName)) { result.push({ type: 'heading', level: Number(node.tagName.slice(1)), text: node.textContent.trim() }); return; }
      if (node.tagName === 'P') { const text = inlineMarkdown(node).trim(); if (text) result.push({ type: 'paragraph', text, className: node.className }); return; }
      if (node.tagName === 'HR') { if (!skippedIntroDivider) { skippedIntroDivider = true; return; } result.push({ type: 'divider' }); return; }
      if (node.tagName === 'UL' && node.classList.contains('apoio-grid')) { result.push(importedSupporters(node)); return; }
      if (node.tagName === 'UL' || node.tagName === 'OL') { result.push({ type: 'list', ordered: node.tagName === 'OL', className: node.className, items: Array.from(node.children).filter(child => child.tagName === 'LI').map(item => inlineMarkdown(item).replace(/^<li>|<\/li>$/g, '').trim()).filter(Boolean) }); return; }
      if (node.tagName === 'LI') { const text = inlineMarkdown(node).trim(); if (text) result.push({ type: 'list', items: [text] }); return; }
      if (node.tagName === 'SECTION' && node.classList.contains('show-infobox')) { result.push(importedInfobox(node)); return; }
      if (node.tagName === 'TABLE') { const block = importedTable(node); if (block.rows.length) result.push(block); return; }
      if (node.tagName === 'BLOCKQUOTE') { result.push({ type: 'quote', text: node.textContent.trim(), cite: node.querySelector('cite')?.textContent.trim() || '' }); return; }
      if (node.tagName === 'DETAILS') { const summary = node.querySelector(':scope > summary'); const content = node.cloneNode(true); content.querySelector(':scope > summary')?.remove(); result.push({ type: 'details', summary: summary?.textContent.trim() || 'Mais informações', text: content.textContent.trim() }); return; }
      if (node.tagName === 'IFRAME') { const src = node.getAttribute('src') || ''; if (/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i.test(src) || /^https:\/\/player\.vimeo\.com\/video\//i.test(src)) result.push({ type: 'video', src, title: node.getAttribute('title') || 'Vídeo incorporado' }); return; }
      if (node.tagName === 'FIGURE') { const image = node.querySelector('img'); if (image) result.push({ type: 'image', src: image.dataset.aecaOriginalSrc || normalizeImportedUrl(image.getAttribute('src') || ''), alt: image.getAttribute('alt') || '', caption: node.querySelector('figcaption')?.textContent.trim() || '', className: node.className, imageClassName: image.className }); else Array.from(node.children).forEach(consume); return; }
      if (node.tagName === 'IMG') { result.push({ type: 'image', src: node.dataset.aecaOriginalSrc || normalizeImportedUrl(node.getAttribute('src') || ''), alt: node.getAttribute('alt') || '', caption: '' }); return; }
      if (node.tagName === 'A') { const href = node.getAttribute('href') || ''; const label = node.textContent.trim(); if (label && href) result.push({ type: 'link', url: href, label }); return; }
      if (node.tagName === 'DIV' && (node.classList.contains('main-galeria') || node.querySelectorAll(':scope > img').length > 1)) {
        const images = Array.from(node.querySelectorAll(':scope > img')).map(image => ({ src: image.dataset.aecaOriginalSrc || normalizeImportedUrl(image.getAttribute('src') || ''), alt: image.getAttribute('alt') || '' }));
        if (images.length) { result.push({ type: 'gallery', caption: '', images }); return; }
      }
      if (node.tagName === 'DIV' && node.querySelectorAll(':scope > img').length === 1) {
        const image = node.querySelector(':scope > img');
        result.push({ type: 'image', src: image.dataset.aecaOriginalSrc || normalizeImportedUrl(image.getAttribute('src') || ''), alt: image.getAttribute('alt') || '', caption: '', imageClassName: image.className });
        return;
      }
      if (node.tagName === 'DIV' && !node.querySelector('h1,h2,h3,h4,h5,h6,p,ul,ol,table,figure,blockquote,details,iframe')) { const text = inlineMarkdown(node).trim(); if (text) result.push({ type: 'paragraph', text, className: node.className }); return; }
      Array.from(node.childNodes).forEach(consume);
    };
    Array.from(main.childNodes).forEach(consume);
    return result;
  }
  function importPage(message) {
    const documentParser = new DOMParser();
    const imported = documentParser.parseFromString(message.content, 'text/html');
    const definition = catalog.templates.find(item => item.id === 'geral') || catalog.templates[0];
    templateSelect.value = definition.id;
    renderFields(definition);
    const setValue = (fieldId, value) => { const control = fieldId === 'title' ? titleInput : byId(`field-${fieldId}`); if (control && value) control.value = value.trim(); };
    setValue('title', imported.querySelector('main h1')?.textContent || imported.querySelector('h1')?.textContent || '');
    setValue('description', imported.querySelector('meta[name="description"]')?.getAttribute('content') || '');
    setValue('subtitle', imported.querySelector('.page-subtitle')?.textContent || '');
    const relativePath = message.path.replace(/\\/g, '/');
    importedBaseDirectory = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '';
    blocks = extractContentBlocks(imported.querySelector('main'));
    const directory = relativePath.includes('/') ? relativePath.slice(0, relativePath.lastIndexOf('/')) : '.';
    directoryInput.value = directory;
    slugInput.value = relativePath.split('/').pop().replace(/\.html$/i, ''); slugWasEdited = true;
    importedPagePath = relativePath;
    Object.keys(imageSources).forEach(key => delete imageSources[key]);
    renderBlockEditor();
    updatePath(); showNotice(`Página importada: ${message.path}`, 'success'); requestPreview(false);
  }
  function validate(data) { if (!titleInput.value.trim()) return 'Informe o título da página.'; if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) return 'Slug inválido: use letras sem acento, números e hífens.'; if (!data.directory || data.directory.startsWith('/') || data.directory.includes('..')) return 'Informe uma pasta de destino relativa à raiz do site.'; for (const field of activeDefinition.fields) if (field.required && !data.fields[field.id] && !(field.type === 'image' && data.imageSources[field.id]?.length)) return `Preencha o campo obrigatório: ${field.label}.`; return ''; }
  catalog.templates.forEach(definition => { const option = document.createElement('option'); option.value = definition.id; option.textContent = definition.label; templateSelect.append(option); });
  templateSelect.addEventListener('change', () => renderFields(catalog.templates.find(item => item.id === templateSelect.value)));
  function refreshImageCards() { activeDefinition?.fields.filter(field => field.type === 'image' || field.type === 'imageList').forEach(field => renderImageValue(field.id)); }
  titleInput.addEventListener('input', () => { if (!slugWasEdited) slugInput.value = slugify(titleInput.value); const previewTitle = previewFrame.contentDocument?.querySelector('main h1'); if (previewTitle) previewTitle.textContent = titleInput.value; updatePath(); refreshImageCards(); }); slugInput.addEventListener('input', () => { slugWasEdited = true; updatePath(); refreshImageCards(); }); directoryInput.addEventListener('input', () => { updatePath(); refreshImageCards(); });
  byId('browse-directory').addEventListener('click', () => vscode?.postMessage({ command: 'pickDirectory' }));
  byId('preview-button').addEventListener('click', () => { if (pendingImageReads > 0) return showNotice('Aguarde o carregamento das imagens selecionadas.', 'error'); const data = collect(); const error = validate(data); if (error) return showNotice(error, 'error'); previewStatus.textContent = 'Gerando…'; vscode?.postMessage({ command: 'previewPage', ...data }); });
  form.addEventListener('submit', event => { event.preventDefault(); if (pendingImageReads > 0) return showNotice('Aguarde o carregamento das imagens selecionadas.', 'error'); const data = collect(); const error = validate(data); if (error) return showNotice(error, 'error'); byId('create-button').disabled = true; showNotice('Validando imagens e gerando a página…'); vscode?.postMessage({ command: 'createPage', ...data }); });
  window.addEventListener('message', event => { const message = event.data; if (message.command === 'pageImported') { importPage(message); } else if (message.command === 'imagesSelected') { imageSources[message.fieldId] = message.multiple ? [...(imageSources[message.fieldId] || []), ...message.images.filter(item => !(imageSources[message.fieldId] || []).some(existing => existing.sourcePath === item.sourcePath))] : message.images.slice(0, 1); const control = byId(`field-${message.fieldId}`); control.value = imageSources[message.fieldId].map(item => item.token).join('\n'); renderImageValue(message.fieldId); showNotice(`${message.images.length} imagem(ns) adicionada(s) à biblioteca da página.`); } else if (message.command === 'imageThumbnailsReady') { const selected = imageSources[message.fieldId] || []; message.thumbnails.forEach(item => { const target = selected.find(source => source.token === item.token); if (target) target.thumbnail = item.thumbnail; }); renderImageValue(message.fieldId); } else if (message.command === 'directorySelected') { directoryInput.value = message.directory; updatePath(); } else if (message.command === 'previewReady') { previewFrame.srcdoc = message.html; previewStatus.textContent = 'Atualizada agora'; } else if (message.command === 'error') { byId('create-button').disabled = false; previewStatus.textContent = 'Não disponível'; showNotice(message.message, 'error'); } else if (message.command === 'cancelled') { byId('create-button').disabled = false; showNotice('Publicação cancelada.'); } else if (message.command === 'created') { showNotice(`Página criada e aberta: ${message.path}`, 'success'); byId('create-button').disabled = false; } });
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
