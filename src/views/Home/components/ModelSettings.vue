<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-4">
      <header class="settings-page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="text-h5 font-semibold">
            {{ t(props.section === 'voice' ? 'features.modelSettings.ttsTitle' : 'features.modelSettings.title') }}
          </div>
          <div class="mt-1 text-body-2 text-medium-emphasis">
            {{ t(props.section === 'voice' ? 'features.modelSettings.ttsDescription' : 'features.modelSettings.description') }}
          </div>
        </div>
        <v-chip color="primary" variant="tonal" prepend-icon="mdi-content-save-outline">
          {{ t('features.modelSettings.localSaveHint') }}
        </v-chip>
      </header>

      <v-tabs v-if="props.section === 'models'" v-model="activeTab" color="primary" class="rounded-lg border" grow>
        <v-tab value="analysis" prepend-icon="mdi-image-search-outline">
          {{ t('features.modelSettings.analysisTab') }}
        </v-tab>
        <v-tab value="copywriting" prepend-icon="mdi-text-box-edit-outline">
          {{ t('features.modelSettings.copywritingTab') }}
        </v-tab>
        <v-tab value="tts" prepend-icon="mdi-waveform">
          {{ t('features.modelSettings.ttsTab') }}
        </v-tab>
      </v-tabs>

      <v-sheet v-if="props.section === 'models' && activeTab === 'analysis'" class="settings-panel p-4 md:p-6" border rounded>
        <div class="mb-4">
          <div class="text-h6">{{ t('features.modelSettings.analysisTitle') }}</div>
          <div class="mt-1 text-body-2 text-medium-emphasis">
            {{ t('features.modelSettings.analysisDescription') }}
          </div>
        </div>
        <v-switch
          v-model="appStore.analysisUsesCopywritingModel"
          color="primary"
          inset
          hide-details
          :disabled="props.disabled"
          :label="t('features.modelSettings.reuseCopywritingModel')"
        />
        <v-alert v-if="appStore.analysisUsesCopywritingModel" class="mt-3" type="info" variant="tonal" density="compact">
          {{ t('features.modelSettings.reuseCopywritingHint') }}
        </v-alert>
        <template v-else>
          <v-alert class="my-3" type="warning" variant="tonal" density="compact">
            {{ t('features.modelSettings.visionModelHint') }}
          </v-alert>
          <LlmConfigEditor v-model="analysisDraft" :disabled="props.disabled" />
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <v-btn color="primary" prepend-icon="mdi-content-save" :disabled="props.disabled" @click="saveAnalysisConfig">
              {{ t('common.buttons.save') }}
            </v-btn>
            <v-btn
              v-if="!testing"
              variant="tonal"
              color="success"
              :disabled="props.disabled"
              prepend-icon="mdi-connection"
              @click="testConfig(analysisDraft)"
            >
              {{ t('features.modelSettings.testConnection') }}
            </v-btn>
            <v-btn v-else color="error" variant="tonal" prepend-icon="mdi-stop" @click="cancelTest">
              {{ t('common.buttons.stop') }}
            </v-btn>
            <v-alert v-if="testResult" class="flex-1" :type="testResult === 'success' ? 'success' : 'error'" density="compact">
              {{ testResult === 'success' ? t('features.llm.success.connectionSucceeded') : t('features.llm.errors.connectionFailed') }}
            </v-alert>
          </div>
        </template>
      </v-sheet>

      <v-sheet v-if="props.section === 'models' && activeTab === 'copywriting'" class="settings-panel p-4 md:p-6" border rounded>
        <div class="mb-4">
          <div class="text-h6">{{ t('features.modelSettings.copywritingTitle') }}</div>
          <div class="mt-1 text-body-2 text-medium-emphasis">
            {{ t('features.modelSettings.copywritingDescription') }}
          </div>
        </div>
        <LlmConfigEditor v-model="copywritingDraft" :disabled="props.disabled" />
        <v-divider class="my-5" />
        <div class="mb-3 text-subtitle-1 font-weight-medium">
          {{ t('features.llm.config.copywritingTab') }}
        </div>
        <div class="flex flex-col gap-3">
          <v-select
            v-model="copywritingPromptDraft.systemPromptMode"
            :items="promptModeItems"
            item-title="title"
            item-value="value"
            :disabled="props.disabled"
            :label="t('features.llm.config.systemPromptMode')"
          />
          <div class="text-caption text-medium-emphasis">
            {{ systemPromptDescription }}
          </div>
          <v-textarea
            v-if="copywritingPromptDraft.systemPromptMode === 'custom'"
            v-model="copywritingPromptDraft.customSystemPrompt"
            :label="t('features.llm.config.customPrompt')"
            rows="5"
            auto-grow
            :disabled="props.disabled"
          >
            <template #append-inner>
              <v-btn
                size="x-small"
                variant="text"
                :disabled="props.disabled"
                @click="fillBuiltinPrompt"
              >
                {{ t('features.llm.config.fillBuiltin') }}
              </v-btn>
            </template>
          </v-textarea>
          <v-switch
            v-model="copywritingPromptDraft.diversityEnabled"
            color="primary"
            hide-details
            :disabled="props.disabled"
            :label="t('features.llm.config.diversityEnabled')"
          />
          <div class="text-caption text-medium-emphasis -mt-3">
            {{ t('features.llm.config.diversityDescription') }}
          </div>
          <v-switch
            v-model="copywritingPromptDraft.rewriteOnSimilarity"
            color="primary"
            hide-details
            :disabled="props.disabled || !copywritingPromptDraft.diversityEnabled"
            :label="t('features.llm.config.rewriteOnSimilarity')"
          />
          <div class="text-caption text-medium-emphasis -mt-3">
            {{ t('features.llm.config.rewriteDescription') }}
          </div>
        </div>
        <v-sheet class="mt-4 flex flex-wrap items-center justify-between gap-3 p-3" border rounded>
          <div class="text-body-2 text-medium-emphasis">
            {{ t('features.llm.config.historyCount', { count: historyTaskCount }) }}
          </div>
          <v-btn
            variant="text"
            color="error"
            prepend-icon="mdi-delete-sweep-outline"
            :disabled="props.disabled || historyTaskCount === 0"
            @click="clearHistory"
          >
            {{ t('features.llm.config.clearHistory') }}
          </v-btn>
        </v-sheet>
        <div class="mt-4 flex flex-wrap items-center gap-2">
          <v-btn color="primary" prepend-icon="mdi-content-save" :disabled="props.disabled" @click="saveCopywritingConfig">
            {{ t('common.buttons.save') }}
          </v-btn>
          <v-btn
            v-if="!testing"
            variant="tonal"
            color="success"
            :disabled="props.disabled"
            prepend-icon="mdi-connection"
            @click="testConfig(copywritingDraft)"
          >
            {{ t('features.modelSettings.testConnection') }}
          </v-btn>
          <v-btn v-else color="error" variant="tonal" prepend-icon="mdi-stop" @click="cancelTest">
            {{ t('common.buttons.stop') }}
          </v-btn>
          <v-alert v-if="testResult" class="flex-1" :type="testResult === 'success' ? 'success' : 'error'" density="compact">
            {{ testResult === 'success' ? t('features.llm.success.connectionSucceeded') : t('features.llm.errors.connectionFailed') }}
          </v-alert>
        </div>
      </v-sheet>

      <v-sheet v-if="props.section === 'models' && activeTab === 'tts'" class="settings-panel p-4 md:p-6" border rounded>
        <TtsConnectionSettings :disabled="props.disabled" />
      </v-sheet>

      <v-sheet v-show="props.section === 'voice'" class="settings-panel p-4 md:p-6" border rounded>
        <div class="max-w-3xl">
          <TtsControl ref="ttsControl" :disabled="props.disabled" />
        </div>
      </v-sheet>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { useToast } from 'vue-toastification'
import { useAppStore } from '@/store'
import {
  defaultCopywritingConfig,
  defaultLlmConfig,
  getLlmConfigIssue,
  normalizeCopywritingConfig,
  normalizeLlmConfig,
} from '@/lib/llm/config'
import { generateCopywriting } from '@/lib/llm/generate'
import { builtinSystemPrompt } from '@/lib/llm/prompts'
import { getErrorDetail } from '@/lib/llm/security'
import type { CopywritingConfig, LlmConfig, SystemPromptMode } from '@/lib/llm/types'
import { createAnalyticsOperationId, trackAnalytics } from '@/lib/analytics'
import { clearCopywritingHistory, getCopywritingHistoryTaskCount } from '@/store/copywriting-history'
import LlmConfigEditor from './LlmConfigEditor.vue'
import TtsControl from './TtsControl.vue'
import TtsConnectionSettings from './TtsConnectionSettings.vue'

type SettingsTab = 'analysis' | 'copywriting' | 'tts'
const props = defineProps<{ disabled?: boolean; section: 'models' | 'voice' }>()
const { t } = useTranslation()
const toast = useToast()
const appStore = useAppStore()
const activeTab = ref<SettingsTab>('analysis')
const analysisDraft = ref<LlmConfig>(
  structuredClone(toRaw(appStore.analysisLlmConfig ?? defaultLlmConfig())),
)
const copywritingDraft = ref<LlmConfig>(structuredClone(toRaw(appStore.llmConfig)))
const copywritingPromptDraft = ref<CopywritingConfig>(
  structuredClone(toRaw(appStore.copywritingConfig ?? defaultCopywritingConfig())),
)
const testing = ref(false)
const testResult = ref<'success' | 'error'>()
const ttsControl = ref<InstanceType<typeof TtsControl> | null>(null)
const historyRevision = ref(0)
let testController: AbortController | null = null

watch(
  () => props.section,
  (section) => {
    activeTab.value = section === 'voice' ? 'tts' : 'analysis'
  },
  { immediate: true },
)

const promptModeItems = computed(() => [
  { title: t('features.llm.config.builtin'), value: 'builtin' as SystemPromptMode },
  { title: t('features.llm.config.custom'), value: 'custom' as SystemPromptMode },
  { title: t('features.llm.config.off'), value: 'off' as SystemPromptMode },
])
const systemPromptDescription = computed(() => {
  const mode = copywritingPromptDraft.value.systemPromptMode
  const key = mode === 'custom' ? 'customDescription' : mode === 'off' ? 'offDescription' : 'builtinDescription'
  return t(`features.llm.config.${key}`)
})
const historyTaskCount = computed(() => {
  historyRevision.value
  return getCopywritingHistoryTaskCount()
})
const refreshHistoryCount = () => {
  historyRevision.value += 1
}
const clearHistory = () => {
  if (!window.confirm(t('features.llm.config.clearHistoryConfirm') as string)) return
  if (clearCopywritingHistory()) {
    historyRevision.value += 1
    toast.success(t('features.llm.success.historyCleared'))
  } else {
    toast.warning(t('features.llm.errors.historyClearFailed'))
  }
}
watch(
  () => copywritingPromptDraft.value.systemPromptMode,
  (mode, previous) => {
    if (mode === 'custom' && previous !== 'custom' && !copywritingPromptDraft.value.customSystemPrompt.trim()) {
      copywritingPromptDraft.value.customSystemPrompt = builtinSystemPrompt
    }
  },
)
watch([analysisDraft, copywritingDraft], () => {
  testResult.value = undefined
}, { deep: true })

const saveAnalysisConfig = () => {
  const issue = getLlmConfigIssue(analysisDraft.value)
  if (issue) {
    toast.warning(t('features.modelSettings.invalidConfig'))
    return
  }
  appStore.updateAnalysisLLMConfig(analysisDraft.value)
  toast.success(t('features.modelSettings.saved'))
}

const saveCopywritingConfig = () => {
  const issue = getLlmConfigIssue(copywritingDraft.value)
  if (issue) {
    toast.warning(t('features.modelSettings.invalidConfig'))
    return
  }
  if (
    copywritingPromptDraft.value.systemPromptMode === 'custom' &&
    !copywritingPromptDraft.value.customSystemPrompt.trim()
  ) {
    toast.warning(t('features.llm.errors.customPromptRequired'))
    return
  }
  appStore.updateLLMConfig(normalizeLlmConfig(copywritingDraft.value))
  appStore.updateCopywritingConfig(normalizeCopywritingConfig(copywritingPromptDraft.value))
  toast.success(t('features.modelSettings.saved'))
}

const fillBuiltinPrompt = () => {
  copywritingPromptDraft.value.customSystemPrompt = builtinSystemPrompt
}

const testConfig = async (config: LlmConfig) => {
  if (testing.value) {
    testController?.abort()
    return
  }
  const issue = getLlmConfigIssue(config)
  if (issue) {
    toast.warning(t('features.modelSettings.invalidConfig'))
    return
  }
  testResult.value = undefined
  testing.value = true
  const controller = new AbortController()
  testController = controller
  const requestConfig = normalizeLlmConfig(config)
  const operationId = createAnalyticsOperationId()
  const startedAt = performance.now()
  let outcome: 'success' | 'failed' | 'cancelled' = 'failed'
  let errorCode: string | undefined
  let callCount = 0
  let usageCount = 0
  let inputTokens = 0
  let outputTokens = 0
  let inputTokensKnown = true
  let outputTokensKnown = true
  try {
    const result = await generateCopywriting({
      llmConfig: requestConfig,
      copywritingConfig: { ...defaultCopywritingConfig(), systemPromptMode: 'off' },
      prompt: 'Reply with the words: connection successful.',
      abortSignal: controller.signal,
      onRequestStart: () => {
        callCount += 1
      },
      onUsage: (usage) => {
        usageCount += 1
        if (usage.inputTokens === undefined) inputTokensKnown = false
        else inputTokens += usage.inputTokens
        if (usage.outputTokens === undefined) outputTokensKnown = false
        else outputTokens += usage.outputTokens
      },
    })
    if (controller.signal.aborted || result.status === 'cancelled') {
      outcome = 'cancelled'
      return
    }
    if (result.status !== 'completed') throw new Error(result.status)
    testResult.value = 'success'
    outcome = 'success'
  } catch (error) {
    if (controller.signal.aborted) {
      outcome = 'cancelled'
      return
    }
    testResult.value = 'error'
    outcome = 'failed'
    errorCode = getProviderTestErrorCode(error)
    toast.error(`${t('features.llm.errors.connectionFailed')}: ${getErrorDetail(error, requestConfig)}`)
  } finally {
    if (testController === controller) {
      trackAnalytics('provider_test_finished', {
        operation_id: operationId,
        outcome,
        protocol: requestConfig.protocol,
        provider_category: getProviderCategory(requestConfig.protocol),
        ...(errorCode ? { error_code: errorCode } : {}),
        duration_ms: Math.max(0, Math.floor(performance.now() - startedAt)),
        llm_call_count: callCount,
        llm_usage_complete:
          callCount > 0 && usageCount === callCount && inputTokensKnown && outputTokensKnown,
        ...(inputTokensKnown && usageCount > 0 ? { input_tokens: inputTokens } : {}),
        ...(outputTokensKnown && usageCount > 0 ? { output_tokens: outputTokens } : {}),
      })
      testController = null
      testing.value = false
    }
  }
}
const getProviderCategory = (protocol: LlmConfig['protocol']) =>
  protocol === 'anthropic-messages'
    ? 'anthropic'
    : protocol === 'openai-compatible'
      ? 'compatible'
      : 'openai'
const getProviderTestErrorCode = (error: unknown) => {
  const candidate = error as { name?: string; code?: string; message?: string }
  const text = `${candidate?.name ?? ''} ${candidate?.code ?? ''} ${candidate?.message ?? ''}`.toLowerCase()
  if (/timed out|timeout|etimedout/.test(text)) return 'network_timeout'
  if (/enotfound|econnrefused|networkerror|failed to fetch/.test(text)) return 'network_unreachable'
  if (/401|403|unauthorized|forbidden/.test(text)) return 'authentication_failed'
  if (/429|rate.?limit/.test(text)) return 'rate_limited'
  return 'unknown'
}
const cancelTest = () => testController?.abort()
onBeforeUnmount(() => testController?.abort())

const selectTab = (tab: SettingsTab) => {
  activeTab.value = tab
}

defineExpose({
  selectTab,
  refreshHistoryCount,
  validateSynthesisSettings: () => ttsControl.value?.validateSynthesisSettings() ?? false,
  synthesizedSpeechToFile: (
    options: Parameters<InstanceType<typeof TtsControl>['synthesizedSpeechToFile']>[0],
  ) => {
    if (!ttsControl.value) throw new Error(t('features.modelSettings.ttsNotReady') as string)
    return ttsControl.value.synthesizedSpeechToFile(options)
  },
})
</script>
