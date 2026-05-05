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
  behaviors: {},     // behavior_id -> details
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
    await fetchKeymap();
    renderKeymapView();
    log('--- 〈 Memory Recall 〉 complete ---', 'success');
  } catch (e) {
    log(`Probe failed: ${e.message || e}`, 'error');
  }
}

function behaviorName(id) {
  const det = state.behaviors[id];
  if (det) return det.displayName || `behavior#${id}`;
  return `behavior#${id}`;
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
    const sum = document.createElement('summary');
    sum.textContent = `▸ Layer ${layer.id}: ${layer.name || '(unnamed)'} — ${layer.bindings?.length || 0} bindings`;
    wrap.appendChild(sum);

    const grid = document.createElement('div');
    grid.className = 'live-binding-grid';
    (layer.bindings || []).forEach((b, i) => {
      const cell = document.createElement('div');
      cell.className = 'live-binding-cell';
      cell.title = `[${i}] behaviorId=${b.behaviorId} param1=${b.param1} param2=${b.param2}`;
      cell.innerHTML =
        `<div class="bind-pos">[${i}]</div>` +
        `<div class="bind-name">${behaviorName(b.behaviorId)}</div>` +
        `<div class="bind-params">${b.param1} / ${b.param2}</div>`;
      grid.appendChild(cell);
    });
    wrap.appendChild(grid);
    layersEl.appendChild(wrap);
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

  // Debug bridge: 開発時のみ window 経由で state にアクセスできるように
  window.__cardinal_live = { state, renderKeymapView, behaviorName, handleProbe };
}

init();
