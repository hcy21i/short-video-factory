export const MAX_SUBTITLE_RENDER_FRAMES = 18_000
export const MAX_MCP_RENDER_DURATION_SECONDS = 10 * 60
export const MAX_MCP_SOURCE_TIMESTAMP_SECONDS = 24 * 60 * 60

export function getSubtitleRenderFrameCount(durationMs: number, fps: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Number.isFinite(fps) || fps <= 0) {
    throw new Error('字幕渲染时长或帧率无效。')
  }

  const frameCount = Math.ceil((durationMs / 1000) * fps)
  if (!Number.isSafeInteger(frameCount) || frameCount > MAX_SUBTITLE_RENDER_FRAMES) {
    throw new Error(`字幕帧渲染最多支持 ${MAX_SUBTITLE_RENDER_FRAMES.toLocaleString()} 帧。`)
  }

  return Math.max(1, frameCount)
}

export function validateMcpRenderDuration(value: unknown) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > MAX_MCP_RENDER_DURATION_SECONDS
  ) {
    throw new Error(`duration 必须大于 0 且不超过 ${MAX_MCP_RENDER_DURATION_SECONDS} 秒。`)
  }

  return value
}
