/* ===============================
 * 《 Cardinal Editor 》 — app.js
 * GitHub API 連携 + マルチファイル DTS/YAML 編集
 * Tree API による一括コミット
 * =============================== */

const STORAGE_KEYS = {
  PAT: 'cardinal_editor_pat',
  REPO: 'cardinal_editor_repo',
  BRANCH: 'cardinal_editor_branch',
  REMEMBER_PAT: 'cardinal_editor_remember_pat',
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
// 〈Secret Vault Sealing〉— PAT は既定で sessionStorage（タブを閉じれば消える）。
// ユーザが "Remember PAT" を opt-in した場合のみ localStorage に永続化する。
function isPatRemembered() {
  return localStorage.getItem(STORAGE_KEYS.REMEMBER_PAT) === '1';
}

function clearStoredPat() {
  sessionStorage.removeItem(STORAGE_KEYS.PAT);
  localStorage.removeItem(STORAGE_KEYS.PAT);
}

function saveCredentials() {
  // repo / branch は機密でないので localStorage に常時保存
  localStorage.setItem(STORAGE_KEYS.REPO, state.repo);
  localStorage.setItem(STORAGE_KEYS.BRANCH, state.branch);

  // PAT は opt-in した側にだけ保存（片側は必ず消去）
  if (isPatRemembered()) {
    localStorage.setItem(STORAGE_KEYS.PAT, state.pat);
    sessionStorage.removeItem(STORAGE_KEYS.PAT);
  } else {
    sessionStorage.setItem(STORAGE_KEYS.PAT, state.pat);
    localStorage.removeItem(STORAGE_KEYS.PAT);
  }
}

function loadCredentials() {
  // sessionStorage 優先、なければ localStorage（旧バージョン互換）
  const pat = sessionStorage.getItem(STORAGE_KEYS.PAT)
            || localStorage.getItem(STORAGE_KEYS.PAT);
  const repo = localStorage.getItem(STORAGE_KEYS.REPO);
  const branch = localStorage.getItem(STORAGE_KEYS.BRANCH);
  if (pat) els.patInput.value = pat;
  if (repo) els.repoInput.value = repo;
  if (branch) els.branchInput.value = branch;
  // checkbox の初期状態を反映
  const rememberEl = document.getElementById('remember-pat');
  if (rememberEl) rememberEl.checked = isPatRemembered();
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

  // 6. Update ref — 〈Memory Engraving〉
  log('Updating branch ref...');
  try {
    await ghFetch(
      `/repos/${state.repo}/git/refs/heads/${encodeURIComponent(state.branch)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false }),
      }
    );
  } catch (err) {
    // 422 = non-fast-forward (リモートで先行コミットあり)
    if (/^\[422\]/.test(err.message)) {
      setStatus('〈Memory Conflict〉— remote ahead', 'error');
      log('Cardinal の記憶は古くなっています。リモートが先行更新されました。', 'error');
      log('変更内容は保持されています。ページをリロードして再同期後、再度 Seal してください。', 'warning');
      throw new Error(
        '〈Memory Conflict〉Cardinal の記憶は古くなっています。リモートが先行更新されました。\n\n' +
        'ページをリロードして再同期してから、もう一度 Seal を試してください。\n' +
        '（変更内容はリロードまで保持されます）'
      );
    }
    throw err;
  }

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

function isCombosFile(path) {
  return path.endsWith('/10_combos.dtsi');
}

function isGestureFile(path) {
  return /\/4[0-7]_[a-z_]+\.dtsi$/.test(path);
}

function isMacrosFile(path) {
  return path.endsWith('/20_macros.dtsi');
}

function isBehaviorFile(path) {
  return /\/(30|31|35)_enhance_armament[a-z_]*\.dtsi$/.test(path);
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
    if (viewConfBtn) viewConfBtn.style.display = '';
    if (state.viewMode === 'conf') showConfEditor(path, file);
    else showCodeEditor(path, file);
  } else if (isCombosFile(path)) {
    els.viewSwitch.classList.remove('hidden');
    if (state.viewMode === 'combos') showCombosEditor(path, file);
    else showCodeEditor(path, file);
  } else if (isGestureFile(path)) {
    els.viewSwitch.classList.remove('hidden');
    if (state.viewMode === 'gestures') showGesturesEditor(path, file);
    else showCodeEditor(path, file);
  } else if (isMacrosFile(path)) {
    els.viewSwitch.classList.remove('hidden');
    if (state.viewMode === 'macros') showMacrosEditor(path, file);
    else showCodeEditor(path, file);
  } else if (isBehaviorFile(path)) {
    els.viewSwitch.classList.remove('hidden');
    if (state.viewMode === 'behaviors') showBehaviorsEditor(path, file);
    else showCodeEditor(path, file);
  } else {
    els.viewSwitch.classList.add('hidden');
    state.viewMode = 'code';
    showCodeEditor(path, file);
  }

  // ビュータブの表示制御
  els.viewVisual.style.display = path === 'keymap.yaml' ? '' : 'none';
  if (viewConfBtn) viewConfBtn.style.display = isConfFile(path) ? '' : 'none';
  const viewCombosBtn = document.getElementById('view-combos');
  if (viewCombosBtn) viewCombosBtn.style.display = isCombosFile(path) ? '' : 'none';
  const viewGesturesBtn = document.getElementById('view-gestures');
  if (viewGesturesBtn) viewGesturesBtn.style.display = isGestureFile(path) ? '' : 'none';
  const viewMacrosBtn = document.getElementById('view-macros');
  if (viewMacrosBtn) viewMacrosBtn.style.display = isMacrosFile(path) ? '' : 'none';
  const viewBehaviorsBtn = document.getElementById('view-behaviors');
  if (viewBehaviorsBtn) viewBehaviorsBtn.style.display = isBehaviorFile(path) ? '' : 'none';

  renderTabBar();
  renderFileTree();
  setStatus(`Editing ${path}`, file.modified ? 'warning' : 'active');
}

function hideAllEditors() {
  els.codeEditorWrap.classList.add('hidden');
  els.visualEditor.classList.add('hidden');
  document.getElementById('conf-editor').classList.add('hidden');
  document.getElementById('combos-editor').classList.add('hidden');
  document.getElementById('gestures-editor').classList.add('hidden');
  document.getElementById('macros-editor').classList.add('hidden');
  document.getElementById('behaviors-editor').classList.add('hidden');
}

function updateViewBtns(mode) {
  els.viewCode.classList.toggle('active', mode === 'code');
  els.viewVisual.classList.toggle('active', mode === 'visual');
  document.getElementById('view-conf').classList.toggle('active', mode === 'conf');
  document.getElementById('view-combos').classList.toggle('active', mode === 'combos');
  document.getElementById('view-gestures').classList.toggle('active', mode === 'gestures');
  document.getElementById('view-macros').classList.toggle('active', mode === 'macros');
  document.getElementById('view-behaviors').classList.toggle('active', mode === 'behaviors');
}

function showCodeEditor(path, file) {
  hideAllEditors();
  els.codeEditorWrap.classList.remove('hidden');
  els.emptyState.classList.add('hidden');

  if (!cm) initCodeMirror();
  cm.setOption('mode', modeForPath(path));
  cm.setValue(file.content);
  cm.clearHistory();
  setTimeout(() => cm.refresh(), 10);

  updateViewBtns(state.viewMode);
}

function showVisualEditor() {
  hideAllEditors();
  els.visualEditor.classList.remove('hidden');
  updateViewBtns('visual');
  reloadVisualEditor();
}

function showConfEditor(path, file) {
  hideAllEditors();
  document.getElementById('conf-editor').classList.remove('hidden');
  updateViewBtns('conf');
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

/* ◆ COMBOS (10_combos.dtsi) PARSER / EDITOR ─── */
function parseCombosFile(text) {
  // ヘッダコメント（最初の `/* ... */`）を保持
  let header = '';
  const headerMatch = text.match(/^\s*\/\*[\s\S]*?\*\/\s*/);
  if (headerMatch) {
    header = headerMatch[0];
  }
  const body = stripDtsComments(text.slice(header.length));

  // 〈Parent Realm〉— トップレベルに `combos { ... };` がある場合はその中身を走査範囲に
  const topBlocks = walkTopLevelDtsBlocks(body);
  const combosParent = topBlocks.find((b) => b.name === 'combos' && !b.refName);
  const scope = combosParent ? combosParent.inner : body;

  const children = walkTopLevelDtsBlocks(scope);
  const entries = [];
  for (const { name, inner } of children) {
    if (!inner) continue;
    const props = {};
    const bindingsM = inner.match(/bindings\s*=\s*<\s*([\s\S]*?)\s*>\s*;/);
    if (bindingsM) props.bindings = bindingsM[1].trim();
    const kpM = inner.match(/key-positions\s*=\s*<\s*([\s\S]*?)\s*>\s*;/);
    if (kpM) props.keyPositions = kpM[1].trim();
    const timeoutM = inner.match(/timeout-ms\s*=\s*<\s*(\d+)\s*>\s*;/);
    if (timeoutM) props.timeoutMs = Number(timeoutM[1]);
    const layersM = inner.match(/layers\s*=\s*<\s*([\s\S]*?)\s*>\s*;/);
    if (layersM) props.layers = layersM[1].trim();
    const ripM = inner.match(/require-prior-idle-ms\s*=\s*<\s*(\d+)\s*>\s*;/);
    if (ripM) props.requirePriorIdleMs = Number(ripM[1]);
    entries.push({ name, ...props });
  }
  return { header, entries };
}

function serializeCombosFile(parsed) {
  const lines = [];
  if (parsed.header) lines.push(parsed.header.trimEnd());
  if (parsed.entries.length > 0 && parsed.header) lines.push('');

  for (const entry of parsed.entries) {
    lines.push(`${entry.name} {`);
    if (entry.bindings) lines.push(`    bindings = <${entry.bindings}>;`);
    if (entry.keyPositions) lines.push(`    key-positions = <${entry.keyPositions}>;`);
    if (entry.timeoutMs !== undefined && entry.timeoutMs !== null && entry.timeoutMs !== '') {
      lines.push(`    timeout-ms = <${entry.timeoutMs}>;`);
    }
    if (entry.layers) lines.push(`    layers = <${entry.layers}>;`);
    if (entry.requirePriorIdleMs !== undefined && entry.requirePriorIdleMs !== null && entry.requirePriorIdleMs !== '') {
      lines.push(`    require-prior-idle-ms = <${entry.requirePriorIdleMs}>;`);
    }
    lines.push('};');
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}

function showCombosEditor(path, file) {
  hideAllEditors();
  document.getElementById('combos-editor').classList.remove('hidden');
  updateViewBtns('combos');
  renderCombosEditor(path, file);
}

async function ensureLayoutLoaded() {
  if (state.layoutData) return;
  try {
    if (!state.files.has('config/Release_Recollection.json')) {
      await fetchFile('config/Release_Recollection.json');
    }
    const jf = state.files.get('config/Release_Recollection.json');
    state.layoutData = JSON.parse(jf.content);
  } catch (e) {
    log(`Layout load failed: ${e.message}`, 'warning');
  }
}

/* ◆ keymap.yaml から behavior の使用箇所を検索 ─── */
function findBehaviorUsages(behaviorRefName) {
  const usages = [];
  if (!state.yamlData?.layers) return usages;
  // & 付き / 単独 / hold で使われている可能性
  const searchPatterns = [
    new RegExp(`(?:^|\\W)&${behaviorRefName}(?:\\W|$)`),  // &gE_up など
    new RegExp(`(?:^|\\W)${behaviorRefName}(?:\\W|$)`),   // GESTURE_E など hold 名
  ];
  for (const [layerName, bindings] of Object.entries(state.yamlData.layers)) {
    bindings.forEach((b, position) => {
      const text = b === null || b === undefined ? ''
        : typeof b === 'string' ? b
        : [b.t, b.h].filter(Boolean).join(' ');
      if (searchPatterns.some((re) => re.test(text))) {
        usages.push({ layerName, position });
      }
    });
  }
  return usages;
}

function renderUsageMiniGrid(parent, behaviorRefName) {
  const layout = state.layoutData?.layouts?.default_layout?.layout || [];
  const yamlLayer = state.yamlData?.layers?.default || [];
  if (layout.length === 0 || yamlLayer.length === 0) return;

  const usages = findBehaviorUsages(behaviorRefName);
  const usagePositions = new Set(usages.map((u) => u.position));

  const wrapper = document.createElement('div');
  wrapper.className = 'usage-wrapper';

  const summary = document.createElement('div');
  summary.className = 'usage-summary';
  if (usages.length === 0) {
    summary.classList.add('usage-none');
    summary.textContent = `Used in: (どのレイヤーでも未使用)`;
  } else {
    const layerLabels = usages.map((u) => `${u.layerName}[${u.position}]`).join(', ');
    summary.innerHTML = `<span>Used in:</span> <code>${layerLabels}</code>`;
  }
  wrapper.appendChild(summary);

  if (usages.length === 0) {
    parent.appendChild(wrapper);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'combo-key-grid';
  const unitPx = 38, gap = 3, padding = 8;
  const bounds = computeLayoutBounds(layout, 'width', 'height');
  const gw = bounds.maxX * unitPx + padding * 2;
  const gh = bounds.maxY * unitPx + padding * 2;
  grid.style.cssText =
    `position: relative; width: ${gw}px; min-height: ${gh}px; height: ${gh}px; ` +
    `flex-shrink: 0; padding: ${padding}px;`;

  layout.forEach((pos, idx) => {
    const cell = document.createElement('div');
    cell.className = 'combo-key-cell';
    if (usagePositions.has(idx)) cell.classList.add('selected', 'usage-cell');
    const t = yamlLayer[idx] === null || yamlLayer[idx] === undefined ? ''
      : typeof yamlLayer[idx] === 'string' ? yamlLayer[idx]
      : (yamlLayer[idx].t || '');
    const labelEl = document.createElement('div');
    labelEl.className = 'combo-key-label';
    labelEl.textContent = t || '·';
    labelEl.style.fontSize = '0.55rem';
    cell.appendChild(labelEl);

    const w = (pos.width ?? 1) * unitPx - gap;
    const h = (pos.height ?? 1) * unitPx - gap;
    cell.style.cssText =
      `position: absolute; left: ${(pos.x ?? 0) * unitPx + padding + gap / 2}px; ` +
      `top: ${(pos.y ?? 0) * unitPx + padding + gap / 2}px; ` +
      `width: ${w}px; height: ${h}px;`;
    if (pos.r) {
      const rx = pos.rx ?? pos.x ?? 0;
      const ry = pos.ry ?? pos.y ?? 0;
      const ox = (rx - (pos.x ?? 0)) * unitPx;
      const oy = (ry - (pos.y ?? 0)) * unitPx;
      cell.style.transformOrigin = `${ox}px ${oy}px`;
      cell.style.transform = `rotate(${pos.r}deg)`;
    }
    cell.style.cursor = 'default';
    grid.appendChild(cell);
  });
  wrapper.appendChild(grid);
  parent.appendChild(wrapper);
}

async function ensureKeymapYamlLoaded() {
  if (state.yamlData) return;
  try {
    if (!state.files.has('keymap.yaml')) {
      await fetchFile('keymap.yaml');
    }
    const yf = state.files.get('keymap.yaml');
    state.yamlData = jsyaml.load(yf.content);
  } catch (e) {
    log(`keymap.yaml load failed: ${e.message}`, 'warning');
  }
}

function getKeyLabel(idx) {
  const layer = state.yamlData?.layers?.default || [];
  const entry = layer[idx];
  if (entry === null || entry === undefined) return '';
  if (typeof entry === 'string') return entry;
  if (typeof entry === 'object') return entry.t || '';
  return String(entry);
}

function renderPhysicalKeySelector(parent, selectedPositions, onChange) {
  const layout = state.layoutData?.layouts?.default_layout?.layout || [];
  if (layout.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Physical layout が読み込まれていません（先に keymap.yaml を開くか、再認証してください）。';
    parent.appendChild(p);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'combo-key-grid';
  // Visual Editor と同じ見た目に合わせる: unitPx=56, gap=4, padding=12
  const unitPx = 56;
  const gap = 4;
  const padding = 12;
  const bounds = computeLayoutBounds(layout, 'width', 'height');
  const gw = bounds.maxX * unitPx + padding * 2;
  const gh = bounds.maxY * unitPx + padding * 2;
  grid.style.cssText =
    `position: relative; width: ${gw}px; min-height: ${gh}px; height: ${gh}px; ` +
    `flex-shrink: 0; padding: ${padding}px;`;

  layout.forEach((pos, idx) => {
    const cell = document.createElement('div');
    cell.className = 'combo-key-cell';
    if (selectedPositions.includes(idx)) cell.classList.add('selected');

    // Visual Editor と同じ表示構造: tap label + position number
    const tapLabel = getKeyLabel(idx);
    const labelEl = document.createElement('div');
    labelEl.className = 'combo-key-label';
    labelEl.textContent = tapLabel || '·';
    const idxEl = document.createElement('div');
    idxEl.className = 'combo-key-idx';
    idxEl.textContent = `[${idx}]`;
    cell.appendChild(idxEl);
    cell.appendChild(labelEl);

    const w = (pos.width ?? 1) * unitPx - gap;
    const h = (pos.height ?? 1) * unitPx - gap;
    cell.style.cssText =
      `position: absolute; left: ${(pos.x ?? 0) * unitPx + padding + gap / 2}px; ` +
      `top: ${(pos.y ?? 0) * unitPx + padding + gap / 2}px; ` +
      `width: ${w}px; height: ${h}px;`;
    if (pos.r) {
      const rx = pos.rx ?? pos.x ?? 0;
      const ry = pos.ry ?? pos.y ?? 0;
      const ox = (rx - (pos.x ?? 0)) * unitPx;
      const oy = (ry - (pos.y ?? 0)) * unitPx;
      cell.style.transformOrigin = `${ox}px ${oy}px`;
      cell.style.transform = `rotate(${pos.r}deg)`;
    }
    cell.onclick = () => {
      const next = selectedPositions.includes(idx)
        ? selectedPositions.filter((i) => i !== idx)
        : [...selectedPositions, idx].sort((a, b) => a - b);
      onChange(next);
    };
    grid.appendChild(cell);
  });
  parent.appendChild(grid);
}

function renderCombosEditor(path, file) {
  const wrap = document.getElementById('combos-entries');
  wrap.innerHTML = '';
  const parsed = parseCombosFile(file.content);
  const original = parseCombosFile(file.original);

  // layout と keymap.yaml を非同期で取得（未取得なら再描画）
  if (!state.layoutData || !state.yamlData) {
    Promise.all([ensureLayoutLoaded(), ensureKeymapYamlLoaded()]).then(() => {
      if (state.activePath === path && state.viewMode === 'combos') {
        renderCombosEditor(path, state.files.get(path));
      }
    });
  }

  parsed.entries.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'combo-card combo-card-with-grid';
    const orig = original.entries[idx] || {};
    const isModified = JSON.stringify(entry) !== JSON.stringify(orig);
    if (isModified) card.classList.add('modified');

    const nameLabel = makeField('Name', 'text', entry.name || '', (v) => {
      entry.name = v;
      commitCombosChange(path, parsed);
    });
    const bindingsLabel = makeField('Bindings', 'text', entry.bindings || '', (v) => {
      entry.bindings = v;
      commitCombosChange(path, parsed);
    });
    bindingsLabel.querySelector('input').placeholder = '例: &kp ESCAPE';
    attachBehaviorPicker(bindingsLabel, bindingsLabel.querySelector('input'));

    const positions = (entry.keyPositions || '').split(/\s+/).filter((s) => s).map(Number);
    const kpDisplay = document.createElement('div');
    kpDisplay.className = 'combo-kp-display';
    kpDisplay.innerHTML = `<span class="combo-kp-label">Key Positions:</span> <code>${positions.join(' ') || '(none)'}</code>`;

    const gridWrap = document.createElement('div');
    gridWrap.className = 'combo-grid-wrap';
    renderPhysicalKeySelector(gridWrap, positions, (next) => {
      entry.keyPositions = next.join(' ');
      commitCombosChange(path, parsed);
      renderCombosEditor(path, state.files.get(path));
    });

    const actions = document.createElement('div');
    actions.className = 'combo-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'combo-delete-btn';
    delBtn.textContent = '✕ 削除';
    delBtn.onclick = () => {
      if (!confirm(`コンボ "${entry.name}" を削除しますか？`)) return;
      parsed.entries.splice(idx, 1);
      commitCombosChange(path, parsed);
      renderCombosEditor(path, state.files.get(path));
    };
    actions.appendChild(delBtn);

    card.appendChild(nameLabel);
    card.appendChild(bindingsLabel);
    card.appendChild(kpDisplay);
    card.appendChild(actions);
    card.appendChild(gridWrap);
    wrap.appendChild(card);
  });
}

function makeField(labelText, type, value, onChange) {
  const lbl = document.createElement('label');
  const span = document.createElement('span');
  span.textContent = labelText;
  const inp = document.createElement('input');
  inp.type = type;
  inp.value = value;
  inp.addEventListener('input', () => onChange(inp.value));
  lbl.appendChild(span);
  lbl.appendChild(inp);
  return lbl;
}

function commitCombosChange(path, parsed) {
  const file = state.files.get(path);
  if (!file) return;
  const newContent = serializeCombosFile(parsed);
  file.content = newContent;
  file.modified = file.content !== file.original;
  if (cm && state.activePath === path && state.viewMode === 'code') {
    cm.setValue(newContent);
  }
  renderTabBar();
  renderFileTree();
  renderModifiedList();
}

function addNewCombo(path) {
  const file = state.files.get(path);
  if (!file) return;
  const parsed = parseCombosFile(file.content);
  parsed.entries.push({
    name: `new_combo_${parsed.entries.length + 1}`,
    bindings: '&kp A',
    keyPositions: '0 1',
  });
  commitCombosChange(path, parsed);
  renderCombosEditor(path, state.files.get(path));
}

/* ◆ COMMON DTS BEHAVIOR PARSER ─────────── */

// 〈Sigil Purify〉— /* ... */ と // ... を取り除いてコメント内のブレースを無効化
function stripDtsComments(text) {
  let out = '';
  let i = 0;
  const N = text.length;
  while (i < N) {
    if (text[i] === '"') {
      // 文字列リテラルはそのまま温存
      const end = text.indexOf('"', i + 1);
      if (end < 0) { out += text.slice(i); break; }
      out += text.slice(i, end + 1);
      i = end + 1;
    } else if (text[i] === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) break;
      // コメント位置に改行を保ち、行番号 / 差分のズレを防ぐ
      out += text.slice(i, end + 2).replace(/[^\n]/g, ' ');
      i = end + 2;
    } else if (text[i] === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? N : end;
      out += ' '.repeat(stop - i);
      i = stop;
    } else {
      out += text[i++];
    }
  }
  return out;
}

// 〈Tree Walk〉— ブレースバランスで top-level ブロックを抽出。
// プロパティ (`key = value;` / `key;`) はスキップ、ネスト `{ ... }` 内をスキャンしない。
// 文字列リテラル "..." 内のブレースは無視。
function walkTopLevelDtsBlocks(body) {
  const out = [];
  let i = 0;
  const N = body.length;
  const skipString = (start) => {
    let j = start + 1;
    while (j < N) {
      if (body[j] === '\\' && j + 1 < N) { j += 2; continue; }
      if (body[j] === '"') return j + 1;
      j++;
    }
    return N;
  };
  while (i < N) {
    while (i < N && /\s/.test(body[i])) i++;
    if (i >= N) break;
    const tail = body.slice(i);
    // ブロック: `refName: label {` または `name {`
    const blockM = tail.match(/^([#a-zA-Z][\w-]*)(?:\s*:\s*([#a-zA-Z][\w-]*))?\s*\{/);
    if (blockM) {
      const refName = blockM[2] ? blockM[1] : null;
      const label = blockM[2] || blockM[1];
      const openAt = i + blockM[0].length - 1;
      let depth = 1;
      let j = openAt + 1;
      while (j < N && depth > 0) {
        const c = body[j];
        if (c === '"') { j = skipString(j); continue; }
        if (c === '{') depth++;
        else if (c === '}') depth--;
        j++;
      }
      if (depth !== 0) break; // 閉じカッコ不足 → 途中で打ち切り
      const inner = body.slice(openAt + 1, j - 1);
      let k = j;
      while (k < N && /\s/.test(body[k])) k++;
      const semi = body[k] === ';';
      out.push({ refName, label, name: refName || label, inner });
      i = semi ? k + 1 : j;
      continue;
    }
    // プロパティ: `key = ... ;` または boolean `key;`
    const propM = tail.match(/^[#a-zA-Z][\w-]*\s*(?:=[\s\S]*?)?;/);
    if (propM) {
      i += propM[0].length;
      continue;
    }
    // 不明トークン → 1 char 進める
    i++;
  }
  return out;
}

// `name: label { ... };` 構造を抽出（ネスト / コメント対応）
function parseDtsBlocks(text) {
  let header = '';
  const headerMatch = text.match(/^\s*\/\*[\s\S]*?\*\/\s*/);
  if (headerMatch) header = headerMatch[0];
  const body = stripDtsComments(text.slice(header.length));
  const entries = walkTopLevelDtsBlocks(body)
    .filter((b) => b.refName) // ラベル付き (`name: label {`) のみ採用
    .map(({ refName, label, inner }) => ({
      refName,
      label,
      props: parseDtsProps(inner),
    }));
  return { header, entries };
}

function parseDtsProps(text) {
  const props = [];
  // key = value;  (key は #binding-cells のように # で始まる場合あり)
  const re = /(#?[a-zA-Z][\w-]*)\s*=\s*([\s\S]*?);/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    props.push({ key: m[1], value: m[2].trim() });
  }
  return props;
}

function serializeDtsProps(props, indent = '    ') {
  return props.map((p) => `${indent}${p.key} = ${p.value};`).join('\n');
}

function serializeDtsBlocks(parsed) {
  const lines = [];
  if (parsed.header) lines.push(parsed.header.trimEnd());
  if (parsed.entries.length > 0 && parsed.header) lines.push('');
  for (const entry of parsed.entries) {
    lines.push(`${entry.refName}: ${entry.label} {`);
    lines.push(serializeDtsProps(entry.props));
    lines.push('};');
    lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}

function getProp(props, key) {
  return props.find((p) => p.key === key);
}

function setProp(props, key, value) {
  const p = getProp(props, key);
  if (p) p.value = value;
  else props.push({ key, value });
}

/* ◆ STEP 4: GESTURES EDITOR (40-47_*.dtsi) ─── */
function showGesturesEditor(path, file) {
  hideAllEditors();
  document.getElementById('gestures-editor').classList.remove('hidden');
  updateViewBtns('gestures');
  renderGesturesEditor(path, file);
  if (!state.layoutData || !state.yamlData) {
    Promise.all([ensureLayoutLoaded(), ensureKeymapYamlLoaded()]).then(() => {
      if (state.activePath === path && state.viewMode === 'gestures') {
        renderGesturesEditor(path, state.files.get(path));
      }
    });
  }
}

const DIRECTION_ARROWS = { up: '↑', down: '↓', left: '←', right: '→' };
const SWORD_SKILL_NAMES = {
  E: 'Sharp Nail',  R: 'Vorpal Strike', S: 'The Eclipse',  B: 'Howling Octave',
  T: 'Sonic Leap',  A: 'Vertical Square', D: 'Starburst Stream', W: 'Horizontal',
};

function parseGestureName(refName) {
  const m = refName.match(/^g([A-Z])_(up|down|left|right)$/);
  if (m) return { baseKey: m[1], direction: m[2] };
  return null;
}

function renderGesturesEditor(path, file) {
  const wrap = document.getElementById('gestures-entries');
  wrap.innerHTML = '';
  const parsed = parseDtsBlocks(file.content);
  const original = parseDtsBlocks(file.original);

  parsed.entries.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'combo-card combo-card-with-grid gesture-card';
    const orig = original.entries[idx] || {};
    if (JSON.stringify(entry) !== JSON.stringify(orig)) card.classList.add('modified');

    // mod-morph: bindings = <default>, <mod-pressed>;
    const bindings = getProp(entry.props, 'bindings');
    let defaultBind = '', modBind = '';
    if (bindings) {
      const m = bindings.value.match(/<([\s\S]*?)>(?:\s*,\s*<([\s\S]*?)>)?/);
      if (m) { defaultBind = m[1].trim(); modBind = (m[2] || '').trim(); }
    }
    const mods = getProp(entry.props, 'mods');

    // ヘッダー：方向アイコン + base key + Sword Skill 名
    const parsedName = parseGestureName(entry.refName);
    const header = document.createElement('div');
    header.className = 'gesture-header';
    if (parsedName) {
      const arrow = document.createElement('div');
      arrow.className = 'gesture-arrow';
      arrow.textContent = DIRECTION_ARROWS[parsedName.direction];
      header.appendChild(arrow);

      const meta = document.createElement('div');
      meta.className = 'gesture-meta';
      meta.innerHTML =
        `<div class="gesture-skill">${SWORD_SKILL_NAMES[parsedName.baseKey] || '—'}</div>` +
        `<div class="gesture-base-key"><span>Key:</span> <code>${parsedName.baseKey}</code> &nbsp;` +
        `<span>Direction:</span> <code>${parsedName.direction}</code></div>` +
        `<div class="gesture-name-display"><code>${entry.refName}</code></div>`;
      header.appendChild(meta);
    } else {
      const meta = document.createElement('div');
      meta.className = 'gesture-meta';
      meta.innerHTML = `<div class="gesture-skill">Custom mod-morph</div><div><code>${entry.refName}</code></div>`;
      header.appendChild(meta);
    }
    card.appendChild(header);

    const defaultLabel = makeField('Default (修飾なし)', 'text', defaultBind, (v) => {
      defaultBind = v;
      const newBind = modBind ? `<${v}>, <${modBind}>` : `<${v}>`;
      setProp(entry.props, 'bindings', newBind);
      commitDtsChange(path, parsed);
    });
    const modLabel = makeField('Mod-pressed (修飾あり)', 'text', modBind, (v) => {
      modBind = v;
      const newBind = v ? `<${defaultBind}>, <${v}>` : `<${defaultBind}>`;
      setProp(entry.props, 'bindings', newBind);
      commitDtsChange(path, parsed);
    });
    defaultLabel.querySelector('input').placeholder = '例: &kp LG(C)';
    modLabel.querySelector('input').placeholder = '例: &kp LG(X)';
    attachBehaviorPicker(defaultLabel, defaultLabel.querySelector('input'));
    attachBehaviorPicker(modLabel, modLabel.querySelector('input'));
    card.appendChild(defaultLabel);
    card.appendChild(modLabel);

    if (mods) {
      const modsLabel = document.createElement('div');
      modsLabel.className = 'gesture-mods';
      modsLabel.innerHTML = `<span>mods:</span> <code>${mods.value}</code>`;
      card.appendChild(modsLabel);
    }

    // base key を物理レイアウトでハイライト表示
    if (parsedName) {
      const gridWrap = document.createElement('div');
      gridWrap.className = 'combo-grid-wrap';
      renderGestureBaseKeyView(gridWrap, parsedName.baseKey, parsedName.direction);
      card.appendChild(gridWrap);
    }

    wrap.appendChild(card);
  });
}

function renderGestureBaseKeyView(parent, baseKey, direction) {
  const layout = state.layoutData?.layouts?.default_layout?.layout || [];
  const yamlLayer = state.yamlData?.layers?.default || [];
  if (layout.length === 0 || yamlLayer.length === 0) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Physical layout / keymap.yaml を読み込み中...';
    parent.appendChild(p);
    return;
  }

  // base key の position を keymap から探す（tap が baseKey と一致する最初のキー）
  let basePos = -1;
  yamlLayer.forEach((entry, idx) => {
    if (basePos !== -1) return;
    const t = (entry === null || entry === undefined) ? ''
      : typeof entry === 'string' ? entry
      : (entry.t || '');
    if (t === baseKey) basePos = idx;
  });

  const grid = document.createElement('div');
  grid.className = 'combo-key-grid';
  const unitPx = 56, gap = 4, padding = 12;
  const bounds = computeLayoutBounds(layout, 'width', 'height');
  const gw = bounds.maxX * unitPx + padding * 2;
  const gh = bounds.maxY * unitPx + padding * 2;
  grid.style.cssText =
    `position: relative; width: ${gw}px; min-height: ${gh}px; height: ${gh}px; ` +
    `flex-shrink: 0; padding: ${padding}px;`;

  layout.forEach((pos, idx) => {
    const cell = document.createElement('div');
    cell.className = 'combo-key-cell';
    if (idx === basePos) cell.classList.add('selected', 'gesture-base-cell');

    const t = (yamlLayer[idx] === null || yamlLayer[idx] === undefined) ? ''
      : typeof yamlLayer[idx] === 'string' ? yamlLayer[idx]
      : (yamlLayer[idx].t || '');
    const idxEl = document.createElement('div');
    idxEl.className = 'combo-key-idx';
    idxEl.textContent = `[${idx}]`;
    const labelEl = document.createElement('div');
    labelEl.className = 'combo-key-label';
    labelEl.textContent = t || '·';
    cell.appendChild(idxEl);
    cell.appendChild(labelEl);

    if (idx === basePos) {
      const arrowEl = document.createElement('div');
      arrowEl.className = 'gesture-cell-arrow';
      arrowEl.textContent = DIRECTION_ARROWS[direction];
      cell.appendChild(arrowEl);
    }

    const w = (pos.width ?? 1) * unitPx - gap;
    const h = (pos.height ?? 1) * unitPx - gap;
    cell.style.cssText =
      `position: absolute; left: ${(pos.x ?? 0) * unitPx + padding + gap / 2}px; ` +
      `top: ${(pos.y ?? 0) * unitPx + padding + gap / 2}px; ` +
      `width: ${w}px; height: ${h}px;`;
    if (pos.r) {
      const rx = pos.rx ?? pos.x ?? 0;
      const ry = pos.ry ?? pos.y ?? 0;
      const ox = (rx - (pos.x ?? 0)) * unitPx;
      const oy = (ry - (pos.y ?? 0)) * unitPx;
      cell.style.transformOrigin = `${ox}px ${oy}px`;
      cell.style.transform = `rotate(${pos.r}deg)`;
    }
    cell.style.cursor = 'default';
    grid.appendChild(cell);
  });
  parent.appendChild(grid);
}

function commitDtsChange(path, parsed) {
  const file = state.files.get(path);
  if (!file) return;
  const newContent = serializeDtsBlocks(parsed);
  file.content = newContent;
  file.modified = file.content !== file.original;
  if (cm && state.activePath === path && state.viewMode === 'code') {
    cm.setValue(newContent);
  }
  renderTabBar();
  renderFileTree();
  renderModifiedList();
}

/* ◆ STEP 5: MACROS EDITOR (20_macros.dtsi) ─── */
function showMacrosEditor(path, file) {
  hideAllEditors();
  document.getElementById('macros-editor').classList.remove('hidden');
  updateViewBtns('macros');
  renderMacrosEditor(path, file);
  if (!state.layoutData || !state.yamlData) {
    Promise.all([ensureLayoutLoaded(), ensureKeymapYamlLoaded()]).then(() => {
      if (state.activePath === path && state.viewMode === 'macros') {
        renderMacrosEditor(path, state.files.get(path));
      }
    });
  }
}

function renderMacrosEditor(path, file) {
  const wrap = document.getElementById('macros-entries');
  wrap.innerHTML = '';
  const parsed = parseDtsBlocks(file.content);
  const original = parseDtsBlocks(file.original);

  parsed.entries.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'combo-card';
    card.style.gridTemplateColumns = '1fr';
    const orig = original.entries[idx] || {};
    if (JSON.stringify(entry) !== JSON.stringify(orig)) card.classList.add('modified');

    const compatible = getProp(entry.props, 'compatible');
    const bindings = getProp(entry.props, 'bindings');
    const label = getProp(entry.props, 'label');

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.gap = '12px';
    headerRow.style.flexWrap = 'wrap';
    headerRow.style.alignItems = 'center';

    const nameLbl = makeField('Name', 'text', entry.refName, (v) => {
      entry.refName = v; entry.label = v;
      commitDtsChange(path, parsed);
    });
    nameLbl.style.flex = '1';
    headerRow.appendChild(nameLbl);

    if (compatible) {
      const compEl = document.createElement('div');
      compEl.style.fontSize = '0.65rem';
      compEl.style.color = 'var(--accent-violet)';
      compEl.textContent = compatible.value.replace(/^"zmk,behavior-(.+)"$/, '$1');
      headerRow.appendChild(compEl);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'combo-delete-btn';
    delBtn.textContent = '✕ 削除';
    delBtn.onclick = () => {
      if (!confirm(`マクロ "${entry.refName}" を削除しますか？`)) return;
      parsed.entries.splice(idx, 1);
      commitDtsChange(path, parsed);
      renderMacrosEditor(path, state.files.get(path));
    };
    headerRow.appendChild(delBtn);
    card.appendChild(headerRow);

    // bindings as multiline textarea
    if (bindings) {
      const bindLbl = document.createElement('label');
      bindLbl.style.display = 'block';
      bindLbl.style.fontSize = '0.65rem';
      bindLbl.style.color = 'var(--text-secondary)';
      bindLbl.style.marginTop = '8px';
      bindLbl.innerHTML = '<span>Bindings (sequence)</span>';
      const ta = document.createElement('textarea');
      ta.value = bindings.value;
      ta.rows = Math.max(2, bindings.value.split(',').length);
      ta.style.width = '100%';
      ta.style.background = 'var(--bg-deep)';
      ta.style.border = '1px solid var(--border-accent)';
      ta.style.color = 'var(--text-primary)';
      ta.style.padding = '6px 8px';
      ta.style.fontFamily = 'inherit';
      ta.style.fontSize = '0.72rem';
      ta.style.borderRadius = '2px';
      ta.style.fontFamily = 'SF Mono, monospace';
      ta.addEventListener('input', () => {
        setProp(entry.props, 'bindings', ta.value);
        commitDtsChange(path, parsed);
      });
      const taRow = document.createElement('div');
      taRow.style.display = 'flex';
      taRow.style.gap = '4px';
      taRow.style.alignItems = 'flex-start';
      taRow.appendChild(ta);
      const pickBtn = document.createElement('button');
      pickBtn.type = 'button';
      pickBtn.className = 'bp-pick-btn';
      pickBtn.textContent = '📝';
      pickBtn.title = 'Behavior Picker (cursor 位置に挿入)';
      pickBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openBehaviorPicker(ta, 'insert');
      });
      taRow.appendChild(pickBtn);
      bindLbl.appendChild(taRow);
      card.appendChild(bindLbl);
    }

    // 使用箇所を物理レイアウトで表示
    renderUsageMiniGrid(card, entry.refName);

    wrap.appendChild(card);
  });
}

function addNewMacro(path) {
  const file = state.files.get(path);
  if (!file) return;
  const parsed = parseDtsBlocks(file.content);
  const n = parsed.entries.length + 1;
  parsed.entries.push({
    refName: `new_macro_${n}`,
    label: `new_macro_${n}`,
    props: [
      { key: 'compatible', value: '"zmk,behavior-macro"' },
      { key: 'label', value: `"NEW_MACRO_${n}"` },
      { key: '#binding-cells', value: '<0>' },
      { key: 'bindings', value: '<&kp A>' },
    ],
  });
  commitDtsChange(path, parsed);
  renderMacrosEditor(path, state.files.get(path));
}

/* ◆ STEP 6: BEHAVIORS EDITOR (30/31/35_*.dtsi) ─── */
function showBehaviorsEditor(path, file) {
  hideAllEditors();
  document.getElementById('behaviors-editor').classList.remove('hidden');
  updateViewBtns('behaviors');
  renderBehaviorsEditor(path, file);
  if (!state.layoutData || !state.yamlData) {
    Promise.all([ensureLayoutLoaded(), ensureKeymapYamlLoaded()]).then(() => {
      if (state.activePath === path && state.viewMode === 'behaviors') {
        renderBehaviorsEditor(path, state.files.get(path));
      }
    });
  }
}

function renderBehaviorsEditor(path, file) {
  const wrap = document.getElementById('behaviors-entries');
  wrap.innerHTML = '';
  const parsed = parseDtsBlocks(file.content);
  const original = parseDtsBlocks(file.original);

  parsed.entries.forEach((entry, idx) => {
    const card = document.createElement('div');
    card.className = 'combo-card';
    card.style.gridTemplateColumns = '1fr';
    const orig = original.entries[idx] || {};
    if (JSON.stringify(entry) !== JSON.stringify(orig)) card.classList.add('modified');

    const compatible = getProp(entry.props, 'compatible');

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.gap = '12px';
    headerRow.style.flexWrap = 'wrap';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';

    const nameLbl = makeField('Name', 'text', entry.refName, (v) => {
      entry.refName = v; entry.label = v;
      commitDtsChange(path, parsed);
    });
    nameLbl.style.flex = '1';
    headerRow.appendChild(nameLbl);

    if (compatible) {
      const compEl = document.createElement('div');
      compEl.style.fontSize = '0.65rem';
      compEl.style.color = 'var(--accent-violet)';
      compEl.style.padding = '4px 8px';
      compEl.style.background = 'var(--bg-deep)';
      compEl.style.borderRadius = '2px';
      compEl.textContent = compatible.value.replace(/^"zmk,behavior-(.+)"$/, '$1');
      headerRow.appendChild(compEl);
    }

    const delBtn = document.createElement('button');
    delBtn.className = 'combo-delete-btn';
    delBtn.textContent = '✕ 削除';
    delBtn.onclick = () => {
      if (!confirm(`Behavior "${entry.refName}" を削除しますか？`)) return;
      parsed.entries.splice(idx, 1);
      commitDtsChange(path, parsed);
      renderBehaviorsEditor(path, state.files.get(path));
    };
    headerRow.appendChild(delBtn);
    card.appendChild(headerRow);

    // 編集可能な properties をテーブル風に
    const propsGrid = document.createElement('div');
    propsGrid.style.display = 'grid';
    propsGrid.style.gridTemplateColumns = '180px 1fr';
    propsGrid.style.gap = '4px 12px';
    propsGrid.style.fontSize = '0.7rem';

    entry.props.forEach((p) => {
      const keyEl = document.createElement('div');
      keyEl.style.color = 'var(--accent-cyan)';
      keyEl.textContent = p.key;
      const valueWrap = document.createElement('div');
      valueWrap.style.display = 'flex';
      valueWrap.style.gap = '4px';
      valueWrap.style.alignItems = 'center';
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = p.value;
      inp.style.background = 'var(--bg-deep)';
      inp.style.border = '1px solid var(--border-accent)';
      inp.style.color = 'var(--text-primary)';
      inp.style.padding = '3px 6px';
      inp.style.fontFamily = 'SF Mono, monospace';
      inp.style.fontSize = '0.7rem';
      inp.style.borderRadius = '2px';
      inp.style.flex = '1';
      inp.style.minWidth = '0';
      inp.addEventListener('input', () => {
        p.value = inp.value;
        commitDtsChange(path, parsed);
      });
      valueWrap.appendChild(inp);
      // bindings 系の property は behavior picker を付ける
      if (p.key === 'bindings' || p.key.endsWith('-binding') || p.key === 'sensor-bindings') {
        const pickBtn = document.createElement('button');
        pickBtn.type = 'button';
        pickBtn.className = 'bp-pick-btn';
        pickBtn.textContent = '📝';
        pickBtn.title = 'Behavior Picker (cursor 位置に挿入)';
        pickBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openBehaviorPicker(inp, 'insert');
        });
        valueWrap.appendChild(pickBtn);
      }
      propsGrid.appendChild(keyEl);
      propsGrid.appendChild(valueWrap);
    });
    card.appendChild(propsGrid);

    // 使用箇所を物理レイアウトで表示
    renderUsageMiniGrid(card, entry.refName);

    wrap.appendChild(card);
  });
}

/* ◆ BEHAVIOR PICKER ─────────────────────── */
const BP_HID_TABLES = {
  'hid-letters': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  'hid-digits': '0 1 2 3 4 5 6 7 8 9'.split(' '),
  'hid-functions': Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  'hid-arrows': ['UP', 'DOWN', 'LEFT', 'RIGHT'],
  'hid-special': ['ESC', 'TAB', 'SPACE', 'ENTER', 'BACKSPACE', 'DELETE', 'CAPS', 'HOME', 'END', 'PAGE_UP', 'PAGE_DOWN', 'INSERT', 'PRINT_SCREEN'],
  'hid-symbols': ['EXCLAMATION', 'AT', 'HASH', 'DOLLAR', 'PERCENT', 'CARET', 'AMPERSAND', 'ASTERISK', 'LPAR', 'RPAR', 'MINUS', 'EQUAL', 'PLUS', 'LBKT', 'RBKT', 'LBRC', 'RBRC', 'BSLH', 'SEMI', 'COLON', 'SQT', 'DQT', 'GRAVE', 'TILDE', 'COMMA', 'DOT', 'FSLH', 'QMARK', 'LT', 'GT', 'UNDER', 'PIPE'],
  'hid-modifiers': ['LEFT_SHIFT', 'RIGHT_SHIFT', 'LEFT_CONTROL', 'RIGHT_CONTROL', 'LEFT_ALT', 'RIGHT_ALT', 'LEFT_GUI', 'RIGHT_GUI'],
};

const bpState = {
  targetEl: null,           // 操作対象の input/textarea
  selectionStart: null,
  selectionEnd: null,
  insertMode: 'insert',     // 'insert' | 'replace'
};

function fillSelectFromArray(selectEl, items) {
  selectEl.innerHTML = '';
  for (const v of items) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    selectEl.appendChild(opt);
  }
}

function bpRefreshHidKeys(catSelectId, keySelectId) {
  const cat = document.getElementById(catSelectId).value;
  fillSelectFromArray(document.getElementById(keySelectId), BP_HID_TABLES[cat] || []);
}

function bpInit() {
  // HID キーリスト初期化
  bpRefreshHidKeys('bp-arg1-hid-cat', 'bp-arg1-hid-key');
  bpRefreshHidKeys('bp-arg2-hid-cat', 'bp-arg2-hid-key');

  document.getElementById('bp-arg1-hid-cat').addEventListener('change', () => {
    bpRefreshHidKeys('bp-arg1-hid-cat', 'bp-arg1-hid-key');
    bpUpdatePreview();
  });
  document.getElementById('bp-arg2-hid-cat').addEventListener('change', () => {
    bpRefreshHidKeys('bp-arg2-hid-cat', 'bp-arg2-hid-key');
    bpUpdatePreview();
  });

  // behavior 選択 → arg UI 切替
  document.getElementById('bp-behavior').addEventListener('change', () => {
    bpUpdateLayout();
    bpUpdatePreview();
  });
  document.getElementById('bp-arg1-category').addEventListener('change', () => {
    bpUpdateArg1Visibility();
    bpUpdatePreview();
  });

  // すべての input change で preview 更新
  for (const id of ['bp-custom', 'bp-arg1-hid-cat', 'bp-arg1-hid-key',
    'bp-arg1-layer-num', 'bp-arg1-mouse-sel', 'bp-arg1-bt-sel',
    'bp-arg1-raw-input', 'bp-arg2-hid-cat', 'bp-arg2-hid-key', 'bp-wrap']) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', bpUpdatePreview);
    if (el) el.addEventListener('input', bpUpdatePreview);
  }
  document.querySelectorAll('#bp-arg1-modmask input').forEach((cb) => {
    cb.addEventListener('change', bpUpdatePreview);
  });

  // Buttons
  document.getElementById('bp-close-btn').addEventListener('click', closeBehaviorPicker);
  document.getElementById('bp-cancel-btn').addEventListener('click', closeBehaviorPicker);
  document.getElementById('bp-insert-btn').addEventListener('click', () => {
    bpApply('insert');
  });
  document.getElementById('bp-replace-btn').addEventListener('click', () => {
    bpApply('replace');
  });

  // Overlay クリックで閉じる
  document.getElementById('behavior-picker').addEventListener('click', (e) => {
    if (e.target.id === 'behavior-picker') closeBehaviorPicker();
  });
}

function bpUpdateLayout() {
  const beh = document.getElementById('bp-behavior').value;
  const customRow = document.getElementById('bp-custom-row');
  const arg1Row = document.getElementById('bp-arg1-row');
  const arg2Row = document.getElementById('bp-arg2-row');

  customRow.style.display = beh === '__custom__' ? '' : 'none';

  // behavior 種別ごとに arg category を自動設定
  const arg1CatSel = document.getElementById('bp-arg1-category');
  const arg2Label = document.getElementById('bp-arg2-label');

  // 引数なし behavior
  const noArgBehaviors = ['&trans', '&none', '&bootloader', '&sys_reset', '&studio_unlock', '&smart_num', '&smart_snipe', '&drag_on', '&drag_off', '&rotate'];
  if (noArgBehaviors.includes(beh)) {
    arg1Row.style.display = 'none';
    arg2Row.style.display = 'none';
    bpHideAllArg1();
    return;
  }
  arg1Row.style.display = '';

  // デフォルトカテゴリ
  if (beh === '&kp' || beh === '&sk') {
    arg1CatSel.value = 'hid';
    arg2Row.style.display = 'none';
  } else if (beh === '&mt') {
    arg1CatSel.value = 'modmask';
    arg2Row.style.display = '';
    arg2Label.textContent = 'Argument 2 (HID キー)';
  } else if (beh === '&lt') {
    arg1CatSel.value = 'layer';
    arg2Row.style.display = '';
    arg2Label.textContent = 'Argument 2 (HID キー)';
  } else if (beh === '&mo' || beh === '&tog' || beh === '&to') {
    arg1CatSel.value = 'layer';
    arg2Row.style.display = 'none';
  } else if (beh === '&mkp') {
    arg1CatSel.value = 'mouse';
    arg2Row.style.display = 'none';
  } else if (beh === '&bt') {
    arg1CatSel.value = 'bt';
    arg2Row.style.display = 'none';
  } else if (beh === '__custom__') {
    arg1CatSel.value = 'raw';
    arg2Row.style.display = 'none';
  } else {
    arg1CatSel.value = 'raw';
    arg2Row.style.display = 'none';
  }
  bpUpdateArg1Visibility();
}

function bpHideAllArg1() {
  ['bp-arg1-hid', 'bp-arg1-modmask', 'bp-arg1-layer', 'bp-arg1-mouse', 'bp-arg1-bt', 'bp-arg1-raw'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function bpUpdateArg1Visibility() {
  bpHideAllArg1();
  const cat = document.getElementById('bp-arg1-category').value;
  const map = {
    hid: 'bp-arg1-hid',
    modmask: 'bp-arg1-modmask',
    layer: 'bp-arg1-layer',
    mouse: 'bp-arg1-mouse',
    bt: 'bp-arg1-bt',
    raw: 'bp-arg1-raw',
  };
  if (map[cat]) {
    const el = document.getElementById(map[cat]);
    if (el) el.style.display = '';
  }
}

function bpBuildString() {
  const beh = document.getElementById('bp-behavior').value;
  const wrap = document.getElementById('bp-wrap').value;

  if (beh === '__custom__') {
    return document.getElementById('bp-custom').value.trim();
  }

  const noArgBehaviors = ['&trans', '&none', '&bootloader', '&sys_reset', '&studio_unlock', '&smart_num', '&smart_snipe', '&drag_on', '&drag_off', '&rotate'];
  if (noArgBehaviors.includes(beh)) return beh;

  // arg1
  const arg1Cat = document.getElementById('bp-arg1-category').value;
  let arg1 = '';
  if (arg1Cat === 'hid') {
    arg1 = document.getElementById('bp-arg1-hid-key').value;
  } else if (arg1Cat === 'modmask') {
    const masks = [];
    document.querySelectorAll('#bp-arg1-modmask input:checked').forEach((cb) => {
      masks.push(`MOD_${cb.dataset.bpMask}`);
    });
    arg1 = masks.length > 1 ? `(${masks.join('|')})` : (masks[0] || '');
  } else if (arg1Cat === 'layer') {
    arg1 = document.getElementById('bp-arg1-layer-num').value;
  } else if (arg1Cat === 'mouse') {
    arg1 = document.getElementById('bp-arg1-mouse-sel').value;
  } else if (arg1Cat === 'bt') {
    arg1 = document.getElementById('bp-arg1-bt-sel').value;
  } else if (arg1Cat === 'raw') {
    arg1 = document.getElementById('bp-arg1-raw-input').value;
  }

  // arg2 (HID キー)
  const arg2Visible = document.getElementById('bp-arg2-row').style.display !== 'none';
  let arg2 = '';
  if (arg2Visible) {
    arg2 = document.getElementById('bp-arg2-hid-key').value;
  }

  // wrap (LG, LS, etc.)
  let finalArg = arg1;
  if (arg2) finalArg = arg2; // arg2 がある時は arg2 がメインキー
  if (wrap && finalArg && (arg1Cat === 'hid' || arg2Visible)) {
    const closeParens = (wrap.match(/\(/g) || ['']).length;
    finalArg = `${wrap}(${finalArg})${')'.repeat(Math.max(0, closeParens - 1))}`;
  }

  if (arg2Visible) {
    return `${beh} ${arg1} ${finalArg}`.trim();
  }
  return arg1 ? `${beh} ${finalArg || arg1}`.trim() : beh;
}

function bpUpdatePreview() {
  document.getElementById('bp-preview').textContent = bpBuildString();
}

function parseBindingString(text) {
  text = (text || '').trim();
  if (!text) return null;
  // & で始まる behavior 形式
  const m = text.match(/^&(\w+)(?:\s+(.+))?$/);
  if (!m) return null;
  const beh = '&' + m[1];
  const argsRaw = (m[2] || '').trim();
  return { behavior: beh, argsRaw };
}

function parseHidWithWrap(token) {
  // LG(LS(X)), LC(LS(X)), LG(X), LS(X), LC(X), LA(X), 単独 X
  let m;
  m = token.match(/^LG\(LS\((.+)\)\)$/); if (m) return { wrap: 'LG(LS', key: m[1] };
  m = token.match(/^LC\(LS\((.+)\)\)$/); if (m) return { wrap: 'LC(LS', key: m[1] };
  m = token.match(/^LG\((.+)\)$/);       if (m) return { wrap: 'LG', key: m[1] };
  m = token.match(/^LS\((.+)\)$/);       if (m) return { wrap: 'LS', key: m[1] };
  m = token.match(/^LC\((.+)\)$/);       if (m) return { wrap: 'LC', key: m[1] };
  m = token.match(/^LA\((.+)\)$/);       if (m) return { wrap: 'LA', key: m[1] };
  return { wrap: '', key: token };
}

function findHidCategory(key) {
  for (const [cat, items] of Object.entries(BP_HID_TABLES)) {
    if (items.includes(key)) return cat;
  }
  return null;
}

function bpRestoreFromValue(text) {
  const parsed = parseBindingString(text);
  if (!parsed) return false;
  const beh = parsed.behavior;
  const behSel = document.getElementById('bp-behavior');
  // behavior が options にあれば選択、なければ custom
  const knownBehaviors = Array.from(behSel.options).map((o) => o.value);
  if (knownBehaviors.includes(beh)) {
    behSel.value = beh;
  } else {
    behSel.value = '__custom__';
    document.getElementById('bp-custom').value = text;
    bpUpdateLayout();
    return true;
  }
  bpUpdateLayout();

  // 引数復元
  const args = parsed.argsRaw;
  if (!args) return true;

  if (beh === '&kp' || beh === '&sk' || beh === '&key_repeat' || beh === '&key_toggle') {
    const { wrap, key } = parseHidWithWrap(args);
    document.getElementById('bp-wrap').value = wrap;
    document.getElementById('bp-arg1-category').value = 'hid';
    bpUpdateArg1Visibility();
    const cat = findHidCategory(key);
    if (cat) {
      document.getElementById('bp-arg1-hid-cat').value = cat;
      bpRefreshHidKeys('bp-arg1-hid-cat', 'bp-arg1-hid-key');
      document.getElementById('bp-arg1-hid-key').value = key;
    } else {
      document.getElementById('bp-arg1-category').value = 'raw';
      bpUpdateArg1Visibility();
      document.getElementById('bp-arg1-raw-input').value = args;
    }
  } else if (beh === '&mt') {
    // &mt MOD_LSHIFT KEY  または &mt (MOD_LSHIFT|MOD_LCTRL) KEY
    const m = args.match(/^(\([^)]+\)|\S+)\s+(.+)$/);
    if (m) {
      const masks = m[1].replace(/[()]/g, '').split('|').map((s) => s.trim().replace(/^MOD_/, ''));
      document.getElementById('bp-arg1-category').value = 'modmask';
      bpUpdateArg1Visibility();
      document.querySelectorAll('#bp-arg1-modmask input').forEach((cb) => {
        cb.checked = masks.includes(cb.dataset.bpMask);
      });
      const { wrap, key } = parseHidWithWrap(m[2]);
      document.getElementById('bp-wrap').value = wrap;
      const cat2 = findHidCategory(key);
      if (cat2) {
        document.getElementById('bp-arg2-hid-cat').value = cat2;
        bpRefreshHidKeys('bp-arg2-hid-cat', 'bp-arg2-hid-key');
        document.getElementById('bp-arg2-hid-key').value = key;
      }
    }
  } else if (beh === '&lt') {
    const m = args.match(/^(\d+)\s+(.+)$/);
    if (m) {
      document.getElementById('bp-arg1-category').value = 'layer';
      bpUpdateArg1Visibility();
      document.getElementById('bp-arg1-layer-num').value = m[1];
      const { wrap, key } = parseHidWithWrap(m[2]);
      document.getElementById('bp-wrap').value = wrap;
      const cat2 = findHidCategory(key);
      if (cat2) {
        document.getElementById('bp-arg2-hid-cat').value = cat2;
        bpRefreshHidKeys('bp-arg2-hid-cat', 'bp-arg2-hid-key');
        document.getElementById('bp-arg2-hid-key').value = key;
      }
    }
  } else if (beh === '&mo' || beh === '&tog' || beh === '&to') {
    document.getElementById('bp-arg1-category').value = 'layer';
    bpUpdateArg1Visibility();
    document.getElementById('bp-arg1-layer-num').value = args.trim();
  } else if (beh === '&mkp') {
    document.getElementById('bp-arg1-category').value = 'mouse';
    bpUpdateArg1Visibility();
    const sel = document.getElementById('bp-arg1-mouse-sel');
    if (Array.from(sel.options).some((o) => o.value === args.trim())) {
      sel.value = args.trim();
    }
  } else if (beh === '&bt') {
    document.getElementById('bp-arg1-category').value = 'bt';
    bpUpdateArg1Visibility();
    const sel = document.getElementById('bp-arg1-bt-sel');
    if (Array.from(sel.options).some((o) => o.value === args.trim())) {
      sel.value = args.trim();
    }
  } else {
    document.getElementById('bp-arg1-category').value = 'raw';
    bpUpdateArg1Visibility();
    document.getElementById('bp-arg1-raw-input').value = args;
  }
  return true;
}

function openBehaviorPicker(targetEl, mode = 'insert') {
  bpState.targetEl = targetEl;
  bpState.selectionStart = targetEl.selectionStart;
  bpState.selectionEnd = targetEl.selectionEnd;
  bpState.insertMode = mode;

  document.getElementById('behavior-picker').classList.remove('hidden');

  // 既存 modifier checkbox / wrap / fields をリセット
  document.getElementById('bp-wrap').value = '';
  document.querySelectorAll('#bp-arg1-modmask input').forEach((cb) => { cb.checked = false; });
  document.getElementById('bp-custom').value = '';
  document.getElementById('bp-arg1-raw-input').value = '';

  // Replace モードかつ targetEl に値があれば parse して復元
  if (mode === 'replace' && targetEl.value) {
    const restored = bpRestoreFromValue(targetEl.value);
    if (!restored) {
      // 解析失敗時は custom 入力に
      document.getElementById('bp-behavior').value = '__custom__';
      document.getElementById('bp-custom').value = targetEl.value;
      bpUpdateLayout();
    }
  } else {
    document.getElementById('bp-behavior').value = '&kp';
    bpUpdateLayout();
  }
  bpUpdatePreview();
}

function closeBehaviorPicker() {
  document.getElementById('behavior-picker').classList.add('hidden');
  bpState.targetEl = null;
}

function bpApply(mode) {
  const result = bpBuildString();
  if (!result || !bpState.targetEl) {
    closeBehaviorPicker();
    return;
  }
  const el = bpState.targetEl;
  if (mode === 'replace') {
    el.value = result;
  } else {
    // insert: cursor 位置に挿入
    const start = bpState.selectionStart ?? el.value.length;
    const end = bpState.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + result + el.value.slice(end);
  }
  // input イベントを発火して onChange を起こす
  el.dispatchEvent(new Event('input', { bubbles: true }));
  closeBehaviorPicker();
  el.focus();
}

function attachBehaviorPicker(parent, targetEl) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'bp-pick-btn';
  btn.textContent = '📝';
  btn.title = 'Behavior Picker を開く';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openBehaviorPicker(targetEl, 'replace');
  });
  parent.appendChild(btn);
}

function addNewBehavior(path) {
  const file = state.files.get(path);
  if (!file) return;
  const parsed = parseDtsBlocks(file.content);
  const n = parsed.entries.length + 1;
  parsed.entries.push({
    refName: `new_behavior_${n}`,
    label: `new_behavior_${n}`,
    props: [
      { key: 'compatible', value: '"zmk,behavior-hold-tap"' },
      { key: 'label', value: `"NEW_BEHAVIOR_${n}"` },
      { key: 'bindings', value: '<&kp>, <&kp>' },
      { key: '#binding-cells', value: '<2>' },
      { key: 'flavor', value: '"balanced"' },
      { key: 'tapping-term-ms', value: '<200>' },
    ],
  });
  commitDtsChange(path, parsed);
  renderBehaviorsEditor(path, state.files.get(path));
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

// 〈Rotated Envelope Calculation〉— 回転後の 4 隅を考慮した layout 全体の bounding box。
// widthKey / heightKey はオブジェクトのプロパティ名（'w'/'h' or 'width'/'height'）。
function computeLayoutBounds(layout, widthKey = 'w', heightKey = 'h') {
  let maxX = 0, maxY = 0;
  for (const k of layout) {
    const x = k.x ?? 0;
    const y = k.y ?? 0;
    const w = k[widthKey] ?? 1;
    const h = k[heightKey] ?? 1;
    if (!k.r) {
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
      continue;
    }
    const rx = k.rx ?? x;
    const ry = k.ry ?? y;
    const theta = (k.r * Math.PI) / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    // 4 隅 (x,y) (x+w,y) (x,y+h) (x+w,y+h) を (rx,ry) 中心に回転
    for (const [cx, cy] of [
      [x, y], [x + w, y], [x, y + h], [x + w, y + h],
    ]) {
      const dx = cx - rx;
      const dy = cy - ry;
      const nx = rx + dx * cos - dy * sin;
      const ny = ry + dx * sin + dy * cos;
      maxX = Math.max(maxX, nx);
      maxY = Math.max(maxY, ny);
    }
  }
  return { maxX, maxY };
}

function renderPhysicalLayout(layer, layout) {
  els.keymapGrid.classList.add('physical-layout');
  const unitPx = 56;
  const gap = 4;

  // 〈True Bounding Box〉— 回転キーの 4 隅も加味した正確な envelope。
  // 親が flex column なので height でなく min-height を使う (flex-shrink 抑制)。
  const bounds = computeLayoutBounds(layout, 'w', 'h');
  const padding = 12;
  const gridW = bounds.maxX * unitPx + padding * 2;
  const gridH = bounds.maxY * unitPx + padding * 2;
  els.keymapGrid.style.cssText =
    `position: relative; width: ${gridW}px; ` +
    `min-height: ${gridH}px; height: ${gridH}px; flex-shrink: 0; ` +
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
    // 〈Conscription Failure Cleansing〉— 誤った PAT を抱え込まないよう消去
    clearStoredPat();
    state.pat = '';
    els.patInput.value = '';
    setStatus('Authentication failed — PAT cleared', 'error');
    log(err.message, 'error');
    log('保存された PAT を破棄しました。再入力してください。', 'warning');
  }
}

/* ◆ DIFF PREVIEW ────────────────────── */
// 〈Diff Fallback Flag〉— 直近の computeLineDiff が fallback を踏んだか
let __lastDiffFallback = false;

function computeLineDiff(originalLines, currentLines) {
  __lastDiffFallback = false;
  // シンプルな LCS ベースの diff（メモ化）
  const m = originalLines.length, n = currentLines.length;
  // O(mn) DP のメモリ上限を 1M cell（≒2MB）に引き上げ。これを超える場合のみ fallback。
  if (m * n > 1_000_000) {
    __lastDiffFallback = true;
    // 片方が大きい場合は単純な置換 diff にフォールバック
    const out = [];
    for (let i = 0; i < Math.max(m, n); i++) {
      if (i < m && i < n && originalLines[i] === currentLines[i]) {
        out.push({ type: 'ctx', text: originalLines[i] });
      } else {
        if (i < m) out.push({ type: 'del', text: originalLines[i] });
        if (i < n) out.push({ type: 'add', text: currentLines[i] });
      }
    }
    return out;
  }

  // Int16Array で DP テーブル — メモリ削減
  const dp = Array.from({ length: m + 1 }, () => new Int16Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (originalLines[i - 1] === currentLines[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const out = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && originalLines[i - 1] === currentLines[j - 1]) {
      out.unshift({ type: 'ctx', text: originalLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.unshift({ type: 'add', text: currentLines[j - 1] });
      j--;
    } else if (i > 0) {
      out.unshift({ type: 'del', text: originalLines[i - 1] });
      i--;
    }
  }
  return out;
}

function compactDiff(diffLines, contextSize = 2) {
  // 連続する ctx 行を contextSize に圧縮
  const result = [];
  let ctxBuffer = [];
  let lastWasChange = false;
  for (let i = 0; i < diffLines.length; i++) {
    const line = diffLines[i];
    if (line.type === 'ctx') {
      ctxBuffer.push(line);
    } else {
      // 直前の ctx を末尾 contextSize 件だけ残す
      if (ctxBuffer.length > contextSize) {
        if (lastWasChange) {
          result.push(...ctxBuffer.slice(0, contextSize));
        }
        if (i > 0) result.push({ type: 'sep' });
        if (ctxBuffer.length > contextSize) {
          result.push(...ctxBuffer.slice(-contextSize));
        }
      } else {
        result.push(...ctxBuffer);
      }
      ctxBuffer = [];
      result.push(line);
      lastWasChange = true;
    }
  }
  // 末尾の ctx は contextSize 件だけ
  if (lastWasChange && ctxBuffer.length > 0) {
    result.push(...ctxBuffer.slice(0, contextSize));
  }
  return result;
}

function renderDiffPreview(modifiedFiles) {
  const wrap = document.getElementById('diff-content');
  wrap.innerHTML = '';
  const summaryEl = document.getElementById('diff-summary');
  summaryEl.textContent = `${modifiedFiles.length} file(s) を ${state.repo}@${state.branch} にコミットします`;

  for (const [path, file] of modifiedFiles) {
    const fileEl = document.createElement('div');
    fileEl.className = 'diff-file';
    const header = document.createElement('div');
    header.className = 'diff-file-header';
    header.textContent = `📄 ${path}`;
    fileEl.appendChild(header);

    const origLines = (file.original || '').split('\n');
    const curLines = (file.content || '').split('\n');
    const rawDiff = computeLineDiff(origLines, curLines);
    if (__lastDiffFallback) {
      const warn = document.createElement('div');
      warn.className = 'diff-fallback-warning';
      warn.textContent =
        '⚠ このファイルは大きすぎるため近似 diff を表示しています。実際の差分はコミット後に GitHub 側で確認してください。';
      fileEl.appendChild(warn);
    }
    const diff = compactDiff(rawDiff);

    if (diff.length === 0) {
      const e = document.createElement('div');
      e.className = 'diff-line diff-ctx';
      e.textContent = '(差分なし)';
      fileEl.appendChild(e);
    }

    for (const line of diff) {
      if (line.type === 'sep') {
        const sep = document.createElement('div');
        sep.className = 'diff-hunk-sep';
        sep.textContent = '⋮';
        fileEl.appendChild(sep);
        continue;
      }
      const lineEl = document.createElement('div');
      lineEl.className = `diff-line diff-${line.type}`;
      const marker = line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ';
      lineEl.innerHTML = `<span class="diff-marker">${marker}</span><span>${line.text.replace(/[<>&]/g, (c) => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</span>`;
      fileEl.appendChild(lineEl);
    }
    wrap.appendChild(fileEl);
  }
}

function openDiffModal(modifiedFiles, defaultMsg) {
  const modal = document.getElementById('diff-modal');
  modal.classList.remove('hidden');
  document.getElementById('diff-commit-message').value = defaultMsg;
  renderDiffPreview(modifiedFiles);
}

function closeDiffModal() {
  document.getElementById('diff-modal').classList.add('hidden');
}

async function handleSeal() {
  const modifiedFiles = Array.from(state.files.entries()).filter(([, f]) => f.modified);
  if (modifiedFiles.length === 0) return;

  let msg = els.commitMessage.value.trim();
  if (!msg) {
    msg = `edit(cardinal): 〈Memory Rewrite〉— ${modifiedFiles.length} file(s) via Cardinal Editor`;
  }
  openDiffModal(modifiedFiles, msg);
}

async function confirmSealing() {
  const msg = document.getElementById('diff-commit-message').value.trim()
    || `edit(cardinal): 〈Memory Rewrite〉— ${Array.from(state.files.values()).filter((f) => f.modified).length} file(s) via Cardinal Editor`;
  closeDiffModal();
  els.commitMessage.value = msg;
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
function isTauri() {
  return typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__);
}

/* ◆ INIT ───────────────────────────────── */
function init() {
  if (isTauri()) {
    const badge = document.getElementById('tauri-badge');
    if (badge) badge.classList.remove('hidden');
  }
  loadCredentials();
  els.authBtn.addEventListener('click', handleAuth);
  els.patInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAuth();
  });
  const rememberEl = document.getElementById('remember-pat');
  if (rememberEl) {
    rememberEl.addEventListener('change', () => {
      if (rememberEl.checked) {
        localStorage.setItem(STORAGE_KEYS.REMEMBER_PAT, '1');
      } else {
        localStorage.removeItem(STORAGE_KEYS.REMEMBER_PAT);
      }
      // チェック変更直後、既存の PAT があれば適切な側に移動
      if (state.pat) saveCredentials();
    });
  }
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
  document.getElementById('view-combos').addEventListener('click', () => {
    state.viewMode = 'combos';
    if (state.activePath && isCombosFile(state.activePath)) {
      const f = state.files.get(state.activePath);
      showCombosEditor(state.activePath, f);
    }
  });
  document.getElementById('combos-add-btn').addEventListener('click', () => {
    if (state.activePath && isCombosFile(state.activePath)) {
      addNewCombo(state.activePath);
    }
  });

  document.getElementById('view-gestures').addEventListener('click', () => {
    state.viewMode = 'gestures';
    if (state.activePath && isGestureFile(state.activePath)) {
      const f = state.files.get(state.activePath);
      showGesturesEditor(state.activePath, f);
    }
  });
  document.getElementById('view-macros').addEventListener('click', () => {
    state.viewMode = 'macros';
    if (state.activePath && isMacrosFile(state.activePath)) {
      const f = state.files.get(state.activePath);
      showMacrosEditor(state.activePath, f);
    }
  });
  document.getElementById('view-behaviors').addEventListener('click', () => {
    state.viewMode = 'behaviors';
    if (state.activePath && isBehaviorFile(state.activePath)) {
      const f = state.files.get(state.activePath);
      showBehaviorsEditor(state.activePath, f);
    }
  });
  document.getElementById('macros-add-btn').addEventListener('click', () => {
    if (state.activePath && isMacrosFile(state.activePath)) {
      addNewMacro(state.activePath);
    }
  });
  document.getElementById('behaviors-add-btn').addEventListener('click', () => {
    if (state.activePath && isBehaviorFile(state.activePath)) {
      addNewBehavior(state.activePath);
    }
  });

  // Behavior Picker 初期化
  bpInit();

  // Diff Preview Modal イベント
  document.getElementById('diff-confirm-btn').addEventListener('click', confirmSealing);
  document.getElementById('diff-cancel-btn').addEventListener('click', () => {
    closeDiffModal();
    log('Sealing cancelled', 'warning');
  });
  document.getElementById('diff-close-btn').addEventListener('click', closeDiffModal);
  document.getElementById('diff-modal').addEventListener('click', (e) => {
    if (e.target.id === 'diff-modal') closeDiffModal();
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

/* ◆ SAO SYSTEM SOUND ENGINE ──────────────────────── */
class SystemSoundEngine {
  constructor() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      this.enabled = false;
      return;
    }
    this.ctx = new AudioCtx();
    this.enabled = true;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.1; // 音量控えめ
    this.masterGain.connect(this.ctx.destination);
    
    // Resume on first interaction
    const resumeAudio = () => {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      document.removeEventListener('click', resumeAudio);
    };
    document.addEventListener('click', resumeAudio);
  }

  playBeep(freq = 800, type = 'sine', duration = 0.05) {
    if (!this.enabled || this.ctx.state !== 'running') return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playHover() { this.playBeep(1200, 'sine', 0.03); }
  playClick() { this.playBeep(2400, 'square', 0.05); setTimeout(() => this.playBeep(1800, 'sine', 0.08), 20); }
  playSeal() { 
    this.playBeep(400, 'sawtooth', 0.1); 
    setTimeout(() => this.playBeep(600, 'square', 0.2), 50);
    setTimeout(() => this.playBeep(1200, 'sine', 0.4), 100);
  }
}

const sysAudio = new SystemSoundEngine();

function attachSoundEffects() {
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('button, .tab, .tree-file, .tree-folder, .combo-key-cell, select')) {
      sysAudio.playHover();
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.target.closest('button:not(.btn-seal), .tab, .tree-file, .tree-folder, .combo-key-cell')) {
      sysAudio.playClick();
    } else if (e.target.closest('.btn-seal')) {
      sysAudio.playSeal();
    }
  });
}

attachSoundEffects();

// SAO ウィンドウ展開アニメーションのトリガー
window.addEventListener('load', () => {
  const windowEl = document.getElementById('sao-window');
  if (windowEl) {
    windowEl.style.animation = 'none';
    setTimeout(() => {
      windowEl.style.animation = 'window-open 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      if (sysAudio.enabled) sysAudio.playBeep(1500, 'sine', 0.2); // Boot sound
    }, 100);
  }
});
