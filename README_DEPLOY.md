# 🚀 Deploy ke Vercel — Panduan Lengkap

## CARA CEPAT (Vercel CLI)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Masuk ke folder project
cd universal-downloader-vercel

# 3. Install dependencies
npm install

# 4. Deploy (ikuti instruksi interaktif)
vercel

# 5. Deploy ke production
vercel --prod
```

Setelah deploy, kamu dapat URL seperti:
```
https://universal-downloader-xxxxx.vercel.app
```

---

## CARA GITHUB (Auto Deploy)

1. Push project ke GitHub
2. Buka https://vercel.com/new
3. Import repo GitHub kamu
4. Setting:
   - **Framework**: Other
   - **Root Directory**: ./
   - **Build Command**: (kosongkan)
   - **Output Directory**: (kosongkan)
5. Klik Deploy!

---

## SETTING PLUGIN WA BOT

Setelah dapat URL Vercel, update plugin:

### Opsi A: Edit langsung di plugin
```js
// Di file plugins/ytmp4.js dan plugins/downloader.js
const API_BASE = 'https://NAMA-PROJECT-KAMU.vercel.app';
```

### Opsi B: Pakai .env di bot
```env
# Di file .env bot kamu
DOWNLOADER_API=https://NAMA-PROJECT-KAMU.vercel.app
```

---

## TEST API

```bash
# Universal download
curl "https://KAMU.vercel.app/api/download?url=https://youtu.be/dQw4w9WgXcQ"

# YouTube HD 1080p
curl "https://KAMU.vercel.app/api/ytmp4?url=https://youtu.be/xxx&resolusi=1080"

# YouTube MP3
curl "https://KAMU.vercel.app/api/ytmp3?url=https://youtu.be/xxx"

# TikTok (short URL pun bisa)
curl "https://KAMU.vercel.app/api/download?url=https://vt.tiktok.com/ZSHHvJbvM/"

# GitHub
curl "https://KAMU.vercel.app/api/github?url=https://github.com/himanackerman/RYO-YAMADA-MD-"

# AI ChatGPT
curl "https://KAMU.vercel.app/api/ai/chatgpt?text=Halo+siapa+kamu"

# AI NanaBanana (modify image)
curl "https://KAMU.vercel.app/api/ai/nanobanana?image_url=URL_GAMBAR&prompt=make+it+cartoon"

# Generate gambar
curl "https://KAMU.vercel.app/api/ai/image/ideogram?prompt=anime+girl"
```

---

## STRUKTUR FILE

```
vercel-project/
├── api/
│   └── index.js         ← Main server (entry point Vercel)
├── lib/
│   ├── downloader.js    ← Download engine (Cobalt + NexRay)
│   └── ai.js            ← AI providers
├── plugins/             ← Plugin WA Bot
│   ├── ytmp4.js         ← .ytmp4 command
│   └── downloader.js    ← .dl command
├── vercel.json          ← Konfigurasi Vercel
├── package.json
└── .env.example
```

---

## TROUBLESHOOT

| Error | Solusi |
|-------|--------|
| ETIMEDOUT | Update DOWNLOADER_API di plugin |
| 404 endpoint | Cek vercel.json routes sudah benar |
| Timeout > 60s | Video terlalu besar, coba resolusi lebih rendah |
| AI error | NexRay lagi down, coba beberapa menit lagi |

---

## LIMIT VERCEL FREE

| Item | Free Tier |
|------|-----------|
| Request timeout | 60 detik |
| Memory | 1024 MB |
| Bandwidth | 100 GB/bulan |
| Invocations | 1M/bulan |

Cukup untuk 1000+ user aktif! 🎉
