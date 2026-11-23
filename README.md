# 丰巢软件下载站

丰巢智能柜各机型（标准柜 / D 型柜 / 速递易 / 电商柜等）的软件、固件安装包聚合下载页。页面静态渲染，仅下载计数与问题反馈走 WorkBuddy 云服务。

## 目录

```
index.html            页面入口
data.js               构建产物：页面运行时读取的数据
data/snapshot.json    数据快照（含下载链接、版本、适配机型）
data/raw_gui.json     源数据原始记录
scripts/sync_data.py  从源文档同步数据并生成 data.js
assets/styles.css     样式
assets/app.js         交互逻辑（场景筛选、搜索、分组折叠、计数展示、反馈弹窗）
assets/cloud.js       云服务接入层（下载计数 / 问题反馈，SDK 惰性加载）
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

## 云服务

应用 `wbapp_HqmxlV9GfpKwMRkO3EIUKs` 已开通 WorkBuddy 云服务，用到数据库一个模块：

| 表 / 函数 | 用途 | 权限 |
|---|---|---|
| `download_hits` | 各安装包累计下载次数 | 匿名可读（`SELECT USING true`），客户端不可直接写 |
| `bump_download(key, name, scene)` | 原子累加一次下载，返回最新次数 | `SECURITY DEFINER`，仅 `anon` / `authenticated` 可执行 |
| `feedback` | 用户提交的问题反馈 | 匿名可插入（长度校验），**不可读取** |

- 客户端初始化只用 `publicConfig` 里的 `endpoint` / `publishableKey`，密钥不下发。
- SDK 不在 HTML 里同步引入，由 `cloud.js` 首次用到时异步加载（6 秒超时）；加载失败整页照常可用，只是不显示次数、反馈会提示未连通。
- 云调用只允许在发布域名 `https://fcbox-apk-center.app.workbuddy.host` 下工作——服务端做 Origin 精确匹配，本地 `127.0.0.1` 预览或 GitHub Pages 镜像上计数/反馈会失效（属预期）。
- 数据查看：`workbuddy_cloudservice_db_exec_sql`（`SELECT * FROM feedback ORDER BY id DESC`）。

## 说明

- 页面按「场景」筛选项 + 关键词搜索定位到对应柜型的安装包列表
- 每个大类默认只展示前 3 个版本，其余折叠，可展开
- 安装包本身托管在原始分发地址，本仓库只存页面与数据
