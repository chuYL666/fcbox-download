/* 丰巢智能柜 · 软件下载站 —— 云服务接入层
 *   1) 下载计数（download_hits，写入走 bump_download 原子累加，公开只读）
 *   2) 问题反馈（feedback，匿名可提交，不对外读取）
 *
 * SDK 不写在 HTML 里同步加载：CDN 在弱网 / 被墙时会把后面的脚本一起卡住。
 * 这里改成首次用到时再异步拉 SDK（6 秒超时），失败就整体降级，页面照常可用。
 */
(function () {
  'use strict';

  /* 来自 workbuddy_cloud_service 的 publicConfig，均为可公开的前端值 */
  var CONFIG = {
    endpoint: 'https://fcbox-apk-center.app.workbuddy.host',
    oauthRelayBaseUrl: 'https://www.workbuddy.cn/v2/as/genie-baas/oauth',
    publishableKey: 'wbpk_HqmxlV9GfpKwMRkO3EIUKs_dWaoDJWInyi4Z1rWAX97QfSoMBHp1qc0'
  };
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@tencent-ai/workbuddy-cloud-sdk@dev/lib/index.global.js';
  var SDK_TIMEOUT = 6000;
  var CALL_TIMEOUT = 9000;

  var client = null;
  var booting = null;

  function createClient() {
    if (!window.WorkBuddyCloud || typeof window.WorkBuddyCloud.createWorkBuddyCloud !== 'function') {
      throw new Error('sdk-unavailable');
    }
    return window.WorkBuddyCloud.createWorkBuddyCloud({
      endpoint: CONFIG.endpoint,
      oauthRelayBaseUrl: CONFIG.oauthRelayBaseUrl,
      publishableKey: CONFIG.publishableKey
    });
  }

  /* 惰性初始化：只拉一次，成功后复用 */
  function ensureClient() {
    if (client) return Promise.resolve(client);
    if (booting) return booting;

    booting = new Promise(function (resolve, reject) {
      var settled = false;
      var finish = function (fn, arg) {
        if (settled) return;
        settled = true;
        fn(arg);
      };
      var timer = setTimeout(function () {
        finish(reject, new Error('sdk-timeout'));
      }, SDK_TIMEOUT);

      try {
        client = createClient();          // SDK 已经在页面上（别的模块先加载过）
      } catch (e) {
        client = null;
      }
      if (client) {
        clearTimeout(timer);
        finish(resolve, client);
        return;
      }

      var s = document.createElement('script');
      s.src = SDK_URL;
      s.async = true;
      s.onload = function () {
        clearTimeout(timer);
        try {
          client = createClient();
          finish(resolve, client);
        } catch (e) {
          finish(reject, e);
        }
      };
      s.onerror = function () {
        clearTimeout(timer);
        finish(reject, new Error('sdk-load-failed'));
      };
      document.head.appendChild(s);
    });

    /* 失败后允许下次再试（例如网络恢复） */
    booting.catch(function () { booting = null; });
    return booting;
  }

  /* 每个云调用都带超时，避免按钮一直转圈 */
  function guard(promise) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('cloud-timeout')); }, CALL_TIMEOUT);
      promise.then(
        function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); }
      );
    });
  }

  function withClient(fn) {
    return ensureClient().then(function (c) { return guard(fn(c)); });
  }

  var api = {
    /* 预热：页面空闲时先把 SDK 拉下来 */
    warmup: function () { return ensureClient().then(function () { return true; }, function () { return false; }); },

    /* 读取全部安装包的累计下载次数 -> { pkgKey: hits } */
    loadHits: function () {
      return withClient(function (c) {
        return c.database.from('download_hits').select('pkg_key, hits').limit(2000);
      }).then(function (res) {
        if (res.error) throw res.error;
        var map = {};
        (res.data || []).forEach(function (row) {
          var n = Number(row.hits);
          if (row.pkg_key && isFinite(n) && n > 0) map[row.pkg_key] = n;
        });
        return map;
      });
    },

    /* 记一次下载，resolve 为该安装包的最新累计次数 */
    bump: function (pkgKey, pkgName, scene) {
      return withClient(function (c) {
        return c.database.rpc('bump_download', {
          p_key: pkgKey, p_name: pkgName, p_scene: scene
        });
      }).then(function (res) {
        if (res.error) throw res.error;
        var v = Array.isArray(res.data) ? res.data[0] : res.data;
        var n = Number(v);
        return isFinite(n) ? n : null;
      });
    },

    /* 提交一条问题反馈 */
    report: function (payload) {
      return withClient(function (c) {
        return c.database.from('feedback').insert({
          pkg_key: payload.pkgKey || null,
          pkg_name: payload.pkgName || null,
          scene: payload.scene || null,
          issue_type: payload.issueType,
          message: payload.message || null,
          contact: payload.contact || null,
          page_url: payload.pageUrl || null
        });
      }).then(function (res) {
        if (res.error) throw res.error;
        return true;
      });
    }
  };

  window.FCBCloud = api;
})();
