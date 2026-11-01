import fs from 'node:fs'
import path from 'node:path'
import { EdgeTTS, hasMp3FrameHeader } from '../lib/edge-tts'
import { parseBuffer } from 'music-metadata'
import {
  EdgeTtsSynthesizeCommonParams,
  EdgeTtsSynthesizeToFileParams,
  EdgeTtsSynthesizeToFileResult,
} from './types'
import { getAppTempPath } from '../lib/tools'
import { app } from 'electron'
import {
  cloneMiniMaxVoice,
  getMiniMaxSystemVoices,
  synthesizeMiniMax,
} from './minimax'
import type {
  MiniMaxTtsCloneVoiceParams,
  MiniMaxTtsCloneVoiceResult,
  MiniMaxTtsApiParams,
  MiniMaxTtsSynthesizeCommonParams,
  MiniMaxTtsSynthesizeToFileParams,
  MiniMaxTtsSynthesizeToFileResult,
  MiniMaxTtsSystemVoice,
} from './types'

const edgeTts = new EdgeTTS()
const setupTime = new Date().getTime()
const EDGE_TTS_CBR_BITS_PER_SECOND = 48_000

const createAbortError = () => {
  const error = new Error('TTS synthesis cancelled')
  error.name = 'AbortError'
  return error
}

function getCbrDuration(buffer: Buffer): number | undefined {
  if (buffer.length === 0 || !hasMp3FrameHeader(buffer)) return undefined

  const duration = (buffer.length * 8) / EDGE_TTS_CBR_BITS_PER_SECOND
  return Number.isFinite(duration) && duration > 0 ? duration : undefined
}

export function getTempTtsVoiceFilePath() {
  return path.join(getAppTempPath(), `temp-tts-voice-${setupTime}.mp3`).replace(/\\/g, '/')
}

export function clearCurrentTtsFiles() {
  const voicePath = getTempTtsVoiceFilePath()
  if (fs.existsSync(voicePath)) {
    fs.unlinkSync(voicePath)
  }
  const srtPath = path.join(path.dirname(voicePath), path.basename(voicePath, '.mp3') + '.srt')
  if (fs.existsSync(srtPath)) {
    fs.unlinkSync(srtPath)
  }
}

app.on('before-quit', () => {
  clearCurrentTtsFiles()
})

export function edgeTtsGetVoiceList() {
  return edgeTts.getVoices()
}

export async function edgeTtsSynthesizeToBase64(params: EdgeTtsSynthesizeCommonParams) {
  const { text, voice, options } = params
  const result = await edgeTts.synthesize(text, voice, options)
  return result.toBase64()
}

export async function edgeTtsSynthesizeToFile(
  params: EdgeTtsSynthesizeToFileParams & { abortSignal?: AbortSignal },
): Promise<EdgeTtsSynthesizeToFileResult> {
  const { text, voice, options, withCaption } = params
  if (params.abortSignal?.aborted) throw createAbortError()

  const result = await edgeTts.synthesize(text, voice, options, params.abortSignal)
  if (params.abortSignal?.aborted) throw createAbortError()
  const audioBuffer = result.getBuffer()

  if (audioBuffer.length === 0) {
    throw new Error(`EdgeTTS 未收到 audio 数据：voice=${voice}, textLength=${text.length}`)
  }
  if (!hasMp3FrameHeader(audioBuffer)) {
    throw new Error(
      `EdgeTTS 收到 audio 但 Buffer 不包含有效 MP3 帧：voice=${voice}, textLength=${text.length}, audioBytes=${audioBuffer.length}`,
    )
  }

  // EdgeTTS 固定返回 48 kbps CBR MP3; metadata parser failures should not discard valid audio.
  let duration = 0
  let metadataError: string | undefined
  try {
    const metadata = await parseBuffer(audioBuffer, { mimeType: 'audio/mpeg' })
    duration = metadata.format?.duration ?? 0
  } catch (error) {
    metadataError = error instanceof Error ? error.message : String(error)
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    const fallbackDuration = getCbrDuration(audioBuffer)
    if (fallbackDuration) {
      duration = fallbackDuration
      console.warn('[EdgeTTS] duration-cbr-fallback-used', {
        voice,
        textLength: text.length,
        audioBytes: audioBuffer.length,
        duration,
        metadataError: metadataError ?? 'metadata duration was non-positive',
      })
    } else {
      throw new Error(
        `EdgeTTS MP3 元数据解析失败且 CBR fallback 失败：voice=${voice}, textLength=${text.length}, audioBytes=${audioBuffer.length}, metadataError=${metadataError ?? 'metadata duration was non-positive'}`,
      )
    }
  }

  if (params.abortSignal?.aborted) throw createAbortError()

  const outputPath = params.outputPath ?? getTempTtsVoiceFilePath()
  const outputAudioPath = outputPath.endsWith('.mp3') ? outputPath : `${outputPath}.mp3`
  const srtPath = path.join(path.dirname(outputPath), path.basename(outputPath, '.mp3') + '.srt')
  for (const previousOutputPath of [outputAudioPath, srtPath]) {
    if (fs.existsSync(previousOutputPath)) fs.unlinkSync(previousOutputPath)
  }
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  }

  try {
    await result.toFile(outputPath)
    if (params.abortSignal?.aborted) throw createAbortError()

    const srtText = withCaption ? result.getCaptionSrtString() : undefined
    if (srtText) {
      fs.writeFileSync(srtPath, srtText)
    }

    return {
      duration,
      srtText,
    }
  } catch (error) {
    for (const partialOutputPath of [outputAudioPath, srtPath]) {
      try {
        if (fs.existsSync(partialOutputPath)) fs.unlinkSync(partialOutputPath)
      } catch (cleanupError) {
        console.warn('清理语音合成部分输出失败:', partialOutputPath, cleanupError)
      }
    }
    throw error
  }
}

export async function miniMaxTtsCloneVoice(
  params: MiniMaxTtsCloneVoiceParams & { samplePath: string },
): Promise<MiniMaxTtsCloneVoiceResult> {
  const { voiceId } = await cloneMiniMaxVoice(params)
  return {
    voiceId,
    voiceName: path.parse(params.samplePath).name,
  }
}

export async function miniMaxTtsGetSystemVoices(
  params: MiniMaxTtsApiParams,
): Promise<MiniMaxTtsSystemVoice[]> {
  return getMiniMaxSystemVoices(params)
}

export async function miniMaxTtsSynthesizeToBase64(params: MiniMaxTtsSynthesizeCommonParams) {
  const result = await synthesizeMiniMax(params)
  return result.audio.toString('base64')
}

function formatSrtTime(milliseconds: number) {
  const ms = Math.max(0, Math.floor(milliseconds))
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  const remainder = ms % 1000
  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    String(seconds).padStart(2, '0') +
    ',' +
    String(remainder).padStart(3, '0')
  )
}

function makeApproximateCaptionSrt(text: string, durationSeconds: number) {
  const normalized = text.replace(/\s+/gu, ' ').trim()
  if (!normalized || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return undefined

  const sentences = normalized
    .split(/(?<=[。！？!?；;.\n])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
  const cues: string[] = []
  for (const sentence of sentences) {
    const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
      sentence,
    )
    const maxLength = hasCjk ? 18 : 42
    const characters = Array.from(sentence)
    while (characters.length > maxLength) {
      let splitAt = maxLength
      for (let index = maxLength - 1; index >= Math.floor(maxLength * 0.55); index -= 1) {
        if (/\s|[，,。！？!?；;：:]/u.test(characters[index])) {
          splitAt = index + 1
          break
        }
      }
      cues.push(characters.splice(0, splitAt).join('').trim())
    }
    const last = characters.join('').trim()
    if (last) cues.push(last)
  }

  const totalWeight = cues.reduce((sum, cue) => sum + Array.from(cue).length, 0)
  if (!totalWeight) return undefined

  const totalMs = Math.max(1, Math.floor(durationSeconds * 1000))
  let consumedWeight = 0
  return cues
    .map((cue, index) => {
      const cueWeight = Array.from(cue).length
      const start = Math.floor((totalMs * consumedWeight) / totalWeight)
      consumedWeight += cueWeight
      const end = Math.max(start + 1, Math.floor((totalMs * consumedWeight) / totalWeight))
      return [
        String(index + 1),
        formatSrtTime(start) + ' --> ' + formatSrtTime(end),
        cue,
      ].join('\n')
    })
    .join('\n\n')
}

export async function miniMaxTtsSynthesizeToFile(
  params: MiniMaxTtsSynthesizeToFileParams & { abortSignal?: AbortSignal },
): Promise<MiniMaxTtsSynthesizeToFileResult> {
  if (params.abortSignal?.aborted) throw createAbortError()
  const result = await synthesizeMiniMax(params)
  if (params.abortSignal?.aborted) throw createAbortError()

  let duration = result.durationSeconds ?? 0
  if (!Number.isFinite(duration) || duration <= 0) {
    try {
      const metadata = await parseBuffer(result.audio, { mimeType: 'audio/mpeg' })
      duration = metadata.format?.duration ?? 0
    } catch {
      duration = 0
    }
  }
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('MiniMax MP3 duration could not be determined.')
  }

  const outputPath = params.outputPath ?? getTempTtsVoiceFilePath()
  const outputAudioPath = outputPath.endsWith('.mp3') ? outputPath : outputPath + '.mp3'
  const srtPath = path.join(path.dirname(outputPath), path.basename(outputPath, '.mp3') + '.srt')
  for (const previousOutputPath of [outputAudioPath, srtPath]) {
    if (fs.existsSync(previousOutputPath)) fs.unlinkSync(previousOutputPath)
  }
  if (!fs.existsSync(path.dirname(outputPath))) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  }

  try {
    fs.writeFileSync(outputAudioPath, result.audio)
    if (params.abortSignal?.aborted) throw createAbortError()

    const srtText = params.withCaption
      ? makeApproximateCaptionSrt(params.text, duration)
      : undefined
    if (srtText) fs.writeFileSync(srtPath, srtText)

    return { duration, srtText }
  } catch (error) {
    for (const partialOutputPath of [outputAudioPath, srtPath]) {
      try {
        if (fs.existsSync(partialOutputPath)) fs.unlinkSync(partialOutputPath)
      } catch (cleanupError) {
        console.warn('清理 MiniMax 语音合成部分输出失败:', partialOutputPath, cleanupError)
      }
    }
    throw error
  }
}
