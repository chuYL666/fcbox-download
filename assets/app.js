/* 丰巢智能柜 · 软件下载站 前端逻辑 */
(function () {
  'use strict';

  var DATA = window.FCBOXDATA;
  if (!DATA) {
    document.getElementById('grid').innerHTML =
      '<div class="empty-state"><b>数据未载入</b>未找到 data.js，请先运行 scripts/sync_data.py。</div>';
    return;
  }

  var COLLAPSE_AT = 3;   // 每张卡片默认只显示前 3 行，其余折叠

  /* 每个大类一套主题色：主色 / 浅底 / 描边 */
  var PALETTE = [
    { c: '#d81f15', c2: '#f97316', soft: '#ffecea', line: '#ffd2cc' }, // 丰巢应用 - 红
    { c: '#1f5fe0', c2: '#38bdf8', soft: '#e8f0ff', line: '#cbdffd' }, // 丰巢驱动 - 蓝
    { c: '#c97a00', c2: '#fbbf24', soft: '#fff3df', line: '#ffe1b0' }, // 测试工具 - 琥珀
    { c: '#6d28d9', c2: '#c084fc', soft: '#f0e9ff', line: '#ded0ff' }, // 升级插件 - 紫
    { c: '#0b8578', c2: '#34d399', soft: '#e3f8f3', line: '#c2ece3' }, // 磐石 - 青绿
    { c: '#0b8f4d', c2: '#84cc16', soft: '#e6f8ec', line: '#c6eed5' }, // 应用管家 - 绿
    { c: '#4038d6', c2: '#818cf8', soft: '#eeeaff', line: '#d8d3ff' }, // 桌面启动器 - 靛
    { c: '#c81e70', c2: '#fb7185', soft: '#ffe9f3', line: '#ffcfe3' }  // 监控 - 玫红
  ];

  /* 10 个场景各一套标签色：文字 / 浅底 / 描边 */
  var SCENE_PALETTE = {
    c4:  { t: '#c81e1e', bg: '#fdeaea', ln: '#f7d3d3' }, // 丰巢（智能I/II/III）
    c5:  { t: '#c2570a', bg: '#fdf1e5', ln: '#f8ddc5' }, // E栈
    c6:  { t: '#8f6c07', bg: '#faf3da', ln: '#eee0b3' }, // 速递易
    c7:  { t: '#0f766e', bg: '#e6f5f2', ln: '#c8e9e3' }, // 速递易D型柜
    c8:  { t: '#1d4ed8', bg: '#e9effd', ln: '#cfdcfb' }, // 站柜（智能柜5）
    c9:  { t: '#4338ca', bg: '#ecebfb', ln: '#d7d4f8' }, // 丰巢售卖
    c10: { t: '#7e22ce', bg: '#f4e9fc', ln: '#e5cff8' }, // 工厂售卖
    c11: { t: '#0b8f4d', bg: '#e6f7ed', ln: '#c8ecd8' }, // 存包柜
    c12: { t: '#be185d', bg: '#fce8f0', ln: '#f8cfe0' }, // 双面柜
    c13: { t: '#8a5a2b', bg: '#f7efe6', ln: '#ecdcc9' }  // 寄件盒
  };

  var FALLBACK_SCENE = { t: '#536579', bg: '#f1f4f9', ln: '#e2e8f1' };

  function sceneColor(id) {
    return (SCENE_PALETTE[id] || FALLBACK_SCENE).t;
  }

  function sceneStyle(id) {
    var p = SCENE_PALETTE[id] || FALLBACK_SCENE;
    return '--tag:' + p.t + ';--tag-bg:' + p.bg + ';--tag-line:' + p.ln + ';';
  }

  function accentStyle(i) {
    var p = PALETTE[i % PALETTE.length];
    return '--accent:' + p.c + ';--accent-2:' + p.c2 + ';--soft:' + p.soft +
      ';--accent-line:' + p.line + ';';
  }

  var state = {
    scene: 'all',
    q: '',
    chipsOpen: false            // 场景筛选默认收起，点「全部场景」展开
  };

  var els = {
    chips: document.getElementById('chips'),
    allChip: document.getElementById('allChip'),
    grid: document.getElementById('grid'),
    q: document.getElementById('q'),
    extras: document.getElementById('extras'),
    extrasGrid: document.getElementById('extrasGrid'),
    syncText: document.getElementById('syncText'),
    footSync: document.getElementById('footSync'),
    footSource: document.getElementById('footSource'),
    sceneNote: document.getElementById('sceneNote'),
    copySceneBtn: document.getElementById('copySceneBtn'),
    toast: document.getElementById('toast'),
    controls: document.getElementById('controls'),
    wxBar: document.getElementById('wxBar'),
    wxBarCopy: document.getElementById('wxBarCopy'),
    wxGuide: document.getElementById('wxGuide'),
    wxGuideFile: document.getElementById('wxGuideFile'),
    wxGuideCopy: document.getElementById('wxGuideCopy'),
    wxGuideClose: document.getElementById('wxGuideClose'),
    heroMeta: document.getElementById('heroMeta')
  };

  /* ------------------------------------------------------------ helpers */
  var ICONS = {
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"></rect><path d="M9 9h6v6H9z"></path></svg>',
    driver: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"></path></svg>',
    tool: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5a3.5 3.5 0 0 0 4.6 4.6L21 12l-9 9-2.9-2.9"></path><path d="M9 9 3 15l3 3 6-6"></path></svg>',
    plugin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v3M15 4v3"></path><rect x="6" y="7" width="12" height="7" rx="2"></rect><path d="M12 14v3a2 2 0 0 1-2 2H8"></path></svg>',
    iot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-4"></path><path d="M5 8.5 12 5l7 3.5-7 3.5z"></path><path d="M5 8.5v7L12 19l7-3.5v-7"></path></svg>',
    manager: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10"></path><path d="M8.5 9.5 12 13l3.5-3.5"></path><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"></path></svg>',
    desktop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"></rect><path d="M8 20h8M12 16v4"></path></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8.5h3l1.6-2h6.8L17 8.5h3v9.5H4z"></path><circle cx="12" cy="13" r="3"></circle></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v10"></path><path d="M8 10.5 12 14.5l4-4"></path><path d="M5 19h14"></path></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="10" height="10" rx="2"></rect><path d="M14.5 5.5A1.5 1.5 0 0 0 13 4H6a2 2 0 0 0-2 2v7a1.5 1.5 0 0 0 1.5 1.5"></path></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"></path></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function iconFor(name) {
    if (/驱动/.test(name)) return ICONS.driver;
    if (/工具|测试/.test(name)) return ICONS.tool;
    if (/插件|升级/.test(name)) return ICONS.plugin;
    if (/磐石|IOT|采集/i.test(name)) return ICONS.iot;
    if (/管家|下载/.test(name)) return ICONS.manager;
    if (/桌面/.test(name)) return ICONS.desktop;
    if (/监控/.test(name)) return ICONS.monitor;
    return ICONS.app;
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.classList.remove('show'); }, 1900);
  }

  function copyText(text, okMsg) {
    var settled = false;
    var ok = function () {
      if (settled) return;
      settled = true;
      toast(okMsg || '已复制');
    };
    var fail = function () {
      if (settled) return;
      settled = true;
      toast('复制失败，请长按选择链接');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      // 部分内置浏览器/WebView 里该 Promise 可能既不 resolve 也不 reject，加超时兜底
      var timer = setTimeout(function () {
        if (!settled) legacyCopy(text, ok, fail);
      }, 400);
      navigator.clipboard.writeText(text).then(function () {
        clearTimeout(timer);
        ok();
      }, function () {
        clearTimeout(timer);
        legacyCopy(text, ok, fail);
      });
    } else {
      legacyCopy(text, ok, fail);
    }
  }

  function legacyCopy(text, ok, fail) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var done = false;
    try { done = document.execCommand('copy'); } catch (e) { done = false; }
    document.body.removeChild(ta);
    done ? ok() : fail();
  }

  var sceneMap = {};
  DATA.scenarios.forEach(function (s) { sceneMap[s.id] = s; });

  /* 筛选 chip 用短名，避免长柜型名把筛选区撑成好几行 */
  var SHORT_NAME = {
    c4: '丰巢智能柜',
    c7: '速递易D型柜',
    c8: '站柜',
    c10: '工厂售卖'
  };

  function chipLabel(s) {
    return SHORT_NAME[s.id] || s.name;
  }

  function sceneName(id) {
    return sceneMap[id] ? sceneMap[id].name : id;
  }
  function sceneGroup(id) {
    return sceneMap[id] ? sceneMap[id].group : '';
  }

  function pkgKey(p) { return p.scenario + '|' + p.file + '|' + p.url; }

  /* --------------------------------------------------------------- stats */
  function countFor(sceneId) {
    var n = 0;
    DATA.apps.forEach(function (a) {
      a.packages.forEach(function (p) { if (p.scenario === sceneId) n++; });
    });
    return n;
  }

  var CARET_SVG = '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 9.5l6 6 6-6"></path></svg>';

  function renderChips() {
    var open = state.chipsOpen;

    /* 「全部场景」固定在搜索框右侧，兼作展开 / 收起开关 */
    els.allChip.innerHTML = '全部场景<span class="n">' + DATA.stats.packages + '</span>' + CARET_SVG;
    els.allChip.setAttribute('aria-pressed', String(state.scene === 'all'));
    els.allChip.setAttribute('aria-expanded', String(open));
    els.allChip.title = open ? '收起场景筛选' : '展开全部场景';

    var html = [];
    DATA.groups.forEach(function (g) {
      var list = DATA.scenarios.filter(function (s) { return s.group === g; });
      if (!list.length) return;
      html.push('<span class="chip-group-label">' + esc(g) + '</span>');
      list.forEach(function (s) {
        html.push('<button class="chip" data-scene="' + s.id + '" style="' + sceneStyle(s.id) +
          '" title="' + esc(s.name) + '" aria-pressed="' + (state.scene === s.id) + '">' +
          esc(chipLabel(s)) + '<span class="n">' + countFor(s.id) + '</span></button>');
      });
    });

    els.chips.innerHTML = html.join('');
    els.chips.classList.toggle('collapsed', !open);
  }


  /* ---------------------------------------------------------------- cards */
  function renderRow(p, hideScene, appName) {
    var g = sceneGroup(p.scenario);
    var ditto = p.inherited ? '<span class="ditto" title="原表标记为「同上」，与左侧场景同一安装包">承上</span>' : '';
    var noLink = !p.url;
    return '<div class="pkg' + (p.inherited ? ' inherited' : '') + (hideScene ? ' no-scene' : '') + '"' +
        ' data-hit-key="' + esc(p.scenario + '|' + p.file) + '"' +
        ' data-hit-name="' + esc((appName ? appName + ' · ' : '') + p.file) + '"' +
        ' data-hit-scene="' + esc(p.scenario) + '">' +
      (hideScene ? '' :
        '<span class="pkg-scene" data-group="' + esc(g) + '" style="' + sceneStyle(p.scenario) +
        '" title="' + esc(sceneName(p.scenario)) + '">' + esc(sceneName(p.scenario)) + '</span>') +
      '<span class="pkg-main">' +
        '<code class="pkg-file" title="' + esc(p.file) + '">' + esc(p.file) + ditto + '</code>' +
        '<span class="pkg-hits" hidden></span>' +
      '</span>' +
      '<span class="pkg-actions">' +
        (noLink
          ? '<span class="icon-btn" title="原表未填链接" style="cursor:default">—</span>'
          : '<a class="dl-btn" href="' + esc(p.url) + '" download target="_blank" rel="noopener" ' +
            'data-copy="' + esc(p.url) + '" data-file="' + esc(p.file) + '">' + ICONS.dl + '下载</a>' +
            '<button class="icon-btn js-copy" type="button" data-copy="' + esc(p.url) +
            '" title="复制下载链接" aria-label="复制链接">' + ICONS.copy + '</button>') +
      '</span>' +
    '</div>';
  }

  function matchApp(a, q) {
    if (!q) return true;
    var hay = [a.name, a.desc].join(' ').toLowerCase();
    if (hay.indexOf(q) >= 0) return true;
    return a.packages.some(function (p) {
      return (p.file || '').toLowerCase().indexOf(q) >= 0 ||
        sceneName(p.scenario).toLowerCase().indexOf(q) >= 0;
    });
  }

  function renderGrid() {
    var q = state.q.trim().toLowerCase();
    var cards = [];
    var totalShown = 0;

    DATA.apps.forEach(function (a, i) {
      if (!matchApp(a, q)) return;

      var pkgs = a.packages.slice();
      if (state.scene !== 'all') {
        pkgs = pkgs.filter(function (p) { return p.scenario === state.scene; });
      }
      if (q) {
        pkgs = pkgs.filter(function (p) {
          return (p.file || '').toLowerCase().indexOf(q) >= 0 ||
            sceneName(p.scenario).toLowerCase().indexOf(q) >= 0 ||
            [a.name, a.desc].join(' ').toLowerCase().indexOf(q) >= 0;
        });
      }
      totalShown += pkgs.length;

      var body;
      if (!pkgs.length) {
        body = '<div class="card-empty">该场景暂未提供此应用的安装包</div>';
      } else {
        var collapsed = pkgs.length > COLLAPSE_AT;
        var single = state.scene !== 'all';
        var rows = pkgs.map(function (p) { return renderRow(p, single, a.name); }).join('');
        body = '<div class="pkgs">' + rows + '</div>';
        if (collapsed) {
          body = '<div class="pkgs pkgs-fold" data-fold="1">' + rows + '</div>' +
            '<button class="more-btn" type="button" data-open="false">展开全部 ' + pkgs.length +
            ' 个版本' + ICONS.chevron + '</button>';
        }
      }

      cards.push(
        '<article class="card" data-app="' + a.id + '" style="' + accentStyle(i) + '">' +
          '<div class="card-head">' +
            '<span class="card-icon">' + iconFor(a.name) + '</span>' +
            '<div class="card-titles">' +
              '<h3 class="card-name">' + esc(a.name) + '</h3>' +
              '<p class="card-desc">' + esc(a.desc || '—') + '</p>' +
            '</div>' +
          '</div>' + body +
        '</article>'
      );
    });

    if (!cards.length) {
      els.grid.innerHTML = '<div class="empty-state"><b>没有匹配的安装包</b>' +
        '换个关键词，或切回「全部场景」再试。</div>';
      return;
    }
    els.grid.innerHTML = cards.join('');
    applyFold();
    paintHits();
  }

  function applyFold() {
    Array.prototype.forEach.call(els.grid.querySelectorAll('.pkgs-fold'), function (box) {
      if (box.dataset.open === '1') return;
      Array.prototype.forEach.call(box.children, function (row, i) {
        if (i >= COLLAPSE_AT) row.style.display = 'none';
      });
    });
  }

  /* -------------------------------------------------------------- extras */
  function renderExtras() {
    if (!DATA.extras || !DATA.extras.length) { els.extras.hidden = true; return; }
    els.extras.hidden = false;
    els.extrasGrid.innerHTML = DATA.extras.map(function (e, i) {
      var pal = [{ c: '#0891b2', c2: '#22d3ee', soft: '#eafaff', line: '#c9edf8' },
                 { c: '#b45309', c2: '#f59e0b', soft: '#fff8ea', line: '#ffe6c2' },
                 { c: '#6d28d9', c2: '#a78bfa', soft: '#f2ecff', line: '#ded1ff' }][i % 3];
      return '<div class="extra-card" style="--accent:' + pal.c + ';--soft:' + pal.soft +
        ';--accent-line:' + pal.line + '"' +
        ' data-hit-key="' + esc('extras|' + e.file) + '"' +
        ' data-hit-name="' + esc(e.label + ' · ' + e.file) + '"' +
        ' data-hit-scene="extras">' +
        '<span class="card-icon">' + ICONS.camera + '</span>' +
        '<div class="card-titles">' +
          '<div class="card-name">' + esc(e.label) + '</div>' +
          '<div class="card-desc">' + esc(e.file) + '</div>' +
        '</div>' +
        '<span class="extra-actions">' +
          '<span class="pkg-hits" hidden></span>' +
          '<a class="dl-btn" href="' + esc(e.url) + '" download target="_blank" rel="noopener" ' +
            'data-file="' + esc(e.file) + '" data-copy="' + esc(e.url) + '">' +
            ICONS.dl + '下载</a>' +
          '<button class="icon-btn js-copy" type="button" data-copy="' + esc(e.url) +
            '" title="复制下载链接" aria-label="复制下载链接">' + ICONS.copy + '</button>' +
        '</span>' +
      '</div>';
    }).join('');
  }

  /* ----------------------------------------------------------- scene note */
  function renderSceneNote() {
    if (state.scene === 'all') {
      els.sceneNote.hidden = true;
      els.copySceneBtn.hidden = true;
      return;
    }
    var s = sceneMap[state.scene];
    if (!s) { els.sceneNote.hidden = true; els.copySceneBtn.hidden = true; return; }
    var n = countFor(s.id);
    els.sceneNote.hidden = false;
    els.sceneNote.style.borderLeftColor = sceneColor(s.id);
    els.sceneNote.innerHTML = '当前场景 <b>' + esc(s.name) + '</b>' +
      '<span class="sep">|</span>' + esc(s.group) +
      '<span class="sep">|</span>共 ' + n + ' 个安装包';
    els.copySceneBtn.hidden = false;
  }

  /* -------------------------------------------------- 微信内置浏览器适配 */
  var IS_WX = /MicroMessenger|WeChat/i.test(navigator.userAgent) ||
    /[?&]wx=1/.test(location.search);
  var wxPending = '';

  function openWxGuide(url, file) {
    wxPending = url || location.href;
    if (els.wxGuideFile) {
      els.wxGuideFile.textContent = file ? file : '';
      els.wxGuideFile.hidden = !file;
    }
    els.wxGuide.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  }

  function closeWxGuide() {
    els.wxGuide.hidden = true;
    wxPending = '';
    document.documentElement.style.overflow = '';
  }

  function initWx() {
    if (!IS_WX) return;
    document.body.classList.add('in-wechat');
    els.wxBar.hidden = false;

    els.wxBarCopy.addEventListener('click', function () {
      copyText(location.href, '链接已复制，粘贴到浏览器打开');
    });

    /* 微信内点下载：拦下，改为引导用浏览器打开 */
    document.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('.dl-btn, a[download]') : null;
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (!href || href === '#') return;
      e.preventDefault();
      e.stopPropagation();
      var file = link.getAttribute('data-file') || '';
      if (!file) {
        var codeEl = link.closest('.pkg') ? link.closest('.pkg').querySelector('.pkg-file') : null;
        file = codeEl ? codeEl.textContent.replace('承上', '').trim() : '';
      }
      openWxGuide(href, file);
    }, true);

    els.wxGuideClose.addEventListener('click', closeWxGuide);
    els.wxGuide.addEventListener('click', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('data-close')) closeWxGuide();
    });
    els.wxGuideCopy.addEventListener('click', function () {
      copyText(wxPending || location.href, '下载链接已复制，可在浏览器中粘贴');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !els.wxGuide.hidden) closeWxGuide();
    });
  }

  /* ------------------------------------------- 云服务：下载计数 + 问题反馈 */
  var CLOUD = window.FCBCloud || null;
  var hitMap = {};
  var hitChip = document.getElementById('hitChip');
  var hitTotalEl = document.getElementById('hitTotal');
  var footHits = document.getElementById('footHits');

  function cloudDisabled() {
    return !CLOUD;
  }

  /* 把云端计数画到每一行（计数为 0 的行不显示，避免满屏 0） */
  function paintHits() {
    var total = 0;
    Object.keys(hitMap).forEach(function (k) { total += hitMap[k]; });

    Array.prototype.forEach.call(document.querySelectorAll('[data-hit-key]'), function (host) {
      var label = host.querySelector('.pkg-hits');
      if (!label) return;
      var n = hitMap[host.getAttribute('data-hit-key')] || 0;
      if (n > 0) {
        label.textContent = n + ' 次下载';
        label.title = '本站累计下载 ' + n + ' 次';
        label.hidden = false;
      } else {
        label.hidden = true;
      }
    });

    if (total > 0) {
      var num = total.toLocaleString('zh-CN');
      if (hitChip && hitTotalEl) {
        hitTotalEl.textContent = num + ' 次下载';
        hitChip.title = '本站累计下载次数（云端统计）';
        hitChip.hidden = false;
      }
      if (footHits) {
        footHits.textContent = '累计下载 ' + num + ' 次';
        footHits.hidden = false;
      }
    }
  }

  /* 点下载即记一次；失败静默，绝不影响下载本身 */
  function countDownload(host) {
    if (cloudDisabled() || !host) return;
    var key = host.getAttribute('data-hit-key');
    if (!key || host.dataset.counting === '1') return;
    host.dataset.counting = '1';
    CLOUD.bump(key, host.getAttribute('data-hit-name') || '',
      host.getAttribute('data-hit-scene') || '').then(function (n) {
      delete host.dataset.counting;
      hitMap[key] = (typeof n === 'number' && n > 0) ? n : (hitMap[key] || 0) + 1;
      paintHits();
    }, function () {
      delete host.dataset.counting;
    });
  }

  function loadHits() {
    if (cloudDisabled()) return;
    CLOUD.loadHits().then(function (map) {
      hitMap = map || {};
      paintHits();
    }, function () { /* 云不可用：不显示计数，页面照常 */ });
  }

  /* ------------------------------------------------------------ 反馈弹窗 */
  var fbEls = {
    modal: document.getElementById('fbModal'),
    types: document.getElementById('fbTypes'),
    pkg: document.getElementById('fbPkg'),
    msg: document.getElementById('fbMsg'),
    contact: document.getElementById('fbContact'),
    hint: document.getElementById('fbHint'),
    submit: document.getElementById('fbSubmit'),
    open: document.getElementById('reportBtn')
  };
  var fbType = '';

  function fbSetHint(text, ok) {
    fbEls.hint.textContent = text || '';
    fbEls.hint.classList.toggle('ok', !!ok);
  }

  function fbFillPkgs() {
    if (!fbEls.pkg || fbEls.pkg.dataset.filled === '1') return;
    var opts = [];
    DATA.apps.forEach(function (a) {
      a.packages.forEach(function (p) {
        opts.push('<option value="' + esc(p.scenario + '|' + p.file) + '">' +
          esc(a.name + ' · ' + sceneName(p.scenario) + ' · ' + p.file) + '</option>');
      });
    });
    fbEls.pkg.insertAdjacentHTML('beforeend', opts.join(''));
    fbEls.pkg.dataset.filled = '1';
  }

  function fbOpen() {
    fbFillPkgs();
    fbSetHint('');
    fbEls.submit.disabled = false;
    fbEls.modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  }

  function fbClose() {
    fbEls.modal.hidden = true;
    document.documentElement.style.overflow = '';
  }

  function fbSend() {
    var msg = (fbEls.msg.value || '').trim();
    if (!fbType) { fbSetHint('请先选择问题类型'); return; }
    if (fbType === '其他' && !msg) { fbSetHint('选「其他」时请补一句说明'); return; }
    if (cloudDisabled()) { fbSetHint('反馈服务当前未连通，请稍后重试'); return; }

    fbEls.submit.disabled = true;
    fbEls.submit.textContent = '提交中…';
    fbSetHint('');

    var pkgKey = fbEls.pkg.value || '';
    var opt = pkgKey ? fbEls.pkg.options[fbEls.pkg.selectedIndex] : null;

    CLOUD.report({
      pkgKey: pkgKey,
      pkgName: opt ? opt.textContent : '',
      scene: pkgKey ? pkgKey.split('|')[0] : '',
      issueType: fbType,
      message: msg,
      contact: (fbEls.contact.value || '').trim(),
      pageUrl: location.href
    }).then(function () {
      fbEls.submit.disabled = false;
      fbEls.submit.textContent = '提交反馈';
      fbType = '';
      Array.prototype.forEach.call(fbEls.types.querySelectorAll('.fb-type'), function (b) {
        b.setAttribute('aria-pressed', 'false');
      });
      fbEls.msg.value = '';
      fbEls.contact.value = '';
      fbEls.pkg.selectedIndex = 0;
      fbSetHint('已收到，感谢反馈！', true);
      setTimeout(fbClose, 900);
    }, function (err) {
      fbEls.submit.disabled = false;
      fbEls.submit.textContent = '提交反馈';
      var why = err && err.message;
      if (why === 'cloud-timeout') fbSetHint('网络超时，请稍后重试');
      else if (why === 'sdk-timeout' || why === 'sdk-load-failed' || why === 'sdk-unavailable') {
        fbSetHint('云服务组件没加载成功，请检查网络后重试');
      } else fbSetHint('提交失败，请稍后重试');
    });
  }

  function initCloud() {
    if (cloudDisabled()) return;
    loadHits();
    if (CLOUD.warmup) setTimeout(function () { CLOUD.warmup(); }, 400);

    /* 点下载时计数（捕获阶段，早于微信引导的拦截） */
    document.addEventListener('click', function (e) {
      if (IS_WX) return;
      var btn = e.target.closest ? e.target.closest('.dl-btn') : null;
      if (!btn) return;
      countDownload(btn.closest('[data-hit-key]'));
    }, true);

    fbEls.open.addEventListener('click', fbOpen);
    fbEls.submit.addEventListener('click', fbSend);
    fbEls.types.addEventListener('click', function (e) {
      var btn = e.target.closest('.fb-type');
      if (!btn) return;
      fbType = btn.dataset.type;
      Array.prototype.forEach.call(fbEls.types.querySelectorAll('.fb-type'), function (b) {
        b.setAttribute('aria-pressed', String(b === btn));
      });
      fbSetHint('');
    });
    fbEls.modal.addEventListener('click', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('data-fb-close')) fbClose();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !fbEls.modal.hidden) fbClose();
    });
  }

  /* ------------------------------------------------------------- handlers */
  /* 「全部场景」：既回到全部，也是场景筛选的展开 / 收起开关 */
  els.allChip.addEventListener('click', function () {
    state.chipsOpen = !state.chipsOpen;
    state.scene = 'all';
    history.replaceState(null, '', location.pathname + location.search);
    renderChips();
    renderSceneNote();
    renderGrid();
  });

  els.chips.addEventListener('click', function (e) {
    var btn = e.target.closest('.chip');
    if (!btn) return;
    state.scene = btn.dataset.scene;
    state.chipsOpen = true;
    Array.prototype.forEach.call(els.chips.querySelectorAll('.chip'), function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.scene === state.scene));
    });
    els.allChip.setAttribute('aria-pressed', 'false');
    history.replaceState(null, '', '#' + state.scene);
    renderSceneNote();
    renderGrid();
  });

  var qTimer;
  els.q.addEventListener('input', function () {
    clearTimeout(qTimer);
    var v = els.q.value;
    qTimer = setTimeout(function () {
      state.q = v;
      renderGrid();
    }, 110);
  });

  els.grid.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('.js-copy');
    if (copyBtn) {
      e.preventDefault();
      copyText(copyBtn.dataset.copy, '下载链接已复制');
      return;
    }
    var more = e.target.closest('.more-btn');
    if (more) {
      var card = more.closest('.card');
      var box = card.querySelector('.pkgs-fold');
      var open = more.dataset.open === 'true';
      more.dataset.open = String(!open);
      box.dataset.open = open ? '0' : '1';
      Array.prototype.forEach.call(box.children, function (row, i) {
        row.style.display = (!open || i < COLLAPSE_AT) ? '' : 'none';
      });
      more.innerHTML = (open ? '展开全部 ' + box.children.length + ' 个版本' :
        '收起' ) + ICONS.chevron;
    }
  });

  els.extrasGrid.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('.js-copy');
    if (!copyBtn) return;
    e.preventDefault();
    copyText(copyBtn.dataset.copy, '下载链接已复制');
  });

  els.copySceneBtn.addEventListener('click', function () {
    var lines = [];
    DATA.apps.forEach(function (a) {
      a.packages.forEach(function (p) {
        if (p.scenario !== state.scene || !p.url) return;
        lines.push(a.name + ' | ' + p.file + ' | ' + p.url);
      });
    });
    if (!lines.length) { toast('该场景暂无链接'); return; }
    copyText(lines.join('\n'), '已复制 ' + lines.length + ' 条链接');
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== els.q) {
      e.preventDefault();
      els.q.focus();
      els.q.select();
    }
    if (e.key === 'Escape' && document.activeElement === els.q) {
      els.q.value = '';
      state.q = '';
      renderGrid();
      els.q.blur();
    }
  });

  var stickSentinel = function () {
    els.controls.classList.toggle('stuck', window.scrollY > 8);
  };
  window.addEventListener('scroll', stickSentinel, { passive: true });

  /* ----------------------------------------------------------------- init */
  function initMeta() {
    var stamp = DATA.updatedAt || '';
    els.syncText.textContent = '数据更新于 ' + stamp;
    if (els.heroMeta) {
      els.heroMeta.textContent = '数据更新于 ' + stamp;
    }
    els.footSync.textContent = '最后同步 ' + stamp;
    if (DATA.source) {
      els.footSource.href = DATA.source.url;
    }
    document.title = '智能柜软件清单 · 下载站（' + stamp + '）';
  }

  function initScene() {
    var h = (location.hash || '').replace('#', '');
    if (h && sceneMap[h]) {
      state.scene = h;
      state.chipsOpen = true;   // 直接定位到某个柜型时，把筛选区展开显示选中项
    }
  }

  initMeta();
  initScene();
  initCloud();
  initWx();
  renderChips();
  renderSceneNote();
  renderExtras();
  renderGrid();
  stickSentinel();
})();
