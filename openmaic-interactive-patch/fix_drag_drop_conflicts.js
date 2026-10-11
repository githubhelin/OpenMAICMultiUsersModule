const fs = require('fs');
const path = require('path');

/**
 * 通用拖拽与点击交互冲突自动修复引擎
 * 遍历目标目录下所有 HTML 文件：
 * 1. 扫描所有放置槽（Dropzone），自动补齐丢失的 event.preventDefault()，确保 HTML5 drop 事件 100% 触发；
 * 2. 增强 currentTarget 访问安全（避免内联调用上下文为 null 时报 classList 错误）；
 * 3. 扫描同时具备 draggable="true" 与 onclick 的双重属性卡片，自动注入消抖互斥拦截器，彻底解决“点击误判为拖动”与“拖拽误触点击”。
 */

function getAllHtmlFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git' && entry.name !== 'repair-toolkit') {
        files.push(...getAllHtmlFiles(fullPath));
      }
    } else if (entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

const DISAMBIGUATION_SCRIPT = `
// [Auto-Fix 通用规则] 拖拽与点击互斥消抖保护机制
(function() {
  if (window.__dragMovementDetected) return;
  window.__dragMovementDetected = true;
  let isDraggingItem = false;
  let dragStartX = 0, dragStartY = 0;

  document.addEventListener('dragstart', function(e) {
    isDraggingItem = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
  }, true);

  document.addEventListener('dragend', function() {
    setTimeout(() => { isDraggingItem = false; }, 80);
  }, true);

  // 拦截因为拖拽动作而误触发的 click 事件
  document.addEventListener('click', function(e) {
    if (isDraggingItem) {
      const moved = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
      if (moved > 5) {
        e.stopImmediatePropagation();
      }
    }
  }, true);
})();
`;

function run(targetDir) {
  const rootDir = targetDir ? path.resolve(targetDir) : path.resolve(__dirname, '..');
  console.log(`--- [通用引擎] 正在全局扫描并修复拖拽与点击交互冲突 (根目录: ${rootDir}) ---`);

  const htmlFiles = getAllHtmlFiles(rootDir);
  let checkedCount = 0;
  let fixedFilesCount = 0;

  for (const fullPath of htmlFiles) {
    const relPath = path.relative(rootDir, fullPath);
    let content = fs.readFileSync(fullPath, 'utf-8');
    const original = content;

    // 1. 扫描修复内联 ondragover
    content = content.replace(/ondragover="([^"]*)"/g, (match, body) => {
      checkedCount++;
      if (body.includes('preventDefault')) return match;
      return `ondragover="event.preventDefault(); ${body}"`;
    });

    // 2. 增强 currentTarget 安全访问
    content = content.replace(
      /e\.currentTarget\.classList\.add/g,
      '(e.currentTarget || e.target || this)?.classList?.add'
    );
    content = content.replace(
      /e\.currentTarget\.classList\.remove/g,
      '(e.currentTarget || e.target || this)?.classList?.remove'
    );

    // 3. 扫描同时拥有 draggable="true" 与 onclick 属性的冲突元素
    const hasHybridCards = /<[^>]*draggable=["']true["'][^>]*onclick=[^>]*>|<[^>]*onclick=[^>]*draggable=["']true["'][^>]*>/i.test(content);
    if (hasHybridCards && !content.includes('__dragMovementDetected')) {
      const lastScriptIdx = content.lastIndexOf('</script>');
      if (lastScriptIdx !== -1) {
        content = content.slice(0, lastScriptIdx) + '\n' + DISAMBIGUATION_SCRIPT + '\n' + content.slice(lastScriptIdx);
      }
    }

    if (content !== original) {
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`[成功修复拖拽/点击] ${relPath}`);
      fixedFilesCount++;
    }
  }

  console.log(`拖拽与点击冲突全局体检完成：共扫描 ${checkedCount} 处拖拽节点，自动修复 ${fixedFilesCount} 个文件。\n`);
  return fixedFilesCount;
}

if (require.main === module) {
  run(process.argv[2]);
}

module.exports = { run };
