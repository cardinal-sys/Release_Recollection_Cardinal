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

/* ◆ Tauri Native Bridge ─────────────── */
// Tauri デスクトップ版で動作しているか検出。
// Tauri 環境なら window.__TAURI_INTERNALS__ が存在する（v2）
function isTauri() {
  return typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__);
}

async function tauriInvoke(cmd, args) {
  // Tauri 2 の core API: window.__TAURI__.core.invoke
  // 古い v1 API: window.__TAURI__.tauri.invoke
  const t = window.__TAURI_INTERNALS__ || window.__TAURI__;
  if (t?.invoke) return t.invoke(cmd, args);
  if (t?.core?.invoke) return t.core.invoke(cmd, args);
  if (t?.tauri?.invoke) return t.tauri.invoke(cmd, args);
  throw new Error('Tauri invoke API not available');
}

async function tauriListen(event, handler) {
  const t = window.__TAURI_INTERNALS__ || window.__TAURI__;
  if (t?.event?.listen) return t.event.listen(event, handler);
  throw new Error('Tauri event API not available');
}

// HTMLモーダルによるデバイス選択（Tauri の WebView では prompt() が動作しないため）
function showDevicePicker(candidates) {
  return new Promise((resolve) => {
    const modal = document.getElementById('ble-picker-modal');
    const list = document.getElementById('ble-picker-list');
    const cancelBtn = document.getElementById('ble-picker-cancel');
    if (!modal || !list) { resolve(null); return; }

    list.innerHTML = '';
    candidates.forEach((d, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.style.cssText = 'text-align:left;padding:10px 14px;font-size:0.75rem;letter-spacing:0.05em;';
      const displayName = d.name ? d.name : `Unnamed Device (${d.id.substring(0,8)})`;
      btn.innerHTML = `<strong>${displayName}</strong><br><span style="color:var(--text-secondary);font-size:0.65rem;">${d.address} ${d.rssi != null ? `(RSSI: ${d.rssi})` : ''}</span>`;
      btn.addEventListener('click', () => { cleanup(); resolve(d); });
      list.appendChild(btn);
    });

    const cleanup = () => { modal.classList.add('hidden'); };
    cancelBtn.onclick = () => { cleanup(); resolve(null); };
    modal.classList.remove('hidden');
  });
}

// Tauri ネイティブ BLE transport（Web Bluetooth と同等のインターフェース）
async function connectBleTauri() {
  // 1) 周辺をスキャン
  log('Tauri Native BLE: scan_devices...');
  const devices = await tauriInvoke('ble_scan');
  log(`Found ${devices.length} BLE device(s)`);

  // Elucidator 風の name を優先、無ければモーダルから選択
  let target = devices.find((d) => /elucidator/i.test(d.name || ''));
  if (!target) {
    const candidates = devices; // Filter removed to show unnamed devices
    if (candidates.length === 0) throw new Error('No BLE device found');
    target = await showDevicePicker(candidates);
    if (!target) throw new Error('Cancelled by user');
  }
  log(`Connecting to ${target.name || target.address}...`);
  const label = await tauriInvoke('ble_connect', { id: target.id });

  // 2) 受信ストリーム（notification → ReadableStream）
  let pendingChunks = [];
  let waitingResolve = null;
  const unlisten = await tauriListen('ble-notification', (event) => {
    const bytes = new Uint8Array(event.payload);
    if (waitingResolve) {
      waitingResolve({ value: bytes, done: false });
      waitingResolve = null;
    } else {
      pendingChunks.push(bytes);
    }
  });
  await tauriInvoke('ble_subscribe');

  const readable = new ReadableStream({
    pull(controller) {
      return new Promise((resolve) => {
        if (pendingChunks.length > 0) {
          controller.enqueue(pendingChunks.shift());
          resolve();
        } else {
          waitingResolve = (chunk) => {
            controller.enqueue(chunk.value);
            resolve();
          };
        }
      });
    },
    cancel() { try { unlisten(); } catch (_) {} },
  });

  // 3) 送信ストリーム
  const writable = new WritableStream({
    write(chunk) {
      return tauriInvoke('ble_write', { data: Array.from(chunk) });
    },
  });

  const abortController = new AbortController();
  abortController.signal.addEventListener('abort', () => {
    tauriInvoke('ble_disconnect').catch(() => {});
    try { unlisten(); } catch (_) {}
  });

  return { label, abortController, readable, writable };
}

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
    // 名前が Elucidator っぽい / もしくは前回接続したものを優先
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
  // Tauri デスクトップ版: OS ネイティブ Bluetooth API を経由
  if (isTauri()) {
    try {
      setConduitState('connecting', 'Tauri Native BLE...', 'OS API 経由でデバイスを検索中');
      log('〈Native Embodiment〉Tauri ネイティブ BLE で接続');
      const transport = await connectBleTauri();
      await establishConnection(transport, 'BLE (Tauri Native)');
      return;
    } catch (err) {
      log(`Tauri Native BLE failed: ${err.message || err}`, 'error');
      setConduitState('error', 'Tauri Native BLE failed', err.message || String(err));
      return;
    }
  }

  // Web ブラウザ: Web Bluetooth API
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
// type: 'hid' (HID Usage) | 'layer' | 'modmask' | 'mouse' | 'none' | 'number'
const BEHAVIOR_PARAM_SPEC = {
  'Key Press':       { p1: { type: 'hid',     label: 'キー' },         p2: { type: 'none' } },
  'Mod-Tap':         { p1: { type: 'modmask', label: '修飾キー (ホールド時)' }, p2: { type: 'hid', label: 'キー (タップ時)' } },
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

// 修飾キー (Mod Mask) for Mod-Tap などの param1
// ZMK の MOD_LCTL=0x01, LSFT=0x02, LALT=0x04, LGUI=0x08, RCTL=0x10, RSFT=0x20, RALT=0x40, RGUI=0x80
const MOD_MASKS = [
  ['LCTL', 0x01], ['LSFT', 0x02], ['LALT', 0x04], ['LGUI', 0x08],
  ['RCTL', 0x10], ['RSFT', 0x20], ['RALT', 0x40], ['RGUI', 0x80],
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
    case 'modmask':       return MOD_MASKS;
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

function renderSlot(slotNum, slotSpec, currentValue) {
  const slot = document.getElementById(`dyn-slot-${slotNum}`);
  const labelEl = document.getElementById(`dyn-slot-${slotNum}-label`);
  const body = document.getElementById(`dyn-slot-${slotNum}-body`);
  body.innerHTML = '';

  if (slotSpec.type === 'none') {
    slot.classList.add('hidden');
    return;
  }
  slot.classList.remove('hidden');
  labelEl.textContent = `◆ ${slotSpec.label || `Slot ${slotNum}`}`;

  const paramId = slotNum === 1 ? 'bind-param1' : 'bind-param2';

  switch (slotSpec.type) {
    case 'hid':       buildHidSelector(body, paramId, currentValue); break;
    case 'layer':     buildLayerSelector(body, paramId, currentValue); break;
    case 'modmask':   buildModMaskSelector(body, paramId, currentValue); break;
    case 'mouse':     buildMouseSelector(body, paramId, currentValue); break;
    case 'number':    buildNumberInput(body, paramId, currentValue); break;
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

function buildModMaskSelector(parent, paramId, current) {
  const block = document.createElement('div');
  block.innerHTML = `
    <p class="hint" style="font-size: 0.65rem; margin-bottom: 6px;">複数選択可（OR 結合）</p>
    <div class="mod-chip-row" data-row="L"></div>
    <div class="mod-chip-row" data-row="R"></div>
  `;
  const left = block.querySelector('[data-row="L"]');
  const right = block.querySelector('[data-row="R"]');
  const items = [
    ['LCtl', 0x01, left], ['LSft', 0x02, left], ['LAlt', 0x04, left], ['LGui', 0x08, left],
    ['RCtl', 0x10, right], ['RSft', 0x20, right], ['RAlt', 0x40, right], ['RGui', 0x80, right],
  ];
  for (const [label, mask, container] of items) {
    const chip = document.createElement('label');
    chip.className = 'live-mod-chip';
    chip.innerHTML = `<input type="checkbox" data-mask="${mask}"${current & mask ? ' checked' : ''}><span>${label}</span>`;
    chip.querySelector('input').addEventListener('change', () => {
      let total = 0;
      for (const cb of block.querySelectorAll('input[type=checkbox]')) {
        if (cb.checked) total |= Number(cb.dataset.mask);
      }
      document.getElementById(paramId).value = total;
      updateResolvedHints();
    });
    container.appendChild(chip);
  }
  parent.appendChild(block);
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
  // Runtime バッジ更新
  const badge = document.getElementById('runtime-badge');
  if (badge) {
    if (isTauri()) {
      badge.textContent = 'Tauri Native';
      badge.classList.remove('runtime-web');
      badge.classList.add('runtime-tauri');
      badge.title = 'OS ネイティブ Bluetooth API 利用可能（macOS HID 接続中もOK）';
    } else {
      badge.title = 'Web Bluetooth / Web Serial 利用';
    }
  }
  if (isTauri()) log('〈Native Embodiment〉Tauri デスクトップ版で起動中 — OS ネイティブ BLE 利用可能', 'success');
  if (!('bluetooth' in navigator) && !isTauri()) log('Web Bluetooth API: 利用不可', 'warning');
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
    const behaviorId = Number(document.getElementById('bind-behavior').value);
    const fullName = behaviorName(behaviorId);
    // 既存 param 値を継承して再描画
    renderDynamicSlots(fullName, {
      param1: Number(document.getElementById('bind-param1').value) || 0,
      param2: Number(document.getElementById('bind-param2').value) || 0,
    });
    updateResolvedHints();
  });
  document.getElementById('bind-param1').addEventListener('input', updateResolvedHints);
  document.getElementById('bind-param2').addEventListener('input', updateResolvedHints);

  // Debug bridge: 開発時のみ window 経由で state にアクセスできるように
  window.__cardinal_live = {
    state, renderKeymapView, behaviorName, handleProbe,
    openBindingEditor, applyBindingEdit, closeBindingEditor,
    renderDynamicSlots, updateResolvedHints,
  };
}

init();
