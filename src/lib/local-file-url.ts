/** 本地路径转为媒体元素可读取的 URL，保留文件名中的 #、? 和 %。 */
export function localFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  const url = normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
  return encodeURI(url).replace(/#/g, '%23').replace(/\?/g, '%3F')
}
