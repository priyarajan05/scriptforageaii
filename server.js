/**
 * ScriptForge AI – Full YouTube Script Generator Backend
 *
 * Generates complete, production-ready YouTube video scripts from a topic
 * (text only) or from an uploaded image/video. Image upload is OPTIONAL.
 * The AI returns a structured full script, not captions or bullet points.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
const LARGE_FILE_BYTES = 25 * 1024 * 1024;
const UPLOAD_DIR = path.join("/tmp", "uploads");
const FRAME_COUNT = 4;

const CONFIG = {
  providerPreference: (process.env.AI_PROVIDER || 'groq').toLowerCase(),
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct'
  }
};

// Word count targets per video length
const LENGTH_CONFIG = {
  'Short':    { words: 1000, minutes: '3–5',  label: 'Short (3–5 min)' },
  'Medium':   { words: 1500, minutes: '8–12', label: 'Medium (8–12 min)' },
  'Long':     { words: 2200, minutes: '15–20',label: 'Long (15–20 min)' },
  'Full':     { words: 3000, minutes: '20–30',label: 'Full-Length (20–30 min)' }
};

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(express.json({ limit: '2mb' }));

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || `http://localhost:${PORT}`;
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || (!file.mimetype.startsWith('image/') && !file.mimetype.startsWith('video/'))) {
      cb(new AppError('Unsupported format. Please upload an image or video file.', 415));
      return;
    }
    cb(null, true);
  }
});

function logInfo(message, details = {}) {
  console.log(`[ScriptForge] ${message}`, details);
}

function logWarn(message, details = {}) {
  console.warn(`[ScriptForge] ${message}`, details);
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function isGroqConfigured() {
  return Boolean(CONFIG.groq.apiKey && CONFIG.groq.apiKey !== 'YOUR_GROQ_API_KEY_HERE');
}

function fetchWithTimeout(url, options = {}, timeoutMs = 120000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timeout));
}

function execFileAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 60000, ...options }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

async function safeUnlink(filePath) {
  if (!filePath) return;
  try { await fsp.unlink(filePath); } catch (_) {}
}

async function safeRm(dirPath) {
  if (!dirPath) return;
  try { await fsp.rm(dirPath, { recursive: true, force: true }); } catch (_) {}
}

async function readFileAsDataUrl(filePath, mimeType) {
  const data = await fsp.readFile(filePath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

async function processImage(file) {
  const outputPath = path.join(UPLOAD_DIR, `${path.parse(file.filename).name}-analysis.jpg`);
  const image = sharp(file.path, { limitInputPixels: false });
  const metadata = await image.metadata();

  await image
    .rotate()
    .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: file.size > LARGE_FILE_BYTES ? 68 : 76, mozjpeg: true })
    .toFile(outputPath);

  const outputStats = await fsp.stat(outputPath);
  const dataUrl = await readFileAsDataUrl(outputPath, 'image/jpeg');

  return {
    metadata: {
      kind: 'image',
      originalName: file.originalname,
      mimeType: file.mimetype,
      originalSizeBytes: file.size,
      processedSizeBytes: outputStats.size,
      width: metadata.width || null,
      height: metadata.height || null,
      format: metadata.format || null
    },
    images: [{ label: 'uploaded image', dataUrl }],
    cleanup: [outputPath]
  };
}

async function probeVideo(filePath) {
  const ffprobePath = ffprobeStatic.path;
  if (!ffprobePath) throw new AppError('Video processing is not available on this system.', 500);

  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);
  return JSON.parse(stdout || '{}');
}

function getVideoDurationSeconds(probe) {
  const raw = probe?.format?.duration || probe?.streams?.find(s => s.codec_type === 'video')?.duration;
  const duration = Number(raw);
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

async function extractVideoFrames(file, probe) {
  if (!ffmpegPath) throw new AppError('Video processing is not available on this system.', 500);

  const framesDir = path.join(UPLOAD_DIR, `${path.parse(file.filename).name}-frames`);
  await fsp.mkdir(framesDir, { recursive: true });

  const duration = getVideoDurationSeconds(probe);
  const interval = duration ? Math.max(2, Math.floor(duration / FRAME_COUNT)) : 5;
  const framePattern = path.join(framesDir, 'frame-%03d.jpg');

  await execFileAsync(ffmpegPath, [
    '-hide_banner', '-loglevel', 'error',
    '-i', file.path,
    '-vf', `fps=1/${interval},scale='min(960,iw)':-2`,
    '-frames:v', String(FRAME_COUNT),
    '-q:v', '4',
    framePattern
  ], { timeout: 120000 });

  const frameFiles = (await fsp.readdir(framesDir))
    .filter(name => /^frame-\d+\.jpg$/i.test(name))
    .sort()
    .map(name => path.join(framesDir, name));

  if (frameFiles.length === 0) {
    throw new AppError('Could not extract video frames. Try another video format.', 422);
  }

  const images = [];
  for (let i = 0; i < frameFiles.length; i++) {
    const framePath = frameFiles[i];
    const compressedPath = path.join(framesDir, `thumb-${String(i + 1).padStart(3, '0')}.jpg`);
    await sharp(framePath)
      .resize({ width: 960, height: 960, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70, mozjpeg: true })
      .toFile(compressedPath);
    images.push({
      label: `video key frame ${i + 1}`,
      dataUrl: await readFileAsDataUrl(compressedPath, 'image/jpeg')
    });
  }

  return { images, framesDir };
}

async function processVideo(file) {
  const probe = await probeVideo(file.path);
  const videoStream = probe.streams?.find(s => s.codec_type === 'video') || {};
  const audioStream = probe.streams?.find(s => s.codec_type === 'audio') || {};
  const { images, framesDir } = await extractVideoFrames(file, probe);

  return {
    metadata: {
      kind: 'video',
      originalName: file.originalname,
      mimeType: file.mimetype,
      originalSizeBytes: file.size,
      durationSeconds: getVideoDurationSeconds(probe),
      width: videoStream.width || null,
      height: videoStream.height || null,
      videoCodec: videoStream.codec_name || null,
      audioCodec: audioStream.codec_name || null,
      keyFramesExtracted: images.length
    },
    images,
    cleanup: [framesDir]
  };
}

async function processUploadedMedia(file) {
  if (!file) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError('File too large. Please upload a file under 500 MB.', 413);
  }
  if (file.mimetype.startsWith('image/')) return processImage(file);
  if (file.mimetype.startsWith('video/')) return processVideo(file);
  throw new AppError('Unsupported format. Please upload an image or video file.', 415);
}

// ─── PROMPT ENGINEERING ──────────────────────────────────────────────────────

function buildSystemInstruction(lengthConfig) {
  return `You are an expert YouTube scriptwriter and content strategist with 10+ years of experience creating viral, high-retention YouTube videos. You write like a professional human creator — engaging, conversational, energetic, and packed with storytelling.

Your task is to generate a COMPLETE, PRODUCTION-READY YouTube video script that a creator can read directly into a camera and record immediately. 
Do NOT generate bullet points, outlines, ideas, or short summaries. Generate FULL paragraphs with natural spoken language.
Do NOT use placeholder text or copy my instructions. Generate actual, creative, original content for every single field based on the topic provided.

The script must be approximately ${lengthConfig.words} words long (suitable for a ${lengthConfig.minutes} minute video).

Return a JSON object exactly matching this schema. All string values must contain actual generated script content.
{
  "title": "<Create a compelling, clickable YouTube video title>",
  "thumbnailText": "<Create 3-5 words max for thumbnail overlay text>",
  "hook": "<Write a full spoken hook for the first 15 seconds. Make it 2-3 sentences that create immediate curiosity>",
  "intro": "<Write a full spoken introduction paragraph (4-6 sentences). Welcome viewers, tease what they will learn, and include a retention teaser>",
  "sections": [
    {
      "heading": "<Create a specific, descriptive section title>",
      "content": "<Write full spoken content for this section. Minimum 200 words. Include examples, stories, explanations. Write naturally as if speaking to camera.>"
    }
  ],
  "cta": "<Write a full spoken call-to-action (3-5 sentences). Ask viewers to like, comment with a specific question, and subscribe.>",
  "conclusion": "<Write a full spoken conclusion (3-5 sentences). Summarize key takeaways and end with a memorable closing line.>",
  "description": "<Write a full YouTube video description (150-300 words). Include a summary, fake timestamps, and call-to-action.>",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10"],
  "seoKeywords": ["primary keyword", "secondary keyword 1", "secondary keyword 2", "secondary keyword 3", "secondary keyword 4"]
}

RULES:
- NEVER output placeholder text like "Section title" or "Write full spoken content". You MUST generate the real content!
- Generate substantial content. Each section must be long and detailed.
- Output ONLY valid JSON using the exact keys above. Do not output anything else.`;
}

function buildTextOnlyContent(topic, goal, videoLength) {
  return `Create a complete YouTube video script about: "${topic}"

Creator goal: ${goal}
Video length: ${videoLength}

Generate a full, detailed, production-ready script that covers the topic comprehensively. Include real examples, data points, stories, and actionable insights. Make it engaging and optimized for audience retention from start to finish.`;
}

function buildMediaContent(topic, goal, videoLength, mediaInsights) {
  const text = [
    `Create a complete YouTube video script based on the uploaded ${mediaInsights.metadata.kind}.`,
    `Topic/Context provided by creator: "${topic}"`,
    `Creator goal: ${goal}`,
    `Video length: ${videoLength}`,
    ``,
    `Analyze the visual content carefully — identify objects, scenes, text, people, colors, activities, and themes visible in the image/video. Use these visual elements as the foundation and inspiration for the entire video script. Transform what you see into compelling YouTube content.`,
    ``,
    `Media metadata: ${JSON.stringify(mediaInsights.metadata, null, 2)}`
  ].join('\n');

  const content = [{ type: 'text', text }];
  for (const image of mediaInsights.images.slice(0, FRAME_COUNT)) {
    content.push({
      type: 'image_url',
      image_url: { url: image.dataUrl, detail: 'high' }
    });
  }
  return content;
}

// ─── GROQ API CALL ────────────────────────────────────────────────────────────

async function callGroq(topic, goal, videoLength, mediaInsights) {
  if (!isGroqConfigured()) {
    throw new AppError('Groq API key is missing. Add GROQ_API_KEY to your .env file and restart the server.', 503);
  }

  const lengthKey = ['Short', 'Medium', 'Long', 'Full'].find(k => videoLength.startsWith(k)) || 'Medium';
  const lengthConfig = LENGTH_CONFIG[lengthKey];

  const userContent = mediaInsights
    ? buildMediaContent(topic, goal, videoLength, mediaInsights)
    : buildTextOnlyContent(topic, goal, videoLength);

  const payload = {
    model: CONFIG.groq.model,
    temperature: 0.4,
    max_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      { role: 'system', content: buildSystemInstruction(lengthConfig) },
      { role: 'user', content: userContent }
    ]
  };

  let response;
  try {
    response = await fetchWithTimeout(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CONFIG.groq.apiKey}`
      },
      body: JSON.stringify(payload)
    }, 120000);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new AppError('Request timed out. The script generation is taking too long — please try again.', 504);
    }
    throw new AppError('Could not reach Groq. Check your connection and try again.', 503);
  }

  const text = await response.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}

  if (!response.ok) {
    const message = data?.error?.message || data?.message || text || `Groq API error (${response.status}).`;
    throw new AppError(`Groq API error: ${message}`, response.status >= 500 ? 502 : response.status);
  }

  const content = String(data?.choices?.[0]?.message?.content || '').trim();
  if (!content) throw new AppError('Groq returned an empty response. Please try again.', 502);
  return content;
}

// ─── RESPONSE PARSER ─────────────────────────────────────────────────────────

function parseScriptJson(text) {
  // Strip any markdown fences
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Find the first { and last } to extract JSON
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in AI response');

  const jsonStr = cleaned.slice(start, end + 1);
  const parsed = JSON.parse(jsonStr);

  const ensureStr = (val) => (typeof val === 'string' ? val : String(val || ''));
  const ensureArr = (val) => Array.isArray(val) ? val.map(String) : [];
  const ensureSections = (val) => {
    if (!Array.isArray(val)) return [];
    return val.map(s => ({
      heading: ensureStr(s?.heading || 'Section'),
      content: ensureStr(s?.content || '')
    })).filter(s => s.content.length > 0);
  };

  return {
    title: ensureStr(parsed.title),
    thumbnailText: ensureStr(parsed.thumbnailText),
    hook: ensureStr(parsed.hook),
    intro: ensureStr(parsed.intro),
    sections: ensureSections(parsed.sections),
    cta: ensureStr(parsed.cta),
    conclusion: ensureStr(parsed.conclusion),
    description: ensureStr(parsed.description),
    tags: ensureArr(parsed.tags),
    seoKeywords: ensureArr(parsed.seoKeywords)
  };
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'ScriptForge AI' });
});

app.get('/api/status', (_req, res) => {
  const ready = isGroqConfigured();
  res.json({
    configured: ready,
    ready,
    activeProvider: ready ? 'groq' : null,
    providerPreference: CONFIG.providerPreference,
    providers: {
      groq: { available: ready, model: CONFIG.groq.model }
    }
  });
});

app.post('/api/generate', generateLimiter, upload.single('media'), async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const cleanupTargets = [];

  try {
    const topic = String(req.body.prompt || '').trim();
    const goal = String(req.body.goal || 'Educational').trim();
    const videoLength = String(req.body.videoLength || 'Medium').trim();

    if (!topic) {
      throw new AppError('Please enter a topic or description for your YouTube video.', 400);
    }

    // Media upload is optional — process it if provided
    let mediaInsights = null;
    if (req.file) {
      cleanupTargets.push(req.file.path);
      logInfo('Processing uploaded media', {
        name: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype
      });
      mediaInsights = await processUploadedMedia(req.file);
      if (mediaInsights?.cleanup) cleanupTargets.push(...mediaInsights.cleanup);
    }

    logInfo('Generating full YouTube script', { topic, goal, videoLength, hasMedia: !!mediaInsights });

    logInfo('Using Groq for generation...', { hasMedia: !!mediaInsights });
    const raw = await callGroq(topic, goal, videoLength, mediaInsights);
    
    const output = parseScriptJson(raw);

    logInfo('Script generated successfully', {
      model: CONFIG.groq.model,
      titleLength: output.title.length,
      sections: output.sections.length
    });

    return res.json({ success: true, ...output });
  } catch (error) {
    const status = error.status || 500;
    const message = error.message || 'Script generation failed. Please try again.';
    logWarn('/api/generate failed', { error: error.message, status });
    return res.status(status).json({ error: message });
  } finally {
    await Promise.all(cleanupTargets.map(target => {
      const t = String(target || '');
      return t.endsWith('-frames') ? safeRm(t) : safeUnlink(t);
    }));
  }
});

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ─── STATIC FILES ─────────────────────────────────────────────────────────────

const FRONTEND_DIR = path.join(__dirname);

// serve css/js/images
app.use(express.static(FRONTEND_DIR, {
  extensions: ['html']
}));

app.use("/images", express.static(path.join(FRONTEND_DIR, "images")));


// frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});


// Vercel fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});


app.use((err, req, res, _next) => {
  logWarn('Unhandled server error', { error: err.message, url: req.url });

  if (req.file?.path) safeUnlink(req.file.path);

  if (req.path.startsWith('/api/')) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large. Please upload a file under 500 MB.'
      });
    }

    if (err.status) {
      return res.status(err.status).json({
        error: err.message
      });
    }

    return res.status(500).json({
      error: 'Internal server error. Please try again.'
    });
  }

  res.status(500).send('Internal Server Error');
});

// ─── STARTUP ──────────────────────────────────────────────────────────────────

// ─── STARTUP ──────────────────────────────────────────────────────────────────

if (require.main === module) {
  logInfo('Starting ScriptForge AI...');

  if (!isGroqConfigured()) {
    logWarn('Groq API key is missing. Add GROQ_API_KEY to environment variables.');
  } else {
    logInfo('Groq provider configured', {
      model: CONFIG.groq.model
    });
  }

  const server = app.listen(PORT, () => {
    console.log('\n✅ ScriptForge AI is running.');
    console.log(`🌐 Port: ${PORT}`);
    console.log(`🤖 Provider: Groq | Model: ${CONFIG.groq.model}\n`);
  });

  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[ScriptForge] Port ${PORT} is already in use.`
      );
      process.exit(1);
    }

    throw error;
  });
}

// Vercel serverless export
module.exports = app;