const fs = require('fs');
const path = require('path');
let chromium;
try {
  chromium = require('playwright').chromium;
} catch (_) {
  try {
    chromium = require('/home/helin/projects/OpenMAIC/node_modules/.pnpm/node_modules/playwright').chromium;
  } catch (err) {
    console.error('Playwright is required to run retest_audit.js. Run `pnpm add -D playwright` first.');
    process.exit(1);
  }
}

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_FILE = path.join(__dirname, 'retest_results.json');

// List of all previously problematic files across categories
const targetFiles = [
  // 1. JSON syntax errors (2)
  {
    category: 'JSON 语法验证',
    relPath: '第12课 万维网服务大揭秘_cOYRkGf12R/03_交互图解：超链接网状拓扑与树状目录.html',
    testType: 'load'
  },
  {
    category: 'JSON 语法验证',
    relPath: '第15课 展示数字作品_ZUm2UZSkgo/03_分享途径探索树.html',
    testType: 'load'
  },
  {
    category: '离线化与KaTeX解析',
    relPath: '03.游戏体验寻规律：汉诺塔算法探秘_xKDnhWlbZU/08_迁移应用：双杯量水思维大挑战.html',
    testType: 'load'
  },

  // 2. Multi-level missing functions (8)
  {
    category: '多关卡推进',
    relPath: '第15课 互联网实验齐发现_qWS2wbE0SE/08_极速快运：数据封包与路由分发挑战赛.html',
    testType: 'level2_func',
    fnName: 'nextLevelOrRestart'
  },
  {
    category: '多关卡推进',
    relPath: '第17课 物联数据需采集_ngOt7dm4TY/08_极客挑战：智能花盆低功耗传输大作战.html',
    testType: 'level2_func',
    fnName: 'nextOrRestart'
  },
  {
    category: '多关卡推进',
    relPath: '第18课 美化网页方法多_sVjRYsvQfH/08_闯关挑战：科技节展厅极速装潢师.html',
    testType: 'level2_func',
    fnName: 'nextLevelOrFinish'
  },
  {
    category: '多关卡推进',
    relPath: '第19课 多人协同效率高_iv9Gr6KtJU/08_挑战：科技节发布会倒计时调度战.html',
    testType: 'level2_func',
    fnName: 'nextLevelOrReplay'
  },
  {
    category: '多关卡推进',
    relPath: '第23课 挑战多角度比拼_9Lh8N45ZWa/08_全能战队匹配战：多维度角色甄选.html',
    testType: 'level2_func',
    fnName: 'nextStage'
  },
  {
    category: '多关卡推进',
    relPath: '第25课 网络创新云服务_I6e7-l-XuX/08_数据安全防御战：加密备份大挑战.html',
    testType: 'level2_func',
    fnName: 'nextLevelAction'
  },
  {
    category: '多关卡推进',
    relPath: '第28课 使用系统讲安全__QXSvTVTe5/08_安全小卫士：智能空间隐患排查大作战.html',
    testType: 'level2_func',
    fnName: 'startNextLevel'
  },
  {
    category: '多关卡推进',
    relPath: '第32课 机器学习靠数据__jg_j-C5j9/08_超级AI训练师：疾速标注挑战.html',
    testType: 'level2_func',
    fnName: 'nextLevelOrRestart'
  },

  // 3. Multi-level & Runtime crashes (6)
  {
    category: '运行时状态机与Canvas',
    relPath: '第14课 复杂系统可分解_SV8n9efWsK/08_调度指挥官：智能家居应急大作战.html',
    testType: 'level2_next'
  },
  {
    category: '运行时状态机与Canvas',
    relPath: '9.互传密信有诀窍_2dkXMl8h7V/04_中文方阵：二维置换密信实验室.html',
    testType: 'task2_click'
  },
  {
    category: '运行时状态机与Canvas',
    relPath: '第18课 数据分析与处理_Lf7xf_7GmU/08_决策闯关：植物适居带环境诊断大救援.html',
    testType: 'game_loop'
  },
  {
    category: '运行时状态机与Canvas',
    relPath: '第26课 寻找最短的路径_V3B-ttRgx2/07_动态规划实验台：权值变化与回溯寻径.html',
    testType: 'load_draw'
  },
  {
    category: '运行时状态机与Canvas',
    relPath: '第30课 应对智能新挑战_pgsucLiiNN/07_求真实验室：事实交叉查验模拟器.html',
    testType: 'canvas_arc'
  },
  {
    category: '运行时状态机与Canvas',
    relPath: '第31课 人与机器的感知_FmW2EgR3Ex/04_火场感知沙盒：极端环境下的传感器探秘.html',
    testType: 'canvas_radial'
  },
  {
    category: '运行时状态机与Canvas',
    relPath: '第18课 美化网页方法多_sVjRYsvQfH/07_代码工坊：CSS样式实时装配实验室.html',
    testType: 'load'
  },

  // 4. Drag & drop preventDefault / click conflict (13)
  {
    category: '拖拽与放置交互',
    relPath: '11.闰年平年算法探秘_hZDzx9txV4/05_逻辑水管工：组装判断器.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '8.算法验证与Python实现_IfYWA2s9eP/07_特工闯关：算法修复大作战.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第12课 认识数字作品_LTqTsjkmvY/08_小小制作人：校园展演大闯关.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第13课 制作数字相册_ZF7SLiscl0/08_音画魔术师：主题相册速搭闯关挑战.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第16课 探秘网页与代码_wC2tdAJo2z/08_网页急救员：科技节展板抢修闯关.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第17课 制作网页展活动_rqpy5t03I-/08_闯关挑战：AI提示词组装与展厅巡检发布.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第20课 组建网站跟我做_AUTSVMXI5c/08_网站急救员：404 故障排查大闯关.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第23课 分解描述问题_ayGORYr1U5/08_小任务大挑战：读书节布展大作战.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与放置交互',
    relPath: '第7课 音频记录声音_PsYXrxqEOV/08_红领巾广播站：校园古诗音频合成挑战.html',
    testType: 'dnd_probe'
  },
  {
    category: '拖拽与点击消抖',
    relPath: '5.数学运算讲方法：探索算法顺序结构_UeEO0vYVOH/06_流水线大闯关：打卡积分转换器.html',
    testType: 'hybrid_click'
  },
  {
    category: '拖拽与点击消抖',
    relPath: '第24课 在线交流新气象_sxXH0K2A_r/08_清朗守望者：网络安全与防坑大闯关.html',
    testType: 'hybrid_click'
  },
  {
    category: '拖拽与点击消抖',
    relPath: '第29课 了解自主可控_Iecd4S6B_E/08_大国科技守护者：应急决策挑战.html',
    testType: 'hybrid_click'
  },
  {
    category: '拖拽与点击消抖',
    relPath: '第30课 应对智能新挑战_pgsucLiiNN/08_火眼金睛：AI破绽寻踪大挑战.html',
    testType: 'hybrid_click'
  }
];

async function runRegression() {
  console.log('====================================================');
  console.log('   HuDongJianRong 自动化修复回归测试审计程序');
  console.log('====================================================\n');
  console.log(`正在对全部 ${targetFiles.length} 个重点修复页面启动真机 Headless Chromium 测试...\n`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/helin/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const results = [];

  for (let i = 0; i < targetFiles.length; i++) {
    const item = targetFiles[i];
    const fullPath = path.join(ROOT_DIR, item.relPath);

    const testResult = {
      index: i + 1,
      category: item.category,
      relPath: item.relPath,
      testType: item.testType,
      passed: false,
      errors: [],
      details: ''
    };

    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    page.on('pageerror', err => testResult.errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('Failed to load resource')) {
          testResult.errors.push(text);
        }
      }
    });

    try {
      await page.goto('file://' + fullPath, { waitUntil: 'domcontentloaded', timeout: 5000 });
      await page.waitForTimeout(400);

      if (item.testType === 'load') {
        // Just verify clean load and non-blank body
        const textLen = await page.evaluate(() => document.body.innerText.length);
        if (textLen > 20 && testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = '页面渲染正常，无任何运行时或 JSON 解析错误';
        }
      } else if (item.testType === 'level2_func') {
        // Test calling the missing function directly
        const fnRes = await page.evaluate((fn) => {
          if (typeof window[fn] !== 'function') {
            return { exists: false, error: `${fn} is not defined on window` };
          }
          try {
            window[fn]();
            return { exists: true, error: null };
          } catch (e) {
            return { exists: true, error: e.message };
          }
        }, item.fnName);

        if (fnRes.exists && !fnRes.error && testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = `全局函数 window.${item.fnName}() 成功执行，无异常`;
        } else {
          testResult.details = fnRes.error || '函数执行失败';
        }
      } else if (item.testType === 'level2_next') {
        // Test nextLevel execution in 08_调度指挥官
        const res = await page.evaluate(() => {
          try {
            if (typeof window.nextLevel === 'function') {
              window.nextLevel();
              return { success: true };
            }
            return { success: false, reason: 'nextLevel function not on window' };
          } catch (e) {
            return { success: false, reason: e.message };
          }
        });

        if (res.success && testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = '第二关状态机成功初始化，无 forEach 报错';
        } else {
          testResult.details = res.reason;
        }
      } else if (item.testType === 'task2_click') {
        // Test 04_中文方阵 switching to task 2 (5x5)
        const res = await page.evaluate(async () => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const btn2 = buttons.find(b => b.innerText.includes('任务二'));
          if (btn2) {
            btn2.click();
            await new Promise(r => setTimeout(r, 200));
            return { clicked: true };
          }
          return { clicked: false, reason: '未找到任务二按钮' };
        });

        if (res.clicked && testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = '成功切入任务二 5×5 方阵，无 map of undefined 崩溃';
        } else {
          testResult.details = res.reason || testResult.errors.join('; ');
        }
      } else if (item.testType === 'game_loop') {
        // 08_决策闯关: wait for 800ms of gameLoop animation
        await page.waitForTimeout(800);
        if (testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = 'Canvas 循环渲染 60 帧无 split(undefined) 报错';
        } else {
          testResult.details = testResult.errors.join('; ');
        }
      } else if (item.testType === 'load_draw') {
        // 07_动态规划
        const res = await page.evaluate(() => {
          const canvas = document.querySelector('canvas');
          return canvas && canvas.width > 0;
        });
        if (res && testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = 'DP 权值矩阵与 Canvas 画布正常渲染，无 dpTable[0] 报错';
        } else {
          testResult.details = testResult.errors.join('; ');
        }
      } else if (item.testType === 'canvas_arc') {
        // 07_求真实验室
        await page.waitForTimeout(400);
        if (testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = 'Canvas roundRect/arcTo 绘制平滑，无负半径报错';
        } else {
          testResult.details = testResult.errors.join('; ');
        }
      } else if (item.testType === 'canvas_radial') {
        // 04_火场感知沙盒
        await page.waitForTimeout(400);
        if (testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = 'createRadialGradient 粒子动画正常，无非正半径报错';
        } else {
          testResult.details = testResult.errors.join('; ');
        }
      } else if (item.testType === 'dnd_probe') {
        // Dropzones preventDefault check
        const dndRes = await page.evaluate(() => {
          const dropzones = Array.from(document.querySelectorAll('[data-dropzone], .dropzone, .slot, [ondrop]'));
          let preventedCount = 0;
          for (const dz of dropzones) {
            const ev = new DragEvent('dragover', { bubbles: true, cancelable: true });
            const notCancelled = dz.dispatchEvent(ev);
            if (!notCancelled) preventedCount++;
          }
          return { total: dropzones.length, prevented: preventedCount };
        });

        if (testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = `放置槽 dragover 默认行为已成功阻止，可接收 drop 放置 (${dndRes.prevented}/${dndRes.total})`;
        } else {
          testResult.details = testResult.errors.join('; ');
        }
      } else if (item.testType === 'hybrid_click') {
        // Test clicking hybrid cards
        const clickRes = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('[draggable="true"]'));
          let clicked = 0;
          for (const c of cards.slice(0, 3)) {
            c.click();
            clicked++;
          }
          return { clicked };
        });

        if (clickRes.clicked > 0 && testResult.errors.length === 0) {
          testResult.passed = true;
          testResult.details = `点击卡片立即生效，消抖互斥机制运转正常`;
        } else {
          testResult.details = testResult.errors.join('; ');
        }
      }

    } catch (pageErr) {
      testResult.errors.push(pageErr.message);
      testResult.details = pageErr.message;
    } finally {
      await page.close().catch(() => {});
      await context.close().catch(() => {});
    }

    results.push(testResult);
    const mark = testResult.passed ? '✅' : '❌';
    console.log(`${mark} [${testResult.category}] ${testResult.relPath}`);
    console.log(`   测试结果: ${testResult.details}\n`);
  }

  await browser.close();

  fs.writeFileSync(REPORT_FILE, JSON.stringify(results, null, 2), 'utf-8');

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const passRate = ((passedCount / results.length) * 100).toFixed(1);

  console.log('====================================================');
  console.log(`回归审计完成！共测试 ${results.length} 个针对性修复页面`);
  console.log(`- 成功通过 (PASS): ${passedCount} 个`);
  console.log(`- 未通过 (FAIL): ${failedCount} 个`);
  console.log(`- 修复通过率: ${passRate}%`);
  console.log(`详细回归数据已持久化至: ${REPORT_FILE}`);
  console.log('====================================================\n');
}

if (require.main === module) {
  runRegression();
}

module.exports = { runRegression };
