#!/bin/zsh
set -e
cd /Users/eee/Desktop/code/bcmp_cyber_lover
echo 'iPhone 与 Mac 请连接同一个 Wi-Fi；用 iPhone 相机扫描下面的二维码。'
echo 'Expo Go 请登录 brocademaple。保持这个窗口打开，按 Ctrl+C 停止。'
exec npx expo start --go --lan --port 8081
