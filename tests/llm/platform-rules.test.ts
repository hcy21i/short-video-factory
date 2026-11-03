import { describe, expect, it } from 'vitest'
import { buildPlatformGuidance } from '@/lib/llm/platform-rules'

describe('buildPlatformGuidance', () => {
  it('把平台名、目标时长和换算字数写进提示词', () => {
    const guidance = buildPlatformGuidance({ platform: 'douyin', durationSeconds: 30 })
    expect(guidance).toContain('投放平台：抖音')
    expect(guidance).toContain('目标时长约 30 秒')
    expect(guidance).toContain('约 135 字')
  })

  it('带出该平台的合规红线', () => {
    const guidance = buildPlatformGuidance({ platform: 'xiaohongshu' })
    expect(guidance).toContain('小红书')
    expect(guidance).toContain('不诱导点赞、收藏、关注、转发')
    expect(guidance).toContain('内容结构：')
  })

  it('指定钩子时写入钩子类型和写法', () => {
    const guidance = buildPlatformGuidance({
      platform: 'douyin',
      hook: 'painpoint',
      hookLabel: '痛点提问',
    })
    expect(guidance).toContain('采用「痛点提问」')
    expect(guidance).toContain('直接戳中观众当下困扰的提问')
  })

  it('未指定钩子时给出可自选的钩子清单', () => {
    const guidance = buildPlatformGuidance({ platform: 'douyin' })
    expect(guidance).toContain('从反常识断言、痛点提问、结果前置、身份代入、数字冲击、悬念留白里挑一个')
    expect(guidance).not.toContain('采用「')
  })

  it('未知平台回落到通用规则，未知钩子按未指定处理', () => {
    const guidance = buildPlatformGuidance({
      platform: 'weibo' as never,
      hook: 'unknown' as never,
    })
    expect(guidance).toContain('投放平台：通用短视频')
    expect(guidance).toContain('从反常识断言')
  })

  it('英文平台不混入中文口播节奏要求', () => {
    const guidance = buildPlatformGuidance({ platform: 'tiktok', durationSeconds: 60 })
    expect(guidance).toContain('TikTok')
    expect(guidance).toContain('Hook in the first 3 seconds')
    expect(guidance).toContain('英文约 120–144 词')
    expect(guidance).toContain('concrete details only when provided')
  })

  it('默认走去营销化口气，并逐条列出禁用的话术', () => {
    const guidance = buildPlatformGuidance({ platform: 'douyin' })
    expect(guidance).toContain('表达风格：不要营销腔')
    expect(guidance).toContain('家人们')
    expect(guidance).toContain('限时')
  })

  it('显式要推销口气时换成销售版规则', () => {
    const guidance = buildPlatformGuidance({ platform: 'douyin', tone: 'sales' })
    expect(guidance).toContain('可以适度带卖点')
    expect(guidance).not.toContain('不要营销腔')
  })
})
