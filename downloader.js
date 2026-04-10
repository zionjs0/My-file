/**
 * lib/downloader.js
 * Multi-source download engine — TIDAK pakai yt-dlp binary
 * Cocok untuk Vercel serverless
 *
 * Sources:
 * 1. Cobalt.tools API (YT, TikTok, Instagram, Twitter, dll)
 * 2. NexRay API (backup + extra platforms)
 * 3. Custom scrapers (MediaFire, Sfile, GitHub, dll)
 */

'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';
const HDR = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' };

// ── Format helpers ───────────────────────────────────────────────
function fmtDur(s) {
    if (!s) return null;
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${m}:${String(sec).padStart(2,'0')}`;
}
function fmtSize(b) {
    if (!b) return null;
    if (b < 1024) return b+' B';
    if (b < 1048576) return (b/1024).toFixed(1)+' KB';
    if (b < 1073741824) return (b/1048576).toFixed(1)+' MB';
    return (b/1073741824).toFixed(2)+' GB';
}

// ── URL resolver (follow redirects) ─────────────────────────────
async function resolveUrl(url) {
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const SHORT = ['youtu.be','vt.tiktok.com','vm.tiktok.com','fb.watch','t.co','pin.it','b23.tv'];
    try {
        const host = new URL(url).hostname.replace(/^www\./,'');
        const isShort = SHORT.some(d => host === d || host.endsWith('.'+d));
        if (isShort) {
            const r = await axios.get(url, { maxRedirects:10, timeout:8000, headers:HDR, validateStatus:()=>true });
            return r.request?.res?.responseUrl || r.config?.url || url;
        }
    } catch {}
    return url;
}

// ── Normalize YouTube URL ────────────────────────────────────────
function normYT(url) {
    try {
        const u = new URL(url);
        const h = u.hostname.replace(/^(www\.|m\.|music\.)/,'');
        if (h === 'youtu.be') return `https://www.youtube.com/watch?v=${u.pathname.slice(1).split('/')[0]}`;
        if (h === 'youtube.com') {
            const p = u.pathname.split('/').filter(Boolean);
            if (p[0]==='shorts' && p[1]) return `https://www.youtube.com/watch?v=${p[1]}`;
            if (p[0]==='live'   && p[1]) return `https://www.youtube.com/watch?v=${p[1]}`;
            if (p[0]==='embed'  && p[1]) return `https://www.youtube.com/watch?v=${p[1]}`;
            const v = u.searchParams.get('v');
            if (v) return `https://www.youtube.com/watch?v=${v}`;
        }
    } catch {}
    return url;
}

async function prepareUrl(raw) {
    let url = await resolveUrl(raw);
    const h = (() => { try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; }})();
    if (h.includes('youtube.com') || h === 'youtu.be') url = normYT(url);
    return url;
}

// ════════════════════════════════════════════════════════════════
// SOURCE 1: COBALT.TOOLS
// Fast, supports: YouTube, TikTok, Instagram, Twitter, Reddit,
// Pinterest, Vimeo, SoundCloud, Bilibili, Twitch, etc.
// ════════════════════════════════════════════════════════════════

const COBALT_INSTANCES = [
    'https://cobalt.tools/api/json',
    'https://api.cobalt.tools/api/json',
    'https://co.wuk.sh/api/json',
    'https://cobalt.gg/api/json',
];

async function cobaltDownload(url, opts = {}) {
    const body = {
        url,
        vCodec:       opts.vCodec    || 'h264',
        vQuality:     opts.quality   || '1080',
        aFormat:      opts.aFormat   || 'mp3',
        isAudioOnly:  opts.audioOnly || false,
        isNoTTWatermark: true,       // TikTok tanpa watermark
        isTTFullAudio: false,
        isAudioMuted: false,
        dubLang: false,
        disableMetadata: false,
        twitterGif: false,
        tiktokH265: false,
    };

    for (const base of COBALT_INSTANCES) {
        try {
            const { data } = await axios.post(base, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0',
                },
                timeout: 25000,
            });

            if (data.status === 'stream' || data.status === 'redirect' || data.status === 'tunnel') {
                return { url: data.url, type: 'video', source: 'cobalt' };
            }
            if (data.status === 'picker') {
                // Multiple media (e.g. Instagram carousel)
                const items = data.picker || [];
                return { url: items[0]?.url, type: 'video', picker: items, source: 'cobalt' };
            }
            if (data.status === 'error') {
                throw new Error(data.text || 'Cobalt error');
            }
        } catch(e) {
            if (e?.response?.status === 400) throw new Error(e?.response?.data?.text || 'URL tidak didukung cobalt');
            // Try next instance
        }
    }
    return null;
}

// ════════════════════════════════════════════════════════════════
// SOURCE 2: NEXRAY API (backup/extra platforms)
// ════════════════════════════════════════════════════════════════

const NEXRAY = 'https://api.nexray.web.id';

async function nexrayDL(endpoint, params) {
    try {
        const { data } = await axios.get(`${NEXRAY}${endpoint}`, {
            params, headers: HDR, timeout: 25000,
        });
        return data;
    } catch(e) {
        throw new Error(e?.response?.data?.message || e.message);
    }
}

// ════════════════════════════════════════════════════════════════
// SOURCE 3: PLATFORM-SPECIFIC SCRAPERS
// ════════════════════════════════════════════════════════════════

async function scrapeMediafire(url) {
    const { data } = await axios.get(url, { headers: HDR, timeout: 15000 });
    const $ = cheerio.load(data);
    const link = $('#downloadButton, a.button.green.dl-btn, a[id*=download]').first().attr('href');
    const name = $('.filename,.dl-info .filename,.file-name').first().text().trim()
              || $('title').text().replace(/Download|[-–|].*$/g,'').trim();
    const size = $('a#downloadButton').text().match(/\(([^)]+)\)/)?.[1] || null;
    if (!link) throw new Error('Link MediaFire tidak ditemukan. File mungkin sudah dihapus.');
    return makeFileResult('mediafire', name||'MediaFire File', link, size);
}

async function scrapeSfile(url) {
    const { data } = await axios.get(url, { headers: HDR, timeout: 15000 });
    const $ = cheerio.load(data);
    const link = $('a.btn-download,a.download-btn,a#download,a[href*="/dl/"],a[download]')
        .first().attr('href')
        || $('a[href*="download"]').filter((_,el)=>{const h=$(el).attr('href')||'';return h.startsWith('http');}).first().attr('href');
    const name = $('h1.file-name,.filename,span.filename').first().text().trim()
              || $('title').text().replace(/[-–|].*sfile.*/i,'').trim();
    const size = $('span.file-size,.filesize').first().text().trim() || null;
    if (!link) throw new Error('Link sfile.mobi tidak ditemukan');
    return makeFileResult('sfile', name||'Sfile File', link, size);
}

async function scrapeGithub(url) {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const [owner, repo] = parts;
    if (!owner || !repo) throw new Error('URL GitHub tidak valid');

    const GH = { Accept:'application/vnd.github.v3+json', 'User-Agent':'UniversalDL/3.0' };

    if (parts.includes('blob') || parts.includes('raw')) {
        const rawUrl = url.replace('github.com','raw.githubusercontent.com').replace('/blob/','/');
        const fn = parts[parts.length-1];
        return { platform:'github', title:`${owner}/${repo} — ${fn}`, thumbnail:`https://opengraph.githubassets.com/1/${owner}/${repo}`,
            url:rawUrl, mp4:null, mp3:null, audio:null, quality:null,
            formats:{video:[],audio:[],image:[]}, direct:[{type:'file',url:rawUrl,filename:fn}] };
    }

    let releaseData;
    try {
        const tagIdx = parts.indexOf('tag');
        const apiUrl = tagIdx !== -1
            ? `https://api.github.com/repos/${owner}/${repo}/releases/tags/${parts[tagIdx+1]}`
            : `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
        const { data } = await axios.get(apiUrl, { headers:GH, timeout:10000 });
        releaseData = data;
    } catch(e) {
        if (e?.response?.status === 404) {
            const { data } = await axios.get(`https://api.github.com/repos/${owner}/${repo}`, { headers:GH, timeout:10000 });
            const branch = data.default_branch || 'main';
            const direct = [
                { type:'file', url:`https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`, filename:`${repo}-${branch}.zip` },
                { type:'file', url:`https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.tar.gz`, filename:`${repo}-${branch}.tar.gz` },
            ];
            return { platform:'github', title:`${owner}/${repo}`, description:data.description, stars:data.stargazers_count,
                language:data.language, thumbnail:`https://opengraph.githubassets.com/1/${owner}/${repo}`,
                url:direct[0].url, mp4:null, mp3:null, audio:null, quality:null,
                formats:{video:[],audio:[],image:[]}, direct, note:'Repo tanpa release. Source code default branch.' };
        }
        throw e;
    }

    const assets = (releaseData.assets||[]).map(a=>({ type:'file', url:a.browser_download_url, filename:a.name, size:fmtSize(a.size) }));
    const tag = releaseData.tag_name || 'latest';
    assets.push(
        { type:'file', url:`https://github.com/${owner}/${repo}/archive/refs/tags/${tag}.zip`, filename:`${repo}-${tag}.zip` },
        { type:'file', url:`https://github.com/${owner}/${repo}/archive/refs/tags/${tag}.tar.gz`, filename:`${repo}-${tag}.tar.gz` },
    );
    return { platform:'github', title:`${owner}/${repo} — ${tag}`, description:(releaseData.body||'').slice(0,300),
        published_at:releaseData.published_at, thumbnail:`https://opengraph.githubassets.com/1/${owner}/${repo}`,
        url:assets[0]?.url, mp4:null, mp3:null, audio:null, quality:null,
        formats:{video:[],audio:[],image:[]}, direct:assets };
}

async function scrapeVidey(url) {
    const { data } = await axios.get(url, { headers: HDR, timeout: 15000 });
    const $ = cheerio.load(data);
    const src = $('video source,video').first().attr('src') || $('[data-src]').first().attr('data-src');
    const title = $('title').text().trim() || 'Videy Video';
    const thumb = $('meta[property="og:image"]').attr('content') || null;
    if (!src) throw new Error('Video Videy tidak ditemukan');
    const vUrl = src.startsWith('http') ? src : `https://videy.co${src}`;
    return { platform:'videy', title, thumbnail:thumb, url:vUrl, mp4:vUrl, mp3:null, audio:null, quality:'best',
        formats:{ video:[{type:'video',ext:'mp4',quality:'best',url:vUrl}], audio:[], image:[] }, direct:[] };
}

async function scrapeGoogleDrive(url) {
    const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (!m) throw new Error('Format URL Google Drive tidak valid');
    const id = m[1];
    const dlUrl = `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;
    let title = 'Google Drive File';
    try {
        const { data } = await axios.get(`https://drive.google.com/file/d/${id}/view`, { headers:HDR, timeout:10000 });
        const $ = cheerio.load(data);
        title = $('title').text().replace('- Google Drive','').trim() || title;
    } catch {}
    return makeFileResult('googledrive', title, dlUrl, null);
}

// ── Helper: build standard file result ──────────────────────────
function makeFileResult(platform, title, url, size) {
    return { platform, title, thumbnail:null, url, mp4:null, mp3:null, audio:null, quality:null,
        formats:{video:[],audio:[],image:[]}, direct:[{type:'file',url,filename:title,size}] };
}

// ── Helper: build standard video result ─────────────────────────
function makeVideoResult(platform, title, videoUrl, audioUrl, thumb, extra={}) {
    return {
        platform, title, thumbnail:thumb||null,
        url:videoUrl||null, mp4:videoUrl||null,
        mp3:audioUrl||null, audio:audioUrl||null,
        quality: extra.quality || 'best',
        duration: extra.duration || null,
        uploader: extra.uploader || null,
        formats:{
            video: videoUrl ? [{ type:'video', ext:'mp4', quality:extra.quality||'best', url:videoUrl }] : [],
            audio: audioUrl ? [{ type:'audio', ext:'mp3', quality:'best', url:audioUrl }] : [],
            image: extra.images || [],
        },
        direct: [],
        ...extra,
    };
}

// ════════════════════════════════════════════════════════════════
// PLATFORM DETECTOR
// ════════════════════════════════════════════════════════════════
const PLATFORMS = [
    { id:'youtube',     r:/(?:youtube\.com|youtu\.be|yt\.be|music\.youtube\.com)/i },
    { id:'tiktok',      r:/(?:tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com)/i },
    { id:'instagram',   r:/(?:instagram\.com|instagr\.am)/i },
    { id:'facebook',    r:/(?:facebook\.com|fb\.watch|fb\.com)/i },
    { id:'twitter',     r:/(?:twitter\.com|x\.com)/i },
    { id:'threads',     r:/threads\.net/i },
    { id:'snackvideo',  r:/snackvideo\.com/i },
    { id:'pinterest',   r:/(?:pinterest\.com|pin\.it)/i },
    { id:'likee',       r:/likee\.video/i },
    { id:'capcut',      r:/capcut\.com/i },
    { id:'reddit',      r:/(?:reddit\.com|redd\.it)/i },
    { id:'soundcloud',  r:/soundcloud\.com/i },
    { id:'spotify',     r:/spotify\.com/i },
    { id:'dailymotion', r:/dailymotion\.com/i },
    { id:'vimeo',       r:/vimeo\.com/i },
    { id:'twitch',      r:/twitch\.tv/i },
    { id:'bilibili',    r:/(?:bilibili\.com|b23\.tv)/i },
    { id:'douyin',      r:/douyin\.com/i },
    { id:'terabox',     r:/terabox\.com/i },
    { id:'googledrive', r:/drive\.google\.com/i },
    { id:'smule',       r:/smule\.com/i },
    { id:'videy',       r:/videy\.co/i },
    { id:'mediafire',   r:/mediafire\.com/i },
    { id:'sfile',       r:/sfile\.mobi/i },
    { id:'github',      r:/github\.com/i },
];

function detectPlatform(url) {
    for (const { id, r } of PLATFORMS) if (r.test(url)) return id;
    return 'unknown';
}

// ════════════════════════════════════════════════════════════════
// MAIN DOWNLOAD FUNCTION
// Try Cobalt → NexRay → Custom scrapers
// ════════════════════════════════════════════════════════════════

async function universalDownload(rawUrl, opts = {}) {
    // 1. Prepare URL
    const url = await prepareUrl(rawUrl);
    const platform = detectPlatform(url);

    // 2. Custom scrapers (no need for Cobalt/NexRay)
    if (platform === 'mediafire')   return scrapeMediafire(url);
    if (platform === 'sfile')       return scrapeSfile(url);
    if (platform === 'github')      return scrapeGithub(url);
    if (platform === 'videy')       return scrapeVidey(url);
    if (platform === 'googledrive') return scrapeGoogleDrive(url);

    // 3. Spotify — metadata only + search YT
    if (platform === 'spotify') {
        return spotifyViaCobalt(url, opts);
    }

    // 4. Try Cobalt first (best quality, supports most platforms)
    let cobaltResult = null;
    try {
        const quality = opts.resolusi || opts.quality || '1080';
        cobaltResult = await cobaltDownload(url, { quality, audioOnly: opts.audioOnly || false });
    } catch(e) {
        // Cobalt failed, continue to NexRay
    }

    if (cobaltResult?.url) {
        // Get metadata from NexRay/fallback
        const meta = await getMetadata(url, platform);
        return makeVideoResult(
            platform, meta.title || url, cobaltResult.url,
            opts.audioOnly ? cobaltResult.url : null,
            meta.thumbnail,
            { quality: opts.resolusi || 'best', uploader: meta.uploader, duration: meta.duration,
              ...(cobaltResult.picker ? { picker: cobaltResult.picker } : {}) }
        );
    }

    // 5. Fallback: NexRay API per platform
    return nexrayFallback(url, platform, opts);
}

// ── Get metadata from NexRay ─────────────────────────────────────
async function getMetadata(url, platform) {
    const endpoints = {
        youtube:   '/downloader/ytmp4',
        tiktok:    '/downloader/tiktok',
        instagram: '/downloader/instagram',
        facebook:  '/downloader/facebook',
        twitter:   '/downloader/twitter',
        pinterest: '/downloader/pinterest',
        soundcloud:'/downloader/soundcloud',
        capcut:    '/downloader/capcut',
        snackvideo:'/downloader/snackvideo',
    };
    try {
        const ep = endpoints[platform];
        if (ep) {
            const p = platform === 'youtube' ? { url, resolusi:'720' } : { url };
            const d = await nexrayDL(ep, p);
            const r = d?.result || d?.data || d;
            return { title: r?.title||r?.name, thumbnail: r?.thumbnail||r?.cover, uploader: r?.author||r?.channel, duration: r?.duration ? fmtDur(parseInt(r.duration)) : null };
        }
    } catch {}
    return {};
}

// ── NexRay fallback per platform ─────────────────────────────────
async function nexrayFallback(url, platform, opts = {}) {
    const quality = opts.resolusi || '1080';
    const audioOnly = opts.audioOnly || false;

    const handlers = {
        async youtube() {
            if (audioOnly) {
                const d = await nexrayDL('/downloader/ytmp3', { url });
                const r = d?.result || d?.data || d;
                const au = r?.url || r?.download_url || r?.audio;
                return makeVideoResult('youtube', r?.title||'YouTube Audio', null, au, r?.thumbnail, { quality:'audio', uploader:r?.channel });
            }
            const d = await nexrayDL('/downloader/ytmp4', { url, resolusi: quality });
            const r = d?.result || d?.data || d;
            const vUrl = r?.url || r?.download_url || r?.video;
            const aUrl = r?.audio || r?.mp3;
            return makeVideoResult('youtube', r?.title||'YouTube Video', vUrl, aUrl, r?.thumbnail, { quality, uploader:r?.channel });
        },
        async tiktok() {
            const d = await nexrayDL('/downloader/tiktok', { url });
            const r = d?.result || d?.data || d;
            const vUrl = r?.url || r?.nowm || r?.play || r?.video;
            const aUrl = r?.music || r?.audio;
            return makeVideoResult('tiktok', r?.title||r?.desc||'TikTok Video', vUrl, aUrl, r?.thumbnail||r?.cover, { uploader:r?.author });
        },
        async instagram() {
            const d = await nexrayDL('/downloader/instagram', { url });
            const r = d?.result || d?.data || d;
            const videos = Array.isArray(r) ? r : [r];
            const vUrl = videos[0]?.url || videos[0]?.video_url;
            const imgs = videos.filter(x=>x?.type==='image').map(x=>({ type:'image', url:x.url||x.image_url }));
            return makeVideoResult('instagram', r?.title||'Instagram Media', vUrl, null, r?.thumbnail||r?.cover, { images:imgs });
        },
        async facebook() {
            const d = await nexrayDL('/downloader/facebook', { url });
            const r = d?.result || d?.data || d;
            const hd = r?.hd || r?.url_hd;
            const sd = r?.sd || r?.url_sd || r?.url;
            return makeVideoResult('facebook', r?.title||'Facebook Video', hd||sd, null, r?.thumbnail, { quality: hd?'HD':'SD' });
        },
        async twitter() {
            const d = await nexrayDL('/downloader/twitter', { url });
            const r = d?.result || d?.data || d;
            const videos = r?.videos || r?.media || [];
            const best = Array.isArray(videos) ? videos.sort((a,b)=>(parseInt(b.quality||b.bitrate)||0)-(parseInt(a.quality||a.bitrate)||0))[0] : null;
            const vUrl = best?.url || best?.link || r?.url;
            const aUrl = r?.audio || r?.mp3;
            return makeVideoResult('twitter', r?.title||r?.text?.slice(0,80)||'Twitter Video', vUrl, aUrl, r?.thumbnail);
        },
        async pinterest() {
            const d = await nexrayDL('/downloader/pinterest', { url });
            const r = d?.result || d?.data || d;
            const vUrl = r?.url || r?.video_url;
            const imgUrl = r?.image_url || r?.image;
            if (vUrl) return makeVideoResult('pinterest', r?.title||'Pinterest Video', vUrl, null, r?.thumbnail);
            return makeFileResult('pinterest', 'Pinterest Image', imgUrl, null);
        },
        async soundcloud() {
            const d = await nexrayDL('/downloader/soundcloud', { url });
            const r = d?.result || d?.data || d;
            const aUrl = r?.url || r?.audio_url || r?.download_url;
            return makeVideoResult('soundcloud', r?.title||'SoundCloud Audio', null, aUrl, r?.thumbnail||r?.artwork_url, { uploader:r?.author||r?.user });
        },
        async spotify() { return spotifyViaCobalt(url, opts); },
        async snackvideo() {
            const d = await nexrayDL('/downloader/snackvideo', { url });
            const r = d?.result || d?.data || d;
            return makeVideoResult('snackvideo', r?.title||'SnackVideo', r?.url||r?.video, null, r?.thumbnail||r?.cover);
        },
        async capcut() {
            const d = await nexrayDL('/downloader/v2/capcut', { url });
            const r = d?.result || d?.data || d;
            return makeVideoResult('capcut', r?.title||'CapCut Video', r?.url||r?.video, r?.audio, r?.thumbnail);
        },
        async bilibili() {
            const d = await nexrayDL('/downloader/bilibili', { url });
            const r = d?.result || d?.data || d;
            return makeVideoResult('bilibili', r?.title||'Bilibili Video', r?.url||r?.video, r?.audio, r?.thumbnail||r?.cover);
        },
        async douyin() {
            const d = await nexrayDL('/downloader/v1/douyin', { url });
            const r = d?.result || d?.data || d;
            return makeVideoResult('douyin', r?.title||r?.desc||'Douyin Video', r?.url||r?.video, r?.audio, r?.thumbnail||r?.cover);
        },
        async terabox() {
            const d = await nexrayDL('/downloader/terabox', { url });
            const r = d?.result || d?.data || d;
            const dlUrl = r?.url || r?.download_url || r?.direct_link;
            return makeVideoResult('terabox', r?.title||r?.name||'Terabox', dlUrl, null, r?.thumbnail);
        },
    };

    const handler = handlers[platform];
    if (handler) return handler();

    // Generic fallback via AIO
    const d = await nexrayDL('/downloader/aio', { url });
    const r = d?.result || d?.data || d;
    const vUrl = r?.url || r?.video || r?.download_url;
    const aUrl = r?.audio || r?.mp3;
    return makeVideoResult(platform||'unknown', r?.title||'Media', vUrl, aUrl, r?.thumbnail);
}

// ── Spotify via search + cobalt ──────────────────────────────────
async function spotifyViaCobalt(url, opts) {
    const { data } = await axios.get(url, { headers:HDR, timeout:15000 });
    const $ = cheerio.load(data);
    const title   = $('meta[property="og:title"]').attr('content') || $('title').text();
    const desc    = $('meta[property="og:description"]').attr('content') || '';
    const thumb   = $('meta[property="og:image"]').attr('content') || null;
    const artist  = desc.split('·')[0]?.trim() || '';
    const song    = title.replace(/- song|by .+$/i,'').trim();

    // Search on YouTube to get audio
    const searchResults = await ytSearch(`${song} ${artist}`);
    let audioUrl = null;
    if (searchResults.length) {
        const ytUrl = searchResults[0].url;
        try {
            const cobalt = await cobaltDownload(ytUrl, { audioOnly: true });
            audioUrl = cobalt?.url;
        } catch {}
    }

    return makeVideoResult('spotify', title, null, audioUrl, thumb, {
        description: desc, artist, search_results: searchResults.slice(0,3),
    });
}

// ── YouTube Search ───────────────────────────────────────────────
async function ytSearch(query) {
    const { data } = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%3D%3D`, {
        headers: { ...HDR, 'Accept-Language':'en-US,en;q=0.9' }, timeout:10000,
    });
    const m = data.match(/var ytInitialData = (.+?);<\/script>/s);
    if (!m) return [];
    const yt = JSON.parse(m[1]);
    const items = yt?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
    const out = [];
    for (const item of items) {
        const v = item?.videoRenderer;
        if (!v?.videoId) continue;
        out.push({ videoId:v.videoId, title:v.title?.runs?.[0]?.text||'', channel:v.ownerText?.runs?.[0]?.text||'', duration:v.lengthText?.simpleText||'', thumbnail:`https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`, url:`https://www.youtube.com/watch?v=${v.videoId}` });
        if (out.length >= 5) break;
    }
    return out;
}

// ── YouTube HD download (specific quality) ───────────────────────
async function ytDownloadHD(url, resolusi = '1080') {
    url = normYT(await resolveUrl(url));
    // Try Cobalt with specific quality
    try {
        const r = await cobaltDownload(url, { quality: resolusi });
        if (r?.url) {
            const meta = await getMetadata(url, 'youtube').catch(()=>({}));
            // Also get audio
            let audioUrl = null;
            try { const ar = await cobaltDownload(url, { audioOnly: true }); audioUrl = ar?.url; } catch {}
            return makeVideoResult('youtube', meta.title||'YouTube Video', r.url, audioUrl, meta.thumbnail, { quality:`${resolusi}p`, uploader:meta.uploader, duration:meta.duration });
        }
    } catch {}

    // Fallback NexRay
    const d = await nexrayDL('/downloader/ytmp4', { url, resolusi });
    const r = d?.result || d?.data || d;
    return makeVideoResult('youtube', r?.title||'YouTube Video', r?.url||r?.download_url, r?.audio||r?.mp3, r?.thumbnail, { quality:resolusi+'p' });
}

// ── YouTube MP3 ──────────────────────────────────────────────────
async function ytDownloadMP3(url) {
    url = normYT(await resolveUrl(url));
    try {
        const r = await cobaltDownload(url, { audioOnly: true });
        if (r?.url) {
            const meta = await getMetadata(url, 'youtube').catch(()=>({}));
            return makeVideoResult('youtube', meta.title||'YouTube Audio', null, r.url, meta.thumbnail, { uploader:meta.uploader, duration:meta.duration });
        }
    } catch {}
    const d = await nexrayDL('/downloader/ytmp3', { url });
    const r = d?.result || d?.data || d;
    return makeVideoResult('youtube', r?.title||'YouTube Audio', null, r?.url||r?.download_url||r?.audio, r?.thumbnail);
}

// ── YouTube Search + Download ────────────────────────────────────
async function ytPlay(query, mode = 'audio') {
    const videos = await ytSearch(query);
    if (!videos.length) throw new Error('Tidak ada hasil untuk: ' + query);
    const first = videos[0];
    const result = mode === 'audio' ? await ytDownloadMP3(first.url) : await ytDownloadHD(first.url, '720');
    return { ...result, search_results: videos };
}

module.exports = {
    universalDownload, ytDownloadHD, ytDownloadMP3, ytPlay,
    scrapeMediafire, scrapeSfile, scrapeGithub, scrapeVidey, scrapeGoogleDrive,
    detectPlatform, resolveUrl, normYT, prepareUrl,
    fmtDur, fmtSize,
};
