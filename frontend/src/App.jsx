import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Download, Music, Film, List, Clock, Trash2, X, ExternalLink, Copy, CheckCircle, AlertCircle, Loader, ChevronDown, RefreshCw } from 'lucide-react';

function fmtDur(s) {
  if (!s) return '';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h && `${h}h`, m && `${m}m`, sec && `${sec}s`].filter(Boolean).join(' ');
}

function fmtCount(n) {
  if (!n) return '';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n}`;
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes >= 1e9) return `~${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `~${(bytes / 1e6).toFixed(1)} MB`;
  return `~${(bytes / 1e3).toFixed(0)} KB`;
}

function classNames(...args) {
  return args.filter(Boolean).join(' ');
}

function useHistory() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem('yt-history') || '[]'); } catch { return []; }
  });
  const add = useCallback((item) => {
    setItems(prev => {
      const next = [{ ...item, date: Date.now() }, ...prev].slice(0, 50);
      localStorage.setItem('yt-history', JSON.stringify(next));
      return next;
    });
  }, []);
  const remove = useCallback((idx) => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      localStorage.setItem('yt-history', JSON.stringify(next));
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setItems([]);
    localStorage.removeItem('yt-history');
  }, []);
  return { items, add, remove, clear };
}

function ProgressBar({ progress, speed, eta, status }) {
  const p = Math.min(progress || 0, 100);
  const color = status === 'completed' ? '#22c55e' : status === 'failed' || status === 'cancelled' ? '#ef4444' : 'var(--accent)';
  return (
    <div className="w-full">
      <div className="h-2 rounded-full" style={{ background: 'var(--surface2)', overflow: 'hidden' }}>
        <div className="h-full rounded-full transition-all duration-300 ease-out" style={{ width: `${p}%`, background: `linear-gradient(90deg, var(--accent), ${color})` }} />
      </div>
      <div className="flex justify-between mt-1 mono text-xs" style={{ color: 'var(--muted)' }}>
        <span>{p.toFixed(1)}%</span>
        {(status === 'downloading' && speed) && <span>{speed} {eta ? `· ETA ${eta}` : ''}</span>}
        {status === 'completed' && <span style={{ color: '#22c55e' }}>Complete</span>}
        {status === 'failed' && <span style={{ color: '#ef4444' }}>Failed</span>}
        {status === 'cancelled' && <span style={{ color: '#ef4444' }}>Cancelled</span>}
      </div>
    </div>
  );
}

function DownloadItem({ dl, onCancel, onSave, onDismiss }) {
  const isDone = dl.status === 'completed';
  const isFailed = dl.status === 'failed' || dl.status === 'cancelled';
  return (
    <div className="glass rounded-xl p-4 animate-fadeUp" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {dl.ext === 'mp3' || dl.ext === 'm4a' || dl.ext === 'opus' || dl.ext === 'flac'
            ? <Music size={16} style={{ color: 'var(--accent2)', flexShrink: 0 }} />
            : <Film size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          }
          <span className="mono text-sm truncate" style={{ color: 'var(--text)' }}>{dl.filename}</span>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {isDone && (
            <button onClick={() => onSave(dl.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: '#22c55e' }} title="Save file">
              <Download size={16} />
            </button>
          )}
          {dl.status === 'downloading' && (
            <button onClick={() => onCancel(dl.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--muted)' }} title="Cancel">
              <X size={16} />
            </button>
          )}
          {(isDone || isFailed) && (
            <button onClick={() => onDismiss(dl.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--muted)' }} title="Dismiss">
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <ProgressBar progress={dl.progress} speed={dl.speed} eta={dl.eta} status={dl.status} />
    </div>
  );
}

function FormatCard({ f, selected, onClick }) {
  const isAudio = f.height === -1;
  return (
    <div
      className={classNames('format-card glass rounded-xl p-3 cursor-pointer transition-all', selected && 'selected')}
      onClick={onClick}
      style={{ border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        {isAudio ? <Music size={14} style={{ color: 'var(--accent2)' }} /> : <Film size={14} style={{ color: 'var(--accent)' }} />}
        <span className="mono font-bold text-sm" style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}>
          {f.quality}
        </span>
      </div>
      <div className="flex gap-2 items-center mt-1">
        <span className="mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>{f.ext}</span>
        {f.filesize && <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{fmtSize(f.filesize)}</span>}
      </div>
    </div>
  );
}

function VideoCard({ video, onSelect, compact }) {
  return (
    <div className="glass rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]" onClick={() => onSelect && onSelect(video)} style={{ border: '1px solid var(--border)' }}>
      <div className="relative">
        <img src={video.thumbnail} alt={video.title} className="w-full object-cover" style={{ height: compact ? 100 : 140, objectPosition: 'center' }} />
        {video.duration && (
          <span className="mono absolute bottom-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.85)', color: 'var(--text)' }}>
            {fmtDur(video.duration)}
          </span>
        )}
      </div>
      <div className="p-3">
        <p className="mono text-xs font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>{video.title}</p>
        {video.uploader && <p className="mono text-xs mt-1" style={{ color: 'var(--muted)' }}>{video.uploader}</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('single');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [subsLang, setSubsLang] = useState('none');
  // Playlist
  const [playlist, setPlaylist] = useState(null);
  // Downloads
  const [activeDownloads, setActiveDownloads] = useState([]);
  const eventSources = useRef({});
  // History
  const { items: history, add: addHistory, remove: removeHistory, clear: clearHistory } = useHistory();
  // Clip
  const [clipStart, setClipStart] = useState('');
  const [clipEnd, setClipEnd] = useState('');
  const [showClip, setShowClip] = useState(false);

  const fetchInfo = async (e) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;
    setLoading(true); setError(''); setInfo(null); setPlaylist(null); setSelected(null);
    try {
      const res = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      if (data.type === 'playlist') {
        setPlaylist(data);
        setTab('playlist');
      } else {
        setInfo(data);
        if (data.formats?.length) setSelected(data.formats[0]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistVideo = (video) => {
    setUrl(video.url);
    setTab('single');
    setTimeout(() => fetchInfo(), 100);
  };

  const startDownload = async () => {
    if (!selected || !info) return;
    const body = { url: url.trim(), format_id: selected.format_id, title: info.title, hasAudio: selected.hasAudio, filesize: selected.filesize };
    if (subsLang !== 'none') body.subtitles = subsLang;
    if (clipStart) body.start = clipStart;
    if (clipEnd) body.end = clipEnd;
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      addHistory({ filename: data.filename, format: selected.quality, title: info.title, url: url.trim() });
      listenProgress(data.downloadId);
    } catch (err) {
      setError(err.message);
    }
  };

  const listenProgress = (id) => {
    const es = new EventSource(`/api/progress/${id}`);
    eventSources.current[id] = es;
    setActiveDownloads(prev => {
      if (prev.find(d => d.id === id)) return prev;
      return [...prev, { id, progress: 0, speed: '', eta: '', totalSize: '', status: 'queued', filename: '', ext: '' }];
    });
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      setActiveDownloads(prev => prev.map(d => d.id === id ? { ...d, ...data } : d));
      if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
        es.close();
        delete eventSources.current[id];
      }
    };
    es.onerror = () => {
      es.close();
      delete eventSources.current[id];
    };
  };

  const cancelDownload = async (id) => {
    await fetch(`/api/download/${id}`, { method: 'DELETE' });
    if (eventSources.current[id]) {
      eventSources.current[id].close();
      delete eventSources.current[id];
    }
  };

  const saveFile = async (id) => {
    const a = document.createElement('a');
    a.href = `/api/file/${id}`;
    a.click();
  };

  const dismissDownload = (id) => {
    setActiveDownloads(prev => prev.filter(d => d.id !== id));
    if (eventSources.current[id]) {
      eventSources.current[id].close();
      delete eventSources.current[id];
    }
  };

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText();
    const urls = text.split('\n').map(s => s.trim()).filter(s => s.startsWith('http'));
    if (urls.length > 1) {
      setUrl(urls.join('\n'));
    } else if (urls.length === 1) {
      setUrl(urls[0]);
    }
  };

  const hasActiveDownloads = activeDownloads.some(d => d.status === 'downloading' || d.status === 'queued');

  return (
    <div className="noise min-h-screen relative">
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255,61,90,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mono inline-block text-xs tracking-widest mb-3 px-3 py-1 rounded-full" style={{ border: '1px solid var(--border)', color: 'var(--muted)', background: 'rgba(255,255,255,0.02)' }}>
            FREE · NO LIMITS · NO ADS
          </div>
          <h1 className="mono text-5xl font-bold mb-2" style={{ letterSpacing: '-2px' }}>
            <span style={{ color: 'var(--accent)' }}>YT</span><span style={{ color: 'var(--text)' }}>GRAB</span>
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>paste a link · pick quality · download</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 glass rounded-xl p-1" style={{ border: '1px solid var(--border)' }}>
          {[
            { id: 'single', label: 'Single', icon: Search },
            { id: 'playlist', label: 'Playlist', icon: List },
            { id: 'history', label: 'History', icon: Clock },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={classNames('flex-1 py-2 px-3 rounded-lg mono text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                tab === t.id ? 'text-white' : '')}
              style={{ background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? 'white' : 'var(--muted)' }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={fetchInfo} className="mb-6">
          <div className="glass rounded-2xl p-1.5 flex gap-2" style={{ border: '1px solid var(--border)' }}>
            <textarea
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste YouTube URL(s) — one per line for batch"
              className="flex-1 bg-transparent px-4 py-3 text-sm rounded-xl resize-none"
              style={{ color: 'var(--text)', fontFamily: 'DM Sans, sans-serif', minHeight: 48, maxHeight: 120 }}
              rows={url.split('\n').length > 1 ? Math.min(url.split('\n').length, 4) : 1}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); fetchInfo(e); } }}
            />
            <div className="flex gap-1">
              <button type="button" onClick={handlePaste} className="px-3 rounded-xl mono text-xs transition-all" style={{ background: 'var(--surface2)', color: 'var(--muted)' }} title="Paste from clipboard">
                <Copy size={16} />
              </button>
              <button type="submit" disabled={loading || !url.trim()}
                className="shimmer-btn px-5 rounded-xl mono text-sm font-bold text-white transition-all disabled:opacity-40 flex items-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : <Search size={16} />}
                {loading ? '' : 'Fetch'}
              </button>
            </div>
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="glass rounded-xl p-4 mb-6 animate-fadeUp flex items-center gap-3" style={{ borderColor: 'rgba(255,61,90,0.4)', color: '#ff8899' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span className="mono text-xs">ERROR — {error}</span>
          </div>
        )}

        {/* Active Downloads */}
        {activeDownloads.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="mono text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}>DOWNLOADS</span>
              {activeDownloads.filter(d => d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled').length > 0 && (
                <button onClick={() => {
                  const done = activeDownloads.filter(d => d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled');
                  done.forEach(d => dismissDownload(d.id));
                }} className="mono text-xs" style={{ color: 'var(--accent)' }}>Clear finished</button>
              )}
            </div>
            {activeDownloads.map(dl => (
              <DownloadItem key={dl.id} dl={dl} onCancel={cancelDownload} onSave={saveFile} onDismiss={dismissDownload} />
            ))}
          </div>
        )}

        {/* Tab: Single */}
        {tab === 'single' && info && (
          <div className="animate-fadeUp">
            <div className="glass rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)' }}>
              <div className="relative">
                <img src={info.thumbnail} alt={info.title} className="w-full object-cover" style={{ maxHeight: 240, objectPosition: 'center' }} />
                {info.duration && (
                  <span className="mono absolute bottom-2 right-2 text-xs px-2 py-1 rounded" style={{ background: 'rgba(0,0,0,0.8)', color: 'var(--text)' }}>
                    {fmtDur(info.duration)}
                  </span>
                )}
              </div>
              <div className="p-5">
                <h2 className="font-semibold text-base mb-1 leading-snug" style={{ color: 'var(--text)' }}>{info.title}</h2>
                <div className="flex gap-3 flex-wrap mt-1">
                  {info.uploader && <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{info.uploader}</span>}
                  {info.view_count > 0 && <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{fmtCount(info.view_count)} views</span>}
                  {info.like_count > 0 && <span className="mono text-xs" style={{ color: 'var(--muted)' }}>👍 {fmtCount(info.like_count)}</span>}
                </div>
              </div>
            </div>

            {/* Subtitles */}
            {info.subtitles?.length > 0 && (
              <div className="mb-4 flex items-center gap-3">
                <span className="mono text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}>SUBTITLES</span>
                <select value={subsLang} onChange={e => setSubsLang(e.target.value)}
                  className="mono text-xs px-3 py-1.5 rounded-lg bg-transparent"
                  style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <option value="none">None</option>
                  {info.subtitles.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Clip */}
            <div className="mb-4">
              <button onClick={() => setShowClip(!showClip)} className="mono text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                <ChevronDown size={12} className={showClip ? 'rotate-180' : ''} /> Clip portion
              </button>
              {showClip && (
                <div className="flex gap-2 mt-2 items-center">
                  <span className="mono text-xs" style={{ color: 'var(--muted)' }}>From</span>
                  <input type="text" value={clipStart} onChange={e => setClipStart(e.target.value)} placeholder="00:00" className="mono text-xs px-2 py-1 rounded bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)', width: 70 }} />
                  <span className="mono text-xs" style={{ color: 'var(--muted)' }}>to</span>
                  <input type="text" value={clipEnd} onChange={e => setClipEnd(e.target.value)} placeholder="01:30" className="mono text-xs px-2 py-1 rounded bg-transparent" style={{ border: '1px solid var(--border)', color: 'var(--text)', width: 70 }} />
                </div>
              )}
            </div>

            {/* Formats */}
            <div className="mb-6">
              <p className="mono text-xs mb-3" style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}>SELECT FORMAT</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {info.formats.map(f => (
                  <FormatCard key={f.format_id} f={f} selected={selected?.format_id === f.format_id} onClick={() => setSelected(f)} />
                ))}
              </div>
            </div>

            {/* Download button */}
            <button onClick={startDownload} disabled={!selected || hasActiveDownloads}
              className="w-full py-4 rounded-2xl mono font-bold text-base text-white transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                opacity: hasActiveDownloads ? 0.6 : 1,
                boxShadow: '0 8px 32px rgba(255,61,90,0.3)',
              }}>
              {hasActiveDownloads ? (
                <><Loader size={18} className="animate-spin" /> DOWNLOAD IN PROGRESS</>
              ) : (
                <><Download size={18} /> DOWNLOAD {selected?.quality || ''}</>
              )}
            </button>
          </div>
        )}

        {/* Tab: Playlist */}
        {tab === 'playlist' && playlist && (
          <div className="animate-fadeUp">
            <div className="glass rounded-2xl p-5 mb-6" style={{ border: '1px solid var(--border)' }}>
              <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>{playlist.title}</h2>
              <div className="flex gap-3 mt-1">
                {playlist.uploader && <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{playlist.uploader}</span>}
                <span className="mono text-xs" style={{ color: 'var(--accent)' }}>{playlist.video_count} videos</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {playlist.videos.map(v => (
                <VideoCard key={v.id} video={v} onSelect={handlePlaylistVideo} compact />
              ))}
            </div>
          </div>
        )}

        {/* Tab: History */}
        {tab === 'history' && (
          <div className="animate-fadeUp">
            {history.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center" style={{ border: '1px solid var(--border)' }}>
                <Clock size={32} style={{ color: 'var(--muted)', margin: '0 auto 12px', opacity: 0.5 }} />
                <p className="mono text-sm" style={{ color: 'var(--muted)' }}>No downloads yet</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="mono text-xs" style={{ color: 'var(--muted)', letterSpacing: '0.1em' }}>HISTORY ({history.length})</span>
                  <button onClick={clearHistory} className="mono text-xs flex items-center gap-1" style={{ color: '#ef4444' }}>
                    <Trash2 size={12} /> Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {history.map((h, i) => (
                    <div key={i} className="glass rounded-xl p-3 flex items-center gap-3 animate-fadeUp" style={{ border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="mono text-xs font-semibold truncate" style={{ color: 'var(--text)' }}>{h.title || h.filename}</p>
                        <div className="flex gap-2 mt-0.5">
                          <span className="mono text-xs px-1 py-0.5 rounded" style={{ background: 'var(--surface2)', color: 'var(--accent)' }}>{h.format}</span>
                          <span className="mono text-xs" style={{ color: 'var(--muted)' }}>{new Date(h.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button onClick={() => removeHistory(i)} className="p-1.5 rounded-lg" style={{ color: 'var(--muted)' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Empty state */}
        {tab === 'single' && !info && !error && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <ExternalLink size={40} style={{ color: 'var(--muted)', opacity: 0.3, margin: '0 auto 12px' }} />
            <p className="mono text-sm" style={{ color: 'var(--muted)' }}>Enter a YouTube URL above to get started</p>
            <p className="mono text-xs mt-2" style={{ color: 'var(--muted)', opacity: 0.5 }}>Also works with playlists · paste multiple URLs for batch</p>
          </div>
        )}

        <p className="mono text-center text-xs mt-12" style={{ color: 'var(--muted)' }}>for personal use only · respect copyright</p>
      </div>
    </div>
  );
}
