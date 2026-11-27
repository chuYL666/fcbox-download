/* ============================================================ 智莱驱动口令计算器
   与 App 内置页（fcbox-catalog-app/tools/gen_site.py）保持同步，移植时自动提取。
   复用 auth.js 的 aPad2 / authTip / authCopyText。ES5，纯本地计算。
   ========================================================================== */

/* ================= 智莱驱动口令计算器（ES5 / 老 WebView 兼容） =================
   全部本地计算，不联网、不依赖原生：登录口令 = 设备日期 yyyyMMdd；
   管理员口令 = md5(弹窗标题时间戳 + 1) 的前 6 位（与 MainActivity.md5 一致）。 */

/* 十进制字符串 +1：不走 Number，避免超出精度后被写成科学计数法 */
function pInc(s) {
  var a = s.split(""), i = a.length - 1, carry = 1, d;
  while (i >= 0 && carry) {
    d = (a[i].charCodeAt(0) - 48) + carry;
    a[i] = "" + (d % 10);
    carry = d >= 10 ? 1 : 0;
    i--;
  }
  if (carry) a.unshift("1");
  return a.join("");
}

/* 纯 JS MD5，输出标准 32 位小写 hex（与 Java BigInteger(1,digest).toString(16) 等价） */
function pMd5(input) {
  var bytes = [], i, c, s = "" + input;
  for (i = 0; i < s.length; i++) {
    c = s.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (i = 0; i < 8; i++) bytes.push(i < 4 ? ((bitLen >>> (8 * i)) & 0xff) : 0);
  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  var S = [7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
           5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
           4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
           6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21];
  var K = [], k;
  for (k = 0; k < 64; k++) K.push(Math.floor(Math.abs(Math.sin(k + 1)) * 0x100000000) >>> 0);
  var off, M, p, j, A, B, C, D, t, F, g;
  for (off = 0; off < bytes.length; off += 64) {
    M = [];
    for (j = 0; j < 16; j++) {
      p = off + j * 4;
      M.push((bytes[p] | (bytes[p+1] << 8) | (bytes[p+2] << 16) | (bytes[p+3] << 24)) >>> 0);
    }
    A = a0; B = b0; C = c0; D = d0;
    for (t = 0; t < 64; t++) {
      if (t < 16)      { F = (B & C) | (~B & D); g = t; }
      else if (t < 32) { F = (B & D) | (C & ~D); g = (5 * t + 1) % 16; }
      else if (t < 48) { F = B ^ C ^ D;          g = (3 * t + 5) % 16; }
      else             { F = C ^ (B | ~D);       g = (7 * t) % 16; }
      F = (F + A + K[t] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[t]) | (F >>> (32 - S[t])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  function hx(n) {
    var out = "", q, b;
    for (q = 0; q < 4; q++) {
      b = (n >>> (8 * q)) & 0xff;
      out += (b < 16 ? "0" : "") + b.toString(16);
    }
    return out;
  }
  return hx(a0) + hx(b0) + hx(c0) + hx(d0);
}

function pToday() {
  var d = new Date();
  return "" + d.getFullYear() + aPad2(d.getMonth() + 1) + aPad2(d.getDate());
}

var PWD_OPEN = true;   /* 网页端默认展开 */
function pwdToggle() {
  PWD_OPEN = !PWD_OPEN;
  var el = document.getElementById("pwd");
  if (el) el.className = PWD_OPEN ? "pw on" : "pw";
}

function pwdSetLogin(v) {
  var el = document.getElementById("pwLogin");
  if (el) { el.innerHTML = v; el.className = "pval"; }
}

function pwdDateInput() {
  var i = document.getElementById("pwDate");
  if (!i) return;
  var v = (i.value || "").replace(/[^0-9]/g, "");
  if (v !== i.value) i.value = v;
  if (v.length === 8) {
    i.setAttribute("data-manual", "1");
    pwdSetLogin(v);
  } else {
    i.setAttribute("data-manual", "0");
    pwdSetLogin(pToday());
  }
  var h = document.getElementById("pwLoginHint");
  if (h) {
    h.innerHTML = v.length === 8
      ? "已按输入日期计算（柜体掉电、日期不准时用这个）"
      : "密码 = 柜体当天日期 yyyyMMdd，以设备显示日期为准";
    h.className = "phint";
  }
}

function pwdDateToday() {
  var i = document.getElementById("pwDate");
  var t = pToday();
  if (i) { i.value = t; i.setAttribute("data-manual", "0"); }
  pwdSetLogin(t);
  var h = document.getElementById("pwLoginHint");
  if (h) { h.innerHTML = "密码 = 柜体当天日期 yyyyMMdd，以设备显示日期为准"; h.className = "phint"; }
  authTip("已恢复为今天：" + t);
}

function pwdDateApply() { pwdDateInput(); }

function pwdAdminCalc() {
  var i = document.getElementById("pwTitle");
  var v = i ? (i.value || "") : "";
  var el = document.getElementById("pwAdmin");
  var h = document.getElementById("pwAdminHint");
  var trimmed = pTrim(v);
  if (!trimmed) {
    if (el) { el.innerHTML = "------"; el.className = "pval idle"; }
    if (h) { h.innerHTML = "粘贴弹窗标题里的数字，自动算 md5(N+1) 前 6 位"; h.className = "phint"; }
    return;
  }
  var m = trimmed.match(/[0-9]{10,}/);
  if (!m) {
    if (el) { el.innerHTML = "------"; el.className = "pval idle"; }
    if (h) { h.innerHTML = "未识别到时间戳，请粘贴完整标题，例如：请输入密码(1764230000000)"; h.className = "phint warn"; }
    return;
  }
  var n = m[0], plus1 = pInc(n), full = pMd5(plus1), code = full.substr(0, 6);
  if (el) { el.innerHTML = code; el.className = "pval"; }
  if (h) { h.innerHTML = "N=" + n + " → N+1=" + plus1 + " → md5=" + full; h.className = "phint"; }
}

function pwdAdminClear() {
  var i = document.getElementById("pwTitle");
  if (i) i.value = "";
  pwdAdminCalc();
}

/* 去首尾空白：不用正则里的反斜杠转义，避免 Python 模板把它当转义序列 */
function pTrim(s) {
  var t = "" + s, a = 0, b = t.length;
  while (a < b && t.charCodeAt(a) <= 32) a++;
  while (b > a && t.charCodeAt(b - 1) <= 32) b--;
  return t.substring(a, b);
}

function pwdCopy(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var t = el.textContent || el.innerText || el.innerHTML || "";
  t = pTrim(t.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " "));
  if (!t || /^-+$/.test(t)) { authTip("暂无内容"); return; }
  authCopyText(t, "已复制：" + t);
}

function pwdInit() {
  var t = pToday();
  var i = document.getElementById("pwDate");
  if (i) { i.value = t; i.setAttribute("data-manual", "0"); }
  pwdSetLogin(t);
  var el = document.getElementById("pwd");
  if (el) el.className = PWD_OPEN ? "pw on" : "pw";
  /* 自检：算法不对就明确报警，避免现场拿着错误口令去试 */
  if (pMd5(pInc("1764230000000")).substr(0, 6) !== "7975dc") {
    var h = document.getElementById("pwAdminHint");
    if (h) { h.innerHTML = "注意：算法自检未通过，请勿使用计算结果"; h.className = "phint warn"; }
  }
  /* 柜机长期不关机，跨天自动纠正登录日期（手动改过日期就不覆盖） */
  setInterval(function () {
    var j = document.getElementById("pwDate");
    if (j && j.getAttribute("data-manual") !== "1") {
      var d = pToday();
      if (j.value !== d) { j.value = d; pwdSetLogin(d); }
    }
  }, 60000);
}

/* 必须放在最后调用：上面这些 var 未赋值前（函数声明已提升）跑会读到 undefined */
/* 网页端：auth.js 自己会调 authInit，这里只初始化口令卡 */
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pwdInit);
} else {
  pwdInit();
}
