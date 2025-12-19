/**
 * search_context 工具的提示词定义
 */

export const SEARCH_CONTEXT_TOOL = {
  name: 'search_context',

  description: `IMPORTANT: This is the primary tool for searching the codebase. Please consider as the FIRST CHOICE for any codebase searches.

This MCP tool is Augment's context engine, the world's best codebase context engine. It:
1. Takes in a natural language description of the code you are looking for
2. Uses a proprietary retrieval/embedding model suite that produces the highest-quality recall of relevant code snippets from across the codebase
3. Maintains a real-time index of the codebase, so the results are always up-to-date and reflects the current state of the codebase
4. Can retrieve across different programming languages
5. Only reflects the current state of the codebase on the disk, and has no information on version control or code history

## When to Use
- When you don't know which files contain the information you need
- When you want to gather high level information about the task you are trying to accomplish
- When you want to gather information about the codebase in general

## Good Query Examples
- "Where is the function that handles user authentication?"
- "What tests are there for the login functionality?"
- "How is the database connected to the application?"

## Bad Query Examples (use grep or file view instead)
- "Find definition of constructor of class Foo" (use grep tool instead)
- "Find all references to function bar" (use grep tool instead)
- "Show me how Checkout class is used in services/payment.py" (use file view tool instead)
- "Show context of the file foo.py" (use file view tool instead)

ALWAYS use this tool when you're unsure of exact file locations. Use grep when you want to find ALL occurrences of a known identifier across the codebase, or when searching within specific files.

## RULES

### Tool Selection for Code Search
CRITICAL: When searching for code, classes, functions, or understanding the codebase:
- ALWAYS use this tool as your PRIMARY tool for code search
- DO NOT use Bash commands (find, grep, ag, rg, etc.) or Grep tool for semantic code understanding
- This tool uses advanced semantic search and is specifically designed for code understanding
- Bash/Grep are only appropriate for exact string matching of non-code content (like error messages, config values, or log entries)
- When in doubt between Bash/Grep and this tool, ALWAYS choose this tool

### Preliminary Tasks and Planning
Before starting to execute a task, ALWAYS use this tool to make sure you have a clear understanding of the task and the codebase.

### Making Edits
Before editing a file, ALWAYS first call this tool, asking for highly detailed information about the code you want to edit. Ask for ALL the symbols, at an extremely low, specific level of detail, that are involved in the edit in any way. Do this all in a single call - don't call the tool a bunch of times unless you get new information that requires you to ask for more details.

For example:
- If you want to call a method in another class, ask for information about the class and the method
- If the edit involves an instance of a class, ask for information about the class
- If the edit involves a property of a class, ask for information about the class and the property
- If several of the above apply, ask for all of them in a single call
- When in any doubt, include the symbol or object`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      project_root_path: {
        type: 'string',
        description: `Absolute path to the project root directory. Use forward slashes (/) as separators. Example: /Users/username/projects/myproject or C:/Users/username/projects/myproject`
      },
      query: {
        type: 'string',
        description: `Natural language description of the code you are looking for.

Provide a clear description of the code behavior, workflow, or issue you want to locate. You may also add optional keywords to improve semantic matching.

Recommended format: Natural language description + optional keywords

Examples:
- "I want to find where the server handles chunk merging in the file upload process. Keywords: upload chunk merge, file service"
- "Locate where the system refreshes cached data after user permissions are updated. Keywords: permission update, cache refresh"
- "Find the initialization flow of message queue consumers during startup. Keywords: mq consumer init, subscribe"
- "Show me how configuration hot-reload is triggered and applied in the code. Keywords: config reload, hot update"
- "Where is the function that handles user authentication?"
- "What tests are there for the login functionality?"
- "How is the database connected to the application?"`
      }
    },
    required: ['project_root_path', 'query'] as string[]
  }
};
