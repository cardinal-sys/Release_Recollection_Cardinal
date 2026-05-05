/* ===============================
 * 《 Cardinal Editor 》 — app.js
 * GitHub API 連携 + マルチファイル DTS/YAML 編集
 * Tree API による一括コミット
 * =============================== */

const STORAGE_KEYS = {
  PAT: 'cardinal_editor_pat',
  REPO: 'cardinal_editor_repo',
  BRANCH: 'cardinal_editor_branch',
};

/* 編集対象ファイルのホワイトリスト */
const EDITABLE_PATHS = [
  'keymap.yaml',
  'keymap_drawer.yaml',
  'config/Release_Recollection.keymap',
  'config/Release_Recollection.json',
  'config/west.yml',
  'config/keymap/00_prelude.dtsi',
  'config/keymap/10_combos.dtsi',
  'config/keymap/20_macros.dtsi',
  'config/keymap/30_enhance_armament_base.dtsi',
  'config/keymap/31_enhance_armament_layers.dtsi',
  'config/keymap/35_enhance_armament.dtsi',
  'config/keymap/40_sharp_nail.dtsi',
  'config/keymap/41_vorpal_strike.dtsi',
  'config/keymap/42_the_eclipse.dtsi',
  'config/keymap/43_howling_octave.dtsi',
  'config/keymap/44_sonic_leap.dtsi',
  'config/keymap/45_vertical_square.dtsi',
  'config/keymap/46_starburst_stream.dtsi',
  'config/keymap/47_horizontal.dtsi',
  'config/keymap/layers/00_default.dtsi',
  'config/keymap/layers/01_function.dtsi',
  'config/keymap/layers/02_sign.dtsi',
  'config/keymap/layers/03_num.dtsi',
  'config/keymap/layers/04_mouse.dtsi',
  'config/keymap/layers/05_scroll.dtsi',
  'config/keymap/layers/06_bluetooth.dtsi',
  'config/keymap/layers/07_gesture_e.dtsi',
  'config/keymap/layers/08_gesture_r.dtsi',
  'config/keymap/layers/09_gesture_s.dtsi',
  'config/keymap/layers/10_gesture_b.dtsi',
  'config/keymap/layers/11_gesture_t.dtsi',
  'config/keymap/layers/12_gesture_a.dtsi',
  'config/keymap/layers/13_gesture_d.dtsi',
  'config/keymap/layers/14_gesture_w.dtsi',
  'config/keymap/layers/15_snipe.dtsi',
  'config/keymap/layers/16_num_smart.dtsi',
  'config/keymap/layers/17_snipe_scroll.dtsi',
  'config/boards/shields/Release_Recollection/Dark_Repulser.conf',
  'config/boards/shields/Release_Recollection/Dark_Repulser.overlay',
  'config/boards/shields/Release_Recollection/Elucidator.conf',
  'config/boards/shields/Release_Recollection/Elucidator.overlay',
  'config/boards/shields/Release_Recollection/Release_Recollection.dtsi',
  'config/boards/shields/Release_Recollection/Release_Recollection.zmk.yml',
  'config/boards/xiao_ble.overlay',
  'config/dts/mouse-gesture.local.dtsi',
];

/* CodeMirror モード判定 */
function modeForPath(path) {
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'yaml';
  if (path.endsWith('.json')) return { name: 'javascript', json: true };
  return 'text/x-csrc'; // dtsi / overlay / conf / keymap
}

/* ◆ STATE ──────────────────────────────── */
const state = {
  pat: '',
  repo: 'cardinal-sys/Release_Recollection',
  branch: 'main',
  files: new Map(),       // path -> { sha, original, content, modified }
  openTabs: [],           // [path, ...]
  activePath: null,
  // Visual editor state (keymap.yaml only)
  yamlData: null,
  originalYamlData: null,
  currentLayer: 'default',
  selectedIndex: null,
  modifiedKeys: new Set(),
  viewMode: 'code',       // 'code' | 'visual'
};

let cm = null; // CodeMirror instance

/* ◆ DOM ────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const els = {
  statusIndicator: $('status-indicator'),
  statusText:      $('status-text'),
  patInput:        $('pat-input'),
  repoInput:       $('repo-input'),
  branchInput:     $('branch-input'),
  authBtn:         $('auth-btn'),
  authSection:     $('auth-section'),
  editorShell:     $('editor-shell'),
  fileTree:        $('file-tree'),
  modifiedList:    $('modified-list'),
  reloadTreeBtn:   $('reload-tree-btn'),
  tabBar:          $('tab-bar'),
  viewSwitch:      $('view-switch'),
  viewCode:        $('view-code'),
  viewVisual:      $('view-visual'),
  codeEditorWrap:  $('code-editor-wrap'),
  codeEditor:      $('code-editor'),
  emptyState:      $('empty-state'),
  visualEditor:    $('visual-editor'),
  layerTabs:       $('layer-tabs'),
  keymapGrid:      $('keymap-grid'),
  keyEditForm:     $('key-edit-form'),
  editIndex:       $('edit-index'),
  editTap:         $('edit-tap'),
  editHold:        $('edit-hold'),
  applyEditBtn:    $('apply-edit-btn'),
  cancelEditBtn:   $('cancel-edit-btn'),
  commitMessage:   $('commit-message'),
  sealBtn:         $('seal-btn'),
  sealHint:        $('seal-hint'),
  logOutput:       $('log-output'),
};

/* ◆ STATUS / LOG ────────────────────────── */
function setStatus(text, kind = 'idle') {
  els.statusIndicator.className = `status-${kind}`;
  els.statusIndicator.textContent = `[ ${kind.toUpperCase()} ]`;
  els.statusText.textContent = text;
}

function log(msg, kind = 'info') {
  const ts = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = `log-line log-${kind}`;
  line.textContent = `[${ts}] ${msg}`;
  els.logOutput.appendChild(line);
  els.logOutput.scrollTop = els.logOutput.scrollHeight;
}

/* ◆ STORAGE ────────────────────────────── */
function saveCredentials() {
  localStorage.setItem(STORAGE_KEYS.PAT, state.pat);
  localStorage.setItem(STORAGE_KEYS.REPO, state.repo);
  localStorage.setItem(STORAGE_KEYS.BRANCH, state.branch);
}

function loadCredentials() {
  const pat = localStorage.getItem(STORAGE_KEYS.PAT);
  const repo = localStorage.getItem(STORAGE_KEYS.REPO);
  const branch = localStorage.getItem(STORAGE_KEYS.BRANCH);
  if (pat) els.patInput.value = pat;
  if (repo) els.repoInput.value = repo;
  if (branch) els.branchInput.value = branch;
}

/* ◆ GITHUB API ─────────────────────────── */
async function ghFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${state.pat}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(`[${res.status}] ${err.message || res.statusText}`);
  }
  return res.json();
}

function b64encode(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

function b64decode(content) {
  return decodeURIComponent(escape(atob(content.replace(/\n/g, ''))));
}

async function fetchFile(path) {
  log(`GET ${path}`);
  const data = await ghFetch(
    `/repos/${state.repo}/contents/${path}?ref=${encodeURIComponent(state.branch)}`
  );
  const text = b64decode(data.content);
  state.files.set(path, {
    sha: data.sha,
    original: text,
    content: text,
    modified: false,
  });
  return state.files.get(path);
}

/* ◆ TREE API: 一括コミット ──────────────── */
async function commitAll(message) {
  const modified = Array.from(state.files.entries())
    .filter(([, f]) => f.modified);
  if (modified.length === 0) throw new Error('No changes to commit');

  setStatus(`Sealing ${modified.length} file(s)...`, 'active');

  // 1. Get current branch ref
  log('Resolving branch ref...');
  const ref = await ghFetch(
    `/repos/${state.repo}/git/ref/heads/${encodeURIComponent(state.branch)}`
  );
  const baseSha = ref.object.sha;

  // 2. Get base commit + tree
  const baseCommit = await ghFetch(
    `/repos/${state.repo}/git/commits/${baseSha}`
  );
  const baseTreeSha = baseCommit.tree.sha;

  // 3. Create blobs for each modified file
  const blobs = [];
  for (const [path, file] of modified) {
    log(`Creating blob: ${path}`);
    const blob = await ghFetch(
      `/repos/${state.repo}/git/blobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          content: b64encode(file.content),
          encoding: 'base64',
        }),
      }
    );
    blobs.push({ path, sha: blob.sha });
  }

  // 4. Create new tree
  log('Creating tree...');
  const tree = await ghFetch(
    `/repos/${state.repo}/git/trees`,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: blobs.map((b) => ({
          path: b.path,
          mode: '100644',
          type: 'blob',
          sha: b.sha,
        })),
      }),
    }
  );

  // 5. Create commit
  log('Creating commit...');
  const commit = await ghFetch(
    `/repos/${state.repo}/git/commits`,
    {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [baseSha],
      }),
    }
  );

  // 6. Update ref
  log('Updating branch ref...');
  await ghFetch(
    `/repos/${state.repo}/git/refs/heads/${encodeURIComponent(state.branch)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ sha: commit.sha, force: false }),
    }
  );

  log(`Sealed: ${commit.sha.slice(0, 7)} — ${message}`, 'success');
  setStatus(`Sealed ${modified.length} file(s)`, 'success');

  // Refresh sha for committed files
  for (const [path] of modified) {
    await fetchFile(path);
  }
  state.modifiedKeys.clear();
  if (state.activePath === 'keymap.yaml') reloadVisualEditor();
}

/* ◆ FILE TREE RENDER ────────────────────── */
function buildTreeStructure(paths) {
  const root = { type: 'folder', name: '/', children: {}, path: '' };
  for (const p of paths) {
    const parts = p.split('/');
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      if (!cur.children[name]) {
        cur.children[name] = isFile
          ? { type: 'file', name, path: p }
          : { type: 'folder', name, children: {}, path: parts.slice(0, i + 1).join('/') };
      }
      if (!isFile) cur = cur.children[name];
    }
  }
  return root;
}

function renderTreeNode(node, depth = 0) {
  const frag = document.createDocumentFragment();
  const entries = Object.values(node.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const child of entries) {
    if (child.type === 'folder') {
      const folder = document.createElement('div');
      folder.className = 'tree-folder';
      folder.textContent = `▾ ${child.name}/`;
      folder.onclick = () => {
        folder.classList.toggle('collapsed');
        folder.textContent = folder.classList.contains('collapsed')
          ? `▸ ${child.name}/`
          : `▾ ${child.name}/`;
      };
      frag.appendChild(folder);

      const childWrap = document.createElement('div');
      childWrap.className = 'tree-children';
      childWrap.appendChild(renderTreeNode(child, depth + 1));
      frag.appendChild(childWrap);
    } else {
      const file = document.createElement('div');
      file.className = 'tree-file';
      if (state.activePath === child.path) file.classList.add('active');
      const f = state.files.get(child.path);
      if (f && f.modified) file.classList.add('modified');
      file.textContent = `📄 ${child.name}`;
      file.title = child.path;
      file.onclick = () => openFile(child.path);
      frag.appendChild(file);
    }
  }
  return frag;
}

function renderFileTree() {
  els.fileTree.innerHTML = '';
  const tree = buildTreeStructure(EDITABLE_PATHS);
  els.fileTree.appendChild(renderTreeNode(tree));
}

function renderModifiedList() {
  els.modifiedList.innerHTML = '';
  const modified = Array.from(state.files.entries()).filter(([, f]) => f.modified);
  if (modified.length === 0) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = 'No changes';
    els.modifiedList.appendChild(li);
    els.sealBtn.disabled = true;
    els.sealHint.textContent = 'No modified files';
    return;
  }
  els.sealBtn.disabled = false;
  els.sealHint.textContent = `${modified.length} file(s) ready to seal`;
  for (const [path] of modified) {
    const li = document.createElement('li');
    li.textContent = `● ${path}`;
    li.title = 'Click to open';
    li.onclick = () => openFile(path);
    els.modifiedList.appendChild(li);
  }
}

/* ◆ TABS ───────────────────────────────── */
function renderTabBar() {
  els.tabBar.innerHTML = '';
  for (const path of state.openTabs) {
    const tab = document.createElement('div');
    tab.className = 'tab';
    if (path === state.activePath) tab.classList.add('active');
    const f = state.files.get(path);
    if (f && f.modified) tab.classList.add('modified');

    const label = document.createElement('span');
    label.textContent = path.split('/').pop();
    label.title = path;
    label.onclick = () => activateTab(path);
    tab.appendChild(label);

    const close = document.createElement('span');
    close.className = 'tab-close';
    close.textContent = '×';
    close.onclick = (e) => {
      e.stopPropagation();
      closeTab(path);
    };
    tab.appendChild(close);

    els.tabBar.appendChild(tab);
  }
}

async function openFile(path) {
  if (!state.files.has(path)) {
    setStatus(`Loading ${path}...`, 'active');
    try {
      await fetchFile(path);
    } catch (e) {
      setStatus('Load failed', 'error');
      log(`Failed to load ${path}: ${e.message}`, 'error');
      return;
    }
  }
  if (!state.openTabs.includes(path)) state.openTabs.push(path);
  activateTab(path);
}

function activateTab(path) {
  state.activePath = path;
  const file = state.files.get(path);
  if (!file) return;

  // Switch view: visual editor only for keymap.yaml
  if (path === 'keymap.yaml') {
    els.viewSwitch.classList.remove('hidden');
    if (state.viewMode === 'visual') {
      showVisualEditor();
    } else {
      showCodeEditor(path, file);
    }
  } else {
    els.viewSwitch.classList.add('hidden');
    state.viewMode = 'code';
    showCodeEditor(path, file);
  }

  renderTabBar();
  renderFileTree();
  setStatus(`Editing ${path}`, file.modified ? 'warning' : 'active');
}

function showCodeEditor(path, file) {
  els.codeEditorWrap.classList.remove('hidden');
  els.visualEditor.classList.add('hidden');
  els.emptyState.classList.add('hidden');

  if (!cm) initCodeMirror();
  cm.setOption('mode', modeForPath(path));
  cm.setValue(file.content);
  cm.clearHistory();
  setTimeout(() => cm.refresh(), 10);

  // visual editor button state
  els.viewCode.classList.toggle('active', state.viewMode === 'code');
  els.viewVisual.classList.toggle('active', state.viewMode === 'visual');
}

function showVisualEditor() {
  els.codeEditorWrap.classList.add('hidden');
  els.visualEditor.classList.remove('hidden');
  els.viewCode.classList.toggle('active', false);
  els.viewVisual.classList.toggle('active', true);
  reloadVisualEditor();
}

function closeTab(path) {
  const file = state.files.get(path);
  if (file && file.modified) {
    if (!confirm(`Discard unsaved changes in ${path}?`)) return;
    file.content = file.original;
    file.modified = false;
  }
  state.openTabs = state.openTabs.filter((p) => p !== path);
  if (state.activePath === path) {
    state.activePath = state.openTabs[state.openTabs.length - 1] || null;
  }
  if (state.activePath) {
    activateTab(state.activePath);
  } else {
    els.codeEditorWrap.classList.remove('hidden');
    els.visualEditor.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
    if (cm) cm.setValue('');
    setStatus('No file open', 'idle');
  }
  renderTabBar();
  renderFileTree();
  renderModifiedList();
}

/* ◆ CODE MIRROR INIT ─────────────────────── */
function initCodeMirror() {
  cm = CodeMirror(els.codeEditor, {
    value: '',
    mode: 'text/x-csrc',
    theme: 'dracula',
    lineNumbers: true,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    indentUnit: 4,
    tabSize: 4,
    lineWrapping: false,
  });
  cm.on('change', () => {
    if (!state.activePath) return;
    const file = state.files.get(state.activePath);
    if (!file) return;
    const newContent = cm.getValue();
    file.content = newContent;
    file.modified = file.content !== file.original;
    renderTabBar();
    renderFileTree();
    renderModifiedList();
  });
}

/* ◆ VISUAL EDITOR (keymap.yaml) ──────────── */
function parseKey(entry) {
  if (entry === null || entry === undefined) return { t: '', h: '' };
  if (typeof entry === 'string') return { t: entry, h: '' };
  if (typeof entry === 'object') return { t: entry.t || '', h: entry.h || '' };
  return { t: String(entry), h: '' };
}

function buildKey(t, h) {
  const tap = (t || '').trim();
  const hold = (h || '').trim();
  if (!tap && !hold) return null;
  if (!hold) return tap;
  return { t: tap, h: hold };
}

function reloadVisualEditor() {
  const file = state.files.get('keymap.yaml');
  if (!file) return;
  try {
    state.yamlData = jsyaml.load(file.content);
    state.originalYamlData = jsyaml.load(file.original);
  } catch (e) {
    log(`YAML parse error: ${e.message}`, 'error');
    state.viewMode = 'code';
    showCodeEditor('keymap.yaml', file);
    return;
  }
  renderVisual();
}

function renderVisual() {
  if (!state.yamlData) return;
  // Layer tabs
  els.layerTabs.innerHTML = '';
  const layers = Object.keys(state.yamlData.layers || {});
  if (!layers.includes(state.currentLayer)) state.currentLayer = layers[0];

  for (const name of layers) {
    const btn = document.createElement('button');
    btn.className = 'layer-tab';
    if (name === state.currentLayer) btn.classList.add('active');
    btn.textContent = name;
    btn.onclick = () => {
      state.currentLayer = name;
      state.selectedIndex = null;
      renderVisual();
    };
    els.layerTabs.appendChild(btn);
  }

  // Grid
  els.keymapGrid.innerHTML = '';
  const layer = state.yamlData.layers[state.currentLayer] || [];
  layer.forEach((entry, idx) => {
    const cell = document.createElement('div');
    cell.className = 'key-cell';
    if (state.selectedIndex === idx) cell.classList.add('selected');
    if (state.modifiedKeys.has(`${state.currentLayer}:${idx}`)) cell.classList.add('modified');

    const { t, h } = parseKey(entry);
    const tapEl = document.createElement('div');
    tapEl.className = 'key-tap';
    tapEl.textContent = t || '·';
    cell.appendChild(tapEl);

    if (h) {
      const holdEl = document.createElement('div');
      holdEl.className = 'key-hold';
      holdEl.textContent = h;
      cell.appendChild(holdEl);
    }
    cell.onclick = () => {
      state.selectedIndex = idx;
      renderEditForm();
      renderVisual();
    };
    els.keymapGrid.appendChild(cell);
  });

  renderEditForm();
}

function renderEditForm() {
  if (state.selectedIndex === null) {
    els.keyEditForm.classList.add('hidden');
    return;
  }
  els.keyEditForm.classList.remove('hidden');
  const entry = state.yamlData.layers[state.currentLayer][state.selectedIndex];
  const { t, h } = parseKey(entry);
  els.editIndex.value = `${state.currentLayer}[${state.selectedIndex}]`;
  els.editTap.value = t;
  els.editHold.value = h;
}

function applyVisualEdit() {
  if (state.selectedIndex === null) return;
  const t = els.editTap.value;
  const h = els.editHold.value;
  state.yamlData.layers[state.currentLayer][state.selectedIndex] = buildKey(t, h);
  state.modifiedKeys.add(`${state.currentLayer}:${state.selectedIndex}`);

  // Sync to file content
  const newYaml = jsyaml.dump(state.yamlData, {
    lineWidth: -1,
    flowLevel: 2,
    quotingType: '"',
  });
  const file = state.files.get('keymap.yaml');
  file.content = newYaml;
  file.modified = file.content !== file.original;
  log(`Edited ${state.currentLayer}[${state.selectedIndex}] → t:"${t}" h:"${h}"`, 'warning');

  renderVisual();
  renderTabBar();
  renderFileTree();
  renderModifiedList();
}

function cancelVisualEdit() {
  state.selectedIndex = null;
  renderEditForm();
  renderVisual();
}

/* ◆ ACTIONS ────────────────────────────── */
async function handleAuth() {
  state.pat = els.patInput.value.trim();
  state.repo = els.repoInput.value.trim();
  state.branch = els.branchInput.value.trim();

  if (!state.pat) {
    setStatus('PAT is required', 'error');
    log('Authentication failed: empty PAT', 'error');
    return;
  }

  try {
    setStatus('Verifying credentials...', 'active');
    const user = await ghFetch('/user');
    log(`Authenticated as ${user.login}`, 'success');
    saveCredentials();

    setStatus('Loading file list...', 'active');
    els.editorShell.classList.remove('hidden');
    els.authSection.classList.add('hidden');
    renderFileTree();
    renderModifiedList();
    setStatus('Ready', 'success');
    log('File tree loaded — select a file to begin');
  } catch (err) {
    setStatus('Authentication failed', 'error');
    log(err.message, 'error');
  }
}

async function handleSeal() {
  const modifiedCount = Array.from(state.files.values()).filter((f) => f.modified).length;
  if (modifiedCount === 0) return;

  let msg = els.commitMessage.value.trim();
  if (!msg) {
    msg = `edit(cardinal): 〈Memory Rewrite〉— ${modifiedCount} file(s) via Cardinal Editor`;
    els.commitMessage.value = msg;
  }
  if (!confirm(`Seal ${modifiedCount} file(s) to ${state.repo}@${state.branch}?\n\n"${msg}"`)) {
    log('Sealing cancelled', 'warning');
    return;
  }

  try {
    await commitAll(msg);
    els.commitMessage.value = '';
    renderTabBar();
    renderFileTree();
    renderModifiedList();
  } catch (err) {
    setStatus('Sealing failed', 'error');
    log(err.message, 'error');
  }
}

/* ◆ INIT ───────────────────────────────── */
function init() {
  loadCredentials();
  els.authBtn.addEventListener('click', handleAuth);
  els.patInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
  });
  els.reloadTreeBtn.addEventListener('click', renderFileTree);
  els.sealBtn.addEventListener('click', handleSeal);
  els.applyEditBtn.addEventListener('click', applyVisualEdit);
  els.cancelEditBtn.addEventListener('click', cancelVisualEdit);
  els.viewCode.addEventListener('click', () => {
    state.viewMode = 'code';
    if (state.activePath) {
      const f = state.files.get(state.activePath);
      showCodeEditor(state.activePath, f);
    }
  });
  els.viewVisual.addEventListener('click', () => {
    state.viewMode = 'visual';
    if (state.activePath === 'keymap.yaml') showVisualEditor();
  });

  setStatus('Awaiting authentication', 'idle');
  log('Cardinal Editor initialized');
  log('Enter your GitHub PAT (repo scope) to begin');
}

init();
