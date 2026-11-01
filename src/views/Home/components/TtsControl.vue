<template>
  <div class="voice-workspace">
    <v-form class="voice-settings-grid" :disabled="disabled">
      <v-sheet class="voice-settings-card" border rounded>
        <div class="voice-card-heading">
          <div class="voice-card-mark"><v-icon>mdi-cloud-cog-outline</v-icon></div>
          <div>
            <div class="voice-card-title">{{ t('features.workspace.voiceServiceTitle') }}</div>
            <div class="voice-card-hint">{{ t('features.workspace.voiceServiceHint') }}</div>
          </div>
        </div>
        <v-select
          v-model="appStore.ttsProvider"
          density="comfortable"
          :label="t('features.tts.config.provider')"
          :items="providerItems"
          item-title="label"
          item-value="value"
          hide-details
        />
      </v-sheet>

      <v-sheet class="voice-settings-card" border rounded>
        <div class="voice-card-heading">
          <div class="voice-card-mark"><v-icon>mdi-account-voice</v-icon></div>
          <div>
            <div class="voice-card-title">{{ t('features.workspace.voiceSelectionTitle') }}</div>
            <div class="voice-card-hint">{{ t('features.workspace.voiceSelectionHint') }}</div>
          </div>
        </div>
        <template v-if="appStore.ttsProvider !== 'minimax'">
          <div class="voice-field-grid">
          <v-combobox
            v-model="appStore.language"
            density="comfortable"
            :label="t('features.tts.config.language')"
            :items="appStore.languageList"
            :no-data-text="t('common.states.noData')"
            @update:model-value="clearVoice"
          />
          <v-select
            v-model="appStore.gender"
            density="comfortable"
            :label="t('features.tts.config.gender')"
            :items="genderItems"
            item-title="label"
            item-value="value"
            @update:model-value="clearVoice"
          />
          </div>
          <v-select
            v-model="appStore.voice"
            density="comfortable"
            :label="t('features.tts.config.voice')"
            :items="filteredVoicesList"
            item-title="FriendlyName"
            return-object
            :no-data-text="t('features.tts.config.selectLanguageGenderFirst')"
          />
        </template>
        <template v-else>
          <div class="minimax-voice-toolbar">
            <v-btn
            prepend-icon="mdi-refresh"
            size="large"
            :loading="minimaxVoicesLoading"
            :disabled="!appStore.minimaxTtsApiKey?.trim()"
            @click="handleLoadMiniMaxVoices"
            >
              {{ t('features.tts.config.loadMiniMaxVoices') }}
            </v-btn>
            <span class="text-caption text-medium-emphasis">{{ minimaxSystemVoices.length }}</span>
          </div>
          <div class="voice-field-grid">
          <v-select
            v-model="minimaxVoiceLanguageFilter"
            density="comfortable"
            :label="t('features.tts.config.minimaxVoiceLanguage')"
            :items="minimaxVoiceLanguageItems"
            item-title="label"
            item-value="value"
            :disabled="minimaxSystemVoices.length === 0"
          />
          <v-text-field
            v-model="minimaxVoiceSearch"
            density="comfortable"
            :label="t('features.tts.config.minimaxVoiceSearch')"
            prepend-inner-icon="mdi-magnify"
            clearable
            :disabled="minimaxSystemVoices.length === 0"
          />
          </div>
          <v-autocomplete
            v-model="appStore.minimaxTtsVoiceId"
            density="comfortable"
            :label="t('features.tts.config.minimaxVoice')"
            :items="filteredMiniMaxVoices"
            item-title="voiceName"
            item-value="voiceId"
            :item-props="getMiniMaxVoiceItemProps"
            :disabled="minimaxSystemVoices.length === 0"
            :no-data-text="
              minimaxSystemVoices.length
                ? t('features.tts.config.minimaxVoiceNoMatches')
                : t('features.tts.config.minimaxVoiceListEmpty')
            "
            @update:model-value="updateMiniMaxVoiceName"
          />
          <div class="text-caption text-medium-emphasis voice-selection-hint">
            {{ t('features.tts.config.minimaxPresetHint') }}
          </div>
          <div class="text-caption text-medium-emphasis voice-selection-hint">
            {{ t('features.tts.config.minimaxCaptionHint') }}
          </div>
        </template>
      </v-sheet>

      <v-sheet class="voice-settings-card voice-preview-card" border rounded>
        <div class="voice-card-heading">
          <div class="voice-card-mark"><v-icon>mdi-play-circle-outline</v-icon></div>
          <div>
            <div class="voice-card-title">{{ t('features.workspace.voicePreviewTitle') }}</div>
            <div class="voice-card-hint">{{ t('features.workspace.voicePreviewHint') }}</div>
          </div>
        </div>
        <div class="voice-preview-grid">
          <v-select
            v-model="appStore.speed"
            density="comfortable"
            :label="t('features.tts.config.speed')"
            :items="speedItems"
            item-title="label"
            item-value="value"
            hide-details
          />
          <v-text-field
            v-model="appStore.tryListeningText"
            density="comfortable"
            :label="t('features.tts.config.tryText')"
            hide-details
          />
        </div>
        <v-btn
          class="voice-preview-button"
          prepend-icon="mdi-volume-high"
          color="primary"
          variant="tonal"
          size="large"
          :loading="tryListeningLoading"
          :disabled="disabled"
          @click="handleTryListening"
        >
          {{ t('features.tts.config.tryListen') }}
        </v-btn>
      </v-sheet>
    </v-form>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, h, watch } from 'vue'
import { useAppStore } from '@/store'
import { useToast } from 'vue-toastification'
import { useTranslation } from 'i18next-vue'
import ActionToastEmbed from '@/components/ActionToastEmbed.vue'
import { formatErrorForCopy } from '@/lib/error-copy'
import { createAnalyticsOperationId, trackAnalytics } from '@/lib/analytics'

const toast = useToast()
const appStore = useAppStore()
const { t } = useTranslation()
const minimaxVoicesLoading = ref(false)
const minimaxSystemVoices = ref<
  Awaited<ReturnType<typeof window.electron.miniMaxTtsGetSystemVoices>>
>([])
const minimaxVoiceLanguageFilter = ref<'all' | 'chinese' | 'english' | 'other'>('all')
const minimaxVoiceSearch = ref<string | null>('')

defineProps<{
  disabled?: boolean
}>()

const configValid = (text?: string) => {
  if (appStore.ttsProvider === 'minimax' && !appStore.minimaxTtsApiKey?.trim()) {
    toast.warning(t('features.tts.config.minimaxApiKeyRequired'))
    return false
  }
  if (appStore.ttsProvider === 'minimax' && !appStore.minimaxTtsVoiceId?.trim()) {
    toast.warning(t('features.tts.config.minimaxVoiceRequired'))
    return false
  }
  if (
    appStore.ttsProvider === 'minimax' &&
    minimaxSystemVoices.value.length > 0 &&
    !minimaxSystemVoices.value.some((voice) => voice.voiceId === appStore.minimaxTtsVoiceId)
  ) {
    toast.warning(t('features.tts.config.minimaxVoiceRequired'))
    return false
  }
  if (appStore.ttsProvider !== 'minimax' && !appStore.voice) {
    toast.warning(t('features.tts.config.selectVoiceWarning'))
    return false
  }

  if (!text?.trim()) {
    toast.warning(t('features.tts.config.tryTextEmptyWarning'))
    return false
  }

  return true
}

const validateSynthesisSettings = () => configValid('Agent 预检')

const tryListeningLoading = ref(false)
let synthesisRequestSequence = 0
let currentAudio: HTMLAudioElement | null = null
const providerItems = computed(() => [
  { label: t('features.tts.config.providerEdge'), value: 'edge' },
  { label: t('features.tts.config.providerMiniMax'), value: 'minimax' },
])
const minimaxVoiceLanguageItems = computed(() => [
  { label: t('features.tts.config.minimaxVoiceLanguageAll'), value: 'all' },
  { label: t('features.tts.config.minimaxVoiceLanguageChinese'), value: 'chinese' },
  { label: t('features.tts.config.minimaxVoiceLanguageEnglish'), value: 'english' },
  { label: t('features.tts.config.minimaxVoiceLanguageOther'), value: 'other' },
])

const getMiniMaxVoiceLanguage = (voice: (typeof minimaxSystemVoices.value)[number]) => {
  const voiceText = [voice.voiceId, voice.voiceName, voice.description].join(' ')
  if (/(english|英语|英文|american|british|australian|canadian|irish)/iu.test(voiceText)) {
    return 'english'
  }
  if (/(chinese|mandarin|中文|普通话|粤语|cantonese|yue)/iu.test(voiceText)) {
    return 'chinese'
  }
  return 'other'
}

const filteredMiniMaxVoices = computed(() => {
  const search = minimaxVoiceSearch.value?.trim().toLocaleLowerCase() ?? ''
  return minimaxSystemVoices.value.filter((voice) => {
    const voiceText = [voice.voiceId, voice.voiceName, voice.description]
      .join(' ')
      .toLocaleLowerCase()
    const matchesSearch = !search || voiceText.includes(search)
    const matchesLanguage =
      minimaxVoiceLanguageFilter.value === 'all' ||
      getMiniMaxVoiceLanguage(voice) === minimaxVoiceLanguageFilter.value
    return matchesSearch && matchesLanguage
  })
})

const resetMiniMaxVoices = () => {
  minimaxSystemVoices.value = []
  minimaxVoiceLanguageFilter.value = 'all'
  minimaxVoiceSearch.value = ''
  appStore.minimaxTtsVoiceId = ''
  appStore.minimaxTtsVoiceName = ''
}

watch(
  () => [appStore.minimaxTtsApiKey, appStore.minimaxTtsApiRegion],
  resetMiniMaxVoices,
)

const handleLoadMiniMaxVoices = async () => {
  if (!appStore.minimaxTtsApiKey?.trim()) {
    toast.warning(t('features.tts.config.minimaxApiKeyRequired'))
    return
  }

  minimaxVoicesLoading.value = true
  try {
    const voices = await window.electron.miniMaxTtsGetSystemVoices({
      apiKey: appStore.minimaxTtsApiKey,
      apiRegion: appStore.minimaxTtsApiRegion,
    })
    minimaxSystemVoices.value = voices
    if (!voices.length) {
      appStore.minimaxTtsVoiceId = ''
      appStore.minimaxTtsVoiceName = ''
      toast.warning(t('features.tts.config.minimaxVoiceListEmpty'))
      return
    }

    const selectedVoice =
      voices.find((voice) => voice.voiceId === appStore.minimaxTtsVoiceId) ??
      voices.find((voice) => /mandarin|chinese/i.test(voice.voiceId + ' ' + voice.description)) ??
      voices[0]
    appStore.minimaxTtsVoiceId = selectedVoice.voiceId
    appStore.minimaxTtsVoiceName = selectedVoice.voiceName
    toast.success(t('features.tts.config.minimaxVoicesLoaded', { count: voices.length }))
  } catch (error: any) {
    const errorMessage = error?.error?.message || error?.message || error
    toast.error(t('features.tts.errors.minimaxVoiceListFailed') + ': ' + String(errorMessage))
  } finally {
    minimaxVoicesLoading.value = false
  }
}

const updateMiniMaxVoiceName = (voiceId: string | null) => {
  appStore.minimaxTtsVoiceName =
    minimaxSystemVoices.value.find((voice) => voice.voiceId === voiceId)?.voiceName ?? ''
}

const getMiniMaxVoiceItemProps = (voice: (typeof minimaxSystemVoices.value)[number]) => ({
  subtitle: voice.description,
})

const handleTryListening = async () => {
  if (!configValid(appStore.tryListeningText)) return

  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  tryListeningLoading.value = true
  const startedAt = performance.now()
  const operationId = createAnalyticsOperationId()
  let analyticsReported = false
  try {
    const speech =
      appStore.ttsProvider === 'minimax'
        ? await window.electron.miniMaxTtsSynthesizeToBase64({
            apiKey: appStore.minimaxTtsApiKey,
            apiRegion: appStore.minimaxTtsApiRegion,
            text: appStore.tryListeningText,
            voiceId: appStore.minimaxTtsVoiceId,
            speed: 1 + appStore.speed / 100,
          })
        : await window.electron.edgeTtsSynthesizeToBase64({
            text: appStore.tryListeningText,
            voice: appStore.voice!.ShortName,
            options: {
              rate: appStore.speed,
            },
          })
    trackAnalytics('tts_preview_finished', {
      operation_id: operationId,
      outcome: 'success',
      duration_ms: Math.max(0, Math.floor(performance.now() - startedAt)),
      tts_characters: appStore.tryListeningText.length,
    })
    analyticsReported = true
    currentAudio = new Audio(`data:audio/mp3;base64,${speech}`)
    currentAudio.play()
    toast.info(t('features.tts.info.playTryAudio'))
  } catch (error: any) {
    if (!analyticsReported) {
      trackAnalytics('tts_preview_finished', {
        operation_id: operationId,
        outcome: 'failed',
        duration_ms: Math.max(0, Math.floor(performance.now() - startedAt)),
        tts_characters: appStore.tryListeningText.length,
        error_code: 'unknown',
      })
    }
    console.log('试听语音合成失败', error)
    const errorMessage = error?.error?.message || error?.message || error
    toast.error({
      component: {
        // 使用vnode方式创建自定义错误弹窗实例，以获得良好的类型提示
        render: () =>
          h(ActionToastEmbed, {
            message: t('features.tts.errors.trySynthesisNetwork'),
            detail: String(errorMessage),
            actionText: t('common.buttons.copyErrorDetail'),
            onActionTirgger: () => {
              navigator.clipboard.writeText(
                formatErrorForCopy(
                  t('features.tts.errors.trySynthesisNetwork'),
                  String(errorMessage),
                ),
              )
              toast.success(t('common.messages.success.copySuccess'))
            },
          }),
      },
    })
  } finally {
    tryListeningLoading.value = false
  }
}
const clearVoice = () => {
  appStore.voice = null
}

const filteredVoicesList = computed(() => {
  if (!appStore.language || !appStore.gender) return []
  return appStore.originalVoicesList.filter(
    (voice) => voice.FriendlyName.includes(appStore.language!) && voice.Gender === appStore.gender,
  )
})

const genderItems = computed(() => {
  return [
    { label: t('features.tts.config.genderMale'), value: 'Male' },
    { label: t('features.tts.config.genderFemale'), value: 'Female' },
  ]
})

const speedItems = computed(() => {
  return [
    { label: t('features.tts.config.speedSlow'), value: -30 },
    { label: t('features.tts.config.speedMedium'), value: 0 },
    { label: t('features.tts.config.speedFast'), value: 30 },
  ]
})

const fetchVoices = async () => {
  try {
    appStore.originalVoicesList = await window.electron.edgeTtsGetVoiceList()
    console.info('EdgeTTS语音列表已更新', { voiceCount: appStore.originalVoicesList.length })
  } catch (error: any) {
    console.log('获取EdgeTTS语音列表失败', error)
    const errorMessage = error?.error?.message || error?.message || error
    toast.error({
      component: {
        // 使用vnode方式创建自定义错误弹窗实例，以获得良好的类型提示
        render: () =>
          h(ActionToastEmbed, {
            message: t('features.tts.errors.fetchVoicesFailed'),
            detail: String(errorMessage),
            actionText: t('common.buttons.copyErrorDetail'),
            onActionTirgger: () => {
              navigator.clipboard.writeText(
                formatErrorForCopy(
                  t('features.tts.errors.fetchVoicesFailed'),
                  String(errorMessage),
                ),
              )
              toast.success(t('common.messages.success.copySuccess'))
            },
          }),
      },
    })
  }
}
onMounted(async () => {
  await fetchVoices()
  if (!appStore.originalVoicesList.find((voice) => voice.Name === appStore.voice?.Name)) {
    appStore.voice = null
  }
})

onUnmounted(() => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }
})

const synthesizedSpeechToFile = async (option: {
  text: string
  withCaption?: boolean
  abortSignal?: AbortSignal
}) => {
  if (!configValid(option.text)) throw new Error(t('features.tts.errors.configInvalid'))
  if (option.abortSignal?.aborted) {
    const error = new Error('语音合成已取消')
    error.name = 'AbortError'
    throw error
  }

  const requestId = 'tts-' + Date.now() + '-' + ++synthesisRequestSequence
  const provider = appStore.ttsProvider === 'minimax' ? 'minimax' : 'edge'
  const onAbort = () =>
    window.ipcRenderer.send(
      provider === 'minimax' ? 'cancel-minimax-tts-synthesis' : 'cancel-edge-tts-synthesis',
      requestId,
    )
  option.abortSignal?.addEventListener('abort', onAbort, { once: true })

  try {
    const result =
      provider === 'minimax'
        ? await window.electron.miniMaxTtsSynthesizeToFile({
            apiKey: appStore.minimaxTtsApiKey,
            apiRegion: appStore.minimaxTtsApiRegion,
            text: option.text,
            voiceId: appStore.minimaxTtsVoiceId,
            speed: 1 + appStore.speed / 100,
            withCaption: option?.withCaption,
            requestId,
          })
        : await window.electron.edgeTtsSynthesizeToFile({
            text: option.text,
            voice: appStore.voice!.ShortName,
            options: {
              rate: appStore.speed,
            },
            withCaption: option?.withCaption,
            requestId,
          })
    if (option.abortSignal?.aborted) {
      const error = new Error('语音合成已取消')
      error.name = 'AbortError'
      throw error
    }
    return result
  } catch (error) {
    if (option.abortSignal?.aborted || (error as { name?: string })?.name === 'AbortError') {
      const abortError = new Error('语音合成已取消')
      abortError.name = 'AbortError'
      throw abortError
    }
    console.log('语音合成失败', error)
    throw new Error(t('features.tts.errors.synthesisFailed') + ' ' + String(error))
  } finally {
    option.abortSignal?.removeEventListener('abort', onAbort)
  }
}

defineExpose({ synthesizedSpeechToFile, validateSynthesisSettings })
</script>

<style lang="scss" scoped>
.voice-workspace,
.voice-settings-grid {
  min-width: 0;
}

.voice-settings-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.voice-settings-card {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  border-color: rgba(var(--v-border-color), 0.82);
  box-shadow: 0 9px 24px rgba(15, 23, 42, 0.03);
}

.voice-card-heading {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-bottom: 0.1rem;
}

.voice-card-mark {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.voice-card-title {
  font-size: 0.86rem;
  font-weight: 700;
}

.voice-card-hint {
  margin-top: 0.12rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.68rem;
  line-height: 1.4;
}

.voice-field-grid,
.voice-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.minimax-voice-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.voice-selection-hint {
  line-height: 1.45;
}

.voice-preview-card {
  gap: 0.9rem;
}

.voice-preview-grid {
  grid-template-columns: minmax(150px, 0.7fr) minmax(0, 1.3fr);
}

.voice-preview-button {
  align-self: flex-start;
  min-width: 180px;
}

@media (max-width: 560px) {
  .voice-field-grid,
  .voice-preview-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .voice-preview-button {
    width: 100%;
  }
}
</style>
