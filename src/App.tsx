import { useState } from 'react'
import { ArrowRight, Check, Clock3, Download, FileAudio, FileVideo, Link2, LoaderCircle, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import './App.css'

type MediaFormat = { id: string; type: 'video' | 'audio'; format: string; quality: string; filesize?: number }
type MediaInfo = { title: string; thumbnail?: string; duration?: number; platform: string; formats: MediaFormat[] }
type HistoryItem = Pick<MediaInfo, 'title' | 'platform' | 'thumbnail'> & { url: string; date: string }
const historyKey = 'downloader-history'
const examples = [{ label: 'Direct MP4', value: 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4' }, { label: 'YouTube', value: 'https://youtube.com/watch?v=example' }]
const formatBytes = (bytes?: number) => bytes ? `${(bytes / 1_000_000).toFixed(1)} MB` : 'Size on request'
const formatDuration = (seconds?: number) => seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Direct media'
const readApiResponse = async <T,>(response: Response) => {
  const body = await response.text()
  try { return { response, payload: JSON.parse(body) as T } } catch { throw new Error(response.status === 404 ? 'The serverless API is not running. Start with `vercel dev` for local analysis.' : 'The server returned an invalid response. Please try again.') }
}

function App() {
  const [url, setUrl] = useState('')
  const [media, setMedia] = useState<MediaInfo | null>(null)
  const [selected, setSelected] = useState<Record<'video' | 'audio', string>>({ video: '', audio: '' })
  const [status, setStatus] = useState<'idle' | 'analyzing' | 'downloading'>('idle')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>(() => JSON.parse(localStorage.getItem(historyKey) ?? '[]'))

  const analyze = async (event?: React.FormEvent) => {
    event?.preventDefault(); setError(''); setMedia(null); setStatus('analyzing')
    try {
      const { response, payload } = await readApiResponse<{ success: boolean; media?: MediaInfo; error?: string }>(await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }))
      if (!response.ok || !payload.success || !payload.media) throw new Error(payload.error ?? 'This media could not be analyzed.')
      const nextMedia = payload.media
      setMedia(nextMedia)
      setSelected({ video: nextMedia.formats.find((format) => format.type === 'video')?.id ?? '', audio: nextMedia.formats.find((format) => format.type === 'audio')?.id ?? '' })
      const nextHistory = [{ title: nextMedia.title, platform: nextMedia.platform, thumbnail: nextMedia.thumbnail, url, date: new Date().toISOString() }, ...history.filter((item) => item.url !== url)].slice(0, 5)
      setHistory(nextHistory); localStorage.setItem(historyKey, JSON.stringify(nextHistory))
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Something went wrong. Please try again.') } finally { setStatus('idle') }
  }

  const download = async (formatId: string) => {
    if (!media) return
    setError(''); setStatus('downloading')
    try {
      const { response, payload } = await readApiResponse<{ success: boolean; downloadUrl?: string; error?: string }>(await fetch('/api/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, formatId }) }))
      if (!response.ok || !payload.success || !payload.downloadUrl) throw new Error(payload.error ?? 'The download could not be prepared.')
      window.location.href = payload.downloadUrl
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'The download could not be prepared.') } finally { setStatus('idle') }
  }

  const clearHistory = () => { setHistory([]); localStorage.removeItem(historyKey) }
  const videoFormats = media?.formats.filter((format) => format.type === 'video') ?? []
  const audioFormats = media?.formats.filter((format) => format.type === 'audio') ?? []

  return (
    <main className="app-shell">
      <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><ArrowRight size={18} /></span> dropzone</a><span className="secure-label"><ShieldCheck size={15} /> privacy-first processing</span></header>
      <section className="hero-section"><div className="eyebrow"><Sparkles size={15} /> Universal media toolkit</div><h1>Download media<br /><em>from a link.</em></h1><p className="hero-copy">A quieter way to save public media you are authorized to use. Paste a link, inspect the available formats, and take the file with you.</p><form className="url-form" onSubmit={analyze}><div className="input-wrap"><Link2 size={19} /><input aria-label="Media URL" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste your video or media URL here..." type="url" required /><button aria-label="Analyze media" disabled={status !== 'idle'} type="submit">{status === 'analyzing' ? <LoaderCircle className="spin" size={20} /> : <ArrowRight size={20} />}</button></div><div className="form-meta"><span>Try an authorized public URL</span><span className="format-pills"><b>MP4</b><b>MP3</b><b>WEBM</b></span></div></form><div className="examples"><span>Examples</span>{examples.map((example) => <button type="button" key={example.label} onClick={() => setUrl(example.value)}>{example.label}</button>)}</div>{error && <div className="error-banner"><X size={18} /><span>{error}</span></div>}</section>
      {media && <section className="results-section" aria-live="polite"><div className="section-heading"><div><span className="section-kicker">Ready to save</span><h2>Choose your format</h2></div><span className="source-badge"><Check size={14} /> {media.platform}</span></div><article className="media-card"><div className="media-preview">{media.thumbnail ? <img src={media.thumbnail} alt="" /> : <FileVideo size={40} />}</div><div className="media-details"><h3>{media.title}</h3><div className="media-meta"><span>{media.platform}</span><span>•</span><span><Clock3 size={14} /> {formatDuration(media.duration)}</span></div><p>Only download media you have permission to use.</p></div></article><div className="format-grid">{videoFormats.length > 0 && <FormatGroup icon={<FileVideo size={18} />} label="Video" formats={videoFormats} selected={selected.video} onSelect={(id) => setSelected({ ...selected, video: id })} onDownload={download} />}{audioFormats.length > 0 && <FormatGroup icon={<FileAudio size={18} />} label="Audio" formats={audioFormats} selected={selected.audio} onSelect={(id) => setSelected({ ...selected, audio: id })} onDownload={download} />}</div></section>}
      {history.length > 0 && <section className="history-section"><div className="section-heading"><div><span className="section-kicker">On this device</span><h2>Recent links</h2></div><button className="text-button" type="button" onClick={clearHistory}><Trash2 size={14} /> Clear history</button></div><div className="history-list">{history.map((item) => <button className="history-item" type="button" key={item.url} onClick={() => setUrl(item.url)}><span className="history-thumb">{item.thumbnail ? <img src={item.thumbnail} alt="" /> : <Link2 size={16} />}</span><span><strong>{item.title}</strong><small>{item.platform} · {new Date(item.date).toLocaleDateString()}</small></span><ArrowRight size={16} /></button>)}</div></section>}
      <footer><div><span className="brand small"><span className="brand-mark"><ArrowRight size={14} /></span> dropzone</span><span>Files are handled temporarily and never saved to your account.</span></div><span>Built for public, authorized media.</span></footer>
    </main>
  )
}

function FormatGroup({ icon, label, formats, selected, onSelect, onDownload }: { icon: React.ReactNode; label: string; formats: MediaFormat[]; selected: string; onSelect: (id: string) => void; onDownload: (id: string) => void }) {
  return <div className="format-group"><div className="format-label">{icon}<span>{label}</span></div><div className="format-row"><select value={selected} onChange={(event) => onSelect(event.target.value)} aria-label={`${label} format`}>{formats.map((format) => <option key={format.id} value={format.id}>{format.quality} {format.format.toUpperCase()} · {formatBytes(format.filesize)}</option>)}</select><button className="download-button" type="button" onClick={() => onDownload(selected)} disabled={!selected}><Download size={17} /> Download</button></div></div>
}

export default App
