'use strict';
const axios = require('axios');
const FormData = require('form-data');

const BASE = 'https://api.nexray.web.id';
const HDR  = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
const T    = 30000;

const get = async (path, p={}) => (await axios.get(`${BASE}${path}`, { params:p, headers:HDR, timeout:T })).data;

const txt = d => d?.result || d?.response || d?.message || d?.text || d?.answer || d?.data || (typeof d==='string'?d:JSON.stringify(d));
const img = d => d?.result || d?.url || d?.image || d?.image_url || d?.data;

// ── AI Chat ──────────────────────────────────────────────────────
const chatgpt    = t => get('/ai/chatgpt',    { text:t }).then(txt);
const claudeAI   = t => get('/ai/claude',     { text:t }).then(txt);
const gemini     = t => get('/ai/gemini',     { text:t }).then(txt);
const deepseek   = t => get('/ai/deepseek',   { text:t }).then(txt);
const copilot    = t => get('/ai/copilot',    { text:t }).then(txt);
const deepsearch = t => get('/ai/deepsearch', { text:t }).then(txt);
const perplexity = t => get('/ai/perplexity', { text:t }).then(txt);
const kimi       = t => get('/ai/kimi',       { text:t }).then(txt);
const mathgpt    = t => get('/ai/mathgpt',    { text:t }).then(txt);
const simisimi   = t => get('/ai/simisimi',   { text:t }).then(txt);
const grammarCheck = t => get('/ai/grammarcheck', { text:t }).then(txt);
const bypass     = t => get('/ai/bypass',     { text:t }).then(txt);
const dreamAnalyze = t => get('/ai/dreamanalyze', { text:t }).then(txt);
const webpilot   = t => get('/ai/webpilot',   { text:t }).then(txt);

const llamacoder = (t, model='deepseek-v3.1') => get('/ai/llamacoder', { text:t, model }).then(txt);
const glm        = (t, model='glm-4.6')       => get('/ai/glm',        { text:t, model }).then(txt);
const dolphin    = (t, tmpl='logical')         => get('/ai/dolphin',    { text:t, template:tmpl }).then(txt);
const screnapp   = (iu, t) => get('/ai/screnapp', { url_image:iu, text:t }).then(txt);

const story = (p, mode='Any genre', length='Short', creative='Medium') =>
    get('/ai/story', { prompt:p, mode, length, creative }).then(txt);

// ── AI Image ─────────────────────────────────────────────────────
const ideogram   = p => get('/ai/ideogram',    { prompt:p }).then(img);
const magicstudio = p => get('/ai/magicstudio', { prompt:p }).then(img);
const deepimg    = p => get('/ai/deepimg',     { prompt:p }).then(img);
const flux       = p => get('/ai/v1/flux',     { prompt:p }).then(img);
const vider      = p => get('/ai/vider',       { prompt:p }).then(img);
const text2image = p => get('/ai/v1/text2image',{ prompt:p }).then(img);
const sologo     = p => get('/ai/sologo',      { prompt:p }).then(img);
const writecreamImg = (p, ratio='1:1') => get('/ai/writecreamimg', { prompt:p, ratio }).then(img);

// NanaBanana — POST image + prompt
async function nanaBanana(imageUrl, prompt) {
    const form = new FormData();
    const resp = await axios.get(imageUrl, { responseType:'arraybuffer', timeout:15000 });
    const ct = resp.headers['content-type'] || 'image/jpeg';
    const ext = ct.includes('png')?'png':ct.includes('webp')?'webp':'jpg';
    form.append('image', Buffer.from(resp.data), { filename:`img.${ext}`, contentType:ct });
    form.append('param', prompt);
    const { data } = await axios.post(`${BASE}/ai/nanobanana`, form, {
        headers:{ ...form.getHeaders(), ...HDR }, timeout:45000,
    });
    return img(data) || data;
}

// ── AI Video ─────────────────────────────────────────────────────
const veo2 = p => get('/ai/veo2', { prompt:p }).then(d => d?.result||d?.url||d?.video_url||d);
const veo3 = (p,iu) => get('/ai/veo3', { prompt:p, image_url:iu }).then(d => d?.result||d?.url||d?.video_url||d);

// ── AI Audio ─────────────────────────────────────────────────────
const suno     = p => get('/ai/suno',       { prompt:p }).then(d => d?.result||d?.url||d?.audio_url||d);
const geminiTts = t => get('/ai/gemini-tts', { text:t }).then(d => d?.result||d?.url||d?.audio||d);

module.exports = {
    chatgpt, claudeAI, gemini, deepseek, copilot, deepsearch, perplexity,
    kimi, mathgpt, simisimi, grammarCheck, bypass, dreamAnalyze, webpilot,
    llamacoder, glm, dolphin, screnapp, story,
    nanaBanana, ideogram, magicstudio, deepimg, flux, vider, text2image, sologo, writecreamImg,
    veo2, veo3,
    suno, geminiTts,
};
