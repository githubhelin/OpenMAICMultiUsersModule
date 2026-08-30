#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenMAIC 多用户模块补丁安装与冲突智能检测工具
# OpenMAIC Multi-Users Module Patch & Conflict Diagnostics Tool
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="${SCRIPT_DIR}/openmaic-multi-user.patch"
EXTENSION_DIR="${SCRIPT_DIR}/extension"

echo "=========================================================="
echo "  🛡️  OpenMAIC 多用户补丁安装与冲突检测程序"
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

# 2. 检查当前 Git 工作区状态
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "⚠️  检测到当前工作区有未提交的代码修改。"
  echo "   建议先执行: git stash 或 git commit 保持工作区干净。"
  read -r -p "是否继续检查与打补丁？(y/N): " CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "已取消操作。"
    exit 0
  fi
fi

# 3. 补丁预检查 (Dry-run Pre-check)
echo ""
echo "🔍 正在进行补丁预检查 (Dry-run Pre-check)..."

if git apply --check "$PATCH_FILE" 2>/dev/null; then
  echo "✅ 预检查通过！补丁与当前官方代码 100% 兼容，无任何冲突。"
  
  if [[ "$1" == "--check" || "$1" == "-c" ]]; then
    echo "💡 当前为只检模式 (--check)，未修改任何文件。"
    exit 0
  fi

  echo "📦 正在应用补丁..."
  git apply "$PATCH_FILE"
  echo "🎉 补丁成功应用！"

else
  echo "⚠️  标准匹配未通过，正在尝试 3-Way 智能合并检测..."
  
  if git apply --check --3way "$PATCH_FILE" 2>/dev/null; then
    echo "✅ 3-Way 智能合并预检查通过！代码可自动平滑合并。"
    
    if [[ "$1" == "--check" || "$1" == "-c" ]]; then
      echo "💡 当前为只检模式 (--check)，未修改任何文件。"
      exit 0
    fi

    echo "📦 正在执行 3-Way 智能合并打入补丁..."
    git apply --3way "$PATCH_FILE"
    echo "🎉 补丁成功应用！"
  else
    echo ""
    echo "❌ 警告: 检测到潜在代码冲突！"
    echo "----------------------------------------------------------"
    echo "官方可能近期更新了以下几个挂载点文件："
    git apply --check "$PATCH_FILE" 2>&1 | grep "error: patch failed" || true
    echo "----------------------------------------------------------"
    echo ""
    echo "🛠️ 推荐解决方案："
    echo "方案 A: 自动将新模块文件复制到项目中，仅保留最少量的手动挂载"
    echo "方案 B: 放弃并退出"
    echo ""
    read -r -p "是否执行【方案 A 智能文件覆盖】？(y/N): " RESOLVE_CHOICE
    
    if [[ "$RESOLVE_CHOICE" == "y" || "$RESOLVE_CHOICE" == "Y" ]]; then
      echo "📦 正在复制独立扩展文件..."
      cp -r "$EXTENSION_DIR"/* ./
      echo "✅ 独立扩展文件已复制完成！"
      echo "⚠️ 请注意：若 app/page.tsx 或 components/stage/header-controls.tsx 有变动，"
      echo "   只需在相应位置挂载 <UserNav /> 组件即可完成多用户接入。"
    else
      echo "已取消操作，未对代码做任何修改。"
      exit 1
    fi
  fi
fi

echo ""
echo "=========================================================="
echo "🎉 安装就绪！请确保完成以下配置："
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
echo "3. 默认超级管理员："
echo "   账号: admin"
echo "   密码: admin123456"
echo "=========================================================="
