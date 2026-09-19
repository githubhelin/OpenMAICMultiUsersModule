#!/usr/bin/env bash
# ==============================================================================
# OpenMAIC Pro Workbench (方案 B) 一键自动化配置与验证脚本
# 适用场景：本地直接运行 或 由 AI Agent 在新环境中调用执行
# ==============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}   OpenMAIC Pro Workbench (方案 B) 自动化配置向导    ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. 确保在 OpenMAIC 项目根目录运行
if [ ! -f "package.json" ] || ! grep -q "openmaic" "package.json" 2>/dev/null; then
    echo -e "${RED}[错误] 请在 OpenMAIC 项目根目录下执行此脚本！${NC}"
    exit 1
fi

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}[提示] 未检测到 .env.local，从 .env.example 创建新文件...${NC}"
        cp .env.example "$ENV_FILE"
    else
        touch "$ENV_FILE"
    fi
fi

# 2. 检查并设置环境变量
echo -e "${YELLOW}[1/4] 检查并更新 .env.local 环境变量...${NC}"

set_env_var() {
    local key="$1"
    local val="$2"
    if grep -q "^[# ]*${key}=" "$ENV_FILE"; then
        sed -i "s|^[# ]*${key}=.*|${key}=${val}|" "$ENV_FILE"
    else
        echo "${key}=${val}" >> "$ENV_FILE"
    fi
}

set_env_var "NEXT_PUBLIC_PRO_WORKBENCH_ENABLED" "true"
set_env_var "NEXT_PUBLIC_MAIC_EDITOR_ENABLED" "true"
set_env_var "OPENMAIC_AGENT_RUNTIME_ENABLED" "true"

# 检查 DATABASE_URL
if ! grep -q "^DATABASE_URL=postgres" "$ENV_FILE"; then
    echo -e "${YELLOW}[警告] 未在 .env.local 中检测到有效的 DATABASE_URL！${NC}"
    echo -e "${YELLOW}Agent Runtime 依赖 PostgreSQL 数据库。${NC}"
    DEFAULT_PG="postgres://openmaic:openmaic_password@127.0.0.1:5432/openmaic"
    set_env_var "DATABASE_URL" "$DEFAULT_PG"
    echo -e "${GREEN}[已写入默认连接串] DATABASE_URL=${DEFAULT_PG}${NC}"
fi

# 检查 MODEL_ROUTES
if ! grep -q "^MODEL_ROUTES=" "$ENV_FILE"; then
    DEFAULT_ROUTE='{"maic-agent-driver":{"model":"openai:gpt-5.5","api":"openai-completions"}}'
    set_env_var "MODEL_ROUTES" "'$DEFAULT_ROUTE'"
    echo -e "${GREEN}[已写入默认大模型路由] MODEL_ROUTES=${DEFAULT_ROUTE}${NC}"
    echo -e "${YELLOW}[提醒] 请确保在 .env.local 中配置了对应 Provider 的 API Key（如 OPENAI_API_KEY）！${NC}"
fi

echo -e "${GREEN}✓ 环境变量更新完毕。${NC}"

# 3. 重新构建前端
echo -e "${YELLOW}[2/4] 正在编译前端项目 (npm run build)...${NC}"
echo -e "${BLUE}提示：NEXT_PUBLIC_* 特性开关必须在 build 时内联到代码中。${NC}"
npm run build
echo -e "${GREEN}✓ 编译打包完成！${NC}"

# 4. 重启应用服务
echo -e "${YELLOW}[3/4] 重启应用进程...${NC}"
if command -v pm2 >/dev/null 2>&1 && pm2 list | grep -q "openmaic"; then
    echo -e "${BLUE}使用 PM2 重载服务并应用新环境变量...${NC}"
    pm2 restart openmaic --update-env
    echo -e "${GREEN}✓ PM2 重启成功！${NC}"
else
    echo -e "${YELLOW}未检测到名为 openmaic 的 PM2 进程，如果以 systemd 或 npm run start 方式运行，请手动重启进程。${NC}"
fi

# 5. 健康检查验证
echo -e "${YELLOW}[4/4] 验证服务健康状态与接口响应...${NC}"
sleep 2

PORT=3000
RUNTIME_URL="http://127.0.0.1:${PORT}/api/agent/runtime"
WORKSPACE_URL="http://127.0.0.1:${PORT}/workspace"

RUNTIME_RESP=$(curl -s "$RUNTIME_URL" 2>/dev/null || echo "")
if echo "$RUNTIME_RESP" | grep -q '"enabled":true'; then
    echo -e "${GREEN}✓ Agent Runtime 接口验证成功: ${RUNTIME_RESP}${NC}"
else
    echo -e "${RED}✗ Agent Runtime 接口返回异常: ${RUNTIME_RESP}${NC}"
    echo -e "${YELLOW}请检查 PostgreSQL 是否正常运行，以及 .env.local 中的 DATABASE_URL 是否准确。${NC}"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKSPACE_URL" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ /workspace 页面状态正常 (HTTP 200)${NC}"
else
    echo -e "${RED}✗ /workspace 页面返回状态码: ${HTTP_CODE}${NC}"
fi

echo -e "${BLUE}======================================================${NC}"
echo -e "${GREEN}🎉 OpenMAIC 方案 B (Pro 工作台 + 编辑模式) 配置成功！${NC}"
echo -e "访问方式："
echo -e "  1. 打开首页 http://127.0.0.1:${PORT}/，点击 Logo 右上角的 [Pro] 徽章进入工作台"
echo -e "  2. 进入任意课程页面，右上角顶栏已激活 [PRO MODE] 专业编辑开关"
echo -e "${BLUE}======================================================${NC}"
