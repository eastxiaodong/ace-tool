# ace-tool

[English](#english) | [中文](#中文)

---

## English

MCP server for codebase indexing and semantic search.

### Installation

```bash
npm install -g ace-tool
```

Or use directly with npx:

```bash
npx ace-tool --base-url <URL> --token <TOKEN>
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
| `--batch-size` | No | Number of blobs per `/batch-upload` request (default: 50) |
| `--max-lines-per-blob` | No | Max lines per blob when splitting large files (default: 2000) |
| `--upload-concurrency` | No | Parallel upload workers for batch requests (default: 2) |
| `--upload-timeout-ms` | No | Timeout per `/batch-upload` request in ms (default: 30000) |
| `--retrieval-timeout-ms` | No | Timeout for codebase retrieval request in ms (default: 60000) |

### Tools

#### search_context

Search for relevant code context based on a natural language query.

**Parameters:**

- `project_root_path` (required): Absolute path to the project root directory
- `query` (required): Natural language description of the code you're looking for

**Example queries:**

- "Where is the function that handles user authentication?"
- "Find the initialization flow of message queue consumers during startup"
- "How is the database connected to the application?"

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

用于代码库索引和语义搜索的 MCP 服务器。

### 安装

```bash
npm install -g ace-tool
```

或直接使用 npx：

```bash
npx ace-tool --base-url <URL> --token <TOKEN>
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
| `--batch-size` | 否 | 每次 `/batch-upload` 上传的 blob 数量（默认 50） |
| `--max-lines-per-blob` | 否 | 大文件切分时每个 blob 的最大行数（默认 2000） |
| `--upload-concurrency` | 否 | 批量上传并发数（默认 2） |
| `--upload-timeout-ms` | 否 | 单次 `/batch-upload` 请求超时毫秒数（默认 30000） |
| `--retrieval-timeout-ms` | 否 | 检索请求超时毫秒数（默认 60000） |

### 工具

#### search_context

基于自然语言查询搜索相关代码上下文。

**参数：**

- `project_root_path`（必填）：项目根目录的绝对路径
- `query`（必填）：描述你要查找的代码的自然语言

**查询示例：**

- "处理用户认证的函数在哪里？"
- "查找启动时消息队列消费者的初始化流程"
- "数据库是如何连接到应用程序的？"

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
