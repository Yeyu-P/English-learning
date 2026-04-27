// ── Tab switching ──────────────────────────────────────────────

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
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

document.getElementById('openShortcutsBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  window.close();
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
  const floaterEnabled   = document.getElementById('floaterToggle').checked;

  chrome.storage.local.set({ analysisLanguage, analysisDetail, maxRecords, floaterEnabled }, () => {
    showToast('toastPrefs', '保存成功 ✓', 'success');
  });
});

// Load saved prefs
chrome.storage.local.get(['analysisLanguage', 'analysisDetail', 'maxRecords', 'floaterEnabled'], (s) => {
  if (s.analysisLanguage) setSegCtrl('langCtrl', s.analysisLanguage);
  if (s.analysisDetail)   setSegCtrl('detailCtrl', s.analysisDetail);
  if (s.maxRecords != null) document.getElementById('maxRecords').value = s.maxRecords;
  if (s.floaterEnabled != null) document.getElementById('floaterToggle').checked = s.floaterEnabled;
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
