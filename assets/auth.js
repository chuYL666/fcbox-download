/* ============================================================ 资产烧录授权
   与 App「运维软件助手」内置页完全同一套算法：HMAC-SHA1 + 动态截断，全部本地计算，
   没有任何网络请求，断网也能出密码。
     DATEKEY   = HMAC-SHA1(key="r"+yyMMdd+"ui", msg=yyMMdd 的 hex) 取 6 位数前 4 位
     动态密码  = HMAC-SHA1(key="STANDBOX"+账号+"t2d0m1j9d0z9r0d5s!b",
                          msg=floor(now/300000) 的 16 位 hex) 取 6 位
   每 5 分钟一个时间片，跨片后旧密码立即失效，这里自动清掉，免得拿作废密码去烧录。
   依赖页面元素：.auth / #akey / #acode / #abtn / #atok / #alft / #acp / #toast */
var AUTH_STEP = 300000;
var AUTH_OPEN = true;     /* 默认展开，收起状态不记忆（每次打开都要用） */
var authTok = '';
var authStep = 0;
var authTimer = null;

function aPad2(n) { return n < 10 ? '0' + n : '' + n; }

function aBytes(s) {
  var a = [], i;
  for (i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 255);
  return a;
}

function aHexBytes(h) {
  var a = [], i;
  for (i = 0; i + 1 < h.length; i += 2) a.push(parseInt(h.substr(i, 2), 16));
  return a;
}

/* SHA-1：纯 JS 版，不依赖 Uint8Array / TextEncoder，老内核也能跑 */
function aSha1(by) {
  var msg = by.slice(0), ml = by.length * 8, i, j;
  msg.push(0x80);
  while (msg.length % 64 !== 56) msg.push(0);
  for (i = 3; i >= 0; i--) msg.push(Math.floor(ml / 4294967296) >>> (i * 8) & 255);
  for (i = 3; i >= 0; i--) msg.push((ml >>> (i * 8)) & 255);

  var h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  var w = new Array(80);

  for (i = 0; i < msg.length; i += 64) {
    for (j = 0; j < 16; j++) {
      w[j] = (msg[i + j * 4] << 24) | (msg[i + j * 4 + 1] << 16) |
             (msg[i + j * 4 + 2] << 8) | msg[i + j * 4 + 3];
    }
    for (j = 16; j < 80; j++) {
      var x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (x << 1) | (x >>> 31);
    }
    var a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f, k, t;
    for (j = 0; j < 80; j++) {
      if (j < 20) { f = (b & c) | ((~b) & d); k = 0x5a827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ed9eba1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc; }
      else { f = b ^ c ^ d; k = 0xca62c1d6; }
      t = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = t;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
  }

  var out = [];
  for (i = 0; i < 5; i++) {
    out.push((h[i] >>> 24) & 255, (h[i] >>> 16) & 255, (h[i] >>> 8) & 255, h[i] & 255);
  }
  return out;
}

function aHmac(key, msg) {
  var k = key.slice(0), i, o = [], n = [];
  if (k.length > 64) k = aSha1(k);
  while (k.length < 64) k.push(0);
  for (i = 0; i < 64; i++) {
    o.push(k[i] ^ 0x5c);
    n.push(k[i] ^ 0x36);
  }
  return aSha1(o.concat(aSha1(n.concat(msg))));
}

/* 动态截断：末字节低 4 位当偏移，截 31 位整数后 mod 1000000，补足 6 位 */
function aTrunc(h) {
  var o = h[19] & 15;
  var v = (h[o] & 127) * 16777216 + (h[o + 1] << 16) + (h[o + 2] << 8) + h[o + 3];
  var s = '' + (v % 1000000);
  while (s.length < 6) s = '0' + s;
  return s;
}

function aDayKey(d) {
  var hex = aPad2(d.getFullYear() % 100) + aPad2(d.getMonth() + 1) + aPad2(d.getDate());
  return aTrunc(aHmac(aBytes('r' + hex + 'ui'), aHexBytes(hex))).substr(0, 4);
}

function aToken(code, ms) {
  var hex = Math.floor(ms / AUTH_STEP).toString(16).toUpperCase();
  while (hex.length < 16) hex = '0' + hex;
  return aTrunc(aHmac(aBytes('STANDBOX' + code + 't2d0m1j9d0z9r0d5s!b'), aHexBytes(hex)));
}

/* ------------------------------------------------------------------ 交互 */
function authTip(msg) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show';
  clearTimeout(authTip._t);
  authTip._t = setTimeout(function () { el.className = 'toast'; }, 1900);
}

function authLegacyCopy(text, ok, fail) {
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

/* 装到手机里时走原生剪贴板；普通浏览器优先 Clipboard API，失败再退回 execCommand。
   onOk 只在确实写进剪贴板后才执行，避免「提示复制失败、按钮却显示已复制」 */
function authCopyText(text, okMsg, onOk) {
  var settled = false;
  var ok = function () {
    if (settled) return;
    settled = true;
    authTip(okMsg || '已复制');
    if (onOk) onOk();
  };
  var fail = function () {
    if (settled) return;
    settled = true;
    authTip('复制失败，请长按手动复制');
  };

  try {
    if (window.Android && window.Android.copy && window.Android.copy(text)) {
      ok();
      return;
    }
  } catch (e) { /* 继续走网页方案 */ }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    /* 部分内置浏览器里这个 Promise 既不 resolve 也不 reject，加超时兜底 */
    var timer = setTimeout(function () {
      if (!settled) authLegacyCopy(text, ok, fail);
    }, 400);
    navigator.clipboard.writeText(text).then(function () {
      clearTimeout(timer);
      ok();
    }, function () {
      clearTimeout(timer);
      authLegacyCopy(text, ok, fail);
    });
  } else {
    authLegacyCopy(text, ok, fail);
  }
}

function authToggle() {
  AUTH_OPEN = !AUTH_OPEN;
  var el = document.getElementById('auth');
  if (el) el.className = AUTH_OPEN ? 'auth on' : 'auth';
}

/* DATEKEY 只有 4 位、每天变一次，直接显示，点一下可复制 */
function authKey() {
  var k = aDayKey(new Date());
  var el = document.getElementById('akey');
  if (!el || el.getAttribute('data-k') === k) return;
  el.setAttribute('data-k', k);
  el.innerHTML = 'DATEKEY ' + k;
}

function authKeyCopy(ev) {
  if (ev) {
    if (ev.stopPropagation) ev.stopPropagation();
    ev.cancelBubble = true;
  }
  var el = document.getElementById('akey');
  var v = el ? (el.getAttribute('data-k') || '') : '';
  if (!v) return;
  authCopyText(v, 'DATEKEY 已复制：' + v);
}

function authInput() {
  var i = document.getElementById('acode');
  if (!i) return;
  var v = (i.value || '').replace(/[^0-9]/g, '');
  if (v !== i.value) i.value = v;
  var b = document.getElementById('abtn');
  if (b) b.className = v.length === 8 ? 'abtn on' : 'abtn';
}

function authGen() {
  var i = document.getElementById('acode');
  var code = i ? (i.value || '').replace(/[^0-9]/g, '') : '';
  if (code.length !== 8) {
    authTip('请输入 8 位动态账号');
    if (i) i.focus();
    return;
  }
  authKey();                                  /* 跨天后先把 DATEKEY 纠正过来 */
  var now = (new Date()).getTime();
  authTok = aToken(code, now);
  authStep = Math.floor(now / AUTH_STEP);
  var t = document.getElementById('atok');
  if (t) {
    t.innerHTML = authTok;
    t.className = 'atk';
  }
  if (authTimer) clearInterval(authTimer);
  authTimer = setInterval(authTick, 1000);
  authTick();
}

function authTick() {
  if (!authTok) {
    var lf0 = document.getElementById('alft');
    if (lf0) { lf0.innerHTML = ''; lf0.className = 'alft'; }
    if (authTimer) { clearInterval(authTimer); authTimer = null; }
    authKey();
    return;
  }
  var now = (new Date()).getTime();
  var lf = document.getElementById('alft');
  if (Math.floor(now / AUTH_STEP) !== authStep) {
    /* 跨过 5 分钟时间片：旧密码已作废，直接清掉，避免拿去烧录报错 */
    authTok = '';
    var t = document.getElementById('atok');
    if (t) { t.innerHTML = '------'; t.className = 'atk idle'; }
    if (lf) { lf.innerHTML = '已过期，请重新生成'; lf.className = 'alft warn'; }
    if (authTimer) { clearInterval(authTimer); authTimer = null; }
    return;
  }
  var sec = Math.ceil((AUTH_STEP - (now % AUTH_STEP)) / 1000);
  if (lf) {
    lf.innerHTML = '有效 ' + Math.floor(sec / 60) + ':' + aPad2(sec % 60);
    lf.className = sec <= 60 ? 'alft warn' : 'alft';
  }
}

function authCopy(ev) {
  if (ev) {
    if (ev.stopPropagation) ev.stopPropagation();
    ev.cancelBubble = true;
  }
  if (!authTok) { authTip('请先生成动态密码'); return; }
  authCopyText(authTok, '动态密码已复制', function () {
    var b = document.getElementById('acp');
    if (!b) return;
    b.innerHTML = '已复制';
    b.className = 'acp on';
    if (b._t) clearTimeout(b._t);
    b._t = setTimeout(function () { b.innerHTML = '复制'; b.className = 'acp'; }, 1600);
  });
}

function authInit() {
  var el = document.getElementById('auth');
  if (!el) return;
  el.className = AUTH_OPEN ? 'auth on' : 'auth';
  authKey();
  authTick();
  /* 页面长时间挂着不动，日期会变：每分钟对一次 DATEKEY */
  setInterval(authKey, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', authInit);
} else {
  authInit();
}
