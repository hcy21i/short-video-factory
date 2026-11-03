import { generateText } from 'ai'
import { createLanguageModel } from '@/lib/llm/providers'
import { getLlmConfigIssue } from '@/lib/llm/config'
import type { LlmConfig } from '@/lib/llm/types'
import { normalizeUnusableRanges, type SecondRange } from './shot-ranges'

export interface ReviewFrameSample {
  /** 该帧在原视频里的时间点（秒） */
  timeSeconds: number
  image?: Uint8Array
}

export interface ReviewMaterialInput {
  id: string
  name: string
  durationSeconds: number
  frames: ReviewFrameSample[]
}

export interface UnusableRange extends SecondRange {
  reason: string
}

export interface ShotReview {
  summary: string
  /** key 是素材 id，值是判定为不能用的时间段 */
  unusableByMaterial: Record<string, UnusableRange[]>
}

// 一次请求最多带几条素材：帧太多模型会变慢变糊，分批更稳
// 逐帧判定要模型把每一帧都说清楚，一次给太多素材会耗光输出预算
const MATERIALS_PER_REQUEST = 2
// 模型没给区间时的兜底：以该采样点为中心前后各扩 1.5 秒
const SINGLE_FRAME_SPAN_SECONDS = 3

const isAbortError = (error: unknown) => (error as { name?: string })?.name === 'AbortError'

const buildPrompt = (materials: ReviewMaterialInput[], language: string) => {
  const inventory = materials
    .map((material) => {
      const stamps = material.frames
        .map((frame) => `${frame.timeSeconds.toFixed(1)}s`)
        .join(', ')
      return `- ${material.id}: ${material.name}（总长 ${material.durationSeconds.toFixed(1)}s；采样点：${stamps}）`
    })
    .join('\n')
  return [
    'You are reviewing raw short-video footage before an automatic edit. Frame-by-frame first, verdict second.',
    'STEP 1 — inspect EVERY sampled frame and record what the presenter is doing. Pay attention to the mouth (open/laughing vs. closed/neutral), the eyes (squinting, head thrown back), the hands (covering the face, waving at the camera), and the gaze (looking off-camera instead of at the product).',
    'STEP 2 — mark a frame as "issue" when it shows a moment that must be cut:',
    '- "laugh": laughing, giggling, head thrown back, hand covering the mouth, smiling broadly while the demo stops. In amateur product footage this is the most common broken take; a laughing face is NEVER acceptable in the final cut.',
    '- "ng": the presenter clearly restarts, freezes mid-sentence, or reacts to a mistake.',
    '- "blur": strong motion blur, out-of-focus frame, camera shake.',
    '- "blocked": hand, arm, or another object covering most of the lens or the product.',
    '- "empty": neither the person nor the product is visible.',
    'STEP 3 — everything else is issue "none". A plain but correct demonstration frame is fine; do not flag it.',
    'Be literal about faces: if the mouth is wide open with the eyes squeezed shut or the head tilted back, that is "laugh", even if the rest of the shot looks good.',
    'Write every natural-language field in ' + language + '.',
    'Return only JSON with this exact shape: {"summary":"one or two sentences on what must be cut and why","frames":[{"material":"M01","t":3.0,"face":"laughing|smiling|neutral|not_visible","issue":"none|laugh|ng|blur|blocked|empty","note":""}]}.',
    'Return ONE entry per sampled frame, in the same order as the timestamps listed below — never skip or merge frames. Use an empty "frames" note field when nothing is wrong.',
    `Clips under review:\n${inventory}`,
    'A labeled image follows each sampled frame in the same order as the timestamps above.',
  ].join('\n\n')
}

const createContent = (materials: ReviewMaterialInput[], prompt: string) => {
  const content: Array<
    { type: 'text'; text: string } | { type: 'image'; image: Uint8Array; mediaType: 'image/jpeg' }
  > = [{ type: 'text', text: prompt }]
  for (const material of materials) {
    for (const frame of material.frames) {
      if (!frame.image) continue
      content.push({
        type: 'text',
        text: `${material.id} @ ${frame.timeSeconds.toFixed(1)}s:`,
      })
      content.push({ type: 'image', image: frame.image, mediaType: 'image/jpeg' })
    }
  }
  return content
}

const toNumber = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

// 模型逐帧返回的 issue 代码 → 人类可读原因（模型给了 note 就用 note）
const ISSUE_REASONS: Record<string, string> = {
  laugh: '笑场',
  ng: 'NG 重拍',
  blur: '画面模糊',
  blocked: '镜头被遮挡',
  empty: '空镜',
}

const parseReview = (text: string, materials: ReviewMaterialInput[]): ShotReview => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  let parsed: { summary?: unknown; materials?: unknown; frames?: unknown } = {}
  if (start >= 0 && end > start) {
    try {
      parsed = JSON.parse(text.slice(start, end + 1)) as typeof parsed
    } catch {
      parsed = {}
    }
  }

  const byId = new Map(materials.map((material) => [material.id, material]))
  const unusableByMaterial: Record<string, UnusableRange[]> = {}
  for (const material of materials) unusableByMaterial[material.id] = []

  // 逐帧结论：模型说这一帧是笑场/NG 等，就以该帧为中心前后各扩 1.5 秒
  if (Array.isArray(parsed.frames)) {
    for (const entry of parsed.frames) {
      if (!entry || typeof entry !== 'object') continue
      const value = entry as Record<string, unknown>
      const id = typeof value.material === 'string' ? value.material : ''
      const material = byId.get(id)
      if (!material) continue
      const issue = typeof value.issue === 'string' ? value.issue.trim().toLowerCase() : 'none'
      if (!issue || issue === 'none' || issue === 'ok') continue
      const timeSeconds = toNumber(value.t)
      if (!Number.isFinite(timeSeconds)) continue
      const half = SINGLE_FRAME_SPAN_SECONDS / 2
      const note = typeof value.note === 'string' ? value.note.trim().slice(0, 40) : ''
      unusableByMaterial[id].push({
        startSeconds: Math.max(0, timeSeconds - half),
        endSeconds: Math.min(material.durationSeconds, timeSeconds + half),
        reason: note || ISSUE_REASONS[issue] || '画面不可用',
      })
    }
  }

  if (Array.isArray(parsed.materials)) {
    for (const entry of parsed.materials) {
      if (!entry || typeof entry !== 'object') continue
      const value = entry as Record<string, unknown>
      const id = typeof value.id === 'string' ? value.id : ''
      const material = byId.get(id)
      if (!material) continue
      const raw = Array.isArray(value.unusable) ? value.unusable : []
      const rawRanges = raw
        .map((item) => {
          if (!item || typeof item !== 'object') return null
          const range = item as Record<string, unknown>
          const startSeconds = toNumber(range.start)
          const endSeconds = toNumber(range.end)
          if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) return null
          return {
            startSeconds,
            endSeconds,
            reason: typeof range.reason === 'string' ? range.reason.trim().slice(0, 40) : '',
          }
        })
        .filter((item): item is SecondRange & { reason: string } => Boolean(item))
      // 逐帧结论和显式区间合在一起再合并，取第一个与合并后区间相交的原始原因
      const mergedRanges = [...unusableByMaterial[id], ...rawRanges]
      unusableByMaterial[id] = normalizeUnusableRanges(mergedRanges, material.durationSeconds).map(
        (range) => ({
          ...range,
          reason:
            mergedRanges.find(
              (item) => item.startSeconds <= range.endSeconds && item.endSeconds >= range.startSeconds,
            )?.reason || '画面不可用',
        }),
      )
    }
  }

  const summary =
    (typeof parsed.summary === 'string' ? parsed.summary.trim() : '') ||
    (Object.values(unusableByMaterial).some((ranges) => ranges.length)
      ? '已标出需要剔除的画面区间'
      : '没有发现明显不可用的画面')
  return { summary: summary.slice(0, 600), unusableByMaterial }
}

export async function reviewShots(options: {
  llmConfig: LlmConfig
  materials: ReviewMaterialInput[]
  language: string
  abortSignal: AbortSignal
}): Promise<ShotReview> {
  const { llmConfig, materials, language, abortSignal } = options
  const configIssue = getLlmConfigIssue(llmConfig)
  if (configIssue) throw new Error(`大模型配置无效：${configIssue}`)
  const usable = materials.filter((material) => material.frames.length)
  if (!usable.length) throw new Error('没有可检查的视频画面')
  if (abortSignal.aborted) throw new DOMException('废镜头检测已取消', 'AbortError')

  const model = createLanguageModel(llmConfig)
  const result: ShotReview = { summary: '', unusableByMaterial: {} }
  const summaries: string[] = []

  for (let index = 0; index < usable.length; index += MATERIALS_PER_REQUEST) {
    const chunk = usable.slice(index, index + MATERIALS_PER_REQUEST)
    const controller = new AbortController()
    let timedOut = false
    const abort = () => controller.abort()
    abortSignal.addEventListener('abort', abort, { once: true })
    const timeout = globalThis.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, llmConfig.timeoutSeconds * 1000)

    try {
      const response = await generateText({
        model,
        messages: [
          { role: 'user', content: createContent(chunk, buildPrompt(chunk, language)) },
        ],
        abortSignal: controller.signal,
        maxOutputTokens: 4000,
        maxRetries: 0,
      })
      const parsed = parseReview(response.text, chunk)
      Object.assign(result.unusableByMaterial, parsed.unusableByMaterial)
      if (parsed.summary) summaries.push(parsed.summary)
    } catch (error) {
      if (timedOut) throw new Error(`废镜头检测超时（${llmConfig.timeoutSeconds} 秒）`)
      if (abortSignal.aborted || isAbortError(error))
        throw new DOMException('废镜头检测已取消', 'AbortError')
      throw error
    } finally {
      globalThis.clearTimeout(timeout)
      abortSignal.removeEventListener('abort', abort)
    }
  }

  // 分批请求时每批都会给一句总结：有问题的批次优先，别让“没发现问题”盖住真正的结论
  const total = Object.values(result.unusableByMaterial).reduce(
    (sum, ranges) => sum + ranges.length,
    0,
  )
  const findingSummaries = summaries.filter(
    (summary) => !/没有发现|未发现|no unusable/i.test(summary),
  )
  result.summary = total
    ? (findingSummaries.join(' ') || '已标出需要剔除的画面区间').slice(0, 600)
    : // 没标出区间时也要保留模型自己的说明，别用固定文案把它盖掉
      (summaries.find((summary) => summary.trim()) || '没有发现明显不可用的画面').slice(0, 900)
  return result
}

export { SINGLE_FRAME_SPAN_SECONDS }
