#!/bin/bash
# 厚生労働省モニタリング cron 実行スクリプト

set -euo pipefail

# このスクリプトのディレクトリを基準にする
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ANTHROPIC_API_KEY が未設定なら .env から読み込む
if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  if [ -f "$SCRIPT_DIR/.env" ]; then
    export ANTHROPIC_API_KEY="$(grep '^ANTHROPIC_API_KEY=' "$SCRIPT_DIR/.env" | cut -d'=' -f2-)"
  fi
fi

if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
  echo "ERROR: ANTHROPIC_API_KEY が設定されていません" >&2
  exit 1
fi

# スクリプト実行
node main.js

# seen.json を git へ push（既読状態を保持）
git add data/seen.json
if ! git diff --cached --quiet; then
  git commit -m "Update seen.json [skip ci]"
  git push origin master
fi
