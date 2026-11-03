/** 浏览器回退只接受播放地址中明确标识了目标作品的结果。 */
export function isDouyinMediaForVideo(value: string, requestedId: string): boolean {
  if (!/^\d+$/.test(requestedId)) return false
  try {
    const url = new URL(value)
    const ids = url.searchParams.getAll('__vid')
    return url.protocol === 'https:' && ids.length === 1 && ids[0] === requestedId
  } catch {
    return false
  }
}

/** 仅解析分享页中匹配目标作品 ID 的公开数据，不接受页面中的其他作品。 */
export function parseDouyinSharePage(html: string, requestedId: string): string | null {
  if (!/^\d+$/.test(requestedId)) return null
  const router = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/)
  const render = html.match(/<script\b[^>]*\bid=["']RENDER_DATA["'][^>]*>([\s\S]*?)<\/script>/i)
  let data: unknown
  try {
    data = router ? JSON.parse(router[1]) : render ? JSON.parse(decodeURIComponent(render[1])) : null
  } catch {
    return null
  }
  const pending: unknown[] = [data]
  while (pending.length) {
    const item = pending.pop()
    if (!item || typeof item !== 'object') continue
    if (Array.isArray(item)) { pending.push(...item); continue }
    const record = item as Record<string, unknown>
    if (String(record.aweme_id ?? record.awemeId ?? '') === requestedId) {
      const video = record.video as Record<string, unknown> | undefined
      const address = (video?.play_addr ?? video?.playAddr) as Record<string, unknown> | undefined
      const urls = address?.url_list ?? address?.urlList
      if (Array.isArray(urls)) {
        const candidate = urls.find((value): value is string => typeof value === 'string' && value.startsWith('https://'))
        if (candidate) return candidate
      }
    }
    pending.push(...Object.values(record))
  }
  return null
}
