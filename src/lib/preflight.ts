/**
 * 出片前检查的纯计算部分（文案时长估算、就绪判定）。
 * 单独抽出来是为了能跑单测：这里不碰 IPC、不碰 i18n。
 */

export type PreflightStatus = 'ok' | 'warn'

export interface PreflightItem {
  id: 'assets' | 'review' | 'script' | 'voice' | 'output'
  label: string
  detail: string
  status: PreflightStatus
  /** 缺项时给的跳转入口文案；有值的项说明点一下就能补上 */
  actionLabel?: string
}

// 中文口播约 4.3 字/秒，英文约 13 字符/秒：用来判断这版文案撑不撑得起目标时长
const CJK_SECONDS_PER_CHAR = 1 / 4.3
const LATIN_SECONDS_PER_CHAR = 1 / 13
// 超出这个比例就提示"和目标时长对不上"，但不拦着出片
export const PREFLIGHT_DURATION_TOLERANCE = 0.35

/** 粗估这段文案念出来要多久。中文按字数、其它按字符数分开算。 */
export const estimateSpeechSeconds = (text: string): number => {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return 0
  const cjk = trimmed.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0
  const latin = trimmed.replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af\s]/g, '').length
  return cjk * CJK_SECONDS_PER_CHAR + latin * LATIN_SECONDS_PER_CHAR
}

/** 文案时长和目标时长是否在同一档：允许 ±35% 的浮动。 */
export const isDurationOnTarget = (speechSeconds: number, targetSeconds: number): boolean => {
  if (!Number.isFinite(speechSeconds) || speechSeconds <= 0) return false
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) return true
  const ratio = speechSeconds / targetSeconds
  return ratio >= 1 - PREFLIGHT_DURATION_TOLERANCE && ratio <= 1 + PREFLIGHT_DURATION_TOLERANCE
}

/** 有任一项是 warn 就说明还有活没干完。 */
export const hasBlockingIssue = (items: PreflightItem[]): boolean =>
  items.some((item) => item.status === 'warn')
