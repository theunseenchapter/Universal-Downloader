import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkRateLimit, mediaRequestSchema, platformFor, safeResponse, validatePublicUrl } from './_lib/media.js'
import { providerFor } from './_lib/providers.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (request.method !== 'POST') return response.status(405).json({ success: false, error: 'Method not allowed.' })
  const ip = String(request.headers?.['x-forwarded-for'] ?? 'unknown').split(',')[0]
  if (!checkRateLimit(`analyze:${ip}`, Number(process.env.RATE_LIMIT_REQUESTS ?? 10))) return response.status(429).json({ success: false, error: 'Too many requests. Please try again in a minute.' })
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body
    const { url: rawUrl } = mediaRequestSchema.parse(body)
    const url = validatePublicUrl(rawUrl)
    const platform = platformFor(url.hostname)
    if (platform !== 'direct') throw new Error(`${platform} links need an approved provider integration. This deployment does not bypass platform access controls.`)
    const provider = providerFor(url)
    if (!provider) throw new Error('This source needs a configured provider. Direct public media URLs are supported by default.')
    const media = await provider.analyze(url)
    return response.status(200).json({ success: true, media })
  } catch (error) { return response.status(400).json({ success: false, error: safeResponse(error) }) }
}
