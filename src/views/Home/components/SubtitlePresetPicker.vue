<template>
  <div class="subtitle-preset-picker">
    <div class="preset-picker-controls">
      <v-select
        v-model="selectedPresetName"
        :items="presetOptions"
        :disabled="selectionDisabled"
        label="字幕样式"
        density="compact"
        hide-details
      />
      <v-btn
        class="preset-preview-trigger"
        prepend-icon="mdi-eye-outline"
        variant="tonal"
        size="small"
        :disabled="disabled"
        aria-label="预览全部字幕样式"
        title="预览全部字幕样式"
        @click="previewOpen = true"
      >
        预览 {{ openSubsPresets.length }} 种
      </v-btn>
    </div>

    <v-dialog v-model="previewOpen" max-width="940">
      <v-card class="subtitle-presets-dialog" rounded="lg">
        <div class="preset-dialog-heading">
          <div>
            <div class="preset-dialog-eyebrow">SUBTITLE PRESETS</div>
            <h2>预览字幕样式</h2>
            <p>点击预览卡片即可应用；示例使用竖屏画面。</p>
          </div>
          <v-btn icon="mdi-close" variant="text" aria-label="关闭预览" @click="previewOpen = false" />
        </div>

        <v-divider />

        <div class="preset-gallery-scroll">
          <div class="preset-gallery">
            <button
              v-for="preset in openSubsPresets"
              :key="preset.name"
              type="button"
              class="preset-gallery-card"
              :class="{ 'preset-gallery-card-selected': selectedPresetName === preset.name }"
              :aria-label="`预览${preset.label}（${preset.name}）字幕样式`"
              :aria-pressed="selectedPresetName === preset.name"
              @click="selectPreset(preset.name)"
            >
              <span class="preset-video-frame" aria-hidden="true">
                <span class="preset-caption" :style="previewStyle(preset.name)">字幕预览</span>
              </span>
              <span class="preset-gallery-copy">
                <span class="preset-gallery-title-row">
                  <strong>{{ preset.label }}</strong>
                  <v-icon v-if="selectedPresetName === preset.name" size="16" color="primary">mdi-check-circle</v-icon>
                </span>
                <span class="preset-gallery-name">{{ preset.name }}</span>
                <span class="preset-gallery-position">{{ positionLabel(preset.name) }}字幕</span>
              </span>
            </button>
          </div>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import { openSubsPresets, resolveOpenSubsPreset } from '@/effect-engine/opensubs-presets'

const props = withDefaults(
  defineProps<{
    modelValue: string
    disabled?: boolean
    selectionDisabled?: boolean
  }>(),
  { disabled: false, selectionDisabled: false },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const previewOpen = ref(false)
const selectedPresetName = computed({
  get: () => props.modelValue,
  set: (value: string | null) => emit('update:modelValue', value ?? ''),
})
const presetOptions = [
  { title: '当前默认样式', value: '' },
  ...openSubsPresets.map((preset) => ({ title: `${preset.label} · ${preset.name}`, value: preset.name })),
]

function rgbaFromHex(color: string, alpha: number) {
  const match = /^#([\da-f]{6})$/i.exec(color)
  if (!match) return color
  const value = match[1]
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function previewStyle(name: string): CSSProperties {
  const style = resolveOpenSubsPreset(name, 1920)
  if (!style) return {}

  const fontSize = Math.min(28, Math.max(12, Math.round((style.fontSize ?? 80) * 0.15)))
  const outlineWidth = style.strokeWidth ? Math.min(1.25, Math.max(0.45, style.strokeWidth * 0.35)) : 0
  const margin = Math.max(4, (style.safeAreaBottomRatio ?? 0.06) * 100)
  const position = style.position ?? 'bottom'

  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: style.fontWeight,
    WebkitTextStroke: `${outlineWidth}px ${style.strokeColor}`,
    backgroundColor: style.backgroundColor
      ? rgbaFromHex(style.backgroundColor, style.backgroundAlpha ?? 1)
      : 'transparent',
    top: position === 'top' ? `${margin}%` : position === 'middle' ? '50%' : undefined,
    bottom: position === 'bottom' ? `${margin}%` : undefined,
    transform: position === 'middle' ? 'translateY(-50%)' : undefined,
  }
}

function positionLabel(name: string) {
  const position = resolveOpenSubsPreset(name, 1920)?.position ?? 'bottom'
  return position === 'top' ? '顶部' : position === 'middle' ? '居中' : '底部'
}

function selectPreset(name: string) {
  selectedPresetName.value = name
  previewOpen.value = false
}
</script>

<style scoped lang="scss">
.preset-picker-controls {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.preset-picker-controls :deep(.v-select) {
  min-width: 0;
  flex: 1;
}

.preset-preview-trigger {
  flex: 0 0 auto;
  margin-top: 2px;
}

.subtitle-presets-dialog {
  overflow: hidden;
}

.preset-dialog-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.3rem 1rem;
}

.preset-dialog-eyebrow {
  margin-bottom: 0.3rem;
  color: rgb(var(--v-theme-primary));
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.11em;
}

.preset-dialog-heading h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
}

.preset-dialog-heading p {
  margin: 0.3rem 0 0;
  color: rgba(var(--v-theme-on-surface), 0.62);
  font-size: 0.75rem;
}

.preset-gallery-scroll {
  max-height: min(70vh, 680px);
  overflow-y: auto;
  padding: 1rem 1.2rem 1.2rem;
}

.preset-gallery {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
}

.preset-gallery-card {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 158px;
  align-items: center;
  gap: 0.8rem;
  padding: 0.65rem;
  border: 1px solid rgba(var(--v-border-color), 0.72);
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: border-color 120ms ease, background-color 120ms ease;
}

.preset-gallery-card:hover,
.preset-gallery-card:focus-visible {
  border-color: rgba(var(--v-theme-primary), 0.62);
  outline: none;
}

.preset-gallery-card-selected {
  border-color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.055);
}

.preset-video-frame {
  position: relative;
  display: block;
  flex: 0 0 76px;
  width: 76px;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 68% 24%, rgba(237, 218, 178, 0.55), transparent 35%),
    linear-gradient(155deg, transparent 0 48%, rgba(27, 37, 38, 0.28) 48.5% 100%),
    linear-gradient(180deg, #78888d 0%, #68777a 48%, #526064 49%, #374346 100%);
  box-shadow: inset 0 0 20px rgba(9, 15, 18, 0.24);
}

.preset-video-frame::before,
.preset-video-frame::after {
  position: absolute;
  right: 0;
  left: 0;
  content: '';
  pointer-events: none;
}

.preset-video-frame::before {
  top: 55%;
  height: 1px;
  background: rgba(255, 255, 255, 0.22);
  box-shadow: 0 10px 24px 13px rgba(25, 34, 36, 0.16);
}

.preset-video-frame::after {
  inset: 0;
  background: linear-gradient(180deg, rgba(8, 12, 15, 0.05), transparent 40%, rgba(8, 12, 15, 0.2));
}

.preset-caption {
  position: absolute;
  z-index: 1;
  right: 4px;
  left: 4px;
  display: block;
  padding: 0.08em 0.16em;
  border-radius: 2px;
  line-height: 1.12;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  overflow-wrap: anywhere;
}

.preset-gallery-copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.28rem;
}

.preset-gallery-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 0.25rem;
}

.preset-gallery-title-row strong {
  overflow: hidden;
  font-size: 0.77rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preset-gallery-name {
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 0.68rem;
}

.preset-gallery-position {
  margin-top: 0.25rem;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  background: rgba(var(--v-theme-on-surface), 0.055);
  color: rgba(var(--v-theme-on-surface), 0.68);
  font-size: 0.62rem;
}

@media (max-width: 760px) {
  .preset-gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .preset-dialog-heading {
    padding: 1rem 1rem 0.8rem;
  }

  .preset-gallery-scroll {
    padding: 0.75rem;
  }

  .preset-gallery {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
