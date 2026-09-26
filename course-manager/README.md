# 📚 OpenMAIC 我的课程中心与双轨存储漫游模块 (Course Manager)

[![OpenMAIC](https://img.shields.io/badge/OpenMAIC-v1.1.0-blue?style=flat-square)](https://github.com/THU-MAIC/OpenMAIC)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](../LICENSE)

本模块为 **OpenMAIC** 提供了全功能的**课程统一管理中心（Course Manager）与双轨存储（IndexedDB + PostgreSQL）漫游备份系统**。无论课程是在官方首页直接生成、通过批量制课工坊后台批处理制作、还是历史上在接入多用户持久化之前创建，均可在独立的 `/my-courses` 管理中心中集中查看、一键播放、二次深度编辑、重命名与双层安全删除。

---

## 🌟 核心特性与架构亮点

### 1. 🗄️ 双轨存储智能聚合（Dual-Source Aggregation）
官方 OpenMAIC 默认将课程存储在浏览器客户端的 IndexedDB（Dexie `db.stages`）中，而在启用多用户与服务端持久化后，批量制课与新生成的课程存储在服务端的 PostgreSQL 数据库中。
- **痛点**：若仅查询服务端数据库，用户浏览器中以往制作的数十门本地历史课程将无法显示；若仅查询本地，换台电脑又无法看到批量制课和云端课件。
- **解决方案**：课程中心在加载时，**同时拉取浏览器本地 IndexedDB 与云端 PostgreSQL 数据库**，以课程全局唯一 `stageId` 深度去重合并，确保**历史课件与云端课件全量呈现，永不丢失**。

### 2. ☁️ 云端状态感知与一键上云备份（Cloud Backup & Roaming）
- **状态徽标**：每张课程卡片清晰标明数据状态：
  - <span style="color: #10b981; font-weight: bold;">「云端已存」</span>：课程已完整保存在 PostgreSQL 数据库，支持在任意设备登录后随时访问。
  - <span style="color: #f59e0b; font-weight: bold;">「本地缓存 (点击上云)」</span>：课程暂存于当前浏览器的 IndexedDB 缓存中。
- **一键上云备份**：页面顶部提供 **「一键上云备份 (N)」** 快捷按钮（单课卡片亦支持单键备份），点击后系统自动读取本地课件大纲与全量幻灯片场景数据，无缝推送到服务端 PostgreSQL 数据库中，实现永久漫游与灾备。

### 3. 🛠️ 全生命周期课程管理
- **进入播放（Play）**：一键跳转全屏互动授课教室 `/classroom/[id]`。
- **深度二次编辑（Deep Edit）**：直达专业工作台 `/workspace?stageId=[id]`，在画布和智能体对话中任意修改幻灯片与互动组件。
- **行内无感重命名（Inline Rename）**：卡片悬浮点击编辑图标，即可直接修改课程名称，系统自动双向同步更新本地 IndexedDB 与云端数据库。
- **双轨彻底删除（Safe Purge）**：带有安全弹窗二次确认，确认后同步清除本地 IndexedDB 与云端数据库记录，杜绝残留。

### 4. 🧭 全站无缝导航穿透
- 官方首页顶部导航栏新增「我的课程」胶囊按钮。
- 批量制课工坊顶部导航栏新增「我的课程」直达入口。
- 用户下拉菜单新增「我的课程中心」快捷菜单项。

---

## 🚀 补丁安装与应用方法

### 方式 1：一键远程自动化安装（推荐 ⭐）

在您的 **OpenMAIC 代码库根目录** 下直接运行以下命令：

```bash
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/course-manager/apply-course-manager.sh | bash
```

脚本将自动执行以下流程：
1. 预检查项目代码库与兼容性；
2. 自动打入课程中心补丁（或增量同步源码）；
3. 自动执行 `pnpm build` 进行生产编译；
4. 自动检测并重启 PM2 服务进程。

---

### 方式 2：克隆仓库并使用本地脚本安装

```bash
# 1. 克隆补丁仓库至临时目录
git clone https://github.com/githubhelin/OpenMAICMultiUsersModule.git /tmp/openmaic-patch

# 2. (可选) 兼容性只检不改 (Dry-run)
/tmp/openmaic-patch/course-manager/apply-course-manager.sh --check

# 3. 正式打入补丁并编译部署
/tmp/openmaic-patch/course-manager/apply-course-manager.sh

# 4. 清理临时目录
rm -rf /tmp/openmaic-patch
```

---

### 方式 3：纯手动 Git Patch 安装

若您希望完全手动操作 Git：

```bash
# 1. 下载补丁文件
curl -sSL https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/course-manager/openmaic-course-manager.patch -o openmaic-course-manager.patch

# 2. 预检查是否有冲突
git apply --check openmaic-course-manager.patch

# 3. 正式打入补丁
git apply openmaic-course-manager.patch
rm openmaic-course-manager.patch

# 4. 重新构建与启动
pnpm build
pm2 restart openmaic --update-env # 或 pnpm start
```

---

## 🛠️ 运维与诊断指令

在项目根目录下，`apply-course-manager.sh` 提供了完备的运维子命令：

```bash
# 1. 运行状态一键诊断 (检测补丁安装状态、云端数据库配置与 PM2 运行态)
bash course-manager/apply-course-manager.sh --status

# 2. 冲突预检查 (只检不改，验证是否可平滑打入)
bash course-manager/apply-course-manager.sh --check

# 3. 一键安全撤销与卸载 (完全移除课程中心模块并还原原版)
bash course-manager/apply-course-manager.sh --revert
```

---

## 📂 模块文件清单

```
course-manager/
├── openmaic-course-manager.patch  # 针对官方 OpenMAIC 的独立增量补丁
├── apply-course-manager.sh        # 一键安装、诊断、预检与卸载工具
├── README.md                      # 架构设计与详细使用说明文档
└── extension/                     # 独立源码目录
    ├── app/
    │   ├── my-courses/
    │   │   └── page.tsx           # 我的课程中心完整前端页面 (双轨聚合、一键上云、重命名、删除)
    │   └── api/
    │       ├── stages/
    │       │   ├── route.ts       # 课程服务端列表聚合接口 (支持管理员跨账户穿透)
    │       │   └── [id]/
    │       │       └── route.ts   # 课程服务端重命名与安全删除接口
    │       └── classroom/
    │           └── route.ts       # 新建课程自动写入 PostgreSQL owner 数据库
```

---

## 📄 开源许可

本项目遵循 [MIT License](../LICENSE)。
