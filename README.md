# ace-tool

MCP server for codebase indexing and semantic search.

## Installation

```bash
npm install -g ace-tool
```

Or use directly with npx:

```bash
npx ace-tool --base-url <URL> --token <TOKEN>
```

## Configuration

### MCP Settings

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

### Command Line Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `--base-url` | Yes | API base URL for the indexing service |
| `--token` | Yes | Authentication token |
| `--enable-log` | No | Enable logging to `.ace-tool/ace-tool.log` in project directory |

## Tools

### search_context

Search for relevant code context based on a natural language query.

**Parameters:**

- `project_root_path` (required): Absolute path to the project root directory
- `query` (required): Natural language description of the code you're looking for

**Example queries:**

- "Where is the function that handles user authentication?"
- "Find the initialization flow of message queue consumers during startup"
- "How is the database connected to the application?"

## Project Data

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

## Supported File Types

- **Programming languages**: `.py`, `.js`, `.ts`, `.jsx`, `.tsx`, `.java`, `.go`, `.rs`, `.cpp`, `.c`, `.h`, `.hpp`, `.cs`, `.rb`, `.php`, `.swift`, `.kt`, `.scala`, `.clj`
- **Config/Data**: `.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.ini`, `.conf`
- **Web**: `.html`, `.css`, `.scss`, `.sass`, `.less`, `.vue`, `.svelte`
- **Scripts**: `.sql`, `.sh`, `.bash`, `.ps1`, `.bat`

## License

MIT
