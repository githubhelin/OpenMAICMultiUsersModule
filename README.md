# 👥 OpenMAIC 模块化扩展补丁集 (Multi-Users, Course-Manager, Batch-Studio & Interactive-Hub)

[![OpenMAIC](https://img.shields.io/badge/OpenMAIC-v1.1.0-blue?style=flat-square)](https://github.com/THU-MAIC/OpenMAIC)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

本仓库是针对清华大学开源项目 [**THU-MAIC/OpenMAIC**](https://github.com/THU-MAIC/OpenMAIC) 的**高可用模块化生产级扩展套件**。

包含五大核心独立模块，支持按需独立安装或统一全量部署：
1. **👥 多用户管理与统一身份认证模块**：开箱即用的多用户注册/登录、RBAC 角色权限、超级管理员全站控制台与多端云端漫游；
2. **📚 我的课程管理中心与双轨存储漫游模块 (`/my-courses`)**：本地 IndexedDB 历史课程与 PostgreSQL 云端课程双轨智能聚合、一键上云备份、集中播放、Pro 工作台二次深度编辑、行内重命名与**四维彻底物理级联删除保障**；
3. **⚡ 批量制课工坊扩展 (`/batch-studio`)**：纯后台异步批处理、三档课时定制（微课/标准/长课）、真·70%+ 深度互动场景、实时任务大屏看板与任务即时中断止损；
4. **🎮 互动实验与游戏工坊 / 互动展厅 (`/interactive-hub`)**：纯脱机单文件 HTML 自动内联打包、断网即开即用、全生命周期联动与极速强制同步归集；
5. **🎛️ Pro Mode 专业工作台方案 B 指南**：智能体多轮对话编排与 MAIC Editor 专业课件排版二次编辑模式；
6. **🧠 运行时自愈与大模型动态迁移机制**：动态模型白名单校验，历史过期模型（如 `gemini-3.7-flash-high`）自动平滑迁移至新模型（`gemini-3.8-flash-high`）并自动修剪失效配置，杜绝模型漂移与报错。

---

## 🌟 核心特性概览 (Features)

### 1. 统一账号认证与物理数据隔离 (Multi-User & Isolation)
- **多端数据漫游**：支持前台用户名/密码注册与登录，支持个人资料（昵称、头像）与自主密码修改。在不同电脑或设备登录同一个账号，自动同步所有课程与数据。
- **物理级数据隔离**：深度桥接 OpenMAIC 原生 `ownerId` 架构与 PostgreSQL 数据库，不同用户的课程大纲、对话历史、私有技能 100% 物理隔离。
- **分权控制与管理员后台**：超级管理员独享顶部“全站用户管理”弹窗，支持全站用户搜索、手动建号、提权/降权、冻结账号与密码重置。
- **系统设置安全防护**：大模型 API Key、TTS、ASR、生图生视频服务商全局配置仅超级管理员可查看与修改，普通用户完全隐藏设置入口。

### 2. 📚 我的课程中心与双轨存储漫游 (`/my-courses`)
- **双轨数据智能聚合**：同时聚合读取浏览器本地 IndexedDB（Dexie `db.stages`）历史课程与服务端 PostgreSQL 数据库课程，按照 `stageId` 去重合并，确保 29+ 门历史生成课件与批量制课生成的云端课件全量呈现。
- **状态感知与一键上云备份**：直观区分 <span style="color: #10b981; font-weight: bold;">「云端已存」</span> 与 <span style="color: #f59e0b; font-weight: bold;">「本地缓存 (点击上云)」</span>，支持顶部 **「一键上云备份 (N)」** 自动将所有本地课件推送到服务端 PostgreSQL 数据库，实现永久云端漫游。
- **全生命周期管理**：支持一键开课演播、进入 Pro 工作台深度编辑画布、行内快捷重命名。
- **四维彻底物理级联删除**：确认删除课程时，后端深度同步清理 1) PostgreSQL 数据库所有关联表（`document_scenes`, `stage_meta`, `document_stages` 等）；2) 课堂数据文件 `data/classrooms/<id>.json`；3) 媒体资源目录 `data/classrooms/<id>/`；4) **互动展厅打包目录 `data/interactive-library/*_<id>/`**。前端严格校验 HTTP 响应状态，杜绝任何假性删除与孤儿遗留。

### 3. ⚡ 批量制课工坊与三档教学课时定制 (`/batch-studio`)
- **多格式资料提取**：Worker 独立线程解析 PPTX、原生集成 MinerU 解析 PDF/Word、TXT、Markdown。
- **三档课时规模定制**：
  - ⚡ **微课精讲 (`micro` / 3~5 页)**：单知识点快节奏攻坚；
  - 🎯 **标准课时 (`standard` / 7~10 页)**：经典双核探究闭环；
  - 📚 **专题大课 (`thematic` / 12~16 页)**：体系化深度复习与排障实战；
  - 首页输入框与批量工作台均提供选择入口。
- **真·70%+ 深度交互模式**：硬性约束 70% 以上为物理科学仿真（`simulation`）、闯关游戏（`game`）与动态图解（`diagram`），内置防误降级保护机制。
- **任务即时中断与 Token 止损**：毫秒级中断大模型生成，排队课件支持精准移除，彻底杜绝 Token 浪费。

### 4. 🎮 互动实验与游戏工坊 / 互动展厅 (`/interactive-hub`)
- **纯脱机单文件 HTML 打包**：系统在生成课件时自动调用 `inlineHtmlAssets`，将所有 CSS、JS 与互动逻辑全部内联封包为约 0.8MB~1.3MB 的独立脱机 HTML，断网状态下即可直接双击运行、演示与分发。
- **全生命周期双向联动**：单课生成与批量制课完成自动归集；课程重命名自动毫秒级同步重命名展厅目录及 `meta.json`；课程删除自动彻底清除对应互动文件。
- **极速缓存感知强制同步**：提供顶部「强制同步归集」按钮，支持 `GET /api/interactive-library?refresh=1` 与 `POST /api/interactive-library`，耗时低于 50ms，自动清扫失效孤儿目录。
- **沉浸式互动展厅**：支持按科学仿真、探究游戏、动态图解、代码工坊分类筛选，支持卡片流与课程分组双视图，提供居中模态弹窗即点即玩、新窗口全屏独占与单文件本地直接下载。

### 5. 🧠 大模型配置自愈与自动热迁移
- 针对用户配置的旧模型（如 `gemini-3.7-flash-high`），系统在初始化和请求调用时会自动热迁移为最新标准模型（`gemini-3.8-flash-high`）。
- 动态白名单探针，自动从客户端持久化缓存中剔除无效或弃用的遗留模型，确保大模型调用 100% 稳定可靠。

---

## 🚀 补丁安装与应用指南 (Patch Installation Guide)

本仓库提供**极简的一键式自动化脚本**，同时也支持纯手工 Git Patch 应用。您可以根据需要选择安装全部功能或单独模块。

### 方案 A：全量安装（多用户认证 + 课程中心 + 模型动态迁移）推荐 ⭐

在您的 **OpenMAIC 代码库根目录** 下执行：

#### 1. 一键远程安装（极简）
```bash
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/apply.sh | bash
```

#### 2. 本地克隆脚本安装
```bash
# 克隆补丁仓库到临时目录
git clone https://github.com/githubhelin/OpenMAICMultiUsersModule.git /tmp/openmaic-patch

# 步骤一：预检查冲突（只检不改，验证是否可平滑合入）
/tmp/openmaic-patch/apply.sh --check

# 步骤二：正式执行一键安装（自动检测冲突、打入补丁并引导配置 PostgreSQL 数据库）
/tmp/openmaic-patch/apply.sh

# 清理临时文件
rm -rf /tmp/openmaic-patch
```

---

### 方案 B：单独安装「我的课程中心」模块 (`course-manager`)

如果您只需要课程管理中心与双轨存储漫游备份功能：

```bash
# 方式 1：远程一键安装
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/course-manager/apply-course-manager.sh | bash

# 方式 2：本地脚本安装
bash course-manager/apply-course-manager.sh
```

- **详细模块说明**：👉 [course-manager/README.md](./course-manager/README.md)

---

### 方案 C：单独安装「批量制课工坊」模块 (`batch-course-studio`)

如果您只需要批量快速制课、三档课时定制与大屏看板：

```bash
# 方式 1：远程一键安装
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/batch-course-studio/apply-batch-studio.sh | bash

# 方式 2：本地脚本安装
bash batch-course-studio/apply-batch-studio.sh
```

- **详细模块说明**：👉 [batch-course-studio/README.md](./batch-course-studio/README.md)

---

### 方案 D：单独安装「互动实验与游戏工坊」模块 (`interactive-hub`)

如果您只需要沉浸式互动展厅、纯脱机单文件 HTML 打包导出与双向联动：

```bash
# 方式 1：远程一键安装
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/interactive-hub/apply-interactive-hub.sh | bash

# 方式 2：本地脚本安装
bash interactive-hub/apply-interactive-hub.sh
```

- **详细模块说明**：👉 [interactive-hub/README.md](./interactive-hub/README.md)

---

### 方案 E：纯手工 Git Patch 安装

如果您希望通过标准 `git apply` 手动合入：

```bash
# 1. 检查补丁是否冲突 (以多用户统一全量补丁为例)
git apply --check openmaic-multi-user.patch

# 2. 正式应用补丁 (自动忽略空白字符差异)
git apply --whitespace=nowarn openmaic-multi-user.patch

# 3. 编译生产前端与启动服务
pnpm build
pm2 restart openmaic --update-env # 或 pnpm start
```

> 💡 **冲突解决提示**：若提示局部冲突，可使用 `git apply --3way openmaic-multi-user.patch` 进行智能平滑 3-Way 合并，或直接从本仓库的 `extension/` 目录拷贝源码覆盖。

---

## 🐘 环境配置与数据库指引 (`.env.local`)

多用户账号系统与中心化课程漫游需要依赖 PostgreSQL 数据库。`apply.sh` 脚本已内置**全自动安装引导**，支持以下多种数据库环境：

1. **本机原生安装 (免 Docker，推荐 ⭐)**：脚本自动通过系统包管理器（apt/dnf/yum/pacman/brew）安装并启动 PostgreSQL，自动创建专用 `openmaic` 角色与数据库，并自动生成写入连接串。
2. **外部/自建数据库**：直接在 `.env.local` 填入已有的 PostgreSQL 连接串。
3. **Docker 容器**：一键启动 PostgreSQL 16 官方容器。

核心环境变量配置示例：

```env
# 启用 PostgreSQL 运行时存储与数据库连接（必须）
OPENMAIC_AGENT_RUNTIME_ENABLED=true
DATABASE_URL=postgres://openmaic:openmaic_password@127.0.0.1:5432/openmaic

# 安全会话密钥（apply.sh 会自动生成 32 位随机密钥）
AUTH_SECRET=your-super-secret-auth-key-string

# 用户注册控制（可选，默认 true）
ALLOW_REGISTRATION=true

# 预置初始管理员（系统首次启动自动创建）
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin123456
```

---

## 🔑 默认超级管理员与运维诊断

首次启动连接数据库时，系统自动预置超级管理员：
- **管理员账号**：`admin`
- **初始默认密码**：`admin123456`（登录后可在个人中心自主修改）

### 🛠️ 运维与诊断指令集

```bash
# 1. 运行状态一键全面诊断 (补丁状态、课程中心状态、数据库连通性、注册人数与进程)
./apply.sh --status

# 2. 忘记密码时一键重置管理员密码
./apply.sh --reset-admin <新密码>
# 示例: ./apply.sh --reset-admin MySecurePass888

# 3. 一键安全撤销补丁 (完全恢复至官方原版)
./apply.sh --revert
```

---

## 🔄 官方版本升级后的无损更新流程

当官方 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 发布新版本（如 v1.1.x）时，在您的项目根目录下执行无损更新：

```bash
git fetch upstream main
git rebase upstream/main
pnpm build
pm2 restart openmaic --update-env
```

---

## 📂 仓库目录结构

```
OpenMAICMultiUsersModule/
├── openmaic-multi-user.patch         # 完整多用户、课程中心与互动展厅统一补丁包 (对齐 v1.1.0)
├── apply.sh                          # 多用户模块一键安装、诊断与回滚工具
├── interactive-hub/                  # 🎮 互动实验与游戏工坊 / 互动展厅独立模块
│   ├── openmaic-interactive-hub.patch# 互动展厅独立补丁
│   ├── apply-interactive-hub.sh      # 互动展厅一键安装与诊断脚本
│   ├── README.md                     # 互动展厅脱机打包与架构设计文档
│   └── extension/                    # 互动展厅独立源码副本
├── course-manager/                   # 📚 我的课程中心与双轨存储漫游独立模块
│   ├── openmaic-course-manager.patch # 课程中心独立补丁
│   ├── apply-course-manager.sh       # 课程中心一键安装脚本
│   ├── README.md                     # 课程中心详细架构与使用文档
│   └── extension/                    # 课程中心独立源码副本
├── batch-course-studio/              # ⚡ 批量制课工坊扩展模块
│   ├── openmaic-batch-studio.patch   # 批量制课工坊独立补丁
│   ├── apply-batch-studio.sh         # 批量制课一键安装脚本
│   ├── README.md                     # 批量制课工坊使用文档
│   └── extension/                    # 批量制课独立源码副本
├── pro-workbench-guide/              # 🎛️ Pro Mode 专业工作台配置指南与脚本
│   ├── setup-pro-workbench.sh        # 专业工作台一键安装脚本
│   └── README.md                     # 专业工作台规约与配置文档
├── extension/                        # 核心多用户模块独立源码副本 (供比对与手动增量部署)
│   ├── app/my-courses/page.tsx       # 我的课程中心页面
│   ├── app/interactive-hub/page.tsx  # 互动实验与游戏工坊展厅页面
│   ├── app/api/auth/                 # 身份认证 API (login, register, logout, me, profile)
│   ├── app/api/admin/                # 管理员全站用户管理 API
│   ├── app/api/stages/               # 课程列表与管理聚合 API (含四维级联物理删除)
│   ├── app/api/interactive-library/  # 展厅索引、离线 HTML 托管与强制归集 API
│   ├── lib/server/interactive-library/# 离线 HTML 资源内联打包与孤儿清扫引擎
│   ├── components/auth/              # 登录注册、个人中心与导航栏 UserNav 组件
│   ├── components/admin/             # 全站用户管理控制台
│   ├── lib/server/auth/              # 密码加密、数据库连接与会话凭据工具
│   ├── lib/store/settings.ts         # 模型设置自愈与自动迁移
│   └── scripts/                      # 管理员密码重置等运维工具
├── LICENSE                           # MIT 开源许可证
└── README.md                         # 模块安装与完整使用文档
```

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE)。基于 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 开发构建。
