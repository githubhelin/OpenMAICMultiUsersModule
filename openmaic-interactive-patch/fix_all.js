/**
 * HuDongJianRong 交互课件一键批量自动化修复调度器 (通用跨工程引擎)
 * 支持对当前项目，或通过参数传入的任意外部课程目录执行一键全量体检与修复。
 * 
 * 用法:
 *   node repair-toolkit/fix_all.js                # 扫描当前项目所有课程
 *   node repair-toolkit/fix_all.js /path/to/dir   # 扫描任意指定目录下的所有 HTML 课件
 */

const path = require('path');
const fixJson = require('./fix_json_syntax_errors');
const fixLevels = require('./fix_missing_level_functions');
const fixCrashes = require('./fix_runtime_crashes');
const fixDnd = require('./fix_drag_drop_conflicts');
const fixSandbox = require('./fix_sandbox_and_storage');
const fixTouch = require('./fix_touch_compatibility');

function runAll(targetDir) {
  const target = targetDir ? path.resolve(targetDir) : path.resolve(__dirname, '..');

  console.log('====================================================');
  console.log('   HuDongJianRong 交互课件库自动化批量修复程序');
  console.log(`   目标扫描根目录: ${target}`);
  console.log('====================================================\n');

  const start = Date.now();

  const countJson = fixJson.run(target);
  const countLevels = fixLevels.run(target);
  const countCrashes = fixCrashes.run(target);
  const countDnd = fixDnd.run(target);
  const countSandbox = fixSandbox.run(target);
  const countTouch = fixTouch.run(target);

  const total = countJson + countLevels + countCrashes + countDnd + countSandbox + countTouch;
  const elapsed = ((Date.now() - start) / 1000).toFixed(2);

  console.log('====================================================');
  console.log(`✅ 通用批量修复全部执行完毕！`);
  console.log(`- 修复非法 JSON 语法: ${countJson} 项`);
  console.log(`- 修复关卡切换缺失函数: ${countLevels} 项`);
  console.log(`- 修复运行时崩溃与 Canvas 异常: ${countCrashes} 项`);
  console.log(`- 修复拖拽放置与点击冲突: ${countDnd} 项`);
  console.log(`- 注入沙箱环境与 Storage/Alert/Audio 安全守卫: ${countSandbox} 项`);
  console.log(`- 注入触屏/电子白板拖拽兼容 Polyfill: ${countTouch} 项`);
  console.log(`总耗时: ${elapsed} 秒，本次累计生效修复项: ${total} 项`);
  console.log('====================================================\n');

  return { countJson, countLevels, countCrashes, countDnd, countSandbox, countTouch, total, elapsed };
}

if (require.main === module) {
  runAll(process.argv[2]);
}

module.exports = { runAll };
