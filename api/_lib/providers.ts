import { analyzeDirectMedia, isDirectMediaPath, type MediaFormat, type MediaInfo } from './media'

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
  download: async (url) => ({ downloadUrl: url.toString(), expiresIn: 0 }),
}

export function providerFor(url: URL) { return directProvider.canHandle(url) ? directProvider : undefined }
