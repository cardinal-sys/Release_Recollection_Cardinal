// 〈Live Sync Conduit — Native〉
// btleplug を使った OS ネイティブ Bluetooth transport。
// macOS / Windows / Linux いずれでも動作し、HID 接続済みデバイスにも
// 並行アクセス可能（Web Bluetooth の制約を超える）。

use btleplug::api::{
    Central, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::time;
use uuid::Uuid;

pub const ZMK_STUDIO_SERVICE_UUID: Uuid =
    Uuid::from_u128(0x00000000_0196_6107_c967_c5cfb1c2482a);
pub const ZMK_STUDIO_RPC_CHRC_UUID: Uuid =
    Uuid::from_u128(0x00000001_0196_6107_c967_c5cfb1c2482a);

#[derive(Default)]
pub struct BleState {
    pub adapter: Mutex<Option<Adapter>>,
    pub peripheral: Mutex<Option<Peripheral>>,
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
        let manager = Manager::new().await.map_err(|e| e.to_string())?;
        let adapters = manager.adapters().await.map_err(|e| e.to_string())?;
        let adapter = adapters.into_iter().next().ok_or_else(|| {
            "No Bluetooth adapter found".to_string()
        })?;
        *guard = Some(adapter);
    }
    Ok(guard.as_ref().unwrap().clone())
}

pub async fn scan_devices(state: Arc<BleState>) -> Result<Vec<BleDevice>, String> {
    let adapter = ensure_adapter(&state).await?;
    adapter
        .start_scan(ScanFilter::default())
        .await
        .map_err(|e| e.to_string())?;
    time::sleep(time::Duration::from_secs(3)).await;
    let peripherals = adapter.peripherals().await.map_err(|e| e.to_string())?;
    adapter.stop_scan().await.ok();

    let mut out = Vec::new();
    for p in peripherals {
        let props = p.properties().await.ok().flatten();
        let name = props
            .as_ref()
            .and_then(|pp| pp.local_name.clone())
            .unwrap_or_default();
        let rssi = props.as_ref().and_then(|pp| pp.rssi);
        let address = props
            .as_ref()
            .map(|pp| pp.address.to_string())
            .unwrap_or_default();
        out.push(BleDevice {
            id: p.id().to_string(),
            name,
            address,
            rssi,
        });
    }
    Ok(out)
}

pub async fn connect(state: Arc<BleState>, id: String) -> Result<String, String> {
    let adapter = ensure_adapter(&state).await?;
    let peripherals = adapter.peripherals().await.map_err(|e| e.to_string())?;
    let target = peripherals
        .into_iter()
        .find(|p| p.id().to_string() == id)
        .ok_or_else(|| format!("Peripheral {} not found", id))?;

    if !target.is_connected().await.unwrap_or(false) {
        target.connect().await.map_err(|e| e.to_string())?;
    }
    target.discover_services().await.map_err(|e| e.to_string())?;

    // ZMK Studio service / characteristic を探す
    let services = target.services();
    let svc = services
        .iter()
        .find(|s| s.uuid == ZMK_STUDIO_SERVICE_UUID)
        .ok_or_else(|| {
            "Selected device does not expose ZMK Studio service".to_string()
        })?;
    let _chrc = svc
        .characteristics
        .iter()
        .find(|c| c.uuid == ZMK_STUDIO_RPC_CHRC_UUID)
        .ok_or_else(|| "ZMK Studio RPC characteristic not found".to_string())?;

    let label = target
        .properties()
        .await
        .ok()
        .flatten()
        .and_then(|pp| pp.local_name)
        .unwrap_or_else(|| "Unknown".to_string());

    *state.peripheral.lock().await = Some(target);
    Ok(label)
}

pub async fn subscribe_notifications<F>(
    state: Arc<BleState>,
    on_data: F,
) -> Result<(), String>
where
    F: Fn(Vec<u8>) + Send + Sync + 'static,
{
    let guard = state.peripheral.lock().await;
    let p = guard.as_ref().ok_or("Not connected")?.clone();
    drop(guard);

    let chrc = p
        .characteristics()
        .into_iter()
        .find(|c| c.uuid == ZMK_STUDIO_RPC_CHRC_UUID)
        .ok_or("RPC characteristic not found")?;
    p.subscribe(&chrc).await.map_err(|e| e.to_string())?;
    let mut notifications = p.notifications().await.map_err(|e| e.to_string())?;

    let cb = Arc::new(on_data);
    let handle = tokio::spawn(async move {
        while let Some(n) = notifications.next().await {
            if n.uuid == ZMK_STUDIO_RPC_CHRC_UUID {
                cb(n.value);
            }
        }
    });

    *state.notifications_handle.lock().await = Some(handle);
    Ok(())
}

pub async fn write(state: Arc<BleState>, data: Vec<u8>) -> Result<(), String> {
    let guard = state.peripheral.lock().await;
    let p = guard.as_ref().ok_or("Not connected")?.clone();
    drop(guard);
    let chrc = p
        .characteristics()
        .into_iter()
        .find(|c| c.uuid == ZMK_STUDIO_RPC_CHRC_UUID)
        .ok_or("RPC characteristic not found")?;
    p.write(&chrc, &data, WriteType::WithoutResponse)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn disconnect(state: Arc<BleState>) -> Result<(), String> {
    if let Some(handle) = state.notifications_handle.lock().await.take() {
        handle.abort();
    }
    if let Some(p) = state.peripheral.lock().await.take() {
        p.disconnect().await.ok();
    }
    Ok(())
}
