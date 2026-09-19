# OpenMAIC 方案 B（Pro 智能体工作台 + 专业编辑模式）配置指南

> **说明**：本指南专用于在其他设备或新环境中为 **OpenMAIC** 开启 **方案 B（Pro Workbench 智能体工作台 + MAIC Editor 课件专业编辑模式）**。
> 本文档包含完整的标准化流程与排查规范，**可直接交由 AI Coding Agent（如 Antigravity、Cursor、Claude Code 等）按步骤自动执行**。

---

## 📋 方案 B 核心能力概述

开启方案 B 后，OpenMAIC 将获得完整的高级创作与编辑能力：
1. **智能体工作台（Pro Workbench）**：
   - 在首页 Logo 旁显示 `[Pro]` 徽章，点击进入专属工作台（`/workspace`）。
   - 左侧为多轮对话 Agent（支持多会话、自动规划课程大纲、自动生成与修改幻灯片、调用工具操作素材）。
2. **课件专业编辑模式（MAIC Editor / Pro Mode）**：
   - 方案 B 在底层**完全包含**方案 A 的手动课件编辑器能力。
   - 在工作台右侧或课程回放页右上角顶栏提供 `PRO MODE` 开关，可手动点选幻灯片元素、调整版面布局、修改文案及重新生成配音。

---

## 🤖 给 AI Agent 的执行工作流规范 (Agent Workflow)

当要求 AI Agent 按照本指南进行自动化配置时，Agent 必须依次执行以下 5 个步骤，并完成最终验证：

```mermaid
flowchart TD
    A["步骤 1: 检查前置环境 (Node.js & PostgreSQL)"] --> B["步骤 2: 配置 .env.local 环境变量"]
    B --> C["步骤 3: 重新执行 npm run build 打包"]
    C --> D["步骤 4: 重启 PM2 / 服务进程"]
    D --> E["步骤 5: 自动化接口验证与排查"]
```

---

### 步骤 1：检查前置运行环境

请检查当前机器是否满足以下要求：
1. **Node.js 版本**：>= 22.19.0
   ```bash
   node -v
   ```
2. **PostgreSQL 数据库**（Agent Runtime 强依赖）：
   - 检查 PostgreSQL 服务是否正在运行：
     ```bash
     pg_isready -h 127.0.0.1 -p 5432
     ```
   - 确保存在数据库用户和库（默认推荐 `openmaic` / `openmaic`）。

---

### 步骤 2：配置 `.env.local` 环境变量

编辑项目根目录下的 `.env.local` 文件，确保包含以下 4 项核心配置：

#### 1. 前端特性编译开关（Build-time Flags）
> ⚠️ **关键**：`NEXT_PUBLIC_*` 变量会在 Next.js 构建时编译内联到前端 JS 包中，必须在打包前配置。
```env
NEXT_PUBLIC_PRO_WORKBENCH_ENABLED=true
NEXT_PUBLIC_MAIC_EDITOR_ENABLED=true
```

#### 2. 服务端 Agent 运行时开关
```env
OPENMAIC_AGENT_RUNTIME_ENABLED=true
```

#### 3. PostgreSQL 数据库连接串
```env
DATABASE_URL=postgres://<用户名>:<密码>@127.0.0.1:5432/<数据库名>
# 本机典型示例:
# DATABASE_URL=postgres://openmaic:openmaic_password@127.0.0.1:5432/openmaic
```

#### 4. Agent 驱动大模型路由（`maic-agent-driver`）
Pro Workbench 中的 Agent 是一个持久化运行的服务端会话，需要由指定的大模型驱动，请在 `MODEL_ROUTES` 中配置 `maic-agent-driver`，并在 `.env.local` 中填入对应的 API Key。

> **格式约束**：
> - `model` 必须带有 Provider 前缀（例如 `openai:gpt-5.5`、`deepseek:deepseek-chat`、`qwen:qwen-plus`）。
> - `api` 字段必须为 `"openai-completions"` 或 `"openai-responses"`。

##### 示例一：使用 OpenAI（GPT-4o / GPT-5）
```env
OPENAI_API_KEY=sk-your-openai-api-key
MODEL_ROUTES='{"maic-agent-driver":{"model":"openai:gpt-5.5","api":"openai-completions"}}'
```

##### 示例二：使用 DeepSeek
```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
MODEL_ROUTES='{"maic-agent-driver":{"model":"deepseek:deepseek-chat","api":"openai-completions"}}'
```

##### 示例三：使用阿里百炼 Qwen
```env
QWEN_API_KEY=sk-your-qwen-api-key
MODEL_ROUTES='{"maic-agent-driver":{"model":"qwen:qwen-plus","api":"openai-completions"}}'
```

##### 示例四：使用硅基流动（SiliconFlow）
```env
SILICONFLOW_API_KEY=sk-your-siliconflow-api-key
MODEL_ROUTES='{"maic-agent-driver":{"model":"siliconflow:Qwen/Qwen2.5-72B-Instruct","api":"openai-completions"}}'
```

---

### 步骤 3：重新编译前端项目（必做）

因为 `NEXT_PUBLIC_PRO_WORKBENCH_ENABLED` 是前端编译期注入的环境变量，**仅修改 `.env.local` 不重新编译是不会生效的**。

必须执行编译指令：
```bash
npm run build
```
*（等待构建完成，确认控制台输出中包含 `✓ Compiled successfully` 以及 `ƒ /workspace` 路由）*

---

### 步骤 4：重启服务进程

#### 如果使用 PM2 守护进程（推荐）：
必须携带 `--update-env` 参数，让 PM2 重新加载环境变量：
```bash
pm2 restart openmaic --update-env
```

#### 如果使用直接启动：
```bash
npm run start
```

---

### 步骤 5：自动化校验与测试

Agent 在完成上述操作后，应执行以下命令验证配置是否生效：

#### 1. 验证 Agent Runtime 接口
```bash
curl -s http://127.0.0.1:3000/api/agent/runtime
```
**期望返回**：
```json
{"enabled":true,"runtimeEnabled":true}
```
*如果 `enabled` 为 `false`，说明 `OPENMAIC_AGENT_RUNTIME_ENABLED` 未开启或 `DATABASE_URL` 无法连接。*

#### 2. 验证 `/workspace` 页面连通性
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/workspace
```
**期望返回**：`200`

#### 3. 浏览器端最终检查点
1. 打开首页 `http://<服务器IP>:3000/`，在 **OpenMAIC** 大标题右上方应出现灰/紫色胶囊徽章 **`[Pro]`**。
2. 点击 `[Pro]` 徽章，无缝切换进入 `/workspace` 智能体工作台。
3. 打开任意一门生成的课程，顶栏右上角设置旁应出现 **`PRO MODE`** 滑动开关。

---

## 🛠️ 故障排查（Troubleshooting）

| 异常现象 | 可能原因 | 解决办法 |
| :--- | :--- | :--- |
| 访问首页没有出现 `[Pro]` 徽章 | 修改了 `.env.local` 后未重新运行 `npm run build` | 重新执行 `npm run build`，完成后用 `pm2 restart openmaic --update-env` 重启。浏览器需强制刷新（Ctrl+F5）。 |
| `/api/agent/runtime` 返回 `enabled: false` | 1. 未设置 `OPENMAIC_AGENT_RUNTIME_ENABLED=true`<br>2. `DATABASE_URL` 连接失败 | 检查 PostgreSQL 是否启动，检查连接账号密码是否正确。 |
| 进入工作台与 Agent 对话时报错或卡住 | `MODEL_ROUTES` 中的 Provider 未配置 API Key | 查看 PM2 错误日志 `pm2 logs openmaic --err`，补充对应大模型的 API Key。 |
| 报错提示模型不支持 Function Call | 配置的模型能力不足或未提供工具调用接口 | 将 `MODEL_ROUTES` 中的驱动模型替换为具备原生 Tool Use 能力的成熟模型（如 GPT-4o, DeepSeek-V3, Qwen-Plus 等）。 |

---

## 🚀 附：一键自动化配置脚本

本目录下提供了自动化脚本 [setup-pro-workbench.sh](./setup-pro-workbench.sh)。在目标机器的项目根目录下可直接运行：
```bash
bash pro-workbench-guide/setup-pro-workbench.sh
```
该脚本会自动校验环境、补充 `.env.local` 选项、触发构建并完成接口健康检查。
