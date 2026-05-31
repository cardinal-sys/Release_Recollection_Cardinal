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
  notificationReader: null,
  deviceInfo: null,
  lockState: null,
  hasUnsavedChanges: false,
  keymap: null,
  behaviors: {},        // behavior_id -> details
  physicalLayout: null, // active KeyPhysicalAttrs[] (already scaled to unit)
  hidUsageTable: null,  // { [page]: { [id]: name } }
  hidOverrides: null,   // ZMK Studio hid-usage-name-overrides.json
};

/* ◆ HID USAGE RESOLVER ──────────────── */
const HID_TABLE_URL = 'https://raw.githubusercontent.com/zmkfirmware/zmk-studio/main/src/keyboard-and-consumer-usage-tables.json';
const HID_OVERRIDES_URL = 'https://raw.githubusercontent.com/zmkfirmware/zmk-studio/main/src/hid-usage-name-overrides.json';

async function loadHidUsageTable() {
  if (state.hidUsageTable) return;
  try {
    const [tableRes, overridesRes] = await Promise.all([
      fetch(HID_TABLE_URL),
      fetch(HID_OVERRIDES_URL),
    ]);
    const table = await tableRes.json();
    const overrides = await overridesRes.json();
    // Index by page id -> { id -> Name }
    const indexed = {};
    for (const page of table.UsagePages || []) {
      indexed[page.Id] = {};
      for (const u of page.UsageIds || []) {
        indexed[page.Id][u.Id] = u.Name;
      }
    }
    state.hidUsageTable = indexed;
    state.hidOverrides = overrides;
  } catch (e) {
    console.warn('HID table load failed:', e);
  }
}

function resolveHidUsage(usage) {
  if (!state.hidUsageTable) return null;
  const page = (usage >> 16) & 0xffff;
  const id = usage & 0xffff;
  const ovr = state.hidOverrides?.[String(page & 0xff)]?.[String(id)];
  if (ovr?.short) return ovr.short.replace(/^Keyboard /, '');
  const name = state.hidUsageTable[page & 0xff]?.[id];
  return name ? name.replace(/^Keyboard /, '') : null;
}

// behavior が HID usage を param1 として持つか判定
const HID_BEHAVIOR_NAMES = new Set([
  'Key Press', 'Mod-Tap', 'Layer-Tap', 'Mouse Key Press',
  'Sticky Key', 'Key Repeat', 'Key Toggle', 'Grave/Escape',
]);

function paramLabel(behaviorIdOrName, param) {
  const name = typeof behaviorIdOrName === 'number'
    ? behaviorName(behaviorIdOrName)
    : behaviorIdOrName;
  if (HID_BEHAVIOR_NAMES.has(name)) {
    const hid = resolveHidUsage(param);
    if (hid) return hid;
  }
  return param ? String(param) : '';
}

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
  document.getElementById('connect-ble-all-btn').classList.add('hidden');
  els.connectSerialBtn.classList.add('hidden');
  els.disconnectBtn.classList.remove('hidden');
  els.probeBtn.classList.remove('hidden');
  els.deviceSection.classList.remove('hidden');
  els.infoLabel.textContent = rpcConn.label;

  // Auto Memory Recall: 接続後すぐデバイス情報・キーマップを取得
  setTimeout(() => handleProbe(), 200);

  // 〈Whisper Listening〉— Notification subscription & UI 反映
  state.notificationReader = rpcConn.notification_readable.getReader();
  (async () => {
    try {
      while (true) {
        const { value, done } = await state.notificationReader.read();
        if (done) break;
        handleNotification(value);
      }
    } catch (e) {
      log(`Notification stream closed: ${e.message || e}`, 'warning');
    }
  })();
}

function handleNotification(n) {
  if (!n) return;
  // n は zmk.studio.Notification（{ core: {...} } または { keymap: {...} }）
  if (n.core?.lockStateChanged !== undefined) {
    const lock = n.core.lockStateChanged;
    state.lockState = lock;
    log(`[notify] LockStateChanged: ${lock === 1 ? 'UNLOCKED' : 'LOCKED'}`,
        lock === 1 ? 'success' : 'warning');
    updateLockBadge();
    return;
  }
  if (n.keymap?.unsavedChangesStatusChanged !== undefined) {
    const hasUnsaved = !!n.keymap.unsavedChangesStatusChanged;
    state.hasUnsavedChanges = hasUnsaved;
    log(`[notify] UnsavedChangesStatusChanged: ${hasUnsaved ? 'DIRTY' : 'CLEAN'}`,
        hasUnsaved ? 'warning' : 'success');
    updateUnsavedBadge();
    return;
  }
  log(`[notify] ${JSON.stringify(n).slice(0, 120)}`, 'info');
}

function updateLockBadge() {
  const el = document.getElementById('lock-badge');
  if (!el) return;
  const locked = state.lockState !== 1;
  el.textContent = locked ? '🔒 LOCKED' : '🔓 UNLOCKED';
  el.className = `status-badge ${locked ? 'badge-warn' : 'badge-ok'}`;
  el.classList.remove('hidden');
  // ロック解除案内バナー
  const banner = document.getElementById('unlock-banner');
  if (banner) banner.classList.toggle('hidden', !locked);
}

function updateUnsavedBadge() {
  const el = document.getElementById('unsaved-badge');
  if (!el) return;
  el.textContent = state.hasUnsavedChanges ? '✱ UNSAVED' : '';
  el.classList.toggle('hidden', !state.hasUnsavedChanges);
  // Save/Discard ボタンを点灯
  const saveBtn = document.getElementById('save-changes-btn');
  const discardBtn = document.getElementById('discard-changes-btn');
  if (saveBtn) saveBtn.classList.toggle('hidden', !state.hasUnsavedChanges);
  if (discardBtn) discardBtn.classList.toggle('hidden', !state.hasUnsavedChanges);
}

// ZMK Studio Service UUID（gatt.ts と同じ）
const ZMK_STUDIO_SERVICE_UUID = '00000000-0196-6107-c967-c5cfb1c2482a';
const ZMK_STUDIO_RPC_CHRC_UUID = '00000001-0196-6107-c967-c5cfb1c2482a';

// 共通の GATT transport setup（公式 zmk-studio-ts-client/transport/gatt.ts と同じロジック）
async function setupGattTransport(dev) {
  if (!dev.gatt) throw new Error('No GATT service on selected device');
  const label = dev.name || 'Unknown';
  if (!dev.gatt.connected) await dev.gatt.connect();
  const svc = await dev.gatt.getPrimaryService(ZMK_STUDIO_SERVICE_UUID)
    .catch((e) => { throw new Error(`Selected device does not expose ZMK Studio service: ${e.message}`); });
  const char = await svc.getCharacteristic(ZMK_STUDIO_RPC_CHRC_UUID);

  const abortController = new AbortController();
  const readable = new ReadableStream({
    async start(controller) {
      await char.stopNotifications().catch(() => {});
      await char.startNotifications();
      const handler = (ev) => {
        const buf = ev.target?.value?.buffer;
        if (buf) controller.enqueue(new Uint8Array(buf));
      };
      char.addEventListener('characteristicvaluechanged', handler);
      const onDisconnect = () => {
        char.removeEventListener('characteristicvaluechanged', handler);
        dev.removeEventListener('gattserverdisconnected', onDisconnect);
        controller.close();
      };
      dev.addEventListener('gattserverdisconnected', onDisconnect);
    },
  });
  const writable = new WritableStream({
    write(chunk) { return char.writeValueWithoutResponse(chunk); },
  });
  abortController.signal.addEventListener('abort', () => dev.gatt?.disconnect());
  return { label, abortController, readable, writable };
}

// ZMK Studio 公式と完全に同じ Service UUID フィルタ版（esm.sh 依存を排除）
async function connectBleFiltered() {
  const dev = await navigator.bluetooth.requestDevice({
    filters: [{ services: [ZMK_STUDIO_SERVICE_UUID] }],
    optionalServices: [ZMK_STUDIO_SERVICE_UUID],
  });
  return await setupGattTransport(dev);
}

// 全デバイス表示モード版
async function connectBleAcceptAll() {
  const dev = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: [ZMK_STUDIO_SERVICE_UUID],
  });
  return await setupGattTransport(dev);
}

// 既知デバイスからの再接続（origin permission backend が必要）
async function tryReconnectKnownDevice() {
  if (typeof navigator.bluetooth.getDevices !== 'function') return null;
  try {
    const known = await navigator.bluetooth.getDevices();
    log(`getDevices() returned ${known.length} known device(s)`);
    if (known.length === 0) return null;
    // 名前が Night_Sky_Sword っぽい / もしくは前回接続したものを優先
    const target = known.find((d) => /elucidator/i.test(d.name || ''))
                || known[0];
    log(`Reusing known device: ${target.name || '(no name)'}`);
    return await setupGattTransport(target);
  } catch (e) {
    log(`getDevices reconnect failed: ${e.message || e}`, 'warning');
    return null;
  }
}

async function handleConnectBle() {
  if (!('bluetooth' in navigator)) {
    log('Web Bluetooth が利用できません。Chrome / Edge を使用してください。', 'error');
    setConduitState('error', 'Unsupported', 'Web Bluetooth not available');
    return;
  }
  const useStrict = window.__cardinal_live_mode_strict === true;
  try {
    // ① 既知デバイス（origin permission backend）から再接続を試みる
    if (!useStrict) {
      setConduitState('connecting', 'Searching known devices...', 'Permission backend を確認中');
      const reused = await tryReconnectKnownDevice();
      if (reused) {
        await establishConnection(reused, 'BLE (reused)');
        return;
      }
    }
    // ② ダイアログから新規選択
    setConduitState('connecting', 'Requesting BLE device...', 'Strict (Service UUID Filter)');
    log('navigator.bluetooth.requestDevice() — service-filter (strict)');
    // Macで接続済みHIDデバイスを見つけるためには、UUIDフィルタが必須
    const transport = await connectBleFiltered();
    await establishConnection(transport, 'BLE');
  } catch (err) {
    log(`BLE Connect failed: ${err.message || err}`, 'error');
    setConduitState('error', 'BLE Connect failed', err.message || String(err));
  }
}

async function handleConnectBleStrict() {
  window.__cardinal_live_mode_strict = true;
  try { await handleConnectBle(); }
  finally { window.__cardinal_live_mode_strict = false; }
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
  if (state.notificationReader) {
    try { state.notificationReader.cancel('disconnect'); } catch (_) {}
    state.notificationReader = null;
  }
  if (state.transport?.abortController) {
    state.transport.abortController.abort();
    log('Transport aborted', 'warning');
  }
  state.transport = null;
  state.rpc = null;
  state.lockState = null;
  state.hasUnsavedChanges = false;
  setConduitState('', 'Disconnected', 'Bluetooth または USB Serial で神器に接続してください');
  els.connectBleBtn.classList.remove('hidden');
  document.getElementById('connect-ble-all-btn').classList.remove('hidden');
  els.connectSerialBtn.classList.remove('hidden');
  els.disconnectBtn.classList.add('hidden');
  els.probeBtn.classList.add('hidden');
  els.deviceSection.classList.add('hidden');
  // バッジ/バナーもクリア
  document.getElementById('lock-badge')?.classList.add('hidden');
  document.getElementById('unsaved-badge')?.classList.add('hidden');
  document.getElementById('unlock-banner')?.classList.add('hidden');
  document.getElementById('save-changes-btn')?.classList.add('hidden');
  document.getElementById('discard-changes-btn')?.classList.add('hidden');
}

/* ◆ RPC HELPERS ─────────────────────── */

// 公式 ZMK Studio 同様、最初の RPC コールは応答が遅れたり失敗することがある。
// タイムアウト + 自動再試行で堅牢化する。
async function rpcWithTimeout(req, timeoutMs = 3000) {
  if (!state.rpc) throw new Error('Not connected');
  const result = await Promise.race([
    call_rpc(state.rpc, req).then((r) => ({ ok: true, value: r })).catch((e) => ({ ok: false, error: e })),
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, timeout: true }), timeoutMs)),
  ]);
  if (result.ok) return result.value;
  if (result.timeout) throw new Error(`RPC timeout after ${timeoutMs}ms`);
  throw result.error;
}

async function rpc(req, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await rpcWithTimeout(req);
    } catch (e) {
      lastError = e;
      log(`RPC attempt ${i + 1}/${retries + 1} failed: ${e.message || e}`, 'warning');
      if (i < retries) await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw lastError;
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

// 〈Layer Synthesis〉— 新規レイヤー降臨
async function addLayer() {
  log('AddLayer...');
  const resp = await rpc({ keymap: { addLayer: true } });
  const result = resp?.keymap?.addLayer;
  if (result?.ok) {
    log(`AddLayer ok: index=${result.ok.index} layer.id=${result.ok.layer?.id}`, 'success');
    await refreshKeymap();
    return result.ok;
  }
  log(`AddLayer err: ${result?.err ?? 'unknown'}`, 'error');
  throw new Error(`AddLayer failed (err=${result?.err})`);
}

// 〈Layer Annihilation〉— 指定 index のレイヤーを消滅させる
async function removeLayer(layerIndex) {
  log(`RemoveLayer index=${layerIndex}...`);
  const resp = await rpc({ keymap: { removeLayer: { layerIndex } } });
  const result = resp?.keymap?.removeLayer;
  if (result?.ok) {
    log('RemoveLayer ok', 'success');
    await refreshKeymap();
    return true;
  }
  log(`RemoveLayer err: ${result?.err ?? 'unknown'}`, 'error');
  throw new Error(`RemoveLayer failed (err=${result?.err})`);
}

// 〈Layer Transposition〉— レイヤーの順番を入れ替える
async function moveLayer(startIndex, destIndex) {
  log(`MoveLayer ${startIndex} → ${destIndex}...`);
  const resp = await rpc({ keymap: { moveLayer: { startIndex, destIndex } } });
  const result = resp?.keymap?.moveLayer;
  if (result?.ok) {
    log('MoveLayer ok', 'success');
    state.keymap = result.ok;
    renderKeymapView();
    return true;
  }
  log(`MoveLayer err: ${result?.err ?? 'unknown'}`, 'error');
  throw new Error(`MoveLayer failed (err=${result?.err})`);
}

// 〈Memory Restoration〉— 単一レイヤーを純度100%に戻す
async function restoreLayer(layerId, atIndex) {
  log(`RestoreLayer layerId=${layerId} atIndex=${atIndex}...`);
  const resp = await rpc({ keymap: { restoreLayer: { layerId, atIndex } } });
  const result = resp?.keymap?.restoreLayer;
  if (result?.ok) {
    log('RestoreLayer ok', 'success');
    await refreshKeymap();
    return result.ok;
  }
  log(`RestoreLayer err: ${result?.err ?? 'unknown'}`, 'error');
  throw new Error(`RestoreLayer failed (err=${result?.err})`);
}

// 〈Cardinal Memory Reset〉— Studio settings を工場出荷状態に戻す
async function resetSettings() {
  log('ResetSettings (factory reset)...');
  const resp = await rpc({ core: { resetSettings: true } });
  const ok = !!resp?.core?.resetSettings;
  log(`ResetSettings: ${ok ? 'OK' : 'FAILED'}`, ok ? 'success' : 'error');
  if (ok) await refreshKeymap();
  return ok;
}

// 〈Memory Discard〉— 未保存の変更を破棄
async function discardChanges() {
  log('DiscardChanges...');
  const resp = await rpc({ keymap: { discardChanges: true } });
  const ok = !!resp?.keymap?.discardChanges;
  log(`DiscardChanges: ${ok ? 'OK' : 'FAILED'}`, ok ? 'success' : 'error');
  if (ok) {
    state.hasUnsavedChanges = false;
    updateUnsavedBadge();
    await fetchKeymap();
    renderKeymapView();
  }
  return ok;
}

// 〈Eternal Sealing〉— SaveChanges を呼び出し永続化
async function saveChanges() {
  log('SaveChanges...');
  const resp = await rpc({ keymap: { saveChanges: true } });
  const ok = !!resp?.keymap?.saveChanges?.ok;
  if (ok) {
    log('SaveChanges ok', 'success');
    state.hasUnsavedChanges = false;
    updateUnsavedBadge();
  } else {
    const err = resp?.keymap?.saveChanges?.err;
    log(`SaveChanges err: ${err ?? 'unknown'}`, 'error');
  }
  return ok;
}

// 〈Memory Sync〉— 変更系 RPC の後、キーマップ再取得 + 再描画のみ。
// 保存は明示的に Save ボタンで行う（ZMK Studio 公式の staged changes 流儀）。
async function refreshKeymap() {
  await fetchKeymap();
  renderKeymapView();
}

async function setLayerName(layerId, newName) {
  log(`SetLayerProps layer=${layerId} name="${newName}"`);
  const resp = await rpc({
    keymap: { setLayerProps: { layerId, name: newName } },
  });
  const code = resp?.keymap?.setLayerProps;
  log(`SetLayerProps response: ${code}`, code === 0 ? 'success' : 'error');
  if (code === 0) await refreshKeymap();
  return code === 0;
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
    if (!state.hidUsageTable) {
      log('Loading HID usage table from ZMK Studio...');
      await loadHidUsageTable();
      log(`HID usage pages: ${Object.keys(state.hidUsageTable || {}).length}`, 'success');
    }
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
  const totalLayers = (state.keymap.layers || []).length;
  (state.keymap.layers || []).forEach((layer, layerIndex) => {
    const wrap = document.createElement('details');
    wrap.className = 'layer-details';
    if (layer.id === 0) wrap.open = true;
    const sum = document.createElement('summary');
    const titleSpan = document.createElement('span');
    titleSpan.textContent = `▸ Layer ${layer.id}: ${layer.name || '(unnamed)'} — ${layer.bindings?.length || 0} bindings`;
    sum.appendChild(titleSpan);

    const mkBtn = (label, title, handler, disabled = false) => {
      const b = document.createElement('button');
      b.className = 'btn-tiny layer-rename-btn';
      b.textContent = label;
      b.title = title;
      if (disabled) b.disabled = true;
      b.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try { await handler(); }
        catch (err) { log(`${title} failed: ${err.message || err}`, 'error'); }
      };
      return b;
    };

    // ✏️ Rename
    sum.appendChild(mkBtn('✏️', 'レイヤー名を変更', async () => {
      const next = prompt(`Layer ${layer.id} の新しい名前:`, layer.name || '');
      if (next === null || next === layer.name) return;
      await setLayerName(layer.id, next);
    }));
    // ↑ Move up
    sum.appendChild(mkBtn('↑', '一つ上に移動',
      () => moveLayer(layerIndex, layerIndex - 1),
      layerIndex === 0));
    // ↓ Move down
    sum.appendChild(mkBtn('↓', '一つ下に移動',
      () => moveLayer(layerIndex, layerIndex + 1),
      layerIndex === totalLayers - 1));
    // ↺ Restore
    sum.appendChild(mkBtn('↺', 'このレイヤーを初期状態に戻す', async () => {
      if (!confirm(
        `Layer ${layer.id} "${layer.name || '(unnamed)'}" を初期状態に戻します。\n\n` +
        `このレイヤー内の binding 変更はすべて失われます。続行しますか？`
      )) return;
      await restoreLayer(layer.id, layerIndex);
    }));
    // × Remove
    sum.appendChild(mkBtn('×', 'このレイヤーを削除', async () => {
      if (!confirm(
        `Layer ${layer.id} "${layer.name || '(unnamed)'}" を削除します。\n\n` +
        `これは破壊的操作です。続行しますか？`
      )) return;
      await removeLayer(layerIndex);
    }));

    wrap.appendChild(sum);

    const useLayout = state.physicalLayout && state.physicalLayout.length === (layer.bindings?.length || 0);
    const grid = document.createElement('div');
    grid.className = useLayout ? 'live-physical-grid' : 'live-binding-grid';

    if (useLayout) {
      const unitPx = 80, gap = 6, padding = 24;
      // 〈Rotated Envelope〉— 回転キーの 4 隅まで含めた正確な bounding box。
      // 親が flex column の場合に shrink で潰れないよう min-height + flex-shrink: 0。
      const bounds = computeLayoutBoundsLive(state.physicalLayout);
      const gw = bounds.maxX * unitPx + padding * 2;
      const gh = bounds.maxY * unitPx + padding * 2;
      grid.style.cssText =
        `position: relative; width: ${gw}px; ` +
        `min-height: ${gh}px; height: ${gh}px; flex-shrink: 0; ` +
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
  });
}

// 〈Rotated Envelope Calculation〉— 回転後の 4 隅を考慮した layout 全体の bounding box
function computeLayoutBoundsLive(layout) {
  let maxX = 0, maxY = 0;
  for (const k of layout) {
    const x = k.x ?? 0;
    const y = k.y ?? 0;
    const w = k.width ?? 1;
    const h = k.height ?? 1;
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
    for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
      const dx = cx - rx;
      const dy = cy - ry;
      maxX = Math.max(maxX, rx + dx * cos - dy * sin);
      maxY = Math.max(maxY, ry + dx * sin + dy * cos);
    }
  }
  return { maxX, maxY };
}

function createBindingCell(layerId, i, b) {
  const cell = document.createElement('div');
  cell.className = 'live-binding-cell live-clickable';
  const fullName = behaviorName(b.behaviorId);
  const shortName = behaviorShortName(b.behaviorId);
  // HID usage を解決して param1 / param2 を読みやすく
  const p1Label = paramLabel(fullName, b.param1);
  const p2Label = paramLabel(fullName, b.param2);
  cell.title =
    `[${i}] ${fullName} (id=${b.behaviorId})\n` +
    `param1=${b.param1}${p1Label ? ` (${p1Label})` : ''}\n` +
    `param2=${b.param2}${p2Label ? ` (${p2Label})` : ''}\n` +
    'Click to edit';

  // 主表示: HID 解決名（&kp なら 'A' 等） / それ以外は behavior 短縮名
  const mainGlyph = shortName === '' && p1Label
    ? p1Label                     // &kp の場合は HID 名のみ
    : shortName || `#${b.behaviorId}`;

  // 副情報: HID 解決済み behavior は param2 のみ表示 / それ以外は param 数値
  let subInfo = '';
  if (HID_BEHAVIOR_NAMES.has(fullName)) {
    if (b.param2) subInfo = p2Label ? `+ ${p2Label}` : `+${b.param2}`;
  } else if (b.param1 || b.param2) {
    subInfo = `${b.param1}${b.param2 ? `/${b.param2}` : ''}`;
  }

  cell.innerHTML =
    `<div class="bind-pos">[${i}]</div>` +
    `<div class="bind-name">${mainGlyph}</div>` +
    (subInfo ? `<div class="bind-params">${subInfo}</div>` : '');
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

  // 動的選択 UI を behavior に応じて構築
  renderDynamicSlots(behaviorName(currentBinding.behaviorId), currentBinding);
  // 〈Memory Anchor〉— behavior 切替時に旧 spec を参照できるよう開始時の behavior を記録
  state._editorPrevBehaviorId = currentBinding.behaviorId;

  updateResolvedHints();

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

/* ◆ BEHAVIOR PARAM SPEC ───────────────── */
// 各 behavior の param1 / param2 の役割を定義
// type: 'hid' (HID Usage) | 'hid-modifier' (HID page-7 keyboard modifier 単体 / KBD(224..231)) | 'layer' | 'mouse' | 'none' | 'number'
const BEHAVIOR_PARAM_SPEC = {
  'Key Press':       { p1: { type: 'hid',     label: 'キー' },         p2: { type: 'none' } },
  'Mod-Tap':         { p1: { type: 'hid-modifier', label: '修飾キー (ホールド時)' }, p2: { type: 'hid', label: 'キー (タップ時)' } },
  'Layer-Tap':       { p1: { type: 'layer',   label: 'レイヤー (ホールド時)' }, p2: { type: 'hid', label: 'キー (タップ時)' } },
  'Momentary Layer': { p1: { type: 'layer',   label: 'レイヤー' },     p2: { type: 'none' } },
  'Toggle Layer':    { p1: { type: 'layer',   label: 'レイヤー' },     p2: { type: 'none' } },
  'To Layer':        { p1: { type: 'layer',   label: 'レイヤー' },     p2: { type: 'none' } },
  'Sticky Key':      { p1: { type: 'hid',     label: 'キー' },         p2: { type: 'none' } },
  'Sticky Layer':    { p1: { type: 'layer',   label: 'レイヤー' },     p2: { type: 'none' } },
  'Mouse Key Press': { p1: { type: 'mouse',   label: 'マウスボタン' },  p2: { type: 'none' } },
  'Key Repeat':      { p1: { type: 'hid',     label: 'キー' },         p2: { type: 'none' } },
  'Key Toggle':      { p1: { type: 'hid',     label: 'キー' },         p2: { type: 'none' } },
  'Grave/Escape':    { p1: { type: 'hid',     label: 'キー' },         p2: { type: 'none' } },
  'Transparent':     { p1: { type: 'none' },  p2: { type: 'none' } },
  'None':            { p1: { type: 'none' },  p2: { type: 'none' } },
  // ZMK Studio Special
  'Studio Unlock':   { p1: { type: 'none' },  p2: { type: 'none' } },
  'Bootloader':      { p1: { type: 'none' },  p2: { type: 'none' } },
  'Reset':           { p1: { type: 'none' },  p2: { type: 'none' } },
};

function specForBehavior(name) {
  if (BEHAVIOR_PARAM_SPEC[name]) return BEHAVIOR_PARAM_SPEC[name];
  // Default: Mouse Key Press 系 / Gesture系も layer 扱い
  if (/GESTURE|gesture/.test(name)) return { p1: { type: 'layer', label: 'レイヤー' }, p2: { type: 'hid', label: 'キー' } };
  if (/^smart_/.test(name)) return { p1: { type: 'layer', label: 'レイヤー' }, p2: { type: 'none' } };
  return { p1: { type: 'number', label: 'param1' }, p2: { type: 'number', label: 'param2' } };
}

/* ◆ QUICK PICK ────────────────────────── */

// HID usage helpers (page<<16 | id)
const HID_USAGE = (page, id) => (page << 16) + id;
const KBD = (id) => HID_USAGE(7, id);   // Keyboard / Keypad
const CON = (id) => HID_USAGE(12, id);  // Consumer

// 修飾キー (HID page-7 keyboard modifier usage) for Mod-Tap などの param1
// ZMK Studio は単一 modifier の HID usage (KBD(224..231)) で送受する。modmask bitmask ではない。
const HID_MODIFIER_OPTIONS = [
  ['LCtl (Left Control)',  KBD(224)],
  ['LSft (Left Shift)',    KBD(225)],
  ['LAlt (Left Alt)',      KBD(226)],
  ['LGui (Left GUI)',      KBD(227)],
  ['RCtl (Right Control)', KBD(228)],
  ['RSft (Right Shift)',   KBD(229)],
  ['RAlt (Right Alt)',     KBD(230)],
  ['RGui (Right GUI)',     KBD(231)],
];

function buildHidLetters() {
  const out = [];
  for (let i = 0; i < 26; i++) {
    out.push([String.fromCharCode(65 + i), KBD(4 + i)]);
  }
  return out;
}
function buildHidDigits() {
  // 1-9: 30..38, 0: 39
  const out = [];
  for (let n = 1; n <= 9; n++) out.push([String(n), KBD(29 + n)]);
  out.push(['0', KBD(39)]);
  return out;
}
function buildHidFunctions() {
  const out = [];
  // F1-F12: 58..69, F13-F24: 104..115
  for (let n = 1; n <= 12; n++) out.push([`F${n}`, KBD(57 + n)]);
  for (let n = 13; n <= 24; n++) out.push([`F${n}`, KBD(91 + n)]);
  return out;
}
const HID_ARROWS = [
  ['→ RIGHT', KBD(79)],
  ['← LEFT',  KBD(80)],
  ['↓ DOWN',  KBD(81)],
  ['↑ UP',    KBD(82)],
];
const HID_SPECIAL = [
  ['ESC',       KBD(41)],
  ['TAB',       KBD(43)],
  ['SPACE',     KBD(44)],
  ['ENTER',     KBD(40)],
  ['BACKSPACE', KBD(42)],
  ['DELETE',    KBD(76)],
  ['CAPS',      KBD(57)],
  ['HOME',      KBD(74)],
  ['END',       KBD(77)],
  ['PAGE UP',   KBD(75)],
  ['PAGE DOWN', KBD(78)],
  ['INSERT',    KBD(73)],
  ['PRINT',     KBD(70)],
];
const HID_SYMBOLS = [
  ['-', KBD(45)], ['=', KBD(46)], ['[', KBD(47)], [']', KBD(48)],
  ['\\', KBD(49)], [';', KBD(51)], ["'", KBD(52)], ['`', KBD(53)],
  [',', KBD(54)], ['.', KBD(55)], ['/', KBD(56)],
];
const HID_MODIFIERS = [
  ['LEFT SHIFT',   KBD(225)],
  ['RIGHT SHIFT',  KBD(229)],
  ['LEFT CONTROL', KBD(224)],
  ['RIGHT CONTROL',KBD(228)],
  ['LEFT ALT',     KBD(226)],
  ['RIGHT ALT',    KBD(230)],
  ['LEFT GUI',     KBD(227)],
  ['RIGHT GUI',    KBD(231)],
];
const HID_MEDIA = [
  ['Play/Pause',   CON(0xCD)],
  ['Mute',         CON(0xE2)],
  ['Vol +',        CON(0xE9)],
  ['Vol -',        CON(0xEA)],
  ['Next Track',   CON(0xB5)],
  ['Prev Track',   CON(0xB6)],
];
const HID_MOUSE = [
  ['MB1 (Left)',   1],
  ['MB2 (Right)',  2],
  ['MB3 (Middle)', 4],
  ['MB4 (Back)',   8],
  ['MB5 (Fwd)',    16],
];

function getQuickPickOptions(category) {
  switch (category) {
    case 'hid-letters':   return buildHidLetters();
    case 'hid-digits':    return buildHidDigits();
    case 'hid-functions': return buildHidFunctions();
    case 'hid-arrows':    return HID_ARROWS;
    case 'hid-special':   return HID_SPECIAL;
    case 'hid-symbols':   return HID_SYMBOLS;
    case 'hid-modifiers': return HID_MODIFIERS;
    case 'hid-media':     return HID_MEDIA;
    case 'hid-mouse':     return HID_MOUSE;
    case 'layers':
      return (state.keymap?.layers || []).map((l) =>
        [`${l.id}: ${l.name || '(unnamed)'}`, l.id]);
    case 'used-param1':
    case 'used-param2': {
      const which = category === 'used-param1' ? 'param1' : 'param2';
      const collected = new Map(); // value -> sample binding behavior name
      for (const layer of state.keymap?.layers || []) {
        for (const b of layer.bindings || []) {
          const v = b[which];
          if (v === undefined || v === null) continue;
          if (!collected.has(v)) {
            const bn = behaviorName(b.behaviorId);
            const resolved = paramLabel(bn, v);
            const label = resolved && resolved !== String(v)
              ? `${resolved} — used by ${bn}`
              : `${v} — used by ${bn}`;
            collected.set(v, label);
          }
        }
      }
      // value 順にソート
      return Array.from(collected.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([value, label]) => [label, value]);
    }
    default: return [];
  }
}

/* ◆ DYNAMIC SLOT RENDERER ─────────────── */
function renderDynamicSlots(behaviorName, currentBinding) {
  const spec = specForBehavior(behaviorName);
  renderSlot(1, spec.p1, currentBinding.param1 ?? 0);
  renderSlot(2, spec.p2, currentBinding.param2 ?? 0);
}

// 〈Param Reincarnation〉— 旧 behavior の param を「型」で照合し、新 behavior の対応 slot に再配置する。
// 例: Mod-Tap (hid-modifier, hid) → Key Press (hid) では旧 p2(=タップキー) が新 p1 として転生する。
// 'hid-modifier' は意図的に 'hid' と非互換にしてある（修飾キーは別概念のためタップキー候補に混入させない）。
function adaptParamsForNewBehavior(oldName, newName, oldP1, oldP2) {
  const oldSpec = specForBehavior(oldName);
  const newSpec = specForBehavior(newName);
  const pool = [
    { type: oldSpec.p1.type, value: oldP1 },
    { type: oldSpec.p2.type, value: oldP2 },
  ];
  const take = (targetType) => {
    if (targetType === 'none') return 0;
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].type === targetType) {
        const v = pool[i].value;
        pool.splice(i, 1);
        return v;
      }
    }
    return 0;
  };
  return {
    param1: take(newSpec.p1.type),
    param2: take(newSpec.p2.type),
  };
}

function renderSlot(slotNum, slotSpec, currentValue) {
  const slot = document.getElementById(`dyn-slot-${slotNum}`);
  const labelEl = document.getElementById(`dyn-slot-${slotNum}-label`);
  const body = document.getElementById(`dyn-slot-${slotNum}-body`);
  body.innerHTML = '';

  const paramId = slotNum === 1 ? 'bind-param1' : 'bind-param2';

  if (slotSpec.type === 'none') {
    slot.classList.add('hidden');
    // 〈Slot Purge〉— 不要 slot の残響を浄化（旧 behavior の param が混入するのを防ぐ）
    document.getElementById(paramId).value = 0;
    return;
  }
  slot.classList.remove('hidden');
  labelEl.textContent = `◆ ${slotSpec.label || `Slot ${slotNum}`}`;

  switch (slotSpec.type) {
    case 'hid':          buildHidSelector(body, paramId, currentValue); break;
    case 'hid-modifier': buildHidModifierSelector(body, paramId, currentValue); break;
    case 'layer':        buildLayerSelector(body, paramId, currentValue); break;
    case 'mouse':        buildMouseSelector(body, paramId, currentValue); break;
    case 'number':       buildNumberInput(body, paramId, currentValue); break;
  }
}

function buildHidSelector(parent, paramId, current) {
  const row = document.createElement('div');
  row.className = 'dyn-row';
  row.innerHTML = `
    <label>カテゴリ</label>
    <select class="bind-input dyn-cat">
      <option value="hid-letters">文字 (A-Z)</option>
      <option value="hid-digits">数字 (0-9)</option>
      <option value="hid-functions">F1-F24</option>
      <option value="hid-arrows">矢印</option>
      <option value="hid-special">特殊キー</option>
      <option value="hid-symbols">記号</option>
      <option value="hid-modifiers">修飾キー</option>
      <option value="hid-media">メディア</option>
      <option value="hid-mouse">マウス</option>
      <option value="used-${paramId === 'bind-param1' ? 'param1' : 'param2'}">使用中の値</option>
    </select>
    <label>キー</label>
    <select class="bind-input dyn-val"></select>
    <div class="dyn-implicit-mods" style="margin-top: 8px; grid-column: 1 / -1;">
      <p class="hint" style="font-size: 0.65rem; margin-bottom: 4px;">修飾キー付与（例: Shift + A）</p>
      <div class="mod-chip-row"></div>
    </div>
  `;
  parent.appendChild(row);

  const cat = row.querySelector('.dyn-cat');
  const val = row.querySelector('.dyn-val');

  // 現在値から implicit modifiers (Bits 24-31) を抽出
  const implicitMods = (current >>> 24) & 0xff;
  const baseUsage = current & 0x00ffffff;

  // 現在値が含まれるカテゴリを推測してデフォルト選択
  cat.value = guessHidCategory(baseUsage) || 'hid-letters';
  refillValueOptions(val, cat.value, baseUsage);

  // 修飾キーUIの構築
  const modsContainer = row.querySelector('.mod-chip-row');
  const modItems = [
    ['LCtl', 0x01], ['LSft', 0x02], ['LAlt', 0x04], ['LGui', 0x08],
    ['RCtl', 0x10], ['RSft', 0x20], ['RAlt', 0x40], ['RGui', 0x80]
  ];
  
  function updateValue() {
    if (val.value === '') return;
    const base = Number(val.value) & 0x00ffffff;
    let mods = 0;
    for (const cb of row.querySelectorAll('.dyn-implicit-mods input[type=checkbox]')) {
      if (cb.checked) mods |= Number(cb.dataset.mask);
    }
    const finalValue = (mods << 24) | base;
    document.getElementById(paramId).value = finalValue;
    updateResolvedHints();
  }

  for (const [label, mask] of modItems) {
    const chip = document.createElement('label');
    chip.className = 'live-mod-chip';
    chip.innerHTML = `<input type="checkbox" data-mask="${mask}"${implicitMods & mask ? ' checked' : ''}><span>${label}</span>`;
    chip.querySelector('input').addEventListener('change', updateValue);
    modsContainer.appendChild(chip);
  }

  cat.addEventListener('change', () => refillValueOptions(val, cat.value, null));
  val.addEventListener('change', updateValue);
}

function refillValueOptions(selectEl, category, currentValue) {
  selectEl.innerHTML = '<option value="">— 選択 —</option>';
  for (const [label, value] of getQuickPickOptions(category)) {
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label;
    if (currentValue !== null && currentValue !== undefined && Number(value) === Number(currentValue)) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  }
}

function guessHidCategory(usage) {
  if (!usage) return null;
  const page = (usage >> 16) & 0xff;
  const id = usage & 0xffff;
  if (page === 12) return 'hid-media';
  if (page !== 7) return null;
  if (id >= 4 && id <= 29) return 'hid-letters';
  if ((id >= 30 && id <= 39)) return 'hid-digits';
  if ((id >= 58 && id <= 69) || (id >= 104 && id <= 115)) return 'hid-functions';
  if (id >= 79 && id <= 82) return 'hid-arrows';
  if (id >= 224 && id <= 231) return 'hid-modifiers';
  if (id === 41 || id === 43 || id === 44 || id === 40 || id === 42 || id === 76 || id === 57 || id === 74 || id === 77 || id === 75 || id === 78 || id === 73 || id === 70) return 'hid-special';
  if ((id >= 45 && id <= 56)) return 'hid-symbols';
  return null;
}

function buildLayerSelector(parent, paramId, current) {
  const row = document.createElement('div');
  row.className = 'dyn-row';
  row.innerHTML = `<label>レイヤー</label><select class="bind-input dyn-val"></select>`;
  parent.appendChild(row);
  const sel = row.querySelector('.dyn-val');
  for (const layer of state.keymap?.layers || []) {
    const opt = document.createElement('option');
    opt.value = String(layer.id);
    opt.textContent = `${layer.id}: ${layer.name || '(unnamed)'}`;
    if (Number(layer.id) === Number(current)) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    document.getElementById(paramId).value = sel.value;
    updateResolvedHints();
  });
}

// 〈Single-Modifier Sigil〉— Mod-Tap の hold 修飾キーは ZMK Studio 側で HID page-7 modifier usage
// (KBD(224..231)) として encode される。modmask bitmask ではないため単体選択 UI が正しい。
function buildHidModifierSelector(parent, paramId, current) {
  const row = document.createElement('div');
  row.className = 'dyn-row';
  row.innerHTML = `<label>修飾キー</label><select class="bind-input dyn-val"></select>`;
  parent.appendChild(row);
  const sel = row.querySelector('.dyn-val');

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— 選択 —';
  sel.appendChild(placeholder);

  let matched = false;
  for (const [label, value] of HID_MODIFIER_OPTIONS) {
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label;
    if (Number(value) === Number(current)) {
      opt.selected = true;
      matched = true;
    }
    sel.appendChild(opt);
  }
  if (!matched) placeholder.selected = true;

  sel.addEventListener('change', () => {
    if (sel.value === '') return;
    document.getElementById(paramId).value = sel.value;
    updateResolvedHints();
  });
}

function buildMouseSelector(parent, paramId, current) {
  const row = document.createElement('div');
  row.className = 'dyn-row';
  row.innerHTML = `<label>ボタン</label><select class="bind-input dyn-val"></select>`;
  parent.appendChild(row);
  const sel = row.querySelector('.dyn-val');
  for (const [label, value] of HID_MOUSE) {
    const opt = document.createElement('option');
    opt.value = String(value);
    opt.textContent = label;
    if (Number(value) === Number(current)) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    document.getElementById(paramId).value = sel.value;
    updateResolvedHints();
  });
}

function buildNumberInput(parent, paramId, current) {
  const row = document.createElement('div');
  row.className = 'dyn-row';
  row.innerHTML = `<label>数値</label><input type="number" class="bind-input dyn-val" value="${current}">`;
  parent.appendChild(row);
  const inp = row.querySelector('.dyn-val');
  inp.addEventListener('input', () => {
    document.getElementById(paramId).value = inp.value;
    updateResolvedHints();
  });
}

function updateResolvedHints() {
  const behaviorId = Number(document.getElementById('bind-behavior').value);
  const fullName = behaviorName(behaviorId);
  const p1 = Number(document.getElementById('bind-param1').value) || 0;
  const p2 = Number(document.getElementById('bind-param2').value) || 0;
  const p1Resolved = paramLabel(fullName, p1);
  const p2Resolved = paramLabel(fullName, p2);
  document.getElementById('bind-p1-resolved').textContent =
    p1Resolved && p1Resolved !== String(p1) ? `→ ${p1Resolved}` : '';
  document.getElementById('bind-p2-resolved').textContent =
    p2Resolved && p2Resolved !== String(p2) ? `→ ${p2Resolved}` : '';
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
      await refreshKeymap();
      closeBindingEditor();
    }
  } catch (e) {
    log(`Edit failed: ${e.message || e}`, 'error');
  }
}

function init() {
  els.connectBleBtn.addEventListener('click', handleConnectBle);
  document.getElementById('connect-ble-all-btn').addEventListener('click', handleConnectBleStrict);
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

  // 〈Step 3 Toolbar〉— Layer CRUD / Save / Discard / Factory Reset
  const wrap = (fn, fallbackMsg) => async () => {
    try { await fn(); }
    catch (e) { log(`${fallbackMsg}: ${e.message || e}`, 'error'); }
  };
  document.getElementById('add-layer-btn')?.addEventListener('click', wrap(addLayer, 'Add Layer failed'));
  document.getElementById('save-changes-btn')?.addEventListener('click', wrap(saveChanges, 'Save failed'));
  document.getElementById('discard-changes-btn')?.addEventListener('click', wrap(async () => {
    if (!confirm('未保存の変更をすべて破棄します。本当によろしいですか？')) return;
    await discardChanges();
  }, 'Discard failed'));
  document.getElementById('reset-settings-btn')?.addEventListener('click', wrap(async () => {
    if (!confirm(
      '⚠ FACTORY RESET ⚠\n\n' +
      'キーボードの ZMK Studio 設定を工場出荷状態に戻します。\n' +
      'これまでの Live Sync 編纂はすべて消失します。\n\n' +
      '本当に実行しますか？'
    )) return;
    if (!confirm('最終確認: 本当に Factory Reset を実行しますか？')) return;
    await resetSettings();
  }, 'Reset failed'));

  // Behavior 切替時に動的 UI を再構築
  document.getElementById('bind-behavior').addEventListener('change', () => {
    const newBehaviorId = Number(document.getElementById('bind-behavior').value);
    const oldBehaviorId = Number(state._editorPrevBehaviorId ?? newBehaviorId);
    const newName = behaviorName(newBehaviorId);
    const oldName = behaviorName(oldBehaviorId);
    const oldP1 = Number(document.getElementById('bind-param1').value) || 0;
    const oldP2 = Number(document.getElementById('bind-param2').value) || 0;
    // 〈Type-Matched Inheritance〉— 旧 behavior の各 slot を新 behavior の同型 slot へ転生させる
    const adapted = adaptParamsForNewBehavior(oldName, newName, oldP1, oldP2);
    document.getElementById('bind-param1').value = adapted.param1;
    document.getElementById('bind-param2').value = adapted.param2;
    renderDynamicSlots(newName, adapted);
    updateResolvedHints();
    state._editorPrevBehaviorId = newBehaviorId;
  });
  document.getElementById('bind-param1').addEventListener('input', updateResolvedHints);
  document.getElementById('bind-param2').addEventListener('input', updateResolvedHints);

  // ◆ GitHub Sync ─────────────────────────────
  document.getElementById('github-sync-btn')?.addEventListener('click', handleGithubSync);
  // PAT を localStorage に永続化（入力欄 ↔ storage の双方向バインド）
  const patInput = document.getElementById('github-pat-input');
  if (patInput) {
    const saved = localStorage.getItem('cardinal_github_pat');
    if (saved) patInput.value = saved;
    patInput.addEventListener('change', () => {
      localStorage.setItem('cardinal_github_pat', patInput.value);
    });
  }

  // Debug bridge: 開発時のみ window 経由で state にアクセスできるように
  window.__cardinal_live = {
    state, renderKeymapView, behaviorName, handleProbe,
    openBindingEditor, applyBindingEdit, closeBindingEditor,
    renderDynamicSlots, updateResolvedHints,
    handleGithubSync, _bindingToZmk,
  };
}

/* ◆ GITHUB SYNC ─────────────────────────── */
// ブラウザから GitHub Contents API を直接呼び出す。
// localhost サーバ不要 — GitHub Pages 上でそのまま動作する。

const GITHUB_REPO = 'cardinal-sys/Release_Recollection_Cardinal';
const GITHUB_API  = 'https://api.github.com';

// レイヤーファイルのマッピング（index → ファイル名 & DTSi変数名）
const LAYER_FILES = [
  ['00_default.dtsi',    'default_layer'],
  ['01_function.dtsi',   'FUNCTION'],
  ['02_sign.dtsi',       'SIGN'],
  ['03_num.dtsi',        'NUM'],
  ['04_mouse.dtsi',      'MOUSE'],
  ['05_scroll.dtsi',     'SCROLL'],
  ['06_bluetooth.dtsi',  'Bluetooth'],
  ['07_gesture_e.dtsi',  'GESTURE_E'],
  ['08_gesture_r.dtsi',  'GESTURE_R'],
  ['09_gesture_s.dtsi',  'GESTURE_S'],
  ['10_gesture_b.dtsi',  'GESTURE_B'],
  ['11_gesture_t.dtsi',  'GESTURE_T'],
  ['12_gesture_a.dtsi',  'GESTURE_A'],
  ['13_gesture_d.dtsi',  'GESTURE_D'],
  ['14_gesture_w.dtsi',  'GESTURE_W'],
  ['15_snipe.dtsi',      'SNIPE'],
  ['16_num_smart.dtsi',  'NUM_SMART'],
];

/* ── HID Usage → ZMK keycode ── */
const KBD_MAP = {
  4:'A',5:'B',6:'C',7:'D',8:'E',9:'F',10:'G',11:'H',12:'I',13:'J',
  14:'K',15:'L',16:'M',17:'N',18:'O',19:'P',20:'Q',21:'R',22:'S',
  23:'T',24:'U',25:'V',26:'W',27:'X',28:'Y',29:'Z',
  30:'NUMBER_1',31:'NUMBER_2',32:'NUMBER_3',33:'NUMBER_4',34:'NUMBER_5',
  35:'NUMBER_6',36:'NUMBER_7',37:'NUMBER_8',38:'NUMBER_9',39:'NUMBER_0',
  40:'ENTER',41:'ESC',42:'BACKSPACE',43:'TAB',44:'SPACE',
  45:'MINUS',46:'EQUAL',47:'LEFT_BRACKET',48:'RIGHT_BRACKET',
  49:'BACKSLASH',51:'SEMICOLON',52:'SINGLE_QUOTE',53:'GRAVE',
  54:'COMMA',55:'PERIOD',56:'SLASH',57:'CAPS',
  58:'F1',59:'F2',60:'F3',61:'F4',62:'F5',63:'F6',
  64:'F7',65:'F8',66:'F9',67:'F10',68:'F11',69:'F12',
  70:'PRINTSCREEN',73:'INSERT',74:'HOME',75:'PAGE_UP',
  76:'DELETE',77:'END',78:'PAGE_DOWN',
  79:'RIGHT_ARROW',80:'LEFT_ARROW',81:'DOWN_ARROW',82:'UP_ARROW',
  83:'KP_NUM',84:'KP_DIVIDE',85:'KP_MULTIPLY',86:'KP_MINUS',87:'KP_PLUS',88:'KP_ENTER',
  89:'KP_NUMBER_1',90:'KP_NUMBER_2',91:'KP_NUMBER_3',92:'KP_NUMBER_4',93:'KP_NUMBER_5',
  94:'KP_NUMBER_6',95:'KP_NUMBER_7',96:'KP_NUMBER_8',97:'KP_NUMBER_9',98:'KP_NUMBER_0',99:'KP_DOT',
  104:'F13',105:'F14',106:'F15',107:'F16',108:'F17',109:'F18',
  110:'F19',111:'F20',112:'F21',113:'F22',114:'F23',115:'F24',
  224:'LEFT_CONTROL',225:'LEFT_SHIFT',226:'LEFT_ALT',227:'LEFT_GUI',
  228:'RIGHT_CONTROL',229:'RIGHT_SHIFT',230:'RIGHT_ALT',231:'RIGHT_GUI',
};
const CONSUMER_MAP = {
  0xCD:'C_PLAY_PAUSE',0xE2:'C_MUTE',0xE9:'C_VOLUME_UP',
  0xEA:'C_VOLUME_DOWN',0xB5:'C_NEXT',0xB6:'C_PREVIOUS',
};
const MOD_NAMES = {
  0x01:'LCTRL',0x02:'LSHFT',0x04:'LALT',0x08:'LGUI',
  0x10:'RCTRL',0x20:'RSHFT',0x40:'RALT',0x80:'RGUI',
};
const MOUSE_MAP = {1:'MB1',2:'MB2',4:'MB3',8:'MB4',16:'MB5'};

// ZMK modifier ビット → ZMK modifier 関数名
const MOD_FN = {
  0x01:'LC', 0x02:'LS', 0x04:'LA', 0x08:'LG',
  0x10:'RC', 0x20:'RS', 0x40:'RA', 0x80:'RG',
};

// HID implicit modifier + keycode → &kp LS(LC(...(KEY)))
function _hidToKc(usage) {
  const implicit = (usage >>> 24) & 0xFF;
  const page     = (usage >>> 16) & 0xFF;
  const keyId    = usage & 0xFFFF;
  let kc;
  if (page === 7)       kc = KBD_MAP[keyId]      ?? `0x${keyId.toString(16).padStart(4,'0')}`;
  else if (page === 12) kc = CONSUMER_MAP[keyId]  ?? `0x${keyId.toString(16).padStart(4,'0')}`;
  else return `/* unknown usage 0x${usage.toString(16).padStart(8,'0')} */`;
  if (implicit) {
    // ZMK 正規形式: LS(LC(RA(RG(KEY)))) — 各 modifier を関数でネスト
    const fns = Object.entries(MOD_FN).filter(([m]) => implicit & Number(m)).map(([,f]) => f);
    kc = fns.reduce((inner, fn) => `${fn}(${inner})`, kc);
    return `&kp ${kc}`;
  }
  return kc;
}

// modifier ビットマスク → ZMK mt 第1引数
// ZMK の &mt 第1引数は modifier keycode: LEFT_SHIFT / LEFT_GUI 等
// 複数 modifier は LS(LC(...)) のネスト形式（実際の dtsi では単一のみが多い）
const MOD_MASK_TO_KC = {
  0x01:'LEFT_CONTROL', 0x02:'LEFT_SHIFT',  0x04:'LEFT_ALT',  0x08:'LEFT_GUI',
  0x10:'RIGHT_CONTROL',0x20:'RIGHT_SHIFT', 0x40:'RIGHT_ALT', 0x80:'RIGHT_GUI',
};
function _modMaskToZmk(mask) {
  if (mask === 0) return '0x00';
  // 単一 modifier ビット → そのまま keycode 名
  if (MOD_MASK_TO_KC[mask]) return MOD_MASK_TO_KC[mask];
  // 複数 modifier ビット → 最低位を base に残りを MOD_FN でネスト
  const bits = Object.keys(MOD_MASK_TO_KC).map(Number).filter(m => mask & m);
  const [first, ...rest] = bits;
  const base = MOD_MASK_TO_KC[first];
  return rest.reduce((inner, m) => `${MOD_FN[m]}(${inner})`, base);
}

// ZMK &bt コマンド enum（app/include/dt-bindings/zmk/bt.h）
// binding: param1 = command, param2 = arg（BT_SEL/BT_DISC のみ profile 引数を取る）
const BT_CMD = { 0: 'BT_CLR', 1: 'BT_NXT', 2: 'BT_PRV', 3: 'BT_SEL', 4: 'BT_CLR_ALL', 5: 'BT_DISC' };
function _btToZmk(p1, p2) {
  const cmd = BT_CMD[p1] ?? String(p1);
  return (p1 === 3 || p1 === 5) ? `&bt ${cmd} ${p2}` : `&bt ${cmd}`;
}

// 正規化ノード名 → ZMK 標準 behavior の正しいラベル alias + エンコード。
// ZMK Studio は built-in behavior の displayName を friendly 名（'Mouse Move' 等）で返すが、
// node 名（mouse_move）とラベル（mmv）が異なるため、ノード名そのままでは keymap が解決できない。
// switch で取りこぼした built-in をここで確実に正しいラベルへ変換する。
const BUILTIN_NODE_TO_ZMK = {
  'mouse_move':   (p1) => `&mmv ${p1}`,
  'mouse_scroll': (p1) => `&msc ${p1}`,
  'bluetooth':    (p1, p2) => _btToZmk(p1, p2),
};

// ZMK Studio の displayName → node 名への変換テーブル
// label が定義されている behavior は大文字 label で来るので node 名に変換する
const LABEL_TO_NODE = {
  'GESTURE_MO_KP':   'gesture_mo_kp',
  'ROTATE':          'rotate',
  'LT_MKP':         'lt_mkp',
  'MOD_MKP':        'mod_mkp',
  'DRAGKEY':        'dragkey',
  'SWAPPER':        'swapper',
  'SWAPPER_REV':    'swapper_rev',
  'LAYER_TAP_TO_0': 'lt_to_layer_0',
  'SAFARI_RELOAD_ONCE': 'safari_reload_once',
  'TO_LAYER_0':     'to_layer_0',
  'DRAG_ON':        'drag_on',
  'DRAG_OFF':       'drag_off',
  'BT_SOLO_0':      'bt_solo_0',
  'BT_SOLO_1':      'bt_solo_1',
  'BT_SOLO_2':      'bt_solo_2',
  'BT_SOLO_3':      'bt_solo_3',
  'BT_SOLO_4':      'bt_solo_4',
  'BT_PAIR_0':      'bt_pair_0',
  'BT_PAIR_1':      'bt_pair_1',
  'BT_PAIR_2':      'bt_pair_2',
  'BT_PAIR_3':      'bt_pair_3',
  'BT_PAIR_4':      'bt_pair_4',
  'BT_DISC_0':      'bt_disc_0',
  'BT_DISC_1':      'bt_disc_1',
  'BT_DISC_2':      'bt_disc_2',
  'BT_DISC_3':      'bt_disc_3',
  'BT_DISC_4':      'bt_disc_4',
  // node name → キーマップ内ラベル alias（ZMK Studio がノード名で返す場合の alias 変換）
  // 例: `td_enter: tap_dance_enter { ... }` → displayName='tap_dance_enter', 使用名='td_enter'
  'tap_dance_enter': 'td_enter',
};

// 独自 behavior（hold-tap 系）のパラメーター数
// 2 = &node p1 p2、1 = &node p1、0 = &node（パラメーターなし）
const CUSTOM_BEHAVIOR_PARAMS = {
  'gesture_mo_kp': 2,  // &gesture_mo_kp <layer> <kp_usage>
  'ht_snipe':      2,  // &ht_snipe <layer> <kp_usage>
  'smart_num':     1,  // &smart_num <layer>
  'smart_snipe':   1,  // &smart_snipe <layer>
  'lt_mkp':        2,  // &lt_mkp <layer> <btn>
  'mod_mkp':       2,
  'lt_to_layer_0': 2,
  'ht_arrows_alt': 2,
  'td_enter':      0,  // &td_enter（tap_dance_enter のラベル alias）
  'rotate':        0,
  'dragkey':       2,
  'swapper':       0,
  'swapper_rev':   0,
  'arrows_alt':    1,  // &arrows_alt <layer>
  // 引数ゼロのマクロ — paramCount=0 を明示しないと default 経路で余分な `0` が付与される
  'safari_reload_once': 0,
  'drag_on':       0,
  'drag_off':      0,
  'bt_solo_0':     0,
  'bt_solo_1':     0,
  'bt_solo_2':     0,
  'bt_solo_3':     0,
  'bt_solo_4':     0,
  'bt_pair_0':     0,
  'bt_pair_1':     0,
  'bt_pair_2':     0,
  'bt_pair_3':     0,
  'bt_pair_4':     0,
  'bt_disc_0':     0,
  'bt_disc_1':     0,
  'bt_disc_2':     0,
  'bt_disc_3':     0,
  'bt_disc_4':     0,
};

// p1 が HID key usage の場合はキーコードに変換、レイヤー番号の場合はそのまま返す
function _p1ToKc(p1) {
  // HID usage page が 0 以外ならキーコード変換
  const page = (p1 >>> 16) & 0xFF;
  if (page === 7 || page === 12) return _hidToKc(p1);
  // implicit mod のみの場合（page=0, keyId=0 かつ implicit>0）
  const implicit = (p1 >>> 24) & 0xFF;
  const keyId = p1 & 0xFFFF;
  if (implicit && keyId) return _hidToKc(p1);
  // ページなし小数値 → レイヤー番号またはそのまま
  return String(p1);
}

function _p2ToKc(p2) {
  const implicit = (p2 >>> 24) & 0xFF;
  const page     = (p2 >>> 16) & 0xFF;
  const keyId    = p2 & 0xFFFF;
  let kc;
  if (page === 12) kc = CONSUMER_MAP[keyId] ?? `0x${keyId.toString(16).padStart(4,'0')}`;
  else             kc = KBD_MAP[keyId]      ?? `0x${keyId.toString(16).padStart(4,'0')}`;
  // implicit modifier（上位バイト）を LS()/LC()/… でラップして保持（例: LG(LEFT_BRACKET)）
  if (implicit) {
    const fns = Object.entries(MOD_FN).filter(([m]) => implicit & Number(m)).map(([,f]) => f);
    kc = fns.reduce((inner, fn) => `${fn}(${inner})`, kc);
  }
  return kc;
}

function _bindingToZmk(b, behaviors) {
  const bid   = b.behaviorId ?? 0;
  const p1    = b.param1 ?? 0;
  const p2    = b.param2 ?? 0;
  const bname = behaviors[bid]?.displayName ?? `behavior#${bid}`;

  switch (bname) {
    case 'Transparent':    return '&trans';
    case 'None':           return '&none';
    case 'Bootloader':     return '&bootloader';
    case 'Reset':          return '&sys_reset';
    case 'Studio Unlock':  return '&studio_unlock';
    case 'Key Press': {
      const kc = _hidToKc(p1);
      return kc.startsWith('&kp ') ? kc : `&kp ${kc}`;
    }
    case 'Mod-Tap': {
      // p1 は HID keyboard modifier usage（0x000700E0..E7）。bitmask ではないため
      // _p2ToKc で通常キー同様に decode する（KBD_MAP[225]=LEFT_SHIFT 等）。implicit mod も保持。
      const modZmk = _p2ToKc(p1);
      const kc     = _p2ToKc(p2);
      return `&mt ${modZmk} ${kc}`;
    }
    case 'Layer-Tap': {
      const kc = _p2ToKc(p2);
      return `&lt ${p1} ${kc}`;
    }
    case 'Momentary Layer': return `&mo ${p1}`;
    case 'Toggle Layer':    return `&tog ${p1}`;
    case 'To Layer':        return `&to ${p1}`;
    case 'Sticky Key': {
      const page  = (p1 >>> 16) & 0xFF;
      const keyId = p1 & 0xFFFF;
      const kc    = page === 7 ? (KBD_MAP[keyId] ?? `0x${keyId.toString(16).padStart(4,'0')}`) : `0x${keyId.toString(16).padStart(4,'0')}`;
      return `&sk ${kc}`;
    }
    case 'Sticky Layer':      return `&sl ${p1}`;
    case 'Mouse Key Press':   return `&mkp ${MOUSE_MAP[p1] ?? `MB${p1}`}`;
    case 'Key Repeat':        return `&key_repeat ${KBD_MAP[p1 & 0xFFFF] ?? `0x${(p1 & 0xFFFF).toString(16).padStart(4,'0')}`}`;
    case 'Key Toggle':        return `&kt ${KBD_MAP[p1 & 0xFFFF] ?? `0x${(p1 & 0xFFFF).toString(16).padStart(4,'0')}`}`;
    case 'Grave/Escape':      return `&gresc`;
    case 'Output Selection':  return `&out ${{0:'OUT_AUTO',1:'OUT_USB',2:'OUT_BLE'}[p1] ?? String(p1)}`;
    case 'External Power':    return `&ext_power ${{0:'EP_OFF',1:'EP_ON',2:'EP_TOG'}[p1] ?? String(p1)}`;
    default: {
      // 独自 behavior — label → node 名に変換、パラメーター数に応じて出力
      const nodeName = LABEL_TO_NODE[bname] ?? bname.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      // ZMK 標準 behavior（Mouse Move/Scroll/Bluetooth）はラベルが node 名と異なるため専用変換
      if (BUILTIN_NODE_TO_ZMK[nodeName]) return BUILTIN_NODE_TO_ZMK[nodeName](p1, p2);
      const paramCount = CUSTOM_BEHAVIOR_PARAMS[nodeName] ?? CUSTOM_BEHAVIOR_PARAMS[bname.toLowerCase()] ?? -1;
      if (paramCount === 0) return `&${nodeName}`;
      if (paramCount === 1) return `&${nodeName} ${p1}`;
      if (paramCount === 2) {
        const k2 = _p2ToKc(p2);
        return `&${nodeName} ${p1} ${k2}`;
      }
      // 不明な場合: p2 が 0 なら 1パラメーター、そうでなければ 2パラメーター
      if (p2 === 0) return `&${nodeName} ${p1}`;
      return `&${nodeName} ${p1} ${_p2ToKc(p2)}`;
    }
  }
}

/**
 * ZMK Studio keymap JSON → { "config/keymap/layers/XX.dtsi": "<content>", ... }
 * 既存ファイルの内容（ヘッダコメント・sensor-bindings）は GitHub から取得して保持する。
 */
async function keymapToDtsiFiles(pat, branch) {
  const layers    = state.keymap.layers ?? [];
  const behaviors = state.behaviors;   // { id(number) -> { displayName } }
  const result    = {};

  for (let i = 0; i < Math.min(layers.length, LAYER_FILES.length); i++) {
    const [fname, varName] = LAYER_FILES[i];
    const layer = layers[i];
    const fpath = `config/keymap/layers/${fname}`;

    // 既存ファイルのヘッダコメントと sensor-bindings を GitHub から取得
    let header = null;
    let sensorLine = null;
    try {
      const ghResp = await ghGetFile(pat, fpath, branch);
      if (ghResp.ok) {
        // UTF-8 安全デコード（書き込み側 btoa(unescape(encodeURIComponent(...))) と対称）。
        // 単純な atob だけだと em-dash「—」や日本語コメントが多段文字化けするため。
        const existing = decodeURIComponent(escape(atob(ghResp.data.content.replace(/\n/g, ''))));
        const hm = existing.match(/^(\/\*[\s\S]*?\*\/\n)/);
        if (hm) header = hm[1];
        const sm = existing.match(/(sensor-bindings\s*=\s*<[^>]+>;)/);
        if (sm) sensorLine = sm[1];
      }
    } catch (_) { /* 取得失敗は無視して生成 */ }

    const bindStrs = (layer.bindings ?? []).map((b) => _bindingToZmk(b, behaviors));
    const bindLine = '    ' + bindStrs.join('  ');

    const lines = [];
    if (header) {
      lines.push(header.trimEnd());
    } else {
      lines.push(
        `/* ============================================================\n` +
        ` * layers/${fname} — [ Synthesis ${String(i).padStart(2,'0')} ] ${varName}\n` +
        ` * ============================================================ */`
      );
    }
    lines.push('');
    lines.push(`${varName} {`);
    lines.push('    bindings = <');
    lines.push(bindLine);
    lines.push('    >;');
    if (sensorLine) {
      lines.push('');
      lines.push(`    ${sensorLine}`);
    }
    lines.push('};');
    lines.push('');

    result[fpath] = lines.join('\n');
  }
  return result;
}

/* ── GitHub REST helpers ── */
async function _ghFetch(pat, endpoint, options = {}) {
  const url = `${GITHUB_API}${endpoint}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers ?? {}),
    },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw Object.assign(new Error(data.message ?? `HTTP ${resp.status}`), { status: resp.status, data });
  }
  return data;
}

// ファイル内容取得（ヘッダ・sensor-bindings 保持用）
async function ghGetFile(pat, path, branch = 'main') {
  try {
    const data = await _ghFetch(pat, `/repos/${GITHUB_REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null };
  }
}

/**
 * 〈Single Inscription〉— Git Tree API で全ファイルを 1 コミットにまとめる。
 * Cardinal Editor の commitAll() と同じアプローチ。
 *
 * 手順:
 *   1. branch の HEAD SHA を取得
 *   2. HEAD commit の tree SHA を取得
 *   3. 各ファイルの blob を並列作成
 *   4. 新しい tree を作成（base_tree = HEAD tree）
 *   5. commit オブジェクトを作成
 *   6. branch の ref を新 commit へ更新
 */
async function ghCommitAll(pat, branch, files, message) {
  // files: [ { path: string, content: string }, ... ]

  // 1. branch HEAD SHA を取得
  const ref = await _ghFetch(pat,
    `/repos/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(branch)}`);
  const headSha = ref.object.sha;

  // 2. HEAD commit の base tree SHA を取得
  const baseCommit = await _ghFetch(pat,
    `/repos/${GITHUB_REPO}/git/commits/${headSha}`);
  const baseTreeSha = baseCommit.tree.sha;

  // 3. 各ファイルの blob を並列作成
  const blobs = await Promise.all(files.map(async ({ path, content }) => {
    const blob = await _ghFetch(pat, `/repos/${GITHUB_REPO}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({
        content: btoa(unescape(encodeURIComponent(content))),
        encoding: 'base64',
      }),
    });
    return { path, sha: blob.sha };
  }));

  // 4. 新しい tree を作成（base_tree = HEAD tree）
  const tree = await _ghFetch(pat, `/repos/${GITHUB_REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: blobs.map(({ path, sha }) => ({
        path, sha, mode: '100644', type: 'blob',
      })),
    }),
  });

  // 5. commit オブジェクトを作成して ref を更新
  const commit = await _ghFetch(pat, `/repos/${GITHUB_REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  });

  await _ghFetch(pat, `/repos/${GITHUB_REPO}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.sha;
}

/* ── メイン同期関数 ── */
async function handleGithubSync() {
  const pat = (
    document.getElementById('github-pat-input')?.value ||
    localStorage.getItem('cardinal_github_pat') || ''
  ).trim();

  if (!pat) {
    log('〈GitHub Sync〉GitHub PAT が未入力です。パネルに入力してください。', 'error');
    return;
  }
  if (!state.keymap) {
    log('〈GitHub Sync〉keymap データがありません。先に〈 Memory Recall 〉を実行してください。', 'error');
    return;
  }

  const branch    = document.getElementById('github-branch-input')?.value?.trim() || 'main';
  const customMsg = document.getElementById('github-commit-msg')?.value?.trim();
  const commitMsg = customMsg ||
    `feat(live-sync): 〈Memory Inscription〉— Live Sync Conduit からキーマップを同期 (${new Date().toISOString().slice(0,19).replace('T',' ')})`;

  setSyncStatus('syncing', '変換中…');
  log('〈GitHub Sync〉keymap → DTSi 変換開始', 'info');

  let dtsiFiles;
  try {
    dtsiFiles = await keymapToDtsiFiles(pat, branch);
  } catch (e) {
    const detail = e.status ? `HTTP ${e.status}: ${e.message}` : String(e);
    log(`〈GitHub Sync〉変換エラー: ${detail}`, 'error');
    setSyncStatus('error', `❌ 変換エラー: ${detail}`);
    return;
  }

  const files = Object.entries(dtsiFiles).map(([path, content]) => ({ path, content }));
  log(`〈GitHub Sync〉${files.length} ファイルを 1 コミットで刻印中… (branch: ${branch})`, 'info');
  setSyncStatus('syncing', `${files.length} ファイルを 1 コミットで同期中…`);

  try {
    const commitSha = await ghCommitAll(pat, branch, files, commitMsg);
    const short = commitSha.slice(0, 7);
    log(`〈GitHub Sync〉✅ 完了 — ${files.length} ファイル → ${branch} [${short}]`, 'success');
    setSyncStatus('ok', `✅ ${files.length} files → ${branch} [${short}]`);
  } catch (e) {
    const detail = e.status ? `HTTP ${e.status}: ${e.message}` : String(e);
    log(`〈GitHub Sync〉❌ エラー: ${detail}`, 'error');
    setSyncStatus('error', `❌ ${detail}`);
  }
}

function setSyncStatus(kind, text) {
  const el = document.getElementById('github-sync-status');
  if (!el) return;
  el.textContent = text;
  el.className = `github-sync-status sync-${kind}`;
  el.classList.remove('hidden');
}

init();
