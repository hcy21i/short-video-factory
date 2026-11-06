<template>
  <div class="w-full h-full flex flex-col">
    <div
      class="w-full h-[40px] relative border-b"
      :class="isMac ? 'title-bar' : 'window-drag'"
      @mousedown="handleTitleBarMouseDown"
      @dblclick="handleTitleBarDoubleClick"
    >
      <div class="window-control-bar-no-drag-mask" @mousedown.stop @dblclick.stop></div>
    </div>

    <div class="app-shell w-full h-0 flex-1 min-h-0 gap-3 px-3 pb-3 pt-2">
      <aside class="app-sidebar min-h-0 rounded-2xl border bg-surface">
        <div class="sidebar-brand">
          <div class="sidebar-brand-mark"><v-icon size="21">mdi-movie-open</v-icon></div>
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold">{{ t('features.workspace.brand') }}</div>
            <div class="truncate text-caption text-medium-emphasis">{{ t('features.workspace.brandHint') }}</div>
          </div>
        </div>

        <nav class="sidebar-nav-list" :aria-label="t('features.workspace.navigation')">
          <section v-for="group in navigationGroups" :key="group.id" class="sidebar-nav-group">
            <div class="sidebar-section-label">{{ t(group.labelKey) }}</div>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              class="sidebar-nav-item"
              :class="{ 'sidebar-nav-item-active': activePage === item.id }"
              :title="navText(item.labelKey)"
              :aria-current="activePage === item.id ? 'page' : undefined"
              @click="navigateToPage(item.id)"
            >
              <span class="sidebar-nav-icon"><v-icon size="19">{{ item.icon }}</v-icon></span>
              <span class="sidebar-nav-copy">
                <span class="sidebar-nav-title">{{ navText(item.labelKey) }}</span>
                <span class="sidebar-nav-hint">{{ navText(item.hintKey) }}</span>
              </span>
              <span v-if="activePage === item.id" class="sidebar-nav-indicator" aria-hidden="true"></span>
            </button>
          </section>
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-agent-card">
            <span class="agent-status-dot" :class="{ 'agent-status-dot-busy': agentWorkflowBusy }"></span>
            <div class="min-w-0">
              <div class="sidebar-agent-title">{{ t('features.workspace.agentStatus') }}</div>
              <div class="sidebar-agent-state">
                {{ agentWorkflowBusy ? t('features.workspace.agentRunning') : t('features.workspace.agentReady') }}
              </div>
            </div>
          </div>
          <div class="sidebar-footer-note">{{ t('features.workspace.agentHint') }}</div>
        </div>
      </aside>

      <main class="app-page-area min-w-0 min-h-0">
        <header class="page-header">
          <div class="min-w-0">
            <div class="page-eyebrow">{{ t('features.workspace.studioLabel') }}</div>
            <h1 class="page-title">{{ navText(activePageTitleKey) }}</h1>
            <p class="page-description">{{ navText(activePageDescriptionKey) }}</p>
          </div>
          <div class="page-header-actions">
            <v-chip v-if="activePage === 'workbench'" class="page-context-chip" prepend-icon="mdi-cellphone-link" variant="tonal">
              {{ platformName }} · {{ appStore.agentTargetDurationSeconds }}s
            </v-chip>
            <v-btn
              v-if="agentWorkflowBusy"
              color="primary"
              variant="tonal"
              prepend-icon="mdi-progress-clock"
              @click="navigateToPage('export')"
            >
              {{ t('features.workspace.viewProgress') }}
            </v-btn>
          </div>
        </header>

        <section v-show="activePage === 'workbench'" class="page-view workbench-view">
          <div class="workbench-main">
            <TextGenerate
              ref="TextGenerateInstance"
              :disabled="agentWorkflowBusy"
              @open-model-settings="openCopywritingSettings"
              @history-updated="refreshModelHistory"
            />
            <StoryboardSuggestions :rows="storyboardRows" :materials="storyboardMaterials" :stale="storyboardStale" @generate="generateStoryboard" @select="selectStoryboardMaterial" @timing="setStoryboardTiming" />
          </div>

          <aside class="studio-inspector">
            <v-sheet class="inspector-card workflow-card" border rounded>
              <div class="inspector-card-heading">
                <div>
                  <div class="inspector-title">{{ t('features.workspace.workflowTitle') }}</div>
                  <div class="inspector-caption">{{ t('features.workspace.workflowHint') }}</div>
                </div>
                <v-chip size="small" :color="agentWorkflowBusy ? 'primary' : 'default'" variant="tonal">
                  {{ workflowStatusLabel }}
                </v-chip>
              </div>
              <div class="workflow-step-list">
                <button
                  v-for="(step, index) in workflowSteps"
                  :key="step.id"
                  type="button"
                  class="workflow-step"
                  :class="workflowStepClass(index)"
                  @click="navigateToPage(step.page)"
                >
                  <span class="workflow-step-marker">
                    <v-icon size="15">{{ workflowStepIcon(index) }}</v-icon>
                  </span>
                  <span class="workflow-step-copy">
                    <span class="workflow-step-title">{{ t(step.labelKey) }}</span>
                    <span class="workflow-step-hint">{{ t(step.hintKey) }}</span>
                  </span>
                  <v-icon class="workflow-step-arrow" size="17">mdi-chevron-right</v-icon>
                </button>
              </div>
            </v-sheet>

            <v-sheet class="inspector-card voice-summary" border rounded>
              <div class="voice-summary-icon"><v-icon size="20">mdi-waveform</v-icon></div>
              <div class="min-w-0 flex-1">
                <div class="inspector-title">{{ t('features.workspace.voiceSummaryTitle') }}</div>
                <div class="voice-summary-name">
                  {{ t(appStore.ttsProvider === 'minimax' ? 'features.tts.config.providerMiniMax' : 'features.tts.config.providerEdge') }}
                  <span v-if="currentVoiceName"> · {{ currentVoiceName }}</span>
                </div>
              </div>
              <v-btn icon="mdi-chevron-right" size="small" variant="text" :aria-label="t('features.workspace.pages.voice')" @click="openTtsSettings" />
            </v-sheet>

            <div class="inspector-actions">
              <v-btn
                v-if="agentWorkflowBusy"
                class="studio-primary-action"
                color="error"
                size="large"
                block
                prepend-icon="mdi-stop"
                @click="handleCancelRender"
              >
                {{ t(appStore.batchProgress?.running ? 'features.render.batch.stop' : 'features.render.config.stopLabel') }}
              </v-btn>
              <v-btn
                v-else
                class="studio-primary-action"
                color="primary"
                size="large"
                block
                prepend-icon="mdi-movie-open-play-outline"
                @click="navigateToPage('export')"
              >
                {{ t('features.workspace.goRender') }}
              </v-btn>
              <div class="inspector-action-hint">{{ t('features.workspace.goRenderHint') }}</div>
              <v-btn variant="text" block prepend-icon="mdi-tune-variant" @click="navigateToPage('export')">
                {{ t('features.workspace.configureOutput') }}
              </v-btn>
            </div>
          </aside>
        </section>

        <section v-show="activePage === 'link-import'" class="page-view content-page">
          <LinkImport :disabled="agentWorkflowBusy" @imported="(folder) => VideoManageInstance?.refreshImportedFolder(folder)" />
        </section>
        <section v-show="activePage === 'materials'" class="page-view content-page materials-page">
          <VideoManage ref="VideoManageInstance" :disabled="agentWorkflowBusy" />
        </section>

        <section v-show="activePage === 'models' || activePage === 'voice'" class="page-view content-page settings-page">
          <ModelSettings
            ref="ModelSettingsInstance"
            :section="modelSettingsSection"
            :disabled="agentWorkflowBusy"
          />
        </section>

        <section v-show="activePage === 'transcription'" class="page-view content-page transcription-page">
          <SubtitleTranscriber />
        </section>

        <section v-show="activePage === 'assistant'" class="page-view content-page settings-page">
          <McpAssistantSettings />
        </section>

        <section v-show="activePage === 'export'" class="page-view content-page export-view">
          <div class="export-layout">
            <div class="export-options-column">
              <v-sheet class="export-options-card" border rounded>
                <div class="export-section-heading">
                  <div class="export-heading-icon"><v-icon>mdi-tune-variant</v-icon></div>
                  <div>
                    <div class="inspector-title">{{ t('features.workspace.outputOptionsTitle') }}</div>
                    <div class="inspector-caption">{{ t('features.workspace.outputOptionsHint') }}</div>
                  </div>
                </div>
                <GenerationOptions />
                <div class="export-format-summary">
                  <div class="export-summary-item">
                    <span class="export-summary-label">{{ t('features.render.config.output.aspectRatio') }}</span>
                    <strong>{{ outputSizeLabel }}</strong>
                  </div>
                  <div class="export-summary-item">
                    <span class="export-summary-label">{{ t('features.render.config.output.folder') }}</span>
                    <strong class="truncate" :title="appStore.renderConfig.outputPath || ''">
                      {{ appStore.renderConfig.outputPath || t('features.workspace.outputFolderMissing') }}
                    </strong>
                  </div>
                </div>
              </v-sheet>

              <v-sheet class="export-preview-card" border rounded>
                <div class="export-section-heading">
                  <div class="export-heading-icon"><v-icon>mdi-movie-open-check-outline</v-icon></div>
                  <div>
                    <div class="inspector-title">{{ t('features.workspace.previewTitle') }}</div>
                    <div class="inspector-caption">{{ t('features.workspace.previewHint') }}</div>
                  </div>
                </div>
                <video
                  v-if="renderedVideoSrc"
                  class="export-preview-video"
                  :src="renderedVideoSrc"
                  controls
                  preload="metadata"
                ></video>
                <div v-else class="export-preview-empty">
                  <v-icon size="19">mdi-filmstrip-box-multiple</v-icon>
                  <span>{{ t('features.workspace.previewEmpty') }}</span>
                </div>
                <div
                  v-if="lastRenderedVideo"
                  class="export-preview-path"
                  :title="lastRenderedVideo"
                >
                  {{ lastRenderedVideo }}
                </div>
              </v-sheet>
            </div>

            <div class="export-render-column">
              <PreflightChecklist
                :items="preflightItems"
                @action="handlePreflightAction"
                @refresh="refreshPreflight"
              />
              <VideoRender
                @render-video="handleRenderVideo"
                @cancel-render="handleCancelRender"
              />
              <div class="export-render-note">
                <v-icon size="17">mdi-information-outline</v-icon>
                <span>{{ t('features.workspace.exportNote') }}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { resolveOpenSubsPreset } from '@/effect-engine/opensubs-presets'
import TextGenerate from './components/TextGenerate.vue'
import VideoManage from './components/VideoManage.vue'
import ModelSettings from './components/ModelSettings.vue'
import VideoRender from './components/VideoRender.vue'
import GenerationOptions from './components/GenerationOptions.vue'
import PreflightChecklist from './components/PreflightChecklist.vue'
import LinkImport from './components/LinkImport.vue'
import McpAssistantSettings from './components/McpAssistantSettings.vue'
import StoryboardSuggestions from './components/StoryboardSuggestions.vue'
import SubtitleTranscriber from './components/SubtitleTranscriber.vue'
import { splitScriptSentences } from '@/lib/agent/script-sentences'

import { computed, h, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RenderStatus, useAppStore } from '@/store'
import { useTranslation } from 'i18next-vue'
import { useToast } from 'vue-toastification'
import type { ListFilesFromFolderRecord } from '~/electron/types'
import type { GenerationUsageSummary } from '~/electron/analytics-types'
import ActionToastEmbed from '@/components/ActionToastEmbed.vue'
import random from 'random'
import { formatErrorForCopy } from '@/lib/error-copy'
import { createAnalyticsOperationId, trackAnalytics } from '@/lib/analytics'
import { runBatch, type BatchRunState } from '@/lib/batch'
import {
  estimateSpeechSeconds,
  isDurationOnTarget,
  type PreflightItem,
} from '@/lib/preflight'

const toast = useToast()
const appStore = useAppStore()
const { t } = useTranslation()
const navText = (key: string) => {
  const value = t(key) as string
  if (value !== key || !key.endsWith('.linkImport')) return value
  const english = (appStore.locale || navigator.language).toLowerCase().startsWith('en')
  if (key.includes('pageHints')) return english ? 'Download video into your library' : '下载视频并导入素材库'
  if (key.includes('pageDescriptions')) return english ? 'Paste a video link and choose a destination folder.' : '粘贴视频链接并选择保存位置。'
  return english ? 'Import link' : '链接导入'
}
const isMac = window.electron.platform === 'darwin'
const hasRenderStatus = (status: RenderStatus) => appStore.renderStatus === status
type AppPage = 'workbench' | 'materials' | 'models' | 'voice' | 'assistant' | 'export' | 'link-import' | 'transcription'
type ModelSettingsTab = 'analysis' | 'copywriting' | 'tts'
const activePage = ref<AppPage>('materials')
const navigationGroups: {
  id: string
  labelKey: string
  items: { id: AppPage; icon: string; labelKey: string; hintKey: string }[]
}[] = [
  {
    id: 'creation',
    labelKey: 'features.workspace.navigationGroups.creation',
    items: [
      { id: 'link-import', icon: 'mdi-link-variant', labelKey: 'features.workspace.pages.linkImport', hintKey: 'features.workspace.pageHints.linkImport' },
      { id: 'transcription', icon: 'mdi-subtitles-outline', labelKey: 'features.workspace.pages.transcription', hintKey: 'features.workspace.pageHints.transcription' },
      {
        id: 'materials',
        icon: 'mdi-folder-multiple-image',
        labelKey: 'features.workspace.pages.materials',
        hintKey: 'features.workspace.pageHints.materials',
      },
      {
        id: 'workbench',
        icon: 'mdi-creation',
        labelKey: 'features.workspace.pages.workbench',
        hintKey: 'features.workspace.pageHints.workbench',
      },
      {
        id: 'voice',
        icon: 'mdi-waveform',
        labelKey: 'features.workspace.pages.voice',
        hintKey: 'features.workspace.pageHints.voice',
      },
      {
        id: 'export',
        icon: 'mdi-movie-open-check',
        labelKey: 'features.workspace.pages.export',
        hintKey: 'features.workspace.pageHints.export',
      },
    ],
  },
  {
    id: 'services',
    labelKey: 'features.workspace.navigationGroups.services',
    items: [
      {
        id: 'models',
        icon: 'mdi-brain',
        labelKey: 'features.workspace.pages.models',
        hintKey: 'features.workspace.pageHints.models',
      },
      {
        id: 'assistant',
        icon: 'mdi-connection',
        labelKey: 'features.workspace.pages.assistant',
        hintKey: 'features.workspace.pageHints.assistant',
      },
    ],
  },
]
const activePageTitleKey = computed(() => `features.workspace.pageTitles.${activePage.value === 'link-import' ? 'linkImport' : activePage.value}`)
const activePageDescriptionKey = computed(() => `features.workspace.pageDescriptions.${activePage.value === 'link-import' ? 'linkImport' : activePage.value}`)
const ModelSettingsInstance = ref<InstanceType<typeof ModelSettings> | null>(null)
const modelSettingsSection = computed(() => (activePage.value === 'voice' ? 'voice' : 'models'))
const agentWorkflowBusy = computed(
  () =>
    appStore.batchProgress?.running ||
    ![RenderStatus.None, RenderStatus.Completed, RenderStatus.Failed].includes(
      appStore.renderStatus,
    ),
)
// 最近一次成功渲染的成片，渲染完成后在导出页下方直接预览
const lastRenderedVideo = ref('')
const renderedVideoSrc = computed(() => {
  const normalized = lastRenderedVideo.value.replace(/\\/g, '/').trim()
  if (!normalized) return ''
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
})
const currentVoiceName = computed(() =>
  appStore.ttsProvider === 'minimax'
    ? appStore.minimaxTtsVoiceName
    : appStore.voice?.FriendlyName ?? '',
)
const platformName = computed(() => getAgentPlatformLabel())
const outputSizeLabel = computed(() => {
  const width = Number(appStore.renderConfig.outputSize.width)
  const height = Number(appStore.renderConfig.outputSize.height)
  const ratio = width / height
  const commonRatios = [
    { ratio: 9 / 16, label: '9:16' },
    { ratio: 16 / 9, label: '16:9' },
    { ratio: 1, label: '1:1' },
    { ratio: 4 / 5, label: '4:5' },
  ]
  const match = commonRatios.find((item) => Math.abs(ratio - item.ratio) < 0.02)
  return `${match?.label ?? `${width}:${height}`} · ${width} × ${height}`
})
const workflowSteps = [
  {
    id: 'analysis',
    page: 'materials' as AppPage,
    labelKey: 'features.workspace.workflow.analysis',
    hintKey: 'features.workspace.workflow.analysisHint',
  },
  {
    id: 'script',
    page: 'workbench' as AppPage,
    labelKey: 'features.workspace.workflow.script',
    hintKey: 'features.workspace.workflow.scriptHint',
  },
  {
    id: 'voice',
    page: 'voice' as AppPage,
    labelKey: 'features.workspace.workflow.voice',
    hintKey: 'features.workspace.workflow.voiceHint',
  },
  {
    id: 'export',
    page: 'export' as AppPage,
    labelKey: 'features.workspace.workflow.export',
    hintKey: 'features.workspace.workflow.exportHint',
  },
]
const workflowStageIndex = computed(() => {
  switch (appStore.renderStatus) {
    case RenderStatus.AnalyzeMaterials:
      return 0
    case RenderStatus.GenerateText:
      return 1
    case RenderStatus.SynthesizedSpeech:
    case RenderStatus.SegmentVideo:
      return 2
    case RenderStatus.Rendering:
      return 3
    default:
      return -1
  }
})
const workflowStatusLabel = computed(() => {
  if (agentWorkflowBusy.value) return t('features.workspace.agentRunning')
  if (appStore.renderStatus === RenderStatus.Completed) return t('features.workspace.agentCompleted')
  if (appStore.renderStatus === RenderStatus.Failed) return t('features.workspace.agentFailed')
  return t('features.workspace.agentReady')
})
const workflowStepClass = (index: number) => ({
  'workflow-step-complete':
    appStore.renderStatus === RenderStatus.Completed ||
    (agentWorkflowBusy.value && index < workflowStageIndex.value),
  'workflow-step-active': agentWorkflowBusy.value && index === workflowStageIndex.value,
  'workflow-step-next': !agentWorkflowBusy.value && appStore.renderStatus === RenderStatus.None && index === 0,
})
const workflowStepIcon = (index: number) => {
  if (
    appStore.renderStatus === RenderStatus.Completed ||
    (agentWorkflowBusy.value && index < workflowStageIndex.value)
  ) return 'mdi-check'
  if (agentWorkflowBusy.value && index === workflowStageIndex.value) return 'mdi-play'
  return `mdi-numeric-${index + 1}-circle-outline`
}

// ---- 出片前检查 ----
// 手动流程下最容易漏的四件事：素材没勾、笑场没检测、文案没写、输出目录/音色没配。
// 这里把它们摊在导出页上，缺项能直接跳过去补；真正点合成时还会再拦一次。
const preflightItems = ref<PreflightItem[]>([])
const preflightSnapshot = ref({
  selectedCount: 0,
  totalCount: 0,
  reviewed: false,
  rangeCount: 0,
})

// 配音就绪与否只看 store：ttsControl 只有在访问过配音页之后才挂得上，
// 早期版本因此在导出页静默不干活，这里改成明着显示缺什么。
const voiceConfigIssue = () => {
  if (appStore.ttsProvider === 'minimax') {
    if (!appStore.minimaxTtsApiKey?.trim()) return 'features.workspace.preflight.voice.noApiKey' as const
    if (!appStore.minimaxTtsVoiceId?.trim()) return 'features.workspace.preflight.voice.noClone' as const
    return '' as const
  }
  return appStore.voice ? ('' as const) : ('features.workspace.preflight.voice.noVoice' as const)
}

const refreshPreflight = () => {
  const snapshot = VideoManageInstance.value?.getPreflightSnapshot()
  if (snapshot) preflightSnapshot.value = snapshot
  const { selectedCount, totalCount, reviewed, rangeCount } = preflightSnapshot.value
  const targetSeconds = Number(appStore.agentTargetDurationSeconds) || 0
  const script = TextGenerateInstance.value?.getCurrentOutputText()?.trim() ?? ''
  const speechSeconds = estimateSpeechSeconds(script)
  const onTarget = isDurationOnTarget(speechSeconds, targetSeconds)
  const secondsLabel = String(Math.max(1, Math.round(speechSeconds)))
  const skipEnabled = appStore.skipUnusableShots !== false
  const items: PreflightItem[] = []

  items.push({
    id: 'assets',
    label: t('features.workspace.preflight.assets.label'),
    detail: selectedCount
      ? t('features.workspace.preflight.assets.ready', { count: selectedCount })
      : totalCount
        ? t('features.workspace.preflight.assets.totalOnly', { count: totalCount })
        : t('features.workspace.preflight.assets.empty'),
    status: selectedCount ? 'ok' : 'warn',
    actionLabel: selectedCount ? undefined : t('features.workspace.preflight.goMaterials'),
  })

  const reviewIssue = !reviewed
    ? t('features.workspace.preflight.review.notReviewed')
    : rangeCount && !skipEnabled
      ? t('features.workspace.preflight.review.skipped')
      : rangeCount
        ? t('features.workspace.preflight.review.reviewedWithRanges', { count: rangeCount })
        : t('features.workspace.preflight.review.reviewedClean')
  items.push({
    id: 'review',
    label: t('features.workspace.preflight.review.label'),
    detail: reviewIssue,
    status: !reviewed || (rangeCount > 0 && !skipEnabled) ? 'warn' : 'ok',
    actionLabel:
      !reviewed || (rangeCount > 0 && !skipEnabled)
        ? t('features.workspace.preflight.goMaterials')
        : undefined,
  })

  items.push({
    id: 'script',
    label: t('features.workspace.preflight.script.label'),
    detail: !script
      ? t('features.workspace.preflight.script.empty')
      : onTarget
        ? t('features.workspace.preflight.script.good', {
            count: script.length,
            seconds: secondsLabel,
            target: targetSeconds,
          })
        : t(
            speechSeconds < targetSeconds
              ? 'features.workspace.preflight.script.short'
              : 'features.workspace.preflight.script.long',
            { count: script.length, seconds: secondsLabel, target: targetSeconds },
          ),
    status: script && onTarget ? 'ok' : 'warn',
    actionLabel: script && onTarget ? undefined : t('features.workspace.preflight.goWorkbench'),
  })

  const voiceIssue = voiceConfigIssue()
  items.push({
    id: 'voice',
    label: t('features.workspace.preflight.voice.label'),
    detail: voiceIssue
      ? t(voiceIssue)
      : t('features.workspace.preflight.voice.ready', {
          name: currentVoiceName.value || t('features.workspace.preflight.ok'),
        }),
    status: voiceIssue ? 'warn' : 'ok',
    actionLabel: voiceIssue ? t('features.workspace.preflight.goVoice') : undefined,
  })

  items.push({
    id: 'output',
    label: t('features.workspace.preflight.output.label'),
    detail: appStore.renderConfig.outputPath
      ? t('features.workspace.preflight.output.ready', {
          folder: appStore.renderConfig.outputPath,
          size: outputSizeLabel.value,
        })
      : t('features.workspace.preflight.output.noPath'),
    status: appStore.renderConfig.outputPath ? 'ok' : 'warn',
    actionLabel: appStore.renderConfig.outputPath ? undefined : t('features.workspace.preflight.goExport'),
  })

  preflightItems.value = items
}

const handlePreflightAction = (id: PreflightItem['id']) => {
  if (id === 'assets' || id === 'review') {
    void navigateToPage('materials')
    return
  }
  if (id === 'script') {
    void navigateToPage('workbench')
    return
  }
  if (id === 'voice') {
    void navigateToPage('voice')
    return
  }
  void navigateToPage('export')
}

// 切到导出页就看一眼当前状态；素材页改勾选、配音页换音色后回来也能立刻反映
watch(activePage, (page) => {
  if (page === 'export') refreshPreflight()
})

const navigateToPage = async (page: AppPage) => {
  activePage.value = page
  if (page === 'models' || page === 'voice') {
    await nextTick()
    ModelSettingsInstance.value?.selectTab(page === 'voice' ? 'tts' : 'analysis')
  }
}

let dragState: {
  startMouseX: number
  startMouseY: number
  startClientX: number
  startWindowX: number
  startWindowY: number
  dragging: boolean
  preparing: boolean
} | null = null

const clearTitleBarDragListeners = () => {
  window.removeEventListener('mousemove', handleTitleBarMouseMove)
  window.removeEventListener('mouseup', handleTitleBarMouseUp)
}

const handleTitleBarMouseMove = async (event: MouseEvent) => {
  if (!isMac || !dragState) return

  const deltaX = event.screenX - dragState.startMouseX
  const deltaY = event.screenY - dragState.startMouseY
  if (!dragState.dragging && Math.hypot(deltaX, deltaY) < 2) return

  if (!dragState.dragging) {
    if (dragState.preparing) return
    dragState.preparing = true

    const dragInfo = await window.electron.prepareWindowDrag()
    if (!dragState || !dragInfo) return

    let initialX = dragInfo.bounds.x
    let initialY = dragInfo.bounds.y
    if (dragInfo.wasMaximized) {
      const pointerRatio = dragState.startClientX / window.innerWidth
      initialX = event.screenX - dragInfo.bounds.width * pointerRatio
      initialY = Math.max(0, event.screenY - 20)
      window.electron.setWindowPosition(initialX, initialY)
    }

    dragState.startMouseX = event.screenX
    dragState.startMouseY = event.screenY
    dragState.startWindowX = initialX
    dragState.startWindowY = initialY
  }

  dragState.dragging = true
  window.electron.setWindowPosition(
    dragState.startWindowX + event.screenX - dragState.startMouseX,
    dragState.startWindowY + event.screenY - dragState.startMouseY,
  )
}

const handleTitleBarMouseUp = () => {
  dragState = null
  clearTitleBarDragListeners()
}

const handleTitleBarMouseDown = async (event: MouseEvent) => {
  if (!isMac) return
  if (event.button !== 0 || event.detail > 1) return

  const bounds = await window.electron.getWindowBounds()
  if (!bounds) return

  dragState = {
    startMouseX: event.screenX,
    startMouseY: event.screenY,
    startClientX: event.clientX,
    startWindowX: bounds.x,
    startWindowY: bounds.y,
    dragging: false,
    preparing: false,
  }
  clearTitleBarDragListeners()
  window.addEventListener('mousemove', handleTitleBarMouseMove)
  window.addEventListener('mouseup', handleTitleBarMouseUp)
}

const handleTitleBarDoubleClick = () => {
  if (!isMac) return
  dragState = null
  clearTitleBarDragListeners()
  window.electron.toggleWindowMaximize()
}

onBeforeUnmount(() => {
  clearTitleBarDragListeners()
})

// 渲染合成视频
const TextGenerateInstance = ref<InstanceType<typeof TextGenerate> | null>()
type StoryboardMaterial = { path: string; name: string; keywords: string[]; samples: { timeSeconds: number; description: string }[] }
type StoryboardRow = { sentence: string; path: string; description: string; timeSeconds?: number; startSeconds: number; endSeconds: number }
const storyboardMaterials = ref<StoryboardMaterial[]>([])
const storyboardRows = ref<StoryboardRow[]>([])
const storyboardSource = ref('')
const storyboardSignature = () => JSON.stringify({ text: TextGenerateInstance.value?.getCurrentOutputText()?.trim() ?? '', materials: VideoManageInstance.value?.getStoryboardMaterials() ?? [] })
const storyboardStale = computed(() => !!storyboardRows.value.length && storyboardSource.value !== storyboardSignature())
const generateStoryboard = () => {
  const text = TextGenerateInstance.value?.getCurrentOutputText()?.trim() ?? ''
  storyboardMaterials.value = VideoManageInstance.value?.getStoryboardMaterials() ?? []
  storyboardRows.value = splitScriptSentences(text).map((sentence) => {
    const chars = sentence.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase()
    const pairs = Array.from({ length: Math.max(0, chars.length - 1) }, (_, index) => chars.slice(index, index + 2))
    let bestScore = 0
    let row: StoryboardRow = { sentence, path: '', description: '', startSeconds: 0, endSeconds: 0 }
    for (const material of storyboardMaterials.value) {
      for (const sample of material.samples) {
        const description = `${sample.description} ${material.keywords.join(' ')}`.toLowerCase()
        const score = pairs.filter((pair) => description.includes(pair)).length
        if (score > bestScore) {
          bestScore = score
          row = { sentence, path: material.path, description: sample.description, timeSeconds: sample.timeSeconds, startSeconds: sample.timeSeconds, endSeconds: sample.timeSeconds }
        }
      }
    }
    return row
  })
  storyboardSource.value = storyboardSignature()
}
const selectStoryboardMaterial = (index: number, path: string) => {
  const row = storyboardRows.value[index]
  if (!row) return
  const sample = storyboardMaterials.value.find((material) => material.path === path)?.samples[0]
  storyboardRows.value[index] = { sentence: row.sentence, path, description: sample?.description ?? '', timeSeconds: sample?.timeSeconds, startSeconds: sample?.timeSeconds ?? 0, endSeconds: sample?.timeSeconds ?? 0 }
}
const setStoryboardTiming = (index: number, startSeconds: number, endSeconds: number) => {
  const row = storyboardRows.value[index]
  if (row) storyboardRows.value[index] = { ...row, startSeconds, endSeconds }
}
const VideoManageInstance = ref<InstanceType<typeof VideoManage> | null>()
const openModelSettings = async (tab: ModelSettingsTab) => {
  activePage.value = tab === 'tts' ? 'voice' : 'models'
  await nextTick()
  ModelSettingsInstance.value?.selectTab(tab)
}
const openCopywritingSettings = () => openModelSettings('copywriting')
const openTtsSettings = () => openModelSettings('tts')
const refreshModelHistory = () => ModelSettingsInstance.value?.refreshHistoryCount()
let activeTtsSynthesisController: AbortController | null = null
type GenerationStage = 'analysis' | 'text' | 'tts' | 'media' | 'export'
type GenerationOutcome = 'succeeded' | 'failed' | 'cancelled'

type BatchContext = BatchRunState

interface GenerationTask {
  id: string
  trigger: 'manual' | 'batch'
  batch: BatchContext | null
  startedAt: number
  stageStartedAt: number
  stage: GenerationStage
  finished: boolean
  metrics: Record<string, string | number | boolean>
  usage?: GenerationUsageSummary
  finish?: (outcome: GenerationOutcome, error?: unknown) => void
}

let activeGeneration: GenerationTask | null = null
const recentlyBlockedAt = new Map<string, number>()

const getResolutionBucket = (width: number, height: number) => {
  const maxDimension = Math.max(width, height)
  if (maxDimension >= 2160) return '4k'
  if (maxDimension >= 1080) return '1080p'
  if (maxDimension >= 720) return '720p'
  return 'custom'
}

const getAspectRatio = (width: number, height: number) => {
  const ratio = width / height
  if (Math.abs(ratio - 1) < 0.05) return 'square'
  if (ratio > 1) return ratio > 2 ? 'custom' : 'landscape'
  return ratio < 0.4 ? 'custom' : 'portrait'
}

const classifyError = (error: unknown): string => {
  const value = error as { name?: string; message?: string; code?: string }
  const text = `${value?.name ?? ''} ${value?.code ?? ''} ${value?.message ?? ''}`.toLowerCase()
  if (value?.name === 'AbortError') return 'unknown'
  if (/timed out|timeout|etimedout/.test(text)) return 'network_timeout'
  if (/enotfound|econnrefused|networkerror|failed to fetch/.test(text)) return 'network_unreachable'
  if (/401|403|unauthorized|forbidden/.test(text)) return 'authentication_failed'
  if (/429|rate.?limit/.test(text)) return 'rate_limited'
  if (/permission|eacces|eperm/.test(text)) return 'permission_denied'
  if (/enospc|disk.?full/.test(text)) return 'disk_full'
  if (/ffmpeg|exited with code/.test(text)) return 'ffmpeg_failed'
  if (/invalid.*audio|audio.*invalid/.test(text)) return 'tts_invalid_audio'
  return 'unknown'
}

const getAgentPlatformLabel = () => {
  const key = appStore.agentPlatform.replace(/-([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  )
  return t(`features.agent.platforms.${key}`)
}

const finalizeBatch = (batch: BatchContext, stopReason: string) => {
  if (batch.finished) return
  batch.finished = true
  batch.running = false
  batch.stopReason = stopReason
  trackAnalytics('batch_finished', {
    batch_id: batch.id,
    completed_count: batch.completedCount,
    failed_count: batch.failedCount,
    cancelled_count: batch.cancelledCount,
    duration_ms: Math.max(0, Math.floor(performance.now() - batch.startedAt)),
    stop_reason: stopReason,
  })
}

let generationRunning = false
const handleRenderVideo = async () => {
  if (generationRunning) return
  if (appStore.copywritingStatus === 'generating') {
    toast.warning(t('features.agent.waitForDraft'))
    return
  }
  // 先跑一遍出片前检查：缺项在导出页上已经标红，这里拦住并把原因说清楚
  refreshPreflight()
  const blocking = preflightItems.value.filter((item) => item.status === 'warn' && item.id !== 'review')
  if (blocking.length) {
    toast.warning(blocking[0].detail)
    return
  }
  // 配音页没进过时 ttsControl 还没挂上，只按 store 判断就好，别静默返回
  if (ModelSettingsInstance.value && !ModelSettingsInstance.value.validateSynthesisSettings()) return
  const count = Number(appStore.batchConfig?.count ?? 10)
  if (appStore.autoBatch && (!Number.isInteger(count) || count < 1 || count > 999)) {
    toast.warning(t('features.render.batch.invalidCount'))
    return
  }
  generationRunning = true
  try {
    if (!appStore.autoBatch) {
      appStore.batchProgress = null
      await renderSingleVideo()
      return
    }
    appStore.batchProgress = {
      id: createAnalyticsOperationId(),
      startedAt: performance.now(),
      total: count,
      current: 0,
      completedCount: 0,
      failedCount: 0,
      cancelledCount: 0,
      warningCount: 0,
      consecutiveFailures: 0,
      onError: appStore.batchConfig?.onError === 'continue' ? 'continue' : 'stop',
      running: true,
      stopRequested: false,
      stopReason: '',
      finished: false,
    }
    const batch = appStore.batchProgress
    trackAnalytics('batch_started', { batch_id: batch.id })
    try {
      const reason = await runBatch(
        batch,
        () => renderSingleVideo(batch),
        () => {
          // 手动流程下文案由用户维护，批量合成时不能清空。
        },
      )
      finalizeBatch(batch, reason)
      if (reason !== 'user_cancelled')
        toast.info(
          t('features.render.batch.summary', {
            success: batch.completedCount,
            failed: batch.failedCount,
            warnings: batch.warningCount,
          }),
        )
    } finally {
      if (!batch.finished) finalizeBatch(batch, 'generation_failed')
    }
  } finally {
    generationRunning = false
  }
}

const renderSingleVideo = async (batchContext?: BatchContext) => {
  const subtitlesEnabled = appStore.renderConfig.subtitlesEnabled !== false
  const exportSubtitles = appStore.renderConfig.exportSubtitles === true
  const operationId = createAnalyticsOperationId()
  const trigger = batchContext ? 'batch' : appStore.autoBatch ? 'batch' : 'manual'
  const blocked = (reason: string) => {
    const now = Date.now()
    if (now - (recentlyBlockedAt.get(reason) ?? 0) >= 30_000) {
      recentlyBlockedAt.set(reason, now)
      trackAnalytics('video_generation_blocked', {
        operation_id: operationId,
        trigger,
        blocked_reason: reason,
        ...(batchContext ? { batch_id: batchContext.id } : {}),
      })
    }
    if (batchContext) {
      batchContext.failedCount += 1
      batchContext.stopReason = reason
      batchContext.stopRequested = true
      finalizeBatch(batchContext, 'generation_failed')
    }
  }

  if (!appStore.renderConfig.outputFileName) {
    blocked('output_name_missing')
    toast.warning(t('features.render.errors.outputFileNameRequired'))
    return
  }
  if (!appStore.renderConfig.outputPath) {
    blocked('output_path_missing')
    toast.warning(t('features.render.errors.outputPathRequired'))
    return
  }
  if (!appStore.renderConfig.outputSize?.width || !appStore.renderConfig.outputSize?.height) {
    blocked('output_size_invalid')
    toast.warning(t('features.render.errors.outputSizeRequired'))
    return
  }
  const targetDurationSeconds = Number(appStore.agentTargetDurationSeconds)
  if (
    !Number.isInteger(targetDurationSeconds) ||
    targetDurationSeconds < 5 ||
    targetDurationSeconds > 600
  ) {
    blocked('agent_duration_invalid')
    toast.warning(t('features.agent.durationInvalid'))
    return
  }

  let randomBgm: ListFilesFromFolderRecord | undefined = undefined
  if (appStore.renderConfig.bgmPath) {
    try {
      const bgmList = (
        await window.electron.listFilesFromFolder({
          folderPath: appStore.renderConfig.bgmPath.replace(/\\/g, '/'),
        })
      ).filter((asset) => asset.name.toLowerCase().endsWith('.mp3'))
      if (bgmList.length > 0) {
        randomBgm = random.choice(bgmList)
      }
      console.debug('背景音乐素材读取完成', {
        mp3Count: bgmList.length,
        selected: randomBgm?.name,
      })
    } catch (error: any) {
      blocked('bgm_unavailable')
      console.warn('获取背景音乐列表失败', error)
      const errorMessage = error?.error?.message || error?.message || error
      toast.error({
        component: {
          // 使用vnode方式创建自定义错误弹窗实例，以获得良好的类型提示
          render: () =>
            h(ActionToastEmbed, {
              message: t('features.render.errors.bgmListFailed'),
              detail: String(errorMessage),
              actionText: t('common.buttons.copyErrorDetail'),
              onActionTirgger: () => {
                navigator.clipboard.writeText(
                  formatErrorForCopy(
                    t('features.render.errors.bgmListFailed'),
                    String(errorMessage),
                  ),
                )
                toast.success(t('common.messages.success.copySuccess'))
              },
            }),
        },
      })
      return
    }
  }

  const batch = batchContext ?? null
  if (batch?.stopRequested) return

  const task: GenerationTask = {
    id: operationId,
    trigger: batch ? 'batch' : 'manual',
    batch,
    startedAt: performance.now(),
    stageStartedAt: performance.now(),
    stage: 'analysis',
    finished: false,
    metrics: {
      analysis_entered: true,
      text_entered: false,
      tts_entered: false,
      media_entered: false,
      export_entered: false,
      has_bgm: Boolean(randomBgm),
      has_subtitles: subtitlesEnabled,
      resolution_bucket: getResolutionBucket(
        appStore.renderConfig.outputSize.width,
        appStore.renderConfig.outputSize.height,
      ),
      aspect_ratio: getAspectRatio(
        appStore.renderConfig.outputSize.width,
        appStore.renderConfig.outputSize.height,
      ),
      has_effects: false,
    },
  }

  const closeStage = () => {
    const duration = Math.max(0, Math.floor(performance.now() - task.stageStartedAt))
    const key = `${task.stage}_duration_ms`
    task.metrics[key] = Number(task.metrics[key] ?? 0) + duration
  }
  const enterStage = (stage: GenerationStage) => {
    closeStage()
    task.stage = stage
    task.stageStartedAt = performance.now()
    task.metrics[`${stage}_entered`] = true
  }
  const finishTask = (outcome: GenerationOutcome, error?: unknown) => {
    if (task.finished) return
    closeStage()
    task.finished = true
    const eventName = `video_generation_${outcome}` as const
    const data: Record<string, string | number | boolean> = {
      operation_id: task.id,
      trigger: task.trigger,
      ...(task.batch ? { batch_id: task.batch.id } : {}),
      duration_ms: Math.max(0, Math.floor(performance.now() - task.startedAt)),
      ...task.metrics,
    }
    if (outcome === 'failed' || outcome === 'cancelled') {
      data.failed_stage = task.stage
    }
    if (outcome === 'failed') data.error_code = classifyError(error)
    if (task.usage) {
      data.text_source = task.usage.source
      data.llm_call_count = task.usage.callCount
      data.llm_usage_complete = task.usage.usageComplete
      data.provider_category = task.usage.providerCategory
      if (task.usage.protocol) data.protocol = task.usage.protocol
      if (task.usage.inputTokens !== undefined) data.input_tokens = task.usage.inputTokens
      if (task.usage.outputTokens !== undefined) data.output_tokens = task.usage.outputTokens
    }

    trackAnalytics(eventName, data)
    if (task.batch) {
      if (outcome === 'succeeded') task.batch.completedCount += 1
      else if (outcome === 'failed') task.batch.failedCount += 1
      else task.batch.cancelledCount += 1
    }
    if (activeGeneration === task) activeGeneration = null
  }
  task.finish = finishTask

  try {
    trackAnalytics('video_generation_started', {
      operation_id: task.id,
      trigger: task.trigger,
      ...(batch ? { batch_id: batch.id } : {}),
      has_bgm: Boolean(randomBgm),
      has_subtitles: subtitlesEnabled,
      resolution_bucket: task.metrics.resolution_bucket as string,
      aspect_ratio: task.metrics.aspect_ratio as string,
    })
    activeGeneration = task

    // 手动流程：直接使用创作台里已经写好的口播文案，不再自动分析素材或重新生成文案。
    if (task.finished) return
    const text = TextGenerateInstance.value?.getCurrentOutputText()?.trim()
    if (!text) throw new Error(t('features.render.errors.textMissing'))
    enterStage('text')
    task.metrics.text_entered = true
    task.usage = TextGenerateInstance.value?.getGenerationAnalytics?.()
    task.metrics.text_source = task.usage?.source ?? 'unknown'
    task.metrics.llm_call_count = task.usage?.callCount ?? 0
    task.metrics.llm_usage_complete = task.usage?.usageComplete ?? false
    if (task.usage?.inputTokens !== undefined) task.metrics.input_tokens = task.usage.inputTokens
    if (task.usage?.outputTokens !== undefined) task.metrics.output_tokens = task.usage.outputTokens

    // TTS合成语音（用当前选中的配音服务把文案转成语音和字幕）
    appStore.updateRenderStatus(RenderStatus.SynthesizedSpeech)
    enterStage('tts')
    task.metrics.tts_characters = text.length
    const ttsController = new AbortController()
    activeTtsSynthesisController = ttsController
    let ttsResult
    try {
      const modelSettings = ModelSettingsInstance.value
      if (!modelSettings) throw new Error(t('features.modelSettings.ttsNotReady'))
      ttsResult = await modelSettings.synthesizedSpeechToFile({
        text,
        withCaption: true,
        abortSignal: ttsController.signal,
      })
    } finally {
      if (activeTtsSynthesisController === ttsController) activeTtsSynthesisController = null
    }
    if (ttsResult?.duration === undefined) {
      throw new Error(t('features.tts.errors.fileCorrupt'))
    }
    if (ttsResult?.duration === 0) {
      throw new Error(t('features.tts.errors.zeroDuration'))
    }
    task.metrics.audio_duration_ms = Math.floor(ttsResult.duration * 1000)
    task.metrics.has_subtitles = subtitlesEnabled && Boolean(ttsResult.srtText)

    // 获取视频片段
    if (!hasRenderStatus(RenderStatus.SynthesizedSpeech)) {
      return
    }
    appStore.updateRenderStatus(RenderStatus.SegmentVideo)
    enterStage('media')
    const videoSegments = await VideoManageInstance.value?.getVideoSegments({
      duration: ttsResult.duration,
    })!
    await new Promise((resolve) => setTimeout(resolve, random.integer(1000, 3000)))

    // 合成视频
    if (!hasRenderStatus(RenderStatus.SegmentVideo)) {
      return
    }
    appStore.updateRenderStatus(RenderStatus.Rendering)
    enterStage('export')
    const outputFileName = batch
      ? `${appStore.renderConfig.outputFileName}-${String(batch.current).padStart(
          Math.max(3, String(batch.total).length),
          '0',
        )}${appStore.renderConfig.outputFileExt}`
      : appStore.renderConfig.outputFileName + appStore.renderConfig.outputFileExt
    const renderResult = await window.electron.renderVideo({
      ...videoSegments,
      audioFiles: {
        bgm: randomBgm?.path,
      },
      subtitleText: ttsResult.srtText,
      subtitleStyle: resolveOpenSubsPreset(appStore.renderConfig.subtitlePreset, appStore.renderConfig.outputSize.height),
      subtitlesEnabled,
      exportSubtitles,
      outputSize: {
        width: appStore.renderConfig.outputSize.width,
        height: appStore.renderConfig.outputSize.height,
      },
      outputDuration: String(ttsResult.duration),
      outputPath: appStore.renderConfig.outputPath.replace(/\\/g, '/') + '/' + outputFileName,
    })

    // 取消会让主进程返回 code 255；不能将它当作完成并继续自动批处理。
    if (task.finished || !hasRenderStatus(RenderStatus.Rendering)) return
    if (renderResult.code !== 0) {
      throw new Error(renderResult.stderr || `FFmpeg exited with code ${renderResult.code}`)
    }
    lastRenderedVideo.value = renderResult.outputPath ?? ''

    if (renderResult.subtitleExportError) {
      if (batch) batch.warningCount += 1
      const message = t('features.render.errors.subtitleExportFailed')
      const detail = `${renderResult.outputPath ?? ''}\n${renderResult.subtitleExportError}`
      toast.error({
        component: {
          render: () =>
            h(ActionToastEmbed, {
              message,
              detail,
              actionText: t('common.buttons.copyErrorDetail'),
              onActionTirgger: () => {
                navigator.clipboard.writeText(formatErrorForCopy(message, detail))
                toast.success(t('common.messages.success.copySuccess'))
              },
            }),
        },
      })
    } else {
      toast.success(t('features.render.success.succeeded'))
    }
    finishTask('succeeded')
    appStore.updateRenderStatus(RenderStatus.Completed)
  } catch (error: any) {
    if (task.finished) return
    console.error('视频合成失败:', error)
    finishTask('failed', error)
    if (
      batch &&
      (['permission_denied', 'disk_full', 'authentication_failed'].includes(classifyError(error)) ||
        String(error).includes('输出路径不存在'))
    ) {
      batch.stopRequested = true
      batch.stopReason = 'unrecoverable_error'
    }
    const errorMessage = error?.error?.message || error?.message || error
    toast.error({
      component: {
        // 使用vnode方式创建自定义错误弹窗实例，以获得良好的类型提示
        render: () =>
          h(ActionToastEmbed, {
            message: t('features.render.errors.failed'),
            detail: String(errorMessage),
            actionText: t('common.buttons.copyErrorDetail'),
            onActionTirgger: () => {
              navigator.clipboard.writeText(
                formatErrorForCopy(t('features.render.errors.failed'), String(errorMessage)),
              )
              toast.success(t('common.messages.success.copySuccess'))
            },
          }),
      },
    })
    appStore.updateRenderStatus(RenderStatus.Failed)
  }
}
const handleCancelRender = () => {
  if (appStore.batchProgress?.running) {
    appStore.batchProgress.stopRequested = true
    appStore.batchProgress.stopReason = 'user_cancelled'
  }
  console.log('视频合成终止')
  const task = activeGeneration
  switch (appStore.renderStatus) {
    case RenderStatus.SynthesizedSpeech:
      activeTtsSynthesisController?.abort()
      break

    case RenderStatus.SegmentVideo:
      break

    case RenderStatus.Rendering:
      window.ipcRenderer.send('cancel-render-video')
      break

    default:
      break
  }
  if (task) {
    task.finish?.('cancelled')
  }
  appStore.updateRenderStatus(RenderStatus.None)
  toast.info(t('features.render.info.canceled'))
}
</script>

<style lang="scss" scoped>
.app-shell {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr);
  overflow: hidden;
}

.app-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 0.9rem 0.7rem;
  background:
    radial-gradient(circle at 6% 0%, rgba(var(--v-theme-primary), 0.075), transparent 13rem),
    rgb(var(--v-theme-surface));
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.25rem 0.4rem 1rem;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.sidebar-brand-mark {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 12px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.11);
}

.sidebar-nav-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding-top: 1rem;
}

.sidebar-nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar-section-label {
  padding: 0 0.65rem 0.25rem;
  color: rgba(var(--v-theme-on-surface), 0.48);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.sidebar-nav-item {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 3px;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  min-height: 54px;
  padding: 0.35rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.72);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 120ms ease,
    background-color 120ms ease,
    color 120ms ease;
}

.sidebar-nav-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.045);
}

.sidebar-nav-item-active {
  border-color: rgba(var(--v-theme-primary), 0.14);
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.085);
}

.sidebar-nav-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 10px;
}

.sidebar-nav-item-active .sidebar-nav-icon {
  background: rgba(var(--v-theme-primary), 0.12);
}

.sidebar-nav-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.1rem;
}

.sidebar-nav-title {
  overflow: hidden;
  font-size: 0.83rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-nav-hint {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 0.67rem;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-nav-indicator {
  width: 3px;
  height: 22px;
  border-radius: 3px;
  background: rgb(var(--v-theme-primary));
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 0.85rem;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.sidebar-agent-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.55rem;
}

.agent-status-dot {
  flex: 0 0 9px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #4caf50;
  box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.12);
}

.agent-status-dot-busy {
  background: #651fff;
  box-shadow: 0 0 0 4px rgba(101, 31, 255, 0.13);
  animation: agent-pulse 1.4s ease-in-out infinite;
}

.sidebar-agent-title {
  font-size: 0.76rem;
  font-weight: 650;
}

.sidebar-agent-state,
.sidebar-footer-note {
  color: rgba(var(--v-theme-on-surface), 0.54);
  font-size: 0.66rem;
  line-height: 1.4;
}

.sidebar-footer-note {
  padding: 0.3rem 0.55rem 0.1rem;
}

@keyframes agent-pulse {
  50% {
    box-shadow: 0 0 0 7px rgba(101, 31, 255, 0.025);
  }
}

.app-page-area {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 80px;
  padding: 0.1rem 0.2rem 0.75rem;
}

.page-eyebrow {
  color: rgb(var(--v-theme-primary));
  font-size: 0.62rem;
  font-weight: 750;
  letter-spacing: 0.14em;
}

.page-title {
  margin-top: 0.12rem;
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.25;
}

.page-description {
  margin-top: 0.2rem;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.78rem;
}

.page-header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.6rem;
}

.page-context-chip {
  font-weight: 600;
}

.page-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workbench-view {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 314px;
  gap: 0.9rem;
}

.workbench-main {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
}

.studio-inspector {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 0.7rem;
  overflow-y: auto;
}

.inspector-card {
  padding: 0.9rem;
}

.inspector-card-heading,
.export-section-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.7rem;
}

.inspector-title {
  font-size: 0.86rem;
  font-weight: 700;
}

.inspector-caption {
  margin-top: 0.2rem;
  color: rgba(var(--v-theme-on-surface), 0.56);
  font-size: 0.68rem;
  line-height: 1.4;
}

.workflow-step-list {
  display: flex;
  flex-direction: column;
  margin-top: 0.75rem;
}

.workflow-step {
  position: relative;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) 18px;
  align-items: center;
  gap: 0.55rem;
  min-height: 57px;
  padding: 0.35rem 0.25rem;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.workflow-step:not(:last-child)::after {
  position: absolute;
  top: calc(50% + 14px);
  left: 13px;
  width: 1px;
  height: 28px;
  background: rgba(var(--v-border-color), 0.85);
  content: '';
}

.workflow-step-marker {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid rgba(var(--v-border-color), 0.8);
  border-radius: 50%;
  color: rgba(var(--v-theme-on-surface), 0.55);
  background: rgb(var(--v-theme-surface));
  font-size: 0.65rem;
  font-weight: 700;
  z-index: 1;
}

.workflow-step-complete .workflow-step-marker {
  border-color: rgba(76, 175, 80, 0.22);
  color: #2e7d32;
  background: rgba(76, 175, 80, 0.1);
}

.workflow-step-active .workflow-step-marker,
.workflow-step-next .workflow-step-marker {
  border-color: rgba(var(--v-theme-primary), 0.28);
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.09);
}

.workflow-step-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.1rem;
}

.workflow-step-title {
  font-size: 0.76rem;
  font-weight: 650;
}

.workflow-step-hint {
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 0.65rem;
  line-height: 1.25;
}

.workflow-step-arrow {
  color: rgba(var(--v-theme-on-surface), 0.34);
}

.workflow-step:hover .workflow-step-arrow {
  color: rgb(var(--v-theme-primary));
}

.voice-summary {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.75rem 0.8rem;
}

.voice-summary-icon,
.export-heading-icon {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.voice-summary-name {
  overflow: hidden;
  margin-top: 0.15rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.7rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inspector-actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.15rem 0.1rem 0.35rem;
}

.studio-primary-action {
  min-height: 56px;
  font-weight: 700;
  letter-spacing: 0;
}

.inspector-action-hint {
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 0.65rem;
  line-height: 1.45;
  text-align: center;
}

.content-page {
  overflow-y: auto;
}

.materials-page > :deep(*) {
  min-height: 620px;
}

.transcription-page > :deep(*) {
  width: 100%;
  min-height: 0;
}

.settings-page {
  align-items: center;
}

.settings-page > :deep(*) {
  width: min(100%, 1040px);
  min-height: 0;
}

.settings-page :deep(.settings-page-header) {
  padding: 0.3rem 0.15rem 0.45rem;
}

.settings-page :deep(.settings-panel) {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.035);
}

.export-view {
  align-items: stretch;
}

.export-layout {
  display: grid;
  width: min(100%, 1260px);
  min-height: 100%;
  grid-template-columns: minmax(0, 1.15fr) minmax(330px, 0.85fr);
  align-content: start;
  gap: 0.85rem;
  margin: 0 auto;
  padding-bottom: 1rem;
}

.export-options-column,
.export-render-column {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.8rem;
}

.export-options-card {
  display: flex;
  flex-direction: column;
  gap: 0.95rem;
  padding: 1rem;
}

.export-preview-card {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  padding: 1rem;
}

.export-preview-video {
  display: block;
  width: auto;
  max-width: 100%;
  height: 420px;
  max-height: 420px;
  margin: 0 auto;
  border-radius: 10px;
  background: #000;
}

.export-preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 132px;
  border: 1px dashed rgba(var(--v-border-color), 0.9);
  border-radius: 10px;
  color: rgba(var(--v-theme-on-surface), 0.45);
  font-size: 0.72rem;
}

.export-preview-path {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 0.68rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.export-section-heading {
  justify-content: flex-start;
  align-items: center;
}

.export-format-summary {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 0.6rem;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-top: 0.8rem;
}

.export-summary-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.22rem;
}

.export-summary-label {
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 0.66rem;
}

.export-summary-item strong {
  font-size: 0.73rem;
  font-weight: 650;
}

.export-render-note {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.35rem 0.2rem;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.68rem;
  line-height: 1.5;
}

.export-render-note :deep(.v-icon) {
  flex: 0 0 auto;
  margin-top: 1px;
}

@media (max-width: 1180px) {
  .app-shell {
    grid-template-columns: 218px minmax(0, 1fr);
  }

  .workbench-view {
    grid-template-columns: minmax(0, 1fr) 286px;
  }

  .export-layout {
    grid-template-columns: minmax(0, 1fr) minmax(310px, 0.8fr);
  }
}

@media (max-width: 980px) {
  .workbench-view {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
  }

  .workbench-main {
    min-height: 560px;
  }

  .studio-inspector {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 0.8fr);
    align-items: start;
    overflow: visible;
  }

  .workflow-card {
    grid-row: span 2;
  }

  .inspector-actions {
    grid-column: 2;
  }

  .export-layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .export-render-column {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 0.7fr);
    align-items: start;
  }

  .export-render-note {
    grid-column: 2;
  }
}

@media (max-width: 820px) {
  .app-shell {
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .app-sidebar {
    align-items: center;
    padding: 0.75rem 0.3rem;
  }

  .sidebar-brand {
    justify-content: center;
    padding-inline: 0;
    padding-bottom: 0.75rem;
  }

  .sidebar-brand > div,
  .sidebar-section-label,
  .sidebar-nav-copy,
  .sidebar-nav-indicator {
    display: none;
  }

  .sidebar-footer {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    margin-top: auto;
    padding-top: 0.35rem;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .sidebar-agent-card,
  .sidebar-footer-note {
    display: none;
  }

  .sidebar-nav-list {
    width: 100%;
    gap: 0.8rem;
  }

  .sidebar-nav-item {
    display: flex;
    justify-content: center;
    min-width: 0;
    min-height: 48px;
    padding: 0;
  }

  .sidebar-nav-icon {
    width: 42px;
    height: 42px;
  }

  .page-header {
    min-height: 74px;
  }

  .page-header-actions .page-context-chip {
    display: none;
  }

  .studio-inspector {
    grid-template-columns: minmax(0, 1fr);
  }

  .workflow-card {
    grid-row: auto;
  }

  .inspector-actions {
    grid-column: auto;
  }

  .export-render-column {
    grid-template-columns: minmax(0, 1fr);
  }

  .export-render-note {
    grid-column: auto;
  }

  .export-format-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}

.title-bar {
  user-select: none;
}
</style>
