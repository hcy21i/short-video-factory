<template>
  <section class="storyboard" aria-label="逐句分镜建议">
    <div class="heading">
      <strong>逐句分镜建议</strong
      ><button type="button" @click="$emit('generate')">生成建议</button>
    </div>
    <p>根据素材分析中的抽样画面和文案文字生成建议，请检查并选择素材。</p>
    <p>当前为分镜草稿，尚未应用到合成导出。文案或素材修改后请重新生成。</p>
    <p v-if="stale" role="alert" class="warning">文案或素材分析已改变，请重新生成分镜。</p>
    <p v-if="!rows.length">先填写文案并在素材库分析所选素材，再生成建议。</p>
    <div v-for="(row, index) in rows" :key="index" class="row">
      <div>{{ index + 1 }}. {{ row.sentence }}</div>
      <label
        >画面素材
        <select
          :value="row.path"
          @change="$emit('select', index, ($event.target as HTMLSelectElement).value)"
        >
          <option value="">待选择</option>
          <option v-for="item in materials" :key="item.path" :value="item.path">
            {{ item.name }}
          </option>
        </select>
      </label>
      <div v-if="row.description">
        {{ row.timeSeconds?.toFixed(1) }} 秒附近 · {{ row.description }}
      </div>
      <template v-if="row.path">
        <video
          :key="row.path"
          controls
          preload="metadata"
          :src="videoUrl(row.path)"
          @loadedmetadata="onLoaded($event, index, row)"
          @timeupdate="stopAtEnd($event, row.endSeconds)"
        />
        <div class="timing">
          <label
            >起点（秒）<input
              type="number"
              min="0"
              step="0.1"
              :value="row.startSeconds"
              @change="updateTime($event, index, row, 'start')"
          /></label>
          <label
            >终点（秒）<input
              type="number"
              min="0"
              step="0.1"
              :value="row.endSeconds"
              @change="updateTime($event, index, row, 'end')"
          /></label>
          <button type="button" @click="previewStart($event, row.startSeconds)">从起点预览</button>
        </div>
        <span v-if="row.endSeconds <= row.startSeconds" class="warning"
          >请设置大于起点的终点。</span
        >
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
type Row = {
  sentence: string
  path: string
  description: string
  timeSeconds?: number
  startSeconds: number
  endSeconds: number
}
defineProps<{
  rows: Row[]
  materials: { path: string; name: string }[]
  stale: boolean
}>()
const emit = defineEmits<{
  generate: []
  select: [index: number, path: string]
  timing: [index: number, startSeconds: number, endSeconds: number]
}>()
const videoUrl = (path: string) => {
  const normalized = path.replace(/\\/g, '/')
  return encodeURI(normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`)
    .replace(/#/g, '%23')
    .replace(/\?/g, '%3F')
}
const onLoaded = (event: Event, index: number, row: Row) => {
  const video = event.target as HTMLVideoElement
  if (!Number.isFinite(video.duration) || video.duration <= 0) return
  const start = Math.min(row.startSeconds, Math.max(0, video.duration - 0.1))
  video.currentTime = start
  if (row.endSeconds <= row.startSeconds)
    emit('timing', index, start, Math.min(video.duration, start + 3))
}
const updateTime = (event: Event, index: number, row: Row, edge: 'start' | 'end') => {
  const input = event.target as HTMLInputElement
  const value = input.valueAsNumber
  if (!Number.isFinite(value) || value < 0) {
    input.value = String(edge === 'start' ? row.startSeconds : row.endSeconds)
    return
  }
  const video = input.closest('.row')?.querySelector('video')
  const clamped = video && Number.isFinite(video.duration) ? Math.min(value, video.duration) : value
  input.value = String(clamped)
  emit(
    'timing',
    index,
    edge === 'start' ? clamped : row.startSeconds,
    edge === 'end' ? clamped : row.endSeconds,
  )
}
const previewStart = (event: Event, start: number) => {
  const video = (event.target as HTMLElement).closest('.row')?.querySelector('video')
  if (video && Number.isFinite(video.duration)) {
    video.dataset.previewRange = 'true'
    video.currentTime = Math.min(start, video.duration)
    void video.play().catch(() => {})
  }
}
const stopAtEnd = (event: Event, end: number) => {
  const video = event.target as HTMLVideoElement
  if (end > 0 && video.currentTime >= end && video.dataset.previewRange === 'true') {
    video.pause()
    delete video.dataset.previewRange
  }
}
</script>

<style scoped>
.storyboard {
  margin-top: 12px;
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: white;
}
.heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.heading button {
  color: #6d28ff;
  font-weight: 600;
}
p {
  margin: 8px 0;
  color: #666;
  font-size: 13px;
}
.row {
  display: grid;
  gap: 8px;
  padding: 12px 0;
  border-top: 1px solid #eee;
}
select {
  margin-left: 8px;
  max-width: 80%;
  padding: 6px;
  border: 1px solid #bbb;
  border-radius: 6px;
}
video {
  width: min(100%, 480px);
  max-height: 270px;
  background: #111;
  border-radius: 8px;
}
.timing {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
.timing input {
  width: 80px;
  margin-left: 6px;
  padding: 4px;
  border: 1px solid #bbb;
  border-radius: 4px;
}
.timing button {
  color: #6d28ff;
}
.warning {
  color: #a15b00;
}
</style>
