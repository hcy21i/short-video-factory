<template>
  <v-sheet class="generation-options-panel" border rounded>
    <div class="generation-options-heading">
      <div class="generation-options-mark"><v-icon>mdi-closed-caption</v-icon></div>
      <div>
        <div class="generation-options-title">{{ t('features.workspace.captionOptionsTitle') }}</div>
        <div class="generation-options-hint">{{ t('features.workspace.captionOptionsHint') }}</div>
      </div>
    </div>
    <div class="generation-option-grid">
      <button
        type="button"
        class="generation-option-tile"
        :class="{ 'generation-option-tile-enabled': appStore.renderConfig.subtitlesEnabled }"
        :aria-pressed="appStore.renderConfig.subtitlesEnabled"
        :title="t('features.render.config.subtitlesHint')"
        :disabled="taskInProgress"
        @click="toggleOption('subtitlesEnabled')"
      >
        <span class="generation-option-icon"><v-icon>{{ appStore.renderConfig.subtitlesEnabled ? 'mdi-check' : 'mdi-closed-caption-outline' }}</v-icon></span>
        <span class="generation-option-copy">
          <strong>{{ t('features.render.config.subtitlesEnabled') }}</strong>
          <small>{{ t('features.render.config.subtitlesHint') }}</small>
        </span>
        <span class="generation-option-state">{{ appStore.renderConfig.subtitlesEnabled ? t('common.states.on') : t('common.states.off') }}</span>
      </button>
      <button
        type="button"
        class="generation-option-tile"
        :class="{ 'generation-option-tile-enabled': appStore.renderConfig.exportSubtitles }"
        :aria-pressed="appStore.renderConfig.exportSubtitles"
        :title="t('features.render.config.exportSubtitlesHint')"
        :disabled="taskInProgress"
        @click="toggleOption('exportSubtitles')"
      >
        <span class="generation-option-icon"><v-icon>{{ appStore.renderConfig.exportSubtitles ? 'mdi-check' : 'mdi-file-download-outline' }}</v-icon></span>
        <span class="generation-option-copy">
          <strong>{{ t('features.render.config.exportSubtitles') }}</strong>
          <small>{{ t('features.render.config.exportSubtitlesHint') }}</small>
        </span>
        <span class="generation-option-state">{{ appStore.renderConfig.exportSubtitles ? t('common.states.on') : t('common.states.off') }}</span>
      </button>
      <div class="generation-option-tile generation-batch-tile" :class="{ 'generation-option-tile-enabled': appStore.autoBatch }">
        <button
          type="button"
          class="generation-option-main"
          :aria-pressed="appStore.autoBatch"
          :disabled="taskInProgress"
          @click="toggleBatch"
        >
          <span class="generation-option-icon"><v-icon>{{ appStore.autoBatch ? 'mdi-autorenew' : 'mdi-autorenew-off' }}</v-icon></span>
          <span class="generation-option-copy">
            <strong>{{ appStore.autoBatch ? t('features.render.batch.enabled', { count: appStore.batchConfig.count }) : t('features.render.batch.label') }}</strong>
            <small>{{ t('features.render.batch.hint') }}</small>
          </span>
          <span class="generation-option-state">{{ appStore.autoBatch ? t('common.states.on') : t('common.states.off') }}</span>
        </button>
        <v-menu
          v-model="batchSettingsOpen"
          :close-on-content-click="false"
          location="bottom end"
          max-width="320"
        >
          <template #activator="{ props }">
            <v-btn
              v-bind="props"
              icon="mdi-cog-outline"
              variant="tonal"
              size="small"
              :disabled="taskInProgress"
              :aria-label="t('features.render.batch.settings')"
            />
          </template>
          <v-card :title="t('features.render.batch.settings')" class="p-3" min-width="280">
            <v-text-field
              v-model.number="appStore.batchConfig.count"
              :disabled="taskInProgress"
              type="number"
              min="1"
              max="999"
              step="1"
              density="compact"
              :label="t('features.render.batch.count')"
              :rules="[
                (value) =>
                  (Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 999) ||
                  t('features.render.batch.invalidCount'),
              ]"
            />
            <v-select
              v-model="appStore.batchConfig.onError"
              :disabled="taskInProgress"
              :items="errorOptions"
              density="compact"
              :label="t('features.render.batch.onError')"
              hide-details
            />
            <div class="text-xs text-medium-emphasis mt-3">
              {{ t('features.render.batch.hint') }}
            </div>
          </v-card>
        </v-menu>
      </div>
    </div>
    <div v-if="appStore.batchProgress" class="generation-batch-progress" aria-live="polite">
      <template v-if="appStore.batchProgress.running">
        <div>
          {{
            t('features.render.batch.progress', {
              current: appStore.batchProgress.current,
              total: appStore.batchProgress.total,
              remaining: Math.max(0, appStore.batchProgress.total - appStore.batchProgress.current),
            })
          }}
        </div>
        <v-progress-linear
          class="my-2"
          color="primary"
          rounded
          height="4"
          :model-value="batchPercent"
        />
      </template>
      <div v-else class="mb-1">
        {{ t(`features.render.batch.reasons.${appStore.batchProgress.stopReason}`) }}
      </div>
      <div>
        {{
          t('features.render.batch.summary', {
            success: appStore.batchProgress.completedCount,
            failed: appStore.batchProgress.failedCount,
            warnings: appStore.batchProgress.warningCount,
          })
        }}
      </div>
    </div>
  </v-sheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { RenderStatus, useAppStore } from '@/store'

const appStore = useAppStore()
const { t } = useTranslation()
const batchSettingsOpen = ref(false)
const taskInProgress = computed(
  () =>
    appStore.batchProgress?.running ||
    ![RenderStatus.None, RenderStatus.Completed, RenderStatus.Failed].includes(
      appStore.renderStatus,
    ),
)
const errorOptions = computed(() => [
  { title: t('features.render.batch.stopOnError'), value: 'stop' },
  { title: t('features.render.batch.continueOnError'), value: 'continue' },
])
watch(taskInProgress, (busy) => {
  if (busy) batchSettingsOpen.value = false
})
const batchPercent = computed(() => {
  const batch = appStore.batchProgress
  return batch
    ? ((batch.completedCount + batch.failedCount + batch.cancelledCount) / batch.total) * 100
    : 0
})
const toggleBatch = () => {
  if (!taskInProgress.value) appStore.autoBatch = !appStore.autoBatch
}
const toggleOption = (key: 'subtitlesEnabled' | 'exportSubtitles') => {
  if (taskInProgress.value) return
  appStore.renderConfig[key] = !appStore.renderConfig[key]
}
</script>

<style scoped lang="scss">
.generation-options-panel {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
  border-color: rgba(var(--v-border-color), 0.82);
}

.generation-options-heading {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.generation-options-mark {
  display: grid;
  flex: 0 0 38px;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 11px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.generation-options-title {
  font-size: 0.86rem;
  font-weight: 700;
}

.generation-options-hint {
  margin-top: 0.12rem;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.67rem;
}

.generation-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.generation-option-tile {
  display: flex;
  min-width: 0;
  min-height: 74px;
  align-items: center;
  gap: 0.55rem;
  padding: 0.6rem;
  border: 1px solid rgba(var(--v-border-color), 0.76);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
  text-align: left;
  transition: background-color 120ms ease, border-color 120ms ease;
}

button.generation-option-tile {
  cursor: pointer;
}

.generation-option-tile:disabled {
  cursor: default;
  opacity: 0.65;
}

.generation-option-tile-enabled {
  border-color: rgba(var(--v-theme-primary), 0.3);
  background: rgba(var(--v-theme-primary), 0.045);
}

.generation-option-tile:not(:disabled):hover {
  border-color: rgba(var(--v-theme-primary), 0.4);
}

.generation-option-icon {
  display: grid;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 10px;
  color: rgba(var(--v-theme-on-surface), 0.58);
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.generation-option-tile-enabled .generation-option-icon {
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
}

.generation-option-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.18rem;
}

.generation-option-copy strong {
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.25;
}

.generation-option-copy small {
  color: rgba(var(--v-theme-on-surface), 0.52);
  font-size: 0.61rem;
  line-height: 1.3;
}

.generation-option-state {
  color: rgba(var(--v-theme-on-surface), 0.46);
  font-size: 0.6rem;
  white-space: nowrap;
}

.generation-option-tile-enabled .generation-option-state {
  color: rgb(var(--v-theme-primary));
}

.generation-batch-tile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px;
  gap: 0.15rem;
  padding-right: 0.35rem;
}

.generation-option-main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.55rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.generation-option-main:disabled {
  cursor: default;
}

.generation-batch-progress {
  padding: 0.8rem 0.1rem 0.05rem;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  color: rgba(var(--v-theme-on-surface), 0.65);
  font-size: 0.68rem;
}

@media (max-width: 600px) {
  .generation-option-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
