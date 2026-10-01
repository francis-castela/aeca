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
    document.querySelector('.steps')?.remove();
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
    .editor-header, .general-page-creator .editor-header { display: none !important; }
    .steps, .sidebar-footer .steps, .general-page-creator .sidebar-footer .steps { display: none !important; }
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
  byId('preview-button').textContent = 'Pré-visualizar';
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
  previewEditToolbar.setAttribute('aria-label', 'Adicionar blocos ao conteúdo');
  const canvasState = document.createElement('span'); canvasState.className = 'canvas-state'; canvasState.textContent = 'Gere a prévia para editar o conteúdo';
  const addBlockType = document.createElement('select'); addBlockType.setAttribute('aria-label', 'Tipo de bloco');
  [
    ['paragraph','Parágrafo'],
    ['heading','Título de seção'],
    ['infobox','Bloco lateral (Infobox)'],
    ['ticketButton','Botão de ingresso (Sympla)'],
    ['ticketLots','Tabela de lotes'],
    ['whatsapp','Botão WhatsApp'],
    ['classification','Classificação indicativa'],
    ['quote','Citação'],
    ['list','Lista'],
    ['table','Tabela'],
    ['supporters','Apoiadores'],
    ['image','Imagem'],
    ['gallery','Galeria'],
    ['divider','Separador']
  ].forEach(([value,label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; addBlockType.append(option); });
  const addCanvasBlock = document.createElement('button'); addCanvasBlock.type = 'button'; addCanvasBlock.className = 'secondary'; addCanvasBlock.textContent = '+ Bloco'; addCanvasBlock.title = 'Adicionar bloco ao final do conteúdo';
  const canvasImageInput = document.createElement('input'); canvasImageInput.type = 'file'; canvasImageInput.accept = 'image/*'; canvasImageInput.multiple = true; canvasImageInput.hidden = true;

  const undoBtn = document.createElement('button'); undoBtn.type = 'button'; undoBtn.className = 'secondary'; undoBtn.textContent = '↶ Desfazer'; undoBtn.title = 'Desfazer (Ctrl+Z)'; undoBtn.disabled = true; undoBtn.addEventListener('click', () => undo());
  const redoBtn = document.createElement('button'); redoBtn.type = 'button'; redoBtn.className = 'secondary'; redoBtn.textContent = '↷ Refazer'; redoBtn.title = 'Refazer (Ctrl+Y)'; redoBtn.disabled = true; redoBtn.addEventListener('click', () => redo());

  function selectImages({ multiple = true, targetMode = 'new-image' } = {}) {
    if (vscode) {
      vscode.postMessage({ command: 'pickImages', multiple, targetMode });
    } else {
      canvasImageInput.dataset.targetMode = targetMode;
      canvasImageInput.multiple = multiple;
      if (multiple) canvasImageInput.setAttribute('multiple', 'multiple');
      else canvasImageInput.removeAttribute('multiple');
      canvasImageInput.click();
    }
  }

  addCanvasBlock.addEventListener('click', () => {
    const doc = previewFrame.contentDocument;
    if (!doc?.querySelector('main')) return showNotice('Gere a prévia antes de adicionar blocos.', 'error');
    if (['infobox', 'ticketButton', 'ticketLots', 'whatsapp', 'classification'].includes(addBlockType.value)) {
      blocks.push(makeBlock(addBlockType.value));
      renderBlockEditor();
      requestPreview(false);
      pushHistorySnapshot(true);
      const labels = {
        infobox: 'Bloco lateral (Infobox)',
        ticketButton: 'Botão de ingressos',
        ticketLots: 'Tabela de lotes',
        whatsapp: 'Botão WhatsApp',
        classification: 'Autoclassificação indicativa'
      };
      showNotice(`${labels[addBlockType.value] || 'Bloco'} adicionado ao conteúdo.`);
      return;
    }
    if (addBlockType.value === 'image') {
      selectImages({ multiple: false, targetMode: 'new-image' });
      return;
    }
    if (addBlockType.value === 'gallery') {
      selectImages({ multiple: true, targetMode: 'new-gallery' });
      return;
    }
    blocks.push(makeBlock(addBlockType.value));
    renderBlockEditor();
    requestPreview(false);
    pushHistorySnapshot(true);
  });

  addBlockType.addEventListener('change', () => { if (activeCanvasBlock) convertActiveCanvasBlock(addBlockType.value); });

  canvasImageInput.addEventListener('change', () => {
    const files = Array.from(canvasImageInput.files || []); if (!files.length) return;
    const mode = canvasImageInput.dataset.targetMode || 'new-image';
    const entries = files.map(file => ({ token: `@browser-image-${Date.now()}-${Math.random().toString(16).slice(2)}`, label: file.name, dataUrl: '' }));
    imageSources.media = [...(imageSources.media || []), ...entries];
    entries.forEach((entry, index) => {
      const reader = new FileReader(); pendingImageReads += 1;
      reader.onload = () => { entry.dataUrl = reader.result; pendingImageReads -= 1; if (!pendingImageReads) requestPreview(false); };
      reader.onerror = () => { pendingImageReads -= 1; showNotice(`Não foi possível carregar ${entry.label}.`, 'error'); };
      reader.readAsDataURL(files[index]);
    });
    if (mode === 'infobox-poster' && activeCanvasBlock) {
      const doc = previewFrame.contentDocument;
      let fig = activeCanvasBlock.querySelector('.show-infobox-poster');
      if (fig) {
        let img = fig.querySelector('img');
        if (!img) { img = doc.createElement('img'); fig.prepend(img); }
        img.src = entries[0].token;
        img.alt = entries[0].label;
        img.dataset.aecaOriginalSrc = entries[0].token;
      } else {
        fig = doc.createElement('figure');
        fig.className = 'show-infobox-poster';
        const img = doc.createElement('img');
        img.src = entries[0].token;
        img.alt = entries[0].label;
        img.dataset.aecaOriginalSrc = entries[0].token;
        const cap = doc.createElement('figcaption');
        cap.contentEditable = 'true';
        cap.textContent = 'Cartaz';
        fig.append(img, cap);
        activeCanvasBlock.prepend(fig);
      }
      syncPreviewToBlocks();
      pushHistorySnapshot(true);
      showNotice('Foto/cartaz adicionado ao bloco lateral.');
    } else if (mode === 'append-gallery' && activeCanvasBlock?.classList.contains('main-galeria')) {
      const doc = previewFrame.contentDocument;
      entries.forEach(entry => {
        const img = doc.createElement('img');
        img.src = entry.token;
        img.alt = entry.label;
        img.dataset.aecaOriginalSrc = entry.token;
        const addCard = activeCanvasBlock.querySelector('.aeca-gallery-add-card');
        if (addCard) addCard.before(wrapGalleryItem(img, doc)); else activeCanvasBlock.append(wrapGalleryItem(img, doc));
      });
      syncPreviewToBlocks();
      pushHistorySnapshot(true);
      showNotice(`${entries.length} foto(s) adicionada(s) à galeria.`);
    } else if (mode === 'replace-image' && activeCanvasBlock) {
      const targetImg = activeCanvasBlock.matches('img') ? activeCanvasBlock : activeCanvasBlock.querySelector('img');
      if (targetImg && entries[0]) {
        targetImg.src = entries[0].token;
        targetImg.alt = entries[0].label;
        targetImg.dataset.aecaOriginalSrc = entries[0].token;
        syncPreviewToBlocks();
        pushHistorySnapshot(true);
        showNotice('Imagem substituída.');
      }
    } else {
      blocks.push(mode === 'new-gallery' || entries.length > 1 ? { type: 'gallery', caption: '', images: entries.map(entry => ({ src: entry.token, alt: entry.label })) } : { type: 'image', src: entries[0].token, alt: entries[0].label, caption: '', width: '100%', align: 'center', aspectRatio: 'original', objectPosition: 'center' });
      renderBlockEditor();
      pushHistorySnapshot(true);
    }
    canvasImageInput.value = ''; canvasImageInput.dataset.targetMode = ''; canvasState.textContent = 'Carregando imagem…';
  });

  previewEditToolbar.append(addBlockType, addCanvasBlock, undoBtn, redoBtn, canvasImageInput);
  const toolbarSpacer = document.createElement('span'); toolbarSpacer.className = 'toolbar-spacer'; previewEditToolbar.append(toolbarSpacer, canvasState);
  previewPane?.querySelector('.preview-toolbar')?.after(previewEditToolbar);

  let activeCanvasBlock;
  let activeCanvasTable;
  let activeCanvasControls;
  let activeFloatingToolbar;
  let activeResizeHandles;
  let draggingCanvasBlock;
  let draggingGalleryItem;
  let draggingSupporterItem;

  const ICONS = {
    bold: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>',
    italic: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>',
    underline: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/></svg>',
    strike: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M14.4 6.75C14.07 6.27 13.4 6 12.5 6c-1.4 0-2.5.8-2.5 2 0 .8.5 1.3 1.5 1.6l1.2.4H3v2h9.7l2 .6c1.1.4 1.8 1.1 1.8 2.1 0 1.6-1.4 2.5-3 2.5-1.6 0-2.8-.7-3.4-1.7l-1.7 1.2c1 1.5 2.8 2.5 5.1 2.5 2.8 0 5-1.6 5-4.3 0-1.6-.9-2.8-2.5-3.4l-1.6-.6H21v-2H15l-1.1-.4c-.9-.3-1.4-.7-1.4-1.3 0-.7.6-1.1 1.5-1.1.7 0 1.3.2 1.8.6l1.6-1.5z"/></svg>',
    link: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>',
    alignLeft: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M15 15H3v2h12v-2zm0-8H3v2h12V7zM3 13h18v-2H3v2zm0 8h18v-2H3v2zM3 3v2h18V3H3z"/></svg>',
    alignCenter: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 15v2h10v-2H7zm-4 6h18v-2H3v2zm0-8h18v-2H3v2zm4-6v2h10V7H7zM3 3v2h18V3H3z"/></svg>',
    alignRight: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"/></svg>',
    alignJustify: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/></svg>',
    bulletList: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>',
    numberList: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"/></svg>'
  };

  const historyStack = [];
  let historyIndex = -1;
  const MAX_HISTORY = 60;
  let historyDebounceTimer = null;
  let isPerformingUndoRedo = false;

  function pushHistorySnapshot(immediate = false) {
    if (isPerformingUndoRedo) return;
    const save = () => {
      const snapshot = JSON.stringify(blocks);
      if (historyIndex >= 0 && historyStack[historyIndex] === snapshot) return;
      if (historyIndex < historyStack.length - 1) {
        historyStack.splice(historyIndex + 1);
      }
      historyStack.push(snapshot);
      if (historyStack.length > MAX_HISTORY) historyStack.shift();
      historyIndex = historyStack.length - 1;
      updateUndoRedoButtonStates();
    };
    if (immediate) {
      clearTimeout(historyDebounceTimer);
      historyDebounceTimer = null;
      save();
    } else {
      clearTimeout(historyDebounceTimer);
      historyDebounceTimer = setTimeout(save, 350);
    }
  }

  function undo() {
    if (historyDebounceTimer) {
      clearTimeout(historyDebounceTimer);
      historyDebounceTimer = null;
      const current = JSON.stringify(blocks);
      if (historyStack[historyIndex] !== current) {
        if (historyIndex < historyStack.length - 1) historyStack.splice(historyIndex + 1);
        historyStack.push(current);
        historyIndex = historyStack.length - 1;
      }
    }
    if (historyIndex > 0) {
      isPerformingUndoRedo = true;
      historyIndex -= 1;
      blocks = JSON.parse(historyStack[historyIndex]);
      renderBlockEditor();
      requestPreview(false);
      showNotice('Desfeito (Ctrl+Z)');
      updateUndoRedoButtonStates();
      setTimeout(() => { isPerformingUndoRedo = false; }, 350);
      return true;
    }
    showNotice('Nada para desfazer.');
    return false;
  }

  function redo() {
    if (historyIndex < historyStack.length - 1) {
      isPerformingUndoRedo = true;
      historyIndex += 1;
      blocks = JSON.parse(historyStack[historyIndex]);
      renderBlockEditor();
      requestPreview(false);
      showNotice('Refeito (Ctrl+Y)');
      updateUndoRedoButtonStates();
      setTimeout(() => { isPerformingUndoRedo = false; }, 350);
      return true;
    }
    showNotice('Nada para refazer.');
    return false;
  }

  function updateUndoRedoButtonStates() {
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
  }

  function handleUndoRedoKey(event) {
    const isMac = navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
    if (!isCmdOrCtrl) return;
    const key = event.key.toLowerCase();
    if (key === 'z' && !event.shiftKey) {
      const activeEl = event.target;
      const isFormInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !activeEl.closest('#preview-frame');
      if (isFormInput) return;
      event.preventDefault();
      event.stopPropagation();
      undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      const activeEl = event.target;
      const isFormInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && !activeEl.closest('#preview-frame');
      if (isFormInput) return;
      event.preventDefault();
      event.stopPropagation();
      redo();
    }
  }
  window.addEventListener('keydown', handleUndoRedoKey, true);

  function applyCanvasCommand(command, arg = null) {
    const doc = previewFrame.contentDocument;
    if (!doc?.querySelector('main')) return showNotice('Gere a prévia para editar o conteúdo.', 'error');
    doc.execCommand(command, false, arg);
    syncPreviewToBlocks();
  }

  function animateBlockSwap(nodeA, nodeB, callback) {
    const doc = previewFrame.contentDocument;
    if (!nodeA || !doc) { callback(); return; }
    const rectA1 = nodeA.getBoundingClientRect();
    const rectB1 = nodeB ? nodeB.getBoundingClientRect() : null;
    callback();
    const rectA2 = nodeA.getBoundingClientRect();
    const rectB2 = nodeB ? nodeB.getBoundingClientRect() : null;
    const deltaYA = rectA1.top - rectA2.top;
    nodeA.style.transform = `translateY(${deltaYA}px)`;
    nodeA.style.transition = 'none';
    if (nodeB && rectB2) {
      const deltaYB = rectB1.top - rectB2.top;
      nodeB.style.transform = `translateY(${deltaYB}px)`;
      nodeB.style.transition = 'none';
    }
    requestAnimationFrame(() => {
      nodeA.style.transition = 'transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.28s ease';
      nodeA.style.transform = '';
      nodeA.classList.add('aeca-block-animated');
      if (nodeB) {
        nodeB.style.transition = 'transform 0.28s cubic-bezier(0.2, 0, 0, 1)';
        nodeB.style.transform = '';
      }
      setTimeout(() => {
        nodeA.style.transition = '';
        nodeA.classList.remove('aeca-block-animated');
        if (nodeB) nodeB.style.transition = '';
        repositionCanvasOverlays();
      }, 300);
    });
  }

  function repositionCanvasOverlays() {
    if (!activeCanvasBlock?.isConnected) {
      activeCanvasControls?.remove(); activeCanvasControls = null;
      activeFloatingToolbar?.remove(); activeFloatingToolbar = null;
      activeResizeHandles?.remove(); activeResizeHandles = null;
      return;
    }
    const block = activeCanvasBlock;
    if (activeCanvasControls) {
      const top = block.offsetTop;
      if (block.offsetLeft >= 46) {
        activeCanvasControls.style.top = `${top}px`;
        activeCanvasControls.style.left = `${Math.max(2, block.offsetLeft - 44)}px`;
      } else {
        activeCanvasControls.style.top = `${top}px`;
        activeCanvasControls.style.left = `${block.offsetLeft + block.offsetWidth + 6}px`;
      }
    }
    if (activeFloatingToolbar) {
      const topPos = block.offsetTop >= 44 ? block.offsetTop - 42 : block.offsetTop + 4;
      activeFloatingToolbar.style.top = `${Math.max(4, topPos)}px`;
      activeFloatingToolbar.style.left = `${Math.max(8, block.offsetLeft)}px`;
    }
  }

  function setupImageResizeHandles(figure, doc) {
    activeResizeHandles?.remove(); activeResizeHandles = null;
    const img = figure.querySelector('img');
    if (!img) return;
    const wrap = doc.createElement('div'); wrap.className = 'aeca-resize-overlay'; wrap.contentEditable = 'false';
    ['se', 'sw'].forEach(pos => {
      const handle = doc.createElement('div'); handle.className = `aeca-resize-handle ${pos}`; handle.title = 'Arrastar para redimensionar';
      handle.addEventListener('mousedown', event => {
        event.preventDefault(); event.stopPropagation();
        const startX = event.clientX; const startWidth = figure.offsetWidth;
        const mainWidth = (figure.closest('main') || doc.body).clientWidth || 800;
        const tooltip = doc.createElement('div'); tooltip.className = 'aeca-resize-tooltip'; wrap.append(tooltip);
        const onMouseMove = moveEvent => {
          const deltaX = pos === 'se' ? (moveEvent.clientX - startX) : (startX - moveEvent.clientX);
          const newWidthPx = Math.max(120, Math.min(mainWidth, startWidth + deltaX));
          const newPercent = Math.round((newWidthPx / mainWidth) * 100);
          figure.style.maxWidth = `${newPercent}%`;
          figure.style.width = '100%';
          figure.dataset.width = `${newPercent}%`;
          tooltip.textContent = `${newWidthPx}px (${newPercent}%)`;
          repositionCanvasOverlays();
        };
        const onMouseUp = () => {
          doc.removeEventListener('mousemove', onMouseMove);
          doc.removeEventListener('mouseup', onMouseUp);
          tooltip.remove();
          syncPreviewToBlocks();
        };
        doc.addEventListener('mousemove', onMouseMove);
        doc.addEventListener('mouseup', onMouseUp);
      });
      wrap.append(handle);
    });
    figure.append(wrap);
    activeResizeHandles = wrap;
  }

  function wrapGalleryItem(img, doc) {
    if (img.parentElement?.classList.contains('aeca-gallery-item-wrap')) return img.parentElement;
    const wrap = doc.createElement('div'); wrap.className = 'aeca-gallery-item-wrap'; wrap.draggable = true;
    const tools = doc.createElement('div'); tools.className = 'aeca-photo-tools'; tools.contentEditable = 'false';
    const delBtn = doc.createElement('button'); delBtn.type = 'button'; delBtn.className = 'danger'; delBtn.textContent = '×'; delBtn.title = 'Remover foto';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      wrap.style.transform = 'scale(0.8)'; wrap.style.opacity = '0'; wrap.style.transition = 'all 0.2s ease';
      setTimeout(() => { wrap.remove(); syncPreviewToBlocks(); pushHistorySnapshot(true); }, 200);
    });
    tools.append(delBtn);
    wrap.addEventListener('dragstart', event => { draggingGalleryItem = wrap; event.dataTransfer.setData('text/plain', 'aeca-gallery-photo'); wrap.classList.add('aeca-photo-dragging'); });
    wrap.addEventListener('dragend', () => { wrap.classList.remove('aeca-photo-dragging'); draggingGalleryItem = null; syncPreviewToBlocks(); pushHistorySnapshot(true); });
    wrap.addEventListener('dragover', event => {
      if (!draggingGalleryItem || draggingGalleryItem === wrap) return;
      event.preventDefault();
      const bounds = wrap.getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width / 2) wrap.before(draggingGalleryItem); else wrap.after(draggingGalleryItem);
    });
    img.before(wrap); wrap.append(img, tools);
    return wrap;
  }

  function setupGalleryInteractions(gallery, doc) {
    gallery.querySelectorAll('img').forEach(img => wrapGalleryItem(img, doc));
    if (!gallery.querySelector('.aeca-gallery-add-card')) {
      const addCard = doc.createElement('div'); addCard.className = 'aeca-gallery-add-card'; addCard.contentEditable = 'false'; addCard.innerHTML = '<span style="font-size:20px;line-height:1">+</span><span>Adicionar fotos</span>';
      addCard.addEventListener('click', () => {
        selectImages({ multiple: true, targetMode: 'append-gallery' });
      });
      gallery.append(addCard);
    }
  }

  function wrapSupporterItem(li, doc) {
    if (!li || li.classList.contains('aeca-supporter-add-card-wrap')) return li;
    if (li.dataset.aecaWrapped === 'true') return li;
    li.dataset.aecaWrapped = 'true';
    li.classList.add('aeca-supporter-item-wrap');
    li.draggable = true;
    li.style.position = 'relative';

    if (!li.querySelector('.aeca-supporter-tools')) {
      const tools = doc.createElement('div');
      tools.className = 'aeca-supporter-tools';
      tools.contentEditable = 'false';
      const delBtn = doc.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'danger';
      delBtn.textContent = '×';
      delBtn.title = 'Remover apoiador';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        li.style.transform = 'scale(0.8)';
        li.style.opacity = '0';
        li.style.transition = 'all 0.2s ease';
        setTimeout(() => {
          li.remove();
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
        }, 200);
      });
      tools.append(delBtn);
      li.append(tools);
    }

    li.addEventListener('dragstart', event => {
      draggingSupporterItem = li;
      event.dataTransfer.setData('text/plain', 'aeca-supporter-card');
      li.classList.add('aeca-supporter-dragging');
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('aeca-supporter-dragging');
      draggingSupporterItem = null;
      syncPreviewToBlocks();
      pushHistorySnapshot(true);
    });
    li.addEventListener('dragover', event => {
      if (!draggingSupporterItem || draggingSupporterItem === li) return;
      event.preventDefault();
      const bounds = li.getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width / 2) {
        li.before(draggingSupporterItem);
      } else {
        li.after(draggingSupporterItem);
      }
    });

    return li;
  }

  function setupSupportersInteractions(grid, doc) {
    grid.querySelectorAll(':scope > li').forEach(li => {
      if (!li.classList.contains('aeca-supporter-add-card-wrap')) {
        wrapSupporterItem(li, doc);
        li.querySelectorAll('.apoio-categoria, strong, .apoio-card').forEach(el => {
          el.contentEditable = 'true';
          el.spellcheck = true;
        });
      }
    });

    if (!grid.querySelector('.aeca-supporter-add-card-wrap')) {
      const addLi = doc.createElement('li');
      addLi.className = 'aeca-supporter-add-card-wrap';
      addLi.contentEditable = 'false';
      const addCard = doc.createElement('div');
      addCard.className = 'aeca-supporter-add-card';
      addCard.innerHTML = '<span style="font-size:22px;line-height:1">+</span><span>Adicionar apoiador</span>';
      addCard.addEventListener('click', () => {
        const newLi = doc.createElement('li');
        newLi.className = 'aeca-supporter-item-wrap';
        const card = doc.createElement('div');
        card.className = 'apoio-card';
        const cat = doc.createElement('span');
        cat.className = 'apoio-categoria';
        cat.contentEditable = 'true';
        cat.textContent = 'INSTITUCIONAL';
        const strong = doc.createElement('strong');
        strong.contentEditable = 'true';
        strong.textContent = 'Novo Apoiador';
        card.append(cat, strong);
        newLi.append(card);
        wrapSupporterItem(newLi, doc);
        addLi.before(newLi);
        strong.focus();
        syncPreviewToBlocks();
        pushHistorySnapshot(true);
      });
      addLi.append(addCard);
      grid.append(addLi);
    }
  }

  function setActiveCanvasBlock(block, table) {
    const doc = previewFrame.contentDocument;
    if (!doc) return;
    activeCanvasControls?.remove(); activeCanvasControls = null;
    activeFloatingToolbar?.remove(); activeFloatingToolbar = null;
    activeResizeHandles?.remove(); activeResizeHandles = null;
    doc.querySelectorAll('.aeca-active-block').forEach(el => el.classList.remove('aeca-active-block'));

    activeCanvasBlock = block || null; activeCanvasTable = table || null;
    if (!activeCanvasBlock || activeCanvasBlock.tagName === 'H1' || activeCanvasBlock.classList.contains('aeca-canvas-controls') || activeCanvasBlock.classList.contains('aeca-floating-toolbar')) return;

    activeCanvasBlock.classList.add('aeca-active-block');
    const tag = activeCanvasBlock.tagName;
    const isTicketBtn = activeCanvasBlock.matches('a.btn-cta-sympla, a.btn-cta-ticket') || activeCanvasBlock.classList.contains('btn-cta-sympla') || activeCanvasBlock.classList.contains('btn-cta-ticket');
    const isWhatsapp = activeCanvasBlock.classList.contains('whatsapp-cta-block') || activeCanvasBlock.classList.contains('btn-cta-whatsapp');
    const isTicketLots = activeCanvasBlock.classList.contains('lotes-secao') || activeCanvasBlock.classList.contains('lotes-layout');
    const isClassification = activeCanvasBlock.classList.contains('classificacao-bloco') || activeCanvasBlock.classList.contains('classificacao-box');

    const type = isTicketBtn ? 'ticketButton' : isWhatsapp ? 'whatsapp' : isTicketLots ? 'ticketLots' : isClassification ? 'classification' : activeCanvasBlock.classList.contains('show-infobox') ? 'infobox' : activeCanvasBlock.classList.contains('apoio-grid') ? 'supporters' : activeCanvasBlock.classList.contains('main-galeria') ? 'gallery' : tag === 'TABLE' ? 'table' : tag === 'UL' || tag === 'OL' ? 'list' : /^H[2-6]$/.test(tag) ? 'heading' : tag === 'BLOCKQUOTE' ? 'quote' : tag === 'FIGURE' || tag === 'IMG' ? 'image' : tag === 'HR' ? 'divider' : 'paragraph';
    if (Array.from(addBlockType.options).some(option => option.value === type)) addBlockType.value = type;

    // 1. Controles laterais (↑, ↓, ⠿, ×)
    const sideTools = doc.createElement('div');
    sideTools.className = 'aeca-canvas-controls';
    sideTools.contentEditable = 'false';
    sideTools.setAttribute('role', 'toolbar');
    sideTools.setAttribute('aria-label', 'Posição e remoção do bloco');

    const sideButton = (text, label, callback, draggable = false) => {
      const action = doc.createElement('button'); action.type = 'button'; action.textContent = text; action.title = label; action.setAttribute('aria-label', label); action.contentEditable = 'false';
      if (draggable) {
        action.draggable = true;
        action.addEventListener('dragstart', event => {
          draggingCanvasBlock = activeCanvasBlock;
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', 'aeca-canvas-block');
          draggingCanvasBlock.classList.add('aeca-block-dragging');
        });
        action.addEventListener('dragend', () => {
          draggingCanvasBlock?.classList.remove('aeca-block-dragging');
          draggingCanvasBlock = null;
          doc.querySelectorAll('.aeca-drop-line').forEach(el => el.remove());
          syncPreviewToBlocks();
          repositionCanvasOverlays();
        });
      } else {
        action.addEventListener('mousedown', event => event.preventDefault());
        action.addEventListener('click', callback);
      }
      sideTools.append(action);
      return action;
    };

    const moveBlock = direction => {
      const current = activeCanvasBlock;
      if (direction < 0) {
        let prev = current.previousElementSibling;
        while (prev && (prev.tagName === 'STYLE' || prev.classList.contains('aeca-canvas-controls') || prev.classList.contains('aeca-floating-toolbar') || prev.classList.contains('aeca-drop-line'))) prev = prev.previousElementSibling;
        if (!prev || prev.tagName === 'H1') return;
        animateBlockSwap(current, prev, () => prev.before(current));
      } else {
        let next = current.nextElementSibling;
        while (next && (next.classList.contains('aeca-canvas-controls') || next.classList.contains('aeca-floating-toolbar') || next.classList.contains('aeca-drop-line'))) next = next.nextElementSibling;
        if (!next) return;
        animateBlockSwap(current, next, () => next.after(current));
      }
      syncPreviewToBlocks();
    };

    sideButton('↑', 'Mover bloco para cima', () => moveBlock(-1));
    sideButton('↓', 'Mover bloco para baixo', () => moveBlock(1));
    sideButton('⠿', 'Arrastar bloco', () => {}, true);
    sideButton('×', 'Remover bloco', () => {
      const removed = activeCanvasBlock;
      activeCanvasBlock = null;
      sideTools.remove();
      activeFloatingToolbar?.remove();
      removed.style.transform = 'scale(0.85)'; removed.style.opacity = '0'; removed.style.transition = 'all 0.22s ease';
      setTimeout(() => { removed.remove(); syncPreviewToBlocks(); }, 220);
    });

    const mainNode = doc.querySelector('main') || doc.body;
    mainNode.append(sideTools);
    activeCanvasControls = sideTools;

    // 2. Barra flutuante contextual logo acima do bloco ativo
    const floating = doc.createElement('div');
    floating.className = 'aeca-floating-toolbar';
    floating.contentEditable = 'false';
    floating.setAttribute('role', 'toolbar');
    floating.setAttribute('aria-label', 'Opções do bloco');

    const floatBtn = (text, title, onClick, className = '', parent = floating) => {
      const b = doc.createElement('button'); b.type = 'button'; b.className = className; b.textContent = text; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', onClick);
      parent.append(b);
      return b;
    };
    const iconBtn = (svgHtml, title, onClick, parent = floating) => {
      const b = doc.createElement('button');
      b.type = 'button';
      b.className = 'aeca-doc-btn';
      b.innerHTML = svgHtml;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', onClick);
      parent.append(b);
      return b;
    };
    const floatSep = (parent = floating) => { const s = doc.createElement('span'); s.className = 'toolbar-sep'; parent.append(s); };
    const floatLabel = (text, parent = floating) => { const l = doc.createElement('span'); l.className = 'toolbar-label'; l.textContent = text; parent.append(l); };

    const applyAlignment = (align) => {
      const cmd = align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : align === 'justify' ? 'justifyFull' : 'justifyLeft';
      try { doc.execCommand(cmd, false, null); } catch {}
      if (activeCanvasBlock && ['P', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI'].includes(activeCanvasBlock.tagName)) {
        activeCanvasBlock.style.textAlign = align;
        activeCanvasBlock.dataset.align = align;
      }
      syncPreviewToBlocks();
      pushHistorySnapshot(true);
    };

    const renderGoogleDocsToolbar = (parent = floating) => {
      iconBtn(ICONS.bold, 'Negrito', () => applyCanvasCommand('bold'), parent);
      iconBtn(ICONS.italic, 'Itálico', () => applyCanvasCommand('italic'), parent);
      iconBtn(ICONS.underline, 'Sublinhado', () => applyCanvasCommand('underline'), parent);
      iconBtn(ICONS.strike, 'Tachado', () => applyCanvasCommand('strikeThrough'), parent);

      floatSep(parent);

      const linkBox = doc.createElement('span');
      linkBox.className = 'aeca-link-box';
      let savedLinkRange = null;
      iconBtn(ICONS.link, 'Inserir link', () => {
        const sel = doc.getSelection();
        if (!sel?.rangeCount || sel.isCollapsed) return showNotice('Selecione o texto que receberá o link.', 'error');
        savedLinkRange = sel.getRangeAt(0).cloneRange();
        linkPopover.style.display = 'inline-flex';
        linkInput.value = 'https://';
        linkInput.focus();
        linkInput.select();
      }, linkBox);

      const linkPopover = doc.createElement('span');
      linkPopover.className = 'aeca-link-popover';
      linkPopover.style.display = 'none';

      const linkInput = doc.createElement('input');
      linkInput.type = 'url';
      linkInput.placeholder = 'https://…';
      linkInput.className = 'aeca-link-url-input';

      const linkApply = doc.createElement('button');
      linkApply.type = 'button';
      linkApply.className = 'aeca-doc-btn';
      linkApply.textContent = '✓';
      linkApply.title = 'Aplicar link';
      linkApply.addEventListener('mousedown', e => e.preventDefault());
      linkApply.addEventListener('click', () => {
        const url = linkInput.value.trim();
        if (url && savedLinkRange) {
          const sel = doc.getSelection();
          sel.removeAllRanges();
          sel.addRange(savedLinkRange);
          doc.execCommand('createLink', false, url);
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
        }
        linkPopover.style.display = 'none';
      });

      const linkCancel = doc.createElement('button');
      linkCancel.type = 'button';
      linkCancel.className = 'aeca-doc-btn';
      linkCancel.textContent = '✕';
      linkCancel.title = 'Cancelar link';
      linkCancel.addEventListener('mousedown', e => e.preventDefault());
      linkCancel.addEventListener('click', () => {
        linkPopover.style.display = 'none';
      });

      linkPopover.append(linkInput, linkApply, linkCancel);
      linkBox.append(linkPopover);
      parent.append(linkBox);

      floatSep(parent);

      iconBtn(ICONS.alignLeft, 'Alinhar à esquerda', () => applyAlignment('left'), parent);
      iconBtn(ICONS.alignCenter, 'Centralizar', () => applyAlignment('center'), parent);
      iconBtn(ICONS.alignRight, 'Alinhar à direita', () => applyAlignment('right'), parent);
      iconBtn(ICONS.alignJustify, 'Justificar', () => applyAlignment('justify'), parent);

      floatSep(parent);

      iconBtn(ICONS.bulletList, 'Lista com marcadores', () => applyCanvasCommand('insertUnorderedList'), parent);
      iconBtn(ICONS.numberList, 'Lista numerada', () => applyCanvasCommand('insertOrderedList'), parent);
    };

    if (type === 'image') {
      const fig = activeCanvasBlock.matches('figure') ? activeCanvasBlock : activeCanvasBlock.closest('figure') || activeCanvasBlock;
      const targetImg = fig.querySelector('img') || fig;
      setupImageResizeHandles(fig, doc);

      floatLabel('Tamanho:');
      ['25%', '50%', '75%', '100%'].forEach(pct => {
        floatBtn(pct, `Definir largura em ${pct}`, () => {
          fig.style.maxWidth = pct;
          fig.style.width = '100%';
          fig.dataset.width = pct;
          syncPreviewToBlocks();
          repositionCanvasOverlays();
        });
      });

      floatSep();
      floatLabel('Alinhamento:');
      floatBtn('⫷', 'Alinhar à esquerda', () => {
        fig.style.marginLeft = '0'; fig.style.marginRight = 'auto'; fig.dataset.align = 'left';
        syncPreviewToBlocks(); repositionCanvasOverlays();
      });
      floatBtn('☷', 'Centralizar imagem', () => {
        fig.style.marginLeft = 'auto'; fig.style.marginRight = 'auto'; fig.dataset.align = 'center';
        syncPreviewToBlocks(); repositionCanvasOverlays();
      });
      floatBtn('⫸', 'Alinhar à direita', () => {
        fig.style.marginLeft = 'auto'; fig.style.marginRight = '0'; fig.dataset.align = 'right';
        syncPreviewToBlocks(); repositionCanvasOverlays();
      });

      floatSep();
      floatLabel('✂ Corte:');
      const cropSelect = doc.createElement('select'); cropSelect.setAttribute('aria-label', 'Proporção e corte da imagem');
      [['original', 'Original'], ['1/1', '1:1 (Quadrado)'], ['16/9', '16:9 (Widescreen)'], ['4/3', '4:3 (Padrão)'], ['4/5', '4:5 (Retrato)']].forEach(([val, lbl]) => {
        const opt = doc.createElement('option'); opt.value = val; opt.textContent = lbl; cropSelect.append(opt);
      });
      cropSelect.value = targetImg.dataset.aspectRatio || targetImg.style.aspectRatio || 'original';
      cropSelect.addEventListener('change', () => {
        if (cropSelect.value === 'original') {
          targetImg.style.aspectRatio = ''; targetImg.style.objectFit = ''; targetImg.dataset.aspectRatio = '';
        } else {
          targetImg.style.aspectRatio = cropSelect.value; targetImg.style.objectFit = 'cover'; targetImg.dataset.aspectRatio = cropSelect.value;
        }
        syncPreviewToBlocks(); repositionCanvasOverlays();
      });
      floating.append(cropSelect);

      floatBtn('⬆', 'Foco no topo da imagem', () => { targetImg.style.objectPosition = 'top'; targetImg.dataset.objectPosition = 'top'; syncPreviewToBlocks(); });
      floatBtn('⏺', 'Foco no centro da imagem', () => { targetImg.style.objectPosition = 'center'; targetImg.dataset.objectPosition = 'center'; syncPreviewToBlocks(); });
      floatBtn('⬇', 'Foco na base da imagem', () => { targetImg.style.objectPosition = 'bottom'; targetImg.dataset.objectPosition = 'bottom'; syncPreviewToBlocks(); });

      floatSep();
      floatBtn('Legenda', 'Adicionar ou editar legenda', () => {
        let cap = fig.querySelector('figcaption');
        if (!cap) { cap = doc.createElement('figcaption'); cap.contentEditable = 'true'; cap.textContent = 'Legenda da foto'; fig.append(cap); }
        cap.focus(); syncPreviewToBlocks();
      });
      floatBtn('Trocar', 'Substituir imagem', () => {
        selectImages({ multiple: false, targetMode: 'replace-image' });
      });
    } else if (type === 'gallery') {
      setupGalleryInteractions(activeCanvasBlock, doc);
      floatBtn('+ Adicionar fotos', 'Adicionar novas fotos a esta galeria', () => {
        selectImages({ multiple: true, targetMode: 'append-gallery' });
      }, 'primary-btn');
      const photoCount = activeCanvasBlock.querySelectorAll('img').length;
      floatLabel(`📷 ${photoCount} foto(s)`);
    } else if (type === 'supporters') {
      setupSupportersInteractions(activeCanvasBlock, doc);
      floatBtn('+ Adicionar apoiador', 'Adicionar novo apoiador a este bloco', () => {
        const addCard = activeCanvasBlock.querySelector('.aeca-supporter-add-card');
        if (addCard) addCard.click();
      }, 'primary-btn');
      const count = activeCanvasBlock.querySelectorAll(':scope > li:not(.aeca-supporter-add-card-wrap)').length;
      floatLabel(`🏢 ${count} apoiador(es)`);
    } else if (type === 'ticketButton') {
      floatLabel('🎟 Ingresso:');
      const targetLink = activeCanvasBlock.matches('a') ? activeCanvasBlock : activeCanvasBlock.querySelector('a');
      const urlBox = doc.createElement('span');
      urlBox.className = 'aeca-link-box';
      const urlInput = doc.createElement('input');
      urlInput.type = 'url';
      urlInput.placeholder = 'https://www.sympla.com.br/...';
      urlInput.value = targetLink?.getAttribute('href') || 'https://www.sympla.com.br/';
      urlInput.className = 'aeca-link-url-input';
      urlInput.style.width = '240px';
      urlInput.title = 'Link de compra do ingresso';
      urlInput.addEventListener('input', () => {
        if (targetLink) {
          targetLink.setAttribute('href', urlInput.value.trim() || '#');
          targetLink.dataset.url = urlInput.value.trim();
          syncPreviewToBlocks();
          pushHistorySnapshot(false);
        }
      });
      urlBox.append(urlInput);
      floating.append(urlBox);
    } else if (type === 'whatsapp') {
      floatLabel('💬 WhatsApp:');
      const targetLink = activeCanvasBlock.matches('a.btn-cta-whatsapp') ? activeCanvasBlock : activeCanvasBlock.querySelector('a.btn-cta-whatsapp');
      const urlBox = doc.createElement('span');
      urlBox.className = 'aeca-link-box';
      const urlInput = doc.createElement('input');
      urlInput.type = 'url';
      urlInput.placeholder = 'https://wa.me/5547997085692';
      urlInput.value = targetLink?.getAttribute('href') || 'https://wa.me/5547997085692';
      urlInput.className = 'aeca-link-url-input';
      urlInput.style.width = '210px';
      urlInput.title = 'Link do WhatsApp';
      urlInput.addEventListener('input', () => {
        if (targetLink) {
          targetLink.setAttribute('href', urlInput.value.trim() || '#');
          targetLink.dataset.url = urlInput.value.trim();
          syncPreviewToBlocks();
          pushHistorySnapshot(false);
        }
      });
      urlBox.append(urlInput);
      floating.append(urlBox);
    } else if (type === 'ticketLots') {
      floatLabel('🏷 Tabela de Lotes');
      floatBtn('+ Lote', 'Adicionar novo lote de ingressos', () => {
        const table = activeCanvasBlock.querySelector('table.tabela-precos, table');
        if (!table) return;
        const tbody = table.querySelector('tbody') || table.createTBody();
        const count = tbody.querySelectorAll('tr').length + 1;
        const tr = tbody.insertRow();
        const th = doc.createElement('th');
        th.scope = 'row';
        th.contentEditable = 'true';
        th.innerHTML = `${count}º LOTE<br><span class="lote-vigencia">Período de datas</span>`;
        const td1 = tr.insertCell();
        td1.setAttribute('data-label', 'Inteira');
        td1.contentEditable = 'true';
        td1.innerHTML = '<span class="preco-valor">R$ 50,00</span><span class="preco-taxa">+ R$ 5,00 taxa</span>';
        const td2 = tr.insertCell();
        td2.setAttribute('data-label', 'Meia');
        td2.contentEditable = 'true';
        td2.innerHTML = '<span class="preco-valor">R$ 25,00</span><span class="preco-taxa">+ R$ 3,99 taxa</span>';
        tr.prepend(th);
        syncPreviewToBlocks();
        pushHistorySnapshot(true);
        repositionCanvasOverlays();
      }, 'primary-btn');
      floatBtn('− Lote', 'Remover último lote', () => {
        const rows = activeCanvasBlock.querySelectorAll('table.tabela-precos tbody tr, table tbody tr');
        if (rows.length > 1) {
          rows[rows.length - 1].remove();
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
          repositionCanvasOverlays();
        } else {
          showNotice('A tabela precisa manter ao menos um lote.');
        }
      });
    } else if (type === 'classification') {
      floatLabel('🔞 Classificação:');
      const targetImg = activeCanvasBlock.querySelector('.classificacao-box img, img');
      const targetDesc = activeCanvasBlock.querySelector('.classificacao-texto p:first-of-type');
      const select = doc.createElement('select');
      select.setAttribute('aria-label', 'Faixa etária da autoclassificação');
      [
        ['livre', 'Livre'],
        ['6', '6 anos'],
        ['10', '10 anos'],
        ['12', '12 anos'],
        ['14', '14 anos'],
        ['16', '16 anos'],
        ['18', '18 anos']
      ].forEach(([val, lbl]) => {
        const opt = doc.createElement('option');
        opt.value = val;
        opt.textContent = lbl;
        select.append(opt);
      });
      const currentRating = targetImg?.dataset?.rating || activeCanvasBlock?.dataset?.rating;
      let matchedRating = currentRating;
      if (!matchedRating) {
        const currentSrc = targetImg?.getAttribute('src') || '';
        const currentMatch = currentSrc.match(/classificacao-([a-z0-9]+)\.png/i);
        if (currentMatch) {
          matchedRating = currentMatch[1].toLowerCase();
        } else {
          const altMatch = (targetImg?.getAttribute('alt') || '').match(/(?:livre|\d+)/i);
          matchedRating = altMatch ? altMatch[0].toLowerCase() : '14';
        }
      }
      select.value = matchedRating || '14';
      select.addEventListener('change', () => {
        const val = select.value;
        const classifications = window.AECA_CLASSIFICATIONS || {};
        const newSrc = classifications[val] || `/css/classificacao/classificacao-${val}.png`;
        if (targetImg) {
          targetImg.src = newSrc;
          targetImg.alt = `Classificação indicativa ${val === 'livre' ? 'livre' : `${val} anos`}`;
          targetImg.dataset.rating = val;
        }
        if (targetDesc && (targetDesc.textContent.includes('recomendado') || targetDesc.textContent.includes('Livre'))) {
          targetDesc.textContent = val === 'livre' ? 'Livre para todos os públicos.' : `Não recomendado para menores de ${val} anos.`;
        }
        activeCanvasBlock.dataset.rating = val;
        syncPreviewToBlocks();
        pushHistorySnapshot(true);
        repositionCanvasOverlays();
      });
      floating.append(select);
    } else if (type === 'table') {
      floatBtn('+ Linha', 'Adicionar linha', () => {
        const table = activeCanvasBlock.matches('table') ? activeCanvasBlock : activeCanvasBlock.closest('table');
        if (!table) return;
        const row = table.tBodies[0]?.insertRow(); if (!row) return;
        const cols = table.rows[0]?.cells.length || 2;
        for (let c = 0; c < cols; c += 1) { const cell = row.insertCell(); cell.contentEditable = 'true'; cell.innerHTML = '<br>'; }
        syncPreviewToBlocks();
      });
      floatBtn('− Linha', 'Remover linha selecionada', () => {
        const sel = doc.getSelection(); let node = sel?.anchorNode;
        if (node?.nodeType !== Node.ELEMENT_NODE) node = node?.parentElement;
        const row = node?.closest('tr');
        if (row && row.parentElement.tagName === 'TBODY' && row.parentElement.rows.length > 1) { row.remove(); syncPreviewToBlocks(); }
      });
      floatBtn('+ Coluna', 'Adicionar coluna', () => {
        const table = activeCanvasBlock.matches('table') ? activeCanvasBlock : activeCanvasBlock.closest('table');
        if (!table) return;
        Array.from(table.rows).forEach(row => {
          const cell = row.insertCell();
          if (row.parentElement.tagName === 'THEAD') { cell.outerHTML = '<th scope="col" contenteditable="true">Nova coluna</th>'; }
          else { cell.contentEditable = 'true'; cell.innerHTML = '<br>'; }
        });
        syncPreviewToBlocks();
      });
      floatBtn('− Coluna', 'Remover coluna', () => {
        const sel = doc.getSelection(); let node = sel?.anchorNode;
        if (node?.nodeType !== Node.ELEMENT_NODE) node = node?.parentElement;
        const cell = node?.closest('th,td');
        const table = activeCanvasBlock.matches('table') ? activeCanvasBlock : activeCanvasBlock.closest('table');
        if (cell && table && cell.parentElement.cells.length > 1) {
          const idx = cell.cellIndex;
          Array.from(table.rows).forEach(row => row.cells[idx]?.remove());
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
        }
      });
      floatSep();
      renderGoogleDocsToolbar(floating);
    } else if (type === 'infobox') {
      floatLabel('Bloco lateral (Infobox)');
      floatBtn('+ Linha', 'Adicionar nova linha à ficha', () => {
        let table = activeCanvasBlock.querySelector('table.show-infobox-meta') || activeCanvasBlock.querySelector('table');
        if (!table) {
          table = doc.createElement('table');
          table.className = 'show-infobox-meta';
          table.append(doc.createElement('tbody'));
          activeCanvasBlock.append(table);
        }
        let tbody = table.querySelector('tbody') || table.createTBody();
        const row = tbody.insertRow();
        const th = doc.createElement('th'); th.scope = 'row'; th.contentEditable = 'true'; th.textContent = 'Novo item';
        const td = row.insertCell(); td.contentEditable = 'true'; td.textContent = 'Detalhe';
        row.prepend(th);
        syncPreviewToBlocks();
        pushHistorySnapshot(true);
        repositionCanvasOverlays();
      });
      floatBtn('− Linha', 'Remover linha da ficha', () => {
        const sel = doc.getSelection(); let node = sel?.anchorNode;
        if (node?.nodeType !== Node.ELEMENT_NODE) node = node?.parentElement;
        const row = node?.closest('tr');
        if (row && row.closest('.show-infobox-meta')) {
          row.remove();
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
          repositionCanvasOverlays();
        } else {
          const rows = activeCanvasBlock.querySelectorAll('.show-infobox-meta tbody tr');
          if (rows.length > 0) {
            rows[rows.length - 1].remove();
            syncPreviewToBlocks();
            pushHistorySnapshot(true);
            repositionCanvasOverlays();
          }
        }
      });
      floatSep();
      const hasPoster = Boolean(activeCanvasBlock.querySelector('.show-infobox-poster img'));
      floatBtn(hasPoster ? 'Trocar foto' : '+ Foto / Cartaz', 'Adicionar ou trocar foto/cartaz', () => {
        selectImages({ multiple: false, targetMode: 'infobox-poster' });
      }, hasPoster ? '' : 'primary-btn');
      if (hasPoster) {
        floatBtn('Legenda', 'Adicionar/editar legenda do cartaz', () => {
          let fig = activeCanvasBlock.querySelector('.show-infobox-poster');
          if (fig) {
            let cap = fig.querySelector('figcaption');
            if (!cap) { cap = doc.createElement('figcaption'); cap.contentEditable = 'true'; cap.textContent = 'Cartaz'; fig.append(cap); }
            cap.focus();
            syncPreviewToBlocks();
          }
        });
        floatBtn('× Foto', 'Remover foto da ficha', () => {
          const fig = activeCanvasBlock.querySelector('.show-infobox-poster');
          if (fig) { fig.remove(); syncPreviewToBlocks(); pushHistorySnapshot(true); repositionCanvasOverlays(); }
        });
      }
      floatSep();
      renderGoogleDocsToolbar(floating);
    } else {
      renderGoogleDocsToolbar(floating);
    }

    mainNode.append(floating);
    activeFloatingToolbar = floating;
    repositionCanvasOverlays();
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
    else if (type === 'ticketButton') {
      replacement = doc.createElement('a');
      replacement.className = 'btn-cta-sympla btn-cta-ticket';
      replacement.href = 'https://www.sympla.com.br/';
      replacement.target = '_blank';
      replacement.rel = 'noopener noreferrer';
      replacement.innerHTML = `<span class="cta-titulo">${escapeHtml(text || 'Comprar ingresso agora')}</span><span class="cta-subtitulo">Pagamento seguro via Sympla</span>`;
    }
    else if (type === 'whatsapp') {
      replacement = doc.createElement('div');
      replacement.className = 'whatsapp-cta-block';
      replacement.innerHTML = `<p style="text-align: center;">${escapeHtml(text || 'Dúvidas? Entre em contato com Francis via WhatsApp:')}</p><a href="https://wa.me/5547997085692" class="btn-cta-whatsapp" target="_blank" rel="noopener noreferrer">SUPORTE VIA WHATSAPP</a>`;
    }
    else if (type === 'ticketLots') {
      replacement = doc.createElement('section');
      replacement.className = 'lotes-secao';
      replacement.setAttribute('aria-label', 'Tabela de preços por lote e orientações');
      replacement.innerHTML = `<p><b>MEIA ENTRADA</b> válida para beneficiados pela <a href="/meia-entrada">Lei da Meia-Entrada</a> ou para quem doar 1kg de alimento.</p><div class="lotes-layout"><table class="tabela-vitrine tabela-precos tabela-centralizadogrande"><thead><tr><th scope="col">INGRESSOS</th><th scope="col">INTEIRA</th><th scope="col">MEIA</th></tr></thead><tbody><tr><th scope="row">1º LOTE<br><span class="lote-vigencia">26/04 a 16/05/2026</span></th><td data-label="Inteira"><span class="preco-valor">R$ 30,00</span><span class="preco-taxa">+ R$ 3,99 taxa</span></td><td data-label="Meia"><span class="preco-valor">R$ 15,00</span><span class="preco-taxa">+ R$ 3,99 taxa</span></td></tr></tbody></table><details class="lotes-spoiler"><summary>Entenda como funcionam os lotes</summary><ol><li>Quanto antes você compra, menor é o valor do ingresso.</li><li>Cada lote tem um período de datas específico.</li><li>Quando o período termina, entra automaticamente o lote seguinte.</li></ol></details></div>`;
    }
    else if (type === 'classification') {
      replacement = doc.createElement('section');
      replacement.className = 'classificacao-bloco';
      replacement.setAttribute('aria-label', 'Classificação indicativa');
      const classifications = window.AECA_CLASSIFICATIONS || {};
      const iconSrc = classifications['14'] || '/css/classificacao/classificacao-14.png';
      replacement.innerHTML = `<h3>Autoclassificação indicativa</h3><hr><div class="classificacao-box"><img src="${iconSrc}" data-rating="14" alt="Classificação indicativa 14 anos"><div class="classificacao-texto"><p>Não recomendado para menores de 14 anos.</p><p>${escapeHtml(text || 'Contém: temas sensíveis.')}</p></div></div>`;
    }
    else if (type === 'infobox') {
      replacement = doc.createElement('section');
      replacement.className = 'show-infobox';
      replacement.setAttribute('aria-label', 'Informações da página');
      const table = doc.createElement('table');
      table.className = 'show-infobox-meta';
      const tbody = table.createTBody();
      const row = tbody.insertRow();
      const th = doc.createElement('th'); th.scope = 'row'; th.contentEditable = 'true'; th.textContent = 'Item';
      const td = row.insertCell(); td.contentEditable = 'true'; td.textContent = text || 'Detalhe';
      row.prepend(th);
      replacement.append(table);
    }
    else if (type === 'image' || type === 'gallery') {
      const images = block.matches('img') ? [block.cloneNode(true)] : Array.from(block.querySelectorAll('img')).map(image => image.cloneNode(true));
      if (!images.length) return showNotice('O bloco ativo não contém imagem para converter.');
      replacement = type === 'gallery' ? doc.createElement('div') : doc.createElement('figure');
      if (type === 'gallery') replacement.className = 'main-galeria';
      images.forEach(image => replacement.append(image));
    }
    else { replacement = doc.createElement('hr'); }
    block.replaceWith(replacement); replacement.contentEditable = type === 'divider' ? 'false' : 'true';
    setActiveCanvasBlock(replacement, null); syncPreviewToBlocks(); pushHistorySnapshot(true); replacement.focus?.();
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
      } else if (block.type === 'infobox' && block.poster) {
        const previous = previousImages[imageIndex++];
        if (String(block.poster.src || '').startsWith('data:image/') && previous) block.poster.src = previous.src;
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
    pushHistorySnapshot(false);
  }

  function enablePreviewEditing() {
    const doc = previewFrame.contentDocument; const main = doc?.querySelector('main');
    if (!doc || !main || activeDefinition?.id !== 'geral') return;
    let style = doc.getElementById('aeca-canvas-editor-style');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'aeca-canvas-editor-style';
      style.textContent = `
        [contenteditable="true"]{outline:1px solid transparent;outline-offset:3px;cursor:text;transition:outline-color .15s ease,background-color .15s ease}
        [contenteditable="true"]:hover{outline-color:#ad7a48}
        [contenteditable="true"]:focus{outline:2px solid #7d2630;outline-offset:3px;background:rgba(255,250,225,.35)}
        main td[contenteditable="true"],main th[contenteditable="true"]{min-width:28px;word-break:break-word}
        main td br, main th br { display: inline !important; }
        .show-infobox .show-infobox-meta td > br { display: inline !important; }
        .aeca-active-block{outline:2px dashed #7d2630 !important;outline-offset:4px}
        .aeca-block-animated{animation:aeca-pulse-highlight .45s ease-out}
        @keyframes aeca-pulse-highlight{0%{box-shadow:0 0 0 4px rgba(125,38,48,.45)}100%{box-shadow:none}}
        .aeca-canvas-controls{position:absolute;z-index:1000;display:flex;flex-direction:column;gap:3px;padding:3px;border:1px solid #d8c9bc;border-radius:6px;background:#fffaf4;box-shadow:0 4px 12px rgba(36,26,23,.15);user-select:none}
        .aeca-canvas-controls button{min-width:26px;min-height:26px;padding:2px 5px;border:1px solid #d8c9bc;border-radius:4px;background:#fff;color:#241a17;font:700 12px system-ui;cursor:pointer;display:grid;place-items:center;transition:transform .14s ease,box-shadow .14s ease,background .14s ease}
        .aeca-canvas-controls button:hover{background:#f5ece2;transform:translateY(-1px);box-shadow:0 2px 6px rgba(36,26,23,.15)}
        .aeca-canvas-controls button:active{transform:scale(.93)}
        .aeca-canvas-controls button[draggable="true"]{cursor:grab}
        .aeca-canvas-controls button[draggable="true"]:active{cursor:grabbing}
        .aeca-floating-toolbar{position:absolute;z-index:1010;display:flex;align-items:center;flex-wrap:wrap;gap:2px;padding:3px 6px;border:1px solid #dadce0;border-radius:8px;background:#ffffff;box-shadow:0 4px 18px rgba(0,0,0,.12),0 1px 3px rgba(0,0,0,.08);font:13px system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#444746;user-select:none}
        .aeca-floating-toolbar button,.aeca-floating-toolbar select{min-width:28px;height:28px;padding:0 4px;border:1px solid transparent;border-radius:4px;background:transparent;color:#444746;font:inherit;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background-color .15s ease,color .15s ease,border-color .15s ease}
        .aeca-floating-toolbar button:hover,.aeca-floating-toolbar select:hover{background:#eaedf1;color:#1f1f1f}
        .aeca-floating-toolbar button:active,.aeca-floating-toolbar button.is-active{background:#d3e3fd;color:#041e49}
        .aeca-floating-toolbar button.primary-btn{background:#7d2630;color:#fff;border-color:#7d2630;padding:0 8px;font-size:11px;font-weight:700}
        .aeca-floating-toolbar button.primary-btn:hover{background:#5f1c25;color:#fff}
        .aeca-floating-toolbar .toolbar-sep{width:1px;height:18px;background:#dadce0;margin:0 4px}
        .aeca-floating-toolbar .toolbar-label{font-size:11px;color:#5f6368;font-weight:700;text-transform:uppercase;margin:0 4px}
        .aeca-floating-toolbar svg{display:block;pointer-events:none}
        .aeca-link-box{display:inline-flex;align-items:center;position:relative}
        .aeca-link-popover{display:inline-flex;align-items:center;gap:3px;margin-left:4px;padding:2px 4px;border:1px solid #dadce0;border-radius:4px;background:#f8fafd}
        .aeca-link-popover input{width:150px;height:22px;padding:2px 6px;border:1px solid #cfd4dc;border-radius:3px;font:12px monospace;color:#1f1f1f}
        .aeca-link-popover input:focus{outline:2px solid #1a73e8;outline-offset:-1px}
        .aeca-link-popover button{min-width:20px;height:20px;padding:0 3px;font-size:11px}
        .aeca-drop-line{position:absolute;left:0;right:0;height:3px;background:#7d2630;box-shadow:0 0 8px rgba(125,38,48,.6);z-index:999;pointer-events:none}
        .aeca-resize-overlay{position:absolute;inset:0;pointer-events:none}
        .aeca-resize-handle{position:absolute;width:10px;height:10px;background:#fff;border:2px solid #7d2630;border-radius:2px;pointer-events:auto;z-index:100}
        .aeca-resize-handle.se{right:-5px;bottom:-5px;cursor:se-resize}
        .aeca-resize-handle.sw{left:-5px;bottom:-5px;cursor:sw-resize}
        .aeca-resize-tooltip{position:absolute;bottom:-26px;left:50%;transform:translateX(-50%);background:#241a17;color:#fff;padding:2px 6px;border-radius:4px;font:11px monospace;white-space:nowrap;pointer-events:none;z-index:105}
        .aeca-gallery-item-wrap{position:relative;overflow:hidden;border-radius:4px}
        .aeca-photo-tools{position:absolute;top:4px;right:4px;display:flex;gap:3px;background:rgba(36,26,23,.78);backdrop-filter:blur(4px);padding:3px;border-radius:4px;opacity:0;transition:opacity .18s ease;z-index:20}
        .aeca-gallery-item-wrap:hover .aeca-photo-tools,.aeca-gallery-item-wrap:focus-within .aeca-photo-tools{opacity:1}
        .aeca-photo-tools button{width:22px;height:22px;padding:0;border:0;border-radius:3px;background:rgba(255,255,255,.9);color:#241a17;font:700 11px system-ui;cursor:pointer;display:grid;place-items:center}
        .aeca-photo-tools button:hover{background:#fff;transform:scale(1.08)}
        .aeca-photo-tools button.danger:hover{background:#9b3030;color:#fff}
        .aeca-gallery-add-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:120px;border:2px dashed #d8c9bc;border-radius:4px;background:rgba(255,250,244,.6);color:#7d2630;cursor:pointer;font:600 12px system-ui,sans-serif;transition:background .15s ease,border-color .15s ease}
        .aeca-gallery-add-card:hover{background:rgba(255,250,244,.95);border-color:#7d2630}
        .aeca-supporter-item-wrap{position:relative;cursor:grab}
        .aeca-supporter-item-wrap:active{cursor:grabbing}
        .aeca-supporter-dragging{opacity:.35;transform:scale(.96)}
        .aeca-supporter-tools{position:absolute;top:6px;right:6px;display:flex;gap:3px;z-index:30;opacity:0;transition:opacity .18s ease}
        .aeca-supporter-item-wrap:hover .aeca-supporter-tools,.aeca-supporter-item-wrap:focus-within .aeca-supporter-tools{opacity:1}
        .aeca-supporter-tools button{width:22px;height:22px;padding:0;border:0;border-radius:3px;background:rgba(36,26,23,.78);color:#fff;font:700 12px system-ui;cursor:pointer;display:grid;place-items:center}
        .aeca-supporter-tools button:hover{background:#9b3030;transform:scale(1.08)}
        .aeca-supporter-add-card-wrap{min-width:0;display:flex;list-style:none}
        .aeca-supporter-add-card{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;min-height:80px;padding:12px;border:2px dashed #d8c9bc;border-radius:4px;background:rgba(255,250,244,.6);color:#7d2630;cursor:pointer;font:600 12px system-ui,sans-serif;transition:background .15s ease,border-color .15s ease;box-sizing:border-box}
        .aeca-supporter-add-card:hover{background:rgba(255,250,244,.95);border-color:#7d2630}
      `;
      doc.head.append(style);
    }
    main.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,td,th,figcaption,summary,blockquote,figure').forEach(element => { element.contentEditable = 'true'; element.spellcheck = true; });
    main.querySelectorAll('.cta-titulo, .cta-subtitulo, .btn-cta-whatsapp, .lotes-secao p, .whatsapp-cta-block p, .classificacao-texto p').forEach(el => {
      el.contentEditable = 'true';
      el.spellcheck = true;
    });
    main.querySelectorAll('.show-infobox').forEach(section => {
      section.querySelectorAll('.show-infobox-meta th, .show-infobox-meta td, .show-infobox-poster figcaption').forEach(el => {
        el.contentEditable = 'true';
        el.spellcheck = true;
      });
    });
    main.querySelectorAll('.main-galeria').forEach(gallery => setupGalleryInteractions(gallery, doc));
    main.querySelectorAll('.apoio-grid').forEach(grid => setupSupportersInteractions(grid, doc));
    main.querySelectorAll('.classificacao-box').forEach(box => {
      const img = box.querySelector('img');
      if (img) {
        if (!img.dataset.rating) {
          const src = img.getAttribute('src') || '';
          const match = src.match(/classificacao-([a-z0-9]+)\.png/i);
          if (match) {
            img.dataset.rating = match[1].toLowerCase();
          } else {
            const altMatch = (img.getAttribute('alt') || '').match(/(?:livre|\d+)/i);
            if (altMatch) img.dataset.rating = altMatch[0].toLowerCase();
          }
        }
        const currentRating = img.dataset.rating;
        const classifications = window.AECA_CLASSIFICATIONS || {};
        if (currentRating && classifications[currentRating] && !img.src.startsWith('data:')) {
          img.src = classifications[currentRating];
        }
      }
    });
    const originalImages = blocks.flatMap(block => block.type === 'image' ? [block] : block.type === 'gallery' ? block.images || [] : block.type === 'infobox' && block.poster ? [block.poster] : []);
    main.querySelectorAll('img').forEach((image, index) => { if (originalImages[index]?.src) image.dataset.aecaOriginalSrc = originalImages[index].src; });
    doc.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const sel = doc.getSelection();
        let cell = event.target?.closest?.('td, th');
        if (!cell && sel?.anchorNode) {
          const el = sel.anchorNode.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : sel.anchorNode.parentElement;
          cell = el?.closest?.('td, th');
        }
        if (cell && (cell.isContentEditable || cell.getAttribute('contenteditable') === 'true')) {
          event.preventDefault();
          event.stopPropagation();
          let inserted = false;
          try {
            inserted = doc.execCommand('insertLineBreak');
          } catch {}
          if (!inserted && sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const br = doc.createElement('br');
            range.insertNode(br);
            if (!br.nextSibling || (br.nextSibling.nodeType === Node.TEXT_NODE && !br.nextSibling.nodeValue)) {
              const extraBr = doc.createElement('br');
              br.after(extraBr);
            }
            range.setStartAfter(br);
            range.setEndAfter(br);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          syncPreviewToBlocks();
          pushHistorySnapshot(false);
          return;
        }
      }
      handleUndoRedoKey(event);
    }, true);

    main.addEventListener('focusin', event => {
      let block = event.target;
      while (block && block.parentElement !== main) block = block.parentElement;
      if (block?.classList.contains('aeca-canvas-controls') || block?.classList.contains('aeca-floating-toolbar')) return;
      setActiveCanvasBlock(block || null, event.target.closest('table'));
    });
    main.addEventListener('click', event => {
      let block = event.target;
      if (block.closest('.aeca-canvas-controls') || block.closest('.aeca-floating-toolbar') || block.closest('.aeca-photo-tools') || block.closest('.aeca-gallery-add-card') || block.closest('.aeca-supporter-tools') || block.closest('.aeca-supporter-add-card')) return;
      while (block && block.parentElement !== main) block = block.parentElement;
      setActiveCanvasBlock(block || null, event.target.closest('table'));
    });

    let dropLine = null;
    doc.addEventListener('dragover', event => {
      if (!draggingCanvasBlock) return;
      event.preventDefault();
      let target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      while (target && target.parentElement !== main) target = target.parentElement;
      if (!target || target === draggingCanvasBlock || target.tagName === 'H1' || target.classList.contains('aeca-canvas-controls') || target.classList.contains('aeca-floating-toolbar')) return;
      const bounds = target.getBoundingClientRect();
      const insertBefore = event.clientY < bounds.top + bounds.height / 2;
      if (!dropLine) { dropLine = doc.createElement('div'); dropLine.className = 'aeca-drop-line'; main.append(dropLine); }
      dropLine.style.top = `${insertBefore ? target.offsetTop : (target.offsetTop + target.offsetHeight)}px`;
      target.dataset.dropBefore = insertBefore ? 'true' : 'false';
    });
    doc.addEventListener('drop', event => {
      if (dropLine) { dropLine.remove(); dropLine = null; }
      if (!draggingCanvasBlock) return;
      event.preventDefault();
      let target = event.target?.nodeType === Node.ELEMENT_NODE ? event.target : event.target?.parentElement;
      while (target && target.parentElement !== main) target = target.parentElement;
      if (!target || target === draggingCanvasBlock || target.tagName === 'H1') return;
      const insertBefore = target.dataset.dropBefore === 'true';
      delete target.dataset.dropBefore;
      animateBlockSwap(draggingCanvasBlock, target, () => {
        if (insertBefore) target.before(draggingCanvasBlock); else target.after(draggingCanvasBlock);
      });
      syncPreviewToBlocks();
      pushHistorySnapshot(true);
    });
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
  previewFrame.addEventListener('load', () => {
    previewPane?.classList.remove('is-rendering');
    enablePreviewEditing();
    if (historyStack.length === 0) pushHistorySnapshot(true);
  });
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
    if (type === 'infobox') return { type, label: 'Informações da página', poster: null, rows: [{ label: 'Item 1', value: 'Informação' }, { label: 'Item 2', value: 'Informação' }] };
    if (type === 'ticketButton') return { type: 'ticketButton', url: 'https://www.sympla.com.br/', title: 'Comprar ingresso agora', subtitle: 'Pagamento seguro via Sympla' };
    if (type === 'ticketLots') return {
      type: 'ticketLots',
      notice: '<b>MEIA ENTRADA</b> válida para beneficiados pela <a href="/meia-entrada">Lei da Meia-Entrada</a> ou para qualquer pessoa que leve 1kg de alimento não perecível, que será doado a organizações de caridade e apoio.',
      label: 'Tabela de preços por lote e orientações',
      lots: [
        { name: '1º LOTE', dates: '26/04 a 16/05/2026', inteira: 'R$ 30,00', inteiraTaxa: '+ R$ 3,99 taxa', meia: 'R$ 15,00', meiaTaxa: '+ R$ 3,99 taxa' },
        { name: '2º LOTE', dates: '17/05 a 13/06/2026', inteira: 'R$ 40,00', inteiraTaxa: '+ R$ 4,00 taxa', meia: 'R$ 20,00', meiaTaxa: '+ R$ 3,99 taxa' },
        { name: '3º LOTE', dates: 'A partir de 14/06/2026', inteira: 'R$ 50,00', inteiraTaxa: '+ R$ 5,00 taxa', meia: 'R$ 25,00', meiaTaxa: '+ R$ 3,99 taxa' }
      ],
      infoSummary: 'Entenda como funcionam os lotes',
      infoItems: [
        'Quanto antes você compra, menor é o valor do ingresso.',
        'Cada lote tem um período de datas específico.',
        'Quando o período termina, entra automaticamente o lote seguinte.'
      ]
    };
    if (type === 'whatsapp') return { type: 'whatsapp', intro: 'Dúvidas? Entre em contato com Francis via WhatsApp:', url: 'https://wa.me/5547997085692', label: 'SUPORTE VIA WHATSAPP' };
    if (type === 'classification') return { type: 'classification', title: 'Autoclassificação indicativa', rating: '14', description: 'Não recomendado para menores de 14 anos.', details: 'Contém: violência, sangue, sofrimento, ato violento contra animal, linguagem depreciativa e obscena, insinuação sexual.' };
    if (type === 'quote') return { type, text: '', cite: '' };
    if (type === 'details') return { type, summary: '', text: '' };
    if (type === 'video') return { type, title: '', src: '' };
    if (type === 'list') return { type, items: [], ordered: false };
    if (type === 'table') return { type, caption: '', headers: ['Coluna 1', 'Coluna 2'], rows: [['', '']] };
    if (type === 'supporters') return { type, label: 'Apoiadores', items: [{ category: '', name: 'Apoiador', url: '' }] };
    if (type === 'image') return { type, src: '', alt: '', caption: '', width: '100%', align: 'center', aspectRatio: 'original', objectPosition: 'center' };
    if (type === 'gallery') return { type, caption: 'Galeria de fotos', images: [] };
    if (type === 'link') return { type, label: '', url: '' };
    return { type: 'divider' };
  }
  function renderBlockEditor() {
    const host = byId('content-blocks');
    if (!host) return;
    host.replaceChildren();
    if (!blocks.length) { const empty = document.createElement('p'); empty.className = 'block-empty'; empty.textContent = 'Adicione blocos para montar o conteúdo da página.'; host.append(empty); }
    const labels = { heading: 'Título de seção', paragraph: 'Parágrafo', quote: 'Citação', infobox: 'Bloco lateral (Infobox)', ticketButton: 'Botão de ingressos (Sympla)', ticketLots: 'Tabela de lotes', whatsapp: 'Botão WhatsApp', classification: 'Classificação indicativa', details: 'Conteúdo expansível', video: 'Vídeo', list: 'Lista', table: 'Tabela', supporters: 'Apoiadores', image: 'Imagem', gallery: 'Galeria de imagens', link: 'Link', divider: 'Separador' };
    blocks.forEach((block, index) => {
      const card = document.createElement('article'); card.className = 'block-card';
      const header = document.createElement('div'); header.className = 'block-card-header';
      const title = document.createElement('strong'); title.textContent = labels[block.type] || 'Bloco';
      const actions = document.createElement('div'); actions.className = 'block-actions';
      const action = (text, label, callback, disabled) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = text; button.title = label; button.setAttribute('aria-label', label); button.disabled = disabled; button.addEventListener('click', callback); return button; };
      actions.append(action('↑', 'Mover para cima', () => { [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]; renderBlockEditor(); pushHistorySnapshot(true); }, index === 0));
      actions.append(action('↓', 'Mover para baixo', () => { [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]; renderBlockEditor(); pushHistorySnapshot(true); }, index === blocks.length - 1));
      actions.append(action('Remover', 'Remover bloco', () => { blocks.splice(index, 1); renderBlockEditor(); pushHistorySnapshot(true); }));
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
      if (block.type === 'ticketButton') {
        field('Endereço do link (Sympla ou ingresso)', block.url || '', value => { block.url = value; pushHistorySnapshot(); });
        field('Título do botão', block.title || '', value => { block.title = value; pushHistorySnapshot(); });
        field('Subtítulo do botão', block.subtitle || '', value => { block.subtitle = value; pushHistorySnapshot(); });
      } else if (block.type === 'whatsapp') {
        field('Texto introdutório', block.intro || '', value => { block.intro = value; pushHistorySnapshot(); });
        field('Link do WhatsApp', block.url || '', value => { block.url = value; pushHistorySnapshot(); });
        field('Texto do botão', block.label || '', value => { block.label = value; pushHistorySnapshot(); });
      } else if (block.type === 'ticketLots') {
        field('Aviso de meia-entrada', block.notice || '', value => { block.notice = value; pushHistorySnapshot(); }, true);
      } else if (block.type === 'classification') {
        field('Título da seção', block.title || '', value => { block.title = value; pushHistorySnapshot(); });
        field('Faixa etária (livre, 6, 10, 12, 14, 16, 18)', block.rating || '14', value => { block.rating = value; pushHistorySnapshot(); });
        field('Descrição da faixa etária', block.description || '', value => { block.description = value; pushHistorySnapshot(); });
        field('Descritores de conteúdo', block.details || '', value => { block.details = value; pushHistorySnapshot(); }, true);
      } else if (block.type === 'infobox') {
        field('Rótulo / Título', block.label || 'Informações da página', value => { block.label = value; pushHistorySnapshot(); });
        const rowWrap = document.createElement('div');
        rowWrap.className = 'table-controls';
        const info = document.createElement('small');
        info.textContent = `${(block.rows || []).length} linha(s) de metadados. Edite diretamente no canvas.`;
        rowWrap.append(info);
        card.append(rowWrap);
      } else if (block.type === 'heading') {
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
  function inlineMarkdown(node, isRoot = true) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/[\r\n\t]+/g, ' ');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.tagName === 'BR') return '\n';
    const content = Array.from(node.childNodes).map(child => inlineMarkdown(child, false)).join('');
    if (!isRoot && (node.tagName === 'DIV' || node.tagName === 'P')) {
      return content ? `\n${content}` : '\n';
    }
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
    const rows = table ? Array.from(table.querySelectorAll('tbody > tr')).map(row => {
      const label = inlineMarkdown(row.querySelector(':scope > th') || row.querySelector(':scope > td:first-child')).replace(/[ \t]+/g, ' ').trim();
      const value = inlineMarkdown(row.querySelector(':scope > td:last-child') || row.querySelector(':scope > th:last-child')).replace(/[ \t]+/g, ' ').trim();
      return { label, value };
    }).filter(row => row.label || row.value) : [];
    return { type: 'infobox', label: section.getAttribute('aria-label') || 'Informações da página', poster: posterImage ? { src: posterImage.dataset.aecaOriginalSrc || normalizeImportedUrl(posterImage.getAttribute('src') || ''), alt: posterImage.getAttribute('alt') || '', caption: posterFigure.querySelector('figcaption')?.textContent.trim() || '' } : null, rows };
  }
  function importedSupporters(list) {
    const items = Array.from(list.querySelectorAll(':scope > li'))
      .filter(item => !item.classList.contains('aeca-supporter-add-card-wrap') && !item.querySelector('.aeca-supporter-add-card'))
      .map(item => {
        const anchor = item.querySelector(':scope > a, a.apoio-card');
        const category = item.querySelector('.apoio-categoria')?.textContent.trim() || '';
        let strong = item.querySelector('strong');
        let name = strong ? strong.textContent.trim() : '';
        if (!name) {
          const card = item.querySelector('.apoio-card') || item;
          const clone = card.cloneNode(true);
          clone.querySelectorAll('.aeca-supporter-tools, .apoio-categoria').forEach(el => el.remove());
          name = clone.textContent.trim();
        }
        return { category, name, url: anchor?.getAttribute('href') || '' };
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
      if (node.matches('script,style,template,.image-modal,.aeca-canvas-controls,.aeca-floating-toolbar,.aeca-resize-overlay,.aeca-resize-handle,.aeca-photo-tools,.aeca-gallery-add-card,.aeca-drop-line,.aeca-supporter-tools,.aeca-supporter-add-card,.aeca-supporter-add-card-wrap')) return;
      if (node.tagName === 'H1') { if (!skippedTitle) { skippedTitle = true; return; } result.push({ type: 'heading', level: 2, text: node.textContent.trim() }); return; }
      if (node.classList.contains('page-subtitle')) { if (!skippedSubtitle) { skippedSubtitle = true; return; } result.push({ type: 'heading', level: 3, text: node.textContent.trim() }); return; }
      if (/^H[2-6]$/.test(node.tagName)) {
        const align = node.dataset.align || node.style.textAlign || node.getAttribute('align') || '';
        result.push({ type: 'heading', level: Number(node.tagName.slice(1)), text: node.textContent.trim(), align: ['left', 'center', 'right', 'justify'].includes(align) ? align : undefined });
        return;
      }
      if (node.tagName === 'P') {
        const text = inlineMarkdown(node).trim();
        const align = node.dataset.align || node.style.textAlign || node.getAttribute('align') || '';
        if (text) result.push({ type: 'paragraph', text, className: node.className, align: ['left', 'center', 'right', 'justify'].includes(align) ? align : undefined });
        return;
      }
      if (node.tagName === 'HR') { if (!skippedIntroDivider) { skippedIntroDivider = true; return; } result.push({ type: 'divider' }); return; }
      if (node.tagName === 'UL' && node.classList.contains('apoio-grid')) { result.push(importedSupporters(node)); return; }
      if (node.tagName === 'UL' || node.tagName === 'OL') { result.push({ type: 'list', ordered: node.tagName === 'OL', className: node.className, items: Array.from(node.children).filter(child => child.tagName === 'LI').map(item => inlineMarkdown(item).replace(/^<li>|<\/li>$/g, '').trim()).filter(Boolean) }); return; }
      if (node.tagName === 'LI') { const text = inlineMarkdown(node).trim(); if (text) result.push({ type: 'list', items: [text] }); return; }
      if (node.tagName === 'SECTION' && node.classList.contains('show-infobox')) { result.push(importedInfobox(node)); return; }
      if (node.tagName === 'TABLE') { const block = importedTable(node); if (block.rows.length) result.push(block); return; }
      if (node.tagName === 'BLOCKQUOTE') { result.push({ type: 'quote', text: node.textContent.trim(), cite: node.querySelector('cite')?.textContent.trim() || '' }); return; }
      if (node.tagName === 'DETAILS') { const summary = node.querySelector(':scope > summary'); const content = node.cloneNode(true); content.querySelector(':scope > summary')?.remove(); result.push({ type: 'details', summary: summary?.textContent.trim() || 'Mais informações', text: content.textContent.trim() }); return; }
      if (node.tagName === 'IFRAME') { const src = node.getAttribute('src') || ''; if (/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i.test(src) || /^https:\/\/player\.vimeo\.com\/video\//i.test(src)) result.push({ type: 'video', src, title: node.getAttribute('title') || 'Vídeo incorporado' }); return; }
      if (node.tagName === 'FIGURE') {
        const image = node.querySelector('img');
        if (image) {
          const width = node.dataset.width || node.style.maxWidth || '';
          const align = node.dataset.align || '';
          const aspectRatio = image.dataset.aspectRatio || image.style.aspectRatio || '';
          const objectPosition = image.dataset.objectPosition || image.style.objectPosition || '';
          result.push({
            type: 'image',
            src: image.dataset.aecaOriginalSrc || normalizeImportedUrl(image.getAttribute('src') || ''),
            alt: image.getAttribute('alt') || '',
            caption: node.querySelector('figcaption')?.textContent.trim() || '',
            className: node.className,
            imageClassName: image.className,
            width,
            align,
            aspectRatio,
            objectPosition
          });
          return;
        } else Array.from(node.children).forEach(consume);
        return;
      }
      if (node.tagName === 'IMG') {
        const aspectRatio = node.dataset.aspectRatio || node.style.aspectRatio || '';
        const objectPosition = node.dataset.objectPosition || node.style.objectPosition || '';
        result.push({
          type: 'image',
          src: node.dataset.aecaOriginalSrc || normalizeImportedUrl(node.getAttribute('src') || ''),
          alt: node.getAttribute('alt') || '',
          caption: '',
          aspectRatio,
          objectPosition
        });
        return;
      }
      if (node.matches && (node.matches('a.btn-cta-sympla, a.btn-cta-ticket') || node.classList.contains('btn-cta-sympla') || node.classList.contains('btn-cta-ticket'))) {
        const url = node.getAttribute('href') || node.dataset.url || '';
        const title = node.querySelector('.cta-titulo')?.textContent.trim() || 'Comprar ingresso agora';
        const subtitle = node.querySelector('.cta-subtitulo')?.textContent.trim() || 'Pagamento seguro via Sympla';
        result.push({ type: 'ticketButton', url, title, subtitle });
        return;
      }
      if (node.matches && (node.matches('.whatsapp-cta-block') || node.classList.contains('whatsapp-cta-block'))) {
        const intro = node.querySelector('p')?.textContent.trim() || '';
        const link = node.querySelector('a.btn-cta-whatsapp') || node.querySelector('a');
        const url = link?.getAttribute('href') || link?.dataset?.url || 'https://wa.me/5547997085692';
        const label = link?.textContent.trim() || 'SUPORTE VIA WHATSAPP';
        result.push({ type: 'whatsapp', intro, url, label });
        return;
      }
      if (node.tagName === 'A' && node.classList.contains('btn-cta-whatsapp')) {
        const url = node.getAttribute('href') || node.dataset.url || 'https://wa.me/5547997085692';
        const label = node.textContent.trim() || 'SUPORTE VIA WHATSAPP';
        let intro = 'Dúvidas? Entre em contato com Francis via WhatsApp:';
        const prevBlock = result[result.length - 1];
        if (prevBlock && prevBlock.type === 'paragraph' && (prevBlock.text.includes('WhatsApp') || prevBlock.text.includes('Dúvidas') || prevBlock.align === 'center')) {
          intro = prevBlock.text;
          result.pop();
        }
        result.push({ type: 'whatsapp', intro, url, label });
        return;
      }
      if (node.matches && (node.matches('.lotes-secao, .lotes-layout') || node.classList.contains('lotes-secao') || node.classList.contains('lotes-layout'))) {
        let notice = node.querySelector(':scope > p')?.innerHTML || '';
        if (!notice) {
          const prevBlock = result[result.length - 1];
          if (prevBlock && prevBlock.type === 'paragraph' && prevBlock.text.includes('MEIA ENTRADA')) {
            notice = prevBlock.text;
            result.pop();
          }
        }
        const table = node.querySelector('table.tabela-precos, table');
        const lots = [];
        if (table) {
          table.querySelectorAll('tbody tr').forEach(tr => {
            const th = tr.querySelector('th');
            let name = '';
            let dates = '';
            if (th) {
              const spanVig = th.querySelector('.lote-vigencia');
              dates = spanVig?.textContent.trim() || '';
              const thClone = th.cloneNode(true);
              thClone.querySelectorAll('.lote-vigencia, br').forEach(el => el.remove());
              name = thClone.textContent.trim();
            }
            const tdInteira = tr.querySelector('td[data-label="Inteira"], td:nth-of-type(1)');
            const tdMeia = tr.querySelector('td[data-label="Meia"], td:nth-of-type(2)');
            const inteira = tdInteira?.querySelector('.preco-valor')?.textContent.trim() || tdInteira?.textContent.trim() || '';
            const inteiraTaxa = tdInteira?.querySelector('.preco-taxa')?.textContent.trim() || '';
            const meia = tdMeia?.querySelector('.preco-valor')?.textContent.trim() || tdMeia?.textContent.trim() || '';
            const meiaTaxa = tdMeia?.querySelector('.preco-taxa')?.textContent.trim() || '';
            lots.push({ name, dates, inteira, inteiraTaxa, meia, meiaTaxa });
          });
        }
        const spoiler = node.querySelector('details.lotes-spoiler, details');
        const infoSummary = spoiler?.querySelector('summary')?.textContent.trim() || 'Entenda como funcionam os lotes';
        const infoItems = Array.from(spoiler?.querySelectorAll('ol li, ul li') || []).map(li => li.textContent.trim()).filter(Boolean);
        result.push({
          type: 'ticketLots',
          label: node.getAttribute('aria-label') || 'Tabela de preços por lote e orientações',
          notice: notice || undefined,
          lots: lots.length ? lots : undefined,
          infoSummary,
          infoItems: infoItems.length ? infoItems : undefined
        });
        return;
      }
      if (node.matches && (node.matches('.classificacao-bloco, .classificacao-box') || node.classList.contains('classificacao-bloco') || node.classList.contains('classificacao-box'))) {
        let title = node.querySelector('h3')?.textContent.trim() || 'Autoclassificação indicativa';
        if (!node.querySelector('h3')) {
          const prevBlock = result[result.length - 1];
          if (prevBlock && prevBlock.type === 'divider') {
            result.pop();
            const prevH = result[result.length - 1];
            if (prevH && prevH.type === 'heading' && prevH.text.toLowerCase().includes('classificação')) {
              title = prevH.text;
              result.pop();
            }
          } else if (prevBlock && prevBlock.type === 'heading' && prevBlock.text.toLowerCase().includes('classificação')) {
            title = prevBlock.text;
            result.pop();
          }
        }
        const img = node.querySelector('img');
        let rating = img?.dataset?.rating || node?.dataset?.rating;
        if (!rating) {
          const imgSrc = img?.getAttribute('src') || '';
          const match = imgSrc.match(/classificacao-([a-z0-9]+)\.png/i);
          if (match) {
            rating = match[1].toLowerCase();
          } else {
            const altMatch = (img?.getAttribute('alt') || '').match(/(?:livre|\d+)/i);
            rating = altMatch ? altMatch[0].toLowerCase() : '14';
          }
        }
        const p1 = node.querySelector('.classificacao-texto p:nth-of-type(1)')?.textContent.trim() || '';
        const p2 = node.querySelector('.classificacao-texto p:nth-of-type(2)')?.textContent.trim() || '';
        result.push({
          type: 'classification',
          title,
          rating,
          description: p1,
          details: p2
        });
        return;
      }
      if (node.tagName === 'A') { const href = node.getAttribute('href') || ''; const label = node.textContent.trim(); if (label && href) result.push({ type: 'link', url: href, label }); return; }
      if (node.tagName === 'DIV' && (node.classList.contains('main-galeria') || node.querySelectorAll(':scope > img, :scope .aeca-gallery-item-wrap img').length > 1)) {
        const images = Array.from(node.querySelectorAll('img')).filter(img => !img.closest('.aeca-photo-tools, .aeca-gallery-add-card')).map(image => ({
          src: image.dataset.aecaOriginalSrc || normalizeImportedUrl(image.getAttribute('src') || ''),
          alt: image.getAttribute('alt') || ''
        }));
        if (images.length) { result.push({ type: 'gallery', caption: '', images }); return; }
      }
      if (node.tagName === 'DIV' && node.querySelectorAll(':scope > img, :scope .aeca-gallery-item-wrap img').length === 1) {
        const image = node.querySelector('img');
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
  window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'pageImported') {
      importPage(message);
    } else if (message.command === 'imagesSelected') {
      const mode = message.targetMode;
      if (mode === 'append-gallery' && activeCanvasBlock?.classList.contains('main-galeria')) {
        const doc = previewFrame.contentDocument;
        imageSources.media = [...(imageSources.media || []), ...message.images];
        (message.images || []).forEach(imgData => {
          const img = doc.createElement('img');
          img.src = imgData.token;
          img.alt = imgData.label;
          img.dataset.aecaOriginalSrc = imgData.token;
          const addCard = activeCanvasBlock.querySelector('.aeca-gallery-add-card');
          if (addCard) addCard.before(wrapGalleryItem(img, doc)); else activeCanvasBlock.append(wrapGalleryItem(img, doc));
        });
        syncPreviewToBlocks();
        pushHistorySnapshot(true);
        showNotice(`${message.images.length} foto(s) adicionada(s) à galeria.`);
        requestPreview(false);
        return;
      }
      if (mode === 'new-gallery') {
        imageSources.media = [...(imageSources.media || []), ...message.images];
        blocks.push({
          type: 'gallery',
          caption: '',
          images: (message.images || []).map(item => ({ src: item.token, alt: item.label }))
        });
        renderBlockEditor();
        requestPreview(false);
        pushHistorySnapshot(true);
        showNotice(`${message.images.length} foto(s) adicionada(s) à nova galeria.`);
        return;
      }
      if (mode === 'infobox-poster' && activeCanvasBlock) {
        const doc = previewFrame.contentDocument;
        const entry = message.images?.[0];
        if (entry) {
          imageSources.media = [...(imageSources.media || []), entry];
          let fig = activeCanvasBlock.querySelector('.show-infobox-poster');
          if (fig) {
            let img = fig.querySelector('img');
            if (!img) { img = doc.createElement('img'); fig.prepend(img); }
            img.src = entry.token;
            img.alt = entry.label;
            img.dataset.aecaOriginalSrc = entry.token;
          } else {
            fig = doc.createElement('figure');
            fig.className = 'show-infobox-poster';
            const img = doc.createElement('img');
            img.src = entry.token;
            img.alt = entry.label;
            img.dataset.aecaOriginalSrc = entry.token;
            const cap = doc.createElement('figcaption');
            cap.contentEditable = 'true';
            cap.textContent = 'Cartaz';
            fig.append(img, cap);
            activeCanvasBlock.prepend(fig);
          }
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
          showNotice('Foto/cartaz adicionado ao bloco lateral.');
          requestPreview(false);
        }
        return;
      }
      if (mode === 'replace-image' && activeCanvasBlock) {
        const targetImg = activeCanvasBlock.matches('img') ? activeCanvasBlock : activeCanvasBlock.querySelector('img');
        const entry = message.images?.[0];
        if (targetImg && entry) {
          imageSources.media = [...(imageSources.media || []), entry];
          targetImg.src = entry.token;
          targetImg.alt = entry.label;
          targetImg.dataset.aecaOriginalSrc = entry.token;
          syncPreviewToBlocks();
          pushHistorySnapshot(true);
          showNotice('Imagem substituída.');
          requestPreview(false);
        }
        return;
      }
      if (mode === 'new-image') {
        imageSources.media = [...(imageSources.media || []), ...message.images];
        (message.images || []).forEach(entry => {
          blocks.push({ type: 'image', src: entry.token, alt: entry.label, caption: '', width: '100%', align: 'center', aspectRatio: 'original', objectPosition: 'center' });
        });
        renderBlockEditor();
        requestPreview(false);
        pushHistorySnapshot(true);
        showNotice(`${message.images.length} imagem(ns) adicionada(s).`);
        return;
      }
      if (message.fieldId) {
        imageSources[message.fieldId] = message.multiple ? [...(imageSources[message.fieldId] || []), ...message.images.filter(item => !(imageSources[message.fieldId] || []).some(existing => existing.sourcePath === item.sourcePath))] : message.images.slice(0, 1);
        const control = byId(`field-${message.fieldId}`);
        if (control) control.value = imageSources[message.fieldId].map(item => item.token).join('\n');
        renderImageValue(message.fieldId);
        showNotice(`${message.images.length} imagem(ns) adicionada(s) à biblioteca da página.`);
      }
    } else if (message.command === 'imageThumbnailsReady') {
      const selected = imageSources[message.fieldId] || [];
      message.thumbnails.forEach(item => { const target = selected.find(source => source.token === item.token); if (target) target.thumbnail = item.thumbnail; });
      renderImageValue(message.fieldId);
    } else if (message.command === 'directorySelected') {
      directoryInput.value = message.directory; updatePath();
    } else if (message.command === 'previewReady') {
      previewFrame.srcdoc = message.html; previewStatus.textContent = 'Atualizada agora';
    } else if (message.command === 'error') {
      byId('create-button').disabled = false; previewStatus.textContent = 'Não disponível'; showNotice(message.message, 'error');
    } else if (message.command === 'cancelled') {
      byId('create-button').disabled = false; showNotice('Publicação cancelada.');
    } else if (message.command === 'created') {
      showNotice(`Página criada e aberta: ${message.path}`, 'success'); byId('create-button').disabled = false;
    }
  });
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
