// 〈Cardinal Editor〉 Tauri ライブラリエントリ。
// Phase A: 既存 editor/ を embed して起動するだけ。
// Phase B 以降で Rust 側に BLE transport / RPC を実装する。

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("〈Cardinal Editor〉Tauri 起動に失敗しました");
}

#[tauri::command]
fn ping() -> String {
    "Cardinal Editor (Tauri) is alive".to_string()
}
