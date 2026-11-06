export interface TranscriptionConfigView {
  apiBaseUrl: string
  model: string
  hasApiKey: boolean
}

export interface SaveTranscriptionConfigInput {
  apiBaseUrl: string
  model: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface SelectedTranscriptionMedia {
  id: string
  path: string
  name: string
  extension: string
  size: number
  kind: 'audio' | 'video'
}

export type SelectedTranscriptionMediaView = Omit<SelectedTranscriptionMedia, 'path'> & {
  url: string
}

export interface TranscribeMediaInput {
  mediaId: string
  language?: string
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  text: string
  language?: string
  duration?: number
  segments: TranscriptionSegment[]
}

export interface SaveSrtInput {
  srtText: string
  defaultFileName: string
}
