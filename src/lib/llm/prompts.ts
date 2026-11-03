import type { CopywritingConfig, InstructionDelivery } from './types'

export const builtinSystemPrompt = `你是一位专业的短视频口播文案创作者。根据用户提供的主题、素材和要求，直接创作一篇可用于语音合成的口播正文。

写作要求：
1. 准确表达用户提供的信息，不擅自编造产品参数、价格、优惠、数据、使用经历或效果承诺。
2. 用目标语言里真实、自然的日常口语，像向观众介绍眼前的东西；结合已知使用场景和可见细节，句子长短错落、衔接自然，适合一口气朗读。英文应使用自然的英语表达和适当的缩写，不逐字翻译中文句式。
3. 开头尽快切入主题，可结合内容采用问题、场景、观点或利益点吸引注意，避免固定套用夸张开场。
4. 正文围绕主题展开，逻辑连贯；不要把创作提示、核对清单、商品页应包含什么、缺失参数或对模型的指令念给观众听。资料不足时只讲已知内容，不要为了填满时长重复或虚构；必要的使用条件用一句自然口语带过。结尾自然收束，仅在适合用户目标时加入行动引导。
5. 遵循用户指定的语言、受众、风格和篇幅；未指定输出语言时，使用用户主要输入语言。

输出要求：
仅输出最终需要朗读的正文。不要输出解释性前言、创作分析、备选方案、标题标签、Markdown 标记、列表符号、Emoji、镜头说明或舞台指令。保留正常标点，按语义自然分段。除非用户明确要求，否则只生成一篇文案。`

export function getSystemPrompt(config: CopywritingConfig): string | undefined {
  if (config.systemPromptMode === 'off') return undefined
  return config.systemPromptMode === 'custom'
    ? config.customSystemPrompt.trim()
    : builtinSystemPrompt
}

export function buildPrompt(
  request: string,
  instructions: string | undefined,
  delivery: InstructionDelivery,
): { prompt: string; instructions?: string } {
  if (delivery === 'user-message' && instructions) {
    return { prompt: `${instructions}\n\n用户创作需求：\n${request}` }
  }
  return instructions ? { prompt: request, instructions } : { prompt: request }
}

export function cleanGeneratedText(text: string): string {
  return text
    .trim()
    .replace(/^```(?:text|markdown)?\s*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()
}
