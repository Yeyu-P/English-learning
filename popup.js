const apiKeyInput  = document.getElementById('apiKey');
const apiKeyLabel  = document.getElementById('apiKeyLabel');
const modelSelect  = document.getElementById('model');
const saveBtn      = document.getElementById('saveBtn');
const toast        = document.getElementById('toast');
const toggleEye    = document.getElementById('toggleEye');
const openPanelBtn = document.getElementById('openPanelBtn');
const tipBox       = document.getElementById('tipBox');
const providerTabs = document.querySelectorAll('.provider-tab');

const PROVIDERS = {
  gemini: {
    label: 'Gemini API Key',
    placeholder: 'AIzaSy...',
    tip: `<strong>完全免费</strong> · 从 <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a> 获取 API Key（登录 Google 账号即可，无需绑定信用卡）`,
    models: [
      { value: 'gemini-2.0-flash',     label: 'gemini-2.0-flash（最新推荐）' },
      { value: 'gemini-1.5-flash',     label: 'gemini-1.5-flash（稳定免费）' },
      { value: 'gemini-1.5-pro',       label: 'gemini-1.5-pro（更强，有限额）' },
    ],
    defaultModel: 'gemini-2.0-flash',
    validate: (k) => k.startsWith('AIza'),
    validateMsg: 'Gemini API Key 应以 AIza 开头',
  },
  claude: {
    label: 'Claude API Key',
    placeholder: 'sk-ant-api03-...',
    tip: `从 <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a> 获取 API Key（需要付费账户）`,
    models: [
      { value: 'claude-sonnet-4-6',          label: 'claude-sonnet-4-6（推荐）' },
      { value: 'claude-opus-4-7',            label: 'claude-opus-4-7（最强，较慢）' },
      { value: 'claude-haiku-4-5-20251001',  label: 'claude-haiku-4-5（最快，较弱）' },
    ],
    defaultModel: 'claude-sonnet-4-6',
    validate: (k) => k.startsWith('sk-ant-'),
    validateMsg: 'Claude API Key 应以 sk-ant- 开头',
  },
};

let currentProvider = 'gemini';

function applyProvider(p) {
  currentProvider = p;
  const cfg = PROVIDERS[p];

  // Update tabs
  providerTabs.forEach((t) => {
    t.classList.toggle('active', t.dataset.provider === p);
  });

  // Update UI
  apiKeyLabel.textContent = cfg.label;
  apiKeyInput.placeholder = cfg.placeholder;
  tipBox.innerHTML = cfg.tip;

  // Rebuild model options
  modelSelect.innerHTML = '';
  cfg.models.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    modelSelect.appendChild(opt);
  });
  modelSelect.value = cfg.defaultModel;
}

// Init
applyProvider('gemini');

// Load saved settings
chrome.storage.local.get(['apiKey', 'provider', 'model'], ({ apiKey, provider, model }) => {
  const p = provider || 'gemini';
  applyProvider(p);
  if (apiKey) apiKeyInput.value = apiKey;
  if (model) modelSelect.value = model;
});

// Provider tab clicks
providerTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    // Clear key when switching providers to avoid confusion
    apiKeyInput.value = '';
    applyProvider(tab.dataset.provider);
  });
});

toggleEye.addEventListener('click', () => {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleEye.textContent = '🙈';
  } else {
    apiKeyInput.type = 'password';
    toggleEye.textContent = '👁';
  }
});

saveBtn.addEventListener('click', () => {
  const apiKey = apiKeyInput.value.trim();
  const model  = modelSelect.value;
  const cfg    = PROVIDERS[currentProvider];

  if (!apiKey) {
    showToast('请输入 API Key', 'error');
    return;
  }
  if (!cfg.validate(apiKey)) {
    showToast(cfg.validateMsg, 'error');
    return;
  }

  chrome.storage.local.set({ apiKey, model, provider: currentProvider }, () => {
    showToast('保存成功 ✓', 'success');
  });
});

openPanelBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
    window.close();
  } catch (err) {
    showToast('无法打开侧边栏: ' + err.message, 'error');
  }
});

function showToast(msg, type) {
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => (toast.className = 'toast'), 2500);
}
