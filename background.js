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

  const { records = [] } = await chrome.storage.local.get(['records']);
  records.unshift(pending);
  await chrome.storage.local.set({ records });

  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (_) {}

  let screenshotUrl;
  try {
    screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 90,
    });
  } catch (err) {
    await updateRecord(recordId, { loading: false, error: '截图失败: ' + err.message });
    return;
  }

  const { apiKey, provider = 'gemini', model } = await chrome.storage.local.get(['apiKey', 'provider', 'model']);

  let analysis = null;
  let error = null;

  if (!apiKey) {
    error = '未设置 API Key，请点击插件图标进行设置';
  } else {
    try {
      if (provider === 'gemini') {
        const geminiModel = model || 'gemini-2.0-flash';
        analysis = await analyzeWithGemini(screenshotUrl, apiKey, geminiModel);
      } else {
        const claudeModel = model || 'claude-sonnet-4-6';
        analysis = await analyzeWithClaude(screenshotUrl, apiKey, claudeModel);
      }
    } catch (err) {
      error = '分析失败: ' + err.message;
    }
  }

  await updateRecord(recordId, { screenshot: screenshotUrl, analysis, loading: false, error });
}

async function updateRecord(recordId, patch) {
  const { records = [] } = await chrome.storage.local.get(['records']);
  const idx = records.findIndex((r) => r.id === recordId);
  if (idx !== -1) {
    records[idx] = { ...records[idx], ...patch };
    await chrome.storage.local.set({ records });
  }
}

const PROMPT = `你是英语学习助手。这是一张美剧截图。请帮我：
1. 提取图中所有英文台词或字幕
2. 逐句翻译成中文
3. 列出值得学习的词汇和短语（尤其是习语、俚语、不常见用法），附中文释义

请严格按照以下 JSON 格式返回，不要添加任何额外文字：
{
  "dialogues": [
    { "english": "英文原文", "chinese": "中文翻译" }
  ],
  "vocabulary": [
    { "word": "单词或短语", "meaning": "中文释义", "note": "用法备注（可选，没有则省略此字段）" }
  ],
  "scene": "一句话描述画面场景（可选）"
}

如果截图中没有英文内容，返回：{ "dialogues": [], "vocabulary": [], "scene": "无英文内容" }`;

function parseAnalysis(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch (_) {}
  }
  return { raw: text, dialogues: [], vocabulary: [] };
}

// ── Google Gemini ──────────────────────────────────────────────

async function analyzeWithGemini(screenshotUrl, apiKey, model) {
  const base64 = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: PROMPT },
        ],
      }],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      msg = body.error?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseAnalysis(text);
}

// ── Anthropic Claude ───────────────────────────────────────────

async function analyzeWithClaude(screenshotUrl, apiKey, model) {
  const base64 = screenshotUrl.split(',')[1];
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
          { type: 'text', text: PROMPT },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      msg = body.error?.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  const text = data.content[0].text;
  return parseAnalysis(text);
}
