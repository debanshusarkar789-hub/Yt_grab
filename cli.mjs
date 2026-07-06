#!/usr/bin/env node
import { spawnSync, spawn } from 'child_process';
import { createInterface } from 'readline';
import { existsSync, readdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const R = '\x1b[0m', B = '\x1b[1m', D = '\x1b[2m';
const g = '\x1b[38;2;0;200;150m', r = '\x1b[38;2;255;80;80m', y = '\x1b[38;2;255;200;50m';
const b = '\x1b[38;2;80;160;255m', p = '\x1b[38;2;180;100;255m', c = '\x1b[38;2;0;200;255m';
const o = '\x1b[38;2;255;150;50m', gr = '\x1b[38;2;100;100;120m', w = '\x1b[38;2;220;220;230m';

function cl() { process.stdout.write('\x1b[2J\x1b[H'); }
function hd() { process.stdout.write('\x1b[?25l'); }
function sh() { process.stdout.write('\x1b[?25h'); }
function up(n) { process.stdout.write(`\x1b[${n}A`); }
function cll() { process.stdout.write('\x1b[2K\r'); }

function br(pct, w) {
  const f = Math.round((pct / 100) * w), e = w - f;
  return g + '\u2588'.repeat(f) + gr + '\u2591'.repeat(e) + R;
}

function sz(n) {
  if (!n || n === 0) return '?';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' GB';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + ' KB';
  return n + ' B';
}

function du(s) {
  if (!s) return '?:??';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sc = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
  return `${m}:${String(sc).padStart(2, '0')}`;
}

function cn(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function rn(args) {
  const res = spawnSync('yt-dlp', args, { encoding: 'utf8', timeout: 30000 });
  if (res.error) { console.error(`\n${r}${B}\u2717${R} ${r}yt-dlp: ${res.error.message}${R}`); process.exit(1); }
  if (res.status !== 0) { console.error(`\n${r}${B}\u2717${R} ${r}Failed (code ${res.status})${R}`); if (res.stderr) process.stderr.write(res.stderr.split('\n').slice(0, 2).join('\n') + '\n'); process.exit(1); }
  return res.stdout;
}

async function main() {
  cl();
  const std = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];
  const ns = h => std.reduce((a, b) => Math.abs(b - h) < Math.abs(a - h) ? b : a);
  const W = Math.min(process.stdout.columns - 2 || 58, 58);

  // ── Big Banner ──
  const bw = W;
  const pad = (str, total = bw) => str + ' '.repeat(Math.max(0, total - str.replace(/\x1b\[[0-9;]*m/g, '').length));
  const cntr = str => {
    const len = str.replace(/\x1b\[[0-9;]*m/g, '').length;
    return ' '.repeat(Math.max(1, Math.floor((bw - len) / 2))) + str + ' '.repeat(Math.max(1, bw - len - Math.floor((bw - len) / 2)));
  };
  console.log(` ${g}${'\u2550'.repeat(bw)}${R}`);
  console.log(` ${g}${'\u2550'.repeat(bw)}${R}`);
  console.log(` ${g}${'\u2550'.repeat(bw)}${R}`);
  console.log(` ${g}${pad(cntr(`${B}${w}YT${R}${B}${r}-${R}${B}${o}GRAB${R} ${D}${gr}CLI v2.0${R}`))}${R}`);
  console.log(` ${g}${pad(cntr(`${D}${w}\u25b6 Terminal YouTube Downloader${R}`))}${R}`);
  console.log(` ${g}${'\u2550'.repeat(bw)}${R}`);

  // ── URL input ──
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = q => new Promise(res => rl.question(q, a => res(a)));

  let url = process.argv[2];
  if (!url) {
    console.log(` ${D}${gr}Paste a YouTube URL (or Ctrl+C to quit)${R}`);
    url = await ask(` ${B}${c}\u276f${R} `);
    if (!url) { rl.close(); console.log(`\n ${gr}ok bye${R}\n`); process.exit(0); }
    cll();
    console.log(` ${B}${c}\u276f${R} ${gr}${url}${R}`);
  }

  // ── Fetch ──
  const spinFr = ['\u280b', '\u2819', '\u2839', '\u2838', '\u283c', '\u2834', '\u2826', '\u2827', '\u280f', '\u281f'];
  let si = 0;
  const int = setInterval(() => { cll(); process.stdout.write(` ${c}${spinFr[si++ % 10]}${R} ${D}${gr}fetching...${R}`); }, 150);
  try {
    var raw = rn(['--js-runtimes', 'deno', '--dump-json', '--no-playlist', url]);
    var info = JSON.parse(raw);
  } catch (e) {
    clearInterval(int); cll(); rl.close();
    console.log(`\n ${r}${B}\u2717${R} ${r}Could not fetch URL${R}`);
    console.log(` ${gr}${e.message.split('\n')[0]}${R}\n`);
    process.exit(1);
  }
  clearInterval(int); cll();

  // ── Video card ──
  console.log(` ${gr}${'\u2500'.repeat(bw - 2)}${R}`);
  if (info.thumbnail) {
    const th = info.thumbnail.replace(/^https?:\/\//, '').slice(0, bw - 6);
    console.log(` ${gr}${' '.repeat(2)}${R}${D}${gr}${th}${R}${' '.repeat(bw - 4 - th.length)}${gr}${' '.repeat(2)}${R}`);
  }
  const ttl = info.title.slice(0, bw - 6);
  console.log(` ${gr}${' '.repeat(2)}${R}${B}${w}${ttl}${R}${' '.repeat(bw - 4 - ttl.length)}${gr}${' '.repeat(2)}${R}`);
  const meta = [info.uploader, info.view_count > 0 ? `${cn(info.view_count)} views` : '', info.duration ? du(info.duration) : ''].filter(Boolean).join(' \u00b7 ');
  console.log(` ${gr}${' '.repeat(2)}${R}${D}${gr}${meta.slice(0, bw - 6)}${R}${' '.repeat(Math.max(0, bw - 6 - meta.length))}${' '.repeat(2)}${gr}${R}`);
  console.log(` ${gr}${'\u2500'.repeat(bw - 2)}${R}\n`);

  // ── Parse formats ──
  const vids = (info.formats || [])
    .filter(f => f.vcodec !== 'none' && f.ext && f.height && f.height > 0)
    .map(f => ({ id: f.format_id, ext: f.ext, vcodec: (f.vcodec || '').split('.')[0].split('/')[0], quality: `${ns(f.height)}p${f.fps > 30 ? `${f.fps}fps` : ''}`, height: f.height, fps: f.fps || 30, size: f.filesize || f.filesize_approx || null, audio: f.acodec !== 'none' }))
    .sort((a, b) => b.height - a.height || (b.audio ? 1 : -1));
  const deduped = [];
  for (const f of vids) {
    const e = deduped.find(x => x.quality === f.quality && x.audio === f.audio);
    if (!e) deduped.push(f);
    else if (f.size && (!e.size || f.size > e.size)) Object.assign(e, f);
  }

  const tiers = [
    { label: '4K', min: 2000, clr: o }, { label: '2K', min: 1400, clr: y },
    { label: '1080p', min: 1000, clr: g }, { label: '720p', min: 600, clr: c },
    { label: '480p', min: 400, clr: b }, { label: '360p', min: 200, clr: w },
    { label: '240p', min: 0, clr: gr },
  ];
  const grouped = {};
  for (const f of deduped) {
    const t = tiers.find(t => f.height >= t.min) || tiers[tiers.length - 1];
    if (!grouped[t.label]) grouped[t.label] = { tier: t, formats: [] };
    grouped[t.label].formats.push(f);
  }

  const audFs = [
    { id: 'bestaudio/best', ext: 'mp3', quality: 'Audio Only', size: null, audio: true, label: 'MP3' },
    { id: 'bestaudio[ext=m4a]', ext: 'm4a', quality: 'Audio Only', size: null, audio: true, label: 'M4A' },
    { id: 'bestaudio[ext=webm]', ext: 'opus', quality: 'Audio Only', size: null, audio: true, label: 'OPUS' },
    { id: 'bestaudio[acodec=flac]', ext: 'flac', quality: 'Audio Only', size: null, audio: true, label: 'FLAC' },
  ];

  const items = [];
  const tOrd = ['4K', '2K', '1080p', '720p', '480p', '360p', '240p'];
  for (const lbl of tOrd) {
    const g = grouped[lbl];
    if (!g) continue;
    if (items.length > 0) items.push({ label: ` ${D}${gr}${'\u2500'.repeat(Math.min(bw - 4, 40))}${R}`, value: null });
    for (const f of g.formats) {
      const cc = f.vcodec.includes('av01') ? 'AV1' : f.vcodec.includes('vp9') ? 'VP9' : f.vcodec.includes('hevc') ? 'H265' : 'H264';
      const qual = f.quality.padEnd(11);
      const ext = f.ext.padEnd(4);
      const sz = f.size ? sz(f.size) : '';
      const aMark = f.audio ? ` ${g}●${R}` : ` ${y}\u2295${R}`;
      const hfr = f.fps > 60 ? ` ${y}${B}HFR${R}` : '';
      items.push({ label: ` ${g.tier.clr}\u25c6${R} ${B}${w}${qual}${R} ${gr}${ext}${R} ${D}${gr}${cc}${R}${aMark}${hfr} ${gr}${sz}${R}`, value: f });
    }
  }
  if (items.length > 0) items.push({ label: ` ${D}${gr}${'\u2500'.repeat(Math.min(bw - 4, 40))}${R}`, value: null });
  for (const f of audFs) {
    items.push({ label: ` ${p}\u266a${R} ${B}${w}${f.label.padEnd(11)}${R} ${D}${gr}audio only${R}`, value: f });
  }

  // ── Subtitle prompt ──
  let subs = 'none';
  const sa = [...new Set([...Object.keys(info.subtitles || {}), ...Object.keys(info.automatic_captions || {})])];
  if (sa.length > 0) {
    const ans = await ask(` ${D}${gr}subtitles?${R} ${gr}(lang code / Enter to skip)${R} ${B}${c}\u276f${R} `);
    if (ans && ans !== 'none') subs = ans;
    cll();
  }
  rl.close();

  // ── Format picker ──
  const sel = await new Promise(resolve => {
    let idx = 0;
    const prv = i => { let n = i - 1; while (n >= 0 && !items[n].value) n--; return n; };
    const nxt = i => { let n = i + 1; while (n < items.length && !items[n].value) n++; return n < items.length ? n : i; };
    const drw = () => {
      console.log(` ${D}${gr}Select format${R} ${gr}(\u2191 \u2193 enter)${R}\n`);
      for (let i = 0; i < items.length; i++) {
        const s = i === idx;
        const prefix = s ? `${c}${B}\u276f${R}` : ' ';
        const lbl = items[i].label;
        if (s) console.log(` ${prefix} ${B}${w}${lbl.trim()}${R}`);
        else console.log(`  ${lbl}`);
      }
    };
    hd();
    drw();
    const nLines = items.length + 1;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cb = buf => {
      const k = buf.toString();
      if (k === '\x1b[A') { const n = prv(idx); if (n >= 0) { idx = n; up(nLines); drw(); } }
      else if (k === '\x1b[B') { const n = nxt(idx); if (n > idx) { idx = n; up(nLines); drw(); } }
      else if (k === '\r' && items[idx].value) {
        process.stdin.removeListener('data', cb);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        sh();
        up(nLines);
        for (let i = 0; i < nLines; i++) cll();
        resolve(items[idx]);
      }
      else if (k === '\x03') { process.exit(0); }
    };
    process.stdin.on('data', cb);
    if (items[0] && !items[0].value) { idx = nxt(0); up(nLines); drw(); }
  });
  const fmt = sel.value;
  const isAudio = fmt.quality === 'Audio Only';

  // ── Download ──
  const ext = isAudio ? fmt.ext : 'mp4';
  const sf = info.title.replace(/[^a-z0-9\s-]/gi, '_').slice(0, 100);
  const td = join(tmpdir(), 'yt-grab-cli');
  const op = join(td, `${sf}.${ext}`);
  if (!existsSync(td)) spawnSync('mkdir', ['-p', td], { shell: true });

  const da = ['--js-runtimes', 'deno', '--no-playlist', '--newline', '--progress'];
  if (subs !== 'none') da.push('--write-subs', '--sub-langs', subs, '--embed-subs');
  if (isAudio) {
    da.push('-x', '--audio-format', ext, '--audio-quality', '0', '-o', op);
  } else {
    da.push('-f', fmt.audio ? fmt.id : `${fmt.id}+bestaudio[ext=m4a]/best`, '--merge-output-format', 'mp4', '-o', op);
  }
  da.push(url);

  const tag = isAudio ? `${p}\u266a ${fmt.label}${R}` : `${w}${fmt.quality} ${gr}${fmt.ext}${R}`;
  console.log(` ${g}\u2714${R} ${tag}${fmt.size ? ` ${gr}~${sz(fmt.size)}${R}` : ''}\n`);

  const proc = spawn('yt-dlp', da, { stdio: ['ignore', 'ignore', 'pipe'] });
  let last = 0, spn = 0;
  const exp = fmt.size || 0;

  const tick = setInterval(() => {
    let tot = 0;
    try { if (existsSync(td)) { for (const f of readdirSync(td).filter(f => f.includes(sf))) tot += statSync(join(td, f)).size; } } catch {}
    if (tot > 0 && last > 0 && tot > last) {
      const spd = (tot - last) / 0.5;
      const spdS = spd > 1048576 ? (spd / 1048576).toFixed(1) + ' MB/s' : (spd / 1024).toFixed(0) + ' KB/s';
      const pct = exp > 0 ? Math.min((tot / exp) * 100, 99) : 50;
      const b = br(pct, 20);
      const ss = tot > 1048576 ? (tot / 1048576).toFixed(1) + ' MB' : (tot / 1024).toFixed(0) + ' KB';
      cll();
      process.stdout.write(` ${c}${spinFr[spn++ % 10]}${R} ${b} ${B}${w}${pct.toFixed(0)}%${R} ${gr}${ss} at ${spdS}${R}`);
    } else if (tot > 0) {
      last = tot;
      cll();
      process.stdout.write(` ${c}${spinFr[spn++ % 10]}${R} ${gr}starting...${R}`);
    } else {
      cll();
      process.stdout.write(` ${c}${spinFr[spn++ % 10]}${R} ${gr}preparing...${R}`);
    }
    last = tot;
  }, 500);

  sh();
  proc.stderr.on('data', () => {});
  proc.on('close', (code) => {
    clearInterval(tick);
    cll();
    if (code === 0 && existsSync(op)) {
      const s = statSync(op).size;
      const ss = s > 1048576 ? (s / 1048576).toFixed(1) + ' MB' : (s / 1024).toFixed(0) + ' KB';
      console.log(`\n ${g}${B}\u2714${R} ${w}Download complete${R}  ${g}${ss}${R}`);
      console.log(` ${D}${gr}${op}${R}\n`);
    } else {
      console.log(`\n ${r}${B}\u2717${R} ${r}Download failed (code ${code})${R}`);
      console.log(` ${gr}Try another format or check the URL${R}\n`);
    }
    sh();
    process.exit(0);
  });
  proc.on('error', (e) => {
    clearInterval(tick); cll();
    console.log(`\n ${r}${B}\u2717${R} ${r}${e.message}${R}\n`);
    sh(); process.exit(1);
  });
}

main();
