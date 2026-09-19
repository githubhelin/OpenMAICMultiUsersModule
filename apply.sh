#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenMAIC 多用户模块补丁自动检测与安装程序
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCH_FILE="${SCRIPT_DIR}/openmaic-multi-user.patch"

echo "=========================================================="
echo "  🛡️  OpenMAIC 多用户补丁与环境配置安装程序"
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
echo "🔍 [步骤 1/3] 正在自动进行代码冲突与兼容性预检查..."

CHECK_OUTPUT=$(git apply --check --whitespace=nowarn "$PATCH_FILE" 2>&1 || true)

if [ -z "$CHECK_OUTPUT" ]; then
  echo "✅ 检查通过: 补丁与当前官方代码 100% 匹配，无任何冲突！"
  
  echo ""
  echo "📦 [步骤 2/3] 正在自动打入多用户模块补丁..."
  git apply --whitespace=nowarn "$PATCH_FILE"
  echo "🎉 补丁代码已成功打入您的项目！"

else
  # 预检查未通过，尝试测试 3-way 合并是否可行
  THREE_WAY_CHECK=$(git apply --check --3way --whitespace=nowarn "$PATCH_FILE" 2>&1 || true)
  
  if [ -z "$THREE_WAY_CHECK" ]; then
    echo "⚠️  检测到官方版本有上下文微调，但 3-Way 智能合并可自动平滑解决。"
    echo "📦 [步骤 2/3] 正在执行智能平滑合并打入补丁..."
    git apply --3way --whitespace=nowarn "$PATCH_FILE"
    echo "🎉 补丁代码已成功打入您的项目！"
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

# 3. 检查与引导配置 PostgreSQL
echo ""
echo "🐘 [步骤 3/3] 正在检测 PostgreSQL 数据库配置..."

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example "$ENV_FILE"
    echo "📄 已为您从 .env.example 自动创建 $ENV_FILE"
  else
    touch "$ENV_FILE"
  fi
fi

# 确保运行时环境开启
if ! grep -q "^OPENMAIC_AGENT_RUNTIME_ENABLED=" "$ENV_FILE" 2>/dev/null; then
  echo "" >> "$ENV_FILE"
  echo "# --- OpenMAIC Agent Runtime & Multi-User ---" >> "$ENV_FILE"
  echo "OPENMAIC_AGENT_RUNTIME_ENABLED=true" >> "$ENV_FILE"
fi

# 确保会话密钥存在
if ! grep -q "^AUTH_SECRET=" "$ENV_FILE" 2>/dev/null; then
  RAND_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "openmaic-default-auth-secret-$(date +%s)")
  echo "AUTH_SECRET=${RAND_SECRET}" >> "$ENV_FILE"
  echo "🔑 已为您自动生成安全会话密钥 AUTH_SECRET"
fi

# 检查 DATABASE_URL
CURRENT_DB_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)

if [ -n "$CURRENT_DB_URL" ]; then
  echo "✅ 检测到已配置数据库连接: $CURRENT_DB_URL"
else
  echo "⚠️  未检测到 PostgreSQL 配置 (DATABASE_URL)！"
  echo "   💡 多用户模块需要 PostgreSQL 存储用户账号信息与跨设备漫游的课程。"
  echo ""

  # 检查是否安装 Docker
  if command -v docker >/dev/null 2>&1; then
    echo "🐳 检测到当前系统已安装 Docker！"
    read -r -p "是否使用 Docker 一键启动本地 PostgreSQL 容器并自动配置？(Y/n): " DOCKER_CHOICE
    DOCKER_CHOICE=${DOCKER_CHOICE:-y}

    if [[ "$DOCKER_CHOICE" == "y" || "$DOCKER_CHOICE" == "Y" ]]; then
      CONTAINER_NAME="openmaic-postgres"
      if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}\$"; then
        echo "🔄 容器 ${CONTAINER_NAME} 已存在，正在启动..."
        docker start "$CONTAINER_NAME" >/dev/null || true
      else
        echo "🚀 正在启动 PostgreSQL 16 容器..."
        docker run -d \
          --name "$CONTAINER_NAME" \
          --restart always \
          -e POSTGRES_DB=openmaic \
          -e POSTGRES_USER=openmaic \
          -e POSTGRES_PASSWORD=openmaic_password \
          -p 5432:5432 \
          postgres:16 >/dev/null
      fi

      DB_URL="postgres://openmaic:openmaic_password@127.0.0.1:5432/openmaic"
      echo "DATABASE_URL=$DB_URL" >> "$ENV_FILE"
      echo "✅ 已自动配置 DATABASE_URL=$DB_URL"
    else
      echo "已跳过 Docker 安装。"
    fi
  fi

  # 如果仍未配置，提示用户输入
  CURRENT_DB_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
  if [ -z "$CURRENT_DB_URL" ]; then
    echo ""
    read -r -p "请输入您自建的 PostgreSQL 连接串 (直接回车跳过稍后手动配置): " MANUAL_DB
    if [ -n "$MANUAL_DB" ]; then
      echo "DATABASE_URL=$MANUAL_DB" >> "$ENV_FILE"
      echo "✅ 已将连接串写入 $ENV_FILE"
    else
      echo "ℹ️  稍后请务必在 $ENV_FILE 中手动添加 DATABASE_URL=postgres://user:pass@host:5432/dbname"
    fi
  fi
fi

echo ""
echo "=========================================================="
echo "🎉 多用户补丁与环境安装就绪！"
echo "=========================================================="
echo "接下来请执行编译与启动："
echo "   pnpm install"
echo "   pnpm build"
echo "   pm2 restart openmaic --update-env  (或 pnpm start)"
echo ""
echo "🔑 默认超级管理员："
echo "   用户名: admin"
echo "   初始密码: admin123456"
echo "=========================================================="
