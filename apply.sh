#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "  OpenMAIC 多用户管理与认证模块补丁安装程序"
echo "  OpenMAIC Multi-Users Module Patch Installer"
echo "=========================================================="

# 检查当前目录是否为 OpenMAIC 根目录
if [ ! -f "package.json" ] || ! grep -q '"name": "openmaic"' "package.json" 2>/dev/null; then
  echo "❌ 错误: 请在官方 OpenMAIC 代码库根目录下运行此脚本！"
  echo "   Error: Please run this script in the root of official OpenMAIC repository!"
  echo "   例如: cd /path/to/OpenMAIC && /path/to/apply.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="${SCRIPT_DIR}/openmaic-multi-user.patch"

if [ ! -f "$PATCH_FILE" ]; then
  echo "❌ 错误: 未找到补丁文件 $PATCH_FILE"
  exit 1
fi

echo "📦 正在检查并打入多用户补丁..."
if git apply --check "$PATCH_FILE" 2>/dev/null; then
  git apply "$PATCH_FILE"
  echo "✅ 补丁成功打入！"
else
  echo "⚠️ 标准 git apply 遇到冲突，正在尝试通过 3-way merge 合并..."
  git apply --3way "$PATCH_FILE" || {
    echo "❌ 补丁应用失败，请检查是否已存在冲突代码。"
    exit 1
  }
fi

echo ""
echo "=========================================================="
echo "🎉 安装完成！接下来请完成以下配置："
echo "=========================================================="
echo "1. 确保在 .env.local 中配置了 PostgreSQL 数据库："
echo "   DATABASE_URL=postgres://openmaic:password@127.0.0.1:5432/openmaic"
echo "   OPENMAIC_AGENT_RUNTIME_ENABLED=true"
echo ""
echo "2. 编译项目并启动："
echo "   pnpm install"
echo "   pnpm build"
echo "   pm2 restart openmaic --update-env  (或 pnpm start)"
echo ""
echo "3. 默认初始管理员账号："
echo "   用户名: admin"
echo "   初始密码: admin123456"
echo "=========================================================="
