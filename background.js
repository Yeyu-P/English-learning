let isCapturing = false;

// ── Command listener ────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (isCapturing) return;
  if (command !== 'capture-screenshot' && command !== 'capture-screenshot-manual') return;

  isCapturing = true;
  chrome.action.setBadgeText({ text: '...' });
  chrome.action.setBadgeBackgroundColor({ color: '#c8713a' });

  try {
    if (command === 'capture-screenshot') {
      await captureFullScreen();
    } else {
      await captureManual();
    }
    chrome.action.setBadgeText({ text: 'OK' });
    chrome.action.setBadgeBackgroundColor({ color: '#5a7a62' });
  } catch (err) {
    if (err.message !== 'cancelled') {
      console.error('Capture error:', err);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#b35a5a' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } finally {
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
    isCapturing = false;
  }
});

// ── Full-screen capture ────────────────────────────────────────

async function captureFullScreen() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const settings = await loadSettings();
  const { recordId } = await createPendingRecord(tab, settings);

  if (settings.autoOpenPanel) {
    try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }

  let screenshotUrl;
  try {
    screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: settings.screenshotFormat,
      ...(settings.screenshotFormat === 'jpeg' ? { quality: settings.screenshotQuality } : {}),
    });
  } catch (err) {
    await updateRecord(recordId, { loading: false, error: 'Screenshot failed: ' + err.message });
    showPageToast(tab.id, 'Screenshot failed', 'error');
    return;
  }

  await analyzeAndStore(tab, screenshotUrl, recordId, settings);
}

// ── Manual area-selection capture ──────────────────────────────

async function captureManual() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const settings = await loadSettings();

  // Inject selector overlay and wait for user to draw a rect
  const { rect, dpr } = await new Promise((resolve, reject) => {
    const TIMEOUT_MS = 60_000;
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('Selection timed out'));
    }, TIMEOUT_MS);

    function listener(msg, sender) {
      if (sender.tab?.id !== tab.id) return;

      if (msg.type === 'subtract-selection-rect') {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(listener);
        resolve({ rect: msg.rect, dpr: msg.devicePixelRatio });
        return true;
      }

      if (msg.type === 'subtract-selection-cancelled') {
        clearTimeout(timer);
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error('cancelled'));
        return true;
      }
    }

    chrome.runtime.onMessage.addListener(listener);

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['selector.js'],
    }).catch((err) => {
      clearTimeout(timer);
      chrome.runtime.onMessage.removeListener(listener);
      reject(err);
    });
  });

  const { recordId } = await createPendingRecord(tab, settings);

  if (settings.autoOpenPanel) {
    try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }

  // Capture full screen then crop to selected rect
  let screenshotUrl;
  try {
    const full = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: settings.screenshotFormat,
      ...(settings.screenshotFormat === 'jpeg' ? { quality: settings.screenshotQuality } : {}),
    });
    screenshotUrl = await cropScreenshot(tab.id, full, rect, dpr, settings);
  } catch (err) {
    await updateRecord(recordId, { loading: false, error: 'Screenshot failed: ' + err.message });
    showPageToast(tab.id, 'Screenshot failed', 'error');
    return;
  }

  await analyzeAndStore(tab, screenshotUrl, recordId, settings);
}

// ── Crop via content script (service worker has no canvas) ─────

async function cropScreenshot(tabId, dataUrl, rect, dpr, settings) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (dataUrl, rect, dpr, fmt, quality) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width  = Math.round(rect.width  * dpr);
          canvas.height = Math.round(rect.height * dpr);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(
            img,
            Math.round(rect.x * dpr), Math.round(rect.y * dpr),
            Math.round(rect.width * dpr), Math.round(rect.height * dpr),
            0, 0,
            Math.round(rect.width * dpr), Math.round(rect.height * dpr)
          );
          const mimeType = fmt === 'png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mimeType, quality / 100));
        };
        img.onerror = () => resolve(dataUrl); // fallback: return full screenshot
        img.src = dataUrl;
      });
    },
    args: [dataUrl, rect, dpr, settings.screenshotFormat, settings.screenshotQuality],
  });
  return result.result;
}

// ── Shared: AI analysis + record update ───────────────────────

async function analyzeAndStore(tab, screenshotUrl, recordId, settings) {
  showPageToast(tab.id, 'AI analyzing…', 'loading');

  const { apiKey, provider, model, analysisLanguage, analysisDetail } = settings;
  let analysis = null;
  let error = null;

  if (!apiKey) {
    error = 'No API key set — click the extension icon to configure';
    showPageToast(tab.id, 'No API key set', 'error');
  } else {
    try {
      const prompt = buildPrompt(analysisLanguage, analysisDetail);
      if (provider === 'groq') {
        analysis = await analyzeWithGroq(screenshotUrl, apiKey, model || 'meta-llama/llama-4-scout-17b-16e-instruct', prompt);
      } else if (provider === 'gemini') {
        analysis = await analyzeWithGemini(screenshotUrl, apiKey, model || 'gemini-2.0-flash', prompt);
      } else if (provider === 'openrouter') {
        analysis = await analyzeWithOpenRouter(screenshotUrl, apiKey, model || 'meta-llama/llama-4-maverick:free', prompt);
      } else {
        analysis = await analyzeWithClaude(screenshotUrl, apiKey, model || 'claude-sonnet-4-6', prompt);
      }
      const vocabCount = analysis?.vocabulary?.length || 0;
      showPageToast(tab.id, 'Done', 'success', vocabCount);
    } catch (err) {
      error = 'Analysis failed: ' + err.message;
      showPageToast(tab.id, 'Analysis failed — check API key', 'error');
    }
  }

  await updateRecord(recordId, { screenshot: screenshotUrl, analysis, loading: false, error });

  // Enforce maxRecords limit
  const { maxRecords } = settings;
  if (maxRecords > 0) {
    const { records: latest = [] } = await chrome.storage.local.get(['records']);
    if (latest.length > maxRecords) {
      await chrome.storage.local.set({ records: latest.slice(0, maxRecords) });
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────

async function loadSettings() {
  const s = await chrome.storage.local.get([
    'apiKey', 'provider', 'model',
    'screenshotFormat', 'screenshotQuality', 'autoOpenPanel',
    'analysisLanguage', 'analysisDetail', 'maxRecords',
  ]);
  return {
    apiKey:            s.apiKey,
    provider:          s.provider          || 'groq',
    model:             s.model,
    screenshotFormat:  s.screenshotFormat  || 'jpeg',
    screenshotQuality: s.screenshotQuality ?? 85,
    autoOpenPanel:     s.autoOpenPanel     ?? true,
    analysisLanguage:  s.analysisLanguage  || 'chinese',
    analysisDetail:    s.analysisDetail    || 'normal',
    maxRecords:        s.maxRecords        ?? 100,
  };
}

async function createPendingRecord(tab, settings) {
  const recordId = Date.now();
  const pending = {
    id:         recordId,
    timestamp:  new Date().toISOString(),
    screenshot: null,
    analysis:   null,
    loading:    true,
    error:      null,
    tabTitle:   tab.title || '',
  };
  const { records = [] } = await chrome.storage.local.get(['records']);
  records.unshift(pending);
  await chrome.storage.local.set({ records });
  return { recordId };
}

async function updateRecord(recordId, patch) {
  const { records = [] } = await chrome.storage.local.get(['records']);
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...patch };
    await chrome.storage.local.set({ records });
  }
}

// ── Page toast (injected into the current tab) ─────────────────

function showPageToast(tabId, msg, type, vocabCount = 0) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (message, toastType, count) => {
      const ID = '__subtract-toast__';
      const STYLE_ID = '__subtract-toast-style__';

      if (!document.getElementById(STYLE_ID)) {
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
          @keyframes __sb_spin { to { transform: rotate(360deg); } }
          @keyframes __sb_in   { from { opacity: 0; transform: translateY(-8px); }
                                  to   { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(s);
      }

      const existing = document.getElementById(ID);
      if (existing) existing.remove();

      const el = document.createElement('div');
      el.id = ID;

      const BG     = { loading: '#fffdf9', success: '#f0f7f1', error: '#fdf0f0' };
      const BORDER = { loading: '#e8e2da', success: '#5a7a62', error: '#b35a5a' };
      const COLOR  = { loading: '#9a918a', success: '#5a7a62', error: '#b35a5a' };

      Object.assign(el.style, {
        position:      'fixed',
        top:           '20px',
        right:         '20px',
        zIndex:        '2147483647',
        padding:       '9px 14px',
        borderRadius:  '10px',
        border:        `1px solid ${BORDER[toastType] || BORDER.loading}`,
        background:    BG[toastType] || BG.loading,
        color:         COLOR[toastType] || COLOR.loading,
        fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize:      '13px',
        display:       'flex',
        alignItems:    'center',
        gap:           '8px',
        boxShadow:     '0 4px 20px rgba(26,22,19,0.12)',
        animation:     '__sb_in 0.2s ease',
        maxWidth:      '260px',
        lineHeight:    '1.4',
        pointerEvents: 'none',
        userSelect:    'none',
      });

      let icon = '';
      if (toastType === 'loading') {
        icon = `<div style="width:13px;height:13px;border:2px solid #e8e2da;border-top-color:#c8713a;border-radius:50%;animation:__sb_spin 0.75s linear infinite;flex-shrink:0"></div>`;
      } else if (toastType === 'success') {
        icon = `<svg style="width:14px;height:14px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="#5a7a62" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else {
        icon = `<svg style="width:14px;height:14px;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke="#b35a5a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      }

      const label = (toastType === 'success' && count > 0)
        ? `${message} · <span style="font-weight:600">${count} vocab</span>`
        : message;

      el.innerHTML = `${icon}<span>${label}</span>`;
      document.documentElement.appendChild(el);

      if (toastType !== 'loading') {
        setTimeout(() => {
          Object.assign(el.style, { transition: 'opacity 0.3s, transform 0.3s', opacity: '0', transform: 'translateY(-8px)' });
          setTimeout(() => el.remove(), 320);
        }, 3500);
      }
    },
    args: [msg, type, vocabCount],
  }).catch(() => {});
}

// ── Prompt builder ─────────────────────────────────────────────

function buildPrompt(language, detail) {
  const langMap = {
    chinese:   '中文',
    bilingual: '中英双语（每项先写中文，再写英文）',
    english:   'English',
  };
  const langNote = langMap[language] || '中文';

  const detailNote = detail === 'detailed'
    ? '\n4. 分析 1-2 个有代表性的句子的语法结构（用' + langNote + '解释）'
    : detail === 'concise'
    ? '\n注意：请保持简洁，词汇表只需列出最重要的 3-5 个。'
    : '';

  return `你是英语学习助手。这是一张美剧截图。请用【${langNote}】回答，帮我：
1. 提取图中所有英文台词或字幕
2. 逐句翻译
3. 列出值得学习的词汇和短语（尤其是习语、俚语、不常见用法），附释义${detailNote}

请严格按照以下 JSON 格式返回，不要添加任何额外文字：
{
  "dialogues": [
    { "english": "英文原文", "chinese": "翻译" }
  ],
  "vocabulary": [
    { "word": "单词或短语", "meaning": "释义", "note": "用法备注（可选）" }
  ],
  "scene": "一句话描述画面场景（可选）"${detail === 'detailed' ? `,
  "grammar": "语法分析（可选）"` : ''}
}

如果截图中没有英文内容，返回：{ "dialogues": [], "vocabulary": [], "scene": "无英文内容" }`;
}

function parseAnalysis(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return { raw: text, dialogues: [], vocabulary: [] };
}

// ── Google Gemini ──────────────────────────────────────────────

async function analyzeWithGemini(screenshotUrl, apiKey, model, prompt) {
  const base64  = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAnalysis(text);
}

// ── Anthropic Claude ───────────────────────────────────────────

async function analyzeWithClaude(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  return parseAnalysis(data.content[0].text);
}

// ── Groq (free, fast vision) ──────────────────────────────────

async function analyzeWithGroq(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  return parseAnalysis(data.choices?.[0]?.message?.content || '');
}

// ── OpenRouter (free vision models) ───────────────────────────

async function analyzeWithOpenRouter(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: prompt },
        ],
      }],
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseAnalysis(text);
}
