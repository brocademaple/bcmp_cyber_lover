#!/bin/zsh
set -e
cd /Users/eee/Desktop/code/bcmp_cyber_lover
echo '正在构建当前鹿芽版本（首次需要稍等）…'
node scripts/build-luya-preview.mjs
echo '预览：http://127.0.0.1:4177 · 在设置里连接模型，或先查看共同房间。'
if curl --silent --fail http://127.0.0.1:4177/metadata.json >/dev/null; then
  open -a Comet http://127.0.0.1:4177
  exit 0
fi
python3 -m http.server 4177 --bind 127.0.0.1 --directory output/luya-preview &
LUYA_SERVER_PID=$!
trap 'kill "$LUYA_SERVER_PID" 2>/dev/null || true' EXIT INT TERM
open -a Comet http://127.0.0.1:4177
wait "$LUYA_SERVER_PID"
