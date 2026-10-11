/**
 * 修复模块 5: 沙箱环境安全防御 (Iframe Sandbox & Storage / Alert / Audio 防御)
 * 
 * 专门解决大模型在沙箱 iframe / 隐私浏览 / 严格权限环境下的三大致命共性盲区:
 * 1. localStorage / sessionStorage 在无同源权限沙箱下抛出 DOMException: Access is denied, 导致页面挂死。
 * 2. alert() / confirm() 在无 allow-modals 权限的 iframe 下抛出 DOMException: Blocked a call to 'alert', 导致流程中断。
 * 3. Web Audio (AudioContext) 未经手势交互处于 suspended 状态导致报错或静音。
 */

const fs = require('fs');
const path = require('path');

const SANDBOX_GUARD_ID = 'openmaic-sandbox-safe-guard';

const SANDBOX_GUARD_SCRIPT = `<script id="${SANDBOX_GUARD_ID}">
(function() {
  // 1. 安全 LocalStorage / SessionStorage 降级内存垫片
  try {
    var _testKey = '__openmaic_test_key__';
    window.localStorage.setItem(_testKey, '1');
    window.localStorage.removeItem(_testKey);
  } catch (e) {
    console.warn('[OpenMAIC Guard] 原生 LocalStorage 受沙箱或权限限制，已无缝切换至安全内存存储');
    function createMemoryStorage() {
      var store = {};
      return {
        getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
        setItem: function(k, v) { store[k] = String(v); },
        removeItem: function(k) { delete store[k]; },
        clear: function() { store = {}; },
        get length() { return Object.keys(store).length; },
        key: function(i) { return Object.keys(store)[i] || null; }
      };
    }
    try {
      var memStore = createMemoryStorage();
      Object.defineProperty(window, 'localStorage', { value: memStore, configurable: true, writable: true });
      Object.defineProperty(window, 'sessionStorage', { value: createMemoryStorage(), configurable: true, writable: true });
    } catch (_) {}
  }

  // 2. 安全弹窗降级垫片 (拦截并在沙箱禁用 alert 时优雅降级为 Toast，防止抛错中断主逻辑)
  var _origAlert = window.alert;
  window.alert = function(msg) {
    try {
      if (_origAlert) _origAlert.call(window, msg);
    } catch (e) {
      console.warn('[OpenMAIC Guard] alert() 被沙箱拦截，自动降级为安全浮层展示:', msg);
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#fff;padding:12px 24px;border-radius:10px;font-size:15px;font-weight:500;z-index:999999;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);text-align:center;pointer-events:none;transition:all 0.3s ease;backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,0.15);';
      toast.textContent = String(msg);
      (document.body || document.documentElement).appendChild(toast);
      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(function() { toast.remove(); }, 350);
      }, 2800);
    }
  };

  // 3. Web Audio 全局首触解锁器 (解决浏览器 Autoplay 策略导致 AudioContext 挂起)
  var _unlocked = false;
  function _unlockAudio() {
    if (_unlocked) return;
    _unlocked = true;
    try {
      if (window.audioCtx && window.audioCtx.state === 'suspended') {
        window.audioCtx.resume();
      }
      if (window.AudioContext || window.webkitAudioContext) {
        var dummy = new (window.AudioContext || window.webkitAudioContext)();
        if (dummy.state === 'suspended') dummy.resume();
      }
    } catch (_) {}
    window.removeEventListener('click', _unlockAudio, true);
    window.removeEventListener('touchstart', _unlockAudio, true);
  }
  window.addEventListener('click', _unlockAudio, true);
  window.addEventListener('touchstart', _unlockAudio, true);
})();
</script>`;

function repairSandboxIssues(html) {
  // 如果已注入过该守卫，则跳过
  if (html.includes(SANDBOX_GUARD_ID)) {
    return { html, modified: false };
  }

  // 检查是否包含 localStorage / sessionStorage / alert( / AudioContext
  const needsGuard =
    html.includes('localStorage') ||
    html.includes('sessionStorage') ||
    html.includes('alert(') ||
    html.includes('AudioContext');

  if (!needsGuard) {
    return { html, modified: false };
  }

  let newHtml = html;
  // 注入到 <head> 之后，或者 <body> 之前，或者首个 <script> 之前
  if (/<head[^>]*>/i.test(newHtml)) {
    newHtml = newHtml.replace(/(<head[^>]*>)/i, `$1\n  ${SANDBOX_GUARD_SCRIPT}`);
  } else if (/<script[^>]*>/i.test(newHtml)) {
    newHtml = newHtml.replace(/(<script[^>]*>)/i, `${SANDBOX_GUARD_SCRIPT}\n$1`);
  } else {
    newHtml = `${SANDBOX_GUARD_SCRIPT}\n${newHtml}`;
  }

  return { html: newHtml, modified: true };
}

function scanAndRepair(rootDir) {
  let count = 0;

  function traverse(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== 'node_modules' && ent.name !== 'repair-toolkit') {
          traverse(fullPath);
        }
      } else if (ent.isFile() && ent.name.endsWith('.html')) {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const res = repairSandboxIssues(raw);
        if (res.modified) {
          fs.writeFileSync(fullPath, res.html, 'utf8');
          count++;
        }
      }
    }
  }

  traverse(rootDir);
  return count;
}

function run(targetDir) {
  const dir = targetDir || path.resolve(__dirname, '..');
  const fixed = scanAndRepair(dir);
  console.log(`[fix_sandbox_and_storage] 注入沙箱环境与 Storage/Alert/Audio 安全守卫: ${fixed} 处文件`);
  return fixed;
}

module.exports = { run, repairSandboxIssues };
