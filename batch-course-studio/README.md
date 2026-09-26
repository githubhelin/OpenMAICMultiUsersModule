# 🎓 OpenMAIC 批量制课工坊扩展补丁 (Batch Course Studio)

[![OpenMAIC](https://img.shields.io/badge/OpenMAIC-Batch--Studio-blue?style=flat-square)](https://github.com/THU-MAIC/OpenMAIC)
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

### 2. 双重制课模式 (Dual Generation Modes)
- **模式 A：多课件融合为一门课 (`single_merged`)**
  - 上传一个或多个课件/资料，系统将自动汇聚提炼所有文档核心内容，自动梳理章节脉络并合成一门结构完备、连贯深入的综合性交互大课。
- **模式 B：独立课件批量并发生成 (`batch_independent`)**
  - 上传 $N$ 个课件/资料文件，系统为**每一个文件独立生成一节对应的完整课程**。
  - 适用于教师或培训机构一次性将整学期的 PPT 或讲义批量转换为互动课件。

### 3. 后台全自动流水线与实时进度面板
- **后台异步流水线 (Headless Pipeline)**：任务提交后立即在后台异步流水线运行，用户无需停留在前台等待。
- **可视化进度大屏 (`/batch-studio`)**：
  - 实时显示整体百分比进度与阶段状态（`文档解析中` ➔ `大纲构思中` ➔ `场景生成中` ➔ `课件组装中` ➔ `完成`）。
  - 任务状态卡片支持按文件查看独立耗时、分阶段详情及错误日志。
  - 生成完成即可一键直达课程播放与编辑界面。

### 4. 深度打通多用户与云端漫游
- 批量生成的课程直接通过多用户底层数据接口（`getOwnerScopedDocumentStore`）持久化写入所属账号的存储中。
- 任务生成完毕后，用户无论在办公室电脑、家用电脑还是移动端平板上登录，均可在首页的“我的课程库”中无缝查看并继续演播所有课程。

### 5. 标准 REST API 接口（支持脚本与外部系统集成）
- 提供标准 HTTP Multipart 接口，可在命令行中使用 `curl`、Python 脚本或外部排课系统直接投递批量制课任务。

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
5. **可选设置**：
   - **专项教学提示词（可选）**：输入课程侧重点、目标受众、课件风格要求等。
   - **启用智能体语音旁白 (TTS)**：按需开关。
   - **启用插图与视觉素材生成**：按需开关。
6. 点击 **「开始批量制作」**，任务即刻进入后台异步执行！
7. 在下方的 **「实时任务看板」** 中，可随时观察每个文件的生成阶段、进度条、耗时以及最终课程入口。

---

## 📡 REST API 接口文档 (Headless API)

支持直接使用 API 进行批量作业或集成进内部教务系统。

### 1. 创建批量生成任务

- **Endpoint**: `POST /api/batch-generate`
- **Content-Type**: `multipart/form-data`
- **身份认证**: 携带 Cookie Session 或由系统识别当前登录态

#### 表单字段 (FormData)：
| 字段名 | 类型 | 说明 | 默认值 |
|---|---|---|---|
| `files` | `File[]` | 上传的课件文件（可多个） | 必填 |
| `mode` | `string` | 模式：`single_merged` 或 `batch_independent` | `batch_independent` |
| `prompt` | `string` | 自定义生成提示词/教学诉求 | 空 |
| `enableTts` | `boolean` | 是否开启语音旁白合成 (`"true"`/`"false"`) | `"true"` |
| `enableImages` | `boolean` | 是否开启场景插图生成 (`"true"`/`"false"`) | `"true"` |

#### 示例请求 (cURL)：

```bash
# 示例：将 2 个 PPT 批量分别生成 2 门独立课程
curl -X POST "http://localhost:3000/api/batch-generate" \
  -H "Cookie: token=YOUR_AUTH_COOKIE" \
  -F "mode=batch_independent" \
  -F "prompt=注重知识要点梳理与生动讲解" \
  -F "enableTts=true" \
  -F "enableImages=true" \
  -F "files=@/path/to/lecture1.pptx" \
  -F "files=@/path/to/lecture2.pptx"
```

#### 返回示例：
```json
{
  "success": true,
  "jobId": "job_1774686000000_abc123",
  "message": "批量任务已提交，正在后台异步生成"
}
```

---

### 2. 查询任务详情与实时进度

- **Endpoint**: `GET /api/batch-generate/[id]`

#### 示例请求：
```bash
curl -X GET "http://localhost:3000/api/batch-generate/job_1774686000000_abc123" \
  -H "Cookie: token=YOUR_AUTH_COOKIE"
```

#### 返回示例：
```json
{
  "job": {
    "id": "job_1774686000000_abc123",
    "ownerId": "usr_99f381",
    "mode": "batch_independent",
    "status": "processing",
    "progress": 65,
    "createdAt": 1774686000000,
    "updatedAt": 1774686030000,
    "subTasks": [
      {
        "id": "task_1",
        "fileNames": ["lecture1.pptx"],
        "status": "completed",
        "progress": 100,
        "currentStep": "completed",
        "stageId": "stage_abc1",
        "scenesCount": 8,
        "completedAt": 1774686025000
      },
      {
        "id": "task_2",
        "fileNames": ["lecture2.pptx"],
        "status": "processing",
        "progress": 30,
        "currentStep": "generating_scenes"
      }
    ]
  }
}
```

---

### 3. 获取当前用户的历史任务列表

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
    │   ├── api/batch-generate/       # 异步任务 API (POST/GET) 与状态轮询接口
    │   │   ├── route.ts
    │   │   └── [id]/route.ts
    │   └── batch-studio/             # 批量制课工坊前台界面组件
    │       └── page.tsx
    └── lib/server/batch-generation/  # 后台核心调度引擎
        ├── types.ts                  # 任务与子任务数据结构模型
        ├── store.ts                  # 原子化任务持久化与多用户查询
        ├── extractor.ts              # 多格式文件提取器 (PPTX Worker / MinerU)
        └── runner.ts                 # 异步流水线调度器与 DocumentStore 桥接
```

---

## 📄 开源许可

本项目遵循 [MIT License](../LICENSE)。基于 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 扩展开发。
