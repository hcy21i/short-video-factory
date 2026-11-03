<template>
  <div class="preview w-full h-full">
    <video
      ref="Video"
      class="w-full h-full object-cover"
      :src="fileSrc"
      muted
      loop
      preload="metadata"
      playsinline
      @loadedmetadata="handleMetadata"
      @error="failed = true"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
    ></video>
    <div v-if="failed" class="preview-error" role="status">无法预览此视频，请检查文件是否可播放</div>
  </div>
</template>

<script lang="ts" setup>
import { ListFilesFromFolderRecord } from '~/electron/types'
import { computed, ref, watch } from 'vue'
import { localFileUrl } from '@/lib/local-file-url'

const props = defineProps<{ asset: ListFilesFromFolderRecord }>()

const Video = ref<HTMLVideoElement | null>(null)
const failed = ref(false)
watch(() => props.asset.path, () => { failed.value = false })
const fileSrc = computed(() => localFileUrl(props.asset.path))

const handleMetadata = () => {
  const video = Video.value
  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    video.currentTime = Math.min(0.1, video.duration / 2)
  }
}
const handleMouseEnter = () => {
  Video.value?.play().catch(() => {})
}
const handleMouseLeave = () => {
  Video.value?.pause()
  if (Video.value) {
    Video.value.currentTime = 0
  }
}
</script>

<style lang="scss" scoped>
.preview { position: relative; }
.preview-error { position: absolute; inset: 0; display: grid; place-items: center; padding: 32px; text-align: center; background: #f2f2f2; color: #555; font-size: 12px; }
</style>
