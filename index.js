/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║  UNIVERSAL DOWNLOADER + AI SUITE  v3.0 — VERCEL READY  ║
 * ║  60+ Endpoint  •  HD Video  •  AI NanaBanana            ║
 * ║  No yt-dlp binary  •  Serverless compatible             ║
 * ╚══════════════════════════════════════════════════════════╝
 */
'use strict';

const express     = require('express');
const cors        = require('cors');
const NodeCache   = require('node-cache');
const dl          = require('../lib/downloader');
const ai          = require('../lib/ai');

const app    = express();
const cache  = new NodeCache({ stdTTL:300, checkperiod:120, useClones:false });
const CREATOR = 'Universal Downloader v3.0';

app.use(cors());
app.use(express.json({ limit:'5mb' }));
app.use(express.urlencoded({ extended:true }));

// ── Simple in-memory rate limit (per IP, 200/min) ────────────────
const rl = new Map();
app.use('/api', (req, res, next) => {
    const key = req.headers['x-forwarded-for']?.split(',')[0] || req.ip || 'x';
    const now = Date.now();
    const w = rl.get(key) || { count:0, start:now };
    if (now - w.start > 60000) { w.count=0; w.start=now; }
    w.count++;
    rl.set(key, w);
    if (w.count > 200) return res.status(429).json({ creator:CREATOR, status:false, message:'Rate limit. Coba lagi 1 menit.' });
    next();
});

// ── Helpers ──────────────────────────────────────────────────────
const ok   = (res, r)    => res.json({ creator:CREATOR, status:true, result:r });
const fail = (res, m, c=500) => res.status(c).json({ creator:CREATOR, status:false, message:m });
const miss = (res, p)    => fail(res, `Parameter ?${p} wajib diisi!`, 400);

function friendly(e) {
    const m = e?.message || '';
    if (/timeout|ETIMEDOUT|ECONNRESET/i.test(m)) return 'Timeout. Coba lagi.';
    if (/private/i.test(m)) return 'Konten privat.';
    if (/not available|unavailable|dihapus/i.test(m)) return 'Konten tidak tersedia.';
    if (/age/i.test(m)) return 'Konten dibatasi usia.';
    if (/copyright/i.test(m)) return 'Diblokir hak cipta.';
    if (/login|sign in/i.test(m)) return 'Perlu login.';
    return m || 'Gagal mengambil konten. Pastikan URL valid.';
}

async function cached(key, fn, ttl=300) {
    const h = cache.get(key);
    if (h) return { ...h, _cached:true };
    const r = await fn();
    cache.set(key, r, ttl);
    return r;
}

// ══════════════════════════════════════════════════════════
// ROOT & HEALTH
// ══════════════════════════════════════════════════════════
app.get('/', (req, res) => res.json({
    creator: CREATOR, version:'3.0.0', status:'online',
    uptime: process.uptime().toFixed(0)+'s',
    endpoints: {
        downloader: {
            universal:    'GET /api/download?url=',
            youtube_hd:   'GET /api/ytmp4?url=&resolusi=2160|1440|1080|720|480|360',
            youtube_mp3:  'GET /api/ytmp3?url=',
            yt_search_dl: 'GET /api/ytplay?q=',
            yt_search_vid:'GET /api/ytplayvid?q=&resolusi=720',
            tiktok:       'GET /api/tiktok?url=',
            instagram:    'GET /api/instagram?url=',
            facebook:     'GET /api/facebook?url=',
            twitter:      'GET /api/twitter?url=',
            spotify:      'GET /api/spotify?url=',
            spotify_play: 'GET /api/spotifyplay?q=',
            bilibili:     'GET /api/bilibili?url=',
            douyin:       'GET /api/douyin?url=',
            snackvideo:   'GET /api/snackvideo?url=',
            capcut:       'GET /api/capcut?url=',
            pinterest:    'GET /api/pinterest?url=',
            soundcloud:   'GET /api/soundcloud?url=',
            terabox:      'GET /api/terabox?url=',
            googledrive:  'GET /api/googledrive?url=',
            mediafire:    'GET /api/mediafire?url=',
            sfile:        'GET /api/sfile?url=',
            videy:        'GET /api/videy?url=',
            smule:        'GET /api/smule?url=',
            github:       'GET /api/github?url=',
            threads:      'GET /api/threads?url=',
            reddit:       'GET /api/reddit?url=',
            vimeo:        'GET /api/vimeo?url=',
            twitch:       'GET /api/twitch?url=',
        },
        ai_chat: {
            chatgpt:    'GET /api/ai/chatgpt?text=',
            claude:     'GET /api/ai/claude?text=',
            gemini:     'GET /api/ai/gemini?text=',
            deepseek:   'GET /api/ai/deepseek?text=',
            copilot:    'GET /api/ai/copilot?text=',
            perplexity: 'GET /api/ai/perplexity?text=',
            deepsearch: 'GET /api/ai/deepsearch?text=',
            kimi:       'GET /api/ai/kimi?text=',
            llamacoder: 'GET /api/ai/llamacoder?text=&model=deepseek-v3.1',
            glm:        'GET /api/ai/glm?text=&model=glm-4.6',
            dolphin:    'GET /api/ai/dolphin?text=&template=logical',
            mathgpt:    'GET /api/ai/mathgpt?text=',
            simisimi:   'GET /api/ai/simisimi?text=',
        },
        ai_image: {
            nanobanana:  'GET|POST /api/ai/nanobanana?image_url=&prompt= (MODIFY IMAGE)',
            ideogram:    'GET /api/ai/image/ideogram?prompt=',
            magicstudio: 'GET /api/ai/image/magicstudio?prompt=',
            deepimg:     'GET /api/ai/image/deepimg?prompt=',
            flux:        'GET /api/ai/image/flux?prompt=',
            vider:       'GET /api/ai/image/vider?prompt=',
            text2image:  'GET /api/ai/image/text2image?prompt=',
            sologo:      'GET /api/ai/image/sologo?prompt=',
            writecream:  'GET /api/ai/image/writecream?prompt=&ratio=1:1|16:9|9:16',
        },
        ai_video: {
            veo2: 'GET /api/ai/veo2?prompt=',
            veo3: 'GET /api/ai/veo3?prompt=&image_url=',
        },
        ai_audio: {
            suno: 'GET /api/ai/suno?prompt=',
            tts:  'GET /api/ai/tts?text=',
        },
        ai_tools: {
            grammar:  'GET /api/ai/grammar?text=',
            bypass:   'GET /api/ai/bypass?text=',
            story:    'GET /api/ai/story?prompt=&mode=&length=',
            dream:    'GET /api/ai/dream?text=',
            webpilot: 'GET /api/ai/webpilot?text=',
            screnapp: 'GET /api/ai/screnapp?image_url=&text=',
        },
        utils: {
            resolve: 'GET /api/resolve?url=',
            health:  'GET /health',
        },
    },
}));

app.get('/health', (req, res) => res.json({
    status:'ok', version:'3.0.0',
    uptime: process.uptime().toFixed(0)+'s',
    cache_keys: cache.keys().length,
    memory_mb: (process.memoryUsage().heapUsed/1048576).toFixed(1),
}));

// ══════════════════════════════════════════════════════════
// DOWNLOADER ENDPOINTS
// ══════════════════════════════════════════════════════════

app.get('/api/download', async (req, res) => {
    const { url, resolusi } = req.query;
    if (!url) return miss(res, 'url');
    try {
        const r = await cached(`dl:${url}:${resolusi||'best'}`, () => dl.universalDownload(url, { resolusi }));
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/ytmp4', async (req, res) => {
    const { url, resolusi = '1080' } = req.query;
    if (!url) return miss(res, 'url');
    try {
        const r = await cached(`ytmp4:${url}:${resolusi}`, () => dl.ytDownloadHD(url, resolusi));
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/ytmp3', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    try {
        const r = await cached(`ytmp3:${url}`, () => dl.ytDownloadMP3(url));
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/ytplay', async (req, res) => {
    const { q } = req.query;
    if (!q) return miss(res, 'q');
    try {
        const r = await cached(`ytplay:${q}`, () => dl.ytPlay(q, 'audio'));
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/ytplayvid', async (req, res) => {
    const { q, resolusi='720' } = req.query;
    if (!q) return miss(res, 'q');
    try {
        const r = await cached(`ytplayvid:${q}:${resolusi}`, () => dl.ytPlay(q, 'video'));
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

// ── Per-platform shortcuts ────────────────────────────────────────
const platformRoute = (path, platform, validate) => {
    app.get(`/api/${path}`, async (req, res) => {
        const { url } = req.query;
        if (!url) return miss(res, 'url');
        if (validate && !validate(url)) return fail(res, `Bukan link ${platform}!`, 400);
        try {
            const r = await cached(`${path}:${url}`, () => dl.universalDownload(url));
            ok(res, r);
        } catch(e) { fail(res, friendly(e)); }
    });
};

platformRoute('tiktok',     'TikTok');
platformRoute('instagram',  'Instagram',  u => /instagram\.com|instagr\.am/i.test(u));
platformRoute('facebook',   'Facebook');
platformRoute('twitter',    'Twitter/X');
platformRoute('threads',    'Threads');
platformRoute('reddit',     'Reddit');
platformRoute('vimeo',      'Vimeo',      u => /vimeo\.com/i.test(u));
platformRoute('twitch',     'Twitch',     u => /twitch\.tv/i.test(u));
platformRoute('bilibili',   'Bilibili');
platformRoute('douyin',     'Douyin');
platformRoute('snackvideo', 'SnackVideo', u => /snackvideo\.com/i.test(u));
platformRoute('capcut',     'CapCut',     u => /capcut\.com/i.test(u));
platformRoute('pinterest',  'Pinterest');
platformRoute('soundcloud', 'SoundCloud', u => /soundcloud\.com/i.test(u));
platformRoute('terabox',    'Terabox');

app.get('/api/spotify', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    if (!url.includes('spotify.com')) return fail(res, 'Bukan link Spotify!', 400);
    try {
        const r = await cached(`spotify:${url}`, () => dl.universalDownload(url), 600);
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/spotifyplay', async (req, res) => {
    const { q } = req.query;
    if (!q) return miss(res, 'q');
    try {
        const r = await cached(`spotifyplay:${q}`, () => dl.ytPlay(q, 'audio'), 300);
        ok(res, r);
    } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/googledrive', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    if (!url.includes('drive.google.com')) return fail(res, 'Bukan link Google Drive!', 400);
    try { ok(res, await dl.scrapeGoogleDrive(url)); } catch(e) { fail(res, e.message); }
});

app.get('/api/mediafire', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    if (!url.includes('mediafire.com')) return fail(res, 'Bukan link MediaFire!', 400);
    try {
        const r = await cached(`mf:${url}`, () => dl.scrapeMediafire(url), 3600);
        ok(res, r);
    } catch(e) { fail(res, e.message); }
});

app.get('/api/sfile', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    if (!url.includes('sfile.mobi')) return fail(res, 'Bukan link sfile.mobi!', 400);
    try {
        const r = await cached(`sf:${url}`, () => dl.scrapeSfile(url), 3600);
        ok(res, r);
    } catch(e) { fail(res, e.message); }
});

app.get('/api/videy', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    if (!url.includes('videy.co')) return fail(res, 'Bukan link videy.co!', 400);
    try { ok(res, await dl.scrapeVidey(url)); } catch(e) { fail(res, e.message); }
});

app.get('/api/smule', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    try { ok(res, await dl.universalDownload(url)); } catch(e) { fail(res, friendly(e)); }
});

app.get('/api/github', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    if (!url.includes('github.com')) return fail(res, 'Bukan link GitHub!', 400);
    try {
        const r = await cached(`gh:${url}`, () => dl.scrapeGithub(url), 3600);
        ok(res, r);
    } catch(e) { fail(res, e.message); }
});

app.get('/api/resolve', async (req, res) => {
    const { url } = req.query;
    if (!url) return miss(res, 'url');
    try {
        const resolved = await dl.prepareUrl(url);
        ok(res, { original:url, resolved, platform:dl.detectPlatform(resolved), changed:url!==resolved });
    } catch(e) { fail(res, e.message); }
});

// ══════════════════════════════════════════════════════════
// AI ENDPOINTS
// ══════════════════════════════════════════════════════════

const aiChat = (path, fn, param='text') => {
    app.get(`/api/ai/${path}`, async (req, res) => {
        const v = req.query[param] || req.query.text;
        if (!v) return miss(res, param);
        try { ok(res, { ai:path, reply: await fn(v) }); }
        catch(e) { fail(res, e.message); }
    });
};

aiChat('chatgpt',    ai.chatgpt);
aiChat('claude',     ai.claudeAI);
aiChat('gemini',     ai.gemini);
aiChat('deepseek',   ai.deepseek);
aiChat('copilot',    ai.copilot);
aiChat('perplexity', ai.perplexity);
aiChat('deepsearch', ai.deepsearch);
aiChat('kimi',       ai.kimi);
aiChat('mathgpt',    ai.mathgpt);
aiChat('simisimi',   ai.simisimi);
aiChat('grammar',    ai.grammarCheck);
aiChat('bypass',     ai.bypass);
aiChat('dream',      ai.dreamAnalyze);
aiChat('webpilot',   ai.webpilot);

app.get('/api/ai/llamacoder', async (req, res) => {
    const { text, model='deepseek-v3.1' } = req.query;
    if (!text) return miss(res, 'text');
    try { ok(res, { ai:'llamacoder', model, reply: await ai.llamacoder(text, model) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/glm', async (req, res) => {
    const { text, model='glm-4.6' } = req.query;
    if (!text) return miss(res, 'text');
    try { ok(res, { ai:'glm', model, reply: await ai.glm(text, model) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/dolphin', async (req, res) => {
    const { text, template='logical' } = req.query;
    if (!text) return miss(res, 'text');
    try { ok(res, { ai:'dolphin', template, reply: await ai.dolphin(text, template) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/story', async (req, res) => {
    const { prompt, mode='Any genre', length='Short', creative='Medium' } = req.query;
    if (!prompt) return miss(res, 'prompt');
    try { ok(res, { ai:'story', reply: await ai.story(prompt, mode, length, creative) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/screnapp', async (req, res) => {
    const { image_url, text } = req.query;
    if (!image_url || !text) return fail(res, 'Parameter ?image_url dan ?text wajib!', 400);
    try { ok(res, { ai:'screnapp', reply: await ai.screnapp(image_url, text) }); }
    catch(e) { fail(res, e.message); }
});

// NanaBanana — GET & POST
app.get('/api/ai/nanobanana', async (req, res) => {
    const { image_url, prompt } = req.query;
    if (!image_url || !prompt) return fail(res, 'Parameter ?image_url dan ?prompt wajib!', 400);
    try { ok(res, { ai:'nanobanana', image: await ai.nanaBanana(image_url, prompt) }); }
    catch(e) { fail(res, e.message); }
});
app.post('/api/ai/nanobanana', async (req, res) => {
    const { image_url, prompt } = req.body;
    if (!image_url || !prompt) return fail(res, 'Body: {image_url, prompt} wajib!', 400);
    try { ok(res, { ai:'nanobanana', image: await ai.nanaBanana(image_url, prompt) }); }
    catch(e) { fail(res, e.message); }
});

// Image gen
const imgRoute = (path, fn) => {
    app.get(`/api/ai/image/${path}`, async (req, res) => {
        const { prompt, ratio='1:1' } = req.query;
        if (!prompt) return miss(res, 'prompt');
        try { ok(res, { ai:path, image: await fn(prompt, ratio) }); }
        catch(e) { fail(res, e.message); }
    });
};

imgRoute('ideogram',    ai.ideogram);
imgRoute('magicstudio', ai.magicstudio);
imgRoute('deepimg',     ai.deepimg);
imgRoute('flux',        ai.flux);
imgRoute('vider',       ai.vider);
imgRoute('text2image',  ai.text2image);
imgRoute('sologo',      ai.sologo);
imgRoute('writecream',  ai.writecreamImg);

app.get('/api/ai/veo2', async (req, res) => {
    const { prompt } = req.query;
    if (!prompt) return miss(res, 'prompt');
    try { ok(res, { ai:'veo2', result: await ai.veo2(prompt) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/veo3', async (req, res) => {
    const { prompt, image_url } = req.query;
    if (!prompt || !image_url) return fail(res, 'Parameter ?prompt dan ?image_url wajib!', 400);
    try { ok(res, { ai:'veo3', result: await ai.veo3(prompt, image_url) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/suno', async (req, res) => {
    const { prompt } = req.query;
    if (!prompt) return miss(res, 'prompt');
    try { ok(res, { ai:'suno', result: await ai.suno(prompt) }); }
    catch(e) { fail(res, e.message); }
});

app.get('/api/ai/tts', async (req, res) => {
    const { text } = req.query;
    if (!text) return miss(res, 'text');
    try { ok(res, { ai:'tts', result: await ai.geminiTts(text) }); }
    catch(e) { fail(res, e.message); }
});

// ── 404 ────────────────────────────────────────────────────────
app.use((req, res) => fail(res, `Endpoint '${req.path}' tidak ada. Lihat GET / untuk daftar.`, 404));
app.use((err, req, res, _n) => { console.error(err); fail(res, 'Internal error.'); });

// ── Export untuk Vercel ────────────────────────────────────────
module.exports = app;

// ── Local dev ─────────────────────────────────────────────────
if (require.main === module) {
    const PORT = process.env.PORT || 3155;
    app.listen(PORT, () => {
        console.log(`\n╔═══════════════════════════════════════╗`);
        console.log(`║  🚀 Universal Downloader v3.0 AKTIF!  ║`);
        console.log(`║  📡 Port: ${PORT}                      ║`);
        console.log(`║  🌐 http://localhost:${PORT}            ║`);
        console.log(`╚═══════════════════════════════════════╝\n`);
    });
}
