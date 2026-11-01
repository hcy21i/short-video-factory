<template>
  <fieldset class="flex min-w-0 flex-col gap-3 border-0 p-0" :disabled="props.disabled">
    <v-autocomplete
      :model-value="selectedPreset"
      :items="providerPresets"
      item-title="label"
      item-value="id"
      :no-data-text="t('common.states.noData')"
      :label="t('features.modelSettings.provider')"
      @update:model-value="selectPreset"
    ></v-autocomplete>
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <v-select
        :model-value="modelValue.protocol"
        :items="protocolItems"
        item-title="title"
        item-value="value"
        :label="t('features.llm.config.protocol')"
        @update:model-value="update('protocol', $event)"
      />
      <v-text-field
        :model-value="modelValue.modelName"
        :label="t('features.llm.config.modelName')"
        :placeholder="selectedPresetInfo?.modelPlaceholder"
        clearable
        @update:model-value="update('modelName', $event)"
      />
    </div>
    <v-text-field
      :model-value="modelValue.apiUrl"
      :label="t('features.llm.config.apiUrl')"
      :hint="requestUrlHint ? `${t('features.llm.config.requestUrl')}: ${requestUrlHint}` : ''"
      persistent-hint
      clearable
      @update:model-value="update('apiUrl', $event)"
    />
    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <v-text-field
        :model-value="modelValue.apiKey"
        :type="showApiKey ? 'text' : 'password'"
        :label="t('features.llm.config.apiKey')"
        :append-inner-icon="showApiKey ? 'mdi-eye-off' : 'mdi-eye'"
        clearable
        @click:append-inner="showApiKey = !showApiKey"
        @update:model-value="update('apiKey', $event)"
      />
      <v-select
        v-if="modelValue.protocol === 'anthropic-messages'"
        :model-value="modelValue.anthropicAuthMode"
        :items="authItems"
        item-title="title"
        item-value="value"
        :label="t('features.llm.config.anthropicAuthMode')"
        @update:model-value="update('anthropicAuthMode', $event)"
      />
    </div>
    <v-alert v-if="requestUrlIssue" type="error" density="compact" variant="tonal">
      {{ t(requestUrlIssue === 'full-endpoint' ? 'features.llm.config.fullEndpointApiUrl' : 'features.llm.config.invalidApiUrl') }}
    </v-alert>
    <v-alert type="info" density="compact" variant="tonal">
      {{ t('features.modelSettings.providerNote') }}
    </v-alert>
    <v-expansion-panels variant="accordion">
      <v-expansion-panel :title="t('features.llm.config.advancedTab')">
        <v-expansion-panel-text>
          <div class="flex flex-col gap-3">
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              <v-text-field
                :model-value="modelValue.timeoutSeconds"
                type="number"
                min="1"
                :label="t('features.llm.config.timeoutSeconds')"
                @update:model-value="update('timeoutSeconds', Number($event))"
              />
              <v-text-field
                :model-value="modelValue.maxOutputTokens"
                type="number"
                min="1"
                :label="t('features.llm.config.maxOutputTokens')"
                @update:model-value="update('maxOutputTokens', $event ? Number($event) : undefined)"
              />
              <v-text-field
                :model-value="modelValue.temperature"
                type="number"
                min="0"
                max="2"
                step="0.1"
                :label="t('features.llm.config.temperature')"
                @update:model-value="update('temperature', $event === '' ? undefined : Number($event))"
              />
              <v-text-field
                :model-value="modelValue.topP"
                type="number"
                min="0"
                max="1"
                step="0.05"
                :label="t('features.llm.config.topP')"
                @update:model-value="update('topP', $event === '' ? undefined : Number($event))"
              />
            </div>
            <v-select
              :model-value="modelValue.instructionDelivery"
              :items="deliveryItems"
              item-title="title"
              item-value="value"
              :label="t('features.llm.config.instructionDelivery')"
              @update:model-value="update('instructionDelivery', $event)"
            />
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-caption text-medium-emphasis">
                {{ t('features.llm.config.samplingCompatibilityUnknown') }}
              </div>
              <v-btn size="small" variant="text" @click="restoreSamplingDefaults">
                {{ t('features.llm.config.restoreSamplingDefaults') }}
              </v-btn>
            </div>
            <div class="flex flex-col gap-2">
              <div class="text-subtitle-2">{{ t('features.llm.config.customHeaders') }}</div>
              <div v-for="(header, index) in modelValue.customHeaders" :key="index" class="flex gap-2">
                <v-text-field
                  :model-value="header.name"
                  :label="t('features.llm.config.headerName')"
                  @update:model-value="updateHeader(index, 'name', $event)"
                />
                <v-text-field
                  :model-value="header.value"
                  :label="t('features.llm.config.headerValue')"
                  type="password"
                  @update:model-value="updateHeader(index, 'value', $event)"
                />
                <v-btn icon="mdi-delete-outline" variant="text" :aria-label="t('common.buttons.remove')" @click="removeHeader(index)" />
              </div>
              <v-btn prepend-icon="mdi-plus" variant="text" @click="addHeader">
                {{ t('common.buttons.add') }}
              </v-btn>
              <div v-if="headerIssue" class="text-caption text-error">
                {{ t(`features.llm.config.${headerIssueKey}`) }}
              </div>
            </div>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </fieldset>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useTranslation } from 'i18next-vue'
import { defaultLlmConfig, getCustomHeaderIssue, normalizeLlmConfig } from '@/lib/llm/config'
import { getRequestUrlHint, getRequestUrlIssue } from '@/lib/llm/providers'
import type { LlmConfig, LlmProtocol } from '@/lib/llm/types'

const props = defineProps<{ modelValue: LlmConfig; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: LlmConfig] }>()
const { t } = useTranslation()
const showApiKey = ref(false)

const providerPresets = [
  { id: 'openai', label: 'OpenAI', apiUrl: 'https://api.openai.com/v1', protocol: 'openai-responses', modelPlaceholder: 'gpt-…' },
  { id: 'anthropic', label: 'Anthropic Claude', apiUrl: 'https://api.anthropic.com/v1', protocol: 'anthropic-messages', modelPlaceholder: 'claude-…' },
  { id: 'gemini', label: 'Google Gemini', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', protocol: 'openai-compatible', modelPlaceholder: 'gemini-…' },
  { id: 'deepseek', label: 'DeepSeek', apiUrl: 'https://api.deepseek.com', protocol: 'openai-compatible', modelPlaceholder: 'deepseek-…' },
  { id: 'qwen', label: '阿里云百炼 / Qwen', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', protocol: 'openai-compatible', modelPlaceholder: 'qwen-…' },
  { id: 'volcengine', label: '火山引擎 / 豆包 Ark', apiUrl: 'https://ark.cn-beijing.volces.com/api/v3', protocol: 'openai-compatible', modelPlaceholder: 'Endpoint ID / 模型 ID' },
  { id: 'minimax-cn', label: 'MiniMax（中国大陆）', apiUrl: 'https://api.minimaxi.com/v1', protocol: 'openai-compatible', modelPlaceholder: 'MiniMax-…' },
  { id: 'minimax-global', label: 'MiniMax（国际站）', apiUrl: 'https://api.minimax.io/v1', protocol: 'openai-compatible', modelPlaceholder: 'MiniMax-…' },
  { id: 'zhipu', label: '智谱 GLM', apiUrl: 'https://open.bigmodel.cn/api/paas/v4', protocol: 'openai-compatible', modelPlaceholder: 'glm-…' },
  { id: 'siliconflow', label: '硅基流动 SiliconFlow', apiUrl: 'https://api.siliconflow.cn/v1', protocol: 'openai-compatible', modelPlaceholder: 'provider/model' },
  { id: 'openrouter', label: 'OpenRouter', apiUrl: 'https://openrouter.ai/api/v1', protocol: 'openai-compatible', modelPlaceholder: 'provider/model' },
  { id: 'mistral', label: 'Mistral AI', apiUrl: 'https://api.mistral.ai/v1', protocol: 'openai-compatible', modelPlaceholder: 'mistral-…' },
  { id: 'groq', label: 'Groq', apiUrl: 'https://api.groq.com/openai/v1', protocol: 'openai-compatible', modelPlaceholder: '按 Groq 控制台填写' },
  { id: 'xai', label: 'xAI', apiUrl: 'https://api.x.ai/v1', protocol: 'openai-compatible', modelPlaceholder: '按 xAI 控制台填写' },
  { id: 'ollama', label: 'Ollama 本地模型', apiUrl: 'http://localhost:11434/v1', protocol: 'openai-compatible', modelPlaceholder: '本地已下载的模型名' },
  { id: 'custom', label: '自定义 OpenAI 兼容接口', apiUrl: '', protocol: 'openai-compatible', modelPlaceholder: '服务商提供的模型 ID' },
] as const

const protocolItems = computed(() => [
  { title: t('features.llm.config.protocolCompatible'), value: 'openai-compatible' },
  { title: t('features.llm.config.protocolChat'), value: 'openai-chat' },
  { title: t('features.llm.config.protocolResponses'), value: 'openai-responses' },
  { title: t('features.llm.config.protocolAnthropic'), value: 'anthropic-messages' },
])
const authItems = [
  { title: 'API Key (x-api-key)', value: 'api-key' },
  { title: 'Bearer Token (Authorization)', value: 'bearer' },
]
const deliveryItems = computed(() => [
  { title: t('features.llm.config.standardDelivery'), value: 'standard' },
  { title: t('features.llm.config.userMessageDelivery'), value: 'user-message' },
])
const selectedPreset = computed(() =>
  providerPresets.find((preset) => preset.apiUrl && preset.apiUrl === props.modelValue.apiUrl)?.id ?? 'custom',
)
const selectedPresetInfo = computed(() => providerPresets.find((preset) => preset.id === selectedPreset.value))
const requestUrlIssue = computed(() =>
  props.modelValue.apiUrl ? getRequestUrlIssue(normalizeLlmConfig(props.modelValue)) : undefined,
)
const requestUrlHint = computed(() => getRequestUrlHint(normalizeLlmConfig(props.modelValue)))
const headerIssue = computed(() => getCustomHeaderIssue(props.modelValue.customHeaders))
const headerIssueKey = computed(() => {
  const issue = headerIssue.value
  return issue === 'invalid-name'
    ? 'invalidHeaderName'
    : issue === 'invalid-value'
      ? 'invalidHeaderValue'
      : issue === 'protected-name'
        ? 'protectedHeaderName'
        : 'duplicateHeaderName'
})

const update = <K extends keyof LlmConfig>(key: K, value: LlmConfig[K]) => {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}
const restoreSamplingDefaults = () => {
  const defaults = defaultLlmConfig()
  update('temperature', defaults.temperature)
  update('topP', defaults.topP)
}
const selectPreset = (id: string) => {
  const preset = providerPresets.find((item) => item.id === id)
  if (!preset) return
  const changingProvider = selectedPreset.value !== id
  const base = { ...defaultLlmConfig(), ...props.modelValue }
  emit('update:modelValue', {
    ...base,
    apiUrl: preset.apiUrl,
    protocol: preset.protocol as LlmProtocol,
    ...(changingProvider
      ? { apiKey: '', modelName: '', customHeaders: [] }
      : {}),
  })
}
const updateHeader = (index: number, key: 'name' | 'value', value: string) => {
  const headers = props.modelValue.customHeaders.map((header, currentIndex) =>
    currentIndex === index ? { ...header, [key]: value } : header,
  )
  update('customHeaders', headers)
}
const addHeader = () => update('customHeaders', [...props.modelValue.customHeaders, { name: '', value: '' }])
const removeHeader = (index: number) =>
  update('customHeaders', props.modelValue.customHeaders.filter((_, currentIndex) => currentIndex !== index))
</script>
