# 👥 OpenMAIC 多用户管理与认证模块补丁 (Multi-Users Module Patch)

[![OpenMAIC](https://img.shields.io/badge/OpenMAIC-v1.0.0-blue?style=flat-square)](https://github.com/THU-MAIC/OpenMAIC)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-336791?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

本仓库是针对清华大学开源项目 [**THU-MAIC/OpenMAIC**](https://github.com/THU-MAIC/OpenMAIC) 的**独立多用户管理与账号认证扩展补丁**。

---

## 🌟 核心特性 (Features)

1. **统一账号认证与多端云端漫游**：
   - 支持前台用户名/密码注册与登录，支持个人昵称、头像设置与密码自主修改。
   - 用户在不同电脑、平板或手机上登录同一个账号，即可**无缝加载并继续编辑**该账号创建的所有互动课程、智能体会话（Session）、自定义技能（Skill）与素材库。
2. **多用户严格数据隔离 (Strict Owner Isolation)**：
   - 深度桥接 OpenMAIC 原生 `ownerId` 架构与 PostgreSQL 数据库。
   - 不同用户的课程大纲、对话历史、私有技能 100% 物理隔离，互不可见。
3. **分权权限控制 (RBAC) 与管理后台**：
   - **普通用户（User）**：仅可查看并管理属于自己的项目与偏好。
   - **超级管理员（Admin）**：顶部菜单独享 **“全站多用户管理”** 控制台，支持全站用户搜索、手动创建用户、切换管理员权限、禁用/启用账号及重置密码。
4. **系统设置安全防护 (Admin Only Settings)**：
   - 严格管控全局底层模型与服务商配置：大模型 API Key、TTS、ASR、图像生成、视频与搜索配置仅超级管理员可见并可修改；普通用户和访客界面完全隐藏系统设置齿轮。
5. **轻量原生安全**：
   - 采用 Node.js 原生安全加密（`scrypt` 密码哈希 + 随机 Salt，HMAC-SHA256 JWT Token）。
   - 采用 `HttpOnly` + `SameSite=Lax` Cookie 存储会话，杜绝 XSS 风险，支持局域网 HTTP 与线上 HTTPS。

---

## 🚀 快速开始与安装 (Quick Start)

### 步骤一：克隆官方 OpenMAIC 仓库
```bash
git clone https://github.com/THU-MAIC/OpenMAIC.git
cd OpenMAIC
```

### 步骤二：打入多用户模块补丁

#### 方式 1：一键远程打补丁（极简 ⭐）
```bash
# 在 OpenMAIC 项目根目录下直接运行：
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/apply.sh | bash
```

#### 方式 2：克隆补丁脚本运行
```bash
# 在 OpenMAIC 根目录下执行
git clone https://github.com/githubhelin/OpenMAICMultiUsersModule.git /tmp/openmaic-patch

# 选项 A: 仅执行预检查 (Dry-run 只检不改，验证是否有冲突)
/tmp/openmaic-patch/apply.sh --check

# 选项 B: 正式执行一键安装打补丁（自动检测冲突并引导配置数据库）
/tmp/openmaic-patch/apply.sh

rm -rf /tmp/openmaic-patch
```

#### 方式 3：手动检查并打入补丁文件
```bash
# 下载 patch 文件
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/openmaic-multi-user.patch -o openmaic-multi-user.patch

# 1. 预检查是否有冲突 (不产生任何修改)
git apply --check openmaic-multi-user.patch

# 2. 确认无冲突后正式打入
git apply openmaic-multi-user.patch
rm openmaic-multi-user.patch
```

---

### 步骤三：环境配置与 PostgreSQL 自动配置 (`.env.local`)

> 💡 **关于数据库说明**：
> 官方原版 OpenMAIC 默认采用免数据库的“纯浏览器本地存储”模式。而多用户账号管理与多端课程漫游**必须依赖中心化的 PostgreSQL 数据库**。
> `apply.sh` 脚本在打补丁时会**自动检测并提供以下一键配置方式**：
> 1. **本机原生安装与配置 (免 Docker，默认推荐 ⭐)**：自动调用系统包管理器（apt / dnf / yum / pacman / brew）安装系统原生 PostgreSQL 服务，自动创建专用 `openmaic` 角色与数据库，并写入 `.env.local`。
> 2. **自建数据库连接**：直接粘贴已有 PostgreSQL 连接串。
> 3. **Docker 容器启动**：若环境偏好容器化，也可一键启动官方 PostgreSQL 16 容器。
> 4. **自动生成安全密钥**：自动生成 32 位高强度随机 `AUTH_SECRET` 会话密钥。

在 OpenMAIC 项目根目录下 `.env.local` 核心参数示例：

```env
# 启用 PostgreSQL 运行时存储与数据库连接（必须）
OPENMAIC_AGENT_RUNTIME_ENABLED=true
DATABASE_URL=postgres://openmaic:openmaic_password@127.0.0.1:5432/openmaic

# 多用户配置（可选）
AUTH_SECRET=your-super-secret-auth-key-string
ALLOW_REGISTRATION=true
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=admin123456
```

---

### 步骤四：编译并运行

```bash
# 1. 安装依赖
pnpm install

# 2. 编译生产版本
pnpm build

# 3. 运行服务
pm2 start ecosystem.config.cjs  # 推荐生产守护
# 或
pnpm start
```

---

## 🔑 默认初始超级管理员

首次启动并连接 PostgreSQL 时，系统会自动检测并初始化 `users` 表，同时自动预置默认初始超级管理员：

- **管理员账号**：`admin`
- **初始密码**：`admin123456`

> ⚠️ **安全建议**：初次登录后，请点击右上角管理员头像进入 **“个人资料与密码”** 修改默认密码！

---

## 🔄 后续官方有更新时的同步方式

未来清华官方仓库发布新版本或 Bug 修复时，您可以直接在您的 OpenMAIC 项目目录下执行以下命令完成无损更新：

```bash
git fetch upstream main
git rebase upstream/main
pnpm build
pm2 restart openmaic --update-env
```

---

## 🛠️ 运维与管理实用工具

补丁脚本附带了完备的运维管理指令，在项目根目录下可直接调用：

```bash
# 1. 运行状态一键诊断 (检测补丁、数据库连通性、用户统计与进程)
./apply.sh --status

# 2. 忘记密码时一键重置管理员密码
./apply.sh --reset-admin <新密码>
# 示例: ./apply.sh --reset-admin myNewPassword123

# 3. 一键安全撤销补丁 (完全恢复至官方纯净原版)
./apply.sh --revert
```

---

## 🎛️ 开启 Pro Mode 专业工作台（方案 B）

OpenMAIC 原生包含 **Pro Workbench（智能体工作台）** 与 **MAIC Editor（课件专业编辑模式）** 两个层级的专业功能，本仓库提供了完整的独立配置指南与自动化脚本：

- **详细指南文档**：👉 [pro-workbench-guide/README.md](./pro-workbench-guide/README.md)
- **核心特点**：
  - 方案 B 在底层天然包含方案 A（课件专业编辑模式）的全部手动排版能力，并增加了左侧 AI Agent 智能对话编排。
  - 文档提供了**专供 AI Coding Agent 执行的标准工作流规约**，在新电脑上配置时，直接让 Agent 按照此指南执行即可无缝完成环境配置、大模型路由装配与编译部署。
- **一键自动化配置**：在目标 OpenMAIC 项目根目录下直接运行：
  ```bash
  bash pro-workbench-guide/setup-pro-workbench.sh
  ```

---

## 📂 仓库结构说明

```
├── openmaic-multi-user.patch    # 针对官方 OpenMAIC 的完整统一补丁文件
├── apply.sh                     # 一键打补丁自动化脚本 (含预检、原生DB装配、诊断与回滚)
├── pro-workbench-guide/         # 方案 B（Pro 工作台 + 专业编辑模式）完整配置指南与脚本
│   ├── README.md                # 规范化配置说明 (专供 AI Agent 与手动配置参考)
│   └── setup-pro-workbench.sh   # 一键自动化配置与验证脚本
├── extension/                   # 独立的源码文件副本 (供查阅与手动集成)
│   ├── app/api/auth/            # 身份认证 API (login, register, logout, me, profile)
│   ├── app/api/admin/           # 管理员控制台 API
│   ├── components/auth/         # 登录/注册/个人中心组件与导航栏 UserNav
│   ├── components/admin/        # 全站多用户管理后台弹窗
│   ├── components/ui/table.tsx  # 表格基础 UI 组件
│   ├── lib/server/auth/         # 数据库连接、scrypt 加密与 Session 工具
│   ├── lib/store/auth-store.ts  # 客户端 Zustand 登录态状态管理
│   ├── scripts/                 # 管理员密码重置等运维脚本
│   └── tests/auth/              # 认证加解密单元测试
└── README.md                    # 模块安装与使用说明文档
```

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE)。基于 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 开发。
