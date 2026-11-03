export type PlatformKey =
  | 'douyin'
  | 'xiaohongshu'
  | 'kuaishou'
  | 'wechat-channels'
  | 'bilibili'
  | 'tiktok'
  | 'youtube-shorts'
  | 'general'

export type HookKey = 'contrarian' | 'painpoint' | 'result' | 'identity' | 'number' | 'suspense'

/** 文案口气：neutral = 去营销化的说明口吻（默认）；sales = 允许带卖点推销 */
export type CopyTone = 'neutral' | 'sales'

// 默认走 neutral：用户明确要求“尽量不要带营销文案”，口播更像是边做边说，而不是带货念稿。
const TONE_RULES: Record<CopyTone, string> = {
  neutral:
    '不要营销腔：不喊“家人们/宝宝们/闭眼入/YYDS/天花板/王炸/绝了”，不写“限时、秒杀、最后 X 件、抢”，不堆“震撼、顶级、超值、必备”这类形容词，不用感叹号连发；像在跟朋友说话，用已知事实和画面自然介绍用途与场景，不要编造使用体验或逐项罗列缺少的参数。',
  sales:
    '可以适度带卖点和行动引导，但仍然不用绝对化用语、不虚构优惠、不喊口号式营销话术。',
}

interface PlatformRule {
  /** 平台名 + 画幅，出现在提示词里，让模型知道自己在给谁写 */
  label: string
  /** 平台审核红线，写成可直接执行的禁区 */
  compliance: string[]
  /** 语速/句式/长度上的节奏要求 */
  rhythm: string
  /** 这条平台偏好的内容骨架 */
  structure: string
}

// 中文口播约 4.5 字/秒，用来把目标时长换算成字数区间
const CHARS_PER_SECOND = 4.5

const PLATFORM_RULES: Record<PlatformKey, PlatformRule> = {
  douyin: {
    label: '抖音（竖屏 9:16）',
    compliance: [
      '不使用“最”“第一”“国家级”“顶级”等绝对化用语',
      '不承诺疗效、收益、销量或“一定有效”的结果',
      '不引导加微信、加群、导流站外，不提“私信我”',
      '不虚构促销、库存和倒计时',
    ],
    rhythm: '短句为主，一句一个意思，语速偏快，数字要具体',
    structure: '开头钩子 → 具体使用场景 → 产品解法与可验证细节 → 一句轻行动引导',
  },
  xiaohongshu: {
    label: '小红书（竖屏 9:16）',
    compliance: [
      '不使用绝对化用语和夸大功效',
      '不诱导点赞、收藏、关注、转发',
      '不出现站外导流和联系方式',
      '不涉及医疗、保健功效和极限词',
    ],
    rhythm: '第一人称种草口吻，偏口语但完整，多用具体细节和使用感受',
    structure: '开头钩子 → 使用场景与真实体验 → 关键细节（材质/尺寸/安装/价格） → 适合谁买',
  },
  kuaishou: {
    label: '快手（竖屏 9:16）',
    compliance: [
      '不使用绝对化用语和虚假承诺',
      '不虚构原价、库存和返现',
      '不引导站外交易和私下转账',
    ],
    rhythm: '接地气、直白、口语化，说人话，少书面词',
    structure: '开头钩子 → 痛点直给 → 实拍可验证的细节 → 价格与利益点 → 行动引导',
  },
  'wechat-channels': {
    label: '微信视频号（竖屏 9:16）',
    compliance: [
      '语气稳重可信，避免夸张营销腔',
      '不诱导分享、集赞、转发',
      '不使用绝对化用语和功效承诺',
    ],
    rhythm: '语速平稳，句子完整，偏叙事和讲道理',
    structure: '开头钩子 → 生活场景与共鸣 → 解决思路与依据 → 温和的收尾建议',
  },
  bilibili: {
    label: 'B站（横屏或竖屏均可）',
    compliance: [
      '不夸大参数和体验，讲得清原理和取舍',
      '不硬广堆砌，广告性质内容要有信息量',
      '不使用绝对化用语',
    ],
    rhythm: '信息密度高，允许稍长句子，可以有观点和个人判断',
    structure: '开头钩子 → 问题拆解 → 实测/原理/对比论据 → 结论与适买人群',
  },
  tiktok: {
    label: 'TikTok (vertical 9:16)',
    compliance: [
      'No absolute or superlative claims, no guaranteed results',
      'No medical or health claims, no before/after bait',
      'No off-platform redirects or contact details',
    ],
    rhythm: 'Conversational spoken English (or the user language), varied natural sentence lengths, concrete details only when provided',
    structure: 'Hook in the first 3 seconds → relatable situation → relevant known or visible product details → natural closing or CTA when appropriate',
  },
  'youtube-shorts': {
    label: 'YouTube Shorts (vertical 9:16)',
    compliance: [
      'No misleading claims or fake urgency',
      'No superlatives that cannot be proven',
      'No off-platform redirects',
    ],
    rhythm: 'Clear, conversational, one idea per sentence, concrete details',
    structure: 'Hook in the first 3 seconds → context → demonstration → CTA',
  },
  general: {
    label: '通用短视频',
    compliance: [
      '不使用绝对化用语、虚假承诺和疗效描述',
      '不虚构参数、价格、优惠和使用经历',
    ],
    rhythm: '口语化、长短句适中，一句话只讲一个信息点',
    structure: '开头钩子 → 场景/痛点 → 解法与细节 → 收尾引导',
  },
}

const HOOK_RULES: Record<HookKey, string> = {
  contrarian: '用一句反常识断言开场，先否定观众默认的做法，再在下一句给出理由',
  painpoint: '用一句直接戳中观众当下困扰的提问开场，不铺垫、不自我介绍',
  result: '先把最终结果或效果摆出来，再回头讲怎么做到的',
  identity: '用一句“如果你是……”把目标人群直接点名，让对的人立刻停下来',
  number: '用一个具体数字（时间/价格/尺寸/次数）开场，制造可感知的落差',
  suspense: '先抛出一个悬念或未解的问题，把答案留到中段',
}

export interface PlatformGuidanceOptions {
  platform: string | null | undefined
  durationSeconds?: number
  hook?: string | null
  /** 钩子名称的本地化标签，由调用方从 i18n 取，避免在提示词里出现原始 key */
  hookLabel?: string
  /** 文案口气，默认 neutral（去营销化） */
  tone?: CopyTone
}

const normalizePlatform = (platform: string | null | undefined): PlatformKey => {
  const key = String(platform ?? '').trim() as PlatformKey
  return key && key in PLATFORM_RULES ? key : 'general'
}

const normalizeTone = (tone: CopyTone | null | undefined): CopyTone =>
  tone === 'sales' ? 'sales' : 'neutral'

const normalizeHook = (hook: string | null | undefined): HookKey | null => {
  const key = String(hook ?? '').trim() as HookKey
  return key && key in HOOK_RULES ? key : null
}

/**
 * 生成平台规则 + 内容钩子的提示词片段。
 * 单独成段拼在用户需求前面，模型会把它当作硬约束而不是背景信息。
 */
export function buildPlatformGuidance(options: PlatformGuidanceOptions): string {
  const platformKey = normalizePlatform(options.platform)
  const rule = PLATFORM_RULES[platformKey]
  const duration = Number(options.durationSeconds ?? 0)
  const hookKey = normalizeHook(options.hook)

  const lines: string[] = []
  const durationPart =
    duration > 0
      ? `，目标时长约 ${duration} 秒（中文约 ${Math.round(duration * CHARS_PER_SECOND)} 字；英文约 ${Math.round(duration * 2)}–${Math.round(duration * 2.4)} 词，根据实际输出语言选择）`
      : ''
  lines.push(`投放平台：${rule.label}${durationPart}`)
  lines.push(`平台合规红线（必须遵守）：${rule.compliance.join('；')}。`)
  lines.push(`节奏要求：${rule.rhythm}。`)
  lines.push(`表达风格：${TONE_RULES[normalizeTone(options.tone)]}`)
  lines.push(`内容结构：${rule.structure}。`)

  if (hookKey) {
    const label = options.hookLabel?.trim() || hookKey
    lines.push(`内容钩子（前 3 秒必须完成，只写一句）：采用「${label}」——${HOOK_RULES[hookKey]}。`)
  } else {
    lines.push(
      '内容钩子（前 3 秒必须完成，只写一句）：从反常识断言、痛点提问、结果前置、身份代入、数字冲击、悬念留白里挑一个最合适的，不要铺垫和自我介绍。',
    )
  }

  return lines.join('\n')
}
