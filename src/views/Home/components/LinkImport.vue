<template>
  <v-sheet class="link-import" border rounded>
    <h2>链接导入素材</h2>
    <p>粘贴公开视频链接，选择素材文件夹，下载完成后即可在素材库查看。受平台限制和视频状态影响，部分链接可能无法下载。</p>
    <label for="video-import-url">视频链接</label>
    <input id="video-import-url" v-model="url" type="text" placeholder="粘贴视频链接或分享文字" :disabled="disabled || importing" />
    <label for="video-import-folder">保存到素材文件夹</label>
    <select id="video-import-folder" v-model="folder" :disabled="disabled || importing">
      <option value="">请选择素材文件夹</option>
      <option v-for="item in appStore.videoAssetFolders" :key="item.path" :value="item.path">{{ item.path }}</option>
    </select>
    <p v-if="!appStore.videoAssetFolders.length">请先到素材库添加文件夹。</p>
    <button type="button" :disabled="disabled || importing || !url.trim() || !folder" @click="download">{{ importing ? `下载中 ${progress}` : '下载并导入' }}</button>
    <p>抖音使用免登录适配器；其他平台使用内置下载引擎。支持情况取决于平台和链接。</p>
  </v-sheet>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useAppStore } from '@/store'

defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ imported: [folder: string] }>()
const appStore = useAppStore()
const toast = useToast()
const url = ref('')
const folder = ref('')
const importing = ref(false)
const progress = ref('')
const download = async () => {
  if (importing.value || !folder.value || !url.value.trim()) return
  importing.value = true
  progress.value = ''
  const unsubscribe = window.electron.onImportVideoProgress((percent) => { progress.value = `${percent}%` })
  try {
    await window.electron.importVideoLink({ url: url.value.trim(), folder: folder.value })
    emit('imported', folder.value)
    url.value = ''
    toast.success('下载完成，正在刷新素材文件夹')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    toast.error(/HTTP Error 403|Fresh cookies/i.test(message)
      ? '平台拒绝了本次下载请求（403）。请确认视频公开且你有权访问；当前免登录方式可能不适用于该链接。'
      : `下载失败：${message}`)
  } finally {
    unsubscribe()
    importing.value = false
  }
}
</script>

<style scoped>
.link-import { width: min(100%, 800px); padding: 24px; display: grid; gap: 12px; }
h2 { font-size: 18px; }
p { color: rgba(var(--v-theme-on-surface), .65); font-size: 13px; }
label { font-weight: 600; font-size: 14px; }
input, select { width: 100%; border: 1px solid #bbb; border-radius: 8px; padding: 10px; }
button { justify-self: start; border-radius: 8px; background: rgb(var(--v-theme-primary)); color: white; padding: 10px 20px; }
button:disabled { opacity: .45; }
</style>
