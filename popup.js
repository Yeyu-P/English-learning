// ── Tab switching ──────────────────────────────────────────────

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    if (tab.dataset.tab === 'shortcut') loadCurrentShortcut();
  });
});

// ── Open side panel ────────────────────────────────────────────

document.getElementById('openPanelBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch (err) {
    showToast('toastApi', '无法打开侧边栏: ' + err.message, 'error');
  }
});

// ═══════════════════════════════════════════════════════════════
// TAB: API
// ═══════════════════════════════════════════════════════════════

const PROVIDERS = {
  groq: {
    label: 'Groq API Key',
    placeholder: 'gsk_...',
    tip: `<strong style="color:#94a3b8">完全免费</strong> · 从 <a href="https://console.groq.com/keys" target="_blank">console.groq.com</a> 注册获取（无需绑卡，响应极快）`,
    models: [
      { value: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout（推荐）' },
      { value: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick（更强）' },
      { value: 'llama-3.2-11b-vision-preview',  label: 'Llama 3.2 11B（备用）' },
    ],
    defaultModel: 'meta-llama/llama-4-scout-17b-16e-instruct',
    validate: (k) => k.startsWith('gsk_'),
    validateMsg: 'Groq API Key 应以 gsk_ 开头',
  },
  openrouter: {
    label: 'OpenRouter API Key',
    placeholder: 'sk-or-v1-...',
    tip: `<strong style="color:#94a3b8">完全免费</strong> · 从 <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai</a> 注册获取（无需绑卡，国内可用）`,
    models: [
      { value: 'meta-llama/llama-4-maverick:free',              label: 'Llama 4 Maverick（免费，推荐）' },
      { value: 'meta-llama/llama-4-scout:free',                 label: 'Llama 4 Scout（免费）' },
      { value: 'google/gemini-2.0-flash-exp:free',              label: 'Gemini 2.0 Flash Exp（免费）' },
      { value: 'microsoft/phi-4-multimodal-instruct:free',      label: 'Phi-4 Multimodal（免费）' },
    ],
    defaultModel: 'meta-llama/llama-4-maverick:free',
    validate: (k) => k.startsWith('sk-or-'),
    validateMsg: 'OpenRouter API Key 应以 sk-or- 开头',
  },
  gemini: {
    label: 'Gemini API Key',
    placeholder: 'AIzaSy...',
    tip: `从 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 获取（部分地区有免费额度）`,
    models: [
      { value: 'gemini-2.0-flash',  label: 'gemini-2.0-flash（最新推荐）' },
      { value: 'gemini-1.5-flash',  label: 'gemini-1.5-flash（稳定）' },
      { value: 'gemini-1.5-pro',    label: 'gemini-1.5-pro（更强）' },
    ],
    defaultModel: 'gemini-2.0-flash',
    validate: (k) => k.startsWith('AIza'),
    validateMsg: 'Gemini API Key 应以 AIza 开头',
  },
  claude: {
    label: 'Claude API Key',
    placeholder: 'sk-ant-api03-...',
    tip: `从 <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a> 获取（需要付费账户）`,
    models: [
      { value: 'claude-sonnet-4-6',         label: 'claude-sonnet-4-6（推荐）' },
      { value: 'claude-opus-4-7',           label: 'claude-opus-4-7（最强，较慢）' },
      { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5（最快，较弱）' },
    ],
    defaultModel: 'claude-sonnet-4-6',
    validate: (k) => k.startsWith('sk-ant-'),
    validateMsg: 'Claude API Key 应以 sk-ant- 开头',
  },
};

let currentProvider = 'groq';

const apiKeyInput    = document.getElementById('apiKey');
const apiKeyLabel    = document.getElementById('apiKeyLabel');
const modelSelect    = document.getElementById('model');
const tipBox         = document.getElementById('tipBox');
const toggleEye      = document.getElementById('toggleEye');
const providerSelect = document.getElementById('providerSelect');

function applyProvider(p) {
  currentProvider = p;
  const cfg = PROVIDERS[p];

  providerSelect.value = p;
  apiKeyLabel.textContent = cfg.label;
  apiKeyInput.placeholder = cfg.placeholder;
  tipBox.innerHTML = cfg.tip;

  modelSelect.innerHTML = '';
  cfg.models.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    modelSelect.appendChild(opt);
  });
  modelSelect.value = cfg.defaultModel;
}

applyProvider('groq');

providerSelect.addEventListener('change', () => {
  apiKeyInput.value = '';
  applyProvider(providerSelect.value);
});

toggleEye.addEventListener('click', () => {
  const isPass = apiKeyInput.type === 'password';
  apiKeyInput.type = isPass ? 'text' : 'password';
  toggleEye.textContent = isPass ? '🙈' : '👁';
});

document.getElementById('saveApiBtn').addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  const model  = modelSelect.value;
  const cfg    = PROVIDERS[currentProvider];

  if (!apiKey) { showToast('toastApi', '请输入 API Key', 'error'); return; }
  if (!cfg.validate(apiKey)) { showToast('toastApi', cfg.validateMsg, 'error'); return; }

  chrome.storage.local.set({ apiKey, model, provider: currentProvider }, () => {
    showToast('toastApi', '保存成功 ✓', 'success');
  });
});

// Load saved API settings
chrome.storage.local.get(['apiKey', 'provider', 'model'], ({ apiKey, provider, model }) => {
  if (provider) applyProvider(provider);
  if (apiKey)   apiKeyInput.value = apiKey;
  if (model)    modelSelect.value = model;
});

// ═══════════════════════════════════════════════════════════════
// TAB: SHORTCUT
// ═══════════════════════════════════════════════════════════════

const shortcutKeysEl   = document.getElementById('shortcutKeys');
const modifyBtn        = document.getElementById('modifyBtn');
const captureArea      = document.getElementById('captureArea');
const captureHint      = document.getElementById('captureHint');
const captureKeysEl    = document.getElementById('captureKeys');
const captureActions   = document.getElementById('captureActions');
const confirmShortcut  = document.getElementById('confirmShortcutBtn');
const cancelShortcut   = document.getElementById('cancelShortcutBtn');
const resetShortcut    = document.getElementById('resetShortcutBtn');
const shortcutError    = document.getElementById('shortcutError');

let isRecording    = false;
let pendingShortcut = null;

function renderKeys(shortcut, target) {
  if (!shortcut) { target.textContent = '未设置'; return; }
  target.innerHTML = shortcut
    .split('+')
    .map((k, i, arr) =>
      `<kbd>${k}</kbd>${i < arr.length - 1 ? '<span class="key-sep"> + </span>' : ''}`
    )
    .join('');
}

async function loadCurrentShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const cmd = commands.find((c) => c.name === 'capture-screenshot');
    renderKeys(cmd?.shortcut || '', shortcutKeysEl);
  } catch (_) {
    shortcutKeysEl.textContent = '无法读取';
  }
}

function startRecording() {
  isRecording = true;
  pendingShortcut = null;
  shortcutError.textContent = '';
  modifyBtn.style.display = 'none';
  captureArea.style.display = 'flex';
  captureArea.classList.remove('has-key');
  captureActions.classList.remove('show');
  captureHint.textContent = '点击此处，然后按下新快捷键';
  captureKeysEl.innerHTML = '';
  captureArea.focus();
}

function stopRecording() {
  isRecording = false;
  captureArea.style.display = 'none';
  captureActions.classList.remove('show');
  modifyBtn.style.display = '';
}

modifyBtn.addEventListener('click', startRecording);
cancelShortcut.addEventListener('click', stopRecording);

captureArea.addEventListener('click', () => {
  if (!isRecording) return;
  captureArea.focus();
});

captureArea.addEventListener('keydown', (e) => {
  e.preventDefault();
  if (!isRecording) return;

  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
  if (e.altKey)   mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');

  // Only modifiers pressed so far — show partial
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
    captureHint.textContent = mods.length ? '再按一个触发键…' : '按下快捷键组合…';
    renderKeys(mods.length ? mods.join('+') + '+?' : '', captureKeysEl);
    captureActions.classList.remove('show');
    return;
  }

  const KEY_MAP = {
    'ArrowUp': 'Up', 'ArrowDown': 'Down',
    'ArrowLeft': 'Left', 'ArrowRight': 'Right',
    'Delete': 'Delete', 'Home': 'Home', 'End': 'End',
    'PageUp': 'PageUp', 'PageDown': 'PageDown',
    'Insert': 'Insert', ' ': 'Space',
  };

  let key = e.key;
  if (key.length === 1) {
    key = key.toUpperCase();
  } else if (KEY_MAP[key]) {
    key = KEY_MAP[key];
  } else if (/^F\d{1,2}$/.test(key)) {
    // F1–F12 — keep as is
  } else {
    shortcutError.textContent = `不支持的按键 "${key}"，请使用字母、数字、F键或方向键`;
    return;
  }

  if (mods.length === 0) {
    shortcutError.textContent = '需要至少包含一个修饰键（Ctrl / Alt / Shift）';
    return;
  }

  shortcutError.textContent = '';
  pendingShortcut = [...mods, key].join('+');
  captureArea.classList.add('has-key');
  captureHint.textContent = '捕获到：';
  renderKeys(pendingShortcut, captureKeysEl);
  captureActions.classList.add('show');
});

confirmShortcut.addEventListener('click', async () => {
  if (!pendingShortcut) return;
  try {
    await chrome.commands.update({ name: 'capture-screenshot', shortcut: pendingShortcut });
    renderKeys(pendingShortcut, shortcutKeysEl);
    stopRecording();
    shortcutError.textContent = '';
  } catch (err) {
    shortcutError.textContent = '保存失败：' + (err.message || '快捷键可能与系统或其他应用冲突，请尝试其他组合');
  }
});

resetShortcut.addEventListener('click', async () => {
  try {
    await chrome.commands.reset('capture-screenshot');
    await loadCurrentShortcut();
    stopRecording();
    shortcutError.textContent = '';
  } catch (err) {
    shortcutError.textContent = '重置失败：' + err.message;
  }
});

// ═══════════════════════════════════════════════════════════════
// TAB: SCREENSHOT
// ═══════════════════════════════════════════════════════════════

const qualityRange = document.getElementById('qualityRange');
const qualityVal   = document.getElementById('qualityVal');
const qualityField = document.getElementById('qualityField');

qualityRange.addEventListener('input', () => {
  qualityVal.textContent = qualityRange.value + '%';
});

// Format segmented control
setupSegCtrl('fmtCtrl', (val) => {
  qualityField.style.display = val === 'jpeg' ? '' : 'none';
});

document.getElementById('saveScreenshotBtn').addEventListener('click', () => {
  const screenshotFormat  = document.querySelector('#fmtCtrl .seg-btn.active').dataset.val;
  const screenshotQuality = parseInt(qualityRange.value, 10);
  const autoOpenPanel     = document.getElementById('autoOpenToggle').checked;

  chrome.storage.local.set({ screenshotFormat, screenshotQuality, autoOpenPanel }, () => {
    showToast('toastScreenshot', '保存成功 ✓', 'success');
  });
});

// Load saved screenshot settings
chrome.storage.local.get(['screenshotFormat', 'screenshotQuality', 'autoOpenPanel'], (s) => {
  if (s.screenshotFormat) setSegCtrl('fmtCtrl', s.screenshotFormat);
  if (s.screenshotQuality != null) {
    qualityRange.value = s.screenshotQuality;
    qualityVal.textContent = s.screenshotQuality + '%';
  }
  if (s.autoOpenPanel != null) document.getElementById('autoOpenToggle').checked = s.autoOpenPanel;
  qualityField.style.display = (s.screenshotFormat || 'jpeg') === 'jpeg' ? '' : 'none';
});

// ═══════════════════════════════════════════════════════════════
// TAB: PREFS
// ═══════════════════════════════════════════════════════════════

setupSegCtrl('langCtrl');
setupSegCtrl('detailCtrl');

document.getElementById('savePrefsBtn').addEventListener('click', () => {
  const analysisLanguage = document.querySelector('#langCtrl .seg-btn.active').dataset.val;
  const analysisDetail   = document.querySelector('#detailCtrl .seg-btn.active').dataset.val;
  const maxRecords       = parseInt(document.getElementById('maxRecords').value, 10);

  chrome.storage.local.set({ analysisLanguage, analysisDetail, maxRecords }, () => {
    showToast('toastPrefs', '保存成功 ✓', 'success');
  });
});

// Load saved prefs
chrome.storage.local.get(['analysisLanguage', 'analysisDetail', 'maxRecords'], (s) => {
  if (s.analysisLanguage) setSegCtrl('langCtrl', s.analysisLanguage);
  if (s.analysisDetail)   setSegCtrl('detailCtrl', s.analysisDetail);
  if (s.maxRecords != null) document.getElementById('maxRecords').value = s.maxRecords;
});

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function setupSegCtrl(id, onChange) {
  const ctrl = document.getElementById(id);
  ctrl.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      ctrl.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.val);
    });
  });
}

function setSegCtrl(id, val) {
  const ctrl = document.getElementById(id);
  ctrl.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.val === val);
  });
}

function showToast(toastId, msg, type) {
  const el = document.getElementById(toastId);
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => (el.className = 'toast'), 2500);
}
