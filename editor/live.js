/* ===============================
 * 《 Live Sync Conduit 》 — live.js
 * @zmkfirmware/zmk-studio-ts-client を esm.sh 経由で利用
 * Web Bluetooth で ZMK Studio 対応キーボードへ接続する PoC
 * =============================== */

import * as gattTransport from 'https://esm.sh/@zmkfirmware/zmk-studio-ts-client@0.0.18/transport/gatt';
import * as serialTransport from 'https://esm.sh/@zmkfirmware/zmk-studio-ts-client@0.0.18/transport/serial';
import { create_rpc_connection, call_rpc } from 'https://esm.sh/@zmkfirmware/zmk-studio-ts-client@0.0.18';

const $ = (id) => document.getElementById(id);
const els = {
  indicator: $('conduit-indicator'),
  label:     $('conduit-label'),
  detail:    $('conduit-detail'),
  connectBleBtn:    $('connect-ble-btn'),
  connectSerialBtn: $('connect-serial-btn'),
  disconnectBtn:    $('disconnect-btn'),
  probeBtn:         $('probe-btn'),
  deviceSection:    $('device-section'),
  infoLabel:        $('info-label'),
  logOutput:        $('log-output'),
};

const state = {
  transport: null,
  rpc: null,
  deviceInfo: null,
  lockState: null,
  keymap: null,
  behaviors: {},        // behavior_id -> details
  physicalLayout: null, // active KeyPhysicalAttrs[] (already scaled to unit)
};

function log(msg, kind = 'info') {
  const ts = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = `log-line log-${kind}`;
  line.textContent = `[${ts}] ${msg}`;
  els.logOutput.appendChild(line);
  els.logOutput.scrollTop = els.logOutput.scrollHeight;
}

function setConduitState(state, label, detail) {
  els.indicator.className = `conduit-indicator ${state}`;
  els.label.textContent = label;
  if (detail !== undefined) els.detail.textContent = detail;
}

async function establishConnection(transport, kind) {
  state.transport = transport;
  log(`Transport 確立 (${kind}): ${transport.label}`, 'success');

  const rpcConn = create_rpc_connection(transport);
  state.rpc = rpcConn;
  log('RpcConnection 確立', 'success');

  setConduitState('connected', `Connected: ${rpcConn.label}`, `Live Sync Conduit (${kind}) が確立されました`);
  els.connectBleBtn.classList.add('hidden');
  els.connectSerialBtn.classList.add('hidden');
  els.disconnectBtn.classList.remove('hidden');
  els.probeBtn.classList.remove('hidden');
  els.deviceSection.classList.remove('hidden');
  els.infoLabel.textContent = rpcConn.label;

  // Auto Memory Recall: 接続後すぐデバイス情報・キーマップを取得
  setTimeout(() => handleProbe(), 200);

  // Notification subscription
  (async () => {
    const reader = rpcConn.notification_readable.getReader();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        log(`[notification] ${JSON.stringify(value).slice(0, 120)}`, 'info');
      }
    } catch (e) {
      log(`Notification stream closed: ${e.message || e}`, 'warning');
    }
  })();
}

async function handleConnectBle() {
  if (!('bluetooth' in navigator)) {
    log('Web Bluetooth が利用できません。Chrome / Edge を使用してください。', 'error');
    setConduitState('error', 'Unsupported', 'Web Bluetooth not available');
    return;
  }
  try {
    setConduitState('connecting', 'Requesting BLE device...', 'デバイス選択ダイアログを開いています');
    log('navigator.bluetooth.requestDevice() を呼び出し...');
    const transport = await gattTransport.connect();
    await establishConnection(transport, 'BLE');
  } catch (err) {
    log(`BLE Connect failed: ${err.message || err}`, 'error');
    setConduitState('error', 'BLE Connect failed', err.message || String(err));
  }
}

async function handleConnectSerial() {
  if (!('serial' in navigator)) {
    log('Web Serial が利用できません。Chrome / Edge を使用してください。', 'error');
    setConduitState('error', 'Unsupported', 'Web Serial not available');
    return;
  }
  try {
    setConduitState('connecting', 'Requesting serial port...', 'シリアルポート選択ダイアログを開いています');
    log('navigator.serial.requestPort() を呼び出し...');
    const transport = await serialTransport.connect();
    await establishConnection(transport, 'USB Serial');
  } catch (err) {
    log(`Serial Connect failed: ${err.message || err}`, 'error');
    setConduitState('error', 'Serial Connect failed', err.message || String(err));
  }
}

function handleDisconnect() {
  if (state.transport?.abortController) {
    state.transport.abortController.abort();
    log('Transport aborted', 'warning');
  }
  state.transport = null;
  state.rpc = null;
  setConduitState('', 'Disconnected', 'Bluetooth または USB Serial で神器に接続してください');
  els.connectBleBtn.classList.remove('hidden');
  els.connectSerialBtn.classList.remove('hidden');
  els.disconnectBtn.classList.add('hidden');
  els.probeBtn.classList.add('hidden');
  els.deviceSection.classList.add('hidden');
}

/* ◆ RPC HELPERS ─────────────────────── */

async function rpc(req) {
  if (!state.rpc) throw new Error('Not connected');
  return call_rpc(state.rpc, req);
}

async function fetchDeviceInfo() {
  log('GetDeviceInfo...');
  const resp = await rpc({ core: { getDeviceInfo: true } });
  const info = resp?.core?.getDeviceInfo;
  if (info) {
    state.deviceInfo = info;
    log(`Device: ${info.name}`, 'success');
  }
  return info;
}

async function fetchLockState() {
  log('GetLockState...');
  const resp = await rpc({ core: { getLockState: true } });
  const lock = resp?.core?.getLockState;
  state.lockState = lock;
  log(`Lock state: ${lock === 1 ? 'UNLOCKED' : 'LOCKED'} (raw=${lock})`,
      lock === 1 ? 'success' : 'warning');
  return lock;
}

async function fetchKeymap() {
  log('GetKeymap...');
  const resp = await rpc({ keymap: { getKeymap: true } });
  const km = resp?.keymap?.getKeymap;
  if (km) {
    state.keymap = km;
    log(`Keymap: ${km.layers?.length || 0} layers, available=${km.availableLayers}`, 'success');
  }
  return km;
}

async function fetchPhysicalLayouts() {
  log('GetPhysicalLayouts...');
  const resp = await rpc({ keymap: { getPhysicalLayouts: true } });
  const data = resp?.keymap?.getPhysicalLayouts;
  if (!data) {
    log('No physical layouts available', 'warning');
    return null;
  }
  const idx = data.activeLayoutIndex || 0;
  const layout = data.layouts?.[idx];
  if (!layout) {
    log(`Active layout #${idx} not found`, 'warning');
    return null;
  }
  // KeyPhysicalAttrs values are sint32, divide by 100 → keyboard units
  const keys = (layout.keys || []).map((k) => ({
    width:  (k.width  || 100) / 100,
    height: (k.height || 100) / 100,
    x:      (k.x      || 0)   / 100,
    y:      (k.y      || 0)   / 100,
    r:      (k.r      || 0)   / 100,
    rx:     (k.rx     || 0)   / 100,
    ry:     (k.ry     || 0)   / 100,
  }));
  state.physicalLayout = keys;
  log(`PhysicalLayout: ${layout.name} (${keys.length} keys)`, 'success');
  return keys;
}

async function fetchBehaviors() {
  log('ListAllBehaviors...');
  const resp = await rpc({ behaviors: { listAllBehaviors: true } });
  const ids = resp?.behaviors?.listAllBehaviors?.behaviors || [];
  log(`${ids.length} behaviors found, fetching details...`);
  for (const id of ids) {
    const r = await rpc({ behaviors: { getBehaviorDetails: { behaviorId: id } } });
    const det = r?.behaviors?.getBehaviorDetails;
    if (det) state.behaviors[id] = det;
  }
  log(`Behavior map: ${Object.keys(state.behaviors).length} entries`, 'success');
  return state.behaviors;
}

async function handleProbe() {
  if (!state.rpc) return;
  log('--- 〈 Memory Recall 〉 begin ---');
  try {
    await fetchDeviceInfo();
    await fetchLockState();
    await fetchBehaviors();
    await fetchPhysicalLayouts();
    await fetchKeymap();
    renderKeymapView();
    log('--- 〈 Memory Recall 〉 complete ---', 'success');
  } catch (e) {
    log(`Probe failed: ${e.message || e}`, 'error');
  }
}

// ZMK Studio 公式の behavior 短縮名マップ
const BEHAVIOR_SHORT_NAMES = {
  'Key Press': '',
  'Bootloader': 'Boot',
  'External Power': 'Ext Pwr',
  'Grave/Escape': 'Grv/Esc',
  'Key Repeat': 'Rept',
  'Key Toggle': 'Togg',
  'Momentary Layer': 'MO',
  'Output Selection': 'Out',
  'Sticky Key': 'Stky',
  'Studio Unlock': 'Unlock',
  'Toggle Layer': 'TogL',
  'Transparent': '·',
  'Mod-Tap': 'MT',
  'Layer-Tap': 'LT',
  'Mouse Key Press': 'MKP',
};

const MAX_HEADER_LEN = 9;

function shortenName(name) {
  if (name === undefined || name === null) return '';
  if (BEHAVIOR_SHORT_NAMES[name] !== undefined) return BEHAVIOR_SHORT_NAMES[name];
  if (name.length <= MAX_HEADER_LEN) return name;
  // 単語を分割して、それぞれの先頭数文字を結合
  const words = name.split(/[\s,_-]+/);
  const perWord = Math.max(1, Math.trunc(MAX_HEADER_LEN / words.length));
  return words.map((w) => w.substring(0, perWord)).join('');
}

function behaviorName(id) {
  const det = state.behaviors[id];
  if (det) return det.displayName || `behavior#${id}`;
  return `behavior#${id}`;
}

function behaviorShortName(id) {
  return shortenName(behaviorName(id));
}

function renderKeymapView() {
  const wrap = document.getElementById('keymap-view');
  if (!wrap || !state.keymap) return;
  wrap.classList.remove('hidden');

  // Device summary
  const summary = document.getElementById('keymap-summary');
  summary.innerHTML = '';
  const dl = document.createElement('dl');
  dl.className = 'device-info';
  const rows = [
    ['Device', state.deviceInfo?.name || '—'],
    ['Lock State', state.lockState === 1 ? 'UNLOCKED' : 'LOCKED'],
    ['Layers', `${state.keymap.layers?.length || 0} / max ${state.keymap.availableLayers}`],
    ['Behaviors', `${Object.keys(state.behaviors).length}`],
  ];
  for (const [k, v] of rows) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.appendChild(dt); dl.appendChild(dd);
  }
  summary.appendChild(dl);

  // Layers
  const layersEl = document.getElementById('keymap-layers');
  layersEl.innerHTML = '';
  for (const layer of state.keymap.layers || []) {
    const wrap = document.createElement('details');
    wrap.className = 'layer-details';
    if (layer.id === 0) wrap.open = true;
    const sum = document.createElement('summary');
    sum.textContent = `▸ Layer ${layer.id}: ${layer.name || '(unnamed)'} — ${layer.bindings?.length || 0} bindings`;
    wrap.appendChild(sum);

    const useLayout = state.physicalLayout && state.physicalLayout.length === (layer.bindings?.length || 0);
    const grid = document.createElement('div');
    grid.className = useLayout ? 'live-physical-grid' : 'live-binding-grid';

    if (useLayout) {
      const unitPx = 80, gap = 6, padding = 24;
      let maxX = 0, maxY = 0;
      for (const k of state.physicalLayout) {
        maxX = Math.max(maxX, k.x + k.width);
        maxY = Math.max(maxY, k.y + k.height);
      }
      grid.style.cssText =
        `position: relative; width: ${maxX * unitPx + padding * 2}px; ` +
        `height: ${maxY * unitPx + padding * 2}px; ` +
        `padding: ${padding}px; margin: 0 auto;`;

      (layer.bindings || []).forEach((b, i) => {
        const pos = state.physicalLayout[i];
        const cell = createBindingCell(layer.id, i, b);
        cell.style.position = 'absolute';
        cell.style.left   = `${pos.x * unitPx + padding + gap / 2}px`;
        cell.style.top    = `${pos.y * unitPx + padding + gap / 2}px`;
        cell.style.width  = `${pos.width * unitPx - gap}px`;
        cell.style.height = `${pos.height * unitPx - gap}px`;
        if (pos.r) {
          const ox = (pos.rx - pos.x) * unitPx;
          const oy = (pos.ry - pos.y) * unitPx;
          cell.style.transformOrigin = `${ox}px ${oy}px`;
          cell.style.transform = `rotate(${pos.r}deg)`;
        }
        grid.appendChild(cell);
      });
    } else {
      (layer.bindings || []).forEach((b, i) => {
        grid.appendChild(createBindingCell(layer.id, i, b));
      });
    }

    wrap.appendChild(grid);
    layersEl.appendChild(wrap);
  }
}

function createBindingCell(layerId, i, b) {
  const cell = document.createElement('div');
  cell.className = 'live-binding-cell live-clickable';
  const fullName = behaviorName(b.behaviorId);
  const shortName = behaviorShortName(b.behaviorId);
  cell.title = `[${i}] ${fullName} (id=${b.behaviorId}) param1=${b.param1} param2=${b.param2}\nClick to edit`;
  // 短縮名 + パラメータ表示。短縮名が空（&kp）の場合は param1 のみ
  const headerHtml = shortName ? `<div class="bind-name">${shortName}</div>` : '';
  const paramHtml = b.param1 || b.param2
    ? `<div class="bind-params">${b.param1}${b.param2 ? `/${b.param2}` : ''}</div>`
    : '';
  cell.innerHTML =
    `<div class="bind-pos">[${i}]</div>` +
    headerHtml +
    paramHtml;
  cell.onclick = () => openBindingEditor(layerId, i, b, cell);
  return cell;
}

/* ◆ BINDING EDITOR ──────────────────── */
function openBindingEditor(layerId, position, currentBinding, cellEl) {
  const dlg = document.getElementById('bind-editor');
  document.getElementById('bind-layer-id').value = layerId;
  document.getElementById('bind-position').value = position;
  document.getElementById('bind-position-display').textContent =
    `Layer ${layerId} [${position}]`;

  // Behavior dropdown
  const behSel = document.getElementById('bind-behavior');
  behSel.innerHTML = '';
  const sortedIds = Object.keys(state.behaviors).map(Number).sort((a, b) => a - b);
  for (const id of sortedIds) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${state.behaviors[id].displayName} (id=${id})`;
    if (id === currentBinding.behaviorId) opt.selected = true;
    behSel.appendChild(opt);
  }

  document.getElementById('bind-param1').value = currentBinding.param1 ?? 0;
  document.getElementById('bind-param2').value = currentBinding.param2 ?? 0;

  dlg.classList.remove('hidden');
  document.body.classList.add('bind-editor-open');
  document.getElementById('bind-current').textContent =
    `Current: ${behaviorName(currentBinding.behaviorId)} (id=${currentBinding.behaviorId}) / ` +
    `param1=${currentBinding.param1} / param2=${currentBinding.param2}`;

  // 編集中セルをハイライト
  document.querySelectorAll('.live-binding-cell.editing')
    .forEach((el) => el.classList.remove('editing'));
  if (cellEl) {
    cellEl.classList.add('editing');
    cellEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }
}

function closeBindingEditor() {
  document.getElementById('bind-editor').classList.add('hidden');
  document.body.classList.remove('bind-editor-open');
  document.querySelectorAll('.live-binding-cell.editing')
    .forEach((el) => el.classList.remove('editing'));
}

async function applyBindingEdit() {
  const layerId  = Number(document.getElementById('bind-layer-id').value);
  const position = Number(document.getElementById('bind-position').value);
  const behaviorId = Number(document.getElementById('bind-behavior').value);
  const param1 = Number(document.getElementById('bind-param1').value) || 0;
  const param2 = Number(document.getElementById('bind-param2').value) || 0;

  log(`SetLayerBinding: layer=${layerId} pos=${position} behavior=${behaviorId} p1=${param1} p2=${param2}`);
  try {
    const resp = await rpc({
      keymap: {
        setLayerBinding: {
          layerId, keyPosition: position,
          binding: { behaviorId, param1, param2 },
        },
      },
    });
    const code = resp?.keymap?.setLayerBinding;
    log(`SetLayerBinding response code: ${code}`,
        code === 0 ? 'success' : 'error');

    if (code === 0) {
      // Save changes (永続化)
      log('SaveChanges...');
      const saveResp = await rpc({ keymap: { saveChanges: true } });
      const ok = saveResp?.keymap?.saveChanges?.ok;
      log(`SaveChanges ok=${ok}`, ok ? 'success' : 'warning');

      // Refresh keymap
      await fetchKeymap();
      renderKeymapView();
      closeBindingEditor();
    }
  } catch (e) {
    log(`Edit failed: ${e.message || e}`, 'error');
  }
}

function init() {
  els.connectBleBtn.addEventListener('click', handleConnectBle);
  els.connectSerialBtn.addEventListener('click', handleConnectSerial);
  els.disconnectBtn.addEventListener('click', handleDisconnect);
  els.probeBtn.addEventListener('click', handleProbe);
  log('Live Sync Conduit initialized');
  log('@zmkfirmware/zmk-studio-ts-client@0.0.18 loaded via esm.sh');
  if (!('bluetooth' in navigator)) log('Web Bluetooth API: 利用不可', 'warning');
  if (!('serial' in navigator))    log('Web Serial API: 利用不可', 'warning');

  // Binding editor handlers
  document.getElementById('bind-apply-btn').addEventListener('click', applyBindingEdit);
  document.getElementById('bind-cancel-btn').addEventListener('click', closeBindingEditor);

  // Debug bridge: 開発時のみ window 経由で state にアクセスできるように
  window.__cardinal_live = {
    state, renderKeymapView, behaviorName, handleProbe,
    openBindingEditor, applyBindingEdit, closeBindingEditor,
  };
}

init();
