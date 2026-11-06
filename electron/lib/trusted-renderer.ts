import type { IpcMainInvokeEvent } from 'electron'

export function assertTrustedAppFrame(event: IpcMainInvokeEvent, feature: string) {
  const frame = event.senderFrame
  if (!frame || frame !== event.sender.mainFrame) {
    throw new Error(`${feature} is only available to the main application frame.`)
  }

  const frameUrl = new URL(frame.url)
  const devServerUrl = process.env['VITE_DEV_SERVER_URL']
  if (devServerUrl) {
    const devOrigin = new URL(devServerUrl).origin
    if (frameUrl.origin !== devOrigin) throw new Error(`Untrusted ${feature} IPC sender.`)
  } else if (frameUrl.protocol !== 'file:') {
    throw new Error(`Untrusted ${feature} IPC sender.`)
  }
}
