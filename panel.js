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

  // Grammar analysis (detailed mode)
  if (a.grammar) {
    html += `<div class="section-title">📝 语法分析</div>
             <div class="scene-box" style="border-left-color:#a78bfa">${escHtml(a.grammar)}</div>`;
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
  if (records.length === 0) return;
  openExportModal(records);
});

// ── Export modal ───────────────────────────────────────────────

function openExportModal(records) {
  chrome.storage.local.get(['exportPrefs'], ({ exportPrefs }) => {
    const prefs = Object.assign({
      format: 'json',
      includeTime: true,
      includeSource: true,
      includeDialogues: true,
      includeVocabulary: true,
      includeVocabNotes: true,
      includeScene: true,
      includeScreenshot: false,
    }, exportPrefs);
    renderExportModal(records, prefs);
  });
}

function renderExportModal(records, prefs) {
  const done = records.filter((r) => !r.loading && !r.error);

  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.innerHTML = `
    <div class="export-modal">
      <div class="export-modal-title">Export ${done.length} record${done.length !== 1 ? 's' : ''}</div>

      <div class="export-field">
        <div class="export-label">Format</div>
        <div class="seg-ctrl" id="exportFmtCtrl">
          <button class="seg-btn${prefs.format === 'json' ? ' active' : ''}" data-val="json">JSON</button>
          <button class="seg-btn${prefs.format === 'markdown' ? ' active' : ''}" data-val="markdown">Markdown</button>
        </div>
      </div>

      <div class="export-field">
        <div class="export-label">Include</div>
        <div class="export-checks">
          <label class="export-check"><input type="checkbox" id="exTime"${prefs.includeTime ? ' checked' : ''}><span>Time</span></label>
          <label class="export-check"><input type="checkbox" id="exSource"${prefs.includeSource ? ' checked' : ''}><span>Source</span></label>
          <label class="export-check"><input type="checkbox" id="exDialogues"${prefs.includeDialogues ? ' checked' : ''}><span>Dialogues</span></label>
          <label class="export-check"><input type="checkbox" id="exVocabulary"${prefs.includeVocabulary ? ' checked' : ''}><span>Vocabulary</span></label>
          <label class="export-check export-check-indent"><input type="checkbox" id="exVocabNotes"${prefs.includeVocabNotes ? ' checked' : ''}><span>Vocab notes</span></label>
          <label class="export-check"><input type="checkbox" id="exScene"${prefs.includeScene ? ' checked' : ''}><span>Scene</span></label>
          <label class="export-check"><input type="checkbox" id="exScreenshot"${prefs.includeScreenshot ? ' checked' : ''}><span>Screenshot (large)</span></label>
        </div>
      </div>

      <div class="export-modal-actions">
        <button class="export-modal-cancel">Cancel</button>
        <button class="export-modal-go">Export →</button>
      </div>
    </div>
  `;

  // Segmented control
  overlay.querySelectorAll('#exportFmtCtrl .seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('#exportFmtCtrl .seg-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Vocab notes dependency on Vocabulary
  const vocabCb = overlay.querySelector('#exVocabulary');
  const notesCb = overlay.querySelector('#exVocabNotes');
  function syncNotes() {
    notesCb.disabled = !vocabCb.checked;
    notesCb.closest('label').style.opacity = vocabCb.checked ? '1' : '0.4';
    if (!vocabCb.checked) notesCb.checked = false;
  }
  syncNotes();
  vocabCb.addEventListener('change', syncNotes);

  // Cancel
  overlay.querySelector('.export-modal-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Export
  overlay.querySelector('.export-modal-go').addEventListener('click', () => {
    const currentPrefs = {
      format:            overlay.querySelector('#exportFmtCtrl .seg-btn.active')?.dataset.val || 'json',
      includeTime:       overlay.querySelector('#exTime').checked,
      includeSource:     overlay.querySelector('#exSource').checked,
      includeDialogues:  overlay.querySelector('#exDialogues').checked,
      includeVocabulary: overlay.querySelector('#exVocabulary').checked,
      includeVocabNotes: overlay.querySelector('#exVocabNotes').checked,
      includeScene:      overlay.querySelector('#exScene').checked,
      includeScreenshot: overlay.querySelector('#exScreenshot').checked,
    };
    chrome.storage.local.set({ exportPrefs: currentPrefs });
    doExport(done, currentPrefs);
    overlay.remove();
  });

  document.body.appendChild(overlay);
}

function doExport(records, prefs) {
  const date = new Date().toISOString().slice(0, 10);
  if (prefs.format === 'markdown') {
    triggerDownload(`subtract-export-${date}.md`, buildMarkdown(records, prefs), 'text/markdown');
  } else {
    triggerDownload(`subtract-export-${date}.json`, JSON.stringify(buildJsonExport(records, prefs), null, 2), 'application/json');
  }
}

function buildJsonExport(records, prefs) {
  return records.map((r) => {
    const obj = {};
    if (prefs.includeTime)      obj.time       = r.timestamp;
    if (prefs.includeSource)    obj.source     = r.tabTitle;
    if (prefs.includeDialogues && r.analysis?.dialogues?.length)
      obj.dialogues = r.analysis.dialogues;
    if (prefs.includeVocabulary && r.analysis?.vocabulary?.length) {
      obj.vocabulary = r.analysis.vocabulary.map((v) => {
        const entry = { word: v.word, meaning: v.meaning };
        if (prefs.includeVocabNotes && v.note) entry.note = v.note;
        return entry;
      });
    }
    if (prefs.includeScene && r.analysis?.scene)      obj.scene      = r.analysis.scene;
    if (prefs.includeScreenshot && r.screenshot)      obj.screenshot = r.screenshot;
    return obj;
  });
}

function buildMarkdown(records, prefs) {
  const date = new Date().toISOString().slice(0, 10);
  let md = `# Subtract Export — ${date}\n\n`;

  records.forEach((r) => {
    const source = r.tabTitle || 'Unknown';
    const time   = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';

    let headerParts = [];
    if (prefs.includeSource) headerParts.push(escapeMd(source));
    if (prefs.includeTime && time) headerParts.push(time);

    md += `---\n\n## ${headerParts.join(' · ')}\n\n`;

    if (prefs.includeDialogues && r.analysis?.dialogues?.length) {
      md += `### Dialogues\n\n`;
      r.analysis.dialogues.forEach((d) => {
        md += `- "${escapeMd(d.english || '')}" → ${escapeMd(d.chinese || '')}\n`;
      });
      md += '\n';
    }

    if (prefs.includeVocabulary && r.analysis?.vocabulary?.length) {
      md += `### Vocabulary\n\n`;
      r.analysis.vocabulary.forEach((v) => {
        let line = `- **${escapeMd(v.word || '')}** — ${escapeMd(v.meaning || '')}`;
        if (prefs.includeVocabNotes && v.note) {
          line += ` *(${escapeMd(v.note)})*`;
        }
        md += line + '\n';
      });
      md += '\n';
    }

    if (prefs.includeScene && r.analysis?.scene) {
      md += `### Scene\n\n*${escapeMd(r.analysis.scene)}*\n\n`;
    }
  });

  return md;
}

function escapeMd(str) {
  return String(str).replace(/[*_`[\]\\]/g, '\\$&');
}

function triggerDownload(filename, content, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

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
