// 〈Live Sync Conduit — Native〉
// bluest を使った OS ネイティブ Bluetooth transport。
// macOS / Windows / Linux いずれでも動作し、HID 接続中の peripheral も
// connected_devices_with_services 経由で検出可能。

use bluest::{Adapter, Characteristic, Device, Uuid};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time;

pub const ZMK_STUDIO_SERVICE_UUID: Uuid =
    Uuid::from_u128(0x00000000_0196_6107_c967_c5cfb1c2482a);
pub const ZMK_STUDIO_RPC_CHRC_UUID: Uuid =
    Uuid::from_u128(0x00000001_0196_6107_c967_c5cfb1c2482a);

#[derive(Default)]
pub struct BleState {
    pub adapter: Mutex<Option<Adapter>>,
    pub device: Mutex<Option<Device>>,
    pub characteristic: Mutex<Option<Characteristic>>,
    pub scan_cache: Mutex<HashMap<String, Device>>,
    pub notifications_handle: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct BleDevice {
    pub id: String,
    pub name: String,
    pub address: String,
    pub rssi: Option<i16>,
}

async fn ensure_adapter(state: &Arc<BleState>) -> Result<Adapter, String> {
    let mut guard = state.adapter.lock().await;
    if guard.is_none() {
        let adapter = Adapter::default()
            .await
            .ok_or_else(|| "No Bluetooth adapter found".to_string())?;

        // wait_available() は PoweredOn になるまで永久に待つ。Bluetooth 権限が
        // 拒否されているとイベントが来ないため、5 秒で timeout してメッセージを返す。
        match time::timeout(Duration::from_secs(5), adapter.wait_available()).await {
            Ok(Ok(_)) => {}
            Ok(Err(e)) => return Err(format!("Bluetooth adapter not available: {e}")),
            Err(_) => {
                return Err(
                    "Bluetooth adapter ready 待ちで 5 秒タイムアウト。\
                     macOS の場合: システム設定 → プライバシーとセキュリティ → Bluetooth で \
                     Cardinal Editor の権限を ON にしてから再起動してください。"
                        .to_string(),
                );
            }
        }
        *guard = Some(adapter);
    }
    Ok(guard.as_ref().unwrap().clone())
}

pub async fn scan_devices(state: Arc<BleState>) -> Result<Vec<BleDevice>, String> {
    let adapter = ensure_adapter(&state).await?;
    let services = [ZMK_STUDIO_SERVICE_UUID];

    // (1) すでに OS と接続済みの peripheral を取得（HID 接続中の ZMK キーボードもここに出る）
    let mut found: HashMap<String, (Device, Option<i16>)> = HashMap::new();
    match time::timeout(
        Duration::from_secs(3),
        adapter.connected_devices_with_services(&services),
    )
    .await
    {
        Ok(Ok(connected)) => {
            for d in connected {
                found.insert(d.id().to_string(), (d, None));
            }
        }
        Ok(Err(e)) => {
            log::warn!("connected_devices_with_services failed: {e}");
        }
        Err(_) => {
            log::warn!("connected_devices_with_services timed out (3s)");
        }
    }

    // (2) advertisement を 6 秒間 listen
    match adapter.scan(&services).await {
        Ok(stream) => {
            let _ = time::timeout(Duration::from_secs(6), async {
                tokio::pin!(stream);
                while let Some(adv) = stream.next().await {
                    let id = adv.device.id().to_string();
                    found
                        .entry(id)
                        .and_modify(|entry| {
                            if let Some(r) = adv.rssi {
                                entry.1 = Some(r);
                            }
                        })
                        .or_insert_with(|| (adv.device, adv.rssi));
                }
            })
            .await;
        }
        Err(e) => {
            log::warn!("scan() failed (continuing with connected_devices only): {e}");
        }
    }

    // 後段の connect() で使うため Device を id でキャッシュ
    let mut cache_guard = state.scan_cache.lock().await;
    cache_guard.clear();
    for (id, (device, _)) in &found {
        cache_guard.insert(id.clone(), device.clone());
    }
    drop(cache_guard);

    let mut out = Vec::with_capacity(found.len());
    for (id, (device, rssi)) in found {
        let name = device.name_async().await.unwrap_or_default();
        out.push(BleDevice {
            id,
            name,
            address: String::new(), // bluest は MAC を直接公開しない
            rssi,
        });
    }
    Ok(out)
}

pub async fn connect(state: Arc<BleState>, id: String) -> Result<String, String> {
    let adapter = ensure_adapter(&state).await?;

    let device = {
        let cache = state.scan_cache.lock().await;
        cache
            .get(&id)
            .cloned()
            .ok_or_else(|| format!("Device {id} not in scan cache"))?
    };

    adapter
        .connect_device(&device)
        .await
        .map_err(|e| format!("connect_device: {e}"))?;

    let services = device
        .discover_services_with_uuid(ZMK_STUDIO_SERVICE_UUID)
        .await
        .map_err(|e| format!("discover_services: {e}"))?;
    let svc = services
        .into_iter()
        .next()
        .ok_or("Selected device does not expose ZMK Studio service")?;
    let chars = svc
        .discover_characteristics_with_uuid(ZMK_STUDIO_RPC_CHRC_UUID)
        .await
        .map_err(|e| format!("discover_characteristics: {e}"))?;
    let chrc = chars
        .into_iter()
        .next()
        .ok_or("ZMK Studio RPC characteristic not found")?;

    let label = device
        .name_async()
        .await
        .unwrap_or_else(|_| "Unknown".to_string());

    *state.device.lock().await = Some(device);
    *state.characteristic.lock().await = Some(chrc);
    Ok(label)
}

pub async fn subscribe_notifications<F>(
    state: Arc<BleState>,
    on_data: F,
) -> Result<(), String>
where
    F: Fn(Vec<u8>) + Send + Sync + 'static,
{
    let chrc = state
        .characteristic
        .lock()
        .await
        .clone()
        .ok_or("Not connected")?;

    // notify() の Stream は &Characteristic を borrow するため、chrc ごと spawn 内に move
    let cb = Arc::new(on_data);
    let handle = tokio::spawn(async move {
        let stream = match chrc.notify().await {
            Ok(s) => s,
            Err(_) => return,
        };
        tokio::pin!(stream);
        while let Some(item) = stream.next().await {
            if let Ok(bytes) = item {
                cb(bytes);
            }
        }
    });
    *state.notifications_handle.lock().await = Some(handle);
    Ok(())
}

pub async fn write(state: Arc<BleState>, data: Vec<u8>) -> Result<(), String> {
    let chrc = state
        .characteristic
        .lock()
        .await
        .clone()
        .ok_or("Not connected")?;
    chrc.write_without_response(&data)
        .await
        .map_err(|e| format!("write: {e}"))
}

pub async fn disconnect(state: Arc<BleState>) -> Result<(), String> {
    if let Some(handle) = state.notifications_handle.lock().await.take() {
        handle.abort();
    }
    let adapter = state.adapter.lock().await.clone();
    let device = state.device.lock().await.take();
    if let (Some(a), Some(d)) = (adapter, device) {
        a.disconnect_device(&d).await.ok();
    }
    *state.characteristic.lock().await = None;
    Ok(())
}
