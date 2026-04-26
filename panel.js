const recordsList = document.getElementById('recordsList');
const emptyState  = document.getElementById('emptyState');
const exportBtn   = document.getElementById('exportBtn');
const clearBtn    = document.getElementById('clearBtn');

let expandedId = null;

// ── Load & render ──────────────────────────────────────────────

async function loadRecords() {
  const { records = [] } = await chrome.storage.local.get(['records']);
  renderAll(records);
}

function renderAll(records) {
  if (records.length === 0) {
    emptyState.classList.remove('hidden');
    recordsList.innerHTML = '';
    return;
  }
  emptyState.classList.add('hidden');
  recordsList.innerHTML = '';
  records.forEach((r) => recordsList.appendChild(buildCard(r)));
}

function buildCard(record) {
  const card = document.createElement('div');
  card.className = 'record-card';
  card.dataset.id = record.id;
  if (expandedId === record.id) card.classList.add('expanded');

  const time = formatTime(record.timestamp);
  const tabTitle = record.tabTitle ? truncate(record.tabTitle, 30) : '未知页面';

  let statusHtml;
  if (record.loading) {
    statusHtml = `<span class="record-status loading">分析中</span>`;
  } else if (record.error) {
    statusHtml = `<span class="record-status error">失败</span>`;
  } else {
    statusHtml = `<span class="record-status done">已完成</span>`;
  }

  const thumbHtml = record.screenshot
    ? `<img class="thumb" src="${record.screenshot}" alt="截图">`
    : `<div class="thumb-placeholder">📸</div>`;

  card.innerHTML = `
    <div class="record-header">
      ${thumbHtml}
      <div class="record-meta">
        <div class="record-time">${time}</div>
        <div class="record-tab">${escHtml(tabTitle)}</div>
      </div>
      ${statusHtml}
      <span class="chevron">▼</span>
    </div>
    <div class="record-body">${buildBody(record)}</div>
  `;

  card.querySelector('.record-header').addEventListener('click', () => toggleCard(record.id));

  const delBtn = card.querySelector('.btn-delete');
  if (delBtn) delBtn.addEventListener('click', (e) => { e.stopPropagation(); deleteRecord(record.id); });

  const img = card.querySelector('.screenshot');
  if (img) img.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(img.src); });

  return card;
}

function buildBody(record) {
  if (record.loading) {
    return `<div class="loading-row"><span class="spinner"></span> 正在分析英语内容…</div>`;
  }
  if (record.error) {
    return `<div class="error-box">⚠ ${escHtml(record.error)}</div>
            <button class="btn-delete">删除此记录</button>`;
  }

  const a = record.analysis || {};
  let html = '';

  // Screenshot
  if (record.screenshot) {
    html += `<img class="screenshot" src="${record.screenshot}" alt="截图" title="点击放大">`;
  }

  // Scene description
  if (a.scene) {
    html += `<div class="section-title">🎬 场景</div>
             <div class="scene-box">${escHtml(a.scene)}</div>`;
  }

  // Dialogues
  const dialogues = a.dialogues || [];
  if (dialogues.length > 0) {
    html += `<div class="section-title">💬 台词翻译</div>`;
    dialogues.forEach((d) => {
      html += `<div class="dialogue-item">
        <div class="dialogue-en">${escHtml(d.english || '')}</div>
        <div class="dialogue-zh">${escHtml(d.chinese || '')}</div>
      </div>`;
    });
  }

  // Vocabulary
  const vocab = a.vocabulary || [];
  if (vocab.length > 0) {
    html += `<div class="section-title">📖 词汇短语</div>`;
    vocab.forEach((v) => {
      const note = v.note ? `<div class="vocab-note">💡 ${escHtml(v.note)}</div>` : '';
      html += `<div class="vocab-item">
        <div class="vocab-word">${escHtml(v.word || '')}</div>
        <div class="vocab-meaning">${escHtml(v.meaning || '')}</div>
        ${note}
      </div>`;
    });
  }

  // Raw fallback (if JSON parse failed)
  if (a.raw) {
    html += `<div class="section-title">原始分析</div><div class="raw-box">${escHtml(a.raw)}</div>`;
  }

  if (!dialogues.length && !vocab.length && !a.raw && !a.scene) {
    html += `<div class="scene-box">未检测到英文内容</div>`;
  }

  html += `<button class="btn-delete">删除此记录</button>`;
  return html;
}

// ── Interactions ───────────────────────────────────────────────

function toggleCard(id) {
  expandedId = expandedId === id ? null : id;
  const card = recordsList.querySelector(`[data-id="${id}"]`);
  if (!card) return;
  if (expandedId === id) {
    card.classList.add('expanded');
  } else {
    card.classList.remove('expanded');
  }
}

async function deleteRecord(id) {
  const { records = [] } = await chrome.storage.local.get(['records']);
  const updated = records.filter((r) => r.id !== id);
  await chrome.storage.local.set({ records: updated });
  if (expandedId === id) expandedId = null;
  renderAll(updated);
}

clearBtn.addEventListener('click', async () => {
  if (!confirm('确定要清空所有学习记录吗？')) return;
  await chrome.storage.local.set({ records: [] });
  expandedId = null;
  renderAll([]);
});

exportBtn.addEventListener('click', async () => {
  const { records = [] } = await chrome.storage.local.get(['records']);
  const exportData = records.map((r) => ({
    time: r.timestamp,
    source: r.tabTitle,
    analysis: r.analysis,
    error: r.error || undefined,
  }));
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `english-learning-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── Lightbox ───────────────────────────────────────────────────

function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}" alt="截图放大">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

// ── Auto-refresh on storage change ────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.records) {
    const records = changes.records.newValue || [];
    // Preserve expansion state for the currently expanded card
    renderAll(records);
    // Re-expand
    if (expandedId) {
      const card = recordsList.querySelector(`[data-id="${expandedId}"]`);
      if (card) card.classList.add('expanded');
    }
  }
});

// ── Helpers ────────────────────────────────────────────────────

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function truncate(str, n) {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ───────────────────────────────────────────────────────
loadRecords();
