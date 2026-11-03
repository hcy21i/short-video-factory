<template>
  <div class="media-library-shell w-full h-full">
    <v-form class="h-full" :disabled="disabled">
      <v-sheet class="media-library-panel h-full flex flex-col overflow-hidden" border rounded>
        <div class="media-library-toolbar">
          <div class="media-library-heading">
            <div class="media-library-mark"><v-icon>mdi-folder-multiple-image</v-icon></div>
            <div class="min-w-0 flex-1">
              <div class="media-library-title">{{ t('features.workspace.materialCanvasTitle') }}</div>
              <div class="media-library-subtitle">{{ t('features.workspace.materialCanvasHint') }}</div>
            </div>
            <v-chip v-if="videoAssets.length" size="small" color="primary" variant="tonal">
              {{ t('features.workspace.mediaCount', { count: videoAssets.length }) }}
            </v-chip>
          </div>
          <div class="media-source-toolbar">
            <div class="media-source-heading">
              <div class="media-source-title">{{ t('features.assets.sources.title') }}</div>
              <div class="media-source-hint">{{ t('features.assets.sources.hint') }}</div>
            </div>
            <v-btn
              class="media-select-folder"
              prepend-icon="mdi-folder-plus-outline"
              :disabled="disabled || scanAllLoading"
              @click="handleAddFolder"
            >
              {{ t('features.assets.sources.addFolder') }}
            </v-btn>
          </div>
          <div v-if="appStore.videoAssetFolders.length" class="media-source-list">
            <v-sheet
              v-for="folder in appStore.videoAssetFolders"
              :key="folder.path"
              class="media-source-card"
              border
              rounded
            >
              <v-checkbox-btn
                :model-value="folder.enabled"
                :disabled="disabled || scanAllLoading || loadingFolderPaths.includes(folder.path)"
                color="primary"
                :aria-label="t('features.assets.sources.includeInEdit')"
                @update:model-value="setFolderEnabled(folder.path, $event)"
              />
              <v-icon class="media-source-icon" color="primary">mdi-folder-video-outline</v-icon>
              <div class="media-source-path min-w-0 flex-1" :title="folder.path">
                <div class="media-source-name">{{ getFolderName(folder.path) }}</div>
                <div class="media-source-location">{{ folder.path }}</div>
              </div>
              <v-chip size="small" variant="tonal">
                {{ t('features.workspace.mediaCount', { count: getFolderAssets(folder.path).length }) }}
              </v-chip>
              <v-chip v-if="!isFolderScanned(folder.path)" size="x-small" variant="outlined">
                {{ t('features.assets.sources.notScanned') }}
              </v-chip>
              <v-btn
                icon="mdi-refresh"
                size="small"
                variant="text"
                :disabled="disabled || scanAllLoading || loadingFolderPaths.includes(folder.path)"
                :loading="loadingFolderPaths.includes(folder.path)"
                :aria-label="t('features.assets.sources.scanFolder')"
                :title="t('features.assets.sources.scanFolder')"
                @click="scanFolder(folder.path)"
              />
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                :disabled="disabled || scanAllLoading || loadingFolderPaths.includes(folder.path)"
                :aria-label="t('features.assets.sources.removeFolder')"
                :title="t('features.assets.sources.removeFolder')"
                @click="removeFolder(folder.path)"
              />
            </v-sheet>
          </div>
          <div v-else class="media-source-empty">
            <v-icon size="18">mdi-folder-plus-outline</v-icon>
            <span>{{ t('features.assets.sources.empty') }}</span>
          </div>
        </div>

        <v-sheet
          v-if="latestAnalysis"
          class="media-analysis-result mx-3 mb-3 p-3 max-h-[156px] overflow-y-auto"
          color="primary"
          variant="tonal"
          rounded
        >
          <div class="flex items-center gap-2 text-sm font-medium">
            <v-icon size="small">mdi-robot-outline</v-icon>
            {{ t('features.agent.analysisResult') }}
            <v-chip size="x-small" variant="outlined">
              {{ t(`features.agent.analysisModes.${latestAnalysis.mode}`) }}
            </v-chip>
          </div>
          <div class="mt-1 text-sm leading-5">{{ latestAnalysis.summary }}</div>
          <div v-if="latestAnalysis.scenes.length" class="mt-2 flex flex-wrap gap-1">
            <v-chip
              v-for="scene in latestAnalysis.scenes.slice(0, 6)"
              :key="scene.id"
              size="x-small"
              variant="outlined"
              :title="scene.description"
            >
              {{ scene.name }}
            </v-chip>
          </div>
        </v-sheet>

        <v-sheet
          v-if="reviewSummary"
          class="media-analysis-result media-review-result mx-3 mb-3 p-3"
          color="warning"
          variant="tonal"
          rounded
        >
          <div class="flex items-center gap-2 text-sm font-medium">
            <v-icon size="small">mdi-content-cut</v-icon>
            {{ t('features.assets.sources.reviewTitle') }}
            <v-switch
              v-model="appStore.skipUnusableShots"
              class="media-review-switch"
              color="warning"
              density="compact"
              hide-details
              :label="t('features.assets.sources.reviewToggle')"
            />
            <v-spacer />
            <v-btn size="x-small" variant="text" @click="clearReview">
              {{ t('features.assets.sources.reviewClear') }}
            </v-btn>
          </div>
          <div class="mt-1 text-sm leading-5">{{ reviewSummary }}</div>
          <div v-if="reviewedRangeSummary.length" class="review-range-list mt-2">
            <div
              v-for="item in reviewedRangeSummary"
              :key="item.path"
              class="review-range-file"
            >
              <div class="review-range-file-head">
                <v-icon size="15">mdi-movie-open-outline</v-icon>
                <span class="review-range-file-name" :title="item.path">{{ item.name }}</span>
                <v-chip size="x-small" variant="outlined">
                  {{ t('features.assets.sources.reviewRangeCount', { count: item.ranges.length, seconds: item.seconds.toFixed(1) }) }}
                </v-chip>
                <v-spacer />
                <v-btn
                  v-if="canResetFileReview(item.path)"
                  size="x-small"
                  variant="text"
                  @click="resetFileReview(item.path)"
                >
                  {{ t('features.assets.sources.reviewRangeReset') }}
                </v-btn>
              </div>
              <div
                v-for="(range, index) in item.ranges"
                :key="`${item.path}-${index}-${range.startSeconds}-${range.endSeconds}`"
                class="review-range-row"
              >
                <span class="review-range-reason" :title="range.reason">{{ range.reason }}</span>
                <label class="review-range-field">
                  <span>{{ t('features.assets.sources.reviewRangeStart') }}</span>
                  <input
                    class="review-range-input"
                    type="number"
                    step="0.1"
                    min="0"
                    :value="range.startSeconds.toFixed(1)"
                    @change="onRangeInput(item.path, index, 'startSeconds', $event)"
                  />
                </label>
                <label class="review-range-field">
                  <span>{{ t('features.assets.sources.reviewRangeEnd') }}</span>
                  <input
                    class="review-range-input"
                    type="number"
                    step="0.1"
                    min="0"
                    :value="range.endSeconds.toFixed(1)"
                    @change="onRangeInput(item.path, index, 'endSeconds', $event)"
                  />
                </label>
                <v-btn
                  size="x-small"
                  variant="text"
                  icon="mdi-arrow-left"
                  :title="t('features.assets.sources.reviewRangeShiftLeft')"
                  @click="shiftUnusableRange(item.path, index, -0.5)"
                />
                <v-btn
                  size="x-small"
                  variant="text"
                  icon="mdi-arrow-right"
                  :title="t('features.assets.sources.reviewRangeShiftRight')"
                  @click="shiftUnusableRange(item.path, index, 0.5)"
                />
                <v-btn
                  size="x-small"
                  variant="text"
                  icon="mdi-image-search-outline"
                  :title="t('features.assets.sources.reviewRangePreview')"
                  :loading="previewingRange && previewKey === `${item.path}:${index}`"
                  @click="previewUnusableRange(item.path, index)"
                />
                <v-btn
                  size="x-small"
                  variant="text"
                  icon="mdi-delete-outline"
                  :title="t('features.assets.sources.reviewRangeRemove')"
                  @click="removeUnusableRange(item.path, index)"
                />
              </div>
            </div>
          </div>
        </v-sheet>

        <!-- 抽帧确认：把要剪掉的那几秒摊开看，避免误剪好镜头或漏掉笑场 -->
        <v-dialog v-model="rangePreviewOpen" max-width="620" scrollable>
          <v-card>
            <v-card-title class="text-base">
              {{ rangePreview?.label ?? '' }}
            </v-card-title>
            <v-card-text>
              <div v-if="previewingRange" class="review-preview-loading">
                <v-progress-circular indeterminate size="20" />
                <span>{{ t('features.assets.sources.reviewRangePreviewLoading') }}</span>
              </div>
              <div v-else class="review-preview-grid">
                <figure v-for="frame in rangePreview?.frames ?? []" :key="frame.label">
                  <img :src="frame.src" :alt="frame.label" />
                  <figcaption>{{ frame.label }}</figcaption>
                </figure>
              </div>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn variant="text" @click="rangePreviewOpen = false">
                {{ t('common.buttons.close') }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <div class="media-canvas flex-1 h-0 w-full">
          <div class="media-canvas-heading">
            <div>
              <div class="media-canvas-title">{{ t('features.assets.sources.selectedMaterials') }}</div>
              <div class="media-canvas-caption">{{ t('features.assets.sources.selectedMaterialsHint') }}</div>
            </div>
            <div class="media-canvas-actions">
              <span class="media-asset-count">
                {{ t('features.assets.sources.selectionSummary', { selected: selectedAssetPaths.length, total: videoAssets.length }) }}
              </span>
              <v-btn
                size="small"
                variant="text"
                :disabled="disabled || !videoAssets.length || selectedAssetPaths.length === videoAssets.length"
                @click="selectAllAssets"
              >
                {{ t('features.assets.sources.selectAll') }}
              </v-btn>
              <v-btn
                size="small"
                variant="text"
                :disabled="disabled || !selectedAssetPaths.length"
                @click="clearAssetSelection"
              >
                {{ t('features.assets.sources.clearSelection') }}
              </v-btn>
              <v-btn
                class="media-review-button"
                size="small"
                color="warning"
                variant="tonal"
                prepend-icon="mdi-content-cut"
                :disabled="disabled || !selectedAssetPaths.length || analyzingSelection"
                :loading="reviewingShots"
                @click="reviewSelectedShots"
              >
                {{ t('features.assets.sources.reviewShots') }}
              </v-btn>
              <v-btn
                class="media-analyze-button"
                size="small"
                color="primary"
                variant="tonal"
                prepend-icon="mdi-robot-outline"
                :disabled="disabled || !selectedAssetPaths.length || reviewingShots"
                :loading="analyzingSelection"
                @click="analyzeSelectedAssets"
              >
                {{ t('features.assets.sources.analyzeSelected') }}
              </v-btn>
            </div>
          </div>
          <div
            v-if="videoAssets.length"
            class="media-asset-grid w-full max-h-full overflow-y-auto grid grid-cols-2 xl:grid-cols-3 gap-3 p-3"
          >
            <div
              class="media-asset-card w-full h-full max-h-[220px]"
              :class="{ 'media-asset-card--off': !isAssetSelected(item.path) }"
              v-for="item in videoAssets"
              :key="item.path"
            >
              <VideoAutoPreview :asset="item" />
              <v-checkbox-btn
                class="media-asset-check"
                :model-value="isAssetSelected(item.path)"
                :disabled="disabled || analyzingSelection"
                color="primary"
                density="comfortable"
                :aria-label="t('features.assets.sources.includeInEdit')"
                @update:model-value="setAssetSelected(item.path, $event)"
              />
              <v-chip
                v-if="getUnusableRanges(item.path).length"
                class="media-asset-badge media-asset-badge--warning"
                size="x-small"
                color="warning"
                variant="flat"
              >
                {{ t('features.assets.sources.reviewBadge', { count: getUnusableRanges(item.path).length }) }}
              </v-chip>
              <v-chip
                v-else-if="isAssetAnalyzed(item.path)"
                class="media-asset-badge"
                size="x-small"
                color="primary"
                variant="flat"
              >
                {{ t('features.assets.sources.analyzed') }}
              </v-chip>
            </div>
          </div>
          <v-empty-state
            v-else
            class="media-empty-state"
            icon="mdi-filmstrip-box-multiple-outline"
            :headline="t('emptyStates.noContent')"
            :text="t('emptyStates.hintSelectFolder')"
          ></v-empty-state>
        </div>

        <div class="media-library-footer">
          <div class="media-library-footer-copy">
            <v-icon size="17" color="primary">mdi-auto-fix</v-icon>
            <span>{{ t('features.workspace.materialsReadyHint') }}</span>
          </div>
          <v-btn
            class="media-refresh-button"
            prepend-icon="mdi-magnify-scan"
            :disabled="disabled || !appStore.videoAssetFolders.length || loadingFolderPaths.length > 0"
            :loading="scanAllLoading"
            @click="scanAllFolders"
          >
            {{ t('features.assets.sources.scanAll') }}
          </v-btn>
        </div>
      </v-sheet>
    </v-form>
  </div>
</template>

<script lang="ts" setup>
import { computed, h, onMounted, ref } from 'vue'
import { useTranslation } from 'i18next-vue'
import { useAppStore } from '@/store'
import { useToast } from 'vue-toastification'
import { ListFilesFromFolderRecord } from '~/electron/types'
import { RenderVideoParams } from '~/electron/ffmpeg/types'
import VideoAutoPreview from '@/components/VideoAutoPreview.vue'
import ActionToastEmbed from '@/components/ActionToastEmbed.vue'
import random from 'random'
import { formatErrorForCopy } from '@/lib/error-copy'
import { trackAnalytics } from '@/lib/analytics'
import {
  analyzeMaterials as analyzeMaterialFrames,
  type MaterialAnalysis,
  type MaterialFrame,
} from '@/lib/agent/material-analysis'
import { getLlmConfigIssue, normalizeLlmConfig } from '@/lib/llm/config'
import {
  reviewShots,
  type ReviewFrameSample,
  type ReviewMaterialInput,
  type UnusableRange,
} from '@/lib/agent/shot-review'
import {
  buildAllowedSpans,
  pickSegmentFromSpans,
  resizeRangeEdge,
  shiftRange,
  type RangeEdge,
} from '@/lib/agent/shot-ranges'

const toast = useToast()
const appStore = useAppStore()
const { t } = useTranslation()

defineProps<{
  disabled?: boolean
}>()

// 素材源只保存目录与启用状态，扫描结果留在内存中，避免把大量文件路径写入持久化配置。
const assetsByFolder = ref<Record<string, ListFilesFromFolderRecord[]>>({})
const scannedFolderPaths = ref<string[]>([])
const loadingFolderPaths = ref<string[]>([])
const scanAllLoading = ref(false)
const videoDurationCache = ref(new Map<string, number>())
const latestAnalysis = ref<MaterialAnalysis | null>(null)
// 素材或勾选状态一变，之前的分析结论就失效，连提示词里的上下文一起清掉
const resetAnalysis = () => {
  latestAnalysis.value = null
  appStore.materialAnalysisContext = ''
}
const folderKey = (folderPath: string) => folderPath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
const getFolderAssets = (folderPath: string) => assetsByFolder.value[folderKey(folderPath)] ?? []
const isFolderScanned = (folderPath: string) =>
  scannedFolderPaths.value.some((path) => folderKey(path) === folderKey(folderPath))
const videoAssets = computed(() =>
  appStore.videoAssetFolders
    .filter((folder) => folder.enabled)
    .flatMap((folder) => getFolderAssets(folder.path)),
)

// 素材逐个打勾：只有勾上的片段会进剪辑，其余保留在库里但不参与分镜。
const selectedAssetPaths = ref<string[]>([])
const analyzedAssetPaths = ref<string[]>([])
// 分析给出的推荐顺序，剪辑时优先按它排片
const recommendedAssetPaths = ref<string[]>([])
const analyzingSelection = ref(false)
// 废镜头检测：按素材路径记下不能用的时间段（笑场、NG、糊焦、遮挡）
const unusableRangesByPath = ref(new Map<string, UnusableRange[]>())
// 模型原始结论留一份：手动微调完还能一键还原，不用重新花 token 检测
const originalUnusableRangesByPath = ref(new Map<string, UnusableRange[]>())
const reviewingShots = ref(false)
const reviewSummary = ref('')
const getUnusableRanges = (assetPath: string): UnusableRange[] =>
  unusableRangesByPath.value.get(assetPath) ?? []
// 检测结果按素材汇总：文件名 + 剔除段数 + 总秒数 + 逐段可编辑
const reviewedRangeSummary = computed(() =>
  videoAssets.value
    .filter((asset) => getUnusableRanges(asset.path).length)
    .map((asset) => {
      const ranges = getUnusableRanges(asset.path)
      const seconds = ranges.reduce((sum, range) => sum + (range.endSeconds - range.startSeconds), 0)
      return {
        path: asset.path,
        name: asset.name,
        ranges,
        seconds,
        label: `${asset.name} · ${ranges.length} 段 ${seconds.toFixed(1)}s`,
        detail: ranges
          .map((range) => `${range.startSeconds.toFixed(1)}-${range.endSeconds.toFixed(1)}s ${range.reason}`)
          .join('\n'),
      }
    }),
)
const isAssetSelected = (assetPath: string) => selectedAssetPaths.value.includes(assetPath)
const isAssetAnalyzed = (assetPath: string) => analyzedAssetPaths.value.includes(assetPath)
const setAssetSelected = (assetPath: string, selected: boolean | null) => {
  const next = new Set(selectedAssetPaths.value)
  if (selected === true) next.add(assetPath)
  else next.delete(assetPath)
  selectedAssetPaths.value = [...next]
  // 选择变了，旧的分析结论不再对应这批素材
  resetAnalysis()
}
const selectAllAssets = () => {
  selectedAssetPaths.value = videoAssets.value.map((asset) => asset.path)
  resetAnalysis()
}
const clearAssetSelection = () => {
  selectedAssetPaths.value = []
  resetAnalysis()
}
const selectedVideoAssets = computed(() =>
  videoAssets.value.filter((asset) => isAssetSelected(asset.path)),
)
const getFolderName = (folderPath: string) =>
  folderPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || folderPath

const handleAddFolder = async () => {
  const folderPath = await window.electron.selectFolder({
    title: t('dialogs.selectAssetsFolder'),
    defaultPath: appStore.videoAssetFolders.at(-1)?.path || appStore.videoAssetsFolder,
  })
  if (!folderPath) return

  const key = folderKey(folderPath)
  if (appStore.videoAssetFolders.some((folder) => folderKey(folder.path) === key)) {
    toast.info(t('features.assets.sources.folderAlreadyAdded'))
    return
  }

  appStore.videoAssetFolders.push({ path: folderPath, enabled: true })
  appStore.videoAssetsFolder = folderPath
  resetAnalysis()
  await scanFolder(folderPath, { trackSelection: true })
}

const setFolderEnabled = (folderPath: string, enabled: boolean | null) => {
  const folder = appStore.videoAssetFolders.find((item) => folderKey(item.path) === folderKey(folderPath))
  if (folder) {
    folder.enabled = enabled === true
    resetAnalysis()
  }
}

const removeFolder = (folderPath: string) => {
  const key = folderKey(folderPath)
  const index = appStore.videoAssetFolders.findIndex((folder) => folderKey(folder.path) === key)
  if (index === -1) return
  appStore.videoAssetFolders.splice(index, 1)
  const nextFolder = appStore.videoAssetFolders.at(-1)?.path ?? ''
  if (folderKey(appStore.videoAssetsFolder) === key) appStore.videoAssetsFolder = nextFolder
  const removedPaths = new Set(getFolderAssets(folderPath).map((asset) => asset.path))
  delete assetsByFolder.value[key]
  scannedFolderPaths.value = scannedFolderPaths.value.filter((path) => folderKey(path) !== key)
  videoDurationCache.value.clear()
  selectedAssetPaths.value = selectedAssetPaths.value.filter((path) => !removedPaths.has(path))
  analyzedAssetPaths.value = analyzedAssetPaths.value.filter((path) => !removedPaths.has(path))
  resetAnalysis()
}

const getAssetCountBucket = (count: number) => {
  if (count === 0) return '0'
  if (count === 1) return '1'
  if (count <= 5) return '2–5'
  if (count <= 20) return '6–20'
  return '21+'
}

const scanFolder = async (
  folderPath: string,
  options: { trackSelection?: boolean; quiet?: boolean } = {},
): Promise<number | null> => {
  const key = folderKey(folderPath)
  if (loadingFolderPaths.value.includes(folderPath)) return null
  loadingFolderPaths.value = [...loadingFolderPaths.value, folderPath]
  try {
    resetAnalysis()
    const assets = await window.electron.listFilesFromFolder({ folderPath })
    const mp4Assets = assets.filter((asset) => asset.name.toLowerCase().endsWith('.mp4'))
    videoDurationCache.value.clear()
    assetsByFolder.value = { ...assetsByFolder.value, [key]: mp4Assets }
    // 新扫到的素材默认勾上，用户再按需取消；已不存在的路径从勾选里剔除
    const scannedPaths = new Set(mp4Assets.map((asset) => asset.path))
    const knownPaths = new Set(videoAssets.value.map((asset) => asset.path))
    selectedAssetPaths.value = [...new Set([
      ...selectedAssetPaths.value.filter((path) => knownPaths.has(path) || scannedPaths.has(path)),
      ...scannedPaths,
    ])]
    analyzedAssetPaths.value = analyzedAssetPaths.value.filter((path) => scannedPaths.has(path))
    scannedFolderPaths.value = [...new Set([...scannedFolderPaths.value, folderPath])]
    if (options.trackSelection) {
      trackAnalytics('media_import_finished', {
        outcome: 'success',
        media_type: 'video',
        count_bucket: getAssetCountBucket(mp4Assets.length),
      })
    }
    console.info('素材文件夹扫描完成', { folderPath, assetCount: assets.length, mp4Count: mp4Assets.length })
    if (mp4Assets.length) {
      if (!options.quiet) toast.success(t('features.assets.success.loadSucceeded'))
    } else if (!options.quiet) {
      toast.warning(
        assets.length
          ? t('features.assets.errors.noMp4InFolder')
          : t('emptyStates.assetsFolderEmpty'),
      )
    }
    return mp4Assets.length
  } catch (error: any) {
    if (options.trackSelection) {
      trackAnalytics('media_import_finished', { outcome: 'failed', media_type: 'video' })
    }
    console.dir(error)
    const errorMessage = error?.error?.message || error?.message || error
    if (!options.quiet) {
      toast.error({
        component: {
          render: () =>
            h(ActionToastEmbed, {
              message: t('features.assets.errors.loadFailed'),
              detail: String(errorMessage),
              actionText: t('common.buttons.copyErrorDetail'),
              onActionTirgger: () => {
                navigator.clipboard.writeText(
                  formatErrorForCopy(t('features.assets.errors.loadFailed'), String(errorMessage)),
                )
                toast.success(t('common.messages.success.copySuccess'))
              },
            }),
        },
      })
    }
    return null
  } finally {
    loadingFolderPaths.value = loadingFolderPaths.value.filter((path) => path !== folderPath)
  }
}

const scanAllFolders = async () => {
  if (scanAllLoading.value || loadingFolderPaths.value.length || !appStore.videoAssetFolders.length) return
  scanAllLoading.value = true
  try {
    const results = await Promise.all(
      appStore.videoAssetFolders.map((folder) => scanFolder(folder.path, { quiet: true })),
    )
    const scanned = results.filter((count): count is number => count !== null)
    const totalAssets = scanned.reduce((total, count) => total + count, 0)
    const failedCount = results.length - scanned.length
    if (scanned.length) {
      toast.success(
        t('features.assets.sources.scanCompleted', {
          folderCount: scanned.length,
          assetCount: totalAssets,
          failedCount,
        }),
      )
    } else {
      toast.warning(t('features.assets.errors.loadFailed'))
    }
  } finally {
    scanAllLoading.value = false
  }
}

onMounted(async () => {
  const folders = appStore.videoAssetFolders.length
    ? appStore.videoAssetFolders
    : appStore.videoAssetsFolder
      ? [{ path: appStore.videoAssetsFolder, enabled: true }]
      : []
  if (!appStore.videoAssetFolders.length && folders.length) {
    appStore.videoAssetFolders = folders
  }
  if (folders.length) {
    await Promise.all(folders.map((folder) => scanFolder(folder.path, { quiet: true })))
  }
})

const readVideoDuration = (assetPath: string) => {
  const cached = videoDurationCache.value.get(assetPath)
  if (typeof cached === 'number' && Number.isFinite(cached) && cached > 0) {
    return Promise.resolve(cached)
  }

  return new Promise<number>((resolve, reject) => {
    const video = document.createElement('video')
    const normalizedPath = assetPath.replace(/\\/g, '/')
    const src = normalizedPath.startsWith('/')
      ? `file://${normalizedPath}`
      : `file:///${normalizedPath}`
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('读取视频元数据超时'))
    }, 8000)

    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', onLoaded)
      video.removeEventListener('error', onError)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }

    const onLoaded = () => {
      const duration = video.duration
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error('视频时长无效'))
        return
      }
      videoDurationCache.value.set(assetPath, duration)
      resolve(duration)
    }

    const onError = () => {
      cleanup()
      reject(new Error('视频元数据读取失败'))
    }

    video.preload = 'metadata'
    video.addEventListener('loadedmetadata', onLoaded)
    video.addEventListener('error', onError)
    video.src = encodeURI(src)
  })
}

const fileUrl = (assetPath: string) => {
  const normalizedPath = assetPath.replace(/\\/g, '/')
  return normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`
}

// ratio 是取帧位置：0.5 取正中间（给文案分析用），废镜头检测会按时间轴传多个位置
const captureFrameAt = (
  asset: ListFilesFromFolderRecord,
  signal: AbortSignal,
  ratio = 0.5,
  // 喂给文案分析的缩略图够看场景就行；判笑场要看表情和手部动作，得给更高的分辨率
  options: { longerSide?: number; quality?: number } = {},
): Promise<{ image: Uint8Array; durationSeconds: number }> =>
  new Promise((resolve, reject) => {
    const video = document.createElement('video')
    let timeout = 0
    let captured = false
    let targetTime = 0
    const cleanup = () => {
      window.clearTimeout(timeout)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('loadeddata', onFrameReady)
      video.removeEventListener('seeked', onFrameReady)
      video.removeEventListener('error', onError)
      signal.removeEventListener('abort', onAbort)
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    const fail = (error: Error) => {
      cleanup()
      reject(error)
    }
    const onAbort = () => fail(new DOMException('素材分析已取消', 'AbortError'))
    const onError = () => fail(new Error('无法读取视频画面'))
    const onFrameReady = () => {
      if (captured || video.readyState < 2 || Math.abs(video.currentTime - targetTime) > 0.08)
        return
      captured = true
      try {
        const longerSide = options.longerSide ?? 512
        const scale = Math.min(1, longerSide / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法读取视频画面')
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', options.quality ?? 0.58).split(',')[1]
        if (!base64) throw new Error('无法编码视频画面')
        const binary = atob(base64)
        const image = Uint8Array.from(binary, (character) => character.charCodeAt(0))
        const durationSeconds = video.duration
        cleanup()
        resolve({ image, durationSeconds })
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)))
      }
    }
    const onLoadedMetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        fail(new Error('视频时长无效'))
        return
      }
      const safeRatio = Math.min(Math.max(0, ratio), 1)
      targetTime = Math.min(
        Math.max(0, video.duration * safeRatio),
        Math.max(0, video.duration - 0.1),
      )
      if (targetTime > 0.05) video.currentTime = targetTime
      else window.setTimeout(onFrameReady, 0)
    }

    if (signal.aborted) {
      onAbort()
      return
    }
    timeout = window.setTimeout(() => fail(new Error('读取视频画面超时')), 5000)
    signal.addEventListener('abort', onAbort, { once: true })
    video.preload = 'auto'
    video.muted = true
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('loadeddata', onFrameReady)
    video.addEventListener('seeked', onFrameReady)
    video.addEventListener('error', onError)
    video.src = encodeURI(fileUrl(asset.path))
  })

// 先分析、再写文案：只分析勾选出来的素材，结论既显示在面板里，也写进 store 供文案提示词使用。
const analyzeSelectedAssets = async () => {
  if (analyzingSelection.value) return
  if (!selectedVideoAssets.value.length) {
    toast.warning(t('features.assets.errors.noSelectedAssets'))
    return
  }
  const analysisConfig = appStore.analysisUsesCopywritingModel
    ? appStore.llmConfig
    : appStore.analysisLlmConfig
  if (getLlmConfigIssue(analysisConfig)) {
    toast.warning(t('features.agent.llmConfigRequired'))
    return
  }

  analyzingSelection.value = true
  const controller = new AbortController()
  const selected = selectedVideoAssets.value
  const maximumSamples = 10
  const sampleAssets: ListFilesFromFolderRecord[] =
    selected.length <= maximumSamples
      ? [...selected]
      : Array.from(
          { length: maximumSamples },
          (_, index) => selected[Math.round((index * (selected.length - 1)) / (maximumSamples - 1))],
        ).filter((asset): asset is ListFilesFromFolderRecord => Boolean(asset))
  const frames: MaterialFrame[] = []

  try {
    for (let index = 0; index < sampleAssets.length; index += 1) {
      const asset = sampleAssets[index]
      const frame: MaterialFrame = {
        id: `M${String(index + 1).padStart(2, '0')}`,
        name: asset.name,
      }
      try {
        const captured = await captureFrameAt(asset, controller.signal)
        frame.image = captured.image
        frame.durationSeconds = captured.durationSeconds
        videoDurationCache.value.set(asset.path, captured.durationSeconds)
      } catch (error) {
        if ((error as { name?: string })?.name === 'AbortError') throw error
        // 取不到画面时仍然把文件名交给模型，避免整次分析因为一条素材失败而中断
      }
      frames.push(frame)
    }

    const locale = appStore.locale || navigator.language || 'zh-CN'
    const analysis = await analyzeMaterialFrames({
      llmConfig: normalizeLlmConfig(analysisConfig),
      materials: frames,
      platform: appStore.agentPlatform,
      targetDurationSeconds: Number(appStore.agentTargetDurationSeconds) || 0,
      creativeBrief: String(appStore.prompt ?? ''),
      language: locale.toLowerCase().startsWith('en') ? 'English' : 'Simplified Chinese',
      abortSignal: controller.signal,
    })
    latestAnalysis.value = analysis
  const assetsById = new Map<string, string>()
  frames.forEach((frame, index) => {
    const path = sampleAssets[index]?.path
    if (path) assetsById.set(frame.id, path)
  })
  const preferredAssetPaths = [
    ...analysis.recommendedOrder.flatMap((id) => {
      const path = assetsById.get(id)
      return path ? [path] : []
    }),
    ...selected.map((asset) => asset.path)
      .filter((path) => !analysis.recommendedOrder.some((id) => assetsById.get(id) === path)),
  ]
  const promptContext = [
    analysis.summary,
    ...analysis.scenes.map(
      (scene) =>
        `${scene.name}: ${scene.description}${scene.keywords.length ? `（${scene.keywords.join('、')}）` : ''}`,
    ),
  ]
    .filter(Boolean)
    .join('\n')

    // 写进 store，文案生成时会作为“画面里有什么”的前提拼进提示词
    appStore.materialAnalysisContext = promptContext
    recommendedAssetPaths.value = preferredAssetPaths
    const analyzed = new Set(analyzedAssetPaths.value)
    sampleAssets.forEach((asset) => analyzed.add(asset.path))
    analyzedAssetPaths.value = [...analyzed]
    toast.success(t('features.assets.sources.analyzeSucceeded'))
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    const detail = (error as { error?: { message?: string }; message?: string })?.error?.message
      || (error as Error)?.message
      || String(error)
    toast.error({
      component: {
        render: () =>
          h(ActionToastEmbed, {
            message: t('features.assets.errors.analyzeFailed'),
            detail,
            actionText: t('common.buttons.copyErrorDetail'),
            onActionTirgger: () => {
              navigator.clipboard.writeText(
                formatErrorForCopy(t('features.assets.errors.analyzeFailed'), detail),
              )
              toast.success(t('common.messages.success.copySuccess'))
            },
          }),
      },
    })
  } finally {
    analyzingSelection.value = false
  }
}

// 沿时间轴取样：废镜头往往只占几秒，只看中间一帧会漏掉笑场
// 采样点密一些：笑场往往只有一两秒，6 个点容易漏过去
const SHOT_REVIEW_RATIOS = [0.06, 0.18, 0.3, 0.42, 0.54, 0.66, 0.78, 0.9]

// 废镜头检测：给每条勾选素材沿时间轴抽帧交给视觉模型，标出不能用的时间段
const reviewSelectedShots = async () => {
  if (reviewingShots.value || analyzingSelection.value) return
  if (!selectedVideoAssets.value.length) {
    toast.warning(t('features.assets.errors.noSelectedAssets'))
    return
  }
  const analysisConfig = appStore.analysisUsesCopywritingModel
    ? appStore.llmConfig
    : appStore.analysisLlmConfig
  if (getLlmConfigIssue(analysisConfig)) {
    toast.warning(t('features.agent.llmConfigRequired'))
    return
  }

  reviewingShots.value = true
  reviewSummary.value = ''
  const controller = new AbortController()
  try {
    const selected = selectedVideoAssets.value.slice(0, 12)
    const materials: ReviewMaterialInput[] = []
    const pathById = new Map<string, string>()
    for (let index = 0; index < selected.length; index += 1) {
      const asset = selected[index]
      const frames: ReviewFrameSample[] = []
      let durationSeconds = 0
      for (const ratio of SHOT_REVIEW_RATIOS) {
        try {
          const captured = await captureFrameAt(asset, controller.signal, ratio, {
            longerSide: 768,
            quality: 0.72,
          })
          durationSeconds = captured.durationSeconds
          frames.push({
            timeSeconds: captured.durationSeconds * ratio,
            image: captured.image,
          })
        } catch (error) {
          if ((error as { name?: string })?.name === 'AbortError') throw error
          // 单帧取不到就跳过，别让一条素材拖垮整次检测
        }
      }
      if (!durationSeconds) {
        try {
          durationSeconds = await readVideoDuration(asset.path)
        } catch {
          durationSeconds = 0
        }
      }
      if (!frames.length || !durationSeconds) continue
      videoDurationCache.value.set(asset.path, durationSeconds)
      const id = `S${String(index + 1).padStart(2, '0')}`
      pathById.set(id, asset.path)
      materials.push({ id, name: asset.name, durationSeconds, frames })
    }

    if (!materials.length) throw new Error(t('features.assets.errors.noFramesForReview'))

    const locale = appStore.locale || navigator.language || 'zh-CN'
    const review = await reviewShots({
      llmConfig: normalizeLlmConfig(analysisConfig),
      materials,
      language: locale.toLowerCase().startsWith('en') ? 'English' : 'Simplified Chinese',
      abortSignal: controller.signal,
    })

    const next = new Map<string, UnusableRange[]>()
    Object.entries(review.unusableByMaterial).forEach(([id, ranges]) => {
      const path = pathById.get(id)
      if (path && ranges.length) next.set(path, ranges.map((range) => ({ ...range })))
    })
    unusableRangesByPath.value = next
    // 留一份模型原话，手动微调后可以逐文件还原
    originalUnusableRangesByPath.value = new Map(
      [...next].map(([path, ranges]) => [path, ranges.map((range) => ({ ...range }))]),
    )
    reviewSummary.value = review.summary
    const totalRanges = [...next.values()].reduce((sum, ranges) => sum + ranges.length, 0)
    if (totalRanges) toast.success(t('features.assets.sources.reviewSucceeded', { count: totalRanges }))
    else toast.info(t('features.assets.sources.reviewClean'))
  } catch (error) {
    if ((error as { name?: string })?.name === 'AbortError') return
    const detail = (error as { error?: { message?: string }; message?: string })?.error?.message
      || (error as Error)?.message
      || String(error)
    toast.error({
      component: {
        render: () =>
          h(ActionToastEmbed, {
            message: t('features.assets.errors.reviewFailed'),
            detail,
            actionText: t('common.buttons.copyErrorDetail'),
            onActionTirgger: () => {
              navigator.clipboard.writeText(
                formatErrorForCopy(t('features.assets.errors.reviewFailed'), detail),
              )
              toast.success(t('common.messages.success.copySuccess'))
            },
          }),
      },
    })
  } finally {
    reviewingShots.value = false
  }
}

// ---- 剔除区间手动微调 ----
// 检测只给"一个采样点 ±1.5 秒"的估算区间，实际笑场多长得看着画面定，
// 所以这里允许改两端、整段平移、单段删除，并且支持抽帧确认。
const writeUnusableRanges = (assetPath: string, ranges: UnusableRange[]) => {
  const next = new Map(unusableRangesByPath.value)
  if (ranges.length) next.set(assetPath, ranges)
  else next.delete(assetPath)
  unusableRangesByPath.value = next
}

const editUnusableRanges = (
  assetPath: string,
  mutate: (ranges: UnusableRange[]) => UnusableRange[],
) => {
  const current = (unusableRangesByPath.value.get(assetPath) ?? []).map((range) => ({ ...range }))
  writeUnusableRanges(
    assetPath,
    mutate(current).sort((left, right) => left.startSeconds - right.startSeconds),
  )
}

const resolveAssetDuration = async (assetPath: string) => {
  const cached = videoDurationCache.value.get(assetPath)
  if (cached) return cached
  try {
    return await readVideoDuration(assetPath)
  } catch {
    return 0
  }
}

const onRangeInput = async (
  assetPath: string,
  index: number,
  edge: RangeEdge,
  event: Event,
) => {
  const input = event.target as HTMLInputElement | null
  const value = Number(input?.value)
  if (!Number.isFinite(value)) return
  const duration = await resolveAssetDuration(assetPath)
  editUnusableRanges(assetPath, (ranges) => {
    const range = ranges[index]
    if (!range || !duration) return ranges
    ranges[index] = { ...range, ...resizeRangeEdge(range, edge, value, duration) }
    return ranges
  })
}

const shiftUnusableRange = async (assetPath: string, index: number, deltaSeconds: number) => {
  const duration = await resolveAssetDuration(assetPath)
  editUnusableRanges(assetPath, (ranges) => {
    const range = ranges[index]
    if (!range || !duration) return ranges
    ranges[index] = { ...range, ...shiftRange(range, deltaSeconds, duration) }
    return ranges
  })
}

const removeUnusableRange = (assetPath: string, index: number) => {
  editUnusableRanges(assetPath, (ranges) => {
    ranges.splice(index, 1)
    return ranges
  })
}

const canResetFileReview = (assetPath: string) =>
  (originalUnusableRangesByPath.value.get(assetPath) ?? []).length > 0

const resetFileReview = (assetPath: string) => {
  const original = originalUnusableRangesByPath.value.get(assetPath)
  if (!original?.length) return
  writeUnusableRanges(assetPath, original.map((range) => ({ ...range })))
}

// 抽帧确认：起、中、止三帧摊开，看这段到底该不该剪
const rangePreviewOpen = ref(false)
const previewingRange = ref(false)
const previewKey = ref('')
const rangePreview = ref<{ label: string; frames: { label: string; src: string }[] } | null>(null)
const previewFrameUrl = async (asset: ListFilesFromFolderRecord, ratio: number, signal: AbortSignal) => {
  const captured = await captureFrameAt(asset, signal, ratio, { longerSide: 640, quality: 0.78 })
  return URL.createObjectURL(new Blob([captured.image], { type: 'image/jpeg' }))
}
const previewUnusableRange = async (assetPath: string, index: number) => {
  const asset = videoAssets.value.find((item) => item.path === assetPath)
  const range = getUnusableRanges(assetPath)[index]
  if (!asset || !range) return
  rangePreview.value = null
  rangePreviewOpen.value = true
  previewingRange.value = true
  previewKey.value = `${assetPath}:${index}`
  const controller = new AbortController()
  try {
    const duration = await resolveAssetDuration(assetPath)
    if (!duration) throw new Error(t('features.assets.errors.videoDurationInvalid'))
    const span = Math.max(0.2, range.endSeconds - range.startSeconds)
    const points = [
      { label: `${range.startSeconds.toFixed(1)}s · ${t('features.assets.sources.reviewRangePreviewStart')}`, time: range.startSeconds + Math.min(0.3, span / 3) },
      { label: `${((range.startSeconds + range.endSeconds) / 2).toFixed(1)}s · ${t('features.assets.sources.reviewRangePreviewMiddle')}`, time: (range.startSeconds + range.endSeconds) / 2 },
      { label: `${range.endSeconds.toFixed(1)}s · ${t('features.assets.sources.reviewRangePreviewEnd')}`, time: range.endSeconds - Math.min(0.3, span / 3) },
    ]
    const frames: { label: string; src: string }[] = []
    for (const point of points) {
      const ratio = Math.min(1, Math.max(0, point.time / duration))
      frames.push({ label: point.label, src: await previewFrameUrl(asset, ratio, controller.signal) })
    }
    rangePreview.value = { label: `${asset.name} · ${range.reason}`, frames }
  } catch (error) {
    if ((error as { name?: string })?.name !== 'AbortError') {
      toast.error(t('features.assets.errors.reviewPreviewFailed'))
      rangePreviewOpen.value = false
    }
  } finally {
    previewingRange.value = false
  }
}

// 出片前检查要的只读快照：素材勾选与检测状态都只活在这个组件里
const getPreflightSnapshot = () => ({
  selectedCount: selectedVideoAssets.value.length,
  totalCount: videoAssets.value.length,
  reviewed: Boolean(reviewSummary.value),
  rangeCount: [...unusableRangesByPath.value.values()].reduce((sum, ranges) => sum + ranges.length, 0),
})

const clearReview = () => {
  unusableRangesByPath.value = new Map()
  originalUnusableRangesByPath.value = new Map()
  reviewSummary.value = ''
}

// 获取视频分镜随机素材片段
const getVideoSegments = async (options: { duration: number; preferredAssetPaths?: string[] }) => {
  const targetDurationMs = Math.ceil(options.duration * 1000)
  if (!Number.isFinite(targetDurationMs) || targetDurationMs <= 0) {
    throw new Error(t('features.assets.errors.audioDurationInvalid'))
  }

  if (!videoAssets.value.length) {
    throw new Error(t('features.assets.errors.noVideoAssets'))
  }
  if (!selectedVideoAssets.value.length) {
    throw new Error(t('features.assets.errors.noSelectedAssets'))
  }

  // 搜集随机素材片段
  const segments: Pick<RenderVideoParams, 'videoFiles' | 'timeRanges'> = {
    videoFiles: [],
    timeRanges: [],
  }
  const minSegmentDurationMs = 2000
  const maxSegmentDurationMs = 15000

  let currentTotalDurationMs = 0
  const preferredOrder = options.preferredAssetPaths?.length
    ? options.preferredAssetPaths
    : recommendedAssetPaths.value
  const preferredRanks = new Map(preferredOrder.map((path, index) => [path, index]))
  const orderedVideoAssets = [...selectedVideoAssets.value].sort((left, right) => {
    const leftRank = preferredRanks.get(left.path) ?? Number.MAX_SAFE_INTEGER
    const rightRank = preferredRanks.get(right.path) ?? Number.MAX_SAFE_INTEGER
    return leftRank - rightRank
  })
  let tempVideoAssets = [...orderedVideoAssets]
  const unreadableAssetPaths = new Set<string>()
  let unreadableAssetCount = 0
  const unreadableAssetSamples: string[] = []
  const formatTimestamp = (milliseconds: number) => (milliseconds / 1000).toFixed(3)
  const recordUnreadableAsset = (assetName: string, reason: string) => {
    unreadableAssetCount += 1
    if (unreadableAssetSamples.length < 3) {
      unreadableAssetSamples.push(`${assetName}: ${reason.slice(0, 100)}`)
    }
  }
  const reportUnreadableAssets = () => {
    if (unreadableAssetCount > 0) {
      console.warn('部分视频素材不可用，已跳过', {
        count: unreadableAssetCount,
        samples: unreadableAssetSamples,
      })
    }
  }

  while (currentTotalDurationMs < targetDurationMs) {
    // 如果素材库中没有剩余素材，时长还不够，重新来一轮
    if (tempVideoAssets.length === 0) {
      tempVideoAssets = orderedVideoAssets.filter((asset) => !unreadableAssetPaths.has(asset.path))
      if (!tempVideoAssets.length) {
        reportUnreadableAssets()
        throw new Error(t('features.assets.errors.noUsableVideoAssets'))
      }
      continue
    }

    // 先按素材分析顺序剪辑；没有 Agent 推荐顺序时继续随机选取。
    const randomAssetIndex = preferredOrder.length
      ? 0
      : random.int(0, tempVideoAssets.length - 1)
    const [randomAsset] = tempVideoAssets.splice(randomAssetIndex, 1)
    if (!randomAsset) {
      continue
    }

    let randomAssetDurationMs = 0
    try {
      randomAssetDurationMs = Math.floor((await readVideoDuration(randomAsset.path)) * 1000)
    } catch (error) {
      unreadableAssetPaths.add(randomAsset.path)
      recordUnreadableAsset(
        randomAsset.name,
        error instanceof Error ? error.message : String(error),
      )
      continue
    }

    if (randomAssetDurationMs <= 0) {
      unreadableAssetPaths.add(randomAsset.path)
      recordUnreadableAsset(randomAsset.name, '视频时长无效')
      continue
    }

    const remainingDurationMs = targetDurationMs - currentTotalDurationMs
    // 合成时跳过笑场/NG：先把不可用区间从整条素材里减掉，只在剩下的空档里取镜头
    const unusableRanges = appStore.skipUnusableShots ? getUnusableRanges(randomAsset.path) : []
    const allowedSpans = buildAllowedSpans(randomAssetDurationMs / 1000, unusableRanges)
    const pickedSegment = pickSegmentFromSpans(allowedSpans, {
      remainingSeconds: remainingDurationMs / 1000,
      minSeconds: minSegmentDurationMs / 1000,
      maxSeconds: maxSegmentDurationMs / 1000,
      randomFloat: (min, max) => random.float(min, max),
    })
    if (!pickedSegment) {
      unreadableAssetPaths.add(randomAsset.path)
      recordUnreadableAsset(randomAsset.name, '可用画面已全部被剔除')
      continue
    }

    segments.videoFiles.push(randomAsset.path)
    segments.timeRanges.push([
      formatTimestamp(pickedSegment.startSeconds * 1000),
      formatTimestamp(pickedSegment.endSeconds * 1000),
    ])
    currentTotalDurationMs += Math.round(
      (pickedSegment.endSeconds - pickedSegment.startSeconds) * 1000,
    )
  }

  reportUnreadableAssets()
  console.debug('随机素材片段生成完成', {
    segmentCount: segments.videoFiles.length,
    totalDurationSeconds: formatTimestamp(currentTotalDurationMs),
    // 打印每段取自哪条素材的哪一段，方便核对是否绕开了废镜头区间
    segments: segments.videoFiles.map((path, index) => ({
      name: path.split(/[\\/]/).pop(),
      range: segments.timeRanges[index]?.join('-'),
      excluded: getUnusableRanges(path).map(
        (range) => `${range.startSeconds.toFixed(2)}-${range.endSeconds.toFixed(2)}`,
      ),
    })),
  })

  return segments
}

defineExpose({
  getVideoSegments,
  analyzeSelectedAssets,
  reviewSelectedShots,
  getPreflightSnapshot,
})
</script>

<style lang="scss" scoped>
.media-library-shell,
.media-library-shell :deep(.v-form) {
  min-width: 0;
  min-height: 0;
}

.media-library-panel {
  border-color: rgba(var(--v-border-color), 0.82);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.035);
}

.media-library-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
}

.media-library-heading {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.media-library-mark {
  display: grid;
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.media-library-title,
.media-canvas-title {
  font-size: 0.9rem;
  font-weight: 700;
}

.media-library-subtitle,
.media-canvas-caption {
  margin-top: 0.14rem;
  color: rgba(var(--v-theme-on-surface), 0.56);
  font-size: 0.69rem;
  line-height: 1.4;
}

.media-source-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
}

.media-source-heading {
  min-width: 0;
}

.media-source-title {
  font-size: 0.77rem;
  font-weight: 700;
}

.media-source-hint {
  margin-top: 0.12rem;
  color: rgba(var(--v-theme-on-surface), 0.56);
  font-size: 0.66rem;
  line-height: 1.4;
}

.media-source-list {
  display: flex;
  max-height: 156px;
  flex-direction: column;
  gap: 0.4rem;
  overflow-y: auto;
}

.media-source-card {
  display: flex;
  min-height: 52px;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.45rem;
  padding: 0.25rem 0.45rem;
}

.media-source-icon {
  flex: 0 0 auto;
}

.media-source-name {
  overflow: hidden;
  font-size: 0.73rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-source-location {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 0.61rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-source-empty {
  display: flex;
  min-height: 56px;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.7rem;
}

.media-select-folder {
  min-height: 54px;
}

.media-analysis-result {
  border-left: 3px solid rgb(var(--v-theme-primary));
}

.media-canvas {
  display: flex;
  min-height: 0;
  flex-direction: column;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgba(var(--v-theme-on-surface), 0.015);
}

.media-canvas-heading {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.media-canvas-title {
  font-size: 0.77rem;
}

.media-canvas-caption {
  font-size: 0.64rem;
}

.media-asset-count {
  flex: 0 0 auto;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.69rem;
}

.media-asset-grid {
  align-content: start;
}

.media-canvas-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0.25rem;
}

.media-asset-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.72);
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
  transition: opacity 0.15s ease, border-color 0.15s ease;
}

// 未勾选的素材压暗，但仍然可点，避免误以为文件被删了
.media-asset-card--off {
  opacity: 0.45;
}

.media-asset-check {
  position: absolute;
  top: 2px;
  left: 2px;
  z-index: 2;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.32);
}

.media-asset-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
}

// 有废镜头剔除的素材用橙色徽标，和分析完成的主色徽标区分开
.media-asset-badge--warning {
  color: #7c2d12;
}

.media-review-switch {
  flex: 0 0 auto;
  margin-inline-start: 0.5rem;
}

// 剔除区间编辑：每段一行，时间用原生 number input，键盘能直接敲
.review-range-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.review-range-file {
  padding: 0.35rem 0.45rem;
  border: 1px solid rgba(var(--v-theme-warning), 0.32);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.55);
}

.review-range-file-head {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
}

.review-range-file-name {
  overflow: hidden;
  font-size: 0.72rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-range-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.3rem;
  flex-wrap: wrap;
}

.review-range-reason {
  min-width: 0;
  flex: 1 1 100%;
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.66rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.review-range-field {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.64rem;
}

.review-range-input {
  width: 62px;
  padding: 0.12rem 0.3rem;
  border: 1px solid rgba(var(--v-border-color), 0.5);
  border-radius: 5px;
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.review-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
}

.review-preview-grid figure {
  margin: 0;
}

.review-preview-grid img {
  width: 100%;
  border-radius: 6px;
  background: rgba(var(--v-theme-on-surface), 0.06);
}

.review-preview-grid figcaption {
  margin-top: 0.2rem;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.66rem;
  text-align: center;
}

.review-preview-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.75rem;
}

.media-empty-state {
  flex: 1;
  min-height: 280px;
}

.media-library-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
}

.media-library-footer-copy {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.67rem;
  line-height: 1.35;
}

.media-refresh-button {
  min-width: 180px;
}

@media (max-width: 560px) {
  .media-library-heading {
    flex-wrap: wrap;
  }

  .media-library-heading > .v-chip {
    margin-left: 48px;
  }

  .media-source-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .media-select-folder,
  .media-refresh-button {
    width: 100%;
  }

  .media-library-footer {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
