# 丰巢软件下载站

丰巢智能柜各机型（标准柜 / D 型柜 / 速递易 / 电商柜等）的软件、固件安装包聚合下载页。页面静态渲染，仅下载计数与问题反馈走 WorkBuddy 云服务。

## 目录

```
index.html            页面入口
build.json            构建号（页面比对它判断是否被缓存了旧副本）
data.js               构建产物：页面运行时读取的数据
data/snapshot.json    数据快照（含下载链接、版本、适配机型）
data/raw_gui.json     源数据原始记录
scripts/sync_data.py  从源文档同步数据并生成 data.js
scripts/stamp.py      发版前刷新 build.json 与 index.html 的 ?v= 号
assets/styles.css     样式
assets/app.js         交互逻辑（场景筛选、搜索、分组折叠、计数展示、反馈弹窗）
assets/auth.js        资产烧录授权（HMAC-SHA1 动态密码，纯本地计算）
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

## 发版（改完任何静态文件都跑一次）

```bash
python scripts/stamp.py     # 刷新 build.json + index.html 里所有 ?v= 号
```

微信内置浏览器（X5 / WKWebView）会把整页 HTML 缓存很久，托管又不给加 `Cache-Control`，
所以 `index.html` 末尾有一段脚本：拿到 `build.json` 后和 localStorage 里上次的构建号对比，
不一致就带 `_b=<构建号>` 参数重载一次，强制回源。**因此每次改完文件必须跑 `stamp.py`**，
否则老访客会一直看到旧页面。

仍被旧缓存卡住时（多见于改动前的存量副本），用带参数的地址打开一次即可：
`https://fcbox-apk-center.app.workbuddy.host/?sharecode=53XWPMSNJ2&_b=1`，之后就会自愈。

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

## App 客户端（固定下载地址）

独立安卓 App「丰巢软件清单」安装包放在 `app/`，**文件名固定不变**，发新版本只覆盖内容，链接永久有效：

| 用途 | 地址 |
|---|---|
| 下载页（推荐分享） | `/app/index.html` |
| 直链 | `/app/fcbox-catalog.apk` |
| 版本信息 | `/app/version.json` |

- 线上：`https://fcbox-apk-center.app.workbuddy.host/app/index.html?sharecode=53XWPMSNJ2`
- 镜像：`https://chuyl666.github.io/fcbox-download/app/`

### 下载页「一键更新」

`app/index.html` 不写死版本号，打开时实时读 `version.json`，据此算出按钮文案和下载地址：

| 访问情况 | 按钮 |
|---|---|
| 首次访问 | 下载 APK vX.Y.Z |
| 本机上次下载过旧版（localStorage），或链接带 `?ver=1.9.46` | **一键更新到 vX.Y.Z**（呼吸光提示） |
| 本机已经下过当前版 | 已是最新版，重新下载 |

下载地址拼成 `fcbox-catalog.apk?v=<版本>&t=<时间戳>`，保存文件名带版本号
（`运维通_v1.9.47.apk`）。固定文件名反复覆盖会被浏览器/CDN 缓存住，加版本参数才能保证
「点一次拿到的一定是当前这版」。**因此 App 发新版后本页无需改动、也无需重新发版**，
`version.json` 一更新，页面自己就是最新的。

App 内跳转到本页时带上 `?ver=<当前版本>`，页面即可直接显示「一键更新」。

发版流程（在 `fcbox-catalog-app` 目录）：

```bash
tools/sync.sh            # 重新生成内置清单 + 自动 +1 版本号 + 编译 + 覆盖 app/ + 推送
```

**站点数据更新后必须跑这一步**，否则 App 里那份离线清单还是旧的。详见该目录 README 的
「站点更新后同步发版」。`sync.sh` 只推 GitHub；要同步 WorkBuddy 域名，需在对话里重新发布一次本站。

单步命令（调试用）：

```bash
tools/build.sh 1.9.1     # 只编译签名
tools/publish.sh 1.9.1   # 只覆盖 app/ 下的安装包 + 生成 version.json + 推送
```

## 说明

- 页面按「场景」筛选项 + 关键词搜索定位到对应柜型的安装包列表
- 每个大类默认只展示前 3 个版本，其余折叠，可展开
- 安装包本身托管在原始分发地址，本仓库只存页面与数据
