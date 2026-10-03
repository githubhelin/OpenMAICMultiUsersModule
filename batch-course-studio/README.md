# 🎓 OpenMAIC 批量制课工坊扩展补丁 (Batch Course Studio)

[![OpenMAIC](https://img.shields.io/badge/OpenMAIC-v1.1.2-blue?style=flat-square)](https://github.com/THU-MAIC/OpenMAIC)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](../LICENSE)

本模块是针对清华大学开源项目 [**THU-MAIC/OpenMAIC**](https://github.com/THU-MAIC/OpenMAIC) 的**全自动批量制课工坊扩展**。

它专为**“跳过耗时的交互对话生成步骤、纯粹聚焦于文档课件批量自动化制作”**的生产级场景设计。

---

## 🌟 核心特性 (Features)

### 1. 多格式文件解析与开箱即用集成
- **全格式支持**：支持上传 `.pptx`、`.pdf`、`.docx`、`.txt`、`.md` 多种格式课件与资料。
- **PPTX 隔离工作线程解析**：通过 Worker Thread 独立隔离解析 PPTX 课件幻灯片大纲与图文，避免主事件循环阻塞。
- **原生继承 MinerU 高精度文档解析**：PDF 与 Word 文档自动走 OpenMAIC 系统已配置的 MinerU 服务进行高精度版面分析与图文提取。
- **系统全局配置自动继承**：完全无缝继承 OpenMAIC 管理员在系统设置中配置的默认大模型（如 DeepSeek、Claude、OpenAI、Qwen、Gemini 等）、TTS 语音音色、生图模型等参数。

### 2. 双重制课模式与深度交互 (Dual Generation Modes & Deep Interactive)
- **模式 A：多课件融合为一门课 (`single_merged`)**
  - 上传一个或多个课件/资料，系统将自动汇聚提炼所有文档核心内容，自动梳理章节脉络并合成一门结构完备、连贯深入的综合性交互大课。
- **模式 B：独立课件批量并发生成 (`batch_independent`)**
  - 上传 $N$ 个课件/资料文件，系统为**每一个文件独立生成一节对应的完整课程**。
  - 适用于教师或培训机构一次性将整学期的 PPT 或讲义批量转换为互动课件。
- **真·深度交互模式开关 (Deep Interactive Mode)**：
  - 与官方生成主页能力完全对齐。深度打通官方 `PROMPT_IDS.INTERACTIVE_OUTLINES` 模版，硬性规约**全课 70% 以上必须为互动场景**（物理/科学过程仿真模拟器 `simulation`、趣味闯关小游戏 `game`、动态结构分析图解 `diagram` 等），仅保留 30% 用于导读与总结。
  - 内置**防降级保护机制（Fallback Protection）**，严格补全 `widgetType` 与 `widgetOutline`，杜绝大模型输出缺失配置导致误降级为普通幻灯片（Slide）。

### 3. 三档课程规格与教学形态 (3-Tier Course Scale & Pedagogical Profiles)
- **⚡ 微课精讲 (`micro` / 6~8 页)**：
  - 聚焦单一难点、公式或关键机制，直奔主题，严格遵循 OpenMAIC 标准教学闭环。
  - 结构配比：1页情境导入 -> 2页核心精讲 -> 1~2个交互模拟探究 -> 1次过关小测 -> 1页速记总结卡。
- **🎯 标准课时 (`standard` / 10~13 页，默认)**：
  - 经典完整认知闭环课堂，平衡理论推导、探索实验与实战测评。
  - 结构配比：1页情境导入 -> 3~4页概念与机制精讲 -> 2~3个互动探究实验/练习 -> 2次随堂小测 -> 1页拓展辨析 -> 1页总结复盘。
- **📚 专题大课 (`thematic` / 16~20 页)**：
  - 单元综合复习、系统工程仿真与跨知识点深度实战，分阶段阶梯推进。
  - 结构配比：全课路线图宏观导引 -> 5~6页多层次理论精讲 -> 4~5个深度互动实验/算法可视化沙箱 -> 2~3次分段闯关小测 -> 经验迁移拓展 -> 终极知识图谱收官。
- **全平台协同支持**：
  - **官方常规主页**：在输入框工具栏提供精致的胶囊下拉菜单，记住用户偏好；
  - **批量制课工作台**：提供可视化单选卡片，支持一次性批量应用到所有文件；
  - **底层标准化注入**：无论是否开启深度交互模式，均能自动按对应的结构与比例指导大模型规划大纲。

### 4. 🏷️ 系列课程防碰撞与教学教研小测防扎堆优化
- **系列课程 Part/集数编号严格保护**：
  - 在生成课程大纲标题时，自动智能识别并保留原始文件名或输入资料中的集数、课次编号（如 `第14课`、`Part 2` 等），杜绝因大模型过度抽象导致同一系列多个课件生成完全相同的名称而发生覆盖或冲突。
- **分段小测穿插与防连续扎堆机制**：
  - 遵循现代教育认知心理学规范，严格禁止大模型将多个小测验（Quiz）连续堆叠输出；
  - 强制规约测验场景必须与概念精讲、互动探究场景交替穿插，并在最后一页完整生成总结收尾结算页（`classroom-complete`）。
- **专业信息科技/创客交互提示词深度对齐**：
  - 严格落地“探究导入 ➔ 概念拆解 ➔ 核心互动体验 ➔ 任务式闯关 ➔ 总结归纳”五步法，提供高参与度探究式引导脚本。

### 5. 任务中断、队列删除与 Token 资源保护
- **一键中断任务 (`Cancel Job`)**：
  - 在生成过程中若发现提示词不理想或需临时终止，可点击看板上的 **「中断任务 (停止消耗 Token)」** 按钮；
  - 后台立即触发 `AbortController` 终止进行中的网络与大模型请求，并将所有待处理课件状态设置为 `cancelled`，**即刻停止后续 Token 消耗**。
- **队列文件精准移除 (`Queue Removal`)**：
  - 在批量独立生成模式下，排队中的课件卡片均提供 **「从队列移除」** 按钮；
  - 用户可随时从待生成队列中单独移除不想生成的某个课件，而不影响其他文件的正常生产。
- **历史记录安全删除 (`Delete Record`)**：
  - 已完成、已取消或失败的批处理记录支持一键清理，并自动销毁服务器上的临时解析缓存文件。

### 6. 全自动批次串行排队调度机制 (FIFO Serial Queue Scheduler)
- **跨批次严格串行化执行**：支持用户连续提交多个批量制课批次。系统后台全局维护 FIFO 串行任务队列，前序批次全部执行完毕（或手动取消）后自动无缝拉起下一个批次，杜绝多个批次并发运行造成的 API 限流与服务器超载。
- **课件安全暂存与前端零依赖**：文件上传后安全保存在服务器本地临时存储，由后台 PM2 守护进程接管流水线，用户随时可以关闭监控网页，后台持续稳定生成。
- **排位实时感知与随时取消**：看板实时显示排队位次（如“队列排队中 (第 1 位)”），支持在排队期间随时取消任务并释放暂存文件。

### 7. 🎨 深浅交互主题与 PPT 风格双独立自由切换 (Visual Theme & Interactive Style Switcher)
- **4 大典型教学场景一键预设**：
  - 🧑‍🎓 **学生自主探究 (默认)**：深色交互 + 浅色文档，沉浸式仿真小游戏搭配清晰纯白讲义，便于自学与实验；
  - 🏫 **线下实体课堂**：浅色交互 + 浅色文档，全明亮浅色护眼界面与纯白高清晰幻灯片，适配白天大屏与投影仪演示；
  - 🌐 **线上网课直播**：浅色交互 + 深色文档，暗夜科技幻灯片大幅降低屏幕眩光与推流码率，明亮画布清晰呈现操作细节；
  - 💻 **极客沉浸暗黑**：深色交互 + 深色文档，全黑客暗黑科技调性，高对比度霓虹发光节点与暗黑实验沙盒。
- **双独立开关自由组合**：
  - **交互场景主题开关**：深色科技 (暗黑) / 浅色护眼 (明亮)，底层深度规约仿真模拟、小游戏、交互图表、3D可视化与代码练习；
  - **PPT幻灯片主题开关**：浅色讲义 (纯白) / 深色幻灯 (暗夜)，硬性规约讲义背景底色与字体对比度。
- **全平台协同打通**：
  - 主页输入框工具栏与批量制课工坊同步搭载，全链路流式传输与提示词强制注入。

### 8. 深度打通多用户与「我的课程中心」云端漫游
- 批量生成的课程直接通过多用户底层数据接口（`getOwnerScopedDocumentStore`）持久化写入所属账号的存储中。
- **直通课程中心**：工坊顶部导航栏配备 **「我的课程」** 直达按钮，一键跳转全功能课程中心（`/my-courses`）。用户无论在办公室电脑、家用电脑还是移动端平板上登录，均可在课程中心无缝查看、在线播放、调用 Pro 工作台二次深度编辑或执行一键云端漫游备份。

### 9. 标准 REST API 接口（支持脚本与外部系统集成）
- 提供标准 HTTP Multipart 接口，可在命令行中使用 `curl`、Python 脚本或外部排课系统直接投递批量制课任务、中断任务或移除队列项。

---

## 🚀 快速安装 (Quick Start)

### 方式 1：使用自动化脚本一键安装（推荐 ⭐）

在你的 **OpenMAIC 项目根目录** 下执行：

```bash
# 1. 预检查兼容性（Dry-run 只检不改）
bash <(curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/batch-course-studio/apply-batch-studio.sh) --check

# 2. 正式一键打入补丁并自动构建重启
bash <(curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/batch-course-studio/apply-batch-studio.sh)
```

或克隆本仓库后在 OpenMAIC 根目录运行：

```bash
/path/to/OpenMAICMultiUsersModule/batch-course-studio/apply-batch-studio.sh
```

---

### 方式 2：使用 Git Patch 手动安装

```bash
# 进入你的 OpenMAIC 项目根目录
cd /path/to/OpenMAIC

# 1. 检查补丁是否冲突
git apply --check /path/to/OpenMAICMultiUsersModule/batch-course-studio/openmaic-batch-studio.patch

# 2. 应用补丁
git apply /path/to/OpenMAICMultiUsersModule/batch-course-studio/openmaic-batch-studio.patch

# 3. 编译与重启服务
pnpm build
pm2 restart openmaic --update-env
```

---

## 🖥️ 网页操作使用说明

1. 浏览器打开 OpenMAIC 网站，登录你的账号。
2. 在首页顶部导航栏右侧，点击 **「批量制课」** 按钮（或直接访问 `http://<服务器地址>:3000/batch-studio`）。
3. **选择文件**：拖拽或点击上传你的课件文件（支持批量选中多个 PPTX / PDF / DOCX / TXT / MD 文件）。
4. **选择生成模式**：
   - **多课件融合为一门课**：多个文件合并为一门课。
   - **独立课件批量生成**：每个文件生成一门课。
5. **功能配置**：
   - **教学总要求 / 提示词指导**：输入课程侧重点、目标受众、课件风格要求等。
   - **PDF / 资料解析引擎**：可视化切换选用 **MinerU (推荐)**、**unpdf 轻量解析器** 或 **阿里文档智能**，自动携带服务地址并在后台调用。
   - **深度交互模式**：开启后生成更多互动、练习与探索场景。
   - **启用教师讲解语音 (TTS)**：按需开关。
   - **启用 AI 视觉配图**：按需开关。
   - **云端漫游保障**：用户的解析器与模型配置现已全面写入 PostgreSQL 账号绑定存储，即使关机或更换电脑，后台任务与个人配置均永不丢失。
6. 点击 **「开始批量制作」**，任务即刻进入后台异步执行！
7. 在 **「任务看板」** 中：
   - 可随时观察整体进度、每个文件的阶段状态与耗时。
   - 如需中途停止，点击 **「中断任务 (停止消耗 Token)」** 即可停止生成。
   - 队列中尚未开始的文件，可点击该条目右侧的 **「从队列移除」** 跳过。
   - 生成完成即可一键直达课程播放与工作区编辑界面。

---

## 📡 REST API 接口文档 (Headless API)

支持直接使用 API 进行批量作业或集成进内部教务系统。

### 1. 创建批量生成任务

- **Endpoint**: `POST /api/batch-generate`
- **Content-Type**: `multipart/form-data`

#### 表单字段 (FormData)：
| 字段名 | 类型 | 说明 | 默认值 |
|---|---|---|---|
| `files` | `File[]` | 上传的课件文件（可多个） | 必填 |
| `mode` | `string` | 模式：`single_merged` 或 `batch_independent` | `batch_independent` |
| `prompt` | `string` | 自定义生成提示词/教学诉求 | 空 |
| `courseScale` | `string` | 课程规格篇幅：`micro` (4-5页微课) / `standard` (7-9页标准) / `thematic` (12-15页专题大课) | `"standard"` |
| `enableInteractiveMode` | `boolean` | 是否开启深度交互模式 (`"true"`/`"false"`) | `"false"` |
| `enableTTS` | `boolean` | 是否开启语音旁白合成 (`"true"`/`"false"`) | `"true"` |
| `enableImageGeneration` | `boolean` | 是否开启场景插图生成 (`"true"`/`"false"`) | `"true"` |

#### 示例请求 (cURL)：

```bash
# 示例：将 2 个 PPT 批量分别生成 2 门独立课程，指定为微课精讲模式并开启深度交互
curl -X POST "http://localhost:3000/api/batch-generate" \
  -H "Cookie: token=YOUR_AUTH_COOKIE" \
  -F "mode=batch_independent" \
  -F "courseScale=micro" \
  -F "prompt=注重知识要点梳理与深度互动讲解" \
  -F "enableInteractiveMode=true" \
  -F "enableTTS=true" \
  -F "enableImageGeneration=true" \
  -F "files=@/path/to/lecture1.pptx" \
  -F "files=@/path/to/lecture2.pptx"
```

---

### 2. 中断/取消任务或移除队列项

- **Endpoint**: `POST /api/batch-generate/[id]`
- **Content-Type**: `application/json`

#### 2.1 中断整个批量任务（停止后续 Token 消耗）：
```bash
curl -X POST "http://localhost:3000/api/batch-generate/job_1774686000000_abc123" \
  -H "Cookie: token=YOUR_AUTH_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}'
```

#### 2.2 从队列中移除某个未开始的子任务：
```bash
curl -X POST "http://localhost:3000/api/batch-generate/job_1774686000000_abc123" \
  -H "Cookie: token=YOUR_AUTH_COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel_task", "taskId": "task_xyz789"}'
```

---

### 3. 删除任务记录及清理缓存

- **Endpoint**: `DELETE /api/batch-generate/[id]`

```bash
curl -X DELETE "http://localhost:3000/api/batch-generate/job_1774686000000_abc123" \
  -H "Cookie: token=YOUR_AUTH_COOKIE"
```

---

### 4. 查询任务详情与实时进度

- **Endpoint**: `GET /api/batch-generate/[id]`

```bash
curl -X GET "http://localhost:3000/api/batch-generate/job_1774686000000_abc123" \
  -H "Cookie: token=YOUR_AUTH_COOKIE"
```

---

### 5. 获取当前用户的历史任务列表

- **Endpoint**: `GET /api/batch-generate`

```bash
curl -X GET "http://localhost:3000/api/batch-generate" \
  -H "Cookie: token=YOUR_AUTH_COOKIE"
```

---

## 🛠️ 运维与诊断命令

`apply-batch-studio.sh` 提供了一键式诊断与回退支持：

```bash
# 1. 检查批量工坊运行状态与任务存储情况
./apply-batch-studio.sh --status

# 2. 检查补丁是否冲突
./apply-batch-studio.sh --check

# 3. 一键安全撤销与还原
./apply-batch-studio.sh --revert
```

---

## 📂 模块代码目录结构

```
batch-course-studio/
├── openmaic-batch-studio.patch       # 完整的 Git 补丁文件
├── apply-batch-studio.sh             # 一键自动打补丁/诊断/卸载脚本
├── README.md                         # 详细技术架构与使用手册
└── extension/                        # 纯源码副本（便于审查与按需自定义）
    ├── app/
    │   ├── api/batch-generate/       # 异步任务 API (POST/GET/DELETE) 与状态轮询接口
    │   │   ├── route.ts
    │   │   └── [id]/route.ts
    │   └── batch-studio/             # 批量制课工坊前台界面组件
    │       └── page.tsx
    └── lib/server/batch-generation/  # 后台核心调度引擎
        ├── types.ts                  # 任务与子任务数据结构模型
        ├── store.ts                  # 原子化任务持久化与多用户查询/删除
        ├── extractor.ts              # 多格式文件提取器 (PPTX Worker / MinerU)
        └── runner.ts                 # 异步流水线调度器、中断控制器与 DocumentStore 桥接
```

---

## 📄 开源许可

本项目遵循 [MIT License](../LICENSE)。基于 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 扩展开发。
