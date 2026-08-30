#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenMAIC 多用户模块补丁自动检测与安装程序
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="${SCRIPT_DIR}/openmaic-multi-user.patch"

echo "=========================================================="
echo "  🛡️  OpenMAIC 多用户补丁安装程序"
echo "=========================================================="

# 1. 验证运行目录
if [ ! -f "package.json" ] || ! grep -q '"name": "openmaic"' "package.json" 2>/dev/null; then
  echo "❌ 错误: 请在官方 OpenMAIC 代码库根目录下运行此脚本！"
  echo "   当前目录: $(pwd)"
  exit 1
fi

if [ ! -f "$PATCH_FILE" ]; then
  echo "❌ 错误: 未找到补丁文件 $PATCH_FILE"
  exit 1
fi

# 2. 自动预检查 (Pre-check)
echo ""
echo "🔍 [步骤 1/2] 正在自动进行代码冲突与兼容性预检查..."

CHECK_OUTPUT=$(git apply --check --whitespace=nowarn "$PATCH_FILE" 2>&1 || true)

if [ -z "$CHECK_OUTPUT" ]; then
  echo "✅ 检查通过: 补丁与当前官方代码 100% 匹配，无任何冲突！"
  
  echo ""
  echo "📦 [步骤 2/2] 正在自动打入多用户模块补丁..."
  git apply --whitespace=nowarn "$PATCH_FILE"
  echo "🎉 补丁已成功打入您的项目！"

else
  # 预检查未通过，尝试测试 3-way 合并是否可行
  THREE_WAY_CHECK=$(git apply --check --3way --whitespace=nowarn "$PATCH_FILE" 2>&1 || true)
  
  if [ -z "$THREE_WAY_CHECK" ]; then
    echo "⚠️  检测到官方版本有上下文微调，但 3-Way 智能合并可自动平滑解决。"
    echo "📦 [步骤 2/2] 正在执行智能平滑合并打入补丁..."
    git apply --3way --whitespace=nowarn "$PATCH_FILE"
    echo "🎉 补丁已成功打入您的项目！"
  else
    echo ""
    echo "❌ 预检查失败: 检测到与当前官方代码存在冲突！"
    echo "----------------------------------------------------------"
    echo "为了保护您的项目代码安全，脚本未对任何文件进行修改。"
    echo "发生冲突的文件清单如下："
    echo "$CHECK_OUTPUT" | grep -E "error: patch failed|error: .* does not apply" || echo "$CHECK_OUTPUT"
    echo "----------------------------------------------------------"
    echo "💡 提示: 官方近期可能重构了上述文件。您可以查阅 extension/ 目录中的独立源码进行比对。"
    exit 1
  fi
fi

echo ""
echo "=========================================================="
echo "🎉 安装完成！接下来请完成以下配置："
echo "=========================================================="
echo "1. 数据库配置 (.env.local)："
echo "   OPENMAIC_AGENT_RUNTIME_ENABLED=true"
echo "   DATABASE_URL=postgres://openmaic:openmaic_password@127.0.0.1:5432/openmaic"
echo ""
echo "2. 编译与启动："
echo "   pnpm install"
echo "   pnpm build"
echo "   pm2 restart openmaic --update-env  (或 pnpm start)"
echo ""
echo "3. 默认初始超级管理员："
echo "   用户名: admin"
echo "   初始密码: admin123456"
echo "=========================================================="
