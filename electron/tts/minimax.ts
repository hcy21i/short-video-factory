import axios from 'axios'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import WebSocket, { type RawData } from 'ws'
import type {
  MiniMaxApiRegion,
  MiniMaxTtsApiParams,
  MiniMaxTtsCloneVoiceParams,
  MiniMaxTtsSynthesizeCommonParams,
} from './types'

const MINIMAX_ENDPOINTS: Record<MiniMaxApiRegion, { apiUrl: string; socketUrl: string }> = {
  china: {
    apiUrl: 'https://api.minimaxi.com/v1',
    socketUrl: 'wss://api.minimaxi.com/ws/v1/t2a_v2',
  },
  global: {
    apiUrl: 'https://api.minimax.io/v1',
    socketUrl: 'wss://api.minimax.io/ws/v1/t2a_v2',
  },
}
const MAX_CLONE_SAMPLE_SIZE = 20 * 1024 * 1024
const TTS_MODEL = 'speech-2.8-hd'

function getMiniMaxEndpoints(region: MiniMaxApiRegion) {
  return MINIMAX_ENDPOINTS[region] ?? MINIMAX_ENDPOINTS.china
}

export interface MiniMaxSynthesisResult {
  audio: Buffer
  durationSeconds?: number
}

interface MiniMaxMessage {
  event?: string
  base_resp?: {
    status_code?: number | string
    status_msg?: string
  }
  data?: {
    audio?: string
  }
  extra_info?: {
    audio_length?: number
  }
  is_final?: boolean
}

export async function getMiniMaxSystemVoices(params: MiniMaxTtsApiParams) {
  const normalizedApiKey = params.apiKey.trim()
  if (!normalizedApiKey) throw new Error('Enter a MiniMax API key to load system voices.')

  const { apiUrl } = getMiniMaxEndpoints(params.apiRegion)
  const response = await axios.post(
    apiUrl + '/get_voice',
    { voice_type: 'system' },
    {
      headers: {
        Authorization: 'Bearer ' + normalizedApiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    },
  )
  assertApiSuccess(response.data, 'system voice list')

  const systemVoices = response.data?.system_voice
  if (!Array.isArray(systemVoices)) {
    throw new Error('MiniMax did not return a system voice list.')
  }

  return systemVoices
    .filter((voice: any) => typeof voice?.voice_id === 'string' && voice.voice_id.trim())
    .map((voice: any) => ({
      voiceId: voice.voice_id.trim(),
      voiceName:
        typeof voice.voice_name === 'string' && voice.voice_name.trim()
          ? voice.voice_name.trim()
          : voice.voice_id.trim(),
      description: Array.isArray(voice.description)
        ? voice.description.filter((item: unknown) => typeof item === 'string').join(' ')
        : '',
    }))
}

function abortError() {
  const error = new Error('MiniMax TTS synthesis cancelled')
  error.name = 'AbortError'
  return error
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError()
}

function assertApiSuccess(data: any, operation: string) {
  const code = data?.base_resp?.status_code
  if (code !== undefined && String(code) !== '0') {
    throw new Error(
      'MiniMax ' +
        operation +
        ' failed (' +
        String(code) +
        '): ' +
        String(data?.base_resp?.status_msg || 'Unknown API error'),
    )
  }
  if (data?.error?.message) {
    throw new Error('MiniMax ' + operation + ' failed: ' + String(data.error.message))
  }
}

function getAudioMimeType(extension: string) {
  if (extension === '.mp3') return 'audio/mpeg'
  if (extension === '.m4a') return 'audio/mp4'
  return 'audio/wav'
}

async function uploadCloneSample(
  apiKey: string,
  samplePath: string,
  apiRegion: MiniMaxApiRegion,
) {
  const extension = path.extname(samplePath).toLowerCase()
  if (!['.mp3', '.m4a', '.wav'].includes(extension)) {
    throw new Error('MiniMax voice cloning accepts MP3, M4A, or WAV audio.')
  }

  const stats = await fs.promises.stat(samplePath)
  if (!stats.isFile()) throw new Error('The selected voice sample is not a file.')
  if (stats.size > MAX_CLONE_SAMPLE_SIZE) {
    throw new Error('The voice sample must be 20 MB or smaller.')
  }

  const metadata = await parseFile(samplePath)
  const duration = metadata.format.duration
  if (duration === undefined || !Number.isFinite(duration) || duration < 10 || duration > 300) {
    throw new Error('The voice sample must be between 10 seconds and 5 minutes long.')
  }

  const sample = await fs.promises.readFile(samplePath)
  const boundary = '----ShortVideoFactory' + randomUUID().replace(/-/g, '')
  const filename = path
    .basename(samplePath)
    .replace(/["\r\n]/g, '_')
  const body = Buffer.concat([
    Buffer.from(
      '--' +
        boundary +
        '\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvoice_clone\r\n',
    ),
    Buffer.from(
      '--' +
        boundary +
        '\r\nContent-Disposition: form-data; name="file"; filename="' +
        filename +
        '"\r\nContent-Type: ' +
        getAudioMimeType(extension) +
        '\r\n\r\n',
    ),
    sample,
    Buffer.from('\r\n--' + boundary + '--\r\n'),
  ])

  const { apiUrl } = getMiniMaxEndpoints(apiRegion)
  const response = await axios.post(apiUrl + '/files/upload', body, {
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'multipart/form-data; boundary=' + boundary,
      'Content-Length': body.length,
    },
    maxBodyLength: MAX_CLONE_SAMPLE_SIZE + 1024,
    timeout: 120_000,
  })
  assertApiSuccess(response.data, 'voice sample upload')
  const fileId = response.data?.file?.file_id
  if (typeof fileId !== 'string' || !fileId) {
    throw new Error('MiniMax did not return an uploaded file ID.')
  }
  return fileId
}

export async function cloneMiniMaxVoice(
  params: MiniMaxTtsCloneVoiceParams & { samplePath: string },
): Promise<{ voiceId: string }> {
  const apiKey = params.apiKey.trim()
  if (!apiKey) throw new Error('Enter a MiniMax API key before cloning a voice.')
  const previewText = params.previewText.trim()
  if (!previewText) throw new Error('The voice preview text cannot be empty.')

  const fileId = await uploadCloneSample(apiKey, params.samplePath, params.apiRegion)
  const voiceId = 'svf_' + randomUUID().replace(/-/g, '')
  const { apiUrl } = getMiniMaxEndpoints(params.apiRegion)
  const response = await axios.post(
    apiUrl + '/voice_clone',
    {
      file_id: fileId,
      voice_id: voiceId,
      text: previewText,
      model: TTS_MODEL,
    },
    {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 120_000,
    },
  )
  assertApiSuccess(response.data, 'voice clone')
  return { voiceId }
}

class MiniMaxMessageQueue {
  private readonly messages: MiniMaxMessage[] = []
  private readonly waiters: Array<{
    resolve: (message: MiniMaxMessage) => void
    reject: (error: Error) => void
    signal?: AbortSignal
    onAbort?: () => void
    timer: ReturnType<typeof setTimeout>
  }> = []
  private failure: Error | undefined

  private readonly onMessage = (data: RawData) => {
    try {
      const raw = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : data instanceof ArrayBuffer
          ? Buffer.from(data).toString('utf8')
          : Buffer.concat(data).toString('utf8')
      const message = JSON.parse(raw) as MiniMaxMessage
      const waiter = this.waiters.shift()
      if (waiter) {
        clearTimeout(waiter.timer)
        waiter.signal?.removeEventListener('abort', waiter.onAbort!)
        waiter.resolve(message)
      } else {
        this.messages.push(message)
      }
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private readonly onError = (error: Error) => this.fail(error)
  private readonly onClose = () => this.fail(new Error('MiniMax closed the TTS connection.'))

  constructor(private readonly socket: WebSocket) {
    socket.on('message', this.onMessage)
    socket.on('error', this.onError)
    socket.on('close', this.onClose)
  }

  next(signal?: AbortSignal, timeoutMs = 120_000): Promise<MiniMaxMessage> {
    throwIfAborted(signal)
    if (this.failure) return Promise.reject(this.failure)
    const message = this.messages.shift()
    if (message) return Promise.resolve(message)

    return new Promise((resolve, reject) => {
      const waiter: (typeof this.waiters)[number] = {
        resolve,
        reject,
        signal,
        timer: setTimeout(() => {
          this.removeWaiter(waiter)
          reject(new Error('MiniMax TTS response timed out.'))
        }, timeoutMs),
      }
      waiter.onAbort = () => {
        this.removeWaiter(waiter)
        this.socket.terminate()
        reject(abortError())
      }
      signal?.addEventListener('abort', waiter.onAbort, { once: true })
      this.waiters.push(waiter)
    })
  }

  dispose() {
    this.socket.off('message', this.onMessage)
    this.socket.off('error', this.onError)
    this.socket.off('close', this.onClose)
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer)
      waiter.signal?.removeEventListener('abort', waiter.onAbort!)
      waiter.reject(new Error('MiniMax TTS connection ended.'))
    }
  }

  private fail(error: Error) {
    if (this.failure) return
    this.failure = error
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer)
      waiter.signal?.removeEventListener('abort', waiter.onAbort!)
      waiter.reject(error)
    }
  }

  private removeWaiter(waiter: (typeof this.waiters)[number]) {
    const index = this.waiters.indexOf(waiter)
    if (index >= 0) this.waiters.splice(index, 1)
    clearTimeout(waiter.timer)
    waiter.signal?.removeEventListener('abort', waiter.onAbort!)
  }
}

function waitForOpen(socket: WebSocket, signal?: AbortSignal) {
  throwIfAborted(signal)
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve()
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      socket.off('open', onOpen)
      socket.off('error', onError)
      socket.off('close', onClose)
      signal?.removeEventListener('abort', onAbort)
    }
    const onOpen = () => {
      cleanup()
      resolve()
    }
    const onError = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onClose = () => {
      cleanup()
      reject(new Error('MiniMax closed the TTS connection before it opened.'))
    }
    const onAbort = () => {
      cleanup()
      socket.terminate()
      reject(abortError())
    }
    socket.once('open', onOpen)
    socket.once('error', onError)
    socket.once('close', onClose)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function sendMessage(socket: WebSocket, message: Record<string, unknown>) {
  return new Promise<void>((resolve, reject) => {
    socket.send(JSON.stringify(message), (error) => (error ? reject(error) : resolve()))
  })
}

async function waitForEvent(
  queue: MiniMaxMessageQueue,
  event: string,
  signal?: AbortSignal,
  timeoutMs = 120_000,
): Promise<MiniMaxMessage> {
  while (true) {
    const message = await queue.next(signal, timeoutMs)
    assertApiSuccess(message, event)
    if (message.event === 'task_failed') {
      throw new Error('MiniMax TTS failed: ' + String(message.base_resp?.status_msg || 'Unknown API error'))
    }
    if (message.event === event) return message
  }
}

function splitText(text: string, maxLength = 10_000) {
  const characters = Array.from(text)
  const chunks: string[] = []
  while (characters.length > maxLength) {
    let splitAt = maxLength
    for (let index = maxLength - 1; index >= Math.floor(maxLength * 0.6); index -= 1) {
      if (/[。！？!?；;\n]/u.test(characters[index])) {
        splitAt = index + 1
        break
      }
    }
    chunks.push(characters.splice(0, splitAt).join(''))
  }
  if (characters.length) chunks.push(characters.join(''))
  return chunks
}

export async function synthesizeMiniMax(
  params: MiniMaxTtsSynthesizeCommonParams & { abortSignal?: AbortSignal },
): Promise<MiniMaxSynthesisResult> {
  const apiKey = params.apiKey.trim()
  const text = params.text.trim()
  const voiceId = params.voiceId.trim()
  if (!apiKey) throw new Error('Enter a MiniMax API key before synthesizing speech.')
  if (!voiceId) throw new Error('Select a MiniMax voice before synthesizing speech.')
  if (!text) throw new Error('The text to synthesize cannot be empty.')
  throwIfAborted(params.abortSignal)

  const { socketUrl } = getMiniMaxEndpoints(params.apiRegion)
  const socket = new WebSocket(socketUrl, {
    headers: { Authorization: 'Bearer ' + apiKey },
    handshakeTimeout: 30_000,
  })
  const queue = new MiniMaxMessageQueue(socket)
  const audioChunks: Buffer[] = []
  let durationMs = 0

  try {
    await waitForOpen(socket, params.abortSignal)
    const connected = await queue.next(params.abortSignal)
    assertApiSuccess(connected, 'TTS connection')
    if (connected.event !== 'connected_success') {
      throw new Error('MiniMax did not confirm the TTS connection.')
    }

    await sendMessage(socket, {
      event: 'task_start',
      model: TTS_MODEL,
      voice_setting: {
        voice_id: voiceId,
        speed: params.speed,
        vol: 1,
        pitch: 0,
      },
      audio_setting: {
        sample_rate: 32_000,
        bitrate: 128_000,
        format: 'mp3',
        channel: 1,
      },
    })
    await waitForEvent(queue, 'task_started', params.abortSignal)

    for (const textChunk of splitText(text)) {
      throwIfAborted(params.abortSignal)
      await sendMessage(socket, { event: 'task_continue', text: textChunk })
      while (true) {
        const message = await queue.next(params.abortSignal)
        assertApiSuccess(message, 'TTS synthesis')
        if (message.event === 'task_failed') {
          throw new Error(
            'MiniMax TTS failed: ' +
              String(message.base_resp?.status_msg || 'Unknown API error'),
          )
        }
        const audioHex = message.data?.audio
        if (audioHex) {
          const audio = Buffer.from(audioHex, 'hex')
          if (audio.length) audioChunks.push(audio)
        }
        if (message.is_final) {
          const audioLength = Number(message.extra_info?.audio_length)
          if (Number.isFinite(audioLength) && audioLength > 0) durationMs += audioLength
          break
        }
      }
    }

    throwIfAborted(params.abortSignal)
    await sendMessage(socket, { event: 'task_finish' })
    try {
      await waitForEvent(queue, 'task_finished', params.abortSignal, 10_000)
    } catch (error) {
      if (params.abortSignal?.aborted || (error as { name?: string })?.name === 'AbortError') {
        throw abortError()
      }
      // Audio and final task responses are already complete; some service routes close after
      // the last audio response without delivering a separate task_finished event.
    }

    const audio = Buffer.concat(audioChunks)
    if (!audio.length) throw new Error('MiniMax returned no audio data.')
    return {
      audio,
      durationSeconds: durationMs > 0 ? durationMs / 1000 : undefined,
    }
  } finally {
    queue.dispose()
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close()
    }
  }
}
