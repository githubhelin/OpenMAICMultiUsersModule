#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenMAIC 批量制课工坊 (Batch Course Studio) 扩展补丁一键安装、诊断与管理脚本
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
PATCH_FILE="${SCRIPT_DIR}/openmaic-batch-studio.patch"

# 1. 验证运行目录是否为 OpenMAIC 根目录
if [ ! -f "package.json" ] || ! grep -q '"name": "openmaic"' "package.json" 2>/dev/null; then
  echo "❌ 错误: 请在官方 OpenMAIC 代码库根目录下运行此脚本！"
  echo "   当前目录: $(pwd)"
  exit 1
fi

# 2. 如果本地不存在补丁文件（例如通过 curl 管道直接执行时），自动从 GitHub 获取
if [ ! -f "$PATCH_FILE" ]; then
  if [ -f "openmaic-batch-studio.patch" ]; then
    PATCH_FILE="$(pwd)/openmaic-batch-studio.patch"
  elif [ -f "batch-course-studio/openmaic-batch-studio.patch" ]; then
    PATCH_FILE="$(pwd)/batch-course-studio/openmaic-batch-studio.patch"
  else
    echo "📥 本地未检测到补丁包，正在从 GitHub 获取最新补丁..."
    mkdir -p /tmp/openmaic-batch-patch
    curl -sSL "https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/batch-course-studio/openmaic-batch-studio.patch" -o /tmp/openmaic-batch-patch/openmaic-batch-studio.patch
    PATCH_FILE="/tmp/openmaic-batch-patch/openmaic-batch-studio.patch"
  fi
fi

# 功能: 查看当前系统运行状态 (--status)
if [[ "$1" == "--status" || "$1" == "-s" ]]; then
  echo "=========================================================="
  echo "  📊 OpenMAIC 批量制课工坊 (Batch Studio) 运行状态诊断"
  echo "=========================================================="
  
  if [ -f "lib/server/batch-generation/runner.ts" ] && [ -f "app/batch-studio/page.tsx" ]; then
    echo "✅ 补丁状态: 已安装批量制课工坊 (Batch Course Studio)"
  else
    echo "❌ 补丁状态: 尚未安装批量制课工坊补丁"
  fi

  if [ -d "data/batch-jobs" ]; then
    JOB_COUNT=$(find data/batch-jobs -maxdepth 1 -name "*.json" 2>/dev/null | wc -l || echo "0")
    echo "📁 任务数据: 存在 data/batch-jobs (历史任务记录数: ${JOB_COUNT})"
  else
    echo "ℹ️  任务数据: 暂无任务记录 (data/batch-jobs 尚未创建)"
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
  echo "🔍 正在进行补丁兼容性预检查 (Dry-run)..."
  if [ ! -f "$PATCH_FILE" ]; then
    echo "❌ 找不到补丁文件: $PATCH_FILE"
    exit 1
  fi
  if git apply --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    echo "✅ 预检查通过！补丁与当前代码库完全兼容，可以安全安装。"
    exit 0
  elif git apply -R --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    echo "✅ 预检查通过！检测到批量制课工坊补丁已正确安装且与补丁文件完全一致。"
    exit 0
  else
    echo "⚠️ 预检查提示: 使用 patch 文件存在部分冲突，可尝试使用 extension 源码覆盖或检查修改项。"
    exit 1
  fi
fi

# 功能: 撤销补丁 (--revert / --uninstall)
if [[ "$1" == "--revert" || "$1" == "--uninstall" ]]; then
  echo "=========================================================="
  echo "  🔄 正在撤销批量制课工坊补丁..."
  echo "=========================================================="
  if [ -f "$PATCH_FILE" ] && git apply -R --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    git apply -R --whitespace=nowarn "$PATCH_FILE"
    echo "✅ 补丁已安全回退。"
  else
    echo "⚠️ 正在移除批量制课工坊扩展文件..."
    rm -rf app/api/batch-generate
    rm -rf app/batch-studio
    rm -rf lib/server/batch-generation
    git checkout app/page.tsx 2>/dev/null || true
    echo "✅ 扩展文件已清理。"
  fi
  echo ""
  echo "💡 提示: 请执行 pnpm build 并重启 PM2 服务以使更改生效:"
  echo "   pnpm build && pm2 restart openmaic --update-env"
  exit 0
fi

# 默认流程: 正式打入补丁
echo "=========================================================="
echo "  🚀 OpenMAIC 批量制课工坊 (Batch Course Studio) 一键安装"
echo "=========================================================="

if [ -f "lib/server/batch-generation/runner.ts" ] && [ -f "app/batch-studio/page.tsx" ]; then
  echo "ℹ️  检测到批量制课工坊已安装。正在检查是否有更新..."
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
  # 如果补丁无法直接应用，尝试从 extension 目录同步拷贝
  EXT_DIR="${SCRIPT_DIR}/extension"
  if [ -d "$EXT_DIR" ]; then
    echo "📦 正在从 extension 目录同步最新文件..."
    mkdir -p app/api/batch-generate lib/server/batch-generation app/batch-studio
    cp -r "${EXT_DIR}/app/api/batch-generate" app/api/
    cp -r "${EXT_DIR}/app/batch-studio" app/
    cp -r "${EXT_DIR}/lib/server/batch-generation" lib/server/
    APPLIED=true
  else
    echo "❌ 无法直接应用补丁，且未找到 extension 源码目录！"
    exit 1
  fi
fi

echo "✅ 批量制课工坊文件安装成功！"

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
echo "  🎉 批量制课工坊安装与部署完成！"
echo "=========================================================="
echo "🌐 访问地址:"
echo "   - 浏览器打开 OpenMAIC 首页，顶部导航栏已新增「批量制课」按钮"
echo "   - 或直接访问: http://<你的服务器IP或域名>:3000/batch-studio"
echo ""
echo "🛠️ 核心功能:"
echo "   1. 支持多文件上传（PPTX / PDF / DOCX / TXT / Markdown）"
echo "   2. 双模式生成："
echo "      - 模式 A（多课件融合为一门课）：智能合并所有文件要点，提炼完整大纲"
echo "      - 模式 B（独立课件批量并发生成）：每个文件独立生成一节完整课程"
echo "   3. 全自动后台执行 + 实时多任务看板与进度追踪"
echo "   4. 继承系统默认大模型路由、MinerU 文档解析、语音合成与图片生成配置"
echo "   5. 生成完毕后直接归入多用户数据库，多设备自动云端漫游"
echo "=========================================================="
