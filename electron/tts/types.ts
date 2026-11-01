import { SynthesisOptions } from '../lib/edge-tts'

export interface EdgeTtsSynthesizeCommonParams {
  text: string
  voice: string
  options: SynthesisOptions
}

export interface EdgeTtsSynthesizeToFileParams extends EdgeTtsSynthesizeCommonParams {
  withCaption?: boolean
  outputPath?: string
  /** Request identifier used to route renderer cancellation to the active synthesis. */
  requestId?: string
}

export interface EdgeTtsSynthesizeToFileResult {
  /**
   * 合成后的音频时长，单位秒
   */
  duration: number | undefined
  srtText?: string
}

export type MiniMaxApiRegion = 'china' | 'global'

export interface MiniMaxTtsApiParams {
  apiKey: string
  apiRegion: MiniMaxApiRegion
}

export interface MiniMaxTtsSynthesizeCommonParams {
  apiKey: string
  apiRegion: MiniMaxApiRegion
  text: string
  voiceId: string
  /** MiniMax speed multiplier; 1 is normal speed. */
  speed: number
}

export interface MiniMaxTtsSynthesizeToFileParams extends MiniMaxTtsSynthesizeCommonParams {
  withCaption?: boolean
  outputPath?: string
  /** Request identifier used to route renderer cancellation to the active synthesis. */
  requestId?: string
}

export interface MiniMaxTtsSynthesizeToFileResult {
  duration: number | undefined
  srtText?: string
}

export interface MiniMaxTtsCloneVoiceParams {
  apiKey: string
  apiRegion: MiniMaxApiRegion
  previewText: string
}

export interface MiniMaxTtsCloneVoiceResult {
  voiceId: string
  voiceName: string
}

export interface MiniMaxTtsSystemVoice {
  voiceId: string
  voiceName: string
  description: string
}
