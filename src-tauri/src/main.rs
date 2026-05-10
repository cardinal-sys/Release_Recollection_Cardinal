// 〈Cardinal Editor — Tauri Desktop〉
// Web Bluetooth の制約を超え、OS ネイティブ Bluetooth API で
// macOS HID 接続中でもキーボードへ Live Sync 接続可能にする神器。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cardinal_editor_lib::run()
}
