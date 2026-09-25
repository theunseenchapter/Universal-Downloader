import { createReadStream, existsSync, promises as fs } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import analyze from './api/analyze.js'
import download from './api/download.js'

const port = Number(process.env.PORT ?? 3000)
const distRoot = resolve(fileURLToPath(new URL('./dist', import.meta.url)))
const apiHandlers: Record<string, (request: VercelRequest, response: VercelResponse) => unknown> = { '/api/analyze': analyze, '/api/download': download }

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('Request body is too large.')
    chunks.push(Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function serveStatic(request: IncomingMessage, response: ServerResponse) {
  const requestedPath = decodeURIComponent(request.url?.split('?')[0] ?? '/')
  const candidate = normalize(join(distRoot, requestedPath === '/' ? 'index.html' : requestedPath))
  const filePath = candidate.startsWith(distRoot) && existsSync(candidate) ? candidate : join(distRoot, 'index.html')
  const contentType = { '.css': 'text/css', '.js': 'text/javascript', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' }[extname(filePath)] ?? 'application/octet-stream'
  response.setHeader('Content-Type', contentType)
  createReadStream(filePath).pipe(response)
}

const server = createServer(async (request, response) => {
  try {
    const pathname = request.url?.split('?')[0] ?? '/'
    if (pathname === '/healthz' && request.method === 'GET') return sendJson(response, 200, { ok: true })
    const handler = apiHandlers[pathname]
    if (handler) {
      const body = request.method === 'POST' ? await readBody(request) : undefined
      const apiRequest = Object.assign(request, { body }) as unknown as VercelRequest
      const apiResponse = {
        status: (statusCode: number) => { response.statusCode = statusCode; return apiResponse },
        json: (payload: unknown) => { response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(payload)); return apiResponse },
      } as unknown as VercelResponse
      return await handler(apiRequest, apiResponse)
    }
    if (request.method === 'GET' || request.method === 'HEAD') return await serveStatic(request, response)
    sendJson(response, 404, { success: false, error: 'Not found.' })
  } catch (error) {
    sendJson(response, 400, { success: false, error: error instanceof Error ? error.message : 'Request failed.' })
  }
})

await fs.access(distRoot)
server.listen(port, () => console.log(`Dropzone listening on port ${port}`))