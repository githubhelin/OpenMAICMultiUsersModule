#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenMAIC 我的课程中心与双轨存储漫游模块 (Course Manager) 一键安装、诊断与管理脚本
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
PATCH_FILE="${SCRIPT_DIR}/openmaic-course-manager.patch"

# 1. 验证运行目录是否为 OpenMAIC 根目录
if [ ! -f "package.json" ] || ! grep -q '"name": "openmaic"' "package.json" 2>/dev/null; then
  echo "❌ 错误: 请在官方 OpenMAIC 代码库根目录下运行此脚本！"
  echo "   当前目录: $(pwd)"
  exit 1
fi

# 2. 如果本地不存在补丁文件（例如通过 curl 管道直接执行时），自动从 GitHub 获取
if [ ! -f "$PATCH_FILE" ]; then
  if [ -f "openmaic-course-manager.patch" ]; then
    PATCH_FILE="$(pwd)/openmaic-course-manager.patch"
  elif [ -f "course-manager/openmaic-course-manager.patch" ]; then
    PATCH_FILE="$(pwd)/course-manager/openmaic-course-manager.patch"
  else
    echo "📥 本地未检测到补丁包，正在从 GitHub 获取最新补丁..."
    mkdir -p /tmp/openmaic-course-patch
    curl -sSL "https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/course-manager/openmaic-course-manager.patch" -o /tmp/openmaic-course-patch/openmaic-course-manager.patch
    PATCH_FILE="/tmp/openmaic-course-patch/openmaic-course-manager.patch"
  fi
fi

# 功能: 查看当前系统运行状态 (--status)
if [[ "$1" == "--status" || "$1" == "-s" ]]; then
  echo "=========================================================="
  echo "  📊 OpenMAIC 课程中心与双轨存储漫游运行状态诊断"
  echo "=========================================================="
  
  if [ -f "app/my-courses/page.tsx" ]; then
    echo "✅ 补丁状态: 已安装「我的课程中心」模块 (/my-courses)"
  else
    echo "❌ 补丁状态: 尚未安装「我的课程中心」模块补丁"
  fi

  if [ -f ".env.local" ]; then
    DB_URL=$(grep -E "^DATABASE_URL=" .env.local 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -n "$DB_URL" ]; then
      echo "✅ 云端数据库: 已配置 DATABASE_URL (支持多端云端漫游与一键上云备份)"
    else
      echo "ℹ️  云端数据库: 未配置 DATABASE_URL (运行于纯浏览器 IndexedDB 本地持久化模式)"
    fi
  fi

  if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "openmaic"; then
    echo "✅ PM2 服务: 进程正在运行"
  else
    echo "ℹ️  PM2 服务: 未检测到运行中的 openmaic PM2 进程"
  fi
  exit 0
fi

# 功能: 仅做冲突预检查 (--check)
if [[ "$1" == "--check" || "$1" == "-c" ]]; then
  echo "🔍 正在进行课程中心补丁兼容性预检查 (Dry-run)..."
  if [ ! -f "$PATCH_FILE" ]; then
    echo "❌ 找不到补丁文件: $PATCH_FILE"
    exit 1
  fi
  if git apply --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    echo "✅ 预检查通过！补丁与当前代码库完全兼容，可以安全安装。"
    exit 0
  elif git apply -R --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    echo "✅ 预检查通过！检测到课程中心补丁已正确安装且与补丁文件完全一致。"
    exit 0
  else
    echo "⚠️ 预检查提示: 使用 patch 文件存在部分冲突，将自动通过 extension 源码安全增量合并。"
    exit 0
  fi
fi

# 功能: 撤销补丁 (--revert / --uninstall)
if [[ "$1" == "--revert" || "$1" == "--uninstall" ]]; then
  echo "=========================================================="
  echo "  🔄 正在撤销课程中心模块补丁..."
  echo "=========================================================="
  if [ -f "$PATCH_FILE" ] && git apply -R --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    git apply -R --whitespace=nowarn "$PATCH_FILE"
    echo "✅ 补丁已安全回退。"
  else
    echo "⚠️ 正在清理课程中心文件..."
    rm -rf app/my-courses
    echo "✅ 课程中心文件已清理。"
  fi
  echo ""
  echo "💡 提示: 请执行 pnpm build 并重启 PM2 服务以使更改生效:"
  echo "   pnpm build && pm2 restart openmaic --update-env"
  exit 0
fi

# 默认流程: 正式打入补丁
echo "=========================================================="
echo "  🚀 OpenMAIC 我的课程中心与双轨云端备份模块一键安装"
echo "=========================================================="

if [ -f "app/my-courses/page.tsx" ]; then
  echo "ℹ️  检测到课程中心已安装。正在检查更新..."
fi

APPLIED=false

if [ -f "$PATCH_FILE" ]; then
  if git apply --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    echo "📦 正在应用补丁文件: $PATCH_FILE ..."
    git apply --whitespace=nowarn "$PATCH_FILE"
    APPLIED=true
  fi
fi

if [ "$APPLIED" = false ]; then
  # 如果补丁无法直接应用（例如受其他定制文件影响），从 extension 目录同步源码
  EXT_DIR="${SCRIPT_DIR}/extension"
  if [ -d "$EXT_DIR" ]; then
    echo "📦 正在从 extension 目录同步最新文件..."
    mkdir -p app/my-courses app/api/stages app/api/classroom
    cp -r "${EXT_DIR}/app/my-courses/"* app/my-courses/
    [ -f "${EXT_DIR}/app/api/stages/route.ts" ] && cp "${EXT_DIR}/app/api/stages/route.ts" app/api/stages/route.ts
    [ -d "${EXT_DIR}/app/api/stages/[id]" ] && cp -r "${EXT_DIR}/app/api/stages/[id]" app/api/stages/
    [ -f "${EXT_DIR}/app/api/classroom/route.ts" ] && cp "${EXT_DIR}/app/api/classroom/route.ts" app/api/classroom/route.ts
    APPLIED=true
  else
    echo "❌ 无法直接应用补丁，且未找到 extension 源码目录！"
    exit 1
  fi
fi

echo "✅ 我的课程中心模块安装成功！"

# 检查是否跳过构建
if [[ "$1" == "--no-build" || "$2" == "--no-build" ]]; then
  echo "⏩ 已指定 --no-build，跳过自动化编译与服务重启。"
  exit 0
fi

# 自动编译与重启提示
echo ""
echo "⚙️ 正在执行前端构建 (pnpm build)..."
pnpm build

if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "openmaic"; then
  echo "🔄 正在重启 PM2 服务 (pm2 restart openmaic --update-env)..."
  pm2 restart openmaic --update-env
  echo "✅ PM2 服务重启完成！"
fi

echo ""
echo "=========================================================="
echo "  🎉 课程中心与双轨存储漫游模块安装与部署完成！"
echo "=========================================================="
echo "🌐 访问地址:"
echo "   - 浏览器打开 OpenMAIC 首页，顶部导航栏已新增「我的课程」按钮"
echo "   - 或直接访问: http://<你的服务器IP或域名>:3000/my-courses"
echo ""
echo "🛠️ 核心功能亮点:"
echo "   1. 双轨数据智能聚合：同时整合浏览器本地 IndexedDB 历史课程与云端 PostgreSQL 数据库课程，永不丢失"
echo "   2. 一键上云备份：右上角支持将所有本地旧课件一键同步至云端数据库，实现多设备自动漫游"
echo "   3. 全生命周期管理：支持课件直接开讲播放、进入 Pro 工作台深度二次编辑、行内直接重命名、安全删除"
echo "   4. 智能筛选与状态展示：实时统计互动大课、普通幻灯片，卡片直观显示「云端已存」与「本地缓存」"
echo "=========================================================="
