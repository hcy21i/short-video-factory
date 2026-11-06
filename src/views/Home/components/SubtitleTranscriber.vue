<template>
  <div class="transcriber-workspace">
    <div class="transcriber-main-grid">
      <v-card class="transcriber-card media-card" border rounded>
        <div class="transcriber-card-heading">
          <div class="transcriber-heading-icon"><v-icon>mdi-waveform</v-icon></div>
          <div class="min-w-0">
            <h2>{{ t('features.transcription.mediaTitle') }}</h2>
            <p>{{ t('features.transcription.mediaHint') }}</p>
          </div>
        </div>

        <div class="media-preview">
          <video
            v-if="media?.kind === 'video'"
            ref="player"
            :src="mediaUrl"
            controls
            preload="metadata"
            @loadedmetadata="handleDurationLoaded"
          />
          <audio
            v-else-if="media"
            ref="player"
            :src="mediaUrl"
            controls
            preload="metadata"
            @loadedmetadata="handleDurationLoaded"
          />
          <div v-else class="media-preview-empty">
            <span class="media-preview-icon"
              ><v-icon size="25">mdi-file-music-outline</v-icon></span
            >
            <strong>{{ t('features.transcription.noMedia') }}</strong>
            <span>{{ t('features.transcription.supportedFormats') }}</span>
          </div>
        </div>

        <div v-if="media" class="selected-media-row">
          <span class="selected-media-icon"
            ><v-icon>{{
              media.kind === 'video' ? 'mdi-video-outline' : 'mdi-music-note'
            }}</v-icon></span
          >
          <div class="min-w-0 flex-1">
            <strong class="selected-media-name" :title="media.name">{{ media.name }}</strong>
            <span class="selected-media-meta"
              >{{ formatBytes(media.size) }} · {{ media.extension.slice(1).toUpperCase() }}</span
            >
          </div>
          <v-btn
            icon="mdi-close"
            variant="text"
            density="compact"
            :aria-label="t('features.transcription.removeMedia')"
            @click="clearMedia"
          />
        </div>

        <div class="media-actions">
          <v-btn
            variant="tonal"
            prepend-icon="mdi-folder-open-outline"
            :disabled="transcribing"
            @click="chooseMedia"
          >
            {{ t('features.transcription.chooseMedia') }}
          </v-btn>
          <v-btn
            color="primary"
            prepend-icon="mdi-text-recognition"
            :loading="transcribing"
            :disabled="!media || !config.hasApiKey"
            @click="transcribe"
          >
            {{
              transcribing
                ? t('features.transcription.transcribing')
                : t('features.transcription.start')
            }}
          </v-btn>
        </div>

        <div class="media-notice">
          <v-icon size="16">mdi-cloud-upload-outline</v-icon>
          <span>{{ t('features.transcription.uploadNotice') }}</span>
        </div>
      </v-card>

      <v-card class="transcriber-card editor-card" border rounded>
        <div class="transcriber-card-heading editor-heading">
          <div class="transcriber-heading-icon"><v-icon>mdi-subtitles-outline</v-icon></div>
          <div class="min-w-0 flex-1">
            <h2>{{ t('features.transcription.editorTitle') }}</h2>
            <p v-if="cues.length">
              {{ t('features.transcription.cueCount', { count: cues.length }) }}
            </p>
            <p v-else>{{ t('features.transcription.editorHint') }}</p>
          </div>
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-download-outline"
            :disabled="!cues.length || transcribing"
            @click="exportSrt"
          >
            {{ t('features.transcription.exportSrt') }}
          </v-btn>
        </div>

        <div v-if="!cues.length" class="editor-empty">
          <v-icon size="24">mdi-text-box-search-outline</v-icon>
          <strong>{{ t('features.transcription.emptyTitle') }}</strong>
          <span>{{ t('features.transcription.emptyHint') }}</span>
        </div>

        <div
          v-else
          class="cue-list"
          role="list"
          :aria-label="t('features.transcription.editorTitle')"
        >
          <div v-for="(cue, index) in cues" :key="cue.id" class="cue-row" role="listitem">
            <button
              class="cue-index"
              type="button"
              :aria-label="t('features.transcription.seekCue', { index: index + 1 })"
              @click="seekToCue(cue.startMs)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <v-icon size="14">mdi-play</v-icon>
            </button>
            <div class="cue-time-fields">
              <v-text-field
                :model-value="msToSeconds(cue.startMs)"
                type="number"
                min="0"
                step="0.1"
                suffix="s"
                :aria-label="t('features.transcription.startTime')"
                :disabled="transcribing"
                density="compact"
                hide-details
                @update:model-value="(value) => updateCueStart(cue, value)"
              />
              <span class="cue-time-arrow">→</span>
              <v-text-field
                :model-value="msToSeconds(cue.endMs)"
                type="number"
                min="0"
                step="0.1"
                suffix="s"
                :aria-label="t('features.transcription.endTime')"
                :disabled="transcribing"
                density="compact"
                hide-details
                @update:model-value="(value) => updateCueEnd(cue, value)"
              />
            </div>
            <v-textarea
              v-model="cue.text"
              class="cue-text-field"
              rows="1"
              auto-grow
              hide-details
              density="compact"
              :disabled="transcribing"
              :aria-label="t('features.transcription.cueText', { index: index + 1 })"
            />
            <v-btn
              icon="mdi-delete-outline"
              variant="text"
              color="error"
              density="compact"
              :disabled="transcribing"
              :aria-label="t('features.transcription.deleteCue', { index: index + 1 })"
              @click="deleteCue(cue.id)"
            />
          </div>
        </div>

        <div v-if="cues.length" class="editor-footer">
          <span>{{ t('features.transcription.editHelp') }}</span>
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-plus"
            :disabled="transcribing"
            @click="addCue"
            >{{ t('features.transcription.addCue') }}</v-btn
          >
        </div>
      </v-card>
    </div>

    <v-card class="transcriber-card connection-card" border rounded>
      <div class="connection-heading-row">
        <div class="transcriber-card-heading">
          <div class="transcriber-heading-icon"><v-icon>mdi-api</v-icon></div>
          <div class="min-w-0">
            <h2>{{ t('features.transcription.connectionTitle') }}</h2>
            <p>{{ t('features.transcription.connectionHint') }}</p>
          </div>
        </div>
        <v-chip
          size="small"
          :color="config.hasApiKey ? 'success' : 'default'"
          variant="tonal"
          :prepend-icon="config.hasApiKey ? 'mdi-check-circle-outline' : 'mdi-link-variant-off'"
        >
          {{
            config.hasApiKey
              ? t('features.transcription.configured')
              : t('features.transcription.notConfigured')
          }}
        </v-chip>
      </div>

      <div class="connection-fields">
        <v-text-field
          v-model="config.apiBaseUrl"
          :label="t('features.transcription.apiBaseUrl')"
          :disabled="transcribing"
          density="comfortable"
          hide-details
        />
        <v-text-field
          v-model="config.model"
          :label="t('features.transcription.model')"
          :disabled="transcribing"
          density="comfortable"
          hide-details
        />
        <v-text-field
          v-model="apiKey"
          :label="t('features.transcription.apiKey')"
          :placeholder="config.hasApiKey ? t('features.transcription.apiKeySaved') : ''"
          :disabled="transcribing"
          type="password"
          autocomplete="new-password"
          density="comfortable"
          hide-details
        />
        <v-text-field
          v-model="language"
          :label="t('features.transcription.language')"
          :placeholder="t('features.transcription.languagePlaceholder')"
          :disabled="transcribing"
          density="comfortable"
          hide-details
        />
      </div>

      <div class="connection-footer">
        <div class="model-lifecycle-note">
          <v-icon size="16">mdi-information-outline</v-icon>
          <span>{{ t('features.transcription.modelLifecycleNote') }}</span>
        </div>
        <div class="connection-actions">
          <v-btn
            v-if="config.hasApiKey"
            variant="text"
            color="error"
            :loading="saving"
            :disabled="transcribing"
            @click="clearApiKey"
          >
            {{ t('features.transcription.clearApiKey') }}
          </v-btn>
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-content-save-outline"
            :loading="saving"
            :disabled="transcribing"
            @click="saveConfig"
          >
            {{ t('features.transcription.saveConfig') }}
          </v-btn>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useTranslation } from 'i18next-vue'
import { stringifyCuesToSrt } from '@/effect-engine/shared/subtitle-srt'
import type { SubtitleCue } from '@/effect-engine/shared/types'
import type {
  SelectedTranscriptionMediaView,
  TranscriptionConfigView,
} from '~/electron/transcription/types'

const { t } = useTranslation()
const toast = useToast()
const config = ref<TranscriptionConfigView>({
  apiBaseUrl: 'https://api.openai.com/v1',
  model: 'whisper-1',
  hasApiKey: false,
})
const apiKey = ref('')
const language = ref('')
const media = ref<SelectedTranscriptionMediaView | null>(null)
const cues = ref<SubtitleCue[]>([])
const player = ref<HTMLVideoElement | HTMLAudioElement | null>(null)
const transcribing = ref(false)
const saving = ref(false)
const mediaUrl = computed(() => media.value?.url ?? '')

onMounted(async () => {
  try {
    config.value = await window.electron.getTranscriptionConfig()
  } catch {
    toast.error(t('features.transcription.configLoadFailed'))
  }
})

async function chooseMedia() {
  try {
    const selected = await window.electron.selectTranscriptionMedia()
    if (!selected) return
    media.value = selected
    cues.value = []
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('features.transcription.selectFailed'))
  }
}

async function saveConfig(): Promise<boolean> {
  saving.value = true
  try {
    config.value = await window.electron.saveTranscriptionConfig({
      apiBaseUrl: config.value.apiBaseUrl,
      model: config.value.model,
      apiKey: apiKey.value,
    })
    apiKey.value = ''
    toast.success(t('features.transcription.configSaved'))
    return true
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : t('features.transcription.configSaveFailed'),
    )
    return false
  } finally {
    saving.value = false
  }
}

async function clearApiKey() {
  saving.value = true
  try {
    config.value = await window.electron.saveTranscriptionConfig({
      apiBaseUrl: config.value.apiBaseUrl,
      model: config.value.model,
      clearApiKey: true,
    })
    apiKey.value = ''
    toast.success(t('features.transcription.apiKeyCleared'))
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : t('features.transcription.configSaveFailed'),
    )
  } finally {
    saving.value = false
  }
}

async function transcribe() {
  if (!media.value || transcribing.value) return
  transcribing.value = true
  try {
    if (!(await saveConfig())) return
    const result = await window.electron.transcribeMedia({
      mediaId: media.value.id,
      language: language.value.trim() || undefined,
    })
    cues.value = result.segments.map((segment, index) => ({
      id: `asr-${index + 1}`,
      text: segment.text,
      startMs: Math.max(0, Math.round(segment.start * 1000)),
      endMs: Math.max(Math.round(segment.start * 1000) + 1, Math.round(segment.end * 1000)),
    }))
    toast.success(t('features.transcription.transcriptionComplete', { count: cues.value.length }))
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : t('features.transcription.transcriptionFailed'),
    )
  } finally {
    transcribing.value = false
  }
}

async function exportSrt() {
  const srtText = stringifyCuesToSrt(cues.value)
  if (!srtText) return
  const baseName = media.value?.name.replace(/\.[^.]+$/, '') || 'transcript'
  try {
    const outputPath = await window.electron.saveTranscriptionSrt({
      srtText,
      defaultFileName: `${baseName}.srt`,
    })
    if (outputPath) toast.success(t('features.transcription.exported', { path: outputPath }))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t('features.transcription.exportFailed'))
  }
}

function clearMedia() {
  media.value = null
  cues.value = []
}

function msToSeconds(value: number) {
  return (value / 1000).toFixed(2)
}

function updateCueStart(cue: SubtitleCue, value: string | number | null) {
  const startMs = Math.max(0, Math.round((Number(value) || 0) * 1000))
  cue.startMs = startMs
  if (cue.endMs <= startMs) cue.endMs = startMs + 100
}

function updateCueEnd(cue: SubtitleCue, value: string | number | null) {
  cue.endMs = Math.max(cue.startMs + 1, Math.round((Number(value) || 0) * 1000))
}

function deleteCue(id: string) {
  cues.value = cues.value.filter((cue) => cue.id !== id)
}

function addCue() {
  const startMs = cues.value.at(-1)?.endMs ?? 0
  cues.value.push({ id: `manual-${Date.now()}`, text: '', startMs, endMs: startMs + 1500 })
}

function seekToCue(startMs: number) {
  if (!player.value) return
  player.value.currentTime = Math.max(0, startMs / 1000)
  void player.value.play().catch(() => undefined)
}

function handleDurationLoaded() {
  // Playback controls provide the source timeline; edits remain in seconds for quick scanning.
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped lang="scss">
.transcriber-workspace {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0.2rem 0.1rem 1rem;
}

.transcriber-main-grid {
  display: grid;
  grid-template-columns: minmax(280px, 0.72fr) minmax(0, 1.55fr);
  align-items: stretch;
  gap: 0.85rem;
  min-height: 410px;
}

.transcriber-card {
  min-width: 0;
  padding: 1rem;
  box-shadow: 0 3px 12px rgba(15, 23, 42, 0.025);
}

.media-card,
.editor-card {
  display: flex;
  flex-direction: column;
}

.transcriber-card-heading {
  display: flex;
  align-items: center;
  gap: 0.72rem;
}

.transcriber-card-heading h2 {
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.3;
}

.transcriber-card-heading p {
  margin-top: 0.18rem;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.69rem;
  line-height: 1.45;
}

.transcriber-heading-icon,
.selected-media-icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 9px;
  background: rgba(var(--v-theme-primary), 0.09);
  color: rgb(var(--v-theme-primary));
}

.media-preview {
  display: grid;
  min-height: 195px;
  flex: 1;
  place-items: center;
  overflow: hidden;
  margin-top: 0.9rem;
  border: 1px solid rgba(var(--v-border-color), 0.75);
  border-radius: 10px;
  background: #10151d;
}

.media-preview video {
  display: block;
  width: 100%;
  max-height: 270px;
  background: #0b0c0e;
}

.media-preview audio {
  width: calc(100% - 2rem);
  margin: 1rem;
}

.media-preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.25rem;
  color: rgba(255, 255, 255, 0.62);
  text-align: center;
}

.media-preview-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  margin-bottom: 0.2rem;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 12px;
  color: #fff;
}

.media-preview-empty strong {
  color: #fff;
  font-size: 0.77rem;
}

.media-preview-empty span:last-child {
  font-size: 0.65rem;
  line-height: 1.5;
}

.selected-media-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.6rem;
  padding-top: 0.7rem;
}

.selected-media-icon {
  width: 31px;
  height: 31px;
}

.selected-media-name,
.selected-media-meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-media-name {
  font-size: 0.7rem;
  font-weight: 650;
}

.selected-media-meta {
  margin-top: 0.08rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 0.62rem;
}

.media-actions {
  display: flex;
  gap: 0.5rem;
  padding-top: 0.75rem;
}

.media-notice,
.model-lifecycle-note {
  display: flex;
  align-items: flex-start;
  gap: 0.38rem;
  color: rgba(var(--v-theme-on-surface), 0.58);
  font-size: 0.64rem;
  line-height: 1.45;
}

.media-notice {
  padding-top: 0.6rem;
}

.media-notice :deep(.v-icon),
.model-lifecycle-note :deep(.v-icon) {
  flex: 0 0 auto;
  margin-top: 1px;
}

.editor-heading {
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.62);
}

.editor-empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.48rem;
  min-height: 230px;
  color: rgba(var(--v-theme-on-surface), 0.48);
  text-align: center;
}

.editor-empty strong {
  color: rgba(var(--v-theme-on-surface), 0.78);
  font-size: 0.76rem;
}

.editor-empty span {
  max-width: 270px;
  font-size: 0.66rem;
  line-height: 1.5;
}

.cue-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.42rem;
  max-height: 480px;
  overflow: auto;
  padding: 0.68rem 0.15rem 0.55rem 0;
}

.cue-row {
  display: grid;
  grid-template-columns: 36px minmax(150px, 0.72fr) minmax(0, 1fr) 28px;
  align-items: center;
  gap: 0.45rem;
  padding: 0.42rem 0.4rem;
  border: 1px solid rgba(var(--v-border-color), 0.68);
  border-radius: 8px;
  background: rgba(var(--v-theme-surface), 0.85);
}

.cue-index {
  display: flex;
  min-width: 30px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.08rem;
  align-self: stretch;
  border: 0;
  border-radius: 6px;
  background: rgba(var(--v-theme-primary), 0.07);
  color: rgb(var(--v-theme-primary));
  cursor: pointer;
  font-size: 0.64rem;
  font-weight: 700;
}

.cue-time-fields {
  display: grid;
  grid-template-columns: minmax(58px, 1fr) 12px minmax(58px, 1fr);
  align-items: center;
  gap: 0.22rem;
}

.cue-time-fields :deep(.v-field__input) {
  min-height: 32px;
  padding: 0.2rem 0.25rem;
  font-size: 0.68rem;
}

.cue-time-fields :deep(.v-field__append-inner) {
  padding-inline-start: 0;
  font-size: 0.59rem;
}

.cue-time-arrow {
  color: rgba(var(--v-theme-on-surface), 0.42);
  text-align: center;
}

.cue-text-field :deep(.v-field__input) {
  min-height: 35px;
  padding: 0.35rem 0.5rem;
  font-size: 0.73rem;
  line-height: 1.45;
}

.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(var(--v-border-color), 0.62);
  color: rgba(var(--v-theme-on-surface), 0.5);
  font-size: 0.64rem;
}

.connection-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.connection-heading-row,
.connection-footer,
.connection-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.connection-fields {
  display: grid;
  grid-template-columns: minmax(200px, 1.2fr) minmax(160px, 0.8fr) minmax(200px, 1fr) minmax(
      120px,
      0.5fr
    );
  align-items: start;
  gap: 0.65rem;
}

.connection-footer {
  align-items: flex-start;
}

.model-lifecycle-note {
  max-width: 850px;
}

@media (max-width: 1050px) {
  .transcriber-main-grid {
    grid-template-columns: minmax(240px, 0.65fr) minmax(0, 1.35fr);
  }

  .connection-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .transcriber-main-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .media-preview {
    min-height: 180px;
  }

  .editor-heading {
    flex-wrap: wrap;
  }

  .editor-heading > .v-btn {
    margin-left: 2.7rem;
  }

  .cue-row {
    grid-template-columns: 32px minmax(0, 1fr) 28px;
  }

  .cue-time-fields {
    grid-column: 2;
    grid-row: 1;
    max-width: 230px;
  }

  .cue-text-field {
    grid-column: 1 / 3;
  }

  .cue-row > :deep(.v-btn) {
    grid-column: 3;
    grid-row: 1;
  }

  .connection-heading-row,
  .connection-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .connection-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
