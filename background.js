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
    provider          = 'gemini',
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
    return;
  }

  let analysis = null;
  let error = null;

  if (!apiKey) {
    error = '未设置 API Key，请点击插件图标进行设置';
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
    } catch (err) {
      error = '分析失败: ' + err.message;
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
