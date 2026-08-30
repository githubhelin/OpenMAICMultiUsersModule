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

#### 方式 1：一键自动化脚本（推荐）
```bash
# 在 OpenMAIC 根目录下执行
git clone https://github.com/githubhelin/OpenMAICMultiUsersModule.git /tmp/openmaic-patch
/tmp/openmaic-patch/apply.sh
rm -rf /tmp/openmaic-patch
```

#### 方式 2：手动下载并打入补丁文件
```bash
# 下载 patch 文件并直接应用
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/openmaic-multi-user.patch -o openmaic-multi-user.patch
git apply openmaic-multi-user.patch
rm openmaic-multi-user.patch
```

---

### 步骤三：环境配置 (`.env.local`)

在 OpenMAIC 项目根目录下创建或修改 `.env.local`：

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

## 📂 仓库结构说明

```
├── openmaic-multi-user.patch    # 针对官方 OpenMAIC 的完整统一补丁文件
├── apply.sh                     # 一键打补丁自动化脚本
├── extension/                   # 独立的源码文件副本 (供查阅与手动集成)
│   ├── app/api/auth/            # 身份认证 API (login, register, logout, me, profile)
│   ├── app/api/admin/           # 管理员控制台 API
│   ├── components/auth/         # 登录/注册/个人中心组件与导航栏 UserNav
│   ├── components/admin/        # 全站多用户管理后台弹窗
│   ├── components/ui/table.tsx  # 表格基础 UI 组件
│   ├── lib/server/auth/         # 数据库连接、scrypt 加密与 Session 工具
│   ├── lib/store/auth-store.ts  # 客户端 Zustand 登录态状态管理
│   └── tests/auth/              # 认证加解密单元测试
└── README.md                    # 模块安装与使用说明文档
```

---

## 📄 开源许可

本项目遵循 [MIT License](LICENSE)。基于 [THU-MAIC/OpenMAIC](https://github.com/THU-MAIC/OpenMAIC) 开发。
