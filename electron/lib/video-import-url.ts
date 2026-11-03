export type VideoImportPlatform = 'douyin' | 'tiktok' | 'youtube' | 'instagram' | 'x' | 'facebook'

const platformDomains: Record<VideoImportPlatform, string[]> = {
  douyin: ['douyin.com', 'iesdouyin.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  x: ['x.com', 'twitter.com'],
  facebook: ['facebook.com', 'fb.watch'],
}

export function parseVideoImportUrl(input: string): { url: string; platform: VideoImportPlatform } {
  const links = input.match(/https?:\/\/[^\s<>"'，。；！）)]+/gi) ?? []
  if (links.length !== 1) throw new Error('请粘贴包含一个视频链接的分享文字')
  let url: URL
  try {
    url = new URL(links[0])
  } catch {
    throw new Error('请输入完整的视频链接')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('仅支持没有账号信息和自定义端口的 HTTPS 链接')
  }
  const host = url.hostname.toLowerCase()
  for (const [platform, domains] of Object.entries(platformDomains) as [VideoImportPlatform, string[]][]) {
    if (domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return { url: url.href, platform }
    }
  }
  throw new Error('暂不支持这个网站的视频链接')
}
