import { describe, expect, it } from 'vitest'
import {
  buildAllowedSpans,
  normalizeUnusableRanges,
  pickSegmentFromSpans,
  resizeRangeEdge,
  shiftRange,
  subtractUsedSpans,
} from '@/lib/agent/shot-ranges'

describe('subtractUsedSpans', () => {
  it('excludes previously used portions while preserving the unused intervals', () => {
    expect(
      subtractUsedSpans(
        [{ startSeconds: 0, endSeconds: 20 }],
        [
          { startSeconds: 3, endSeconds: 7 },
          { startSeconds: 10, endSeconds: 15 },
        ],
      ),
    ).toEqual([
      { startSeconds: 0, endSeconds: 3 },
      { startSeconds: 7, endSeconds: 10 },
      { startSeconds: 15, endSeconds: 20 },
    ])
  })
})

describe('normalizeUnusableRanges', () => {
  it('裁剪到素材时长内并按开始时间排序', () => {
    const ranges = normalizeUnusableRanges(
      [
        { startSeconds: 8, endSeconds: 20 },
        { startSeconds: -3, endSeconds: 2 },
      ],
      10,
    )
    expect(ranges).toEqual([
      { startSeconds: 0, endSeconds: 2 },
      { startSeconds: 8, endSeconds: 10 },
    ])
  })

  it('合并重叠与相邻区间，丢掉空区间', () => {
    const ranges = normalizeUnusableRanges(
      [
        { startSeconds: 1, endSeconds: 3 },
        { startSeconds: 2.5, endSeconds: 5 },
        { startSeconds: 6, endSeconds: 6 },
      ],
      10,
    )
    expect(ranges).toEqual([{ startSeconds: 1, endSeconds: 5 }])
  })

  it('时长非法时返回空数组', () => {
    expect(normalizeUnusableRanges([{ startSeconds: 1, endSeconds: 2 }], 0)).toEqual([])
  })
})

describe('buildAllowedSpans', () => {
  it('没有废镜头时整条素材都可用', () => {
    expect(buildAllowedSpans(30, [])).toEqual([{ startSeconds: 0, endSeconds: 30 }])
  })

  it('中间一段被剔除后切成两段，并各自外扩 0.25 秒余量', () => {
    const spans = buildAllowedSpans(10, [{ startSeconds: 4, endSeconds: 6 }])
    expect(spans).toHaveLength(2)
    expect(spans[0]).toEqual({ startSeconds: 0, endSeconds: 3.75 })
    expect(spans[1]).toEqual({ startSeconds: 6.25, endSeconds: 10 })
  })

  it('开头被剔除时只剩后半段', () => {
    const spans = buildAllowedSpans(10, [{ startSeconds: 0, endSeconds: 3 }])
    expect(spans).toEqual([{ startSeconds: 3.25, endSeconds: 10 }])
  })

  it('全片被剔除时没有可用区间', () => {
    expect(buildAllowedSpans(5, [{ startSeconds: 0, endSeconds: 5 }])).toEqual([])
  })

  it('短于最小可用时长的空档被舍弃', () => {
    const spans = buildAllowedSpans(10, [
      { startSeconds: 0, endSeconds: 4.8 },
      { startSeconds: 5.2, endSeconds: 10 },
    ])
    expect(spans).toEqual([])
  })
})

describe('pickSegmentFromSpans', () => {
  // 模拟 random.float：把固定比例映射到 [min, max]，这样“取权重”和“取起点”都能被断言
  const fixed = (value: number) => (min: number, max: number) => min + (max - min) * value

  it('在可用区间内取段，且不越过区间边界', () => {
    const segment = pickSegmentFromSpans([{ startSeconds: 5, endSeconds: 10 }], {
      remainingSeconds: 3,
      minSeconds: 2,
      maxSeconds: 5,
      randomFloat: fixed(0.5),
    })
    expect(segment).not.toBeNull()
    expect(segment!.startSeconds).toBeGreaterThanOrEqual(5)
    expect(segment!.endSeconds).toBeLessThanOrEqual(10)
  })

  it('剩余时长不足时按剩余时长截断', () => {
    const segment = pickSegmentFromSpans([{ startSeconds: 0, endSeconds: 10 }], {
      remainingSeconds: 1.2,
      minSeconds: 2,
      maxSeconds: 5,
      randomFloat: fixed(0),
    })
    expect(segment!.endSeconds - segment!.startSeconds).toBeCloseTo(1.2, 5)
  })

  it('按区间长度加权：只落进被选中的那一档', () => {
    const spans = [
      { startSeconds: 0, endSeconds: 2 },
      { startSeconds: 10, endSeconds: 30 },
    ]
    const segment = pickSegmentFromSpans(spans, {
      remainingSeconds: 5,
      minSeconds: 2,
      maxSeconds: 5,
      randomFloat: fixed(1),
    })
    expect(segment!.startSeconds).toBeGreaterThanOrEqual(10)
  })

  it('没有可用区间时返回 null', () => {
    expect(
      pickSegmentFromSpans([], {
        remainingSeconds: 5,
        minSeconds: 2,
        maxSeconds: 5,
        randomFloat: fixed(0.5),
      }),
    ).toBeNull()
  })
})

describe('resizeRangeEdge', () => {
  it('拖开始端不会越过结束端，至少留 0.3 秒', () => {
    expect(resizeRangeEdge({ startSeconds: 4, endSeconds: 6 }, 'startSeconds', 5.9, 10)).toEqual({
      startSeconds: 5.7,
      endSeconds: 6,
    })
  })

  it('拖结束端不会越过开始端，也不会超出素材时长', () => {
    expect(resizeRangeEdge({ startSeconds: 4, endSeconds: 6 }, 'endSeconds', 0, 10)).toEqual({
      startSeconds: 4,
      endSeconds: 4.3,
    })
    expect(resizeRangeEdge({ startSeconds: 4, endSeconds: 6 }, 'endSeconds', 99, 10)).toEqual({
      startSeconds: 4,
      endSeconds: 10,
    })
  })

  it('负值与 NaN 都夹到 0，不当成无穷大', () => {
    expect(resizeRangeEdge({ startSeconds: 2, endSeconds: 6 }, 'startSeconds', -5, 10)).toEqual({
      startSeconds: 0,
      endSeconds: 6,
    })
    expect(
      resizeRangeEdge({ startSeconds: 2, endSeconds: 6 }, 'endSeconds', Number.NaN, 10),
    ).toEqual({ startSeconds: 2, endSeconds: 2.3 })
  })
})

describe('shiftRange', () => {
  it('整段平移时长度不变', () => {
    expect(shiftRange({ startSeconds: 4, endSeconds: 6 }, 1.5, 10)).toEqual({
      startSeconds: 5.5,
      endSeconds: 7.5,
    })
  })

  it('撞到两端就贴边停住，不缩窄区间', () => {
    expect(shiftRange({ startSeconds: 1, endSeconds: 3 }, -5, 10)).toEqual({
      startSeconds: 0,
      endSeconds: 2,
    })
    expect(shiftRange({ startSeconds: 8, endSeconds: 10 }, 5, 10)).toEqual({
      startSeconds: 8,
      endSeconds: 10,
    })
  })
})
