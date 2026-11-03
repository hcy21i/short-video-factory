<template>
  <div class="w-full h-full">
    <v-form class="creator-form w-full h-full flex flex-col gap-3" :disabled="disabled">
      <v-sheet class="creator-brief-panel shrink-0 p-4 flex flex-col gap-3" border rounded>
        <div class="creator-panel-heading">
          <div class="creator-panel-mark"><v-icon size="19">mdi-lightbulb-on-outline</v-icon></div>
          <div class="min-w-0 flex-1">
            <div class="creator-panel-title">{{ t('features.workspace.briefSection') }}</div>
            <div class="creator-panel-subtitle">{{ t('features.agent.taskHint') }}</div>
          </div>
          <v-chip size="small" variant="tonal" color="primary" prepend-icon="mdi-cellphone-link">
            {{ platformItems.find((item) => item.value === appStore.agentPlatform)?.title }}
          </v-chip>
        </div>
        <div class="grid grid-cols-[minmax(0,1.3fr)_minmax(104px,0.7fr)] gap-2">
          <v-select
            v-model="appStore.agentPlatform"
            :items="platformItems"
            :label="t('features.agent.platform')"
            density="compact"
            hide-details
            :disabled="disabled"
          />
          <v-text-field
            v-model.number="appStore.agentTargetDurationSeconds"
            :label="t('features.agent.duration')"
            type="number"
            min="5"
            max="600"
            step="5"
            suffix="s"
            density="compact"
            hide-details
            :disabled="disabled"
          />
        </div>
        <div class="grid grid-cols-[minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.2fr)] gap-2">
          <v-select
            v-model="appStore.videoType"
            :items="videoTypeItems"
            :label="t('features.agent.videoType')"
            clearable
            density="compact"
            hide-details
            :disabled="disabled"
          />
          <v-select
            v-model="appStore.hookType"
            :items="hookTypeItems"
            :label="t('features.agent.hookType')"
            clearable
            density="compact"
            hide-details
            :disabled="disabled"
          />
          <v-text-field
            v-model="appStore.productKeywords"
            :label="t('features.agent.productKeywords')"
            :placeholder="t('features.agent.productKeywordsPlaceholder')"
            density="compact"
            hide-details
            :disabled="disabled"
          />
        </div>
        <div class="brief-input-row flex gap-2 flex-1 min-h-[96px]">
          <v-textarea
            v-model="appStore.prompt"
            class="min-h-0 flex-1"
            :label="t('features.agent.brief')"
            :placeholder="t('features.agent.briefPlaceholder')"
            rows="2"
            counter
            persistent-counter
            no-resize
            density="compact"
            hide-details
            :disabled="disabled"
          />
          <div class="shrink-0 flex flex-col gap-2">
            <v-btn
              v-if="appStore.copywritingStatus !== 'generating'"
              prepend-icon="mdi-auto-fix"
              color="primary"
              stacked
              :disabled="disabled"
              @click="handleGenerate"
            >
              {{ t('features.agent.generateScript') }}
            </v-btn>
            <v-btn v-else color="red" stacked :disabled="disabled" @click="handleStopGenerate">
              <template #prepend>
                <v-progress-circular indeterminate :size="28" :width="2" aria-hidden="true">
                  <v-icon size="18">mdi-stop</v-icon>
                </v-progress-circular>
              </template>
              {{ t('common.buttons.stop') }}
            </v-btn>
            <v-btn :disabled="disabled" @click="emit('open-model-settings')">
              {{ t('common.buttons.config') }}
            </v-btn>
          </div>
        </div>
      </v-sheet>
      <v-sheet class="script-workspace-panel h-0 flex-1 p-3" border rounded>
        <div class="script-panel-header">
          <div class="min-w-0">
            <div class="creator-panel-title">{{ t('features.workspace.scriptSection') }}</div>
            <div class="creator-panel-subtitle">{{ t('features.workspace.scriptSectionHint') }}</div>
          </div>
          <v-chip size="small" variant="tonal" :color="appStore.copywritingStatus === 'completed' || appStore.copywritingStatus === 'edited' ? 'success' : 'default'">
            {{ statusLabel }}
          </v-chip>
        </div>
        <v-textarea
          v-model="outputText"
          class="script-editor h-full"
          :readonly="appStore.copywritingStatus === 'generating'"
          :label="t('features.llm.config.outputLabel')"
          counter
          persistent-counter
          no-resize
          hide-details="auto"
          variant="outlined"
          @update:model-value="handleOutputEdited"
        />
        <v-alert
          v-if="generationPhase === 'rewriting'"
          class="mt-2"
          type="info"
          density="compact"
          variant="tonal"
        >
          {{ t('features.llm.info.rewritingSimilarCopy') }}
        </v-alert>
        <v-alert
          v-else-if="generationPhase === 'checking'"
          class="mt-2"
          type="info"
          density="compact"
          variant="tonal"
        >
          {{ t('features.llm.info.checkingSimilarity') }}
        </v-alert>
      </v-sheet>
    </v-form>
  </div>
</template>

<script lang="ts" setup>
import { computed, h, onBeforeUnmount, ref, toRaw } from 'vue'
import { useTranslation } from 'i18next-vue'
import { useToast } from 'vue-toastification'
import ActionToastEmbed from '@/components/ActionToastEmbed.vue'
import { copyErrorToClipboard } from '@/lib/error-copy'
import { generateDiverseCopywriting, type GenerationPhase } from '@/lib/llm/generate-diverse'
import { generateCopywriting } from '@/lib/llm/generate'
import { estimateSpeechSeconds, isDurationOnTarget } from '@/lib/preflight'
import { buildPlatformGuidance } from '@/lib/llm/platform-rules'
import { getErrorDetail } from '@/lib/llm/security'
import type { LlmConfig } from '@/lib/llm/types'
import { useAppStore } from '@/store'
import type { GenerationUsageSummary } from '~/electron/analytics-types'
import { createAnalyticsOperationId, trackAnalytics } from '@/lib/analytics'

const toast = useToast()
const appStore = useAppStore()
const { t } = useTranslation()
defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ 'open-model-settings': []; 'history-updated': [] }>()

const outputText = ref('')
const abortController = ref<AbortController | null>(null)
const latestGenerationAnalytics = ref<GenerationUsageSummary>({
  source: 'unknown',
  providerCategory: 'unknown',
  callCount: 0,
  usageComplete: false,
})
const requestId = ref(0)
const generationPhase = ref<GenerationPhase | null>(null)
const platformItems = computed(() => [
  { title: t('features.agent.platforms.douyin'), value: 'douyin' },
  { title: t('features.agent.platforms.xiaohongshu'), value: 'xiaohongshu' },
  { title: t('features.agent.platforms.kuaishou'), value: 'kuaishou' },
  { title: t('features.agent.platforms.wechatChannels'), value: 'wechat-channels' },
  { title: t('features.agent.platforms.bilibili'), value: 'bilibili' },
  { title: t('features.agent.platforms.tiktok'), value: 'tiktok' },
  { title: t('features.agent.platforms.youtubeShorts'), value: 'youtube-shorts' },
  { title: t('features.agent.platforms.general'), value: 'general' },
])
const statusLabel = computed(() => t(`features.llm.status.${appStore.copywritingStatus}`))
const videoTypeItems = computed(() => [
  { title: t('features.agent.videoTypes.feature'), value: 'feature' },
  { title: t('features.agent.videoTypes.painpoint'), value: 'painpoint' },
  { title: t('features.agent.videoTypes.review'), value: 'review' },
  { title: t('features.agent.videoTypes.story'), value: 'story' },
  { title: t('features.agent.videoTypes.other'), value: 'other' },
])
const hookTypeItems = computed(() => [
  { title: t('features.agent.hookTypes.contrarian'), value: 'contrarian' },
  { title: t('features.agent.hookTypes.painpoint'), value: 'painpoint' },
  { title: t('features.agent.hookTypes.result'), value: 'result' },
  { title: t('features.agent.hookTypes.identity'), value: 'identity' },
  { title: t('features.agent.hookTypes.number'), value: 'number' },
  { title: t('features.agent.hookTypes.suspense'), value: 'suspense' },
])
// 提示词分三段：平台规则（硬约束）、本次创作上下文（类型/关键词）、用户的需求正文
const buildPromptWithContext = (brief: string) => {
  const lines: string[] = []
  const typeLabel = videoTypeItems.value.find(
    (item) => item.value === (appStore.videoType ?? ''),
  )?.title
  if (typeLabel) lines.push(`${t('features.agent.videoType')}：${typeLabel}`)
  const keywords = String(appStore.productKeywords ?? '').trim()
  if (keywords) lines.push(`${t('features.agent.productKeywords')}：${keywords}`)
  const platformGuidance = buildPlatformGuidance({
    platform: appStore.agentPlatform,
    durationSeconds: Number(appStore.agentTargetDurationSeconds) || 0,
    hook: appStore.hookType,
    hookLabel: hookTypeItems.value.find((item) => item.value === appStore.hookType)?.title,
  })
  // 素材分析结论放在上下文段，模型会把“画面里有什么”当成写作前提，避免编造没拍到的内容。
  const analysisContext = String(appStore.materialAnalysisContext ?? '').trim()
  if (analysisContext) {
    lines.push(`${t('features.agent.materialContext')}：`)
    lines.push(analysisContext)
  }
  return [platformGuidance, lines.join('\n'), brief.trim()].filter(Boolean).join('\n\n')
}

const showError = (message: string, error: unknown, llmConfig?: LlmConfig) => {
  const detail = getErrorDetail(error, llmConfig)
  toast.error({
    component: {
      render: () =>
        h(ActionToastEmbed, {
          message,
          detail,
          actionText: t('common.buttons.copyErrorDetail'),
          onActionTirgger: async () => {
            await copyErrorToClipboard(message, detail)
            toast.success(t('common.messages.success.copySuccess'))
          },
        }),
    },
  })
}

const getProviderCategory = (protocol: LlmConfig['protocol']) =>
  protocol === 'anthropic-messages'
    ? 'anthropic'
    : protocol === 'openai-compatible'
      ? 'compatible'
      : 'openai'

const getErrorCode = (error: unknown) => {
  const candidate = error as { name?: string; code?: string; message?: string }
  const value =
    `${candidate?.name ?? ''} ${candidate?.code ?? ''} ${candidate?.message ?? ''}`.toLowerCase()
  if (/timed out|timeout|etimedout/.test(value)) return 'network_timeout'
  if (/enotfound|econnrefused|networkerror|failed to fetch/.test(value))
    return 'network_unreachable'
  if (/401|403|unauthorized|forbidden/.test(value)) return 'authentication_failed'
  if (/429|rate.?limit/.test(value)) return 'rate_limited'
  return 'unknown'
}

const getTextLengthBucket = (length: number) => {
  if (length < 100) return '<100'
  if (length < 500) return '100–499'
  if (length < 1000) return '500–999'
  if (length < 2000) return '1000–1999'
  return '≥2000'
}

const handleGenerate = async (options?: {
  noToast?: boolean
  throwOnError?: boolean
  source?: 'standalone' | 'pipeline'
  promptOverride?: string
  allowEmptyPrompt?: boolean
}) => {
  const generationPrompt = buildPromptWithContext(options?.promptOverride ?? appStore.prompt)
  if (!generationPrompt.trim() && !options?.allowEmptyPrompt) {
    const error = new Error(t('features.llm.errors.promptRequired') as string)
    if (!options?.noToast) toast.warning(error.message)
    if (options?.throwOnError) throw error
    return ''
  }
  if (appStore.copywritingStatus === 'generating') return ''
  const currentRequestId = ++requestId.value
  const controller = new AbortController()
  abortController.value = controller
  const requestConfig = structuredClone(toRaw(appStore.llmConfig))
  const startedAt = performance.now()
  let outcome: 'success' | 'failed' | 'cancelled' = 'failed'
  let failureCode = 'unknown'
  let requestCount = 0
  let usageCount = 0
  let inputTokens = 0
  let outputTokens = 0
  let inputTokensKnown = true
  let outputTokensKnown = true
  const operationId = createAnalyticsOperationId()
  outputText.value = ''
  appStore.updateCopywritingStatus('generating')
  try {
    const result = await generateDiverseCopywriting({
      llmConfig: requestConfig,
      copywritingConfig: structuredClone(toRaw(appStore.copywritingConfig)),
      prompt: generationPrompt,
      abortSignal: controller.signal,
      onPhase: (phase) => {
        if (currentRequestId === requestId.value) generationPhase.value = phase
      },
      onTextDelta: (delta) => {
        if (currentRequestId === requestId.value) outputText.value += delta
      },
      onRequestStart: () => {
        requestCount += 1
      },
      onUsage: (usage) => {
        usageCount += 1
        if (usage.inputTokens === undefined) inputTokensKnown = false
        else inputTokens += usage.inputTokens
        if (usage.outputTokens === undefined) outputTokensKnown = false
        else outputTokens += usage.outputTokens
      },
    })
    if (currentRequestId !== requestId.value) return ''
    let finalText = result.text
    const targetSeconds = Number(appStore.agentTargetDurationSeconds)
    if (result.status === 'completed' && targetSeconds > 0 && !isDurationOnTarget(estimateSpeechSeconds(finalText), targetSeconds)) {
      generationPhase.value = 'rewriting'
      try {
        const rewritten = await generateCopywriting({
          llmConfig: requestConfig,
          copywritingConfig: structuredClone(toRaw(appStore.copywritingConfig)),
          prompt: `${generationPrompt}\n\n请将下面的口播文案改写到约 ${targetSeconds} 秒。保留用户要求、关键信息与事实，不添加未经证实的内容。只输出完整口播正文。\n\n原文：\n${finalText}`,
          abortSignal: controller.signal,
          onRequestStart: () => { requestCount += 1 },
          onUsage: (usage) => {
            usageCount += 1
            if (usage.inputTokens === undefined) inputTokensKnown = false
            else inputTokens += usage.inputTokens
            if (usage.outputTokens === undefined) outputTokensKnown = false
            else outputTokens += usage.outputTokens
          },
        })
        if (currentRequestId !== requestId.value || controller.signal.aborted) return ''
        if (rewritten.status === 'completed' && rewritten.text.trim() &&
          Math.abs(estimateSpeechSeconds(rewritten.text) - targetSeconds) < Math.abs(estimateSpeechSeconds(finalText) - targetSeconds)) finalText = rewritten.text
      } catch (error) {
        if (controller.signal.aborted) throw error
      }
      if (!isDurationOnTarget(estimateSpeechSeconds(finalText), targetSeconds) && !options?.noToast)
        toast.warning(t('features.llm.info.durationMismatch'))
    }
    outputText.value = finalText
    appStore.updateCopywritingStatus(result.status)
    emit('history-updated')
    if (result.similarityWarning && !options?.noToast)
      toast.warning(
        t(
          result.rewriteFailed
            ? 'features.llm.info.similarityRewriteFailed'
            : 'features.llm.info.similarityRemains',
        ),
      )
    if (result.status !== 'completed') {
      outcome = result.status === 'cancelled' ? 'cancelled' : 'failed'
      if (result.status === 'truncated') failureCode = 'invalid_response'
      else if (result.status === 'failed') failureCode = 'empty_output'
      const error = new Error(t(`features.llm.errors.${result.status}`) as string)
      if (options?.throwOnError) throw error
      if (result.status !== 'cancelled' && !options?.noToast)
        showError(t('features.llm.errors.generateFailed') as string, error, requestConfig)
      return ''
    }
    outcome = 'success'
    return finalText
  } catch (error) {
    if (currentRequestId !== requestId.value) return ''
    outcome = controller.signal.aborted ? 'cancelled' : 'failed'
    if (outcome === 'failed') failureCode = getErrorCode(error)
    if (String(appStore.copywritingStatus) === 'generating')
      appStore.updateCopywritingStatus('failed')
    const sanitizedError = new Error(getErrorDetail(error, requestConfig))
    if (!options?.noToast && appStore.copywritingStatus !== 'cancelled')
      showError(t('features.llm.errors.generateFailed') as string, sanitizedError, requestConfig)
    if (options?.throwOnError) throw sanitizedError
    return ''
  } finally {
    if (currentRequestId === requestId.value) {
      latestGenerationAnalytics.value = {
        source: 'generated',
        protocol: requestConfig.protocol,
        providerCategory: getProviderCategory(requestConfig.protocol),
        callCount: requestCount,
        ...(inputTokensKnown && usageCount > 0 ? { inputTokens } : {}),
        ...(outputTokensKnown && usageCount > 0 ? { outputTokens } : {}),
        usageComplete:
          requestCount > 0 && usageCount === requestCount && inputTokensKnown && outputTokensKnown,
      }
      if (options?.source !== 'pipeline') {
        const data: Record<string, string | number | boolean> = {
          operation_id: operationId,
          outcome,
          duration_ms: Math.max(0, Math.floor(performance.now() - startedAt)),
          provider_category: getProviderCategory(requestConfig.protocol),
          protocol: requestConfig.protocol,
          llm_call_count: requestCount,
          llm_usage_complete:
            requestCount > 0 &&
            usageCount === requestCount &&
            inputTokensKnown &&
            outputTokensKnown,
          text_length_bucket: getTextLengthBucket(outputText.value.length),
        }
        if (inputTokensKnown && usageCount > 0) data.input_tokens = inputTokens
        if (outputTokensKnown && usageCount > 0) data.output_tokens = outputTokens
        if (outcome === 'failed') data.error_code = failureCode
        trackAnalytics('text_generation_finished', data)
      }
      abortController.value = null
      generationPhase.value = null
    }
  }
}
const handleStopGenerate = () => abortController.value?.abort()
const handleOutputEdited = () =>
  appStore.updateCopywritingStatus(outputText.value.trim() ? 'edited' : 'idle')
const getTextForSynthesis = async (options?: {
  forceGenerate?: boolean
  promptOverride?: string
}) => {
  if (
    !options?.forceGenerate &&
    (appStore.copywritingStatus === 'completed' || appStore.copywritingStatus === 'edited')
  ) {
    latestGenerationAnalytics.value = {
      source: appStore.copywritingStatus === 'edited' ? 'edited' : 'reused',
      providerCategory: 'unknown',
      callCount: 0,
      usageComplete: false,
    }
    return outputText.value.trim()
  }
  if (
    options?.forceGenerate ||
    (appStore.copywritingStatus === 'idle' && !outputText.value.trim())
  ) {
    return handleGenerate({
      throwOnError: true,
      noToast: true,
      source: 'pipeline',
      promptOverride: options?.promptOverride,
      allowEmptyPrompt: Boolean(options?.promptOverride),
    })
  }
  throw new Error(t('features.llm.errors.textNotReady') as string)
}
const clearOutputText = () => {
  outputText.value = ''
  appStore.updateCopywritingStatus('idle')
}

onBeforeUnmount(() => {
  requestId.value += 1
  abortController.value?.abort()
})
defineExpose({
  handleGenerate,
  handleStopGenerate,
  getTextForSynthesis,
  getGenerationAnalytics: () => latestGenerationAnalytics.value,
  getCurrentOutputText: () => outputText.value,
  clearOutputText,
})
</script>

<style scoped lang="scss">
.creator-form {
  min-height: 0;
}

.creator-brief-panel,
.script-workspace-panel {
  border-color: rgba(var(--v-border-color), 0.82);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
}

.creator-panel-heading,
.script-panel-header {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.creator-panel-mark {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.creator-panel-title {
  font-size: 0.9rem;
  font-weight: 700;
}

.creator-panel-subtitle {
  margin-top: 0.12rem;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.69rem;
  line-height: 1.45;
}

.script-workspace-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: 0.6rem;
}

.script-panel-header {
  justify-content: space-between;
}

.script-editor {
  min-height: 0;
  flex: 1;
}

.script-editor :deep(.v-input__control),
.script-editor :deep(.v-field),
.script-editor :deep(.v-field__field),
.script-editor :deep(.v-field__input) {
  height: 100%;
}

.script-editor :deep(textarea) {
  min-height: 9rem;
  height: 100% !important;
  line-height: 1.7;
}

@media (max-width: 520px) {
  .creator-panel-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .creator-panel-heading > :last-child {
    margin-left: 46px;
  }

  .brief-input-row {
    flex-direction: column;
  }

  .brief-input-row > :last-child {
    flex-direction: row;
  }
}
</style>
