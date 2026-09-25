import { checkRateLimit, downloadRequestSchema, isDirectMediaPath, safeResponse, validatePublicUrl } from './_lib/media'

type RequestLike = { method?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> }
type ResponseLike = { status: (code: number) => ResponseLike; json: (body: unknown) => void }

export default async function handler(request: RequestLike, response: ResponseLike) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'Method not allowed.' })
  const ip = String(request.headers?.['x-forwarded-for'] ?? 'unknown').split(',')[0]
  if (!checkRateLimit(`download:${ip}`, 3)) return response.status(429).json({ success: false, error: 'Download limit reached. Please try again in a minute.' })
  try {
    const { url: rawUrl, formatId } = downloadRequestSchema.parse(request.body)
    const url = validatePublicUrl(rawUrl)
    if (!isDirectMediaPath(url.pathname) || !formatId.startsWith('direct-')) throw new Error('This download is not available from the configured public provider.')
    return response.status(200).json({ success: true, downloadUrl: url.toString(), expiresIn: 0 })
  } catch (error) { return response.status(400).json({ success: false, error: safeResponse(error) }) }
}
