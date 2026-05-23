#!/bin/bash
# 〈Cardinal Conduit Anchor〉— Cardinal Editor server を macOS launchd に常駐化
# Usage: bash scripts/install_launchd.sh
#
# 起動後、http://localhost:3001 でいつでも Cardinal Editor が利用可能。
# 停止/アンインストールは scripts/uninstall_launchd.sh を実行。

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_NAME="com.administ-rator.cardinal-editor"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/${PLIST_NAME}.plist"
LOG_DIR="$HOME/Library/Logs/cardinal-editor"

mkdir -p "$PLIST_DIR" "$LOG_DIR"

# 既存があれば一旦アンロード
if launchctl list | grep -q "$PLIST_NAME"; then
  echo "[unload] 既存の Cardinal Editor サービスを停止..."
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
fi

cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>${REPO_ROOT}/scripts/cardinal_editor_server.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${REPO_ROOT}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/server.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/server.err</string>
</dict>
</plist>
EOF

launchctl load "$PLIST_PATH"

echo ""
echo "✨ Cardinal Editor 常駐化完了"
echo ""
echo "   URL : http://localhost:3001"
echo "   plist: $PLIST_PATH"
echo "   log : $LOG_DIR/server.log"
echo ""
echo "   停止/解除は scripts/uninstall_launchd.sh を実行してください。"
