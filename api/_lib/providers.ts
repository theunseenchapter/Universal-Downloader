import { analyzeDirectMedia, isDirectMediaPath, type MediaFormat, type MediaInfo } from './media.js'
import { analyzeYtDlp, downloadYtDlp } from './ytdlp.js'

export interface MediaProvider {
  canHandle(url: URL): boolean
  analyze(url: URL): Promise<MediaInfo>
  getFormats(url: URL): Promise<MediaFormat[]>
  download(url: URL, format: MediaFormat): Promise<{ downloadUrl: string; expiresIn: number }>
}

export const directProvider: MediaProvider = {
  canHandle: (url) => isDirectMediaPath(url.pathname),
  analyze: analyzeDirectMedia,
  getFormats: async (url) => (await analyzeDirectMedia(url)).formats,
  download: async (url, format) => {
    if (!format.id.startsWith('direct-')) throw new Error('This download is not available from the configured public provider.')
    return { downloadUrl: url.toString(), expiresIn: 0 }
  },
}

export const ytDlpProvider: MediaProvider = {
  canHandle: (url) => /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname),
  analyze: analyzeYtDlp,
  getFormats: async (url) => (await analyzeYtDlp(url)).formats,
  download: downloadYtDlp,
}

export function providerFor(url: URL) {
  if (directProvider.canHandle(url)) return directProvider
  if (ytDlpProvider.canHandle(url)) return ytDlpProvider
  return undefined
}
