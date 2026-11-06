import axios from 'axios'
import { app, BrowserWindow, dialog, ipcMain, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { executeFFmpeg } from '../ffmpeg'
import { assertTrustedAppFrame } from '../lib/trusted-renderer'
import type {
  SaveSrtInput,
  SaveTranscriptionConfigInput,
  SelectedTranscriptionMedia,
  SelectedTranscriptionMediaView,
  TranscriptionConfigView,
  TranscriptionResult,
  TranscribeMediaInput,
} from './types'

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
const VIDEO_EXTENSIONS = new Set(['.avi', '.mkv', '.mov', '.mp4', '.m4v', '.webm', '.mpeg', '.mpg'])
const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.flac',
  '.mp3',
  '.mpga',
  '.mpeg',
  '.m4a',
  '.ogg',
  '.wav',
])
const AUDIO_EXTENSIONS = [
  'aac',
  'aif',
  'aiff',
  'flac',
  'm4a',
  'mp3',
  'mpga',
  'mpeg',
  'oga',
  'ogg',
  'opus',
  'wav',
  'wma',
]
const VIDEO_EXTENSION_LIST = ['avi', 'mkv', 'mov', 'mp4', 'm4v', 'mpeg', 'mpg', 'webm']

interface PersistedTranscriptionConfig {
  version: 1
  apiBaseUrl: string
  model: string
  encryptedApiKey?: string
}

interface TranscriptionConfig extends TranscriptionConfigView {
  apiKey: string
}

const selectedMedia = new Map<string, SelectedTranscriptionMedia>()

function getConfigPath() {
  return path.join(app.getPath('userData'), 'transcription-config.json')
}

async function readConfig(): Promise<TranscriptionConfig> {
  const defaults: TranscriptionConfig = {
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'whisper-1',
    hasApiKey: false,
    apiKey: '',
  }

  try {
    const value = JSON.parse(
      await fs.promises.readFile(getConfigPath(), 'utf8'),
    ) as Partial<PersistedTranscriptionConfig>
    if (typeof value.apiBaseUrl === 'string') defaults.apiBaseUrl = value.apiBaseUrl
    if (typeof value.model === 'string') defaults.model = value.model
    if (typeof value.encryptedApiKey === 'string' && value.encryptedApiKey) {
      defaults.hasApiKey = true
      if (safeStorage.isEncryptionAvailable()) {
        defaults.apiKey = safeStorage.decryptString(Buffer.from(value.encryptedApiKey, 'base64'))
      }
    }
  } catch {
    // A missing or malformed settings file falls back to the visible defaults.
  }

  return defaults
}

function validateEndpoint(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length > 500) {
    throw new Error('API 地址无效。')
  }

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('请输入有效的 API Base URL。')
  }

  const isLoopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())
  if (!['http:', 'https:'].includes(url.protocol) || (url.protocol === 'http:' && !isLoopback)) {
    throw new Error('API 地址必须使用 HTTPS；本机服务可使用 localhost 的 HTTP。')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('API 地址不能包含用户名、密码、查询参数或片段。')
  }

  return url.toString().replace(/\/+$/, '')
}

function validateModel(value: unknown): string {
  if (typeof value !== 'string') throw new Error('请填写转录模型 ID。')
  const model = value.trim()
  if (!/^[A-Za-z0-9._:/-]{1,128}$/.test(model)) throw new Error('转录模型 ID 格式无效。')
  return model
}

async function saveConfig(input: SaveTranscriptionConfigInput): Promise<TranscriptionConfigView> {
  if (!input || typeof input !== 'object') throw new Error('转录配置无效。')
  const apiBaseUrl = validateEndpoint(input.apiBaseUrl)
  const model = validateModel(input.model)
  let encryptedApiKey: string | undefined
  if (!input.clearApiKey) {
    try {
      const previous = JSON.parse(
        await fs.promises.readFile(getConfigPath(), 'utf8'),
      ) as PersistedTranscriptionConfig
      encryptedApiKey = previous.encryptedApiKey
    } catch {
      encryptedApiKey = undefined
    }
  }

  if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
    if (input.apiKey.length > 4096) throw new Error('API Key 长度无效。')
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('系统密钥存储暂不可用，无法安全保存 API Key。')
    }
    encryptedApiKey = safeStorage.encryptString(input.apiKey.trim()).toString('base64')
  }

  const persisted: PersistedTranscriptionConfig = {
    version: 1,
    apiBaseUrl,
    model,
    ...(encryptedApiKey ? { encryptedApiKey } : {}),
  }
  const configPath = getConfigPath()
  await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
  const temporaryPath = `${configPath}.${randomUUID()}.tmp`
  await fs.promises.writeFile(temporaryPath, JSON.stringify(persisted), {
    encoding: 'utf8',
    mode: 0o600,
  })
  await fs.promises.rename(temporaryPath, configPath)

  return { apiBaseUrl, model, hasApiKey: Boolean(encryptedApiKey) }
}

function resolveTranscriptionUrl(baseUrl: string) {
  if (/\/audio\/transcriptions$/i.test(baseUrl)) return baseUrl
  return `${baseUrl}/audio/transcriptions`
}

function toUploadEndpoint(baseUrl: string) {
  const endpoint = resolveTranscriptionUrl(baseUrl)
  const url = new URL(endpoint)
  if (
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase())
  ) {
    throw new Error('转录接口必须使用 HTTPS 或本机 HTTP。')
  }
  return endpoint
}

function validateSelectedMedia(mediaId: unknown): SelectedTranscriptionMedia {
  if (typeof mediaId !== 'string') throw new Error('请先选择音频或视频文件。')
  const media = selectedMedia.get(mediaId)
  if (!media) throw new Error('所选文件已失效，请重新选择。')
  return media
}

async function prepareAudio(media: SelectedTranscriptionMedia) {
  const extension = path.extname(media.path).toLowerCase()
  const isVideo = media.kind === 'video' || VIDEO_EXTENSIONS.has(extension)
  if (!isVideo && SUPPORTED_AUDIO_EXTENSIONS.has(extension) && media.size <= MAX_UPLOAD_BYTES) {
    return { path: media.path, cleanup: false }
  }

  const outputPath = path.join(
    app.getPath('temp'),
    `short-video-factory-transcription-${randomUUID()}.mp3`,
  )
  const result = await executeFFmpeg([
    '-y',
    '-i',
    media.path,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '48k',
    '-f',
    'mp3',
    outputPath,
  ])
  if (result.code !== 0) {
    await fs.promises.unlink(outputPath).catch(() => undefined)
    throw new Error('无法从该媒体文件提取音频，请确认文件可正常播放。')
  }
  return { path: outputPath, cleanup: true }
}

function getAudioFileMetadata(filePath: string) {
  const extension = path.extname(filePath).toLowerCase()
  const mimeType: Record<string, string> = {
    '.flac': 'audio/flac',
    '.m4a': 'audio/mp4',
    '.mp3': 'audio/mpeg',
    '.mpga': 'audio/mpeg',
    '.mpeg': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
  }
  return {
    filename: `audio${extension}`,
    mimeType: mimeType[extension] ?? 'application/octet-stream',
  }
}

function buildMultipartBody(fields: Record<string, string>, fileBytes: Buffer, filePath: string) {
  const boundary = `----short-video-factory-${randomUUID()}`
  const { filename, mimeType } = getAudioFileMetadata(filePath)
  const parts: Buffer[] = []
  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    )
  }
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
  )
  parts.push(fileBytes, Buffer.from(`\r\n--${boundary}--\r\n`))
  return { boundary, body: Buffer.concat(parts) }
}

function parseTranscriptionResponse(value: unknown): TranscriptionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('转录服务返回的数据格式无效。')
  }

  const response = value as Record<string, unknown>
  const segments = Array.isArray(response.segments)
    ? response.segments.flatMap((segment): TranscriptionResult['segments'] => {
        if (!segment || typeof segment !== 'object') return []
        const item = segment as Record<string, unknown>
        if (
          typeof item.start !== 'number' ||
          !Number.isFinite(item.start) ||
          typeof item.end !== 'number' ||
          !Number.isFinite(item.end) ||
          item.end <= item.start ||
          typeof item.text !== 'string' ||
          !item.text.trim()
        )
          return []
        const start = Math.max(0, item.start)
        const end = Math.max(start + 0.001, item.end)
        return [{ start, end, text: item.text.trim() }]
      })
    : []

  if (!segments.length) {
    throw new Error('该模型没有返回字幕时间戳。请使用支持 verbose_json 分段时间戳的模型配置。')
  }

  return {
    text:
      typeof response.text === 'string'
        ? response.text
        : segments.map((segment) => segment.text).join(' '),
    language: typeof response.language === 'string' ? response.language : undefined,
    duration:
      typeof response.duration === 'number' && Number.isFinite(response.duration)
        ? response.duration
        : undefined,
    segments,
  }
}

async function transcribe(input: TranscribeMediaInput): Promise<TranscriptionResult> {
  const media = validateSelectedMedia(input?.mediaId)
  const config = await readConfig()
  if (!config.apiKey) throw new Error('请先保存转录 API Key。')
  const endpoint = toUploadEndpoint(validateEndpoint(config.apiBaseUrl))
  const model = validateModel(config.model)
  const prepared = await prepareAudio(media)

  try {
    const stats = await fs.promises.stat(prepared.path)
    if (stats.size > MAX_UPLOAD_BYTES) {
      throw new Error('音频超过 25 MB。请压缩或裁短后再转录。')
    }
    const bytes = await fs.promises.readFile(prepared.path)
    const fields: Record<string, string> = {
      model,
      response_format: 'verbose_json',
      'timestamp_granularities[]': 'segment',
    }
    const language = typeof input.language === 'string' ? input.language.trim() : ''
    if (language && !/^[A-Za-z-]{2,12}$/.test(language)) {
      throw new Error('语言代码格式无效，请使用 zh、en 等 ISO 语言代码。')
    }
    if (language) fields.language = language
    const { boundary, body } = buildMultipartBody(fields, bytes, prepared.path)
    let response
    try {
      response = await axios.post(endpoint, body, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(body.length),
        },
        timeout: 180_000,
        maxBodyLength: MAX_UPLOAD_BYTES + 1024 * 1024,
        maxContentLength: 5 * 1024 * 1024,
      })
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data
        const providerMessage =
          responseData &&
          typeof responseData === 'object' &&
          typeof responseData.error?.message === 'string'
            ? responseData.error.message
            : error.message
        throw new Error(`转录请求失败：${String(providerMessage).slice(0, 600)}`)
      }
      throw error
    }
    return parseTranscriptionResponse(response.data)
  } finally {
    if (prepared.cleanup) await fs.promises.unlink(prepared.path).catch(() => undefined)
  }
}

export function registerTranscriptionIPC() {
  ipcMain.handle('transcription-get-config', async (event): Promise<TranscriptionConfigView> => {
    assertTrustedAppFrame(event, 'Transcription configuration')
    const { apiBaseUrl, model, hasApiKey } = await readConfig()
    return { apiBaseUrl, model, hasApiKey }
  })

  ipcMain.handle(
    'transcription-save-config',
    async (event, input: SaveTranscriptionConfigInput) => {
      assertTrustedAppFrame(event, 'Transcription configuration')
      return saveConfig(input)
    },
  )

  ipcMain.handle(
    'transcription-select-media',
    async (event): Promise<SelectedTranscriptionMediaView | null> => {
      assertTrustedAppFrame(event, 'Transcription file selection')
      const win = BrowserWindow.fromWebContents(event.sender)
      const result = win
        ? await dialog.showOpenDialog(win, {
            title: '选择待转录的音频或视频',
            properties: ['openFile'],
            filters: [
              {
                name: '音频与视频',
                extensions: [...new Set([...AUDIO_EXTENSIONS, ...VIDEO_EXTENSION_LIST])],
              },
              { name: '所有文件', extensions: ['*'] },
            ],
          })
        : await dialog.showOpenDialog({ properties: ['openFile'] })
      if (result.canceled || !result.filePaths[0]) return null

      const filePath = result.filePaths[0]
      const extension = path.extname(filePath).toLowerCase()
      const kind = VIDEO_EXTENSIONS.has(extension) ? 'video' : 'audio'
      if (kind === 'audio' && !AUDIO_EXTENSIONS.includes(extension.slice(1))) {
        throw new Error('暂不支持此文件格式。')
      }
      const stats = await fs.promises.stat(filePath)
      if (!stats.isFile()) throw new Error('请选择一个媒体文件。')
      const media: SelectedTranscriptionMedia = {
        id: randomUUID(),
        path: filePath,
        name: path.basename(filePath),
        extension,
        size: stats.size,
        kind,
      }
      selectedMedia.clear()
      selectedMedia.set(media.id, media)
      return {
        id: media.id,
        name: media.name,
        extension: media.extension,
        size: media.size,
        kind: media.kind,
        url: pathToFileURL(filePath).toString(),
      }
    },
  )

  ipcMain.handle('transcription-run', async (event, input: TranscribeMediaInput) => {
    assertTrustedAppFrame(event, 'Transcription')
    return transcribe(input)
  })

  ipcMain.handle('transcription-save-srt', async (event, input: SaveSrtInput) => {
    assertTrustedAppFrame(event, 'SRT export')
    if (
      !input ||
      typeof input.srtText !== 'string' ||
      !input.srtText.trim() ||
      input.srtText.length > 5_000_000
    ) {
      throw new Error('字幕内容为空或超过 5 MB。')
    }
    const safeName =
      typeof input.defaultFileName === 'string'
        ? path.basename(input.defaultFileName.replace(/[\\/:*?"<>|]/g, '_'))
        : 'transcript.srt'
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win
      ? await dialog.showSaveDialog(win, {
          title: '导出 SRT 字幕',
          defaultPath: safeName.toLowerCase().endsWith('.srt') ? safeName : `${safeName}.srt`,
          filters: [{ name: 'SubRip 字幕', extensions: ['srt'] }],
        })
      : await dialog.showSaveDialog({ filters: [{ name: 'SubRip 字幕', extensions: ['srt'] }] })
    if (result.canceled || !result.filePath) return null
    const outputPath = result.filePath.toLowerCase().endsWith('.srt')
      ? result.filePath
      : `${result.filePath}.srt`
    await fs.promises.writeFile(outputPath, input.srtText, 'utf8')
    return outputPath
  })
}
