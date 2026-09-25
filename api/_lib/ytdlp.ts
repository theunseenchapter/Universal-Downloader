import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { MediaFormat, MediaInfo } from './media.js'

const execFileAsync = promisify(execFile)
const ytDlpPath = () => process.env.YTDLP_PATH ?? 'yt-dlp'

type YtDlpFormat = { format_id?: string; ext?: string; height?: number; abr?: number; filesize?: number; vcodec?: string; acodec?: string }
type YtDlpInfo = { title?: string; thumbnail?: string; duration?: number; formats?: YtDlpFormat[] }

function runYtDlp(args: string[]) {
  return execFileAsync(ytDlpPath(), args, { maxBuffer: 2_000_000, windowsHide: true }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : ''
    if (/not found|cannot find|enoent/i.test(message)) throw new Error('YouTube downloads require yt-dlp to be installed on the server and configured with YTDLP_PATH.')
    throw new Error('The configured YouTube provider could not access this public media URL.')
  })
}

function formatsFrom(info: YtDlpInfo): MediaFormat[] {
  return (info.formats ?? []).flatMap((format) => {
    if (!format.format_id || !format.ext) return []
    const hasVideo = format.vcodec && format.vcodec !== 'none'
    const hasAudio = format.acodec && format.acodec !== 'none'
    if (!hasVideo && !hasAudio) return []
    const type: MediaFormat['type'] = hasVideo ? 'video' : 'audio'
    const quality = hasVideo ? (format.height ? `${format.height}p` : 'Video') : (format.abr ? `${Math.round(format.abr)} kbps` : 'Audio')
    return [{ id: format.format_id, type, format: format.ext, quality, filesize: format.filesize }]
  }).slice(-20)
}

export async function analyzeYtDlp(url: URL): Promise<MediaInfo> {
  const { stdout } = await runYtDlp(['--dump-single-json', '--no-warnings', '--no-playlist', '--skip-download', url.toString()])
  const info = JSON.parse(stdout) as YtDlpInfo
  const formats = formatsFrom(info)
  if (!info.title || formats.length === 0) throw new Error('The configured YouTube provider returned no downloadable public formats.')
  return { title: info.title, thumbnail: info.thumbnail, duration: info.duration, platform: 'youtube', formats }
}

export async function downloadYtDlp(url: URL, format: MediaFormat) {
  const { stdout } = await runYtDlp(['--get-url', '--no-warnings', '--no-playlist', '--format', format.id, url.toString()])
  const downloadUrl = stdout.trim().split(/\r?\n/)[0]
  if (!downloadUrl || !/^https?:\/\//i.test(downloadUrl)) throw new Error('The configured YouTube provider did not return a valid temporary download URL.')
  return { downloadUrl, expiresIn: Number(process.env.DOWNLOAD_EXPIRY_SECONDS ?? 3600) }
}