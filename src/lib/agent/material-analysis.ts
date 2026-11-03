import { generateText } from 'ai'
import { createLanguageModel } from '@/lib/llm/providers'
import { getLlmConfigIssue } from '@/lib/llm/config'
import type { LlmConfig } from '@/lib/llm/types'

export interface MaterialFrame {
  id: string
  name: string
  durationSeconds?: number
  image?: Uint8Array
  samples?: { id: string; timeSeconds: number; image: Uint8Array }[]
}

export interface MaterialScene {
  id: string
  name: string
  description: string
  keywords: string[]
  samples: { timeSeconds: number; description: string }[]
}

export interface MaterialAnalysis {
  summary: string
  scenes: MaterialScene[]
  recommendedOrder: string[]
  mode: 'visual' | 'metadata'
}

const isAbortError = (error: unknown) => (error as { name?: string })?.name === 'AbortError'

const isVisionCompatibilityError = (error: unknown) => {
  const message = String((error as { message?: string })?.message ?? error).toLowerCase()
  return /image|vision|multimodal|unsupported content|does not support.*(image|vision)|invalid.*(image|media)/.test(
    message,
  )
}

export const parseAnalysis = (text: string, materials: MaterialFrame[]): MaterialAnalysis => {
  const fallbackSummary = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .slice(0, 1200)
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  let parsed: {
    summary?: unknown
    recommendedOrder?: unknown
    materials?: unknown
  }
  try {
    if (start < 0 || end <= start) throw new Error('No JSON object in model output')
    parsed = JSON.parse(text.slice(start, end + 1)) as typeof parsed
  } catch {
    if (!fallbackSummary) throw new Error('素材分析未返回有效内容')
    return {
      summary: fallbackSummary,
      scenes: [],
      recommendedOrder: materials.map((material) => material.id),
      mode: 'metadata',
    }
  }
  const materialIds = new Set(materials.map((material) => material.id))
  const scenes = Array.isArray(parsed.materials)
    ? parsed.materials.flatMap((entry): MaterialScene[] => {
        if (!entry || typeof entry !== 'object') return []
        const value = entry as Record<string, unknown>
        const id = typeof value.id === 'string' ? value.id : ''
        const material = materials.find((item) => item.id === id)
        if (!material) return []
        return [
          {
            id,
            name: material.name,
            description:
              typeof value.description === 'string' ? value.description.trim().slice(0, 240) : '',
            keywords: Array.isArray(value.keywords)
              ? value.keywords
                  .filter((keyword): keyword is string => typeof keyword === 'string')
                  .map((keyword) => keyword.trim().slice(0, 40))
                  .filter(Boolean)
                  .slice(0, 8)
              : [],
            samples: Array.isArray(value.samples)
              ? value.samples.flatMap((entry): { timeSeconds: number; description: string }[] => {
                  if (!entry || typeof entry !== 'object') return []
                  const sample = entry as Record<string, unknown>
                  const original = material.samples?.find((item) => item.id === sample.id)
                  const description =
                    typeof sample.description === 'string'
                      ? sample.description.trim().slice(0, 240)
                      : ''
                  return original && description
                    ? [{ timeSeconds: original.timeSeconds, description }]
                    : []
                })
              : [],
          },
        ]
      })
    : []
  const recommendedOrder = Array.isArray(parsed.recommendedOrder)
    ? [
        ...new Set(parsed.recommendedOrder.filter((id): id is string => typeof id === 'string')),
      ].filter((id) => materialIds.has(id))
    : []
  for (const material of materials) {
    if (!recommendedOrder.includes(material.id)) recommendedOrder.push(material.id)
  }
  const summary = (
    (typeof parsed.summary === 'string' ? parsed.summary.trim() : '') ||
    scenes
      .map((scene) => scene.description)
      .filter(Boolean)
      .join('；') ||
    fallbackSummary
  ).slice(0, 1200)
  if (!summary) throw new Error('素材分析结果缺少内容摘要')
  return { summary, scenes, recommendedOrder, mode: 'metadata' }
}

const buildPrompt = (
  materials: MaterialFrame[],
  platform: string,
  targetDurationSeconds: number,
  creativeBrief: string,
  language: string,
) => {
  const inventory = materials
    .map(
      (material) =>
        `- ${material.id}: ${material.name}${
          material.durationSeconds ? ` (${material.durationSeconds.toFixed(1)}s)` : ''
        }`,
    )
    .join('\n')
  return [
    'Analyze these local short-video materials for an automatic narrated video edit.',
    `Target platform: ${platform}. Target finished duration: ${targetDurationSeconds} seconds.`,
    `User creative direction: ${creativeBrief.trim() || '(none supplied)'}. Prioritize clips that support it.`,
    `Write all natural-language analysis fields in ${language}.`,
    'For each supplied clip frame, infer only visible, relevant scene details. Do not invent objects or actions that are not visible.',
    'Choose a coherent recommended order that can support a short narrated story. Use only the provided material IDs.',
    'Describe each labeled sample individually. A sample is a still image at a point in time, not proof of what happens between frames. Return only JSON: {"summary":"overall visual themes","recommendedOrder":["M01"],"materials":[{"id":"M01","description":"visible scene","keywords":["keyword"],"samples":[{"id":"M01-F1","description":"visible details at this point"}]}]}. Use only supplied sample IDs; do not invent details.',
    `Material inventory:\n${inventory}`,
    'A labeled image follows each sampled video in the same order as the inventory.',
  ].join('\n\n')
}

const createUserContent = (materials: MaterialFrame[], includeImages: boolean) => {
  const content: Array<
    { type: 'text'; text: string } | { type: 'image'; image: Uint8Array; mediaType: 'image/jpeg' }
  > = [{ type: 'text', text: '' }]
  if (includeImages) {
    for (const material of materials) {
      if (!material.image) continue
      if (!material.samples?.length) {
        content.push({ type: 'text', text: `Frame for ${material.id} (${material.name}):` })
        content.push({ type: 'image', image: material.image, mediaType: 'image/jpeg' })
      }
      for (const sample of material.samples ?? []) {
        content.push({
          type: 'text',
          text: `Sample ${sample.id} at ${sample.timeSeconds.toFixed(2)} seconds of ${material.id}:`,
        })
        content.push({ type: 'image', image: sample.image, mediaType: 'image/jpeg' })
      }
    }
  }
  return content
}

export async function analyzeMaterials(options: {
  llmConfig: LlmConfig
  materials: MaterialFrame[]
  platform: string
  targetDurationSeconds: number
  creativeBrief: string
  language: string
  abortSignal: AbortSignal
}): Promise<MaterialAnalysis> {
  const {
    llmConfig,
    materials,
    platform,
    targetDurationSeconds,
    creativeBrief,
    language,
    abortSignal,
  } = options
  const configIssue = getLlmConfigIssue(llmConfig)
  if (configIssue) throw new Error(`大模型配置无效：${configIssue}`)
  if (!materials.length) throw new Error('没有可分析的视频素材')
  if (abortSignal.aborted) throw new DOMException('素材分析已取消', 'AbortError')

  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  abortSignal.addEventListener('abort', abort, { once: true })
  const timeout = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, llmConfig.timeoutSeconds * 1000)
  const model = createLanguageModel(llmConfig)
  const prompt = buildPrompt(materials, platform, targetDurationSeconds, creativeBrief, language)

  const request = async (includeImages: boolean) => {
    const content = createUserContent(materials, includeImages)
    content[0] = { type: 'text', text: prompt }
    const result = await generateText({
      model,
      messages: [{ role: 'user', content }],
      abortSignal: controller.signal,
      maxOutputTokens: 4000,
      maxRetries: 0,
    })
    const parsed = parseAnalysis(result.text, materials)
    return {
      ...parsed,
      scenes: includeImages
        ? parsed.scenes
        : parsed.scenes.map((scene) => ({ ...scene, samples: [] })),
      mode: includeImages ? ('visual' as const) : ('metadata' as const),
    }
  }

  try {
    if (materials.some((material) => material.image)) {
      try {
        return await request(true)
      } catch (error) {
        if (controller.signal.aborted || abortSignal.aborted) throw error
        if (!isVisionCompatibilityError(error)) throw error
      }
    }
    return await request(false)
  } catch (error) {
    if (timedOut) throw new Error(`素材分析超时（${llmConfig.timeoutSeconds} 秒）`)
    if (abortSignal.aborted || isAbortError(error))
      throw new DOMException('素材分析已取消', 'AbortError')
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
    abortSignal.removeEventListener('abort', abort)
  }
}
