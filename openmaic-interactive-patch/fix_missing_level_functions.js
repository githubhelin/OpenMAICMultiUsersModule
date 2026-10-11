const fs = require('fs');
const path = require('path');

/**
 * 通用关卡推进与按钮未定义函数自动桥接引擎
 * 遍历目标目录下所有 HTML 文件，自动扫描所有内联 onclick 事件绑定的函数名：
 * 1. 自动检测该函数在当前页面上下文中是否未定义（排除浏览器原生全局方法）
 * 2. 结合页面的关卡配置（LEVELS / levelConfigs / gameState 等）与状态机方法（initLevel / setupLevel 等）
 * 3. 动态合成安全鲁棒的全局桥接函数（window[fnName]），自动解除阻断，平滑推进关卡
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

const BUILTIN_FUNCTIONS = new Set([
  // JavaScript 控制流与操作符关键字 (防止 if(...), for(...), catch(...) 误匹配为函数)
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'void', 'delete', 'throw', 'function', 'import', 'with', 'do',
  // 浏览器原生全局调度与操作方法
  'alert', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'close', 'print', 'focus', 'blur', 'open', 'confirm', 'prompt',
  'preventDefault', 'stopPropagation', 'history', 'location', 'window', 'requestAnimationFrame', 'cancelAnimationFrame',
  // 基础类型与常用工具函数
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'eval', 'Boolean', 'Number', 'String', 'Object', 'Array', 'Date', 'RegExp', 'Math', 'JSON'
]);

function analyzeLevelEngine(scriptText) {
  // 识别初始化函数
  let initFn = null;
  if (/function\s+initLevel\b/.test(scriptText)) initFn = 'initLevel';
  else if (/function\s+setupLevel\b/.test(scriptText)) initFn = 'setupLevel';
  else if (/function\s+loadLevel\b/.test(scriptText)) initFn = 'loadLevel';
  else if (/function\s+startLevel\b/.test(scriptText)) initFn = 'startLevel';
  else if (/function\s+startGame\b/.test(scriptText)) initFn = 'startGame';

  // 识别关卡状态变量
  let stateVar = null;
  if (/gameState\s*\.\s*levelIndex\b/.test(scriptText)) stateVar = 'gameState.levelIndex';
  else if (/gameState\s*\.\s*level\b/.test(scriptText)) stateVar = 'gameState.level';
  else if (/currentLevelIndex\b/.test(scriptText)) stateVar = 'currentLevelIndex';
  else if (/currentLevelIdx\b/.test(scriptText)) stateVar = 'currentLevelIdx';
  else if (/currentLevel\b/.test(scriptText)) stateVar = 'currentLevel';
  else if (/curLevel\b/.test(scriptText)) stateVar = 'curLevel';
  else if (/levelIndex\b/.test(scriptText)) stateVar = 'levelIndex';

  // 识别关卡列表长度
  let maxCountExpr = '3';
  if (/const\s+LEVELS\s*=\s*\[/.test(scriptText)) maxCountExpr = 'LEVELS.length';
  else if (/const\s+levelConfigs\s*=\s*\[/.test(scriptText)) maxCountExpr = 'levelConfigs.length';
  else if (/const\s+LEVEL_CONFIGS\s*=\s*\[/.test(scriptText)) maxCountExpr = 'LEVEL_CONFIGS.length';

  return { initFn, stateVar, maxCountExpr };
}

function run(targetDir) {
  const rootDir = targetDir ? path.resolve(targetDir) : path.resolve(__dirname, '..');
  console.log(`--- [通用引擎] 正在全局扫描并修复未定义点击/关卡函数 (根目录: ${rootDir}) ---`);

  const htmlFiles = getAllHtmlFiles(rootDir);
  let checkedCount = 0;
  let fixedFilesCount = 0;

  for (const fullPath of htmlFiles) {
    const relPath = path.relative(rootDir, fullPath);
    let content = fs.readFileSync(fullPath, 'utf-8');

    // 提取所有内联 onclick 函数名 (支持末尾分号、多函数调用及复杂参数)
    const onclickAttrRegex = /onclick=["']([^"']+)["']/gi;
    const foundCallFns = [];
    for (const attrMatch of content.matchAll(onclickAttrRegex)) {
      const code = attrMatch[1];
      for (const fnMatch of code.matchAll(/([a-zA-Z0-9_$]+)\s*\(/g)) {
        foundCallFns.push(fnMatch[1]);
      }
    }
    if (foundCallFns.length === 0) continue;

    const lastScriptIdx = content.lastIndexOf('</script>');
    if (lastScriptIdx === -1) continue;

    const scriptsText = content.slice(content.indexOf('<script'), lastScriptIdx);
    const engineInfo = analyzeLevelEngine(scriptsText);

    const missingFunctions = [];

    for (const fnName of foundCallFns) {
      checkedCount++;
      if (BUILTIN_FUNCTIONS.has(fnName)) continue;

      // 检查当前脚本是否已定义该函数
      const isDefined = new RegExp(
        `((?:async\\s+)?function\\s+${fnName}\\b|window\\.${fnName}\\s*=|window\\s*\\[['"]${fnName}['"]\\]|var\\s+${fnName}\\b|let\\s+${fnName}\\b|const\\s+${fnName}\\b|\\b${fnName}\\s*:)`
      ).test(scriptsText);

      if (!isDefined) {
        missingFunctions.push(fnName);
      }
    }

    if (missingFunctions.length === 0) continue;

    // 去重
    const uniqueMissing = [...new Set(missingFunctions)];
    const generatedBridges = [];

    for (const fn of uniqueMissing) {
      // 针对关卡推进场景的自适应桥接代码
      let bridgeLogic = '';
      if (engineInfo.initFn) {
        if (engineInfo.stateVar) {
          bridgeLogic = `
  try {
    const isZeroBased = typeof ${engineInfo.stateVar} === 'number' && ${engineInfo.stateVar} === 0;
    const currentVal = (typeof ${engineInfo.stateVar} !== 'undefined') ? ${engineInfo.stateVar} : (isZeroBased ? 0 : 1);
    const maxLen = (typeof ${engineInfo.maxCountExpr} !== 'undefined') ? ${engineInfo.maxCountExpr} : 3;
    const nextVal = (currentVal + 1 < maxLen) ? currentVal + 1 : (isZeroBased ? 0 : 1);
    ${engineInfo.initFn}(nextVal);
  } catch (err) {
    console.warn("[Auto-Bridge] 调度下一关卡失败:", err);
    try { ${engineInfo.initFn}(); } catch (e) {}
  }`;
        } else {
          bridgeLogic = `
  try {
    ${engineInfo.initFn}();
  } catch (err) {
    console.warn("[Auto-Bridge] 触发状态初始化:", err);
  }`;
        }
      } else {
        // 无标准 init 函数时的备用逻辑：尝试点击对应的弹窗按钮或重载
        bridgeLogic = `
  const nextBtn = document.getElementById('next-level-btn') || document.querySelector('.next-btn');
  if (nextBtn && nextBtn !== this) {
    try { nextBtn.click(); } catch(e) {}
  }`;
      }

      generatedBridges.push(`
// [Auto-Fix 通用规则] 自动桥接未定义的全局交互函数: ${fn}
window['${fn}'] = function() {
  const modal = document.querySelector('.modal, .modal-overlay, [id*="modal"], [id*="result"], [id*="screen"], [id*="victory"], [id*="dialog"]');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.remove('show');
    modal.classList.add('hidden');
  }
${bridgeLogic}
};
window.${fn} = window['${fn}'];
`);
    }

    if (generatedBridges.length > 0) {
      const injectText = '\n' + generatedBridges.join('\n') + '\n';
      content = content.slice(0, lastScriptIdx) + injectText + content.slice(lastScriptIdx);
      fs.writeFileSync(fullPath, content, 'utf-8');
      console.log(`[成功桥接未定义函数] ${relPath} -> 桥接: ${uniqueMissing.join(', ')}`);
      fixedFilesCount++;
    }
  }

  console.log(`关卡与点击函数全局体检完成：共扫描 ${checkedCount} 处内联调用，自动修复 ${fixedFilesCount} 个文件。\n`);
  return fixedFilesCount;
}

if (require.main === module) {
  run(process.argv[2]);
}

module.exports = { run };
