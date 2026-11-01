import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EdgeTTSVoice } from '~/electron/lib/edge-tts'
import {
  defaultCopywritingConfig,
  defaultLlmConfig,
  normalizeCopywritingConfig,
  normalizeLlmConfig,
} from '@/lib/llm/config'
import type { CopywritingStatus, LlmConfig } from '@/lib/llm/types'
import { normalizeBatchConfig, type BatchRunState } from '@/lib/batch'
import type { MiniMaxApiRegion } from '~/electron/tts/types'

export enum RenderStatus {
  None,
  GenerateText,
  SynthesizedSpeech,
  SegmentVideo,
  Rendering,
  Completed,
  Failed,
  AnalyzeMaterials,
}

export type AgentPlatform =
  | 'douyin'
  | 'xiaohongshu'
  | 'kuaishou'
  | 'wechat-channels'
  | 'bilibili'
  | 'tiktok'
  | 'youtube-shorts'
  | 'general'

export interface VideoAssetFolder {
  path: string
  enabled: boolean
}

export const useAppStore = defineStore(
  'app',
  () => {
    // 国际化区域设置
    const locale = ref('')
    const updateLocale = (newLocale: string) => {
      locale.value = newLocale
    }

    // 大模型文案生成
    const prompt = ref('')
    const llmConfig = ref<LlmConfig>(defaultLlmConfig())
    const analysisLlmConfig = ref<LlmConfig>(defaultLlmConfig())
    const analysisUsesCopywritingModel = ref(true)
    const copywritingConfig = ref(defaultCopywritingConfig())
    const copywritingStatus = ref<CopywritingStatus>('idle')
    const updateLLMConfig = (newConfig: LlmConfig) => {
      llmConfig.value = normalizeLlmConfig(newConfig)
    }
    const updateAnalysisLLMConfig = (newConfig: LlmConfig) => {
      analysisLlmConfig.value = normalizeLlmConfig(newConfig)
    }
    const updateCopywritingConfig = (newConfig: typeof copywritingConfig.value) => {
      copywritingConfig.value = normalizeCopywritingConfig(newConfig)
    }
    const updateCopywritingStatus = (newStatus: CopywritingStatus) => {
      copywritingStatus.value = newStatus
    }

    // 视频素材管理
    const videoAssetsFolder = ref('')
    const videoAssetFolders = ref<VideoAssetFolder[]>([])
    const videoExportFolder = ref('')

    // 自动创作 Agent
    const agentPlatform = ref<AgentPlatform>('douyin')
    const agentTargetDurationSeconds = ref(30)

    // 语音合成
    const ttsProvider = ref<'edge' | 'minimax'>('edge')
    const minimaxTtsApiKey = ref('')
    const minimaxTtsApiRegion = ref<MiniMaxApiRegion>('china')
    const minimaxTtsVoiceId = ref('')
    const minimaxTtsVoiceName = ref('')
    const originalVoicesList = ref<EdgeTTSVoice[]>([])
    const languageList = computed(() => {
      return originalVoicesList.value
        .map((voice) => voice.FriendlyName.split(' - ').pop()?.split(' (').shift())
        .filter((language) => !!language)
        .filter((language, index, arr) => arr.indexOf(language) === index)
    })
    const genderList = ref([
      { label: '男性', value: 'Male' },
      { label: '女性', value: 'Female' },
      // { label: '中性', value: 'Neutral' },
    ])
    const speedList = ref([
      { label: '慢', value: -30 },
      { label: '中', value: 0 },
      { label: '快', value: 30 },
    ])
    const language = ref<string>()
    const gender = ref<string>()
    const voice = ref<EdgeTTSVoice | null>(null)
    const speed = ref(0)
    const tryListeningText = ref('Hello，欢迎使用短视频工厂！')

    // 合成配置
    const renderConfig = ref({
      bgmPath: '',
      outputSize: { width: 1080, height: 1920 },
      outputPath: '',
      outputFileName: '',
      outputFileExt: '.mp4',
      subtitlesEnabled: true,
      exportSubtitles: false,
    })
    const autoBatch = ref(false)
    const batchConfig = ref({ count: 10, onError: 'stop' as 'stop' | 'continue' })
    const batchProgress = ref<BatchRunState | null>(null)
    const renderStatus = ref(RenderStatus.None)
    const updateRenderConfig = (
      newConfig: Omit<typeof renderConfig.value, 'subtitlesEnabled' | 'exportSubtitles'> &
        Partial<Pick<typeof renderConfig.value, 'subtitlesEnabled' | 'exportSubtitles'>>,
    ) => {
      renderConfig.value = {
        ...newConfig,
        outputSize: { ...newConfig.outputSize },
        subtitlesEnabled: newConfig.subtitlesEnabled !== false,
        exportSubtitles: newConfig.exportSubtitles === true,
      }
    }
    const updateRenderStatus = (newStatus: RenderStatus) => {
      renderStatus.value = newStatus
    }

    // 缩放倍率配置
    const zoomOptions = [0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]
    const zoomFactor = ref(1.0)
    const updateZoomFactor = (factor: number) => {
      zoomFactor.value = factor
    }

    return {
      locale,
      updateLocale,

      prompt,
      llmConfig,
      analysisLlmConfig,
      analysisUsesCopywritingModel,
      updateLLMConfig,
      updateAnalysisLLMConfig,
      copywritingConfig,
      updateCopywritingConfig,
      copywritingStatus,
      updateCopywritingStatus,

      videoAssetsFolder,
      videoAssetFolders,
      videoExportFolder,
      agentPlatform,
      agentTargetDurationSeconds,

      ttsProvider,
      minimaxTtsApiKey,
      minimaxTtsApiRegion,
      minimaxTtsVoiceId,
      minimaxTtsVoiceName,
      originalVoicesList,
      languageList,
      genderList,
      speedList,
      language,
      gender,
      voice,
      speed,
      tryListeningText,

      renderConfig,
      autoBatch,
      batchConfig,
      batchProgress,
      renderStatus,
      updateRenderConfig,
      updateRenderStatus,

      zoomOptions,
      zoomFactor,
      updateZoomFactor,
    }
  },
  {
    persist: {
      omit: [
        'genderList',
        'speedList',
        'autoBatch',
        'batchProgress',
        'renderStatus',
        'copywritingStatus',
      ],
      beforeHydrate: (context) => {
        // Pinia merges persisted state into default state before afterHydrate, so an old record
        // without protocol would otherwise inherit the new openai-compatible default. Seed the
        // migration target first; the subsequent nested patch keeps this protocol value.
        try {
          const serializedState = window.localStorage.getItem(context.store.$id)
          const persistedState = serializedState ? JSON.parse(serializedState) : undefined
          if (
            persistedState?.llmConfig &&
            typeof persistedState.llmConfig === 'object' &&
            !('protocol' in persistedState.llmConfig)
          ) {
            context.store.llmConfig.protocol = 'openai-chat'
          }
        } catch {
          // Let the persistence plugin retain its default state if legacy storage is malformed.
        }
      },
      afterHydrate: (context) => {
        if (!Array.isArray(context.store.videoAssetFolders)) {
          context.store.videoAssetFolders = []
        }
        if (context.store.videoAssetFolders.length === 0 && context.store.videoAssetsFolder?.trim()) {
          context.store.videoAssetFolders = [
            { path: context.store.videoAssetsFolder, enabled: true },
          ]
        }
        context.store.batchConfig = normalizeBatchConfig(context.store.batchConfig)
        context.store.updateRenderConfig(context.store.renderConfig)
        context.store.updateLLMConfig(context.store.llmConfig)
        context.store.updateAnalysisLLMConfig(context.store.analysisLlmConfig)
        context.store.updateCopywritingConfig(context.store.copywritingConfig)
      },
    },
  },
)
