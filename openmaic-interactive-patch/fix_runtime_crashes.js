const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const crashFixes = [
  {
    relPath: '第14课 复杂系统可分解_SV8n9efWsK/08_调度指挥官：智能家居应急大作战.html',
    desc: 'Guard groupMap[subsystem] in setSubsystemMode to prevent undefined.forEach crash on nextLevel',
    fix: (content) => {
      // Add guard if (!groupMap[subsystem]) return;
      if (content.includes('if (!groupMap[subsystem]) return;')) return content;
      return content.replace(
        /groupMap\[subsystem\]\.forEach\(/g,
        'if (!groupMap[subsystem]) return;\n  groupMap[subsystem].forEach('
      );
    }
  },
  {
    relPath: '9.互传密信有诀窍_2dkXMl8h7V/04_中文方阵：二维置换密信实验室.html',
    desc: 'Fix resetSimulation in 04_中文方阵 to prevent matrix row out of bounds reading map of undefined',
    fix: (content) => {
      // Guard in resetSimulation: check if state.originalMatrix[r] exists
      return content.replace(
        /state\.matrix\.push\(state\.originalMatrix\[r\]\.map\(item => \(\{ \.\.\.item \}\)\)\);/g,
        'if (state.originalMatrix[r]) { state.matrix.push(state.originalMatrix[r].map(item => ({ ...item }))); }'
      ).replace(
        /state\.rows = preset\.rows;\s*state\.cols = preset\.cols;\s*resetSimulation\(\);/g,
        'state.rows = preset.rows;\n      state.cols = preset.cols;\n      buildInitialMatrix();\n      resetSimulation();'
      );
    }
  },
  {
    relPath: '第18课 数据分析与处理_Lf7xf_7GmU/08_决策闯关：植物适居带环境诊断大救援.html',
    desc: 'Guard plant.name in renderCanvas to prevent split on undefined',
    fix: (content) => {
      return content.replace(
        /ctx\.fillText\(`\$\{plant\.name\.split\(' '\)\[0\]\}`/g,
        'ctx.fillText(`${(plant.name || plant.species || "植株").split(" ")[0]}`'
      );
    }
  },
  {
    relPath: '第26课 寻找最短的路径_V3B-ttRgx2/07_动态规划实验台：权值变化与回溯寻径.html',
    desc: 'Guard dpTable access and initialize computeDP before initial resizeCanvas',
    fix: (content) => {
      let updated = content.replace(
        /const dpCost = dpTable\[r\]\[c\];/g,
        'const dpCost = (dpTable[r] && dpTable[r][c] !== undefined) ? dpTable[r][c] : 0;'
      );
      // Ensure computeDP is called before resizeCanvas on startup
      if (updated.includes('resizeCanvas();') && !updated.includes('computeDP();\n    resizeCanvas();')) {
        updated = updated.replace('resizeCanvas();', 'computeDP();\n    resizeCanvas();');
      }
      return updated;
    }
  },
  {
    relPath: '第30课 应对智能新挑战_pgsucLiiNN/07_求真实验室：事实交叉查验模拟器.html',
    desc: 'Ensure roundRect radius in canvas arcTo is non-negative',
    fix: (content) => {
      return content.replace(
        /function roundRect\(ctx,\s*x,\s*y,\s*w,\s*h,\s*r\)\s*\{[\s\S]*?ctx\.beginPath\(\);/g,
        `function roundRect(ctx, x, y, w, h, r) {
      r = Math.max(0, Math.min(r || 0, Math.abs(w) / 2, Math.abs(h) / 2));
      ctx.beginPath();`
      );
    }
  },
  {
    relPath: '第18课 美化网页方法多_sVjRYsvQfH/07_代码工坊：CSS样式实时装配实验室.html',
    desc: 'Wrap iframe document access in try-catch to avoid cross-origin SOP block in file:// scheme',
    fix: (content) => {
      return content.replace(
        /const doc = previewFrame\.contentDocument \|\| previewFrame\.contentWindow\.document;/g,
        `let doc = null;
    try {
      doc = previewFrame.contentDocument || (previewFrame.contentWindow && previewFrame.contentWindow.document);
    } catch (e) {
      // Handled for file:// isolation
    }`
      );
    }
  }
];

function run(targetDir) {
  const rootDir = targetDir ? path.resolve(targetDir) : ROOT_DIR;
  console.log(`--- 正在执行严重运行时崩溃与 Canvas 绘图 Bug 修复 (根目录: ${rootDir}) ---`);
  let fixedCount = 0;

  for (const item of crashFixes) {
    const fullPath = path.join(rootDir, item.relPath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const original = fs.readFileSync(fullPath, 'utf-8');
    const updated = item.fix(original);

    if (original !== updated) {
      fs.writeFileSync(fullPath, updated, 'utf-8');
      console.log(`[成功修复] ${item.relPath} -> ${item.desc}`);
      fixedCount++;
    } else {
      console.log(`[已处于修复状态] ${item.relPath}`);
    }
  }

  console.log(`运行时崩溃修复完成，共修复 ${fixedCount} 个文件。\n`);
  return fixedCount;
}

if (require.main === module) {
  run();
}

module.exports = { run };
