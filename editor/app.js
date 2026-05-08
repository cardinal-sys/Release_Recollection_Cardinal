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

/* ◆ KEY PRESETS ── 神器選択候補 ──────── */
const KEY_PRESETS = {
  layers: [
    'default', 'FUNCTION', 'SIGN', 'NUM', 'MOUSE', 'SCROLL', 'Bluetooth',
    'GESTURE_E', 'GESTURE_R', 'GESTURE_S', 'GESTURE_B', 'GESTURE_T',
    'GESTURE_A', 'GESTURE_D', 'GESTURE_W', 'SNIPE', 'NUM_SMART',
  ],
  modifiers: [
    'LEFT SHIFT', 'RIGHT SHIFT',
    'LEFT CONTROL', 'RIGHT CONTROL',
    'LEFT ALT', 'RIGHT ALT',
    'LEFT GUI', 'RIGHT GUI',
  ],
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  digits: '0 1 2 3 4 5 6 7 8 9'.split(' '),
  functionKeys: Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  arrows: ['UP ARROW', 'DOWN ARROW', 'LEFT ARROW', 'RIGHT ARROW'],
  special: [
    'ESC', 'TAB', 'SPACE', 'ENTER', 'BACKSPACE', 'DELETE',
    'CAPS', 'HOME', 'END', 'PAGE UP', 'PAGE DOWN', 'INSERT',
    'PRINT SCREEN', 'PAUSE BREAK',
  ],
  symbols: [
    '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
    '-', '=', '+', '[', ']', '{', '}', '\\', ';', ':',
    "'", '"', ',', '.', '/', '?', '<', '>', '|', '~', '`',
  ],
  behaviors: [
    '&trans', '&none',
    '&mkp MB1', '&mkp MB2', '&mkp MB3', '&mkp MB4', '&mkp MB5',
    '&smart_num 16', '&smart_snipe 15',
    '&bt BT_CLR', '&bt BT_NXT', '&bt BT_PRV',
    '&bt BT_SEL 0', '&bt BT_SEL 1', '&bt BT_SEL 2',
    'Sft+TAB', 'Ctl+TAB', 'Sft+Ctl+TAB',
    'Gui+A', 'Gui+C', 'Gui+V', 'Gui+X', 'Gui+Z', 'Gui+Y',
    'Gui+Q', 'Gui+W', 'Gui+M', 'Gui+P',
    'Alt+Y',
    // Enhance Armament behaviors
    '&drag_on', '&drag_off', '&dragkey',
    '&g_shft', '&gesture_mo_kp',
    '&ht_arrows_alt', '&ht_snipe',
    '&lm', '&lt_mkp', '&mod_mkp',
    '&rotate', '&safari_reload_once',
    '&swapper', '&swapper_rev',
  ],
  gestures: [
    // Sharp Nail (E) — コピー/ペースト/アンドゥ/リドゥ
    '&gE_up', '&gE_down', '&gE_left', '&gE_right',
    // Vorpal Strike (R)
    '&gR_up', '&gR_down', '&gR_left', '&gR_right',
    // The Eclipse (S)
    '&gS_up', '&gS_down', '&gS_left', '&gS_right',
    // Howling Octave (B)
    '&gB_up', '&gB_down', '&gB_left', '&gB_right',
    // Sonic Leap (T)
    '&gT_up', '&gT_down', '&gT_left', '&gT_right',
    // Vertical Square (A)
    '&gA_up', '&gA_down', '&gA_left', '&gA_right',
    // Starburst Stream (D)
    '&gD_up', '&gD_down', '&gD_left', '&gD_right',
    // Horizontal (W)
    '&gW_up', '&gW_down', '&gW_left', '&gW_right',
  ],
};

function collectUsedKeys(yamlData) {
  const set = new Set();
  if (!yamlData?.layers) return [];
  for (const layer of Object.values(yamlData.layers)) {
    for (const entry of layer) {
      if (entry === null || entry === undefined) continue;
      if (typeof entry === 'string') {
        set.add(entry);
      } else if (typeof entry === 'object') {
        if (entry.t) set.add(entry.t);
        if (entry.h) set.add(entry.h);
      }
    }
  }
  return Array.from(set).sort();
}

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
  layoutData: null,       // QMK info JSON (config/Release_Recollection.json)
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
  editCategory:    $('edit-category'),
  editKeylist:     $('edit-keylist'),
  editTarget:      $('edit-target'),
  keyOptionsTap:   $('key-options-tap'),
  keyOptionsHold:  $('key-options-hold'),
  modSft:          $('mod-sft'),
  modCtl:          $('mod-ctl'),
  modAlt:          $('mod-alt'),
  modGui:          $('mod-gui'),
  modClearBtn:     $('mod-clear-btn'),
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

function isConfFile(path) {
  return path.endsWith('.conf');
}

function activateTab(path) {
  state.activePath = path;
  const file = state.files.get(path);
  if (!file) return;

  const confEditor = document.getElementById('conf-editor');
  const viewConfBtn = document.getElementById('view-conf');

  if (path === 'keymap.yaml') {
    els.viewSwitch.classList.remove('hidden');
    if (viewConfBtn) viewConfBtn.style.display = 'none';
    if (state.viewMode === 'visual') showVisualEditor();
    else showCodeEditor(path, file);
  } else if (isConfFile(path)) {
    els.viewSwitch.classList.remove('hidden');
    els.viewVisual.style.display = 'none';
    if (viewConfBtn) viewConfBtn.style.display = '';
    if (state.viewMode === 'conf') showConfEditor(path, file);
    else showCodeEditor(path, file);
  } else {
    els.viewSwitch.classList.add('hidden');
    state.viewMode = 'code';
    showCodeEditor(path, file);
  }

  // Visual ボタンの表示は keymap.yaml の時だけ
  els.viewVisual.style.display = path === 'keymap.yaml' ? '' : 'none';

  renderTabBar();
  renderFileTree();
  setStatus(`Editing ${path}`, file.modified ? 'warning' : 'active');
}

function showCodeEditor(path, file) {
  els.codeEditorWrap.classList.remove('hidden');
  els.visualEditor.classList.add('hidden');
  document.getElementById('conf-editor').classList.add('hidden');
  els.emptyState.classList.add('hidden');

  if (!cm) initCodeMirror();
  cm.setOption('mode', modeForPath(path));
  cm.setValue(file.content);
  cm.clearHistory();
  setTimeout(() => cm.refresh(), 10);

  els.viewCode.classList.toggle('active', state.viewMode === 'code');
  els.viewVisual.classList.toggle('active', state.viewMode === 'visual');
  document.getElementById('view-conf').classList.toggle('active', state.viewMode === 'conf');
}

function showVisualEditor() {
  els.codeEditorWrap.classList.add('hidden');
  els.visualEditor.classList.remove('hidden');
  document.getElementById('conf-editor').classList.add('hidden');
  els.viewCode.classList.toggle('active', false);
  els.viewVisual.classList.toggle('active', true);
  document.getElementById('view-conf').classList.toggle('active', false);
  reloadVisualEditor();
}

function showConfEditor(path, file) {
  els.codeEditorWrap.classList.add('hidden');
  els.visualEditor.classList.add('hidden');
  document.getElementById('conf-editor').classList.remove('hidden');
  els.viewCode.classList.toggle('active', false);
  els.viewVisual.classList.toggle('active', false);
  document.getElementById('view-conf').classList.toggle('active', true);
  renderConfEditor(path, file);
}

/* ◆ KCONFIG (.conf) PARSER / EDITOR ─── */
function parseConfFile(text) {
  const lines = text.split('\n');
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { type: 'blank', raw: line };
    if (trimmed.startsWith('#')) return { type: 'comment', raw: line, text: trimmed.replace(/^#\s?/, '') };
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.+)$/);
    if (!m) return { type: 'unknown', raw: line };
    const key = m[1];
    const rawValue = m[2].trim();
    let value, valueType;
    if (rawValue === 'y' || rawValue === 'n') {
      value = rawValue === 'y'; valueType = 'bool';
    } else if (/^-?\d+$/.test(rawValue)) {
      value = Number(rawValue); valueType = 'int';
    } else if (/^"(.*)"$/.test(rawValue)) {
      value = rawValue.slice(1, -1); valueType = 'string';
    } else {
      value = rawValue; valueType = 'raw';
    }
    return { type: 'config', key, value, valueType, raw: line };
  });
}

function serializeConfEntries(entries) {
  return entries.map((e) => {
    if (e.type !== 'config' || !e.modified) return e.raw;
    let v;
    if (e.valueType === 'bool') v = e.value ? 'y' : 'n';
    else if (e.valueType === 'string') v = `"${e.value}"`;
    else v = String(e.value);
    return `${e.key}=${v}`;
  }).join('\n');
}

function renderConfEditor(path, file) {
  const wrap = document.getElementById('conf-entries');
  wrap.innerHTML = '';
  const entries = parseConfFile(file.content);
  const filterTerm = (document.getElementById('conf-filter').value || '').toLowerCase();

  // group: コメントを section header として扱う
  let pendingComment = '';
  let renderedSections = 0;

  entries.forEach((entry, idx) => {
    if (entry.type === 'blank') {
      pendingComment = '';
      return;
    }
    if (entry.type === 'comment') {
      pendingComment = entry.text;
      return;
    }
    if (entry.type !== 'config') return;

    if (filterTerm && !entry.key.toLowerCase().includes(filterTerm) && !pendingComment.toLowerCase().includes(filterTerm)) {
      pendingComment = '';
      return;
    }

    const row = document.createElement('div');
    row.className = 'conf-entry';
    row.dataset.idx = idx;

    const keyCell = document.createElement('div');
    const keyEl = document.createElement('div');
    keyEl.className = 'conf-key';
    keyEl.textContent = entry.key;
    keyCell.appendChild(keyEl);
    if (pendingComment) {
      const commentEl = document.createElement('div');
      commentEl.className = 'conf-comment';
      commentEl.textContent = pendingComment;
      keyCell.appendChild(commentEl);
      pendingComment = '';
    }
    row.appendChild(keyCell);

    const ctl = document.createElement('div');
    ctl.className = 'conf-control';
    if (entry.valueType === 'bool') {
      const lbl = document.createElement('label');
      lbl.className = 'conf-bool-toggle';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = entry.value;
      const lblText = document.createElement('span');
      lblText.className = 'conf-bool-label';
      lblText.textContent = entry.value ? 'y (enabled)' : 'n (disabled)';
      cb.addEventListener('change', () => {
        entry.value = cb.checked;
        entry.modified = entry.value !== originalEntries[idx].value;
        lblText.textContent = cb.checked ? 'y (enabled)' : 'n (disabled)';
        row.classList.toggle('modified', entry.modified);
        commitConfChange(path, entries);
      });
      lbl.appendChild(cb);
      lbl.appendChild(lblText);
      ctl.appendChild(lbl);
    } else if (entry.valueType === 'int') {
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = entry.value;
      inp.addEventListener('input', () => {
        entry.value = Number(inp.value);
        entry.modified = entry.value !== originalEntries[idx].value;
        row.classList.toggle('modified', entry.modified);
        commitConfChange(path, entries);
      });
      ctl.appendChild(inp);
    } else if (entry.valueType === 'string') {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = entry.value;
      inp.size = 24;
      inp.addEventListener('input', () => {
        entry.value = inp.value;
        entry.modified = entry.value !== originalEntries[idx].value;
        row.classList.toggle('modified', entry.modified);
        commitConfChange(path, entries);
      });
      ctl.appendChild(inp);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = entry.value;
      inp.addEventListener('input', () => {
        entry.value = inp.value;
        entry.modified = entry.value !== originalEntries[idx].value;
        row.classList.toggle('modified', entry.modified);
        commitConfChange(path, entries);
      });
      ctl.appendChild(inp);
    }
    row.appendChild(ctl);
    wrap.appendChild(row);
    renderedSections++;
  });

  if (renderedSections === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = filterTerm
      ? `'${filterTerm}' に一致する設定がありません。`
      : 'パース可能な CONFIG 行がありません。';
    wrap.appendChild(p);
  }

  // 元の値を保持して modified 判定に使う
  var originalEntries = parseConfFile(file.original);
}

function commitConfChange(path, entries) {
  const file = state.files.get(path);
  if (!file) return;
  const newContent = serializeConfEntries(entries);
  file.content = newContent;
  file.modified = file.content !== file.original;
  if (cm && state.activePath === path && state.viewMode === 'code') {
    cm.setValue(newContent);
  }
  renderTabBar();
  renderFileTree();
  renderModifiedList();
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

async function reloadVisualEditor() {
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
  // Load physical layout JSON if not already loaded
  if (!state.layoutData) {
    try {
      if (!state.files.has('config/Release_Recollection.json')) {
        await fetchFile('config/Release_Recollection.json');
      }
      const jf = state.files.get('config/Release_Recollection.json');
      state.layoutData = JSON.parse(jf.content);
      log('Physical layout loaded', 'success');
    } catch (e) {
      log(`Layout load failed: ${e.message}`, 'warning');
    }
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
  const layout = state.layoutData?.layouts?.default_layout?.layout || null;

  if (layout && layout.length === layer.length) {
    renderPhysicalLayout(layer, layout);
  } else {
    renderFlatGrid(layer);
  }

  renderEditForm();
}

function renderFlatGrid(layer) {
  els.keymapGrid.classList.remove('physical-layout');
  els.keymapGrid.style.cssText = '';
  layer.forEach((entry, idx) => {
    const cell = createKeyCell(entry, idx);
    els.keymapGrid.appendChild(cell);
  });
}

function renderPhysicalLayout(layer, layout) {
  els.keymapGrid.classList.add('physical-layout');
  const unitPx = 56;
  const gap = 4;

  // Compute bounds (account for rotation by checking rx/ry)
  let maxX = 0, maxY = 0;
  for (const k of layout) {
    const w = k.w ?? 1;
    const h = k.h ?? 1;
    maxX = Math.max(maxX, (k.x ?? 0) + w);
    maxY = Math.max(maxY, (k.y ?? 0) + h);
  }
  const padding = 12;
  els.keymapGrid.style.cssText =
    `position: relative; width: ${maxX * unitPx + padding * 2}px; ` +
    `height: ${maxY * unitPx + padding * 2}px; ` +
    `padding: ${padding}px; margin: 0 auto;`;

  layer.forEach((entry, idx) => {
    const pos = layout[idx];
    const cell = createKeyCell(entry, idx);
    cell.classList.add('key-physical');

    const w = (pos.w ?? 1) * unitPx - gap;
    const h = (pos.h ?? 1) * unitPx - gap;
    cell.style.position = 'absolute';
    cell.style.left = `${(pos.x ?? 0) * unitPx + padding + gap / 2}px`;
    cell.style.top = `${(pos.y ?? 0) * unitPx + padding + gap / 2}px`;
    cell.style.width = `${w}px`;
    cell.style.height = `${h}px`;

    if (pos.r) {
      const rx = pos.rx ?? pos.x ?? 0;
      const ry = pos.ry ?? pos.y ?? 0;
      const ox = (rx - (pos.x ?? 0)) * unitPx;
      const oy = (ry - (pos.y ?? 0)) * unitPx;
      cell.style.transformOrigin = `${ox}px ${oy}px`;
      cell.style.transform = `rotate(${pos.r}deg)`;
    }

    els.keymapGrid.appendChild(cell);
  });
}

function createKeyCell(entry, idx) {
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
  return cell;
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
  // Auto-detect modifiers from the targeted field (tap by default)
  const target = els.editTarget?.value || 'tap';
  const sourceVal = target === 'tap' ? t : h;
  const { mods } = splitModifiers(sourceVal);
  setActiveModifiers(mods);
  refreshDatalists();
}

function refreshDatalists() {
  // Datalist は Tap/Hold 入力欄のオートコンプリート用。全候補を投入
  const all = [
    ...KEY_PRESETS.layers,
    ...KEY_PRESETS.modifiers,
    ...KEY_PRESETS.letters,
    ...KEY_PRESETS.digits,
    ...KEY_PRESETS.functionKeys,
    ...KEY_PRESETS.arrows,
    ...KEY_PRESETS.special,
    ...KEY_PRESETS.symbols,
    ...KEY_PRESETS.behaviors,
    ...KEY_PRESETS.gestures,
    ...collectUsedKeys(state.yamlData),
  ];
  const unique = Array.from(new Set(all));
  const html = unique.map((v) => `<option value="${v.replace(/"/g, '&quot;')}">`).join('');
  els.keyOptionsTap.innerHTML = html;
  els.keyOptionsHold.innerHTML = html;
}

function refreshKeylist() {
  const cat = els.editCategory.value;
  if (!cat) {
    els.editKeylist.classList.add('hidden');
    els.editKeylist.innerHTML = '<option value="">— 選択 —</option>';
    return;
  }
  let options;
  if (cat === 'used') {
    options = collectUsedKeys(state.yamlData);
  } else {
    options = KEY_PRESETS[cat] || [];
  }
  els.editKeylist.classList.remove('hidden');
  els.editKeylist.innerHTML =
    '<option value="">— 選択 —</option>' +
    options
      .map((v) => `<option value="${v.replace(/"/g, '&quot;')}">${v}</option>`)
      .join('');
}

/* ◆ MODIFIER UTILITIES ──────────────────── */
const MOD_PREFIXES = ['Sft', 'Ctl', 'Alt', 'Gui'];

function getActiveModifiers() {
  const mods = [];
  if (els.modSft.checked) mods.push('Sft');
  if (els.modCtl.checked) mods.push('Ctl');
  if (els.modAlt.checked) mods.push('Alt');
  if (els.modGui.checked) mods.push('Gui');
  return mods;
}

function setActiveModifiers(mods) {
  els.modSft.checked = mods.includes('Sft');
  els.modCtl.checked = mods.includes('Ctl');
  els.modAlt.checked = mods.includes('Alt');
  els.modGui.checked = mods.includes('Gui');
}

function splitModifiers(value) {
  // "Sft+Ctl+TAB" → { mods: ['Sft', 'Ctl'], base: 'TAB' }
  if (!value) return { mods: [], base: '' };
  const parts = value.split('+');
  const mods = [];
  let i = 0;
  while (i < parts.length - 1 && MOD_PREFIXES.includes(parts[i])) {
    mods.push(parts[i]);
    i++;
  }
  return { mods, base: parts.slice(i).join('+') };
}

function joinModifiers(mods, base) {
  if (!base) return mods.length ? mods.join('+') : '';
  if (!mods.length) return base;
  return [...mods, base].join('+');
}

function clearModifiers() {
  setActiveModifiers([]);
}

function applyQuickPick() {
  const value = els.editKeylist.value;
  if (!value) return;
  const mods = getActiveModifiers();
  const finalValue = joinModifiers(mods, value);
  const target = els.editTarget.value;
  if (target === 'tap') {
    els.editTap.value = finalValue;
  } else {
    els.editHold.value = finalValue;
  }
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

    // 〈Cross Realm Summon〉— URL クエリで指定されたファイルを自動展開
    const params = new URLSearchParams(window.location.search);
    const requestedFile = params.get('file');
    if (requestedFile && EDITABLE_PATHS.includes(requestedFile)) {
      log(`Auto-opening ${requestedFile} from URL parameter`);
      await openFile(requestedFile);
    }
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
  els.editCategory.addEventListener('change', refreshKeylist);
  els.editKeylist.addEventListener('change', applyQuickPick);
  els.modClearBtn.addEventListener('click', clearModifiers);
  // Modifier toggle: rewrite the target field's prefix in real time
  for (const cb of [els.modSft, els.modCtl, els.modAlt, els.modGui]) {
    cb.addEventListener('change', () => {
      const mods = getActiveModifiers();
      const target = els.editTarget.value;
      const input = target === 'tap' ? els.editTap : els.editHold;
      const { base } = splitModifiers(input.value);
      input.value = joinModifiers(mods, base);
    });
  }
  els.editTarget.addEventListener('change', () => {
    // ターゲット切替時は対象フィールドの修飾キー状態に同期
    const target = els.editTarget.value;
    const input = target === 'tap' ? els.editTap : els.editHold;
    const { mods } = splitModifiers(input.value);
    setActiveModifiers(mods);
  });
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
  document.getElementById('view-conf').addEventListener('click', () => {
    state.viewMode = 'conf';
    if (state.activePath && isConfFile(state.activePath)) {
      const f = state.files.get(state.activePath);
      showConfEditor(state.activePath, f);
    }
  });
  document.getElementById('conf-filter').addEventListener('input', () => {
    if (state.activePath && isConfFile(state.activePath) && state.viewMode === 'conf') {
      const f = state.files.get(state.activePath);
      renderConfEditor(state.activePath, f);
    }
  });

  setStatus('Awaiting authentication', 'idle');
  log('Cardinal Editor initialized');

  // 〈Auto-Sealing〉— stored PAT があれば即座に認証する
  if (els.patInput.value.trim()) {
    log('Auto-authenticating with stored PAT...');
    handleAuth();
  } else {
    log('Enter your GitHub PAT (repo scope) to begin');
  }
}

init();
