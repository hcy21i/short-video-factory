import type { Tool } from '@modelcontextprotocol/sdk/types.js'

export const mcpTools = [
  {
    name: 'list_subtitle_styles',
    description: '列出短视频工厂支持的字幕样式。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'render_video',
    description: '用本地视频片段、配音、可选背景音乐和字幕文件渲染成片。素材路径和输出路径必须是本机绝对路径；视频片段按给定顺序拼接。',
    inputSchema: {
      type: 'object',
      properties: {
        clips: { type: 'array', minItems: 1, items: { type: 'object', properties: { path: { type: 'string' }, start: { type: 'number', minimum: 0 }, end: { type: 'number', exclusiveMinimum: 0 } }, required: ['path', 'start', 'end'], additionalProperties: false } },
        voice: { type: 'string', description: '配音音频文件绝对路径。' },
        bgm: { type: 'string', description: '可选背景音乐文件绝对路径。' },
        subtitle: { type: 'string', description: '可选 SRT 字幕文件绝对路径。' },
        style: { type: 'string', enum: ['Clean', 'Bold', 'Boxed', 'Shorts', 'Caption', 'CJK', 'Neon', 'Podcast', 'Cinema', 'Punch', 'Minimal', 'Reel Box'], description: '字幕样式预设。' },
        width: { type: 'integer', minimum: 16, maximum: 4096 },
        height: { type: 'integer', minimum: 16, maximum: 4096 },
        output: { type: 'string', description: '输出视频文件绝对路径，所在文件夹必须已存在。' },
        exportSrt: { type: 'boolean' },
      },
      required: ['clips', 'voice', 'width', 'height', 'output'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_task_status',
    description: '查询当前 MCP 连接启动后提交的渲染任务。',
    inputSchema: { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'], additionalProperties: false },
  },
  {
    name: 'cancel_task',
    description: '取消指定的渲染任务。',
    inputSchema: { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'], additionalProperties: false },
  },
] satisfies Tool[]
