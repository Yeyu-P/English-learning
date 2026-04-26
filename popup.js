const apiKeyInput = document.getElementById('apiKey');
const modelSelect = document.getElementById('model');
const saveBtn = document.getElementById('saveBtn');
const toast = document.getElementById('toast');
const toggleEye = document.getElementById('toggleEye');
const openPanelBtn = document.getElementById('openPanelBtn');

// Load saved settings
chrome.storage.local.get(['apiKey', 'model'], ({ apiKey, model }) => {
  if (apiKey) apiKeyInput.value = apiKey;
  if (model) modelSelect.value = model;
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
  const model = modelSelect.value;

  if (!apiKey) {
    showToast('请输入 API Key', 'error');
    return;
  }
  if (!apiKey.startsWith('sk-ant-')) {
    showToast('API Key 格式不正确', 'error');
    return;
  }

  chrome.storage.local.set({ apiKey, model }, () => {
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
