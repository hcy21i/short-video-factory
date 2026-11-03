import { splitScriptSentences } from './script-sentences'

export interface TimedSentence {
  text: string
  startMs: number
  endMs: number
  source: 'edge-word-boundary' | 'duration-estimate'
  approximate: boolean
}

type Boundary = { Offset: number; Duration: number; text: { Text: string } }
const normalize = (text: string) =>
  text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')

/** 只有逐字完全对齐时才采用词边界；不完整或不一致时返回空数组。 */
export function alignSentenceTimings(text: string, words: readonly Boundary[]): TimedSentence[] {
  const sentences = splitScriptSentences(text)
  const normalized = sentences.map(normalize)
  if (!sentences.length || normalized.some((value) => !value)) return []
  const chunks = words.map((word) => normalize(word.text?.Text ?? ''))
  if (chunks.join('') !== normalized.join('')) return []
  let sentenceIndex = 0
  let consumed = 0
  let startMs: number | undefined
  const result: TimedSentence[] = []
  for (let i = 0; i < words.length; i++) {
    if (!chunks[i]) continue
    const word = words[i]
    if (
      !Number.isFinite(word.Offset) ||
      !Number.isFinite(word.Duration) ||
      word.Offset < 0 ||
      word.Duration <= 0
    )
      return []
    if (startMs === undefined) startMs = word.Offset / 10000
    consumed += chunks[i].length
    if (consumed > normalized[sentenceIndex].length) return []
    if (consumed === normalized[sentenceIndex].length) {
      const endMs = (word.Offset + word.Duration) / 10000
      if (endMs <= startMs || (result.length && startMs < result[result.length - 1].endMs))
        return []
      result.push({
        text: sentences[sentenceIndex],
        startMs,
        endMs,
        source: 'edge-word-boundary',
        approximate: false,
      })
      sentenceIndex++
      consumed = 0
      startMs = undefined
    }
  }
  return sentenceIndex === sentences.length ? result : []
}

/** 无实际词边界时按文字长度估算，明确标记为估算值。 */
export function estimateSentenceTimings(text: string, durationSeconds: number): TimedSentence[] {
  const sentences = splitScriptSentences(text)
  const weights = sentences.map((sentence) => Array.from(normalize(sentence)).length)
  const total = weights.reduce((a, b) => a + b, 0)
  if (!total || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return []
  let consumed = 0
  return sentences.map((sentence, index) => {
    const startMs = (durationSeconds * 1000 * consumed) / total
    consumed += weights[index]
    return {
      text: sentence,
      startMs,
      endMs: (durationSeconds * 1000 * consumed) / total,
      source: 'duration-estimate',
      approximate: true,
    }
  })
}
