let isCapturing = false;

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'capture-screenshot' && !isCapturing) {
    isCapturing = true;
    chrome.action.setBadgeText({ text: '...' });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });

    try {
      await captureAndAnalyze();
      chrome.action.setBadgeText({ text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } catch (err) {
      console.error('Capture error:', err);
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } finally {
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
      isCapturing = false;
    }
  }
});

async function captureAndAnalyze() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const recordId = Date.now();
  const pending = {
    id: recordId,
    timestamp: new Date().toISOString(),
    screenshot: null,
    analysis: null,
    loading: true,
    error: null,
    tabTitle: tab.title || '',
  };

  // Load all settings at once
  const settings = await chrome.storage.local.get([
    'apiKey', 'provider', 'model',
    'screenshotFormat', 'screenshotQuality', 'autoOpenPanel',
    'analysisLanguage', 'analysisDetail', 'maxRecords',
    'records',
  ]);

  const {
    apiKey,
    provider          = 'openrouter',
    model,
    screenshotFormat  = 'jpeg',
    screenshotQuality = 85,
    autoOpenPanel     = true,
    analysisLanguage  = 'chinese',
    analysisDetail    = 'normal',
    maxRecords        = 100,
  } = settings;

  const records = settings.records || [];
  records.unshift(pending);
  await chrome.storage.local.set({ records });

  if (autoOpenPanel) {
    try { await chrome.sidePanel.open({ windowId: tab.windowId }); } catch (_) {}
  }

  // Capture screenshot
  let screenshotUrl;
  try {
    screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: screenshotFormat,
      ...(screenshotFormat === 'jpeg' ? { quality: screenshotQuality } : {}),
    });
  } catch (err) {
    await updateRecord(recordId, { loading: false, error: '截图失败: ' + err.message });
    showPageToast(tab.id, '截图失败', 'error');
    return;
  }

  // Immediate feedback: screenshot captured, now analyzing
  showPageToast(tab.id, 'AI 分析中…', 'loading');

  let analysis = null;
  let error = null;

  if (!apiKey) {
    error = '未设置 API Key，请点击插件图标进行设置';
    showPageToast(tab.id, '未设置 API Key', 'error');
  } else {
    try {
      const prompt = buildPrompt(analysisLanguage, analysisDetail);
      if (provider === 'gemini') {
        analysis = await analyzeWithGemini(screenshotUrl, apiKey, model || 'gemini-2.0-flash', prompt);
      } else if (provider === 'openrouter') {
        analysis = await analyzeWithOpenRouter(screenshotUrl, apiKey, model || 'meta-llama/llama-4-maverick:free', prompt);
      } else {
        analysis = await analyzeWithClaude(screenshotUrl, apiKey, model || 'claude-sonnet-4-6', prompt);
      }
      const vocabCount = analysis?.vocabulary?.length || 0;
      showPageToast(tab.id, '分析完成', 'success', vocabCount);
    } catch (err) {
      error = '分析失败: ' + err.message;
      showPageToast(tab.id, '分析失败，请检查 API Key', 'error');
    }
  }

  await updateRecord(recordId, { screenshot: screenshotUrl, analysis, loading: false, error });

  // Enforce maxRecords limit
  if (maxRecords > 0) {
    const { records: latest = [] } = await chrome.storage.local.get(['records']);
    if (latest.length > maxRecords) {
      await chrome.storage.local.set({ records: latest.slice(0, maxRecords) });
    }
  }
}

// ── Page toast (injected into the current tab) ─────────────────

function showPageToast(tabId, msg, type, vocabCount = 0) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (message, toastType, count) => {
      const ID = '__el-toast__';
      const STYLE_ID = '__el-toast-style__';

      if (!document.getElementById(STYLE_ID)) {
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
          @keyframes __el_spin { to { transform: rotate(360deg); } }
          @keyframes __el_in   { from { opacity: 0; transform: translateY(-10px); }
                                  to   { opacity: 1; transform: translateY(0); } }
        `;
        document.head.appendChild(s);
      }

      const existing = document.getElementById(ID);
      if (existing) existing.remove();

      const el = document.createElement('div');
      el.id = ID;

      const BG     = { loading: '#1e293b', success: '#052e16', error: '#450a0a' };
      const BORDER = { loading: '#475569', success: '#16a34a', error: '#dc2626' };

      Object.assign(el.style, {
        position:      'fixed',
        top:           '20px',
        right:         '20px',
        zIndex:        '2147483647',
        padding:       '10px 15px',
        borderRadius:  '12px',
        border:        `1px solid ${BORDER[toastType] || BORDER.loading}`,
        background:    BG[toastType] || BG.loading,
        color:         '#f1f5f9',
        fontFamily:    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize:      '13px',
        display:       'flex',
        alignItems:    'center',
        gap:           '9px',
        boxShadow:     '0 8px 28px rgba(0,0,0,0.45)',
        animation:     '__el_in 0.22s ease',
        maxWidth:      '260px',
        lineHeight:    '1.4',
        pointerEvents: 'none',
        userSelect:    'none',
      });

      let icon = '';
      if (toastType === 'loading') {
        icon = `<div style="width:13px;height:13px;border:2px solid #475569;border-top-color:#f59e0b;border-radius:50%;animation:__el_spin 0.75s linear infinite;flex-shrink:0"></div>`;
      } else if (toastType === 'success') {
        icon = `<span style="color:#4ade80;font-size:15px;flex-shrink:0;font-weight:700">✓</span>`;
      } else {
        icon = `<span style="font-size:14px;flex-shrink:0">⚠</span>`;
      }

      const label = (toastType === 'success' && count > 0)
        ? `${message} · <span style="color:#86efac">${count} 个词汇</span>`
        : message;

      el.innerHTML = `${icon}<span>${label}</span>`;
      document.documentElement.appendChild(el);

      if (toastType !== 'loading') {
        setTimeout(() => {
          Object.assign(el.style, { transition: 'opacity 0.3s, transform 0.3s', opacity: '0', transform: 'translateY(-10px)' });
          setTimeout(() => el.remove(), 320);
        }, 3500);
      }
    },
    args: [msg, type, vocabCount],
  }).catch(() => {});
}

async function updateRecord(recordId, patch) {
  const { records = [] } = await chrome.storage.local.get(['records']);
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...patch };
    await chrome.storage.local.set({ records });
  }
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
