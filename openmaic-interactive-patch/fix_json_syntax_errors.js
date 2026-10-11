const fs = require('fs');
const path = require('path');

/**
 * 通用嵌入式 JSON 语法与格式自动纠错引擎
 * 遍历目标目录下所有 HTML 文件，检测 <script type="application/json"> 配置块：
 * 1. 自动识别未加双引号的键名（如 label: "..." -> "label": "..."）
 * 2. 自动修正键名重复/拼写错乱（如 "id": "n6": "n6" -> "id": "n6"）
 * 3. 自动去除尾随逗号（Trailing commas）
 * 4. 修复后自动调用原生 JSON.parse 进行严格语法断言，验证通过才落盘保存
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

function tryRepairJson(raw) {
  // 规则 1: 修复未带双引号的对象键名，例如: label: "..." 或 isExternal: false
  let repaired = raw.replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, (match, prefix, key) => {
    // 排除已经是布尔值或特殊值的误伤
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

function run(targetDir) {
  const rootDir = targetDir ? path.resolve(targetDir) : path.resolve(__dirname, '..');
  console.log(`--- [通用引擎] 正在全局扫描并修复 JSON 语法错误 (根目录: ${rootDir}) ---`);

  const htmlFiles = getAllHtmlFiles(rootDir);
  let checkedCount = 0;
  let fixedCount = 0;

  for (const fullPath of htmlFiles) {
    const relPath = path.relative(rootDir, fullPath);
    const content = fs.readFileSync(fullPath, 'utf-8');

    // 匹配所有 application/json 脚本块
    const scriptRegex = /<script\b([^>]*type=["']application\/json["'][^>]*)>([\s\S]*?)<\/script>/gi;
    let hasChange = false;

    const updatedContent = content.replace(scriptRegex, (match, attrs, rawJson) => {
      checkedCount++;
      const trimmed = rawJson.trim();
      if (!trimmed) return match;

      try {
        JSON.parse(trimmed);
        return match; // 原本即合法，无需修改
      } catch (err) {
        // 尝试自动修复
        const repaired = tryRepairJson(rawJson);
        try {
          JSON.parse(repaired.trim());
          console.log(`[成功修复 JSON] ${relPath} -> 原错误: ${err.message}`);
          hasChange = true;
          fixedCount++;
          return `<script${attrs}>${repaired}</script>`;
        } catch (repairErr) {
          console.warn(`[无法自动修复 JSON] ${relPath}: ${repairErr.message}`);
          return match;
        }
      }
    });

    if (hasChange) {
      fs.writeFileSync(fullPath, updatedContent, 'utf-8');
    }
  }

  console.log(`JSON 全局体检完成：共扫描 ${checkedCount} 处 JSON 节点，自动修复 ${fixedCount} 个文件。\n`);
  return fixedCount;
}

if (require.main === module) {
  run(process.argv[2]);
}

module.exports = { run };
