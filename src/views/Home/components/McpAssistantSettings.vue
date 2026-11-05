<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-4">
      <v-sheet class="settings-panel p-4 md:p-6" border rounded>
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <v-icon size="23">mdi-connection</v-icon>
            </div>
            <div class="min-w-0">
              <div class="text-h6 font-semibold">{{ t('features.mcpSettings.title') }}</div>
              <div class="mt-1 max-w-3xl text-body-2 text-medium-emphasis">
                {{ t('features.mcpSettings.description') }}
              </div>
            </div>
          </div>
          <v-chip
            :color="connectionInfo?.hostExists ? 'success' : connectionInfo ? 'warning' : 'default'"
            variant="tonal"
            :prepend-icon="connectionInfo?.hostExists ? 'mdi-check-circle-outline' : 'mdi-information-outline'"
          >
            {{ loading ? t('features.mcpSettings.loading') : connectionInfo?.hostExists ? t('features.mcpSettings.hostReady') : connectionInfo ? t('features.mcpSettings.hostMissing') : t('features.mcpSettings.unavailable') }}
          </v-chip>
        </div>

        <v-alert v-if="connectionInfo && !connectionInfo.hostExists" class="mt-5" type="warning" variant="tonal" density="compact">
          {{ t('features.mcpSettings.hostMissingHint') }}
        </v-alert>
        <v-alert v-else-if="loadError" class="mt-5" type="error" variant="tonal" density="compact">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span>{{ t('features.mcpSettings.loadFailed') }}</span>
            <v-btn size="small" variant="text" @click="loadConnectionInfo">{{ t('features.mcpSettings.retry') }}</v-btn>
          </div>
        </v-alert>

        <div v-if="connectionInfo" class="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <div class="mb-1 flex items-center justify-between gap-2">
              <label for="mcp-node-command" class="text-body-2 font-medium">{{ t('features.mcpSettings.nodeCommand') }}</label>
              <span class="text-caption text-medium-emphasis">{{ t(connectionInfo.isPackaged ? 'features.mcpSettings.runtimePackaged' : 'features.mcpSettings.runtimeDevelopment') }}</span>
            </div>
            <v-text-field
              id="mcp-node-command"
              v-model="nodeCommand"
              variant="outlined"
              density="comfortable"
              hide-details
              autocomplete="off"
              spellcheck="false"
              class="font-mono"
            />
            <div class="mt-2 text-caption text-medium-emphasis">{{ t('features.mcpSettings.nodeCommandHint') }}</div>
          </div>
          <div class="grid gap-3">
            <div>
              <div class="mb-1 text-caption font-medium text-medium-emphasis">{{ t('features.mcpSettings.hostPath') }}</div>
              <div class="break-all rounded-lg bg-surface-variant/50 px-3 py-2 font-mono text-caption">{{ connectionInfo.hostPath }}</div>
            </div>
            <div>
              <div class="mb-1 text-caption font-medium text-medium-emphasis">{{ t('features.mcpSettings.appPath') }}</div>
              <div class="break-all rounded-lg bg-surface-variant/50 px-3 py-2 font-mono text-caption">{{ connectionInfo.appPath }}</div>
            </div>
          </div>
        </div>
      </v-sheet>

      <v-sheet class="settings-panel p-4 md:p-6" border rounded>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-subtitle-1 font-semibold">{{ t('features.mcpSettings.configTitle') }}</div>
            <div class="mt-1 text-body-2 text-medium-emphasis">{{ t('features.mcpSettings.configHint') }}</div>
          </div>
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-content-copy"
            :disabled="!configText"
            @click="copyConfig"
          >
            {{ t('features.mcpSettings.copyConfig') }}
          </v-btn>
        </div>

        <div class="mt-4 overflow-x-auto rounded-xl border bg-surface-variant/30 p-4">
          <pre class="min-w-max font-mono text-caption leading-6"><code>{{ configText || (loading ? '…' : '{}') }}</code></pre>
        </div>
      </v-sheet>

      <v-sheet class="settings-panel p-4 md:p-6" border rounded>
        <div class="text-subtitle-1 font-semibold">{{ t('features.mcpSettings.stepsTitle') }}</div>
        <ol class="mt-4 grid gap-3 md:grid-cols-3">
          <li v-for="(step, index) in setupSteps" :key="step" class="flex items-start gap-3 rounded-xl border p-3">
            <v-avatar color="primary" size="28" variant="tonal">{{ index + 1 }}</v-avatar>
            <span class="pt-1 text-body-2">{{ t(step) }}</span>
          </li>
        </ol>
        <v-alert class="mt-4" type="info" variant="tonal" density="compact">
          {{ t('features.mcpSettings.connectionNote') }}
        </v-alert>
      </v-sheet>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useTranslation } from 'i18next-vue'
import { useToast } from 'vue-toastification'

interface McpConnectionInfo {
  command: string
  args: string[]
  hostPath: string
  appPath: string
  isPackaged: boolean
  hostExists: boolean
}

const { t } = useTranslation()
const toast = useToast()
const connectionInfo = ref<McpConnectionInfo | null>(null)
const loading = ref(true)
const loadError = ref(false)
const nodeCommand = ref(localStorage.getItem('short-video-factory.mcp-node-command') || 'node')
const setupSteps = [
  'features.mcpSettings.stepOne',
  'features.mcpSettings.stepTwo',
  'features.mcpSettings.stepThree',
]
const configText = computed(() => {
  if (!connectionInfo.value) return ''
  return JSON.stringify(
    {
      mcpServers: {
        'short-video-factory': {
          command: nodeCommand.value.trim() || 'node',
          args: connectionInfo.value.args,
        },
      },
    },
    null,
    2,
  )
})

watch(nodeCommand, (value) => localStorage.setItem('short-video-factory.mcp-node-command', value))

const loadConnectionInfo = async () => {
  loading.value = true
  loadError.value = false
  try {
    connectionInfo.value = await window.electron.getMcpConnectionInfo()
  } catch (error) {
    loadError.value = true
    window.electron.log('error', 'Failed to load MCP connection info', error)
  } finally {
    loading.value = false
  }
}

const copyConfig = async () => {
  try {
    await navigator.clipboard.writeText(configText.value)
    toast.success(t('features.mcpSettings.copied') as string)
  } catch {
    toast.error(t('features.mcpSettings.copyFailed') as string)
  }
}

onMounted(loadConnectionInfo)
</script>
