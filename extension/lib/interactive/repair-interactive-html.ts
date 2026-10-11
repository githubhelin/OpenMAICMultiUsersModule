/**
 * OpenMAIC 交互课件自动化防御性自愈清洗器
 * 针对大模型单文件 HTML 课件的常见共性盲区进行纯内存快速清洗与加固。
 */

export interface RepairResult {
  html: string;
  appliedRepairs: string[];
}

const BUILTIN_GLOBAL_FUNCTIONS = new Set([
  'alert',
  'confirm',
  'prompt',
  'console',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'preventDefault',
  'stopPropagation',
  'history',
  'location',
  'window',
  'close',
  'print',
  'focus',
  'blur',
  'open',
]);

function tryRepairJson(raw: string): string {
  // 规则 1: 修复未带双引号的对象键名，例如: label: "..." 或 isExternal: false
  let repaired = raw.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, (_match, prefix, key) => {
    return `${prefix}"${key}":`;
  });

  // 规则 2: 修复重复键名语法错误，例如 "id": "n6": "n6" -> "id": "n6"
  repaired = repaired.replace(/"([a-zA-Z0-9_$]+)"\s*:\s*"([^"]+)"\s*:\s*"\2"/g, '"$1": "$2"');

  // 规则 3: 修复对象或数组结尾的多余逗号 (trailing commas)
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  // 规则 4: 修复单引号包裹的字符串键值 -> 双引号
  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  return repaired;
}

export function repairInteractiveHtml(rawHtml: string): RepairResult {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return { html: rawHtml, appliedRepairs: [] };
  }

  let html = rawHtml;
  const appliedRepairs: string[] = [];

  // 1. 修复内嵌 JSON 语法错误 (未加双引号、单引号字符串、尾随逗号、重复键名等)
  const jsonRegex = /(<script[^>]*type=["']application\/json["'][^>]*>)([\s\S]*?)(<\/script>)/gi;
  html = html.replace(jsonRegex, (full, start, content, end) => {
    const trimmed = content.trim();
    if (!trimmed) return full;
    try {
      JSON.parse(trimmed);
      return full;
    } catch (_) {
      const clean = tryRepairJson(content);
      try {
        JSON.parse(clean.trim());
        if (clean !== content) appliedRepairs.push('JSON 语法校正');
        return `${start}${clean}${end}`;
      } catch (_) {
        return full; // 若仍无法解析则保持原样，避免破坏非标准数据
      }
    }
  });

  // 2. 修复多关卡缺失的 onclick 函数 (动态桩函数与关卡流转桥接)
  const onclickAttrRegex = /onclick=["']([^"']+)["']/gi;
  const referencedFns = new Set<string>();
  for (const match of html.matchAll(onclickAttrRegex)) {
    const code = match[1];
    const fnMatches = code.matchAll(/([a-zA-Z0-9_$]+)\s*\(/g);
    for (const fnMatch of fnMatches) {
      const fnName = fnMatch[1];
      if (!BUILTIN_GLOBAL_FUNCTIONS.has(fnName)) {
        referencedFns.add(fnName);
      }
    }
  }

  const missingFns: string[] = [];
  for (const fn of referencedFns) {
    const definedPattern = new RegExp(
      `((?:async\\s+)?function\\s+${fn}\\b|window\\.${fn}\\s*=|window\\s*\\[['"]${fn}['"]\\]|var\\s+${fn}\\b|let\\s+${fn}\\b|const\\s+${fn}\\b|\\b${fn}\\s*:)`,
    );
    if (!definedPattern.test(html)) {
      missingFns.push(fn);
    }
  }

  if (missingFns.length > 0 && !html.includes('id="openmaic-missing-fn-bridge"')) {
    const bridgeScript = `\n<script id="openmaic-missing-fn-bridge">\n` +
      missingFns.map((fn) => `
window["${fn}"] = function(...args) {
  console.warn('[OpenMAIC AutoBridge] 触发了模型未显式定义的函数: ${fn}', args);
  var nextModal = document.querySelector('.modal-overlay.active, .modal.show, [id*="modal"].show, [id*="result"].active, [id*="screen"].active, [id*="victory"].active');
  if (nextModal) { nextModal.classList.remove('active'); nextModal.classList.add('hidden'); }
  if (typeof initLevel === 'function') {
    var cur = (window.gameState && typeof window.gameState.currentLevel === 'number') ? window.gameState.currentLevel : 0;
    try { initLevel(cur + 1); return; } catch(e) {}
  }
  if (typeof nextLevel === 'function') { try { nextLevel(); return; } catch(e) {} }
  if (typeof restartGame === 'function') { try { restartGame(); return; } catch(e) {} }
  var nextBtn = document.getElementById('next-level-btn') || document.querySelector('.next-btn, .next-level');
  if (nextBtn && nextBtn !== this) { try { nextBtn.click(); } catch(e) {} }
};`).join('\n') + `\n</script>\n`;

    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${bridgeScript}</body>`)
      : `${html}${bridgeScript}`;
    appliedRepairs.push(`自动桥接缺失函数: ${missingFns.join(', ')}`);
  }

  // 3. 修复 HTML5 拖放 dropzone 缺少 event.preventDefault() 导致 drop 失效
  if (html.includes('ondragover=')) {
    const beforeDnd = html;
    html = html.replace(/ondragover=["']((?!.*event\.preventDefault\(\))[^"']+)["']/gi, (_match, body) => {
      return `ondragover="event.preventDefault(); ${body}"`;
    });
    if (html !== beforeDnd) appliedRepairs.push('补齐 ondragover 默认行为拦截 (防止 drop 丢弃)');
  }

  // 4. 增强 currentTarget 安全访问
  if (html.includes('e.currentTarget.classList')) {
    const beforeTarget = html;
    html = html.replace(
      /e\.currentTarget\.classList\.add/g,
      '(e.currentTarget || e.target || this)?.classList?.add',
    );
    html = html.replace(
      /e\.currentTarget\.classList\.remove/g,
      '(e.currentTarget || e.target || this)?.classList?.remove',
    );
    if (html !== beforeTarget) appliedRepairs.push('增强 currentTarget 安全访问');
  }

  // 5. 扫描同时拥有 draggable="true" 与 onclick 属性的元素，注入拖拽/点击互斥消抖
  const hasHybridCards = /<[^>]*draggable=["']true["'][^>]*onclick=[^>]*>|<[^>]*onclick=[^>]*draggable=["']true["'][^>]*>/i.test(html);
  if (hasHybridCards && !html.includes('__dragMovementDetected')) {
    const disambiguationScript = `\n<script id="openmaic-drag-disambiguation">
(function() {
  if (window.__dragMovementDetected) return;
  window.__dragMovementDetected = true;
  var isDraggingItem = false;
  var dragStartX = 0, dragStartY = 0;

  document.addEventListener('dragstart', function(e) {
    isDraggingItem = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  }, true);

  document.addEventListener('dragend', function() {
    setTimeout(function() { isDraggingItem = false; }, 80);
  }, true);

  document.addEventListener('click', function(e) {
    if (isDraggingItem) {
      var moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      if (moved > 5) {
        e.stopImmediatePropagation();
      }
    }
  }, true);
})();
</script>\n`;

    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${disambiguationScript}</body>`)
      : `${html}${disambiguationScript}`;
    appliedRepairs.push('注入拖拽与点击互斥消抖拦截器');
  }

  // 6. 修复 Canvas 2D 负半径崩溃 (arc / createRadialGradient / roundRect)
  if (html.includes('.arc(') || html.includes('createRadialGradient') || html.includes('arcTo')) {
    const beforeCanvas = html;
    html = html.replace(/\b([a-zA-Z0-9_$]+)\.arc\(([^,]+),\s*([^,]+),\s*([^,]+),/g, (match, ctxVar, x, y, r) => {
      if (r.includes('Math.max')) return match;
      return `${ctxVar}.arc(${x}, ${y}, Math.max(0.1, ${r}),`;
    });
    html = html.replace(
      /\b([a-zA-Z0-9_$]+)\.createRadialGradient\(([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^,)]+)\)/g,
      (match, ctxVar, x0, y0, r0, x1, y1, r1) => {
        if (r0.includes('Math.max') || r1.includes('Math.max')) return match;
        return `${ctxVar}.createRadialGradient(${x0}, ${y0}, Math.max(0.1, ${r0}), ${x1}, ${y1}, Math.max(0.1, ${r1}))`;
      },
    );
    if (html !== beforeCanvas) {
      appliedRepairs.push('Canvas 关键绘制尺寸防负数保护');
    }
  }
  if (html.includes('function roundRect(') && !html.includes('Math.min(r || 0')) {
    html = html.replace(
      /function roundRect\(ctx,\s*x,\s*y,\s*w,\s*h,\s*r\)\s*\{[\s\S]*?ctx\.beginPath\(\);/g,
      `function roundRect(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      ctx.beginPath();`,
    );
  }

  // 7. 注入沙箱环境与 Storage / Alert / Audio 守卫 (解决受限 iframe 下 DOMException)
  const needsSandboxGuard =
    html.includes('localStorage') ||
    html.includes('sessionStorage') ||
    html.includes('alert(') ||
    html.includes('AudioContext');

  if (needsSandboxGuard && !html.includes('openmaic-sandbox-safe-guard')) {
    const sandboxGuardScript = `<script id="openmaic-sandbox-safe-guard">
(function() {
  try {
    var _testKey = '__openmaic_test_key__';
    window.localStorage.setItem(_testKey, '1');
    window.localStorage.removeItem(_testKey);
  } catch (e) {
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
      try {
        Object.defineProperty(window, 'localStorage', { value: memStore, configurable: true, writable: true });
        Object.defineProperty(window, 'sessionStorage', { value: createMemoryStorage(), configurable: true, writable: true });
      } catch (_) {
        window.localStorage = memStore;
        window.sessionStorage = createMemoryStorage();
      }
    } catch (_) {}
  }
  var _origAlert = window.alert;
  window.alert = function(msg) {
    try {
      if (_origAlert) _origAlert.call(window, msg);
    } catch (e) {
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.92);color:#fff;padding:12px 24px;border-radius:10px;font-size:15px;z-index:999999;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);text-align:center;pointer-events:none;transition:all 0.3s;';
      toast.textContent = String(msg);
      (document.body || document.documentElement).appendChild(toast);
      setTimeout(function() { toast.style.opacity = '0'; setTimeout(function() { toast.remove(); }, 350); }, 2800);
    }
  };
  var _unlocked = false;
  function _unlockAudio() {
    if (_unlocked) return;
    _unlocked = true;
    try {
      if (window.audioCtx && window.audioCtx.state === 'suspended') window.audioCtx.resume();
      if (window.AudioContext || window.webkitAudioContext) {
        var dummy = new (window.AudioContext || window.webkitAudioContext)();
        if (dummy && dummy.state === 'suspended') dummy.resume();
      }
    } catch (_) {}
    window.removeEventListener('click', _unlockAudio, true);
    window.removeEventListener('touchstart', _unlockAudio, true);
  }
  window.addEventListener('click', _unlockAudio, true);
  window.addEventListener('touchstart', _unlockAudio, true);
})();
</script>`;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n  ${sandboxGuardScript}`);
    } else {
      html = `${sandboxGuardScript}\n${html}`;
    }
    appliedRepairs.push('注入沙箱环境与 Storage/Alert/Audio 安全守卫');
  }

  // 8. 注入触屏与智慧电子白板 Touch-to-Drag 兼容 Polyfill
  const hasDnd = html.includes('draggable="true"') || html.includes('ondragstart');
  if (hasDnd && !html.includes('openmaic-touch-dnd-guard')) {
    const touchDndScript = `<script id="openmaic-touch-dnd-guard">
(function() {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;
  var currentDragItem = null, dragGhost = null, dragData = {}, startX = 0, startY = 0, isDragging = false;
  function findDraggable(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.getAttribute && (el.getAttribute('draggable') === 'true' || el.hasAttribute('ondragstart'))) return el;
      el = el.parentElement;
    }
    return null;
  }
  function createMockDataTransfer() {
    return {
      data: dragData,
      setData: function(k, v) { dragData[k] = String(v); },
      getData: function(k) { return dragData[k] || ''; },
      clearData: function(k) { if (k) delete dragData[k]; else dragData = {}; },
      types: Object.keys(dragData),
      dropEffect: 'move',
      effectAllowed: 'all'
    };
  }
  function dispatchSynthetic(elem, type, touch, dt) {
    var evt = new CustomEvent(type, { bubbles: true, cancelable: true });
    evt.clientX = touch ? touch.clientX : 0;
    evt.clientY = touch ? touch.clientY : 0;
    evt.pageX = touch ? touch.pageX : 0;
    evt.pageY = touch ? touch.pageY : 0;
    evt.dataTransfer = dt || createMockDataTransfer();
    return elem.dispatchEvent(evt);
  }
  document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) return;
    var target = findDraggable(e.target);
    if (!target) return;
    currentDragItem = target;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dragData = {}; isDragging = false;
  }, { passive: true });
  document.addEventListener('touchmove', function(e) {
    if (!currentDragItem) return;
    var touch = e.touches[0];
    var dx = touch.clientX - startX, dy = touch.clientY - startY;
    if (!isDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isDragging = true;
      dispatchSynthetic(currentDragItem, 'dragstart', touch);
      try {
        dragGhost = currentDragItem.cloneNode(true);
        dragGhost.style.cssText = 'position:fixed;pointer-events:none;z-index:999999;opacity:0.85;transform:scale(1.05);box-shadow:0 12px 28px rgba(0,0,0,0.28);width:' + currentDragItem.offsetWidth + 'px;height:' + currentDragItem.offsetHeight + 'px;left:' + (touch.clientX - currentDragItem.offsetWidth/2) + 'px;top:' + (touch.clientY - currentDragItem.offsetHeight/2) + 'px;';
        document.body.appendChild(dragGhost);
      } catch(_) {}
    }
    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      if (dragGhost) {
        dragGhost.style.left = (touch.clientX - currentDragItem.offsetWidth/2) + 'px';
        dragGhost.style.top = (touch.clientY - currentDragItem.offsetHeight/2) + 'px';
        dragGhost.style.display = 'none';
      }
      var hoverElem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (dragGhost) dragGhost.style.display = '';
      if (hoverElem) dispatchSynthetic(hoverElem, 'dragover', touch);
    }
  }, { passive: false });
  document.addEventListener('touchend', function(e) {
    if (!currentDragItem) return;
    if (isDragging) {
      var touch = e.changedTouches[0];
      if (dragGhost) dragGhost.style.display = 'none';
      var dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
      if (dropTarget) dispatchSynthetic(dropTarget, 'drop', touch);
      dispatchSynthetic(currentDragItem, 'dragend', touch);
    }
    if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
    dragGhost = null; currentDragItem = null; isDragging = false;
  }, { passive: true });
})();
</script>`;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/(<head[^>]*>)/i, `$1\n  ${touchDndScript}`);
    } else {
      html = `${touchDndScript}\n${html}`;
    }
    appliedRepairs.push('注入电子白板与触控拖拽兼容 Polyfill');
  }

  // 9. 自愈清理历史版本遗留的非标准语法 (evt as any)
  if (html.includes('(evt as any)')) {
    const beforeClean = html;
    html = html.replace(
      /\(evt as any\)\.clientX = touch\.clientX;\s*\(evt as any\)\.clientY = touch\.clientY;/g,
      'evt.clientX = touch ? touch.clientX : 0; evt.clientY = touch ? touch.clientY : 0;',
    );
    html = html.replace(
      /\(evt as any\)\.dataTransfer = dt \|\| createMockDataTransfer\(\);/g,
      'evt.dataTransfer = dt || createMockDataTransfer();',
    );
    if (html !== beforeClean) {
      appliedRepairs.push('清理历史 Touch Guard 非标准语法');
    }
  }

  return { html, appliedRepairs };
}
