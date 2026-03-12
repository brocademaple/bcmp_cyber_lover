#!/usr/bin/env bash
# Oh My Bash 安装脚本 - 在 Git Bash 或 WSL 中运行此文件
# 用法: bash install-oh-my-bash.sh

set -e
echo "正在安装 Oh My Bash..."
bash -c "$(curl -fsSL https://raw.githubusercontent.com/ohmybash/oh-my-bash/master/tools/install.sh)" --unattended
echo "安装完成。请关闭并重新打开终端，或执行: source ~/.bashrc"
