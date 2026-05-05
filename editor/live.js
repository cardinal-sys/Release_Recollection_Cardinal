/* ===============================
 * 《 Live Sync Conduit 》 — live.js
 * @zmkfirmware/zmk-studio-ts-client を esm.sh 経由で利用
 * Web Bluetooth で ZMK Studio 対応キーボードへ接続する PoC
 * =============================== */

import * as gattTransport from 'https://esm.sh/@zmkfirmware/zmk-studio-ts-client@0.0.18/transport/gatt';
import { create_rpc_connection } from 'https://esm.sh/@zmkfirmware/zmk-studio-ts-client@0.0.18';

const $ = (id) => document.getElementById(id);
const els = {
  indicator: $('conduit-indicator'),
  label:     $('conduit-label'),
  detail:    $('conduit-detail'),
  connectBtn:    $('connect-btn'),
  disconnectBtn: $('disconnect-btn'),
  probeBtn:      $('probe-btn'),
  deviceSection: $('device-section'),
  infoLabel:     $('info-label'),
  logOutput:     $('log-output'),
};

const state = {
  transport: null,
  rpc: null,
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

async function handleConnect() {
  if (!('bluetooth' in navigator)) {
    log('Web Bluetooth が利用できません。Chrome / Edge を使用してください。', 'error');
    setConduitState('error', 'Unsupported', 'Web Bluetooth not available');
    return;
  }

  try {
    setConduitState('connecting', 'Requesting device...', 'デバイス選択ダイアログを開いています');
    log('navigator.bluetooth.requestDevice() を呼び出し...');

    const transport = await gattTransport.connect();
    state.transport = transport;
    log(`Transport 確立: ${transport.label}`, 'success');

    const rpc = create_rpc_connection(transport);
    state.rpc = rpc;
    log('RpcConnection 確立', 'success');

    setConduitState('connected', `Connected: ${rpc.label}`, 'Live Sync Conduit が確立されました');
    els.connectBtn.classList.add('hidden');
    els.disconnectBtn.classList.remove('hidden');
    els.probeBtn.classList.remove('hidden');
    els.deviceSection.classList.remove('hidden');
    els.infoLabel.textContent = rpc.label;

    // Notification subscription
    (async () => {
      const reader = rpc.notification_readable.getReader();
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
  } catch (err) {
    log(`Connect failed: ${err.message || err}`, 'error');
    setConduitState('error', 'Connect failed', err.message || String(err));
  }
}

function handleDisconnect() {
  if (state.transport?.abortController) {
    state.transport.abortController.abort();
    log('Transport aborted', 'warning');
  }
  state.transport = null;
  state.rpc = null;
  setConduitState('', 'Disconnected', '〈 Connect via Web Bluetooth 〉ボタンを押して神器に接続');
  els.connectBtn.classList.remove('hidden');
  els.disconnectBtn.classList.add('hidden');
  els.probeBtn.classList.add('hidden');
  els.deviceSection.classList.add('hidden');
}

async function handleProbe() {
  if (!state.rpc) return;
  log('--- Probe attempt ---');
  log('Note: 実 RPC リクエストは Step 3 で実装予定');
  log(`current_request counter: ${state.rpc.current_request}`);
  log(`label: ${state.rpc.label}`);
}

function init() {
  els.connectBtn.addEventListener('click', handleConnect);
  els.disconnectBtn.addEventListener('click', handleDisconnect);
  els.probeBtn.addEventListener('click', handleProbe);
  log('Live Sync Conduit initialized');
  log('@zmkfirmware/zmk-studio-ts-client@0.0.18 loaded via esm.sh');
}

init();
