◆══════════════════════════════════════◆

# << RELEASE RECOLLECTION >>

*記憶解放 — ZMK Firmware System Interface*

◆══════════════════════════════════════◆

> **[ SYSTEM ANNOUNCEMENT ]**
> 記憶は消えない。剣技は身体に刻まれている。
> トラックボールが軌跡を描いた瞬間、封じられた技が解放される。
> ── System Call, Enhance Armament. Release Recollection.

══════════════════════════════════════════════

## ◆ KEYMAP DISPLAY ── キーマップ図

> [ CARDINAL ] Push のたびに自動更新されます（`.github/workflows/draw-keymap.yml`）

![keymap](keymap.svg)

══════════════════════════════════════════════

## ◆ SYNTHESIS REGISTRY ── レイヤー構成

*カーディナルシステムにより展開されたシンセシス一覧。アクティブなシンセシスは STATUS CRYSTAL が示す。*

| SYNTHESIS | NAME | DESCRIPTION |
|---|---|---|
| [ Synthesis 00 ] | default | 通常入力 |
| [ Synthesis 01 ] | FUNCTION | ファンクションキー・カーソル |
| [ Synthesis 02 ] | ARROW_SIGN | 矢印・記号 |
| [ Synthesis 03 ] | NUM | テンキー |
| [ Synthesis 04 ] | MOUSE | マウス操作 |
| [ Synthesis 05 ] | SCROLL | スクロール |
| [ Synthesis 06 ] | Bluetooth | BT接続切替・bootloader |
| [ Synthesis 07 ] | GESTURE_E | ジェスチャー（E キー長押し）|
| [ Synthesis 08 ] | GESTURE_R | ジェスチャー（R キー長押し）|
| [ Synthesis 09 ] | GESTURE_S | ジェスチャー（S キー長押し）|
| [ Synthesis 10 ] | GESTURE_B | ジェスチャー（B キー長押し）|
| [ Synthesis 11 ] | GESTURE_T | ジェスチャー（T キー長押し）|
| [ Synthesis 12 ] | GESTURE_A | ジェスチャー（A キー長押し）|
| [ Synthesis 13 ] | GESTURE_D | ジェスチャー（D キー長押し）|
| [ Synthesis 14 ] | GESTURE_W | ジェスチャー（W キー長押し）|
| [ Synthesis 15 ] | SNIPE | スマートスネイプ（Tab ホールド or L2+L3 同時ホールドで起動。デフォルトと同一バインド、CPI 自動低減。クリック・キー入力で自動解除。**K ホールド中はトラックボールがスクロールホイールに変換される**）|
| [ Synthesis 16 ] | NUM_SMART | スマート数字入力（数字キーで自動維持） |

══════════════════════════════════════════════

## ◆ SWORD SKILLS ── ジェスチャーマッピング表

*剣技は身体の記憶に刻まれている。対応キーを**長押ししながらセンサーを動かした瞬間**、技が解放される。*
*上下左右 4 方向を認識。Shift 同時押しで上位技へと昇華する。*

──────────────────────────────────────────────

### ◆ SWORD SKILL : SHARP NAIL  [ KEY : E ] ── GESTURE_E（E キー長押し）― 編集剣技

*素早い連続斬撃。コピー・カット・ペーストを一息に刻み込む。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `Cmd+C` コピー | `Cmd+X` カット |
| ↓ 下 | `Cmd+V` ペースト | `Cmd+Shift+V` フォーマットなしペースト |
| ← 左 | `Cmd+Z` アンドゥ | `Cmd+P` |
| → 右 | `Cmd+Shift+Z` リドゥ | `Cmd+Return` |

──────────────────────────────────────────────

### ◆ SWORD SKILL : VORPAL STRIKE  [ KEY : R ] ── GESTURE_R（R キー長押し）― 選択剣技

*渾身の一撃でテキストを貫く。精密な範囲指定を一刀両断する。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `Cmd+A` 全選択 | `Cmd+Shift+↑` |
| ↓ 下 | `Cmd+X` カット | `Cmd+Shift+↓` |
| ← 左 | `Alt+Shift+←` 単語選択（左） | `Cmd+Shift+←` 行頭まで選択 |
| → 右 | `Alt+Shift+→` 単語選択（右） | `Cmd+Shift+→` 行末まで選択 |

──────────────────────────────────────────────

### ◆ SWORD SKILL : THE ECLIPSE  [ KEY : S ] ── GESTURE_S（S キー長押し）― 捕捉剣技

*全てを覆い封じる最終奥義。画面そのものを闇に刻み込む。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `Cmd+Shift+3` 全画面スクショ（ファイル保存） | `Ctrl+Cmd+Shift+3` 全画面（クリップボード） |
| ↓ 下 | `Escape` | `Escape` |
| ← 左 | `Cmd+Shift+4` 範囲選択スクショ | `Ctrl+Cmd+Shift+4` 範囲選択（クリップボード） |
| → 右 | `Cmd+Shift+5` スクショメニュー | `Cmd+Shift+5` |

──────────────────────────────────────────────

### ◆ SWORD SKILL : HOWLING OCTAVE  [ KEY : B ] ── GESTURE_B（B キー長押し）― 音響剣技

*8連の咆哮が空間を震わせる。輝度と音量を意のままに操る。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | 輝度上げる | `F13` |
| ↓ 下 | 輝度下げる | ミュート |
| ← 左 | 音量下げる | `F19` |
| → 右 | 音量上げる | `F18` |

──────────────────────────────────────────────

### ◆ SWORD SKILL : SONIC LEAP  [ KEY : T ] ── GESTURE_T（T キー長押し）― 航路剣技

*音速で次の場所へ跳躍する。タブという扉を瞬時に開閉する。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `Cmd+T` 新規タブ | `Cmd+R` リロード |
| ↓ 下 | `Cmd+W` タブを閉じる | `Cmd+F` 検索 |
| ← 左 | `Ctrl+Shift+Tab` 前のタブ | `Cmd+-` ズームアウト |
| → 右 | `Ctrl+Tab` 次のタブ | `Cmd++` ズームイン |

──────────────────────────────────────────────

### ◆ SWORD SKILL : VERTICAL SQUARE  [ KEY : A ] ── GESTURE_A（A キー長押し）― 探索剣技

*四方を刻む連続剣技。アプリの格子を縦横に切り裂き、目標へ飛ぶ。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `Ctrl+B` | `Ctrl+Alt+Cmd+1` |
| ↓ 下 | `Cmd+Space` Spotlight | `Ctrl+Alt+Cmd+4` |
| ← 左 | `Cmd+Shift+Tab` アプリ切替（前） | `Ctrl+Alt+Cmd+3` |
| → 右 | `Cmd+Tab` アプリ切替（次） | `Ctrl+Alt+Cmd+2` |

──────────────────────────────────────────────

### ◆ SWORD SKILL : STARBURST STREAM  [ KEY : D ] ── GESTURE_D（D キー長押し）― 空間剣技

*16連の星屑が全方位を薙ぎ払う。Mission Control で全シンセシスを一望する。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `Ctrl+↑` Mission Control | `F12` |
| ↓ 下 | `Cmd+H` ウィンドウを隠す | `Ctrl+↓` |
| ← 左 | `F14` | `F11` |
| → 右 | `F15` | `F20` |

──────────────────────────────────────────────

### ◆ SWORD SKILL : HORIZONTAL  [ KEY : W ] ── GESTURE_W（W キー長押し）― 踏破剣技

*水平に薙ぐ一閃。左右に刻まれた履歴の軌跡を自在に辿る。*

| 方向 | 通常 | Shift 同時押し |
|---|---|---|
| ↑ 上 | `F3` ウィンドウを最大化　| `F17` |
| ↓ 下 | `Cmd+M` ウィンドウを最小化 | `F11` |
| ← 左 | `Cmd+[` ブラウザ戻る | `Cmd+Q` アプリ終了 |
| → 右 | `Cmd+]` ブラウザ進む | `Cmd+W` タブ/ウィンドウを閉じる |

══════════════════════════════════════════════

## ◆ MOVEMENT PARAMETERS ── トラックボール → キー変換（アロープロファイル）

*特定のシンセシスでは、トラックボールの動きがキー入力へと変換される。剣技とは独立した力で、**動かし続ける限り連続入力**される。*

### ◆ PRIMARY FORMATION ── 通常プロファイル（arrows-profiles）

| SYNTHESIS | 上 | 下 | 左 | 右 | one_shot | 備考 |
|---|---|---|---|---|---|---|
| 2 ARROW_SIGN | 選択↑ | 選択↓ | 選択← | 選択→ | なし | 自動リピートなし |
| 3 NUM | `↑` | `↓` | `←` | `→` | なし | 加速あり |
| 6 Bluetooth | `強制終了(Cmd+Opt+Esc)` | `画面ロック(Ctrl+Cmd+Q)` | `LANG2(英数)` | `LANG1(かな)` | あり | 斜め無効・余り有効 |

### ◆ ALT FORMATION ── Shift 同時押し or arrows_alt 起動時（arrows-alt-profiles）

| SYNTHESIS | 上 | 下 | 左 | 右 | one_shot |
|---|---|---|---|---|---|
| 15 SNIPE | `SCROLL_UP` | `SCROLL_DOWN` | `SCROLL_LEFT` | `SCROLL_RIGHT` | なし |
| 2 ARROW_SIGN | `Cmd+A` | `Cmd+V` | `Cmd+X` | `Cmd+C` | あり |
| 3 NUM | `Undo` | `Redo` | `BS` | `Del` | あり |
| 6 Bluetooth | 再生/停止(`C_PP`) | 停止(`C_STOP`) | 前のトラック(`C_PREV`) | 次のトラック(`C_NEXT`) | なし |

> **[ SYSTEM ]** L15 はキーバインドではなく `&ht_arrows_alt 15 K`（K ホールド）で起動。ドライバ拡張コード `2000-2003` が `input_report_rel(REL_WHEEL/REL_HWHEEL)` を直接発行するためホスト側はマウスホイールとして認識する。

> **[ SYSTEM ]** **one_shot** — 有効時、センサーの動きに対してキーが 1 度だけ送出される。
> 押しっぱなし状態にはならない。連続入力が不要な操作に適用される。

### ◆ ACCELERATION SYSTEM ── 加速設定（Synthesis 03）

- 閾値を超えると最大 1/4 速度まで加速
- 初回入力から 250ms 後に連続入力開始、100ms 間隔でリピート

══════════════════════════════════════════════

## ◆ STATUS CRYSTAL REGISTRY ── LED カラー（シンセシスインジケーター）

*アクティブなシンセシスに応じてクリスタルの発光色が変化する。現在位置をフラクトライトに知らせるインジケーター。*

| SYNTHESIS | COLOR |
|---|---|
| 0 default | 0 |
| 1 FUNCTION | 1 |
| 2 ARROW_SIGN | 2 |
| 3 NUM | 3 |
| 4 MOUSE | 4 |
| 5 SCROLL | 5 |
| 6 Bluetooth | 6 |
| 7 GESTURE_E | 3 |
| 8 GESTURE_R | 4 |
| 9 GESTURE_S | 5 |
| 10 GESTURE_B | 0 |
| 11 GESTURE_T | 6 |
| 12 GESTURE_A | 7 |
| 13 GESTURE_D | 1 |
| 14 GESTURE_W | 2 |
| 15 SNIPE | 7 |
| 16 NUM_SMART | 3 |

══════════════════════════════════════════════

## ◆ EQUIPPED MODULES ── 依存モジュール

*このシステムを支える仲間たち。一つでも欠ければ、剣技は発動しない。*

| MODULE | REPOSITORY | DESCRIPTION |
|---|---|---|
| zmk | zmkfirmware/zmk | ZMK 本体 |
| zmk-pmw3610-driver | eincode0/zmk-pmw3610-driver | PMW3610 トラックボールドライバー |
| zmk-listeners | ssbb/zmk-listeners | レイヤーリスナー |
| zmk-mouse-gesture | kot149/zmk-mouse-gesture | マウスジェスチャー認識 |
| zmk-scroll-snap | kot149/zmk-scroll-snap | スクロール軸スナップ（X/Y軸整列） |
| zmk-rgbled-widget | caksoylar/zmk-rgbled-widget | RGB LED インジケーター |
| zmk-pointing-acceleration-alpha | nuovotaka/zmk-pointing-acceleration-alpha | ポインタ加速度 |
| zmk-behavior-insomnia | badjeff/zmk-behavior-insomnia | BLE 接続中スリープ防止 |
| zmk-tri-state | urob/zmk-tri-state | アプリ切替スワッパー |
| zmk-auto-layer | urob/zmk-auto-layer | Smart Num（数字入力で自動レイヤー維持） |
| zmk-helpers | urob/zmk-helpers | キーマップ記述ヘルパーマクロ |

══════════════════════════════════════════════

## ◆ CHARACTER PARAMETERS ── 設定値サマリー

*フラクトライトの稼働を支える各種パラメータ。数値一つが安定と崩壊を分ける。*

### NERVE LINK STABILITY ── BLE・接続安定性

*STL とホストを繋ぐ生命線。接続が切れれば、フラクトライトは消滅する。*

| 設定 | 値 | 対象 | 効果 |
|---|---|---|---|
| Experimental Conn | R側(Elucidator)のみ有効、L側無効 | R側（Central） | Central側でホスト向けBLE接続安定化のため有効化 |
| NFCT_PINS_AS_GPIOS | 有効 | R・L両側 | NFC無線とBLEの干渉防止（安定版2つともあり） |
| BT_GAP_AUTO_UPDATE_CONN_PARAMS | 有効 | R・L両側 | 接続後に自動パラメータ再交渉（kabutokoma準拠） |
| BT_CONN_PARAM_UPDATE_TIMEOUT | 1000ms | R・L両側 | 接続から1秒後にパラメータ更新要求 |
| TX Power | +8dBm | R・L両側 | 最大送信出力 |
| Split BLE Latency | 0 | R側（Central） | デフォルト 30 から 0 へ変更（Left 側キー入力の遅延パケット許容をゼロに） |
| Split BLE Timeout | 1000 | R・L両側 | スプリット接続タイムアウト（両側共通） |
| BT Max Conn | 5 | R側（Central） | 4プロファイル + 1スプリット接続（プロファイル数+1が正しい設定） |
| BT Max Paired | 5 | R側（Central） | プロファイル切替用（Mac/iPhone等） |
| BT_PERIPHERAL_PREF_MIN_INT | 6 (7.5ms) | R側 | 接続インターバル下限。前回MAX_INT=12固定は削除済み→今回は範囲指定で再試験 |
| BT_PERIPHERAL_PREF_MAX_INT | 6 (7.5ms) | R・L両側 | 接続インターバル上限（L側もR側と同期） |
| Insomnia pingInterval | 3秒 | R・L両側 | keepaliveを高頻度化（L側にも追加） |

### MOTION SENSOR CONFIG ── トラックボールセンサー（Elucidator.conf）

*センサーの挙動を制御するパラメータ。省電力モードへの移行速度を調整する。*

| 設定 | 値 | 効果 |
|---|---|---|
| PMW3610 REST移行時間 | 3000ms | RUN モード維持を延長し、短時間アイドル復帰の遅延を抑制 |
| PMW3610 REST1 サンプル間隔 | 10ms | REST 中のサンプリング間隔を半減し、復帰時の応答を改善 |
| PMW3610 ポーリングレート | 125Hz (POLLING_RATE_125) | 起動遅延を削除しポーリングレート固定モードに変更 |
| PMW3610 force-awake | 有効 | スリープ移行を抑制し、起動遅延ゼロを維持 |
| PMW3610 4ms モード | **無効**（削除済み） | BLE 7.5ms インターバルとのミスマッチによるポインタジャンプを防止 |
| PMW3610 CPI | 2200 | 通常カーソル CPI（`pointer_accel.sensor-dpi` も同値）。SNIPE 中はドライバが自動低減 |
| PMW3610 cpi-layers | `<4 3200>` | L4 MOUSE アクティブ時はセンサー CPI を 3200 に動的切替（〈Resolution Shift〉) |
| arrows-alt L15 tick | 80ms | K ホールドスクロールの精密度。値が大きいほど 1 ノッチが大きい動きを要求 |
| L5 SCROLL スケーラー | `1/2`（半速） | `zip_xy_to_scroll_mapper` 後段にスケーラーを噛ませ、ホイール出力を 1/2 倍に絞り精密スクロール化 |

### THREAD STACK ── スレッドスタック（クラッシュ対策）

*システムの安定を支える根幹。スタックが尽きればフラクトライトは瞬く間に崩壊する。*

| 設定 | 値 | 対象 | 備考 |
|---|---|---|---|
| EC11スレッド | 4096 bytes | Dark_Repulser | |

══════════════════════════════════════════════

## ◆ INITIALIZATION PROTOCOL ── ビルド

*STL 起動。カーディナルシステムが世界を再生成する。*

> **[ CARDINAL ]** GitHub Actions により自動ビルド（`.github/workflows/build.yml`）。
> Push を契機に自動実行される。Artifacts から `.uf2` ファイルをダウンロードし、デバイスへ書き込むことで起動が完了する。

══════════════════════════════════════════════

## ◆ SYSTEM LOG ── 更新履歴

*カーディナルシステムの変更軌跡。刻まれた決定と解放された力の記録。*

| DATE | ENTRY |
|---|---|
| 2026-05-01 | コンボ再構築：scrl_up/scrl_down → window_close/window_min、新規 app_quit（P+マイナス）追加 |
