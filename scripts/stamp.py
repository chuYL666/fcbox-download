"""发版前跑一次：刷新 build.json 与 index.html 里的 ?v= 号。

微信内置浏览器会把整页 HTML 缓存很久，页面里有一段脚本会对比 build.json，
发现不一致就带 _b= 参数重载一次（相当于强制回源），所以每次改完静态文件、
发布之前执行本脚本，别人再打开就不会看到旧页面。

用法： python scripts/stamp.py            # 用当前时间做构建号
       python scripts/stamp.py 20261125160000
"""
import io
import json
import os
import re
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, 'index.html')


def main():
    stamp = sys.argv[1] if len(sys.argv) > 1 else time.strftime('%Y%m%d%H%M%S')

    with io.open(IDX, encoding='utf-8') as f:
        html = f.read()

    # 所有静态资源的缓存串统一换成本次构建号
    html, n = re.subn(r'\?v=\d{14}', '?v=' + stamp, html)
    with io.open(IDX, 'w', encoding='utf-8', newline='') as f:
        f.write(html)

    with io.open(os.path.join(ROOT, 'build.json'), 'w', encoding='utf-8', newline='') as f:
        f.write(json.dumps({'build': stamp, 'time': time.strftime('%Y-%m-%d %H:%M:%S')},
                           ensure_ascii=False) + '\n')

    print('build=%s, 替换 %d 处资源版本号' % (stamp, n))


if __name__ == '__main__':
    main()
