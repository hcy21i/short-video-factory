import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { ytDlpCommand } from '../../electron/lib/yt-dlp-path'

describe('yt-dlp engine path', () => {
  it('uses the bundled executable for packaged Windows and Unix apps', () => {
    expect(ytDlpCommand(true, 'resources', 'win32')).toBe(path.join('resources', 'yt-dlp', 'yt-dlp.exe'))
    expect(ytDlpCommand(true, 'resources', 'darwin')).toBe(path.join('resources', 'yt-dlp', 'yt-dlp'))
    expect(ytDlpCommand(true, 'resources', 'linux')).toBe(path.join('resources', 'yt-dlp', 'yt-dlp'))
  })
  it('uses PATH in development', () => {
    expect(ytDlpCommand(false, 'resources', 'win32')).toBe('yt-dlp')
  })
})
