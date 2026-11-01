<template>
  <div class="flex flex-col gap-4">
    <div>
      <div class="text-h6">{{ t('features.tts.config.minimaxConnectionSettings') }}</div>
      <div class="mt-1 text-body-2 text-medium-emphasis">
        {{ t('features.tts.config.minimaxConnectionDescription') }}
      </div>
    </div>

    <v-select
      v-model="appStore.minimaxTtsApiRegion"
      density="comfortable"
      :label="t('features.tts.config.minimaxApiRegion')"
      :items="regionItems"
      :disabled="disabled"
      item-title="label"
      item-value="value"
    />
    <v-text-field
      v-model="appStore.minimaxTtsApiKey"
      density="comfortable"
      :label="t('features.tts.config.minimaxApiKey')"
      :type="showApiKey ? 'text' : 'password'"
      :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
      :disabled="disabled"
      @click:append-inner="showApiKey = !showApiKey"
    />
    <v-alert type="warning" variant="tonal" density="compact">
      {{ t('features.tts.config.minimaxBillingHint') }}
    </v-alert>
    <div class="text-caption text-medium-emphasis">
      {{ t('features.tts.config.minimaxRegionHint') }}
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useTranslation } from 'i18next-vue'
import { useAppStore } from '@/store'

defineProps<{ disabled?: boolean }>()

const { t } = useTranslation()
const appStore = useAppStore()
const showApiKey = ref(false)
const regionItems = computed(() => [
  { label: t('features.tts.config.minimaxRegionChina'), value: 'china' },
  { label: t('features.tts.config.minimaxRegionGlobal'), value: 'global' },
])
</script>
