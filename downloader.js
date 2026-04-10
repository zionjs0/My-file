/**
 * plugins/downloader.js
 * Universal Media Downloader — FIXED
 * Support semua platform via Vercel API
 */
'use strict';

const axios = require('axios');

const API_BASE = process.env.DOWNLOADER_API
    || process.env.API_URL
    || 'https://universal-dl.vercel.app'; // ← GANTI dengan URL Vercel kamu

const EMOJI = {
    youtube:'▶️', tiktok:'🎵', instagram:'📸', facebook:'👥',
    twitter:'🐦', x:'🐦', threads:'🧵', snackvideo:'🍿',
    pinterest:'📌', likee:'❤️', capcut:'✂️', reddit:'🎮',
    soundcloud:'🎧', spotify:'🎵', vimeo:'🎬', twitch:'🎮',
    bilibili:'📺', douyin:'🎭', mediafire:'📁', sfile:'📁',
    github:'💻', videy:'📹', terabox:'☁️', googledrive:'🗂️', unknown:'🌐',
};

const pluginConfig = {
    name: 'download',
    alias: ['dl', 'unduh', 'save', 'downloader'],
    category: 'download',
    description: '📥 Universal downloader — TikTok, Instagram, YouTube, MediaFire, GitHub, dan 1000+ platform',
    usage: '.dl <url>',
    example: [
        '.dl https://vt.tiktok.com/ZSHHvJbvM/',
        '.dl https://youtube.com/shorts/xxx?si=xxx',
        '.dl https://instagram.com/reel/xxx',
        '.dl https://mediafire.com/file/xxx',
        '.dl https://github.com/user/repo',
    ].join('\n'),
    cooldown: 15,
    energi: 1,
    isEnabled: true,
};

function buildCaption(r, platform) {
    const e = EMOJI[platform] || '🌐';
    const lines = [`${e} *${(platform||'MEDIA').toUpperCase()} DOWNLOADER*\n`];
    if (r.title)    lines.push(`📌 *Judul*    : ${r.title}`);
    if (r.uploader) lines.push(`👤 *User*     : ${r.uploader}`);
    if (r.duration) lines.push(`⏱️  *Durasi*   : ${r.duration}`);
    if (r.quality)  lines.push(`📊 *Kualitas* : ${r.quality}`);
    if (r.stars)    lines.push(`⭐ *Stars*    : ${r.stars}`);
    return lines.join('\n');
}

async function sendResult(sock, chat, m, r) {
    const platform = r.platform || 'unknown';
    const caption  = buildCaption(r, platform);

    // FILE (MediaFire, Sfile, GitHub, dll)
    if (r.direct?.length) {
        await m.reply(`${EMOJI[platform]||'📁'} *${platform.toUpperCase()}*\n📌 ${r.title||'File'}\n\n⬇️ Mengirim ${Math.min(r.direct.length,5)} file...`);
        for (const f of r.direct.slice(0,5)) {
            try {
                await sock.sendMessage(chat, {
                    document: { url: f.url },
                    fileName: f.filename || 'file',
                    mimetype: 'application/octet-stream',
                    caption: `📁 ${f.filename||'file'}${f.size?` (${f.size})`:''}`,
                }, { quoted: m });
                await new Promise(r => setTimeout(r, 800));
            } catch {
                await m.reply(`🔗 ${f.filename || 'Download'}: ${f.url}`);
            }
        }
        return;
    }

    const videoUrl = r.mp4 || r.url || r.formats?.video?.[0]?.url;
    const audioUrl = r.mp3 || r.audio || r.formats?.audio?.[0]?.url;
    const images   = r.formats?.image || [];

    // IMAGE only
    if (!videoUrl && !audioUrl && images.length) {
        for (const img of images.slice(0,5)) {
            try {
                await sock.sendMessage(chat, { image:{ url:img.url }, caption }, { quoted:m });
            } catch {}
        }
        return;
    }

    // Thumbnail preview dulu
    if (r.thumbnail) {
        try { await sock.sendMessage(chat, { image:{ url:r.thumbnail }, caption }, { quoted:m }); } catch {}
    }

    // Video
    if (videoUrl) {
        try {
            await sock.sendMessage(chat, {
                video: { url: videoUrl },
                caption: `🎬 ${r.title||'Video'}`,
                mimetype: 'video/mp4',
            }, { quoted:m });
        } catch {
            try {
                await sock.sendMessage(chat, {
                    document: { url: videoUrl },
                    fileName: `${(r.title||'video').slice(0,60)}.mp4`,
                    mimetype: 'video/mp4',
                }, { quoted:m });
            } catch {
                await m.reply(`🔗 Video link: ${videoUrl}`);
            }
        }
    }

    // Audio
    if (audioUrl) {
        try {
            await sock.sendMessage(chat, {
                audio: { url: audioUrl },
                mimetype: 'audio/mpeg',
                ptt: false,
            }, { quoted:m });
        } catch {}
    }

    if (!videoUrl && !audioUrl && !images.length) {
        await m.reply(`❌ Tidak ada media yang bisa dikirim.\n📌 ${r.title||''}`);
    }
}

async function handler(m, { sock }) {
    const url = (m.text || '').trim();

    if (!url) {
        return m.reply(
            `📥 *UNIVERSAL DOWNLOADER*\n\n` +
            `*Cara pakai:*\n${m.prefix+m.command} <url>\n\n` +
            `*Contoh:*\n` +
            `• ${m.prefix+m.command} https://vt.tiktok.com/xxx\n` +
            `• ${m.prefix+m.command} https://youtu.be/xxx\n` +
            `• ${m.prefix+m.command} https://instagram.com/reel/xxx\n` +
            `• ${m.prefix+m.command} https://mediafire.com/file/xxx\n` +
            `• ${m.prefix+m.command} https://github.com/user/repo\n\n` +
            `*Platform:* TikTok • YouTube • Instagram\n` +
            `Facebook • Twitter • Spotify • SoundCloud\n` +
            `Pinterest • Reddit • Bilibili • CapCut\n` +
            `MediaFire • Sfile • GitHub • Terabox • +1000 lagi`
        );
    }

    if (!/^https?:\/\//i.test(url)) return m.reply('❌ URL tidak valid! Harus diawali https://');

    await m.react('⏳');

    try {
        const { data } = await axios.get(`${API_BASE}/api/download`, {
            params: { url },
            timeout: 60000,
        });

        if (!data?.status || !data?.result) {
            throw new Error(data?.message || 'Response API tidak valid');
        }

        await m.react('⬇️');
        await sendResult(sock, m.chat, m, data.result);
        await m.react('✅');

    } catch (err) {
        const msg = err?.response?.data?.message || err?.response?.data?.detail || err.message;
        console.error('[DOWNLOADER ERROR]', msg);
        await m.react('❌');
        await m.reply(
            `❌ *Gagal download!*\n\n` +
            `📛 ${msg}\n\n` +
            `💡 *Kemungkinan penyebab:*\n` +
            `• URL sudah expired/dihapus\n` +
            `• Konten privat\n` +
            `• Platform tidak didukung\n` +
            `• Coba lagi beberapa saat`
        );
    }
}

module.exports = { config: pluginConfig, handler };
