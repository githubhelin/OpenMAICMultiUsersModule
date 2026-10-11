/**
 * 修复模块 6: 移动端与交互电子白板触控拖拽兼容 (Touch-to-Drag Polyfill)
 * 
 * 专门解决大模型生成的 HTML5 原生拖拽 (draggable="true", ondragstart, ondrop)
 * 在移动端 (iPad/平板) 以及中小学智慧教室 (希沃/鸿合交互式触摸一体机) 上完全无法触控拖动的硬伤。
 */

const fs = require('fs');
const path = require('path');

const TOUCH_DND_GUARD_ID = 'openmaic-touch-dnd-guard';

const TOUCH_DND_SCRIPT = `<script id="${TOUCH_DND_GUARD_ID}">
(function() {
  if (!('ontouchstart' in window) && !navigator.maxTouchPoints) return;

  var currentDragItem = null;
  var dragGhost = null;
  var dragData = {};
  var startX = 0, startY = 0;
  var isDragging = false;

  function findDraggable(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (el.getAttribute && (el.getAttribute('draggable') === 'true' || el.hasAttribute('ondragstart'))) {
        return el;
      }
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

  function dispatchSyntheticEvent(elem, type, touch, dataTransfer) {
    var evt = new CustomEvent(type, { bubbles: true, cancelable: true });
    evt.clientX = touch ? touch.clientX : 0;
    evt.clientY = touch ? touch.clientY : 0;
    evt.pageX = touch ? touch.pageX : 0;
    evt.pageY = touch ? touch.pageY : 0;
    evt.dataTransfer = dataTransfer || createMockDataTransfer();
    return elem.dispatchEvent(evt);
  }

  document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) return;
    var touch = e.touches[0];
    var target = findDraggable(e.target);
    if (!target) return;

    currentDragItem = target;
    startX = touch.clientX;
    startY = touch.clientY;
    dragData = {};
    isDragging = false;
  }, { passive: true });

  document.addEventListener('touchmove', function(e) {
    if (!currentDragItem) return;
    var touch = e.touches[0];
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;

    if (!isDragging && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isDragging = true;
      var dt = createMockDataTransfer();
      dispatchSyntheticEvent(currentDragItem, 'dragstart', touch, dt);

      // 创建拖拽视觉镜像
      try {
        dragGhost = currentDragItem.cloneNode(true);
        dragGhost.style.position = 'fixed';
        dragGhost.style.pointerEvents = 'none';
        dragGhost.style.zIndex = '999999';
        dragGhost.style.opacity = '0.85';
        dragGhost.style.width = currentDragItem.offsetWidth + 'px';
        dragGhost.style.height = currentDragItem.offsetHeight + 'px';
        dragGhost.style.left = (touch.clientX - currentDragItem.offsetWidth / 2) + 'px';
        dragGhost.style.top = (touch.clientY - currentDragItem.offsetHeight / 2) + 'px';
        dragGhost.style.boxShadow = '0 12px 28px rgba(0,0,0,0.28)';
        dragGhost.style.transform = 'scale(1.05)';
        document.body.appendChild(dragGhost);
      } catch (_) {}
    }

    if (isDragging) {
      if (e.cancelable) e.preventDefault();
      if (dragGhost) {
        dragGhost.style.left = (touch.clientX - currentDragItem.offsetWidth / 2) + 'px';
        dragGhost.style.top = (touch.clientY - currentDragItem.offsetHeight / 2) + 'px';
      }

      // 实时派发 dragover
      if (dragGhost) dragGhost.style.display = 'none';
      var hoverElem = document.elementFromPoint(touch.clientX, touch.clientY);
      if (dragGhost) dragGhost.style.display = '';

      if (hoverElem) {
        dispatchSyntheticEvent(hoverElem, 'dragover', touch);
      }
    }
  }, { passive: false });

  document.addEventListener('touchend', function(e) {
    if (!currentDragItem) return;

    if (isDragging) {
      var touch = e.changedTouches[0];
      if (dragGhost) {
        dragGhost.style.display = 'none';
      }
      var dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);

      if (dropTarget) {
        dispatchSyntheticEvent(dropTarget, 'drop', touch);
      }
      dispatchSyntheticEvent(currentDragItem, 'dragend', touch);
    }

    if (dragGhost && dragGhost.parentNode) {
      dragGhost.parentNode.removeChild(dragGhost);
    }
    dragGhost = null;
    currentDragItem = null;
    isDragging = false;
  }, { passive: true });
})();
</script>`;

function repairTouchDnd(html) {
  // 如果已注入或无需拖拽，则跳过
  if (html.includes(TOUCH_DND_GUARD_ID)) {
    return { html, modified: false };
  }

  const hasDnd =
    html.includes('draggable="true"') ||
    html.includes('draggable=\'true\'') ||
    html.includes('ondragstart') ||
    html.includes('addEventListener(\'dragstart\'') ||
    html.includes('addEventListener("dragstart"');

  if (!hasDnd) {
    return { html, modified: false };
  }

  let newHtml = html;
  if (/<head[^>]*>/i.test(newHtml)) {
    newHtml = newHtml.replace(/(<head[^>]*>)/i, `$1\n  ${TOUCH_DND_SCRIPT}`);
  } else if (/<script[^>]*>/i.test(newHtml)) {
    newHtml = newHtml.replace(/(<script[^>]*>)/i, `${TOUCH_DND_SCRIPT}\n$1`);
  } else {
    newHtml = `${TOUCH_DND_SCRIPT}\n${newHtml}`;
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
        const res = repairTouchDnd(raw);
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
  console.log(`[fix_touch_compatibility] 注入触屏/电子白板拖拽兼容 Polyfill: ${fixed} 处文件`);
  return fixed;
}

module.exports = { run, repairTouchDnd };
