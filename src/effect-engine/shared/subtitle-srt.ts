import type { SubtitleCue } from './types'

function parseTimeToMs(timeText: string): number {
  const trimmed = timeText.trim()
  const match = trimmed.match(/^(\d{2}):(\d{2}):(\d{2})[,.](\d{3})$/)
  if (!match) {
    return 0
  }

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  const seconds = Number.parseInt(match[3], 10)
  const ms = Number.parseInt(match[4], 10)

  if ([hours, minutes, seconds, ms].some((value) => Number.isNaN(value))) {
    return 0
  }

  return Math.max(0, hours * 3600000 + minutes * 60000 + seconds * 1000 + ms)
}

// TTS 生成的 SRT 在句子之间有几百毫秒的静音间隙，直接按原始时间轴渲染会让字幕
// 在换行时“闪一下消失”，观感上像抽帧。这里把上一条字幕延长到下一个起点之前。
const CUE_GAP_MS = 40

function fillCueGaps(cues: SubtitleCue[]): SubtitleCue[] {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs)

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    const targetEnd = next.startMs - CUE_GAP_MS
    if (targetEnd <= current.endMs) {
      continue
    }
    current.endMs = Math.min(targetEnd, next.startMs - 1)
  }

  return sorted
}

export function parseSrtToCues(srtText: string): SubtitleCue[] {
  // SRT 是字幕链路的标准中间格式：不绑定 TTS，可复用到 ASR / 歌词 / 外部字幕导入。
  const blocks = srtText
    .replace(/\r/g, '')
    .split(/\n\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)

  const cues: SubtitleCue[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim())
    if (lines.length < 2) {
      continue
    }

    const timingLineIndex = lines[0].includes('-->') ? 0 : 1
    const timingLine = lines[timingLineIndex]
    const [startText, endText] = timingLine.split('-->').map((item) => item.trim())
    if (!startText || !endText) {
      continue
    }

    const startMs = parseTimeToMs(startText)
    const endMs = Math.max(startMs + 1, parseTimeToMs(endText))
    const text = lines
      .slice(timingLineIndex + 1)
      .join('\n')
      .trim()

    if (!text) {
      continue
    }

    cues.push({
      id: `cue-${cues.length + 1}`,
      text,
      startMs,
      endMs,
    })
  }

  return fillCueGaps(cues)
}
