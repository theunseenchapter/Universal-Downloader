import { z } from 'zod'

export const mediaRequestSchema = z.object({ url: z.string().trim().url().max(2048) })
export const downloadRequestSchema = mediaRequestSchema.extend({ formatId: z.string().regex(/^[a-zA-Z0-9_.-]+$/) })

export type MediaFormat = { id: string; type: 'video' | 'audio'; format: string; quality: string; filesize?: number }
export type MediaInfo = { title: string; thumbnail?: string; duration?: number; platform: string; formats: MediaFormat[] }

const rateBuckets = new Map<string, { count: number; startedAt: number }>()
const isPrivateHostname = (hostname: string) => {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  if (normalized === 'localhost' || normalized === '::1' || normalized.endsWith('.local')) return true
  const parts = normalized.split('.').map(Number)
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) && (parts[0] === 10 || parts[0] === 127 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || parts[0] === 0)
}

export function validatePublicUrl(value: string) {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol) || isPrivateHostname(parsed.hostname)) throw new Error('Only public http or https media URLs are supported.')
  return parsed
}

export function checkRateLimit(key: string, limit: number) {
  const now = Date.now(); const windowMs = 60_000; const bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.startedAt >= windowMs) { rateBuckets.set(key, { count: 1, startedAt: now }); return true }
  if (bucket.count >= limit) return false
  bucket.count += 1; return true
}

export function platformFor(hostname: string) {
  const host = hostname.toLowerCase()
  if (host.includes('youtube') || host === 'youtu.be') return 'youtube'
  if (host.includes('pinterest')) return 'pinterest'
  if (host.includes('instagram')) return 'instagram'
  if (host.includes('tiktok')) return 'tiktok'
  if (host === 'x.com' || host.includes('twitter')) return 'x'
  return 'direct'
}

export function isDirectMediaPath(pathname: string) { return /\.(mp4|webm|mov|m4v|mp3|m4a|wav|ogg)(?:$|\?)/i.test(pathname) }

export async function analyzeDirectMedia(url: URL): Promise<MediaInfo> {
  if (!isDirectMediaPath(url.pathname)) throw new Error('This source needs a configured provider. Direct MP4, WebM, MP3, M4A, and WAV URLs are supported by default.')
  const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: controller.signal })
    if (!response.ok || response.headers.get('location')) throw new Error('The source did not allow a safe public metadata request.')
    const contentLength = Number(response.headers.get('content-length') ?? 0)
    const maxBytes = Number(process.env.MAX_FILE_SIZE_MB ?? 250) * 1_000_000
    if (contentLength > maxBytes) throw new Error('This file is larger than the configured download limit.')
    const extension = url.pathname.split('.').pop()?.toLowerCase() ?? 'mp4'
    const type = ['mp3', 'm4a', 'wav', 'ogg'].includes(extension) ? 'audio' : 'video'
    return { title: decodeURIComponent(url.pathname.split('/').pop() ?? 'Public media').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), platform: 'direct', formats: [{ id: `direct-${type}`, type, format: extension === 'mov' ? 'mp4' : extension, quality: 'Source quality', filesize: contentLength || undefined }] }
  } catch (error) {
    if (error instanceof Error && error.message.includes('configured')) throw error
    throw new Error('The source could not be reached safely. It may be private, expired, or blocking requests.', { cause: error })
  } finally { clearTimeout(timeout) }
}

export function safeResponse(error: unknown) { return error instanceof Error ? error.message : 'The media could not be processed.' }
