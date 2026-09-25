import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit, downloadRequestSchema, safeResponse, validatePublicUrl } from './_lib/media.js'
import { providerFor } from './_lib/providers.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'Method not allowed.' })
  const ip = String(request.headers?.['x-forwarded-for'] ?? 'unknown').split(',')[0]
  if (!checkRateLimit(`download:${ip}`, 3)) return response.status(429).json({ success: false, error: 'Download limit reached. Please try again in a minute.' })
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    const { url: rawUrl, formatId } = downloadRequestSchema.parse(body)
    const url = validatePublicUrl(rawUrl)
    const provider = providerFor(url)
    if (!provider) throw new Error('This source needs a configured provider. Direct public media URLs and configured YouTube downloads are supported.')
    const result = await provider.download(url, { id: formatId, type: 'video', format: 'unknown', quality: 'Selected format' })
    return response.status(200).json({ success: true, ...result })
  } catch (error) { return response.status(400).json({ success: false, error: safeResponse(error) }) }
}
