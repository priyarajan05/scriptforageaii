/**
 * ScriptForge AI – Full YouTube Script Generator
 * Frontend application logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // ── Deployment guard ───────────────────────────────────────────────────────
  if (window.location.protocol === 'file:') {
    console.error('[ScriptForge] Running via file:// protocol. Open http://localhost:3000');
  }

  const API_BASE_URL = (() => {
    if (window.SCRIPTFORGE_API_BASE_URL) {
      return String(window.SCRIPTFORGE_API_BASE_URL).replace(/\/+$/, '');
    }
    if (window.location.protocol === 'file:') return 'http://localhost:3000';
    return '';
  })();

  const PLACEHOLDER_IMG = '/images/placeholder.png';
  const MAX_FILE_BYTES = 500 * 1024 * 1024;

  // ── DOM references ─────────────────────────────────────────────────────────
  const uploadZone       = document.getElementById('upload-zone');
  const fileInput        = document.getElementById('creator-file-input');
  const browseFileBtn    = document.getElementById('browse-file-btn');
  const removeFileBtn    = document.getElementById('remove-file-btn');
  const uploadEmptyState = document.getElementById('upload-empty-state');
  const previewState     = document.getElementById('preview-state');
  const mediaPreview     = document.getElementById('media-preview');
  const fileName         = document.getElementById('file-name');
  const fileType         = document.getElementById('file-type');
  const contextInput     = document.getElementById('creator-context');
  const goalSelect       = document.getElementById('creator-goal');
  const videoLengthSel   = document.getElementById('video-length');
  const generateBtn      = document.getElementById('generate-creator-btn');
  const resultsEl        = document.getElementById('creator-results');
  const uploadProgress   = document.getElementById('upload-progress');
  const uploadProgressFill = document.getElementById('upload-progress-fill');
  const uploadProgressText = document.getElementById('upload-progress-text');
  const uploadStatus     = document.getElementById('upload-status');
  const processingStatus = document.getElementById('processing-status');
  const analysisStatus   = document.getElementById('analysis-status');
  const ctaForm          = document.getElementById('cta-form');
  const ctaEmail         = document.getElementById('cta-email');
  const aiStatusBadge    = document.getElementById('ai-status-badge');
  const aiStatusText     = document.getElementById('ai-status-text');
  const aiSetupCard      = document.getElementById('ai-setup-card');
  const testAiBtn        = document.getElementById('test-ai-btn');
  const aiDiagnosticOutput = document.getElementById('ai-diagnostic-output');
  const toast            = document.getElementById('toast');

  let selectedFile  = null;
  let previewUrl    = null;
  let isGenerating  = false;

  // ── Utility functions ──────────────────────────────────────────────────────

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function nl2p(text) {
    // Convert newlines to paragraphs for spoken script display
    return String(text || '')
      .split(/\n{2,}/)
      .map(para => para.trim())
      .filter(Boolean)
      .map(para => `<p>${escHtml(para)}</p>`)
      .join('');
  }

  function showToast(message, label = 'Notice') {
    if (!toast) return;
    const icons = { 'Done': '✅', 'Error': '❌', 'Copied': '📋', 'Notice': 'ℹ️' };
    const icon = icons[label] || 'ℹ️';
    toast.innerHTML = `<span class="toast-emoji">${icon}</span> <span class="toast-text">${escHtml(message)}</span>`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
  }

  function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = Number(bytes) || 0;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit++; }
    return `${size.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
  }

  function countWords(text) {
    return String(text || '').trim().split(/\s+/).filter(Boolean).length;
  }

  // ── Image error fallback ───────────────────────────────────────────────────

  function applyImageFallbacks() {
    document.querySelectorAll('img').forEach(img => {
      if (!img.dataset.fallbackApplied) {
        img.dataset.fallbackApplied = 'true';
        img.addEventListener('error', function onErr() {
          this.removeEventListener('error', onErr);
          if (this.src !== window.location.origin + PLACEHOLDER_IMG) {
            this.src = PLACEHOLDER_IMG;
          }
        });
      }
    });
  }

  // Apply to existing images immediately
  applyImageFallbacks();

  // ── AI Status ──────────────────────────────────────────────────────────────

  async function safeFetchJSON(url, options = {}) {
    if (url.startsWith('file://') || (url.startsWith('/') && window.location.protocol === 'file:')) {
      throw new Error('Cannot make API requests from file://. Open http://localhost:3000 instead.');
    }
    let response;
    try {
      response = await fetch(url, options);
    } catch (err) {
      throw new Error('Network error: Could not reach the backend. Is the server running on http://localhost:3000?');
    }

    const rawText = await response.text();
    const trimmed = rawText.trimStart();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      throw new Error('Backend returned an HTML page instead of JSON. Check server routes.');
    }

    let data = null;
    try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) {
      throw new Error(`Server returned a non-JSON response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(data?.error || data?.message || `Request failed with status ${response.status}.`);
    }
    return data;
  }

  function setAIStatus(kind, title, detail, showSetup = false) {
    if (aiStatusBadge) {
      aiStatusBadge.className = `ai-status-badge ${kind}`;
      aiStatusBadge.textContent = title;
    }
    if (aiStatusText) aiStatusText.textContent = detail;
    if (aiSetupCard) aiSetupCard.classList.toggle('hidden', !showSetup);
  }

  async function loadAIStatus() {
    try {
      const data = await safeFetchJSON(`${API_BASE_URL}/api/status`, { cache: 'no-store' });
      if (data.ready && data.providers?.groq?.available) {
        setAIStatus('ok', '● Connected', `Connected · Groq · ${data.providers.groq.model}`, false);
      } else {
        setAIStatus('setup', '⚠ Setup needed', 'Add GROQ_API_KEY to .env and restart the server.', true);
      }
    } catch (_) {
      setAIStatus('degraded', '○ Checking', 'Checking backend connection...', false);
    }
  }

  function renderDiagnosticOutput(payload) {
    if (!aiDiagnosticOutput) return;
    const lines = [
      `API Key: ${payload?.apiKeyLoaded ? '✅ Loaded' : '❌ Missing'}`,
      `Provider: ${payload?.providerSelected || 'groq'}`,
      `Model: ${payload?.modelSelected || 'Unavailable'}`,
      `Status: ${payload?.ready ? '✅ Ready' : '⚠ Setup needed'}`
    ];
    if (payload?.errorMessage) lines.push(`Error: ${payload.errorMessage}`);
    aiDiagnosticOutput.textContent = lines.join('\n');
    aiDiagnosticOutput.classList.remove('hidden');
  }

  async function testAIConnection() {
    if (aiDiagnosticOutput) {
      aiDiagnosticOutput.textContent = 'Testing Groq connection...';
      aiDiagnosticOutput.classList.remove('hidden');
    }
    try {
      const status = await safeFetchJSON(`${API_BASE_URL}/api/status`, { cache: 'no-store' });
      renderDiagnosticOutput({
        apiKeyLoaded: Boolean(status?.configured),
        providerSelected: status?.activeProvider || status?.providerPreference,
        modelSelected: status?.providers?.groq?.model,
        ready: Boolean(status?.ready),
        errorMessage: status?.ready ? null : 'Groq is not configured.'
      });
      await loadAIStatus();
    } catch (error) {
      renderDiagnosticOutput({
        apiKeyLoaded: false,
        providerSelected: 'groq',
        modelSelected: null,
        ready: false,
        errorMessage: error.message || 'Could not reach the backend server.'
      });
    }
  }

  // ── Workflow status helpers ────────────────────────────────────────────────

  function setWorkflowStatus({ upload, processing, analysis } = {}) {
    if (uploadStatus && upload !== undefined)     uploadStatus.textContent = upload;
    if (processingStatus && processing !== undefined) processingStatus.textContent = processing;
    if (analysisStatus && analysis !== undefined) analysisStatus.textContent = analysis;
  }

  function setUploadProgress(percent) {
    const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
    uploadProgress?.classList.remove('hidden');
    if (uploadProgressFill) uploadProgressFill.style.width = `${p}%`;
    if (uploadProgressText) uploadProgressText.textContent = `${p}%`;
  }

  function resetUploadProgress() {
    if (uploadProgressFill) uploadProgressFill.style.width = '0%';
    if (uploadProgressText) uploadProgressText.textContent = '0%';
    uploadProgress?.classList.add('hidden');
    setWorkflowStatus({
      upload: 'Waiting for upload',
      processing: 'Waiting for media',
      analysis: 'Waiting for generation'
    });
  }

  // ── File handling ──────────────────────────────────────────────────────────

  function validateFile(file) {
    if (!file.type || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
      return 'Unsupported format. Please upload an image or video file.';
    }
    if (file.size > MAX_FILE_BYTES) return 'File too large. Please upload a file under 500 MB.';
    return '';
  }

  function handleFile(file) {
    const err = validateFile(file);
    if (err) { showToast(err, 'Error'); if (fileInput) fileInput.value = ''; return; }

    selectedFile = file;
    resetUploadProgress();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);

    if (mediaPreview) {
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = previewUrl;
        img.alt = 'Uploaded content preview';
        img.className = 'media-preview-img';
        img.onerror = () => { img.src = PLACEHOLDER_IMG; };
        mediaPreview.innerHTML = '';
        mediaPreview.appendChild(img);
      } else {
        mediaPreview.innerHTML = `<video src="${previewUrl}" class="media-preview-img" controls muted playsinline preload="metadata"></video>`;
      }
    }
    if (fileName) fileName.textContent = file.name;
    if (fileType) fileType.textContent = `${file.type || 'Media file'} · ${formatBytes(file.size)}`;
    uploadEmptyState?.classList.add('hidden');
    previewState?.classList.remove('hidden');
    setWorkflowStatus({ upload: `Selected · ${formatBytes(file.size)}`, processing: 'Ready to process', analysis: 'Waiting for generation' });
  }

  function removeFile() {
    selectedFile = null;
    if (fileInput) fileInput.value = '';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    if (mediaPreview) mediaPreview.innerHTML = '';
    previewState?.classList.add('hidden');
    uploadEmptyState?.classList.remove('hidden');
    resetUploadProgress();
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderLoading(message) {
    if (!resultsEl) return;
    resultsEl.innerHTML = `
      <div class="analysis-loading">
        <span class="loading-spinner"></span>
        <h3>${escHtml(message)}</h3>
        <p class="loading-sub">Crafting your full YouTube script — this may take 20–60 seconds…</p>
      </div>`;
  }

  function renderError(message) {
    if (!resultsEl) return;
    resultsEl.innerHTML = `
      <div class="creator-error-card">
        <div class="error-icon">❌</div>
        <h3>Generation Failed</h3>
        <p>${escHtml(message)}</p>
        <p class="error-hint">Check that your server is running and your GROQ_API_KEY is configured in <code>.env</code></p>
      </div>`;
  }

  function renderResults(data) {
    if (!resultsEl) return;

    const wordCount = [data.hook, data.intro, ...(data.sections || []).map(s => s.content), data.cta, data.conclusion]
      .map(t => countWords(t)).reduce((a, b) => a + b, 0);

    const fullScriptText = buildFullScriptText(data);

    resultsEl.innerHTML = `
      <!-- Header card -->
      <div class="script-header-card">
        <div class="script-header-meta">
          <span class="script-badge">✅ Script Ready</span>
          <span class="script-wordcount">${wordCount.toLocaleString()} words</span>
        </div>
        <h2 class="script-title">${escHtml(data.title)}</h2>
        <div class="thumbnail-text-badge">
          <span class="thumbnail-label">📸 Thumbnail Text:</span>
          <span class="thumbnail-value">${escHtml(data.thumbnailText)}</span>
        </div>
        <div class="script-actions">
          <button class="btn btn-primary btn-sm" id="copy-full-script-btn" type="button">📋 Copy Full Script</button>
          <button class="btn btn-secondary btn-sm" id="download-script-btn" type="button">⬇ Download .txt</button>
        </div>
      </div>

      <!-- Hook -->
      ${renderScriptSection('🎣 Hook — First 15 Seconds', data.hook, 'hook-section')}

      <!-- Introduction -->
      ${renderScriptSection('🎬 Introduction', data.intro, 'intro-section')}

      <!-- Main Sections -->
      ${(data.sections || []).map((sec, i) => renderScriptSection(
        `📖 Section ${i + 1}: ${sec.heading}`,
        sec.content,
        'body-section'
      )).join('')}

      <!-- Call to Action -->
      ${renderScriptSection('📣 Call to Action', data.cta, 'cta-section')}

      <!-- Conclusion -->
      ${renderScriptSection('🏁 Conclusion', data.conclusion, 'conclusion-section')}

      <!-- SEO & Description -->
      <section class="result-section seo-section">
        <h4>🔍 YouTube Description</h4>
        <div class="description-box">${nl2p(data.description)}</div>
        <button class="copy-chip btn-chip" type="button" data-copy="${escHtml(data.description)}">Copy Description</button>
      </section>

      <!-- Tags -->
      ${data.tags && data.tags.length > 0 ? `
      <section class="result-section tags-section">
        <h4>🏷 SEO Tags</h4>
        <div class="hashtag-chip-list">
          ${data.tags.map(tag => `<button class="hashtag-chip copy-chip" type="button" data-copy="${escHtml(tag)}">${escHtml(tag)}</button>`).join('')}
        </div>
      </section>` : ''}

      <!-- SEO Keywords -->
      ${data.seoKeywords && data.seoKeywords.length > 0 ? `
      <section class="result-section keywords-section">
        <h4>🔑 SEO Keywords</h4>
        <div class="hashtag-chip-list">
          ${data.seoKeywords.map(kw => `<button class="hashtag-chip copy-chip kw-chip" type="button" data-copy="${escHtml(kw)}">${escHtml(kw)}</button>`).join('')}
        </div>
      </section>` : ''}
    `;

    // Wire up copy/download buttons
    document.getElementById('copy-full-script-btn')?.addEventListener('click', () => {
      navigator.clipboard.writeText(fullScriptText)
        .then(() => showToast('Full script copied to clipboard!', 'Copied'))
        .catch(() => showToast('Could not copy. Please select and copy manually.', 'Error'));
    });

    document.getElementById('download-script-btn')?.addEventListener('click', () => {
      downloadTextFile(data.title || 'script', fullScriptText);
    });

    // Scroll to results
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderScriptSection(heading, content, className) {
    if (!content) return '';
    return `
      <section class="result-section script-section ${escHtml(className)}">
        <div class="section-heading-row">
          <h4>${escHtml(heading)}</h4>
          <button class="copy-chip btn-chip" type="button" data-copy="${escHtml(content)}">Copy</button>
        </div>
        <div class="script-content">${nl2p(content)}</div>
      </section>`;
  }

  function buildFullScriptText(data) {
    const lines = [
      `TITLE: ${data.title}`,
      `THUMBNAIL TEXT: ${data.thumbnailText}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'HOOK — FIRST 15 SECONDS',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      data.hook,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'INTRODUCTION',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      data.intro,
      ''
    ];

    (data.sections || []).forEach((sec, i) => {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`SECTION ${i + 1}: ${sec.heading.toUpperCase()}`);
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(sec.content);
      lines.push('');
    });

    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('CALL TO ACTION');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(data.cta);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('CONCLUSION');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(data.conclusion);
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('YOUTUBE DESCRIPTION');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(data.description);
    lines.push('');
    lines.push('TAGS: ' + (data.tags || []).join(', '));
    lines.push('SEO KEYWORDS: ' + (data.seoKeywords || []).join(', '));

    return lines.join('\n');
  }

  function downloadTextFile(title, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_script.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Script downloaded!', 'Done');
  }

  // ── Upload & generate ──────────────────────────────────────────────────────

  function uploadAndGenerate(formData) {
    return new Promise((resolve, reject) => {
      if (window.location.protocol === 'file:') {
        reject(new Error('Cannot upload from file://. Open http://localhost:3000 instead.'));
        return;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/generate`);
      xhr.timeout = 180000;

      xhr.upload.addEventListener('progress', event => {
        if (!event.lengthComputable) { setWorkflowStatus({ upload: 'Uploading...' }); return; }
        const percent = (event.loaded / event.total) * 100;
        setUploadProgress(percent);
        setWorkflowStatus({ upload: `Uploading · ${Math.round(percent)}%` });
      });

      xhr.addEventListener('load', () => {
        let data = null;
        try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (_) {
          reject(new Error(`Server returned a non-JSON response (HTTP ${xhr.status}).`));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(data?.error || `Request failed with status ${xhr.status}.`));
          return;
        }
        resolve(data);
      });

      xhr.addEventListener('error', () => reject(new Error('Request failed. Check your connection and try again.')));
      xhr.addEventListener('timeout', () => reject(new Error('Request timed out. Please try again.')));
      xhr.send(formData);
    });
  }

  async function generateScript() {
    if (isGenerating) return;

    const topic = contextInput?.value?.trim() || '';
    const goal = goalSelect?.value || 'Educational';
    const videoLength = videoLengthSel?.value || 'Medium';

    if (!topic) {
      showToast('Please enter your video topic or description.', 'Error');
      contextInput?.focus();
      return;
    }

    isGenerating = true;
    const originalText = generateBtn?.textContent || 'Generate Full Script';
    if (generateBtn) {
      generateBtn.disabled = true;
      generateBtn.textContent = '⏳ Generating Script...';
    }

    try {
      setUploadProgress(0);
      setWorkflowStatus({
        upload: selectedFile ? 'Uploading media...' : 'Topic-only mode',
        processing: 'Processing...',
        analysis: 'Generating script...'
      });
      renderLoading('Generating your full YouTube script...');

      const formData = new FormData();
      formData.append('prompt', topic);
      formData.append('goal', goal);
      formData.append('videoLength', videoLength);
      if (selectedFile) formData.append('media', selectedFile);

      const responsePromise = uploadAndGenerate(formData);

      // Progressive loading messages
      const provider = 'Groq';
      const stages = [
        [1500,  () => { setWorkflowStatus({ processing: `Analyzing with ${provider}...` }); renderLoading(`Planning script structure with ${provider}...`); }],
        [5000,  () => { setWorkflowStatus({ analysis: 'Writing hook and introduction...' }); renderLoading('Writing hook and introduction...'); }],
        [12000, () => { renderLoading('Writing main content sections...'); }],
        [25000, () => { renderLoading('Adding storytelling and examples...'); }],
        [40000, () => { renderLoading('Finalizing SEO and description...'); }],
      ];
      const timers = stages.map(([delay, fn]) => setTimeout(() => { if (isGenerating) fn(); }, delay));

      const data = await responsePromise;
      timers.forEach(t => clearTimeout(t));

      setUploadProgress(100);
      setWorkflowStatus({ upload: '✅ Complete', processing: '✅ Processed', analysis: '✅ Script ready' });
      renderResults(data);
      showToast('Full YouTube script generated! 🎬', 'Done');
    } catch (error) {
      const message = error.message || 'Script generation failed. Please try again.';
      setWorkflowStatus({ analysis: '❌ Generation failed' });
      renderError(message);
      showToast(message, 'Error');
    } finally {
      isGenerating = false;
      if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.textContent = originalText;
      }
    }
  }

  // ── Event listeners ────────────────────────────────────────────────────────

  uploadZone?.addEventListener('click', event => {
    if (event.target.closest('button') && event.target !== browseFileBtn) return;
    fileInput?.click();
  });

  uploadZone?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInput?.click(); }
  });

  browseFileBtn?.addEventListener('click', event => {
    event.stopPropagation();
    fileInput?.click();
  });

  fileInput?.addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  });

  ['dragenter', 'dragover'].forEach(type => {
    uploadZone?.addEventListener(type, event => {
      event.preventDefault();
      uploadZone.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(type => {
    uploadZone?.addEventListener(type, event => {
      event.preventDefault();
      uploadZone.classList.remove('drag-over');
    });
  });

  uploadZone?.addEventListener('drop', event => {
    const file = event.dataTransfer?.files?.[0];
    if (file) handleFile(file);
  });

  removeFileBtn?.addEventListener('click', event => {
    event.stopPropagation();
    removeFile();
  });

  generateBtn?.addEventListener('click', generateScript);

  // Global copy handler for all copy-chip buttons
  resultsEl?.addEventListener('click', event => {
    const button = event.target.closest('.copy-chip');
    if (!button) return;
    const text = button.dataset.copy || button.textContent || '';
    navigator.clipboard.writeText(text)
      .then(() => showToast('Copied to clipboard!', 'Copied'))
      .catch(() => showToast('Could not copy to clipboard.', 'Error'));
  });

  testAiBtn?.addEventListener('click', testAIConnection);

  ctaForm?.addEventListener('submit', event => {
    event.preventDefault();
    const email = ctaEmail?.value.trim();
    if (!email) return;
    showToast('Thanks! We will be in touch soon.', 'Done');
    if (ctaEmail) ctaEmail.value = '';
  });

  // ── Init ───────────────────────────────────────────────────────────────────
  resetUploadProgress();
  loadAIStatus();
  setInterval(loadAIStatus, 60000);
});
