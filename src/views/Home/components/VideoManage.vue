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

        <div class="media-canvas flex-1 h-0 w-full">
          <div class="media-canvas-heading">
            <div>
              <div class="media-canvas-title">{{ t('features.assets.sources.selectedMaterials') }}</div>
              <div class="media-canvas-caption">{{ t('features.assets.sources.selectedMaterialsHint') }}</div>
            </div>
            <span class="media-asset-count">{{ t('features.workspace.mediaCount', { count: videoAssets.length }) }}</span>
          </div>
          <div
            v-if="videoAssets.length"
            class="media-asset-grid w-full max-h-full overflow-y-auto grid grid-cols-2 xl:grid-cols-3 gap-3 p-3"
          >
            <div
              class="media-asset-card w-full h-full max-h-[220px]"
              v-for="item in videoAssets"
              :key="item.path"
            >
              <VideoAutoPreview :asset="item" />
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
const folderKey = (folderPath: string) => folderPath.replace(/\\/g, '/').replace(/\/$/, '').toLowerCase()
const getFolderAssets = (folderPath: string) => assetsByFolder.value[folderKey(folderPath)] ?? []
const isFolderScanned = (folderPath: string) =>
  scannedFolderPaths.value.some((path) => folderKey(path) === folderKey(folderPath))
const videoAssets = computed(() =>
  appStore.videoAssetFolders
    .filter((folder) => folder.enabled)
    .flatMap((folder) => getFolderAssets(folder.path)),
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
  latestAnalysis.value = null
  await scanFolder(folderPath, { trackSelection: true })
}

const setFolderEnabled = (folderPath: string, enabled: boolean | null) => {
  const folder = appStore.videoAssetFolders.find((item) => folderKey(item.path) === folderKey(folderPath))
  if (folder) {
    folder.enabled = enabled === true
    latestAnalysis.value = null
  }
}

const removeFolder = (folderPath: string) => {
  const key = folderKey(folderPath)
  const index = appStore.videoAssetFolders.findIndex((folder) => folderKey(folder.path) === key)
  if (index === -1) return
  appStore.videoAssetFolders.splice(index, 1)
  const nextFolder = appStore.videoAssetFolders.at(-1)?.path ?? ''
  if (folderKey(appStore.videoAssetsFolder) === key) appStore.videoAssetsFolder = nextFolder
  delete assetsByFolder.value[key]
  scannedFolderPaths.value = scannedFolderPaths.value.filter((path) => folderKey(path) !== key)
  videoDurationCache.value.clear()
  latestAnalysis.value = null
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
    latestAnalysis.value = null
    const assets = await window.electron.listFilesFromFolder({ folderPath })
    const mp4Assets = assets.filter((asset) => asset.name.toLowerCase().endsWith('.mp4'))
    videoDurationCache.value.clear()
    assetsByFolder.value = { ...assetsByFolder.value, [key]: mp4Assets }
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

const captureRepresentativeFrame = (
  asset: ListFilesFromFolderRecord,
  signal: AbortSignal,
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
        const scale = Math.min(1, 512 / Math.max(video.videoWidth, video.videoHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('无法读取视频画面')
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.58).split(',')[1]
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
      targetTime = Math.min(Math.max(0, video.duration * 0.5), Math.max(0, video.duration - 0.1))
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

const analyzeVideoMaterials = async (options: {
  platform: string
  targetDurationSeconds: number
  creativeBrief: string
  abortSignal: AbortSignal
}) => {
  if (!videoAssets.value.length) throw new Error(t('features.assets.errors.noVideoAssets'))
  const analysisConfig = appStore.analysisUsesCopywritingModel
    ? appStore.llmConfig
    : appStore.analysisLlmConfig
  if (getLlmConfigIssue(analysisConfig)) throw new Error(t('features.agent.llmConfigRequired'))
  const maximumSamples = 10
  const sampleAssets =
    videoAssets.value.length <= maximumSamples
      ? [...videoAssets.value]
      : Array.from(
          { length: maximumSamples },
          (_, index) =>
            videoAssets.value[
              Math.round((index * (videoAssets.value.length - 1)) / (maximumSamples - 1))
            ],
        ).filter((asset): asset is ListFilesFromFolderRecord => Boolean(asset))
  const frames: MaterialFrame[] = []

  for (let index = 0; index < sampleAssets.length; index += 1) {
    if (options.abortSignal.aborted) throw new DOMException('素材分析已取消', 'AbortError')
    const asset = sampleAssets[index]
    const frame: MaterialFrame = {
      id: `M${String(index + 1).padStart(2, '0')}`,
      name: asset.name,
    }
    try {
      const captured = await captureRepresentativeFrame(asset, options.abortSignal)
      frame.image = captured.image
      frame.durationSeconds = captured.durationSeconds
      videoDurationCache.value.set(asset.path, captured.durationSeconds)
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') throw error
      // Keep the file name in the analysis request when a representative frame is unavailable.
    }
    frames.push(frame)
  }

  const locale = appStore.locale || navigator.language || 'zh-CN'
  const analysis = await analyzeMaterialFrames({
    llmConfig: normalizeLlmConfig(analysisConfig),
    materials: frames,
    platform: options.platform,
    targetDurationSeconds: options.targetDurationSeconds,
    creativeBrief: options.creativeBrief,
    language: locale.toLowerCase().startsWith('en') ? 'English' : 'Simplified Chinese',
    abortSignal: options.abortSignal,
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
    ...videoAssets.value
      .map((asset) => asset.path)
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

  return { analysis, preferredAssetPaths, promptContext }
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

  // 搜集随机素材片段
  const segments: Pick<RenderVideoParams, 'videoFiles' | 'timeRanges'> = {
    videoFiles: [],
    timeRanges: [],
  }
  const minSegmentDurationMs = 2000
  const maxSegmentDurationMs = 15000

  let currentTotalDurationMs = 0
  const preferredRanks = new Map(
    (options.preferredAssetPaths ?? []).map((path, index) => [path, index]),
  )
  const orderedVideoAssets = [...videoAssets.value].sort((left, right) => {
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
    const randomAssetIndex = options.preferredAssetPaths?.length
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
    const randomSegmentDurationMs =
      randomAssetDurationMs < minSegmentDurationMs
        ? Math.min(randomAssetDurationMs, remainingDurationMs)
        : Math.min(
            remainingDurationMs,
            Math.max(
              1,
              Math.floor(
                random.float(
                  minSegmentDurationMs,
                  Math.min(maxSegmentDurationMs, randomAssetDurationMs),
                ),
              ),
            ),
          )
    const maxStartMs = randomAssetDurationMs - randomSegmentDurationMs
    const randomSegmentStartMs = maxStartMs > 0 ? Math.floor(random.float(0, maxStartMs)) : 0

    segments.videoFiles.push(randomAsset.path)
    segments.timeRanges.push([
      formatTimestamp(randomSegmentStartMs),
      formatTimestamp(randomSegmentStartMs + randomSegmentDurationMs),
    ])
    currentTotalDurationMs += randomSegmentDurationMs
  }

  reportUnreadableAssets()
  console.debug('随机素材片段生成完成', {
    segmentCount: segments.videoFiles.length,
    totalDurationSeconds: formatTimestamp(currentTotalDurationMs),
  })

  return segments
}

defineExpose({ getVideoSegments, analyzeMaterials: analyzeVideoMaterials })
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

.media-asset-card {
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), 0.72);
  border-radius: 10px;
  background: rgb(var(--v-theme-surface));
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
