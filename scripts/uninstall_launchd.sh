#!/bin/bash
# 〈Cardinal Conduit Anchor 解除〉— Cardinal Editor 常駐サービスを停止＋削除
# Usage: bash scripts/uninstall_launchd.sh

set -e

PLIST_NAME="com.cardinal-sys.cardinal-editor"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

if [ ! -f "$PLIST_PATH" ]; then
  echo "Cardinal Editor 常駐サービスはインストールされていません。"
  exit 0
fi

if launchctl list | grep -q "$PLIST_NAME"; then
  echo "[unload] サービスを停止..."
  launchctl unload "$PLIST_PATH" || true
fi

rm -f "$PLIST_PATH"

echo "✨ Cardinal Editor 常駐解除完了"
