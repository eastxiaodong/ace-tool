/**
 * Enhance Prompt Tool 定义
 */

export const ENHANCE_PROMPT_TOOL = {
  name: 'enhance_prompt',
  description:
    'Enhances user requirements by combining codebase context and conversation history to generate clearer, more specific, and actionable prompts. IMPORTANT: Use this tool ONLY when: (1) User message contains explicit markers: -enhance, -enhancer, -Enhance, -Enhancer (case-insensitive, can appear anywhere in message). Examples: "新加一个登录页面-Enhancer", "Add login feature -enhance"; (2) User explicitly asks to "enhance my prompt" or "use enhance_prompt tool". DO NOT use for general optimization requests like "optimize this code" or "improve this function" - those are code optimization requests, not prompt enhancement. The tool opens a Web UI for user review and confirmation. Supports English and Chinese.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      project_root_path: {
        type: 'string',
        description: '项目根目录的绝对路径。重要：从 IDE 的工作区/项目根目录信息获取（如 IDE State 中的 Workspace 字段，或在终端使用 pwd 命令）。',
      },
      prompt: {
        type: 'string',
        description: '需要增强的原始 prompt',
      },
      conversation_history: {
        type: 'string',
        description: '最近的对话历史（5-10轮对话），帮助理解用户意图和项目背景',
      },
    },
    required: ['prompt', 'conversation_history'] as string[],
  },
};
