/**
 * plugins/ytmp4.js
 * YouTube MP4 + MP3 Downloader — FIXED
 * Auto-detect URL API dari env atau hardcode Vercel URL
 *
 * Support:
 *  youtube.com/watch?v=xxx
 *  youtu.be/xxx
 *  youtube.com/shorts/xxx?si=xxx  ← Shorts (termasuk ?si= param)
 *  youtube.com/live/xxx
 *  music.youtube.com/watch?v=xxx
 */
'use strict';

const axios = require('axios');

// ⚠️ GANTI dengan URL Vercel kamu setelah deploy
// Contoh: https://universal-dl.vercel.app
const API_BASE = process.env.DOWNLOADER_API
    || process.env.API_URL
    || 'https://universal-dl.vercel.app'; // ← GANTI ini

const pluginConfig = {
    name: 'ytmp4',
    alias: ['youtubemp4', 'ytvideo', 'yt4', 'ytdown', 'ytdl', 'yt'],
    category: 'download',
    description: '🎬 Download video & audio YouTube dalam berbagai kualitas (HD support)',
    usage: '.ytmp4 <url> [resolusi]',
    example: [
        '.ytmp4 https://youtu.be/dQw4w9WgXcQ',
        '.ytmp4 https://youtube.com/shorts/xxx?si=xxx',
        '.ytmp4 https://youtube.com/watch?v=xxx 1080',
        '.ytmp4 https://youtube.com/watch?v=xxx 720',
    ].join('\n'),
    cooldown: 20,
    energi: 1,
    isEnabled: true,
};

// ── Support semua format YouTube URL ────────────────────────────
function isYouTubeUrl(url) {
    return /(?:youtube\.com\/(?:watch|shorts|live|embed|v)|youtu\.be\/|yt\.be\/|music\.youtube\.com\/watch)/i.test(url);
}

// ── Build caption info ───────────────────────────────────────────
function buildCaption(r) {
    const lines = ['🎬 *YOUTUBE DOWNLOADER*\n'];
    if (r.title)    lines.push(`📌 *Judul*   : ${r.title}`);
    if (r.uploader) lines.push(`👤 *Creator* : ${r.uploader}`);
    if (r.duration) lines.push(`⏱️  *Durasi*  : ${r.duration}`);
    if (r.quality)  lines.push(`📊 *Kualitas*: ${r.quality}`);
    return lines.join('\n');
}

async function handler(m, { sock }) {
    const args = (m.text || '').trim().split(/\s+/);
    const url  = args[0];
    // Resolusi bisa dari arg ke-2: .ytmp4 URL 1080
    const resolusi = args[1] && /^\d{3,4}$/.test(args[1]) ? args[1] : '1080';

    if (!url) {
        return m.reply(
            `📌 *Cara pakai:*\n` +
            `${m.prefix + m.command} <url> [resolusi]\n\n` +
            `*Contoh:*\n` +
            `• ${m.prefix + m.command} https://youtu.be/xxx\n` +
            `• ${m.prefix + m.command} https://youtube.com/shorts/xxx\n` +
            `• ${m.prefix + m.command} https://youtu.be/xxx 1080\n` +
            `• ${m.prefix + m.command} https://youtu.be/xxx 720\n\n` +
            `*Resolusi tersedia:* 2160, 1440, 1080, 720, 480, 360`
        );
    }

    if (!isYouTubeUrl(url)) {
        return m.reply(
            '❌ URL harus link YouTube!\n\n' +
            'Format yang diterima:\n' +
            '• youtube.com/watch?v=...\n' +
            '• youtu.be/...\n' +
            '• youtube.com/shorts/...\n' +
            '• youtube.com/live/...\n' +
            '• music.youtube.com/watch?v=...'
        );
    }

    await m.react('⏳');

    try {
        const { data } = await axios.get(`${API_BASE}/api/ytmp4`, {
            params: { url, resolusi },
            timeout: 60000,
        });

        if (!data?.status || !data?.result) {
            throw new Error(data?.message || 'Response API tidak valid');
        }

        const r = data.result;
        const caption = buildCaption(r);

        const videoUrl = r.mp4 || r.url || r.formats?.video?.[0]?.url;
        const audioUrl = r.mp3 || r.audio || r.formats?.audio?.[0]?.url;

        if (!videoUrl && !audioUrl) throw new Error('Tidak ada URL media');

        // Kirim thumbnail sebagai preview
        if (r.thumbnail) {
            try {
                await sock.sendMessage(m.chat, {
                    image: { url: r.thumbnail },
                    caption,
                }, { quoted: m });
            } catch {}
        }

        // Kirim video
        if (videoUrl) {
            try {
                await sock.sendMessage(m.chat, {
                    video: { url: videoUrl },
                    caption: `🎬 ${r.title || 'YouTube Video'}\n📊 ${r.quality || resolusi + 'p'}`,
                    mimetype: 'video/mp4',
                }, { quoted: m });
            } catch {
                // Fallback sebagai dokumen jika video terlalu besar
                await sock.sendMessage(m.chat, {
                    document: { url: videoUrl },
                    fileName: `${(r.title || 'video').slice(0, 60)}.mp4`,
                    mimetype: 'video/mp4',
                }, { quoted: m });
            }
        }

        // Kirim audio
        if (audioUrl) {
            try {
                await sock.sendMessage(m.chat, {
                    audio: { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    ptt: false,
                }, { quoted: m });
            } catch {}
        }

        await m.react('✅');

    } catch (err) {
        const msg = err?.response?.data?.message || err.message;
        console.error('[YTMP4 ERROR]', msg);
        await m.react('❌');
        await m.reply(
            `❌ *Gagal download!*\n\n` +
            `📛 ${msg}\n\n` +
            `💡 *Tips:*\n` +
            `• Pastikan link valid\n` +
            `• Video privat/restricted tidak bisa\n` +
            `• Coba resolusi lebih rendah (720, 480)\n` +
            `• Coba lagi beberapa saat`
        );
    }
}

module.exports = { config: pluginConfig, handler };
