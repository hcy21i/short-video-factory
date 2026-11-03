<template>
  <v-sheet class="preflight-card" border rounded>
    <div class="export-section-heading">
      <div class="export-heading-icon"><v-icon>mdi-clipboard-check-outline</v-icon></div>
      <div>
        <div class="inspector-title">{{ t('features.workspace.preflight.title') }}</div>
        <div class="inspector-caption">{{ t('features.workspace.preflight.hint') }}</div>
      </div>
      <v-spacer />
      <v-chip
        size="x-small"
        variant="tonal"
        :color="allReady ? 'success' : 'warning'"
      >
        {{ readyCount }}/{{ items.length }}
      </v-chip>
      <v-btn size="x-small" variant="text" icon="mdi-refresh" @click="emit('refresh')" />
    </div>
    <ul class="preflight-list">
      <li
        v-for="item in items"
        :key="item.id"
        class="preflight-item"
        :class="`preflight-item--${item.status}`"
      >
        <v-icon size="16" :color="item.status === 'ok' ? 'success' : 'warning'">
          {{ item.status === 'ok' ? 'mdi-check-circle' : 'mdi-alert-circle-outline' }}
        </v-icon>
        <div class="preflight-body">
          <div class="preflight-label">{{ item.label }}</div>
          <div class="preflight-detail" :title="item.detail">{{ item.detail }}</div>
        </div>
        <v-btn
          v-if="item.actionLabel"
          size="x-small"
          variant="tonal"
          color="warning"
          @click="emit('action', item.id)"
        >
          {{ item.actionLabel }}
        </v-btn>
      </li>
    </ul>
  </v-sheet>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useTranslation } from 'i18next-vue'
import type { PreflightItem } from '@/lib/preflight'

const props = defineProps<{ items: PreflightItem[] }>()
const emit = defineEmits<{
  (event: 'action', id: PreflightItem['id']): void
  (event: 'refresh'): void
}>()

const { t } = useTranslation()
const readyCount = computed(() => props.items.filter((item) => item.status === 'ok').length)
const allReady = computed(() => props.items.length > 0 && readyCount.value === props.items.length)
</script>

<style scoped>
.preflight-card {
  padding: 0.85rem 1rem;
}

.preflight-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin: 0.7rem 0 0;
  padding: 0;
  list-style: none;
}

.preflight-item {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.3rem 0.4rem;
  border-radius: 8px;
  background: rgba(var(--v-theme-on-surface), 0.03);
}

.preflight-body {
  min-width: 0;
  flex: 1;
}

.preflight-label {
  font-size: 0.74rem;
  font-weight: 600;
}

.preflight-detail {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), 0.6);
  font-size: 0.66rem;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preflight-item--warn .preflight-label {
  color: rgb(var(--v-theme-warning));
}
</style>
