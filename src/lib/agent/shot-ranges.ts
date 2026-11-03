/**
 * 废镜头（笑场、NG、糊焦、遮挡）剔除的纯计算逻辑。
 * 单独抽出来是为了能直接跑单测：这里只做时间区间的裁剪、合并与选段，不碰 DOM、不碰 IPC。
 */

export interface SecondRange {
  startSeconds: number
  endSeconds: number
}

// 允许被剪进成片的最短空档：比它还短的可用区间不值得单独成段
export const MIN_USABLE_SPAN_SECONDS = 0.8
// 剔除区间两侧各留一点余量，避免切在笑场刚开始或刚结束的那一帧
export const DEFAULT_EXCLUDE_PADDING_SECONDS = 0.25

const clampToDuration = (value: number, durationSeconds: number) =>
  Math.min(Math.max(0, value), Math.max(0, durationSeconds))

/**
 * 把模型给出的「不可用区间」规整成可直接参与剪辑计算的形状：
 * 裁剪到 [0, duration]、丢掉空区间与非法值、按开始时间排序并合并重叠部分。
 */
export const normalizeUnusableRanges = (
  ranges: SecondRange[],
  durationSeconds: number,
): SecondRange[] => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return []
  const cleaned = ranges
    .map((range) => ({
      startSeconds: clampToDuration(Number(range.startSeconds) || 0, durationSeconds),
      endSeconds: clampToDuration(Number(range.endSeconds) || 0, durationSeconds),
    }))
    .filter((range) => range.endSeconds - range.startSeconds > 0.05)
    .sort((left, right) => left.startSeconds - right.startSeconds)

  const merged: SecondRange[] = []
  for (const range of cleaned) {
    const last = merged.at(-1)
    if (last && range.startSeconds <= last.endSeconds) {
      last.endSeconds = Math.max(last.endSeconds, range.endSeconds)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

/**
 * 可用区间 = 整条素材减去所有废镜头区间，再把剔除区间各自外扩一点余量。
 */
export const buildAllowedSpans = (
  durationSeconds: number,
  unusableRanges: SecondRange[],
  paddingSeconds = DEFAULT_EXCLUDE_PADDING_SECONDS,
): SecondRange[] => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return []
  const blocks = normalizeUnusableRanges(unusableRanges, durationSeconds).map((range) => ({
    startSeconds: Math.max(0, range.startSeconds - paddingSeconds),
    endSeconds: Math.min(durationSeconds, range.endSeconds + paddingSeconds),
  }))

  const spans: SecondRange[] = []
  let cursor = 0
  for (const block of blocks) {
    if (block.startSeconds - cursor >= MIN_USABLE_SPAN_SECONDS) {
      spans.push({ startSeconds: cursor, endSeconds: block.startSeconds })
    }
    cursor = Math.max(cursor, block.endSeconds)
  }
  if (durationSeconds - cursor >= MIN_USABLE_SPAN_SECONDS) {
    spans.push({ startSeconds: cursor, endSeconds: durationSeconds })
  }
  return spans
}

/** 编辑剔除区间时，最短保留多少秒：太短的区间没意义，也容易手滑删成 0 */
export const MIN_RANGE_SPAN_SECONDS = 0.3

export type RangeEdge = 'startSeconds' | 'endSeconds'

/**
 * 手动改剔除区间的某一端。
 * 模型给的区间是"以一个采样点为中心各扩 1.5 秒"的死框，笑场持续多久并不确定，
 * 所以这里允许用户把两端拖到实际看到的位置：夹在 [0, duration] 内，且至少留 MIN_RANGE_SPAN_SECONDS。
 * 故意不做排序合并——用户可能把两段临时拖成重叠，统一交给 buildAllowedSpans 规整。
 */
export const resizeRangeEdge = (
  range: SecondRange,
  edge: RangeEdge,
  valueSeconds: number,
  durationSeconds: number,
  minSpanSeconds = MIN_RANGE_SPAN_SECONDS,
): SecondRange => {
  const duration = Math.max(0, Number(durationSeconds) || 0)
  const startSeconds = clampToDuration(Number(range.startSeconds) || 0, duration)
  const endSeconds = clampToDuration(Number(range.endSeconds) || 0, duration)
  const value = clampToDuration(Number(valueSeconds) || 0, duration)
  if (edge === 'startSeconds') {
    return {
      startSeconds: Math.min(value, Math.max(0, endSeconds - minSpanSeconds)),
      endSeconds,
    }
  }
  return {
    startSeconds,
    endSeconds: Math.max(value, Math.min(duration, startSeconds + minSpanSeconds)),
  }
}

/**
 * 整段平移剔除区间：两端同时挪 deltaSeconds，撞到边界就停住而不是缩窄区间。
 */
export const shiftRange = (
  range: SecondRange,
  deltaSeconds: number,
  durationSeconds: number,
): SecondRange => {
  const duration = Math.max(0, Number(durationSeconds) || 0)
  const span = Math.max(0, range.endSeconds - range.startSeconds)
  const delta = Number(deltaSeconds) || 0
  const startSeconds = Math.min(Math.max(0, range.startSeconds + delta), Math.max(0, duration - span))
  return { startSeconds, endSeconds: Math.min(duration, startSeconds + span) }
}

/**
 * 在可用区间里挑一段：按区间长度加权，长空档被选中的概率更高，
 * 单段时长仍按原来的 [minSeconds, maxSeconds] 随机，且不超过剩余需要补足的时长。
 * 返回 null 表示这条素材已经没有任何可用画面。
 */
export const pickSegmentFromSpans = (
  spans: SecondRange[],
  options: {
    remainingSeconds: number
    minSeconds: number
    maxSeconds: number
    randomFloat: (min: number, max: number) => number
  },
): SecondRange | null => {
  const { remainingSeconds, minSeconds, maxSeconds, randomFloat } = options
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return null
  const usable = spans.filter((span) => span.endSeconds - span.startSeconds >= MIN_USABLE_SPAN_SECONDS)
  if (!usable.length) return null

  const totalWeight = usable.reduce(
    (sum, span) => sum + (span.endSeconds - span.startSeconds),
    0,
  )
  let cursor = randomFloat(0, totalWeight)
  let span = usable[usable.length - 1]
  for (const candidate of usable) {
    cursor -= candidate.endSeconds - candidate.startSeconds
    if (cursor <= 0) {
      span = candidate
      break
    }
  }

  const spanLength = span.endSeconds - span.startSeconds
  const desired = Math.min(remainingSeconds, spanLength)
  const upperBound = Math.min(maxSeconds, desired)
  const lowerBound = Math.min(minSeconds, upperBound)
  const duration =
    upperBound - lowerBound > 0.01
      ? Math.min(desired, randomFloat(lowerBound, upperBound))
      : desired
  const maxStart = span.endSeconds - Math.min(duration, spanLength)
  const startSeconds = randomFloat(span.startSeconds, Math.max(span.startSeconds, maxStart))
  return {
    startSeconds,
    endSeconds: Math.min(span.endSeconds, startSeconds + duration),
  }
}
