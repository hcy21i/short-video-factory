import { describe, expect, it } from 'vitest'
import {
  estimateSpeechSeconds,
  hasBlockingIssue,
  isDurationOnTarget,
  type PreflightItem,
} from '@/lib/preflight'

describe('estimateSpeechSeconds', () => {
  it('中文按 4.3 字/秒估算', () => {
    const text = '家里卫生间厨房总是闷着异味散不出去'
    expect(estimateSpeechSeconds(text)).toBeCloseTo(text.length / 4.3, 3)
  })

  it('中英混排分开算，空白不计', () => {
    const expected = '穿墙排气扇'.length / 4.3 + 2 / 13
    expect(estimateSpeechSeconds('穿墙排气扇 OK')).toBeCloseTo(expected, 3)
    // 空白不算字数：多几个空格结果不变
    expect(estimateSpeechSeconds('穿墙排气扇    OK')).toBeCloseTo(expected, 3)
  })

  it('空文案返回 0', () => {
    expect(estimateSpeechSeconds('   ')).toBe(0)
  })
})

describe('isDurationOnTarget', () => {
  it('±35% 以内都算对得上', () => {
    expect(isDurationOnTarget(30, 30)).toBe(true)
    expect(isDurationOnTarget(20, 30)).toBe(true)
    expect(isDurationOnTarget(40, 30)).toBe(true)
  })

  it('差太多就是没对上', () => {
    expect(isDurationOnTarget(12, 30)).toBe(false)
    expect(isDurationOnTarget(60, 30)).toBe(false)
  })

  it('目标时长非法时不报错', () => {
    expect(isDurationOnTarget(30, 0)).toBe(true)
  })
})

describe('hasBlockingIssue', () => {
  const item = (status: 'ok' | 'warn'): PreflightItem => ({
    id: 'assets',
    label: 'a',
    detail: 'b',
    status,
  })

  it('全绿返回 false', () => {
    expect(hasBlockingIssue([item('ok'), item('ok')])).toBe(false)
  })

  it('有一项待补就返回 true', () => {
    expect(hasBlockingIssue([item('ok'), item('warn')])).toBe(true)
  })
})
