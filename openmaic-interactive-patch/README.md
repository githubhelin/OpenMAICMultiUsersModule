# OpenMAIC 互动课件自动化自愈与质检补丁 (Interactive Courseware Patch)

本目录为针对多智能体协作生成平台（OpenMAIC）生成的独立单文件互动课件所设计的**全维自动化质检、防御加固与自愈补丁工具箱**。

> 📖 **针对 AI Agent / 开发者的集成规格书**：  
> 若要将本补丁作为过滤器集成到 OpenMAIC 的批量生成或互动展厅导出管道，请直接查阅 **👉 [OPENMAIC_INTEGRATION_GUIDE.md](./OPENMAIC_INTEGRATION_GUIDE.md)**。

---

## 📂 补丁目录架构

```text
openmaic-interactive-patch/
├── README.md                      # 本文档：补丁背景、原理与快速上手
├── OPENMAIC_INTEGRATION_GUIDE.md  # 【核心】Agent/工程人员专属的 OpenMAIC 集成规格书
├── AUDIT_REPORT.md                # 全库 747 个课件的端到端代码审计报告 (100% PASS)
├── fix_all.js                     # 【一键全量修复】主入口调度脚本
├── fix_json_syntax_errors.js      # 模块1：内置 JSON 语法与格式自动纠错
├── fix_missing_level_functions.js # 模块2：多关卡切换缺失函数（nextLevel 等）自动桥接
├── fix_runtime_crashes.js         # 模块3：Canvas 绘图负半径、数据越界与运行时崩溃保护
├── fix_drag_drop_conflicts.js     # 模块4：HTML5 拖拽 drop 丢弃与 click 混用冲突消抖
├── fix_sandbox_and_storage.js     # 模块5：沙箱环境安全防御（LocalStorage/Alert/Audio 降级垫片）
├── fix_touch_compatibility.js     # 模块6：移动端与智慧电子白板（希沃/鸿合/iPad）触控拖拽 Polyfill
├── retest_audit.js                # 【自动化回归测试】Playwright 真机无头浏览器审计程序
└── retest_results.json            # 31 个重点页面真机自动化回归测试记录 (100.0% PASS)
```

---

## 🛠️ 针对的核心缺陷与修复原理

### 6. 沙箱受限 Iframe / 隐私浏览环境存储与弹窗崩溃
* **缺陷现象**：课件被嵌入受限沙箱 iframe（如未配置 `allow-same-origin` 或 `allow-modals`）时，启动即报 `DOMException: Access is denied for localStorage`，或过关弹出 `alert()` 时报 `Blocked a call to 'alert'`，直接导致整页主脚本挂死中断。
* **产生原因**：大模型习惯在单文件中直接使用 `localStorage.setItem` 记录高分，以及用 `alert()` 提示通关，缺乏在现代安全沙箱体系下的降级防御。
* **修复模块**：[`fix_sandbox_and_storage.js`](./fix_sandbox_and_storage.js)
* **修复逻辑**：在 `<head>` 最前端注入 `openmaic-sandbox-safe-guard`，提供内存级 Map Storage 垫片与非阻塞 Toast 弹窗降级，同时对 Web Audio (`AudioContext`) 注入用户首触自动解锁，确保 100% 零抛错运行。

### 7. 智慧教室电子白板与平板触控拖拽失灵（Touch 无响应）
* **缺陷现象**：在中小学智慧教室的**希沃（Seewo）/ 鸿合触摸一体机或 iPad/安卓平板**上，学生用手指无法拖动卡片。
* **产生原因**：大模型生成的拖拽代码 100% 依赖 W3C HTML5 Drag and Drop 原生 API（`draggable="true"`, `ondragstart`），而移动端触屏浏览器默认将触控手势识别为页面滚动或缩放，原生并不派发 `dragstart` 等事件。
* **修复模块**：[`fix_touch_compatibility.js`](./fix_touch_compatibility.js)
* **修复逻辑**：注入轻量级 `Touch-to-Drag Polyfill`，当检测到触控环境时，拦截 `touchstart`/`touchmove`/`touchend`，动态计算位移、派发合成 Drag/Drop 事件并渲染跟随手势的视觉半透明克隆镜像，让课件在触摸大屏上像电脑鼠标一样丝滑可用。

### 1. 多关卡流转中断（第二关无法进入 / 卡关）
* **缺陷现象**：学生通关第一关后，结算弹窗中的“进入下一关”按钮点击无反应，控制台抛出 `ReferenceError: nextLevelOrRestart is not defined`。
* **产生原因**：课件模板中 HTML 按钮硬编码了 `onclick="nextLevelOrRestart()"`，但底部的 `<script>` 仅对 DOM 对象动态赋值了 `nextBtn.onclick`，未在全局 `window` 域暴露同名函数，导致内联事件取值失败报错。
* **修复模块**：[`fix_missing_level_functions.js`](./fix_missing_level_functions.js)
* **修复逻辑**：在脚本末尾自动注入全局安全的 `window[fnName]` 桥接实现，自适应调用关卡初始化方法 `initLevel(nextIdx)`，确保按钮无论是点击、键盘触发还是脚本调用均能平滑切入下一关。

### 2. 放置目标（Dropzone）拖拽失效与丢弃
* **缺陷现象**：学生把卡片拖动到目标插槽上松开鼠标，卡片直接弹回原位，无法放置。
* **产生原因**：W3C HTML5 Drag and Drop 规范严格规定：**浏览器默认禁止在任何 DOM 节点上释放（Drop），只有在 `dragover` 事件中显式执行 `event.preventDefault()`，浏览器才会允许触发后续的 `drop` 事件**。生成脚本中许多放置槽仅监听了样式变化，遗漏了 `preventDefault`。
* **修复模块**：[`fix_drag_drop_conflicts.js`](./fix_drag_drop_conflicts.js)
* **修复逻辑**：批量扫描所有槽位节点，将 `ondragover="xxx(event)"` 自动升级为 `ondragover="event.preventDefault(); xxx(event)"`，并为 `currentTarget` 添加安全可选链。

### 3. 点击（Click）与拖拽（Drag）事件竞争冲突
* **缺陷现象**：同一个卡片既支持点击装备，又支持拖拽放入，但学生点击时容易被误判为拖拽，导致点击操作无响应；或拖拽完成时误触发点击。
* **修复模块**：[`fix_drag_drop_conflicts.js`](./fix_drag_drop_conflicts.js)
* **修复逻辑**：自动注入拖拽消抖拦截器，记录 `dragstart` 的位移起始点；若鼠标释放时的移动距离低于阈值（如 `< 5px`），判定为纯点击并放行；若移动距离大于阈值，则自动抑制点击冒泡，避免动作串扰。

### 4. 嵌入式 JSON 语法非法导致整页白屏
* **缺陷现象**：页面启动时执行 `JSON.parse` 抛出 `SyntaxError`，拓扑图或流程树完全无法渲染。
* **产生原因**：大模型生成 `<script id="widget-config" type="application/json">` 时，偶现未加双引号的键名（如 `label:`）或结构错误（如 `"id": "n6": "n6"`）。
* **修复模块**：[`fix_json_syntax_errors.js`](./fix_json_syntax_errors.js)
* **修复逻辑**：精准模式匹配并自动替换为合法的标准 JSON 格式，修复后立即调用 `JSON.parse()` 严格校验，校验失败自动回滚。

### 5. Canvas 2D 绘图负半径与数据边界崩溃
* **缺陷现象**：Canvas 画面闪烁后停止渲染，报错 `Failed to execute 'arcTo': The radius provided is negative` 或 `Cannot read properties of undefined`。
* **产生原因**：自适应圆角卡片或径向渐变（`createRadialGradient`）计算中，极端宽高差或粒子衰减导致半径计算出负值；动态矩阵变换中未初始化的状态被前置读取。
* **修复模块**：[`fix_runtime_crashes.js`](./fix_runtime_crashes.js)
* **修复逻辑**：统一为 Canvas 关键尺寸加入 `Math.max(0, ...)` / `Math.max(0.1, ...)` 钳位保护，并调整矩阵初始化与绘制的执行次序。

---

## 🚀 快速上手使用指南

### 环境依赖
- **Node.js** >= v18.0.0
- **Playwright**（用于执行真机无头回归测试，复用 OpenMAIC 环境即可）

### 1. 执行全量一键修复
在项目根目录或工具箱目录下直接运行：
```bash
node repair-toolkit/fix_all.js
```
控制台将按模块顺序输出每个文件的修复详情及累计生效项。

### 2. 执行回归测试审计
修复完成后，运行回归审计程序启动真机 Chromium 浏览器逐一验证：
```bash
NODE_PATH=/home/helin/projects/OpenMAIC/node_modules/.pnpm/node_modules node repair-toolkit/retest_audit.js
```
测试结果将输出直观的 `✅ PASS` / `❌ FAIL` 清单，并在 [`retest_results.json`](./retest_results.json) 中留存完整记录。

---

## 🔗 与个人工作流工具集 ([somePath](https://github.com/githubhelin/somePath)) 的协同维护

如需将本工具箱的修复能力同步到个人工具库 [githubhelin/somePath](https://github.com/githubhelin/somePath)：
1. 本目录下的脚本均为自包含标准 Node.js 模块，路径依赖已通过 `path.resolve(__dirname, '..')` 相对解耦。
2. 可直接将 `repair-toolkit/` 整体软链接或拷贝至 `somePath/openmaic-course-patch/` 作为通用课件质检修复插件维护。
