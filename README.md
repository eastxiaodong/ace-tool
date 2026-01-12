# ace-tool

[English](#english) | [中文](#中文)

---

## English

MCP server for codebase indexing, semantic search, and AI prompt enhancement.

### Installation

```bash
npm install -g ace-tool@latest
```

Or use directly with npx:

```bash
npx -y ace-tool@latest --base-url <URL> --token <TOKEN>
```

### Configuration

#### MCP Settings

Add to your MCP configuration (e.g., Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ace-tool": {
      "command": "npx",
      "args": [
        "ace-tool",
        "--base-url", "YOUR_BASE_URL",
        "--token", "YOUR_TOKEN"
      ]
    }
  }
}
```

#### Command Line Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--base-url` | Yes | API base URL for the indexing service |
| `--token` | Yes | Authentication token |
| `--enable-log` | No | Enable logging to `.ace-tool/ace-tool.log` in project directory |

### Tools

#### search_context

Search for relevant code context based on a natural language query.

**Parameters:**

- `project_root_path` (required): Absolute path to the project root directory
- `query` (required): Natural language description of the code you're looking for

**How AI Gets the Path:**

When used in an IDE (like Cursor, VS Code with MCP support), the AI automatically obtains the project path from:
1. **IDE Workspace field** - The `Workspace` field in IDE State/System Prompt
2. **Terminal `pwd` command** - Running `pwd` to get current directory
3. **User input** - Asking user to provide the path if not available

> **Note:** In most IDE environments, you don't need to manually specify the path. The AI will automatically detect it from the IDE's workspace information.

**Example queries:**

- "Where is the function that handles user authentication?"
- "Find the initialization flow of message queue consumers during startup"
- "How is the database connected to the application?"

#### enhance_prompt

Enhances user requirements by combining codebase context and conversation history to generate clearer, more specific, and actionable prompts. Opens a Web UI for user review and confirmation.

**Parameters:**

- `project_root_path` (optional): Absolute path to the project root directory (defaults to current working directory)
- `prompt` (required): The original prompt to enhance
- `conversation_history` (required): Recent conversation history (5-10 rounds) to help understand user intent

**Trigger Methods:**

1. **Explicit markers** (recommended): Add `-enhance`, `-enhancer`, `-Enhance`, or `-Enhancer` to your message
   - Example: "新加一个登录页面-Enhancer"
   - Example: "Add login feature -enhance"

2. **Explicit request**: Ask to "enhance my prompt" or "use enhance_prompt tool"

**Features:**

- Automatic language detection (Chinese input → Chinese output, English input → English output)
- Interactive Web UI with 4 actions:
  - **Send Enhanced**: Use the enhanced version
  - **Use Original**: Continue with original prompt
  - **Continue Enhancing**: Iteratively refine the prompt
  - **End Conversation**: Stop the AI conversation
- Automatic tool name mapping (converts `codebase-retrieval` to `search_context`)
- 8-minute timeout with automatic fallback to original prompt

### Project Data

ace-tool stores index data in a `.ace-tool` directory within each project:

```
your-project/
├── .ace-tool/
│   ├── index.json      # Index metadata
│   └── ace-tool.log    # Logs (if --enable-log is set)
├── src/
└── ...
```

The `.ace-tool` directory is automatically added to `.gitignore`.

### Supported File Types

- **Programming languages**: `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.h`, `.hpp`, `.cs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, `.clj`
- **Config/Data**: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.ini`, `.conf`
- **Web**: `.html`, `.css`, `.scss`, `.sass`, `.less`, `.vue`, `.svelte`
- **Scripts**: `.sql`, `.sh`, `.bash`, `.ps1`, `.bat`

### Error Handling

ace-tool provides friendly error messages for common issues:

| Error Type | Description |
|------------|-------------|
| Token Invalid (401) | Token has expired or is invalid. Update `ACE_TOKEN`. |
| Access Denied (403) | Token may have been disabled. Contact service provider. |
| SSL Certificate Error | SSL certificate validation failed. Check `ACE_BASE_URL`. |
| Connection Refused | Cannot connect to server. Check network or service URL. |
| Connection Timeout | Request timed out. Check network status. |
| DNS Resolution Failed | Cannot resolve server address. Check `ACE_BASE_URL`. |

### MCP Logging

ace-tool supports real-time logging via MCP protocol. Logs are automatically pushed to MCP clients that support the logging capability.

Log levels: `debug`, `info`, `warning`, `error`

To also save logs to a local file, use the `--enable-log` argument.

### License

MIT

---

## 中文

用于代码库索引、语义搜索和 AI prompt 增强的 MCP 服务器。

### 安装

```bash
npm install -g ace-tool@latest
```

或直接使用 npx：

```bash
npx -y ace-tool@latest --base-url <URL> --token <TOKEN>
```

### 配置

#### MCP 设置

添加到你的 MCP 配置文件（例如 Claude Desktop 的 `claude_desktop_config.json`）：

```json
{
  "mcpServers": {
    "ace-tool": {
      "command": "npx",
      "args": [
        "ace-tool",
        "--base-url", "YOUR_BASE_URL",
        "--token", "YOUR_TOKEN"
      ]
    }
  }
}
```

#### 命令行参数

| 参数 | 必填 | 描述 |
|------|------|------|
| `--base-url` | 是 | 索引服务的 API 基础 URL |
| `--token` | 是 | 认证令牌 |
| `--enable-log` | 否 | 启用日志，保存到项目目录的 `.ace-tool/ace-tool.log` |

### 工具

#### search_context

基于自然语言查询搜索相关代码上下文。

**参数：**

- `project_root_path`（必填）：项目根目录的绝对路径
- `query`（必填）：描述你要查找的代码的自然语言

**AI 如何获取路径：**

在 IDE 中使用时（如 Cursor、支持 MCP 的 VS Code），AI 会自动从以下来源获取项目路径：
1. **IDE Workspace 字段** - IDE 状态/系统提示中的 `Workspace` 字段
2. **终端 `pwd` 命令** - 运行 `pwd` 获取当前目录
3. **用户输入** - 如果无法自动获取，会询问用户提供路径

> **注意：** 在大多数 IDE 环境中，你不需要手动指定路径。AI 会自动从 IDE 的工作区信息中检测路径。

**查询示例：**

- "处理用户认证的函数在哪里？"
- "查找启动时消息队列消费者的初始化流程"
- "数据库是如何连接到应用程序的？"

#### enhance_prompt

通过结合代码库上下文和对话历史来增强用户需求，生成更清晰、更具体、更可执行的 prompt。打开 Web UI 供用户审查和确认。

**参数：**

- `project_root_path`（可选）：项目根目录的绝对路径（默认使用当前工作目录）
- `prompt`（必填）：需要增强的原始 prompt
- `conversation_history`（必填）：最近的对话历史（5-10 轮对话），帮助理解用户意图

**触发方式：**

1. **显式标记**（推荐）：在消息中添加 `-enhance`、`-enhancer`、`-Enhance` 或 `-Enhancer`
   - 示例："新加一个登录页面-Enhancer"
   - 示例："Add login feature -enhance"

2. **显式请求**：要求"增强我的 prompt"或"使用 enhance_prompt 工具"

**功能特性：**

- 自动语言检测（中文输入 → 中文输出，英文输入 → 英文输出）
- 交互式 Web UI，提供 4 个操作：
  - **发送增强**：使用增强后的版本
  - **使用原始**：继续使用原始 prompt
  - **继续增强**：迭代式优化 prompt
  - **结束对话**：停止 AI 对话
- 自动工具名称映射（将 `codebase-retrieval` 转换为 `search_context`）
- 8 分钟超时，自动回退到原始 prompt

### 项目数据

ace-tool 在每个项目的 `.ace-tool` 目录中存储索引数据：

```
your-project/
├── .ace-tool/
│   ├── index.json      # 索引元数据
│   └── ace-tool.log    # 日志（如果设置了 --enable-log）
├── src/
└── ...
```

`.ace-tool` 目录会自动添加到 `.gitignore`。

### 支持的文件类型

- **编程语言**：`.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.h`, `.hpp`, `.cs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, `.clj`
- **配置/数据**：`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.ini`, `.conf`
- **Web**：`.html`, `.css`, `.scss`, `.sass`, `.less`, `.vue`, `.svelte`
- **脚本**：`.sql`, `.sh`, `.bash`, `.ps1`, `.bat`

### 错误处理

ace-tool 为常见问题提供友好的错误提示：

| 错误类型 | 描述 |
| -------- | ---- |
| Token 无效 (401) | Token 已过期或无效，请更新 `ACE_TOKEN` |
| 访问被拒绝 (403) | Token 可能已被禁用，请联系服务提供商 |
| SSL 证书错误 | SSL 证书验证失败，请检查 `ACE_BASE_URL` 配置 |
| 连接被拒绝 | 无法连接到服务器，请检查网络或服务地址 |
| 连接超时 | 请求超时，请检查网络状况 |
| DNS 解析失败 | 无法解析服务器地址，请检查 `ACE_BASE_URL` |

### MCP 日志

ace-tool 支持通过 MCP 协议实时推送日志。日志会自动推送到支持日志功能的 MCP 客户端。

日志级别：`debug`, `info`, `warning`, `error`

如需同时保存日志到本地文件，请使用 `--enable-log` 参数。

### 许可证

MIT
