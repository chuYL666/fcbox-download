#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从企业微信文档《丰巢智能柜软件应用清单【定期更新】》同步 apk 清单，生成站点数据文件。

用法:
    python scripts/sync_data.py            # 同步并写入 data.js
    python scripts/sync_data.py --check    # 只检查是否有变化，不写文件（有变化退出码 10）
    python scripts/sync_data.py --local    # 不联网，用本地缓存 raw_gui.json 重新解析

退出码: 0 成功且无变化 / 10 成功且有变化 / 1 失败
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "data", "raw_gui.json")
DATA_JS = os.path.join(ROOT, "data.js")
SNAPSHOT = os.path.join(ROOT, "data", "snapshot.json")

DOC_URL = ("https://doc.weixin.qq.com/sheet/e3_AHwArwYFAOsVLw4NnnsQJCDCwvY6g"
           "?scode=AKIAUwfUAA0BXeOa0O")
DOC_NAME = "丰巢智能柜软件应用清单【定期更新】"
DOC_ID = "e3_AHwArwYFAOsVLw4NnnsQJCDCwvY6g"
SHEET = "柜机应用"
RANGE = "A1:M20"
TZ = timezone(timedelta(hours=8))

# 源文档里没有、但现场需要用到的手工维护条目（每次同步都会保留）
MANUAL_EXTRAS = [
    {
        "label": "ES 文件浏览器",
        "file": "EsFileBrowser.apk",
        "url": ("https://fchibox-1251779293.cos.ap-guangzhou.myqcloud.com"
                "/factory/EsFileBrowser.apk"),
    },
]


def log(msg):
    print(msg, flush=True)


def wecom_bin():
    """定位 wecom-cli 可执行文件（Windows 上是 .cmd 包装器）。"""
    hit = shutil.which("wecom-cli")
    if hit:
        return hit
    home = os.path.expanduser("~")
    cand = os.path.join(home, ".workbuddy", "binaries", "node",
                        "cli-connector-packages", "wecom-cli")
    for suffix in ("", ".cmd", ".exe"):
        if os.path.exists(cand + suffix):
            return cand + suffix
    return "wecom-cli"


def fetch_cells():
    """调用 wecom-cli 拉取表格单元格。"""
    cmd = [wecom_bin(), "sheet", "cells", "get",
           "--docid", DOC_ID,
           "--set", "sheet=%s" % SHEET,
           "--set", "range=%s" % RANGE]
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                          errors="replace", shell=False)
    if proc.returncode != 0:
        raise RuntimeError("wecom-cli 调用失败: %s" % (proc.stderr or proc.stdout)[:500])
    raw = proc.stdout.strip()
    start = raw.find("{")
    if start < 0:
        raise RuntimeError("wecom-cli 返回非 JSON: %s" % raw[:300])
    payload = json.loads(raw[start:])
    code = payload.get("errcode")
    if code not in (0, None):
        raise RuntimeError("文档接口错误 %s: %s" % (code, payload.get("errmsg")))
    if not payload.get("cells"):
        raise RuntimeError("文档返回空数据，可能权限或结构变化")
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    with open(CACHE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return payload


def cell_text(cell):
    if cell is None or cell == {} or cell == "":
        return ""
    if isinstance(cell, str):
        return cell.strip()
    if isinstance(cell, dict):
        segs = cell.get("rich_string")
        if segs:
            out = "".join(str(s.get("link_text") or s.get("value") or "") for s in segs)
            return out.strip()
        v = cell.get("value")
        return "" if v is None else str(v).strip()
    return str(cell).strip()


def cell_link(cell):
    if isinstance(cell, dict):
        for seg in cell.get("rich_string") or []:
            if seg.get("link"):
                return seg["link"].strip()
        if cell.get("link"):
            return str(cell["link"]).strip()
    return ""


def cell_links(cell):
    """返回单元格内全部 (链接前的说明文字, 链接) 片段。"""
    out = []
    if not isinstance(cell, dict):
        return out
    label_buf = ""
    for seg in cell.get("rich_string") or []:
        link = (seg.get("link") or "").strip()
        text = str(seg.get("link_text") or seg.get("value") or "").strip()
        if not link:
            label_buf = (label_buf + text).strip()
            continue
        hint = label_buf.rstrip("：: ").strip()
        if text and not text.lower().endswith(".apk") and not text.startswith("http"):
            hint = (hint + text).strip()
        out.append((hint, link))
        label_buf = ""
    return out


DITTO = {"\\", "/", "同上", "—", "-", "「", "〃"}


def is_ditto(txt):
    return txt in DITTO


VER_RE = re.compile(r"[_\-]v?(\d+(?:\.\d+){1,3})(?=[_\-.]|$)", re.I)


def parse_version(name):
    m = VER_RE.search(name or "")
    return m.group(1) if m else ""


def build(payload):
    cells = payload["cells"]
    width = max(len(r) for r in cells) if cells else 0

    def at(r, c):
        if r < len(cells) and c < len(cells[r]):
            return cells[r][c]
        return None

    # 场景列: D..M => 索引 3..12
    scen_cols = list(range(3, 13))
    group_of = {}
    for c in scen_cols:
        if 3 <= c <= 7:
            group_of[c] = "大网场景"
        elif 8 <= c <= 9:
            group_of[c] = "售卖场景"
        else:
            group_of[c] = "专用柜型"

    scenarios = []
    for c in scen_cols:
        name = cell_text(at(1, c)) or cell_text(at(0, c))
        if not name:
            continue
        scenarios.append({
            "id": "c%d" % (c + 1),
            "name": name,
            "group": group_of[c],
            "col": c + 1,
        })

    apps = []
    idx = 0
    for r in range(2, len(cells)):
        name = cell_text(at(r, 0))
        if not name:
            continue
        if name.startswith("大华") or name.startswith("海康"):
            continue
        desc = cell_text(at(r, 1))
        owner = cell_text(at(r, 2))
        pkgs = []
        last = None
        for c in scen_cols:
            raw_txt = cell_text(at(r, c))
            link = cell_link(at(r, c))
            if is_ditto(raw_txt) and not link:
                if last:
                    inherited = dict(last)
                    inherited["scenario"] = "c%d" % (c + 1)
                    inherited["inherited"] = True
                    pkgs.append(inherited)
                continue
            if not raw_txt and not link:
                continue
            item = {
                "scenario": "c%d" % (c + 1),
                "file": raw_txt,
                "url": link,
                "version": parse_version(raw_txt),
                "inherited": False,
            }
            pkgs.append(item)
            last = item
        idx += 1
        apps.append({
            "id": "a%d" % idx,
            "name": name,
            "desc": desc,
            "owner": owner,
            "packages": pkgs,
        })

    # 附带监控软件：表体之后、无应用名的说明行里的富文本链接
    extras = []
    for r in range(2, len(cells)):
        if cell_text(at(r, 0)) or cell_text(at(r, 1)) or cell_text(at(r, 2)):
            continue
        for c in range(3, min(width, 13)):
            for hint, link in cell_links(at(r, c)):
                if not link or ".apk" not in link.lower():
                    continue
                label = hint
                if not label:
                    label = "监控配套软件"
                extras.append({"label": label.rstrip("：:"),
                               "file": os.path.basename(link.split("?")[0]),
                               "url": link})

    # 去重
    seen, uniq = set(), []
    for e in extras:
        if e["url"] in seen:
            continue
        seen.add(e["url"])
        uniq.append(e)
    extras = uniq

    # 手工维护的补充工具，排在文档自带条目之后
    for item in MANUAL_EXTRAS:
        if item["url"] in seen:
            continue
        seen.add(item["url"])
        extras.append(dict(item))

    total = sum(len(a["packages"]) for a in apps)
    return {
        "source": {"name": DOC_NAME, "url": DOC_URL},
        "sheet": SHEET,
        "groups": ["大网场景", "售卖场景", "专用柜型"],
        "scenarios": scenarios,
        "apps": apps,
        "extras": extras,
        "stats": {"apps": len(apps), "scenarios": len(scenarios), "packages": total},
    }


def main():
    check = "--check" in sys.argv
    local = "--local" in sys.argv

    try:
        payload = None
        if not local:
            log("[1/3] 拉取企业微信文档 ...")
            payload = fetch_cells()
        if payload is None:
            if not os.path.exists(CACHE):
                raise RuntimeError("本地无缓存，需要联网同步")
            with open(CACHE, encoding="utf-8") as f:
                payload = json.load(f)
        data = build(payload)
    except Exception as exc:  # noqa: BLE001
        log("同步失败: %s" % exc)
        return 1

    body = json.dumps(data, ensure_ascii=False, sort_keys=True)
    digest = hashlib.sha1(body.encode("utf-8")).hexdigest()[:12]

    old_digest = ""
    if os.path.exists(SNAPSHOT):
        try:
            with open(SNAPSHOT, encoding="utf-8") as f:
                old_digest = json.load(f).get("digest", "")
        except Exception:  # noqa: BLE001
            old_digest = ""

    changed = digest != old_digest
    now = datetime.now(TZ).strftime("%Y-%m-%d %H:%M")
    data["updatedAt"] = now
    data["digest"] = digest

    log("[2/3] 解析完成: %d 类应用 / %d 个场景 / %d 个安装包 (digest=%s)"
        % (data["stats"]["apps"], data["stats"]["scenarios"],
           data["stats"]["packages"], digest))

    if check:
        log("[3/3] 检查模式: %s" % ("有变化" if changed else "无变化"))
        return 10 if changed else 0

    with open(SNAPSHOT, "w", encoding="utf-8") as f:
        json.dump({"digest": digest, "updatedAt": now,
                   "stats": data["stats"]}, f, ensure_ascii=False, indent=2)

    js = ("/* 由 scripts/sync_data.py 自动生成，请勿手工编辑 */\n"
          "window.FCBOXDATA = " +
          json.dumps(data, ensure_ascii=False, indent=2) + ";\n")
    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write(js)

    log("[3/3] 已写入 data.js: %s (%s)" % (DATA_JS, "内容有更新" if changed else "内容无变化"))
    return 10 if changed else 0


if __name__ == "__main__":
    sys.exit(main())
