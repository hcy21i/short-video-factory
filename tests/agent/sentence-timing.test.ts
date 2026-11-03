import { describe, expect, it } from 'vitest'
import { alignSentenceTimings, estimateSentenceTimings } from '../../src/lib/agent/sentence-timing'

const word = (text: string, startMs: number, durationMs: number) => ({
  Offset: startMs * 10000,
  Duration: durationMs * 10000,
  text: { Text: text },
})

describe('sentence timing', () => {
  it('uses actual word boundaries when text matches exactly', () => {
    expect(
      alignSentenceTimings('你好！再见。', [word('你好', 100, 400), word('再见', 600, 500)]),
    ).toEqual([
      {
        text: '你好！',
        startMs: 100,
        endMs: 500,
        source: 'edge-word-boundary',
        approximate: false,
      },
      {
        text: '再见。',
        startMs: 600,
        endMs: 1100,
        source: 'edge-word-boundary',
        approximate: false,
      },
    ])
  })
  it('does not claim exact alignment when words are missing or cross sentence boundaries', () => {
    expect(alignSentenceTimings('你好！再见。', [word('你好', 0, 400)])).toEqual([])
    expect(alignSentenceTimings('你好！再见。', [word('你好再见', 0, 800)])).toEqual([])
  })
  it('labels duration-based timing as approximate', () => {
    expect(estimateSentenceTimings('你好！再见。', 4)).toEqual([
      { text: '你好！', startMs: 0, endMs: 2000, source: 'duration-estimate', approximate: true },
      {
        text: '再见。',
        startMs: 2000,
        endMs: 4000,
        source: 'duration-estimate',
        approximate: true,
      },
    ])
  })
})
