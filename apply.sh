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

# 函数: 安装并配置原生 PostgreSQL
setup_native_postgresql() {
  echo "📦 正在配置系统原生 PostgreSQL 服务 (免 Docker)..."
  
  if ! command -v psql >/dev/null 2>&1; then
    echo "▶️ 未检测到 psql 命令，正在通过系统包管理器安装 PostgreSQL..."
    if command -v apt-get >/dev/null 2>&1; then
      sudo apt-get update -y
      sudo apt-get install -y postgresql postgresql-contrib
    elif command -v dnf >/dev/null 2>&1; then
      sudo dnf install -y postgresql-server postgresql-contrib
      sudo postgresql-setup --initdb || true
    elif command -v yum >/dev/null 2>&1; then
      sudo yum install -y postgresql-server postgresql-contrib
      sudo postgresql-setup --initdb || true
    elif command -v pacman >/dev/null 2>&1; then
      sudo pacman -S --noconfirm postgresql
      sudo -u postgres initdb -D /var/lib/postgres/data || true
    elif command -v brew >/dev/null 2>&1; then
      brew install postgresql@16
      brew services start postgresql@16
    else
      echo "⚠️ 未能识别系统包管理器，请先手动安装并运行 PostgreSQL 服务。"
      return 1
    fi
  else
    echo "💡 检测到系统已安装原生 PostgreSQL。"
  fi

  # 启动服务
  if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl enable --now postgresql 2>/dev/null || true
  elif command -v service >/dev/null 2>&1; then
    sudo service postgresql start 2>/dev/null || true
  fi

  DB_USER="openmaic"
  DB_NAME="openmaic"
  DB_PASS=$(node -e "console.log(require('crypto').randomBytes(8).toString('hex'))" 2>/dev/null || echo "openmaic_pwd_$(date +%s)")

  echo "⚙️ 正在自动创建 OpenMAIC 专属数据库与用户角色..."
  if sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" 2>/dev/null | grep -q 1; then
    echo "ℹ️  用户角色 ${DB_USER} 已存在，正在更新密码..."
    sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';"
  else
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';"
  fi

  if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" 2>/dev/null | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
  fi

  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null 2>&1 || true
  sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null 2>&1 || true

  DB_URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
  echo "DATABASE_URL=${DB_URL}" >> "$ENV_FILE"
  echo "✅ 原生 PostgreSQL 配置成功！已写入 $ENV_FILE"
  echo "   连接串: ${DB_URL}"
}

# 检查 DATABASE_URL
CURRENT_DB_URL=$(grep -E "^DATABASE_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)

if [ -n "$CURRENT_DB_URL" ]; then
  echo "✅ 检测到已配置数据库连接: $CURRENT_DB_URL"
else
  echo "⚠️  未检测到 PostgreSQL 配置 (DATABASE_URL)！"
  echo "   💡 多用户模块需要 PostgreSQL 存储用户账号信息与跨设备漫游的课程。"
  echo ""
  echo "请选择配置方式："
  echo "  1) 本机原生安装与配置 PostgreSQL (系统原生服务，免 Docker，推荐 ⭐)"
  echo "  2) 手动输入已有的自建 PostgreSQL 连接串"
  echo "  3) 使用 Docker 容器启动 PostgreSQL"
  echo "  4) 稍后自行手动配置"
  echo ""

  if [ -t 0 ]; then
    read -r -p "请输入选项 [1-4] (默认 1): " DB_OPTION
    DB_OPTION=${DB_OPTION:-1}
  else
    DB_OPTION=1
  fi

  case "$DB_OPTION" in
    1)
      setup_native_postgresql || {
        echo "⚠️ 原生安装未能自动完成，请稍后手动在 $ENV_FILE 中配置 DATABASE_URL"
      }
      ;;
    2)
      read -r -p "请输入您的 PostgreSQL 连接串: " MANUAL_DB
      if [ -n "$MANUAL_DB" ]; then
        echo "DATABASE_URL=$MANUAL_DB" >> "$ENV_FILE"
        echo "✅ 已将连接串写入 $ENV_FILE"
      else
        echo "已跳过输入，稍后请手动在 $ENV_FILE 中配置 DATABASE_URL"
      fi
      ;;
    3)
      if command -v docker >/dev/null 2>&1; then
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
        echo "❌ 未检测到 Docker 命令，请使用原生方式或手动配置。"
      fi
      ;;
    4)
      echo "ℹ️  稍后请在 $ENV_FILE 中手动添加 DATABASE_URL=postgres://user:pass@host:5432/dbname"
      ;;
    *)
      echo "未知选项，跳过数据库自动配置。"
      ;;
  esac
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
