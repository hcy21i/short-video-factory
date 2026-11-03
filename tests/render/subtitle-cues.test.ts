import { describe, expect, it } from 'vitest'
import { parseSrtToCues } from '../../src/effect-engine/shared/subtitle-srt'

function srt(...blocks: string[]) {
  return blocks.join('\n\n')
}

describe('parseSrtToCues', () => {
  it('解析时间轴与文本', () => {
    const cues = parseSrtToCues(
      srt(
        '1\n00:00:00,000 --> 00:00:01,500\n第一句',
        '2\n00:00:01,500 --> 00:00:03,000\n第二句',
      ),
    )

    expect(cues).toHaveLength(2)
    expect(cues[0]).toMatchObject({ text: '第一句', startMs: 0, endMs: 1500 })
    expect(cues[1]).toMatchObject({ text: '第二句', startMs: 1500, endMs: 3000 })
  })

  it('把句间空隙补到下一条字幕起点前 40ms，避免字幕闪断', () => {
    const cues = parseSrtToCues(
      srt(
        '1\n00:00:00,000 --> 00:00:01,000\n甲',
        '2\n00:00:02,000 --> 00:00:03,000\n乙',
        '3\n00:00:05,000 --> 00:00:06,000\n丙',
      ),
    )

    expect(cues[0].endMs).toBe(1960)
    expect(cues[1].endMs).toBe(4960)
    expect(cues[2].endMs).toBe(6000)
  })

  it('已经首尾相接的字幕不会被改动', () => {
    const cues = parseSrtToCues(
      srt(
        '1\n00:00:00,000 --> 00:00:02,000\n甲',
        '2\n00:00:02,000 --> 00:00:04,000\n乙',
      ),
    )

    expect(cues[0].endMs).toBe(2000)
  })

  it('乱序的 SRT 会被按开始时间排序', () => {
    const cues = parseSrtToCues(
      srt(
        '1\n00:00:03,000 --> 00:00:04,000\n后',
        '2\n00:00:00,000 --> 00:00:01,000\n先',
      ),
    )

    expect(cues.map((cue) => cue.text)).toEqual(['先', '后'])
  })

  it('忽略缺少文本的块', () => {
    const cues = parseSrtToCues(
      srt('1\n00:00:00,000 --> 00:00:01,000', '2\n00:00:01,000 --> 00:00:02,000\n有字'),
    )

    expect(cues).toHaveLength(1)
    expect(cues[0].text).toBe('有字')
  })
})