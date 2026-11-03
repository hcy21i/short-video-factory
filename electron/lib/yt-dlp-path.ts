import path from 'node:path'

/** Release builds use only their bundled engine; development may use PATH. */
export function ytDlpCommand(packaged: boolean, resourcesPath: string, platform: NodeJS.Platform): string {
  if (!packaged) return 'yt-dlp'
  return path.join(resourcesPath, 'yt-dlp', platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
}
