#!/usr/bin/env bash
set -e

# ==============================================================================
# OpenMAIC 多用户模块补丁自动安装、诊断与管理工具
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
PATCH_FILE="${SCRIPT_DIR}/openmaic-multi-user.patch"

# 1. 验证运行目录
if [ ! -f "package.json" ] || ! grep -q '"name": "openmaic"' "package.json" 2>/dev/null; then
  echo "❌ 错误: 请在官方 OpenMAIC 代码库根目录下运行此脚本！"
  echo "   当前目录: $(pwd)"
  exit 1
fi

# 2. 如果本地不存在补丁文件（例如通过 curl 管道直接执行时），自动从 GitHub 下载
if [ ! -f "$PATCH_FILE" ]; then
  if [ -f "openmaic-multi-user.patch" ]; then
    PATCH_FILE="$(pwd)/openmaic-multi-user.patch"
  else
    echo "📥 本地未检测到补丁包，正在从 GitHub 获取最新补丁..."
    mkdir -p /tmp/openmaic-patch
    curl -sSL "https://raw.githubusercontent.com/githubhelin/OpenMAICMultiUsersModule/main/openmaic-multi-user.patch" -o /tmp/openmaic-patch/openmaic-multi-user.patch
    PATCH_FILE="/tmp/openmaic-patch/openmaic-multi-user.patch"
  fi
fi

# 功能: 查看当前系统运行状态 (--status)
if [[ "$1" == "--status" || "$1" == "-s" ]]; then
  echo "=========================================================="
  echo "  📊 OpenMAIC 多用户模块运行状态诊断"
  echo "=========================================================="
  
  if [ -f "lib/server/auth/db.ts" ]; then
    echo "✅ 补丁状态: 已打入多用户模块补丁"
  else
    echo "❌ 补丁状态: 尚未安装多用户模块补丁"
  fi

  if [ -f ".env.local" ]; then
    DB_URL=$(grep -E "^DATABASE_URL=" .env.local 2>/dev/null | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -n "$DB_URL" ]; then
      echo "✅ 数据库配置: 已配置 DATABASE_URL"
      if command -v node >/dev/null 2>&1; then
        DATABASE_URL="$DB_URL" node -e "
          const { Pool } = require('pg');
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
          pool.query('SELECT COUNT(*) FROM users;').then(res => {
            console.log('✅ 数据库连通性: 正常 (当前注册用户数: ' + res.rows[0].count + ')');
            pool.end().then(() => process.exit(0));
          }).catch(err => {
            console.log('⚠️ 数据库连通性: 连接失败 (' + err.message + ')');
            pool.end().then(() => process.exit(0));
          });
        " 2>/dev/null || true
      fi
    else
      echo "⚠️ 数据库配置: 未在 .env.local 中配置 DATABASE_URL"
    fi
  else
    echo "⚠️ 配置文件: 未找到 .env.local"
  fi

  if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "openmaic"; then
    echo "✅ PM2 服务: 进程正在运行"
  else
    echo "ℹ️  PM2 服务: 未检测到运行中的 openmaic PM2 进程"
  fi
  exit 0
fi

# 功能: 撤销补丁 (--revert / --uninstall)
if [[ "$1" == "--revert" || "$1" == "--uninstall" ]]; then
  echo "=========================================================="
  echo "  🔄 正在撤销多用户补丁并恢复官方原版代码..."
  echo "=========================================================="
  if git apply -R --check --whitespace=nowarn "$PATCH_FILE" 2>/dev/null; then
    git apply -R --whitespace=nowarn "$PATCH_FILE"
    rm -rf app/api/auth app/api/admin components/auth components/admin lib/server/auth lib/store/auth-store.ts tests/auth scripts/reset-admin-password.mjs README-MULTIUSER.md
    echo "🎉 多用户补丁已成功撤销，项目已完全恢复至官方原版状态！"
  else
    echo "⚠️ 检测到部分代码有后续修改，尝试 3-Way 反向合并..."
    git apply -R --3way --whitespace=nowarn "$PATCH_FILE" || {
      echo "❌ 撤销失败，请手动检查 git diff"
      exit 1
    }
    rm -rf app/api/auth app/api/admin components/auth components/admin lib/server/auth lib/store/auth-store.ts tests/auth scripts/reset-admin-password.mjs README-MULTIUSER.md
    echo "🎉 多用户补丁已成功撤销！"
  fi
  exit 0
fi

# 功能: 重置管理员密码 (--reset-admin [新密码])
if [[ "$1" == "--reset-admin" ]]; then
  NEW_PASS="${2:-admin123456}"
  if [ -f "scripts/reset-admin-password.mjs" ]; then
    node scripts/reset-admin-password.mjs admin "$NEW_PASS"
  else
    echo "❌ 尚未安装多用户模块，无法执行密码重置！"
    exit 1
  fi
  exit 0
fi

echo "=========================================================="
echo "  🛡️  OpenMAIC 多用户补丁与环境配置安装程序"
echo "=========================================================="

# 3. 自动预检查 (Pre-check)
echo ""
echo "🔍 [步骤 1/3] 正在自动进行代码冲突与兼容性预检查..."

CHECK_OUTPUT=$(git apply --check --whitespace=nowarn "$PATCH_FILE" 2>&1 || true)

if [ -z "$CHECK_OUTPUT" ]; then
  echo "✅ 检查通过: 补丁与当前官方代码 100% 匹配，无任何冲突！"
  
  if [[ "$1" == "--check" || "$1" == "-c" ]]; then
    echo "💡 当前为只检模式 (--check)，未修改任何文件。"
    exit 0
  fi

  echo ""
  echo "📦 [步骤 2/3] 正在自动打入多用户模块补丁..."
  git apply --whitespace=nowarn "$PATCH_FILE"
  echo "🎉 补丁代码已成功打入您的项目！"

else
  # 预检查未通过，尝试测试 3-way 合并是否可行
  THREE_WAY_CHECK=$(git apply --check --3way --whitespace=nowarn "$PATCH_FILE" 2>&1 || true)
  
  if [ -z "$THREE_WAY_CHECK" ]; then
    echo "⚠️  检测到官方版本有上下文微调，但 3-Way 智能合并可自动平滑解决。"
    if [[ "$1" == "--check" || "$1" == "-c" ]]; then
      echo "💡 当前为只检模式 (--check)，可平滑合并，未修改任何文件。"
      exit 0
    fi
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

# 4. 检查与引导配置 PostgreSQL
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
  RAND_SECRET=$(DATABASE_URL="$DB_URL" node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || echo "openmaic-default-auth-secret-$(date +%s)")
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
  DB_PASS=$(DATABASE_URL="$DB_URL" node -e "console.log(require('crypto').randomBytes(8).toString('hex'))" 2>/dev/null || echo "openmaic_pwd_$(date +%s)")

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

  # 参数优先级
  if [[ "$*" == *"--skip-db"* ]]; then
    DB_OPTION=4
  elif [[ "$*" == *"--native-db"* ]]; then
    DB_OPTION=1
  elif [[ "$*" == *"--docker-db"* ]]; then
    DB_OPTION=3
  else
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
      # 非交互式或管道输入时读取一行，默认 1
      read -r DB_OPTION 2>/dev/null || DB_OPTION=1
      DB_OPTION=${DB_OPTION:-1}
    fi
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
echo ""
echo "💡 实用维护命令："
echo "   - 运行状态诊断: ./apply.sh --status"
echo "   - 重置管理员密码: ./apply.sh --reset-admin <新密码>"
echo "   - 撤销补丁恢复原版: ./apply.sh --revert"
echo "=========================================================="
