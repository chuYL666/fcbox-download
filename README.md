# 丰巢软件下载站

丰巢智能柜各机型（标准柜 / D 型柜 / 速递易 / 电商柜等）的软件、固件安装包聚合下载页，纯静态实现，无后端依赖。

## 目录

```
index.html            页面入口
data.js               构建产物：页面运行时读取的数据
data/snapshot.json    数据快照（含下载链接、版本、适配机型）
data/raw_gui.json     源数据原始记录
scripts/sync_data.py  从源文档同步数据并生成 data.js
assets/styles.css     样式
assets/app.js         交互逻辑（场景筛选、搜索、分组折叠）
```

## 本地预览

```bash
python -m http.server 4185 --bind 127.0.0.1
# 打开 http://127.0.0.1:4185/index.html
```

## 更新数据

```bash
python scripts/sync_data.py
```

生成新的 `data.js` 后，记得同步更新 `index.html` 里 `data.js?v=` 的版本号，避免浏览器用缓存。

## 推送

```bash
git push origin main
```

远端为 `git@github.com:chuYL666/fcbox-download.git`，走 SSH 部署密钥 `~/.ssh/fcbox_gh`（该机器上 https 直连 github.com 被代理拦截，只能用 SSH）。

Pages 分支源为 `main`，根目录发布，推上去后约半分钟自动构建。

## 说明

- 页面按「场景」筛选项 + 关键词搜索定位到对应柜型的安装包列表
- 每个大类默认只展示前 3 个版本，其余折叠，可展开
- 安装包本身托管在原始分发地址，本仓库只存页面与数据
