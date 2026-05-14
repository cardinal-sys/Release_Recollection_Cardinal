// 〈Cardinal Editor〉 Tauri ライブラリエントリ。
// Phase B: Rust 側に BLE transport を実装し、Tauri command として
// frontend (live.js) から呼び出せるようにする。

mod ble;

use std::sync::Arc;
use tauri::{Emitter, State};

type BleStateArc = Arc<ble::BleState>;

#[tauri::command]
fn ping() -> String {
    "Cardinal Editor (Tauri) is alive".to_string()
}

#[tauri::command]
async fn ble_scan(state: State<'_, BleStateArc>) -> Result<Vec<ble::BleDevice>, String> {
    ble::scan_devices(state.inner().clone()).await
}

#[tauri::command]
async fn ble_connect(state: State<'_, BleStateArc>, id: String) -> Result<String, String> {
    ble::connect(state.inner().clone(), id).await
}

#[tauri::command]
async fn ble_subscribe(
    app: tauri::AppHandle,
    state: State<'_, BleStateArc>,
) -> Result<(), String> {
    let app_handle = app.clone();
    ble::subscribe_notifications(state.inner().clone(), move |bytes| {
        let _ = app_handle.emit("ble-notification", bytes);
    })
    .await
}

#[tauri::command]
async fn ble_write(state: State<'_, BleStateArc>, data: Vec<u8>) -> Result<(), String> {
    ble::write(state.inner().clone(), data).await
}

#[tauri::command]
async fn ble_disconnect(state: State<'_, BleStateArc>) -> Result<(), String> {
    ble::disconnect(state.inner().clone()).await
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage::<BleStateArc>(Arc::new(ble::BleState::default()))
        .invoke_handler(tauri::generate_handler![
            ping,
            ble_scan,
            ble_connect,
            ble_subscribe,
            ble_write,
            ble_disconnect
        ])
        .run(tauri::generate_context!())
        .expect("〈Cardinal Editor〉Tauri 起動に失敗しました");
}
