#!/usr/bin/env bash
# 把下载站同步到码云（Gitee）镜像仓库
# 用法: bash push-gitee.sh
# 前置: 码云上已有空仓库 gitee.com/CHUYONGLIN/fcbox-download（不要勾选初始化 README）
set -e

cd "$(dirname "$0")"

REPO="https://gitee.com/CHUYONGLIN/fcbox-download.git"
git remote remove gitee >/dev/null 2>&1 || true
git remote add gitee "$REPO"

echo "推送 main -> 码云 ..."
GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git push gitee main
echo "推送标签 ..."
git push gitee --tags 2>/dev/null || true

echo
echo "码云仓库：https://gitee.com/CHUYONGLIN/fcbox-download"
git ls-remote --heads gitee 2>/dev/null | sed 's/^/  /'
