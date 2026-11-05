import { randomUUID, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { app } from 'electron'
import { openSubsPresets, resolveOpenSubsPreset } from '../../src/effect-engine/opensubs-presets'
import { setupEffectRendererFrameWriter } from '../effect-engine/export-task-manager'
import { renderVideo } from '../ffmpeg'

type RenderJob = { id: string; status: 'running' | 'completed' | 'failed' | 'cancelled'; progress: number; outputPath?: string; error?: string; controller: AbortController }
const jobs = new Map<string, RenderJob>()
const activeJobs = new Set<string>()
const publicJob = ({ controller: _controller, ...job }: RenderJob) => job
const toolResult = (value: unknown, isError = false) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], ...(isError ? { isError: true } : {}) })
function fileExists(value: unknown, label: string) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !fs.existsSync(value) || !fs.statSync(value).isFile()) throw new Error(`${label}必须是存在的文件绝对路径`)
  return value
}
function existsDirectory(directory: string) {
  try { return fs.statSync(directory).isDirectory() } catch { return false }
}
function errorResult(error: unknown) { return toolResult({ error: error instanceof Error ? error.message : String(error) }, true) }

export async function callMcpTool(name: string, args: Record<string, unknown> = {}) {
  try {
    if (name === 'list_subtitle_styles') return toolResult(openSubsPresets.map(({ name, label }) => ({ name, label })))
    if (name === 'get_task_status' || name === 'cancel_task') {
      const job = jobs.get(String(args['jobId'] ?? ''))
      if (!job) throw new Error('任务不存在或不属于当前 MCP 会话')
      if (name === 'cancel_task' && job.status === 'running') job.controller.abort()
      return toolResult(publicJob(job))
    }
    if (name !== 'render_video') throw new Error(`不支持的工具：${name}`)
    if (activeJobs.size) throw new Error('当前已有渲染任务。请等待它结束后再提交新任务。')

    const clipsInput = args['clips']
    if (!Array.isArray(clipsInput) || clipsInput.length < 1 || clipsInput.length > 200) throw new Error('clips 需要包含 1 到 200 个视频片段')
    const clips = clipsInput.map((item, index) => {
      if (!item || typeof item !== 'object') throw new Error(`第 ${index + 1} 个视频片段格式无效`)
      const clip = item as Record<string, unknown>
      const file = fileExists(clip['path'], '视频')
      const start = clip['start'], end = clip['end']
      if (typeof start !== 'number' || !Number.isFinite(start) || start < 0 || typeof end !== 'number' || !Number.isFinite(end) || end <= start) throw new Error(`第 ${index + 1} 个视频片段的起止时间无效`)
      return { file, start, end }
    })
    const voice = fileExists(args['voice'], '配音')
    const bgm = args['bgm'] ? fileExists(args['bgm'], '背景音乐') : undefined
    const subtitle = args['subtitle'] ? fileExists(args['subtitle'], '字幕') : undefined
    const width = args['width'], height = args['height']
    if (!Number.isInteger(width) || !Number.isInteger(height) || Number(width) < 16 || Number(height) < 16 || Number(width) > 4096 || Number(height) > 4096 || Number(width) % 2 || Number(height) % 2) throw new Error('输出宽高须为 16 到 4096 之间的偶数')
    const output = args['output']
    if (typeof output !== 'string' || !path.isAbsolute(output) || !existsDirectory(path.dirname(output))) throw new Error('输出文件夹必须存在，且输出路径必须是绝对路径')
    const styleName = typeof args['style'] === 'string' ? args['style'] : ''
    if (styleName && !resolveOpenSubsPreset(styleName, Number(height))) throw new Error('未知的字幕样式')

    const id = randomUUID()
    if (jobs.size >= 100) {
      const finishedJob = [...jobs.values()].find((item) => item.status !== 'running')
      if (finishedJob) jobs.delete(finishedJob.id)
    }
    const controller = new AbortController()
    const job: RenderJob = { id, status: 'running', progress: 0, controller }
    jobs.set(id, job)
    activeJobs.add(id)
    const duration = clips.reduce((sum, clip) => sum + clip.end - clip.start, 0)
    void renderVideo({
      videoFiles: clips.map((clip) => clip.file),
      timeRanges: clips.map((clip) => [String(clip.start), String(clip.end)]),
      audioFiles: { voice, bgm }, subtitleFile: subtitle,
      subtitlesEnabled: Boolean(subtitle), exportSubtitles: Boolean(subtitle) && args['exportSrt'] === true,
      subtitleStyle: styleName ? resolveOpenSubsPreset(styleName, Number(height)) : undefined,
      outputSize: { width: Number(width), height: Number(height) }, outputDuration: String(duration), outputPath: output,
      abortSignal: controller.signal, onProgress: (progress) => { job.progress = progress },
    }).then((result) => {
      if (controller.signal.aborted) job.status = 'cancelled'
      else if (result.code !== 0) { job.status = 'failed'; job.error = result.stderr || `FFmpeg exited with ${result.code}` }
      else { job.status = 'completed'; job.progress = 100; job.outputPath = result.outputPath; job.error = result.subtitleExportError }
    }).catch((error: unknown) => {
      job.status = controller.signal.aborted ? 'cancelled' : 'failed'
      job.error = error instanceof Error ? error.message : String(error)
    }).finally(() => activeJobs.delete(id))
    return toolResult(publicJob(job))
  } catch (error) { return errorResult(error) }
}

export async function startMcpWorker() {
  const port = Number(process.env['SHORT_VIDEO_MCP_PORT'])
  const secret = process.env['SHORT_VIDEO_MCP_TOKEN'] ?? ''
  if (!Number.isInteger(port) || port < 1 || port > 65535 || secret.length < 32) throw new Error('MCP worker configuration is missing or invalid')
  setupEffectRendererFrameWriter()
  const server = http.createServer(async (request, response) => {
    const auth = request.headers.authorization ?? ''
    const supplied = Buffer.from(auth.startsWith('Bearer ') ? auth.slice(7) : '')
    const expected = Buffer.from(secret)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { response.writeHead(401).end(); return }
    if (request.method === 'GET' && request.url === '/health') { response.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}'); return }
    if (request.method !== 'POST' || request.url !== '/tool') { response.writeHead(404).end(); return }
    let body = ''
    try {
      for await (const chunk of request) {
        body += chunk.toString()
        if (body.length > 1024 * 1024) { response.writeHead(413).end(); return }
      }
      const payload = JSON.parse(body) as { name?: string; arguments?: Record<string, unknown> }
      const result = await callMcpTool(String(payload.name ?? ''), payload.arguments ?? {})
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result))
    } catch (error) {
      response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify(errorResult(error)))
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve() })
  })
  server.on('close', () => { for (const job of jobs.values()) if (job.status === 'running') job.controller.abort() })
  app.on('before-quit', () => server.close())
}
