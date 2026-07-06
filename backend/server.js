// Check required tools at startup
try { execSync('yt-dlp --version', { timeout: 5000, encoding: 'utf8' }); } catch (e) {
  console.error('WARNING: yt-dlp not found');
}
try { execSync('deno --version', { timeout: 5000, encoding: 'utf8' }); } catch (e) {
  console.error('WARNING: deno not found');
}
try { execSync('ffmpeg -version', { timeout: 5000, encoding: 'utf8' }); } catch (e) {
  console.error('WARNING: ffmpeg not found');
}

const express = require('express');
const cors = require('cors');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve built frontend in production
const distPath = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const TMP_DIR = path.join(os.tmpdir(), 'yt-grab');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const downloads = new Map();

setInterval(() => {
  for (const f of fs.readdirSync(TMP_DIR)) {
    const fp = path.join(TMP_DIR, f);
    if (Date.now() - fs.statSync(fp).mtimeMs > 3600000) fs.unlinkSync(fp);
  }
}, 600000);

const STANDARD = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];

function nearestStandard(h) {
  return STANDARD.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
}

function parseVideoInfo(info) {
  const formats = (info.formats || [])
    .filter(f => f.vcodec !== 'none' && f.ext && f.height && f.height > 0)
    .map(f => ({
      format_id: f.format_id, ext: f.ext,
      quality: `${nearestStandard(f.height)}p${f.fps > 30 ? ` ${f.fps}fps` : ''}`,
      height: f.height, filesize: f.filesize || f.filesize_approx || null,
      hasAudio: f.acodec !== 'none',
    }))
    .sort((a, b) => b.height - a.height || (b.hasAudio ? 1 : -1))
    .filter((f, i, a) => a.findIndex(x => x.quality === f.quality) === i);
  const audioFormats = [
    { format_id: 'bestaudio/best', ext: 'mp3', quality: 'Audio Only (MP3)', height: -1, filesize: null },
    { format_id: 'bestaudio[ext=m4a]', ext: 'm4a', quality: 'Audio Only (M4A)', height: -1, filesize: null },
    { format_id: 'bestaudio[ext=webm]', ext: 'opus', quality: 'Audio Only (OPUS)', height: -1, filesize: null },
    { format_id: 'bestaudio[acodec=flac]', ext: 'flac', quality: 'Audio Only (FLAC)', height: -1, filesize: null },
  ];
  const subs = [...new Set([...Object.keys(info.subtitles || {}), ...Object.keys(info.automatic_captions || {})])];
  return {
    title: info.title, thumbnail: info.thumbnail, duration: info.duration,
    uploader: info.uploader, view_count: info.view_count, like_count: info.like_count,
    formats: [...formats, ...audioFormats], subtitles: subs,
  };
}

app.post('/api/detect', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    // First check if it's a playlist using flat mode (fast, no format detail)
    const flatResult = execSync(`yt-dlp --js-runtimes deno --dump-json --flat-playlist ${JSON.stringify(url)}`, { timeout: 30000, encoding: 'utf8' });
    const lines = flatResult.trim().split('\n').filter(Boolean);
    const entries = lines.map(l => JSON.parse(l));
    if (entries.length > 1) {
      return res.json({
        type: 'playlist',
        title: entries[0]?.playlist_title || entries[0]?.playlist || 'Playlist',
        uploader: entries[0]?.playlist_uploader || entries[0]?.uploader || '',
        video_count: entries.length,
        videos: entries.map(e => ({
          id: e.id, title: e.title, url: e.url || e.webpage_url || `https://youtube.com/watch?v=${e.id}`,
          duration: e.duration, uploader: e.uploader, thumbnail: e.thumbnail, view_count: e.view_count,
        })),
      });
    }
    // Single video — fetch full info with formats
    const fullResult = execSync(`yt-dlp --js-runtimes deno --dump-json --no-playlist ${JSON.stringify(url)}`, { timeout: 30000, encoding: 'utf8' });
    const info = JSON.parse(fullResult);
    res.json({ type: 'video', ...parseVideoInfo(info) });
  } catch (e) {
    console.error('Detect error:', e.message);
    res.status(400).json({ error: 'Could not fetch content. Check the URL.' });
  }
});

app.post('/api/download', (req, res) => {
  const { url, format_id, title, hasAudio, filesize, subtitles: subs, start, end } = req.body;
  if (!url || !format_id) return res.status(400).json({ error: 'Missing params' });

  const id = crypto.randomUUID();
  const isAudio = format_id.startsWith('bestaudio');
  const ext = isAudio
    ? (format_id.includes('m4a') ? 'm4a' : format_id.includes('webm') ? 'opus' : format_id.includes('flac') ? 'flac' : 'mp3')
    : 'mp4';
  const safeTitle = (title || 'video').replace(/[^a-z0-9\s-]/gi, '_').slice(0, 100);
  const outputPath = path.join(TMP_DIR, `${id}.${ext}`);

  const args = ['--js-runtimes', 'deno', '--no-playlist', '--newline', '--progress'];
  if (subs && subs !== 'none') args.push('--write-subs', '--sub-langs', subs, '--embed-subs');
  if (start) args.push('--download-sections', `*${start}-${end || 'inf'}`);

  if (isAudio) {
    args.push('-x', '--audio-format', ext, '--audio-quality', '0', '-o', outputPath);
  } else {
    args.push('-f', hasAudio ? format_id : `${format_id}+bestaudio[ext=m4a]/best`, '--merge-output-format', 'mp4', '-o', outputPath);
  }
  args.push(url);

  const proc = spawn('yt-dlp', args);
  let lastBytes = 0;
  const expectedTotal = filesize || 0;
  const dl = {
    id, ext, status: 'queued', progress: 0, speed: '', eta: '', totalSize: '',
    filename: `${safeTitle}.${ext}`, outputPath, proc, startTime: Date.now(), res: null,
  };
  downloads.set(id, dl);
  dl.status = 'downloading';

  dl._pollTimer = setInterval(() => {
    try {
      let totalBytes = 0;
      const files = fs.readdirSync(TMP_DIR).filter(f => f.startsWith(id));
      for (const f of files) {
        try { totalBytes += fs.statSync(path.join(TMP_DIR, f)).size; } catch {}
      }
      if (totalBytes > 0) {
        if (lastBytes > 0 && totalBytes > lastBytes) {
          const speedBps = (totalBytes - lastBytes) / 1.5;
          dl.speed = speedBps > 1048576 ? `${(speedBps / 1048576).toFixed(1)}MiB/s` : `${(speedBps / 1024).toFixed(0)}KiB/s`;
        }
        lastBytes = totalBytes;
        dl.totalSize = totalBytes > 1048576 ? `${(totalBytes / 1048576).toFixed(1)}MiB` : `${(totalBytes / 1024).toFixed(0)}KiB`;
        dl.progress = expectedTotal > 0 ? Math.min((totalBytes / expectedTotal) * 100, 99) : 50;
      }
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        dl.progress = 100;
        dl.totalSize = `${(fs.statSync(outputPath).size / 1048576).toFixed(1)}MiB`;
      }
    } catch {}
    if (dl.res) dl.res.write(`data: ${JSON.stringify({ progress: Math.round(dl.progress), speed: dl.speed, eta: '', totalSize: dl.totalSize, status: dl.status })}\n\n`);
  }, 1500);

  proc.on('close', (code) => {
    if (dl._pollTimer) clearInterval(dl._pollTimer);
    console.log(`[dl ${id.slice(0,8)}] closed code ${code}, file: ${fs.existsSync(outputPath)}`);
    dl.status = code === 0 ? 'completed' : 'failed';
    dl.progress = code === 0 ? 100 : dl.progress;
    if (fs.existsSync(outputPath)) dl.totalSize = `${(fs.statSync(outputPath).size / 1048576).toFixed(1)}MiB`;
    if (dl.res) {
      dl.res.write(`data: ${JSON.stringify({ progress: 100, status: dl.status, downloadId: id, filename: dl.filename, totalSize: dl.totalSize })}\n\n`);
      dl.res.end();
    }
    setTimeout(() => { try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); downloads.delete(id); } catch {} }, 1800000);
  });
  proc.on('error', (err) => {
    if (dl._pollTimer) clearInterval(dl._pollTimer);
    console.error(`[dl ${id.slice(0,8)}] error: ${err.message}`);
    dl.status = 'failed';
    if (dl.res) { dl.res.write(`data: ${JSON.stringify({ status: 'failed' })}\n\n`); dl.res.end(); }
    downloads.delete(id);
  });

  res.json({ downloadId: id, filename: dl.filename });
});

app.get('/api/progress/:id', (req, res) => {
  const dl = downloads.get(req.params.id);
  if (!dl) return res.status(404).json({ error: 'Download not found' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  dl.res = res;
  res.write(`data: ${JSON.stringify({ progress: dl.progress, speed: dl.speed, eta: dl.eta, totalSize: dl.totalSize, status: dl.status })}\n\n`);
  req.on('close', () => { dl.res = null; });
});

app.get('/api/file/:id', (req, res) => {
  const dl = downloads.get(req.params.id);
  if (!dl || dl.status !== 'completed' || !fs.existsSync(dl.outputPath)) return res.status(404).json({ error: 'File not available' });
  const mime = dl.ext === 'mp3' ? 'audio/mpeg' : dl.ext === 'm4a' ? 'audio/mp4' : dl.ext === 'opus' ? 'audio/opus' : dl.ext === 'flac' ? 'audio/flac' : 'video/mp4';
  res.setHeader('Content-Disposition', `attachment; filename="${dl.filename}"`);
  res.setHeader('Content-Type', mime);
  const stat = fs.statSync(dl.outputPath);
  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(dl.outputPath).pipe(res);
});

app.delete('/api/download/:id', (req, res) => {
  const dl = downloads.get(req.params.id);
  if (!dl) return res.status(404).json({ error: 'Not found' });
  dl.proc.kill('SIGTERM');
  dl.status = 'cancelled';
  if (dl.res) { dl.res.write(`data: ${JSON.stringify({ status: 'cancelled' })}\n\n`); dl.res.end(); }
  if (fs.existsSync(dl.outputPath)) fs.unlinkSync(dl.outputPath);
  downloads.delete(req.params.id);
  res.json({ status: 'cancelled' });
});

app.get('/api/downloads', (req, res) => {
  const list = [];
  for (const [id, dl] of downloads) {
    if (dl.status === 'completed' || dl.status === 'downloading') {
      list.push({ id, filename: dl.filename, ext: dl.ext, status: dl.status, progress: dl.progress, speed: dl.speed, eta: dl.eta, totalSize: dl.totalSize });
    }
  }
  res.json(list);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
