import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { parseVideoImportUrl } from './video-import-url'
import { downloadDouyinVideo } from './douyin-import'
import { ytDlpCommand } from './yt-dlp-path'

export async function downloadVideo(urlText: string, folder: string, progress: (line: string) => void): Promise<void> {
  const { url, platform } = parseVideoImportUrl(urlText)
  if (!path.isAbsolute(folder) || !fs.statSync(folder).isDirectory()) throw new Error('请选择有效的素材文件夹')
  if (platform === 'douyin') return downloadDouyinVideo(url, folder, progress)
  await new Promise<void>((resolve, reject) => {
    const args = ['--ignore-config', '--no-playlist', '--no-cookies', '--no-cookies-from-browser', '--no-overwrites', '--newline', '--no-simulate', '--format', 'best[ext=mp4]', '--output', path.join(folder, '%(extractor_key)s-%(id)s.%(ext)s'), '--', url]
    const child = spawn(ytDlpCommand(app.isPackaged, process.resourcesPath, process.platform), args, { windowsHide: true, shell: false })
    let errorText = ''
    child.stdout.on('data', (data: Buffer) => {
      const match = data.toString().match(/\[download\]\s+([\d.]+)%/)
      if (match) progress(match[1])
    })
    child.stderr.on('data', (data: Buffer) => { errorText = (errorText + data.toString()).slice(-3000) })
    child.on('error', () => reject(new Error(app.isPackaged ? '应用内置的下载引擎无法启动，请重新安装应用' : '开发环境未找到 yt-dlp，请先安装下载引擎')))
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(errorText || `下载失败（退出码 ${code}）`)))
  })
}
