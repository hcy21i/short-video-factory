import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { subtitleAnimationOptions } from '../../src/effect-engine/shared/subtitle-animation'
import {
  MAX_MCP_RENDER_DURATION_SECONDS,
  MAX_MCP_SOURCE_TIMESTAMP_SECONDS,
} from '../../src/effect-engine/shared/render-limits'

const subtitleAnimationValues = subtitleAnimationOptions.map(({ value }) => value)

export const mcpTools = [
  {
    name: 'list_subtitle_styles',
    description: '列出短视频工厂支持的字幕样式。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'render_subtitled_video',
    description: '为单个本机视频叠加 SRT 和字幕样式，保留视频自身音轨并导出成片。视频必须带音频；duration 使用秒。任务异步执行，请用 get_task_status 查询进度。',
    inputSchema: {
      type: 'object',
      properties: {
        videoPath: { type: 'string', description: '本机视频文件绝对路径。' },
        subtitle: { type: 'string', description: '本机 SRT 字幕文件绝对路径。' },
        duration: { type: 'number', exclusiveMinimum: 0, maximum: MAX_MCP_RENDER_DURATION_SECONDS, description: `从视频开头开始渲染的时长，单位秒，最多 ${MAX_MCP_RENDER_DURATION_SECONDS} 秒。` },
        style: { type: 'string', enum: ['Clean', 'Bold', 'Boxed', 'Shorts', 'Caption', 'CJK', 'Neon', 'Podcast', 'Cinema', 'Punch', 'Minimal', 'Reel Box'], description: '字幕样式预设；默认为 Clean。' },
        animation: { type: 'string', enum: subtitleAnimationValues, description: '字幕动画；默认为 none。fade-out 会在字幕结束前淡出。' },
        width: { type: 'integer', minimum: 16, maximum: 4096, description: '输出宽度，须为偶数。' },
        height: { type: 'integer', minimum: 16, maximum: 4096, description: '输出高度，须为偶数。' },
        output: { type: 'string', description: '输出视频绝对路径，所在文件夹必须已存在。' },
      },
      required: ['videoPath', 'subtitle', 'duration', 'width', 'height', 'output'],
      additionalProperties: false,
    },
  },
  {
    name: 'render_video',
    description: `用本地视频片段、配音、可选背景音乐和字幕文件渲染成片。素材路径和输出路径必须是本机绝对路径；视频片段按给定顺序拼接；单次输出最多 ${MAX_MCP_RENDER_DURATION_SECONDS} 秒，素材时间点最多 ${MAX_MCP_SOURCE_TIMESTAMP_SECONDS} 秒。`,
    inputSchema: {
      type: 'object',
      properties: {
        clips: { type: 'array', minItems: 1, items: { type: 'object', properties: { path: { type: 'string' }, start: { type: 'number', minimum: 0, maximum: MAX_MCP_SOURCE_TIMESTAMP_SECONDS }, end: { type: 'number', exclusiveMinimum: 0, maximum: MAX_MCP_SOURCE_TIMESTAMP_SECONDS } }, required: ['path', 'start', 'end'], additionalProperties: false } },
        voice: { type: 'string', description: '配音音频文件绝对路径。' },
        bgm: { type: 'string', description: '可选背景音乐文件绝对路径。' },
        subtitle: { type: 'string', description: '可选 SRT 字幕文件绝对路径。' },
        style: { type: 'string', enum: ['Clean', 'Bold', 'Boxed', 'Shorts', 'Caption', 'CJK', 'Neon', 'Podcast', 'Cinema', 'Punch', 'Minimal', 'Reel Box'], description: '字幕样式预设。' },
        animation: { type: 'string', enum: subtitleAnimationValues, description: '字幕动画；默认为 none。fade-out 会在字幕结束前淡出。' },
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
    description: '取消指定的运行中渲染任务。',
    inputSchema: { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'], additionalProperties: false },
  },
] satisfies Tool[]
