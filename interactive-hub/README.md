# 🎮 OpenMAIC 互动实验与游戏工坊 / 互动展厅 (Interactive Hub)

[![OpenMAIC](https://img.shields.io/badge/OpenMAIC-v1.1.0-blue?style=flat-square)](https://github.com/THU-MAIC/OpenMAIC)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](../LICENSE)

本模块为 **OpenMAIC** 提供了全功能的**互动实验与游戏工坊 / 互动展厅 (Interactive Hub)**。

在 OpenMAIC 的 AI 制课过程中，大模型会生成极为丰富的互动场景（包括物理与化学科学仿真、趣味探究游戏、算法动态图解、代码实验沙箱等）。此前，这些互动组件深嵌在单一幻灯片内部，体验或分享必须逐页翻阅课堂。

**Interactive Hub** 将全站所有历史课程与实时新课中的互动内容**全量归集、深度内联打包为纯脱机单文件 HTML，并提供集中陈列的沉浸式展厅 (`/interactive-hub`)**。支持脱机即开即玩、离线下载、全屏模态运行与全生命周期双向联动。

---

## 🌟 核心特性与架构亮点

### 1. 📦 纯脱机单文件 HTML 导出 (Offline Inlined Single-File Apps)
- **系统资源内联化引擎 (`inlineHtmlAssets`)**：自动将互动场景依赖的全部样式（CSS）、脚本（JavaScript）、仿真算法逻辑与运行时依赖内联封装为一个**完全自治的单文件 HTML**（单文件体积约 0.8MB ~ 1.3MB）。
- **零网络依赖**：生成的每个 HTML 文件不依赖外部 CDN 或后端服务，断网状态下双击即可在任何现代浏览器中流畅运行，极便于课堂离线教学演示、学生分发与拷贝归档。
- **结构化持久化存放**：所有打包好的互动内容自动存放在项目根目录 `data/interactive-library/` 中，以课程名称与 ID 规范建档：
  ```text
  data/interactive-library/
  └── 经典力学与平抛运动实验_stage-abc123/
      ├── meta.json                         # 课程与互动索引元数据
      ├── 01_平抛运动轨迹探究与碰撞模拟.html     # 纯脱机单文件应用
      └── 03_动量守恒物理沙箱.html              # 纯脱机单文件应用
  ```

### 2. 🔄 全生命周期智能双向联动 (Full-Lifecycle Sync & Clean)
- **制课即归集**：无论是官方主页单课生成、专业工作台保存，还是批量制课工坊后台批处理完成，系统均自动在后台异步触发资源打包并加入展厅，不阻塞主业务流程。
- **课程重命名联动**：在「我的课程」重命名课件时，展厅目录名及元数据自动毫秒级同步重命名。
- **四维彻底物理级联删除**：在删除课程时，系统同步联动清理：
  1. PostgreSQL 数据库关联行（`document_scenes`, `stage_meta`, `document_stages` 等）；
  2. 磁盘课堂持久化文件（`data/classrooms/<id>.json`）；
  3. 课堂媒体素材目录（`data/classrooms/<id>/`）；
  4. **互动展厅打包目录（`data/interactive-library/*_<id>/`）**；
  杜绝任何幽灵数据遗留。
- **孤儿目录智能探测与清扫**：如果存在因早期删除遗留的孤儿互动目录，展厅同步引擎会自动比对数据库与课堂文件，将失效的孤儿目录自动物理清除。

### 3. ⚡ 极速缓存感知的强制同步 (<50ms Force Sync)
- 页面顶部提供 **「强制同步归集」** 按钮，工具栏配备快捷刷新按键。
- 支持 `GET /api/interactive-library?refresh=1` 与 `POST /api/interactive-library`。
- 采用内存/磁盘轻量增量比对，无需耗时的全量重新内联，全库扫描同步耗时低于 50ms。

### 4. 🕹️ 沉浸式互动展厅体验 (`/interactive-hub`)
- **多维度智能分类过滤**：
  - 🔬 **科学仿真 (`simulation`)**：物理沙箱、化学反应动力学、生物微观结构探究等；
  - 🎮 **探究游戏 (`game`)**：闯关解谜、连线归类、互动问答挑战等；
  - 📊 **动态图解 (`diagram`)**：算法可视化、思维导图、动态流程交互图；
  - 💻 **代码工坊 (`code-runner` / `interactive`)**：在线实时执行与调试沙箱。
- **双视图自由切换**：
  - 🗂️ **平铺卡片流视图**：大图预览、直接体验；
  - 📚 **按课程分组视图**：按课时树形收展，结构清晰明了。
- **三种灵活交互体验**：
  - 🪟 **模态弹窗即点即玩**：无需跳出当前页面，在居中大弹窗中即时操控互动实验；
  - 🚀 **新窗口全屏运行**：直达脱机独立页面，独占全屏视界；
  - 💾 **一键脱机单文件下载**：点击卡片下载按钮直接保存 `.html` 到本地电脑。

---

## 🚀 补丁安装与应用方法

### 方式 1：一键远程自动化安装（推荐 ⭐）

在您的 **OpenMAIC 代码库根目录** 下直接运行以下命令：

```bash
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/interactive-hub/apply-interactive-hub.sh | bash
```

脚本将自动执行以下流程：
1. 预检查项目代码库与兼容性；
2. 自动打入互动展厅补丁（或增量同步源码）；
3. 自动执行 `pnpm build` 进行前端生产环境编译；
4. 自动检测并重启 PM2 服务进程。

---

### 方式 2：克隆仓库并使用本地脚本安装

```bash
# 1. 克隆补丁仓库至临时目录
git clone https://github.com/githubhelin/OpenMAICMultiUsersModule.git /tmp/openmaic-patch

# 2. (可选) 兼容性只检不改 (Dry-run)
/tmp/openmaic-patch/interactive-hub/apply-interactive-hub.sh --check

# 3. 正式打入补丁并编译部署
/tmp/openmaic-patch/interactive-hub/apply-interactive-hub.sh

# 4. 清理临时目录
rm -rf /tmp/openmaic-patch
```

---

### 方式 3：纯手动 Git Patch 安装

若您希望完全手动操作 Git：

```bash
# 1. 下载补丁文件
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/interactive-hub/openmaic-interactive-hub.patch -o openmaic-interactive-hub.patch

# 2. 预检查是否有冲突
git apply --check openmaic-interactive-hub.patch

# 3. 正式打入补丁
git apply openmaic-interactive-hub.patch
rm openmaic-interactive-hub.patch

# 4. 重新构建与启动
pnpm build
pm2 restart openmaic --update-env # 或 pnpm start
```

---

## 🛠️ 运维与诊断指令

在项目根目录下，`apply-interactive-hub.sh` 提供了完备的运维子命令：

```bash
# 1. 运行状态一键诊断 (检测补丁安装状态、收录课程数、脱机 HTML 数量与 PM2 状态)
bash interactive-hub/apply-interactive-hub.sh --status

# 2. 代码兼容性预检查 (Dry-run，只检不改)
bash interactive-hub/apply-interactive-hub.sh --check

# 3. 跳过前端编译快速打补丁 (适用于仅开发调试)
bash interactive-hub/apply-interactive-hub.sh --no-build

# 4. 一键安全回退撤销补丁 (完全恢复至官方原版)
bash interactive-hub/apply-interactive-hub.sh --revert
```

---

## 🔌 API 接口规范

本模块暴露以下标准的 RESTful API：

| 方法 | 请求路径 | 认证要求 | 功能说明 |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/interactive-library` | 公开 | 获取全站互动展厅统计、课程元数据列表与所有互动游戏索引条目（支持 `?refresh=1` 快速扫描） |
| `POST` | `/api/interactive-library` | 公开 | 触发全量增量重新扫描与归集，自动清理孤儿目录并返回最新展厅数据 |
| `GET` | `/api/interactive-library/:stageId/:filename` | 公开 | 提供单文件离线 HTML 在线访问或直接附件下载（支持 `?download=1` 触发浏览器下载） |

---

## 📁 目录结构

```text
interactive-hub/
├── README.md                      # 本文档
├── apply-interactive-hub.sh       # 独立自动化安装、诊断与回退脚本
├── openmaic-interactive-hub.patch # 标准独立 Git Patch 补丁包
└── extension/                     # 模块化独立源码树
    ├── app/
    │   ├── api/
    │   │   └── interactive-library/
    │   │       ├── route.ts                            # 展厅索引与强制同步 API
    │   │       └── [stageId]/[filename]/route.ts       # 离线单文件 HTML 服务与下载 API
    │   └── interactive-hub/
    │       └── page.tsx                                # 互动实验与游戏工坊前端展厅页面
    └── lib/
        └── server/
            └── interactive-library/
                └── index.ts                            # 资源内联打包、目录维护与孤儿清理核心逻辑
```
