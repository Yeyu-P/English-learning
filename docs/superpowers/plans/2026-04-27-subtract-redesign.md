# Subtract Redesign & Area Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand extension to "Subtract", redesign UI with TAB-OUT warm paper aesthetic, add manual area-selection screenshot shortcut.

**Architecture:** Keep all JS logic (panel.js, popup.js, AI provider code) 100% intact. Only rebuild HTML + CSS for panel and popup. Add one new content script (selector.js) and minimal additions to background.js for the new command.

**Tech Stack:** Chrome Extension MV3 · vanilla JS · Google Fonts (Newsreader + DM Sans) · chrome.scripting API (already permitted)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `manifest.json` | Modify | Rename + add `capture-screenshot-manual` command |
| `panel.css` | Rebuild | Full TAB-OUT warm palette, keep all JS-referenced class names |
| `panel.html` | Modify | New header (SVG logo), updated empty state, keep all IDs |
| `popup.html` | Rebuild | Full TAB-OUT theme, keep all existing element IDs |
| `selector.js` | Create | Content script: overlay + drag selection + message to background |
| `background.js` | Modify | Refactor captureAndAnalyze, add manual capture command |

**IDs/classes that MUST NOT change** (referenced by panel.js):
`#recordsList` `#emptyState` `#exportBtn` `#clearBtn`
`.record-card` `.record-header` `.thumb` `.thumb-placeholder` `.record-meta` `.record-time` `.record-tab` `.record-status.loading/done/error` `.chevron` `.record-body` `.loading-row` `.spinner` `.error-box` `.section-title` `.scene-box` `.dialogue-item` `.dialogue-en` `.dialogue-zh` `.vocab-item` `.vocab-word` `.vocab-meaning` `.vocab-note` `.raw-box` `.btn-delete` `.screenshot` `.lightbox`

**IDs/classes that MUST NOT change** (referenced by popup.js):
`#openPanelBtn` `#providerSelect` `#apiKey` `#apiKeyLabel` `#model` `#tipBox` `#toggleEye` `#saveApiBtn` `#toastApi`
`#shortcutKeys` `#modifyBtn` `#captureArea` `#captureHint` `#captureKeys` `#captureActions` `#confirmShortcutBtn` `#cancelShortcutBtn` `#resetShortcutBtn` `#shortcutError`
`#fmtCtrl` `#qualityField` `#qualityRange` `#qualityVal` `#autoOpenToggle` `#saveScreenshotBtn` `#toastScreenshot`
`#langCtrl` `#detailCtrl` `#maxRecords` `#savePrefsBtn` `#toastPrefs`
`.tab[data-tab]` `.panel` `#tab-api` `#tab-shortcut` `#tab-screenshot` `#tab-prefs`
`.seg-btn[data-val]` `.key-sep` `.toast`

---

## Task 1: Manifest — rename + add manual command

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Update manifest.json**

Replace the entire file with:

```json
{
  "manifest_version": 3,
  "name": "Subtract",
  "version": "1.1",
  "description": "Capture subtitles from any video. Extract English with AI.",
  "permissions": [
    "activeTab",
    "storage",
    "tabs",
    "sidePanel",
    "scripting"
  ],
  "host_permissions": [
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://openrouter.ai/*",
    "https://api.groq.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_title": "Subtract"
  },
  "side_panel": {
    "default_path": "panel.html"
  },
  "commands": {
    "capture-screenshot": {
      "suggested_key": {
        "default": "Ctrl+Shift+E",
        "mac": "Command+Shift+E"
      },
      "description": "Full screen capture + AI analysis"
    },
    "capture-screenshot-manual": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "Select area to capture + AI analysis"
    }
  }
}
```

- [ ] **Step 2: Verify in Chrome**

Load/reload the extension at `chrome://extensions`. Confirm:
- Extension name shows as "Subtract"
- No errors in the Extensions page
- `chrome://extensions/shortcuts` shows both "Full screen capture" and "Select area to capture"

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: rename to Subtract, add capture-screenshot-manual command"
```

---

## Task 2: Rebuild panel.css

**Files:**
- Modify: `panel.css`

- [ ] **Step 1: Replace panel.css entirely**

```css
/* ── Reset ── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

/* ── Google Fonts ── */
@import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&family=DM+Sans:wght@400;500;600&display=swap');

/* ── Tokens ── */
:root {
  --paper:     #f8f5f0;
  --card-bg:   #fffdf9;
  --warm-gray: #e8e2da;
  --ink:       #1a1613;
  --muted:     #9a918a;
  --amber:     #c8713a;
  --sage:      #5a7a62;
  --slate:     #5a6b7a;
  --rose:      #b35a5a;
}

/* ── Base ── */
html, body {
  height: 100%;
  background: var(--paper);
  color: var(--ink);
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

/* Subtle paper texture */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 0;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  position: relative;
  z-index: 1;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--warm-gray);
  position: sticky;
  top: 0;
  z-index: 10;
  animation: fadeUp 0.4s ease both;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-logo-text {
  font-family: 'Newsreader', serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.4px;
}

.header-actions { display: flex; gap: 4px; }

.btn-icon {
  width: 28px; height: 28px;
  border: 1px solid var(--warm-gray);
  border-radius: 5px;
  background: var(--paper);
  color: var(--muted);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  padding: 0;
}
.btn-icon:hover { color: var(--ink); border-color: rgba(26,22,19,0.3); }
.btn-icon.btn-danger:hover { color: var(--rose); border-color: var(--rose); }

/* ── Panel section header (static, not generated by panel.js) ── */
.panel-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 10px;
  animation: fadeUp 0.4s ease 0.1s both;
}

.panel-section-title {
  font-family: 'Newsreader', serif;
  font-size: 14px;
  font-style: italic;
  color: var(--muted);
  white-space: nowrap;
}

.panel-section-line {
  flex: 1;
  height: 1px;
  background: var(--warm-gray);
}

.panel-section-count {
  font-size: 11px;
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0.5px;
}

/* ── Empty state ── */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 48px 24px;
  text-align: center;
  animation: fadeUp 0.5s ease 0.2s both;
}

.empty-icon {
  width: 44px; height: 44px;
  background: rgba(90,122,98,0.08);
  border: 1px solid rgba(90,122,98,0.2);
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}

.empty-title {
  font-family: 'Newsreader', serif;
  font-size: 16px;
  font-style: italic;
  color: var(--ink);
}

.empty-hint {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.8;
}

.empty-hint kbd {
  background: var(--card-bg);
  border: 1px solid var(--warm-gray);
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
  color: var(--ink);
}

/* ── Records list container ── */
#recordsList {
  padding: 0 12px 12px;
}

/* ── Record card ── */
.record-card {
  background: var(--card-bg);
  border: 1px solid var(--warm-gray);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
  border-top: 3px solid var(--warm-gray);
  transition: box-shadow 0.2s ease;
  animation: fadeUp 0.35s ease both;
}

.record-card.done   { border-top-color: var(--amber); }
.record-card.error  { border-top-color: var(--rose); }

.record-card:hover { box-shadow: 0 2px 12px rgba(26,22,19,0.06); }

/* ── Record header ── */
.record-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
}

.thumb {
  width: 64px; height: 38px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  background: var(--warm-gray);
}

.thumb-placeholder {
  width: 64px; height: 38px;
  border-radius: 4px;
  background: var(--warm-gray);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-size: 18px;
  opacity: 0.5;
}

.record-meta { flex: 1; min-width: 0; }

.record-time {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 2px;
}

.record-tab {
  font-size: 12px;
  color: var(--ink);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-status {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  flex-shrink: 0;
  letter-spacing: 0.2px;
}

.record-status.loading { background: rgba(200,113,58,0.1); color: var(--amber); }
.record-status.done    { background: rgba(90,122,98,0.1);  color: var(--sage); }
.record-status.error   { background: rgba(179,90,90,0.08); color: var(--rose); }

.chevron {
  color: var(--muted);
  font-size: 10px;
  margin-left: 2px;
  transition: transform 0.2s;
  flex-shrink: 0;
}

.record-card.expanded .chevron { transform: rotate(180deg); }

/* ── Record body (expandable) ── */
.record-body {
  display: none;
  padding: 0 12px 12px;
}

.record-card.expanded .record-body { display: block; }

.screenshot {
  width: 100%;
  border-radius: 5px;
  margin-bottom: 10px;
  cursor: pointer;
  display: block;
}

/* ── Section title (generated by panel.js inside cards) ── */
.section-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  margin: 10px 0 6px;
}

/* ── Dialogues ── */
.dialogue-item {
  background: var(--paper);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 5px;
  border-left: 2px solid var(--amber);
}

.dialogue-en { font-size: 12px; color: var(--ink); margin-bottom: 2px; }
.dialogue-zh { font-size: 11px; color: var(--muted); }

/* ── Vocabulary ── */
.vocab-item {
  background: var(--paper);
  border-radius: 6px;
  padding: 8px 10px;
  margin-bottom: 5px;
  border-left: 2px solid var(--sage);
}

.vocab-word    { font-size: 12px; font-weight: 600; color: var(--slate); margin-bottom: 2px; }
.vocab-meaning { font-size: 12px; color: var(--ink); }
.vocab-note    { font-size: 11px; color: var(--muted); font-style: italic; margin-top: 2px; }

/* ── Scene ── */
.scene-box {
  background: var(--paper);
  border-radius: 6px;
  padding: 8px 10px;
  color: var(--muted);
  font-size: 12px;
  border-left: 2px solid var(--warm-gray);
  font-style: italic;
}

/* ── Raw fallback ── */
.raw-box {
  background: var(--paper);
  border-radius: 6px;
  padding: 10px;
  color: var(--ink);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

/* ── Error ── */
.error-box {
  background: rgba(179,90,90,0.06);
  border-radius: 6px;
  padding: 10px;
  color: var(--rose);
  font-size: 12px;
  border-left: 2px solid var(--rose);
}

/* ── Spinner ── */
@keyframes spin { to { transform: rotate(360deg); } }

.spinner {
  width: 14px; height: 14px;
  border: 2px solid var(--warm-gray);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
  flex-shrink: 0;
}

.loading-row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  padding: 10px 0;
  font-size: 12px;
}

/* ── Delete button ── */
.btn-delete {
  display: inline-block;
  margin-top: 10px;
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--warm-gray);
  color: var(--muted);
  border-radius: 5px;
  cursor: pointer;
  font-size: 11px;
  font-family: 'DM Sans', sans-serif;
  transition: all 0.15s;
}
.btn-delete:hover { border-color: var(--rose); color: var(--rose); }

/* ── Lightbox ── */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(26,22,19,0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  cursor: zoom-out;
}

.lightbox img {
  max-width: 95vw;
  max-height: 95vh;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}

/* ── Utilities ── */
.hidden { display: none !important; }

/* ── Animations ── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Verify**

Reload the extension. Open the side panel. Confirm it renders without console errors. The panel will look broken until Task 3 updates the HTML — that's expected.

- [ ] **Step 3: Commit**

```bash
git add panel.css
git commit -m "feat: rebuild panel.css with Subtract warm paper theme"
```

---

## Task 3: Update panel.html

**Files:**
- Modify: `panel.html`

- [ ] **Step 1: Replace panel.html**

The SVG logo is a 22×22 dark rounded square with a monitor outline, amber subtitle bar, and extraction arrow. All existing IDs (`#emptyState`, `#recordsList`, `#exportBtn`, `#clearBtn`) are preserved.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Subtract</title>
  <link rel="stylesheet" href="panel.css">
</head>
<body>
  <div id="app">

    <!-- Header -->
    <div class="header">
      <div class="header-logo">
        <svg width="22" height="22" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="52" height="52" rx="10" fill="#1a1613"/>
          <rect x="8" y="10" width="36" height="22" rx="2.5" stroke="#f8f5f0" stroke-width="2.5" fill="none"/>
          <rect x="14" y="22" width="14" height="3" rx="1.5" fill="#c8713a"/>
          <line x1="26" y1="32" x2="26" y2="41" stroke="#f8f5f0" stroke-width="2.2" stroke-linecap="round"/>
          <polyline points="22,38 26,42 30,38" fill="none" stroke="#f8f5f0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="header-logo-text">Subtract</span>
      </div>
      <div class="header-actions">
        <button id="exportBtn" title="Export as JSON" class="btn-icon">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button id="clearBtn" title="Clear all records" class="btn-icon btn-danger">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div id="emptyState" class="empty-state hidden">
      <div class="empty-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5a7a62" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div class="empty-title">No captures yet</div>
      <div class="empty-hint">
        Press <kbd>⌘⇧E</kbd> to capture full screen<br>
        or <kbd>⌘⇧S</kbd> to select an area
      </div>
    </div>

    <!-- Records list -->
    <div id="recordsList"></div>

  </div>
  <script src="panel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify in Chrome**

Reload the extension. Open the side panel:
- Header shows SVG logo + "Subtract" wordmark + two icon buttons
- Empty state shows monitor icon, "No captures yet", and two shortcut hints
- Press `⌘⇧E` (or `Ctrl+Shift+E`) — record appears with warm card styling
- Thumbnail, status badge, expand/collapse all work normally

- [ ] **Step 3: Commit**

```bash
git add panel.html
git commit -m "feat: rebuild panel.html with Subtract branding and new header"
```

---

## Task 4: Rebuild popup.html

**Files:**
- Modify: `popup.html`

All existing IDs from popup.js are preserved exactly. The Shortcuts tab adds a static display for the manual shortcut (no recorder needed — `⌘⇧S` is set in manifest and adjustable via `chrome://extensions/shortcuts`).

- [ ] **Step 1: Replace popup.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Subtract</title>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,600&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --paper:     #f8f5f0;
      --card-bg:   #fffdf9;
      --warm-gray: #e8e2da;
      --ink:       #1a1613;
      --muted:     #9a918a;
      --amber:     #c8713a;
      --sage:      #5a7a62;
      --rose:      #b35a5a;
    }

    body {
      width: 370px;
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--paper);
      color: var(--ink);
      font-size: 13px;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 16px 12px;
      background: var(--card-bg);
      border-bottom: 1px solid var(--warm-gray);
    }

    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-text {
      font-family: 'Newsreader', serif;
      font-size: 16px;
      font-weight: 600;
      color: var(--ink);
      letter-spacing: -0.4px;
    }

    .open-panel-btn {
      padding: 5px 12px;
      background: var(--paper);
      border: 1px solid var(--warm-gray);
      border-radius: 6px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.15s;
    }
    .open-panel-btn:hover { color: var(--ink); border-color: rgba(26,22,19,0.3); }

    /* ── Tabs ── */
    .tabs {
      display: flex;
      background: var(--card-bg);
      border-bottom: 1px solid var(--warm-gray);
      padding: 0 8px;
    }

    .tab {
      padding: 9px 12px 8px;
      border: none;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: color 0.15s;
      white-space: nowrap;
    }
    .tab:hover { color: var(--ink); }
    .tab.active { color: var(--amber); border-bottom-color: var(--amber); }

    /* ── Panels ── */
    .panel { display: none; padding: 16px; }
    .panel.active { display: block; }

    /* ── Fields ── */
    .field { margin-bottom: 16px; }
    .field:last-child { margin-bottom: 0; }

    label, .field-label {
      display: block;
      font-size: 10px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }

    .field-desc {
      font-size: 11px;
      color: #b8aea6;
      margin-top: 5px;
      line-height: 1.5;
    }

    input[type=text],
    input[type=password],
    select {
      width: 100%;
      padding: 8px 10px;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray);
      border-radius: 7px;
      color: var(--ink);
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      transition: border-color 0.15s;
      appearance: none;
    }
    input:focus, select:focus { border-color: var(--amber); }

    /* ── API key wrap ── */
    .api-key-wrap { position: relative; }
    .api-key-wrap input { padding-right: 36px; }
    .toggle-eye {
      position: absolute; right: 10px; top: 50%;
      transform: translateY(-50%);
      background: none; border: none;
      color: var(--muted); cursor: pointer; font-size: 14px; padding: 0;
    }

    /* ── Tip box ── */
    .tip-box {
      padding: 9px 11px;
      background: var(--card-bg);
      border-radius: 7px;
      font-size: 12px;
      color: var(--muted);
      line-height: 1.6;
      border-left: 3px solid var(--warm-gray);
      margin-top: 10px;
    }
    .tip-box a { color: var(--amber); text-decoration: none; }
    .tip-box a:hover { text-decoration: underline; }

    /* ── Segmented control ── */
    .seg-ctrl {
      display: flex;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray);
      border-radius: 7px;
      padding: 3px;
      gap: 2px;
    }
    .seg-btn {
      flex: 1;
      padding: 5px 8px;
      border: none; border-radius: 5px;
      background: transparent;
      color: var(--muted);
      font-size: 12px;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: all 0.15s;
      text-align: center;
    }
    .seg-btn.active { background: var(--ink); color: var(--paper); }
    .seg-btn:not(.active):hover { color: var(--ink); }

    /* ── Toggle row ── */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray);
      border-radius: 7px;
      cursor: pointer;
      user-select: none;
    }
    .toggle-row:hover { background: #faf7f2; }
    .toggle-row-text { flex: 1; }
    .toggle-row-title { font-size: 13px; color: var(--ink); }
    .toggle-row-sub { font-size: 11px; color: var(--muted); margin-top: 2px; }

    .switch { position: relative; width: 34px; height: 18px; flex-shrink: 0; margin-left: 12px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .slider {
      position: absolute; inset: 0;
      background: var(--warm-gray); border-radius: 20px;
      transition: background 0.2s;
    }
    .slider::before {
      content: '';
      position: absolute;
      width: 12px; height: 12px;
      left: 3px; top: 3px;
      background: white; border-radius: 50%;
      transition: transform 0.2s;
    }
    .switch input:checked + .slider { background: var(--amber); }
    .switch input:checked + .slider::before { transform: translateX(16px); }

    /* ── Range ── */
    .range-row { display: flex; align-items: center; gap: 10px; }
    input[type=range] {
      flex: 1;
      -webkit-appearance: none;
      height: 3px;
      background: var(--warm-gray);
      border-radius: 2px;
      outline: none;
      padding: 0;
      border: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 14px; height: 14px;
      background: var(--amber);
      border-radius: 50%;
      cursor: pointer;
    }
    .range-val { font-size: 12px; color: var(--muted); min-width: 32px; text-align: right; }

    /* ── Shortcut display ── */
    .shortcut-display {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray);
      border-radius: 7px;
      flex-wrap: wrap;
    }
    .shortcut-keys { flex: 1; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

    kbd {
      display: inline-block;
      background: var(--paper);
      border: 1px solid var(--warm-gray);
      border-radius: 4px;
      padding: 2px 7px;
      font-family: monospace;
      font-size: 11px;
      color: var(--ink);
      line-height: 1.6;
    }
    .key-sep { color: var(--muted); font-size: 12px; }

    .btn-modify {
      padding: 4px 10px;
      background: var(--paper);
      border: 1px solid var(--warm-gray);
      border-radius: 5px;
      color: var(--muted);
      font-size: 11px;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .btn-modify:hover { border-color: var(--amber); color: var(--amber); }

    .capture-area {
      display: none;
      align-items: center;
      justify-content: center;
      padding: 14px 12px;
      background: var(--card-bg);
      border: 2px dashed var(--warm-gray);
      border-radius: 7px;
      outline: none;
      cursor: pointer;
      flex-direction: column;
      gap: 8px;
      transition: border-color 0.15s;
    }
    .capture-area:focus { border-color: var(--amber); }
    .capture-area.has-key { border-color: var(--sage); }
    .capture-hint { font-size: 12px; color: var(--muted); }
    .capture-keys { display: flex; align-items: center; gap: 4px; }

    .capture-actions { display: none; gap: 8px; margin-top: 8px; }
    .capture-actions.show { display: flex; }

    .btn-confirm {
      padding: 6px 14px;
      background: var(--ink);
      border: none; border-radius: 6px;
      color: var(--paper); font-size: 12px; font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer; transition: opacity 0.15s;
    }
    .btn-confirm:hover { opacity: 0.8; }

    .btn-cancel {
      padding: 6px 12px;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray); border-radius: 6px;
      color: var(--muted); font-size: 12px;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer; transition: all 0.15s;
    }
    .btn-cancel:hover { border-color: rgba(26,22,19,0.3); color: var(--ink); }

    .shortcut-error { font-size: 11px; color: var(--rose); margin-top: 6px; min-height: 16px; }

    .shortcut-note {
      font-size: 11px;
      color: var(--muted);
      line-height: 1.6;
      margin-top: 10px;
      padding: 8px 10px;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray);
      border-radius: 6px;
    }
    .shortcut-note strong { color: var(--ink); }

    /* Static shortcut display (no recorder) */
    .shortcut-static {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--card-bg);
      border: 1px solid var(--warm-gray);
      border-radius: 7px;
      margin-bottom: 8px;
    }
    .shortcut-static-info { flex: 1; }
    .shortcut-static-name { font-size: 13px; color: var(--ink); font-weight: 500; }
    .shortcut-static-desc { font-size: 11px; color: var(--muted); margin-top: 2px; }
    .shortcut-static-keys { display: flex; align-items: center; gap: 3px; }

    /* ── Save button ── */
    .btn-save {
      width: 100%;
      padding: 9px;
      background: var(--ink);
      color: var(--paper);
      border: none; border-radius: 7px;
      font-size: 13px; font-weight: 600;
      font-family: 'DM Sans', sans-serif;
      cursor: pointer;
      transition: opacity 0.15s;
      margin-top: 16px;
    }
    .btn-save:hover { opacity: 0.85; }

    /* ── Toast ── */
    .toast {
      padding: 7px 12px; border-radius: 7px;
      font-size: 12px; text-align: center;
      opacity: 0; transition: opacity 0.25s;
      margin-top: 10px;
    }
    .toast.show { opacity: 1; }
    .toast.success { background: rgba(90,122,98,0.12); color: var(--sage); }
    .toast.error   { background: rgba(179,90,90,0.08); color: var(--rose); }

    .divider { border: none; border-top: 1px solid var(--warm-gray); margin: 14px 0; }

    .tag-rec {
      display: inline-block;
      background: rgba(200,113,58,0.1);
      color: var(--amber);
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 4px;
      vertical-align: middle;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="logo">
      <svg width="22" height="22" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="52" height="52" rx="10" fill="#1a1613"/>
        <rect x="8" y="10" width="36" height="22" rx="2.5" stroke="#f8f5f0" stroke-width="2.5" fill="none"/>
        <rect x="14" y="22" width="14" height="3" rx="1.5" fill="#c8713a"/>
        <line x1="26" y1="32" x2="26" y2="41" stroke="#f8f5f0" stroke-width="2.2" stroke-linecap="round"/>
        <polyline points="22,38 26,42 30,38" fill="none" stroke="#f8f5f0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span class="logo-text">Subtract</span>
    </div>
    <button class="open-panel-btn" id="openPanelBtn">Open panel →</button>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" data-tab="api">API</button>
    <button class="tab" data-tab="shortcut">Shortcuts</button>
    <button class="tab" data-tab="screenshot">Screenshot</button>
    <button class="tab" data-tab="prefs">Prefs</button>
  </div>

  <!-- ── Tab: API ── -->
  <div class="panel active" id="tab-api">
    <div class="field">
      <label for="providerSelect">AI Provider</label>
      <select id="providerSelect">
        <option value="groq">⚡ Groq — Free · Fastest</option>
        <option value="openrouter">🔀 OpenRouter — Partially free</option>
        <option value="gemini">🔷 Google Gemini</option>
        <option value="claude">🟣 Anthropic Claude</option>
      </select>
    </div>

    <div class="tip-box" id="tipBox"></div>

    <div class="field" style="margin-top:14px">
      <label id="apiKeyLabel">API Key</label>
      <div class="api-key-wrap">
        <input type="password" id="apiKey" placeholder="" autocomplete="off">
        <button class="toggle-eye" id="toggleEye" type="button">👁</button>
      </div>
    </div>

    <div class="field">
      <label>Model</label>
      <select id="model"></select>
    </div>

    <button class="btn-save" id="saveApiBtn">Save API settings</button>
    <div class="toast" id="toastApi"></div>
  </div>

  <!-- ── Tab: Shortcuts ── -->
  <div class="panel" id="tab-shortcut">

    <!-- Full screen shortcut (editable via recorder) -->
    <div class="field">
      <div class="field-label">Full screen capture</div>

      <div class="shortcut-display" id="shortcutDisplay">
        <div class="shortcut-keys" id="shortcutKeys">Loading…</div>
        <button class="btn-modify" id="modifyBtn">Edit</button>
      </div>

      <div class="capture-area" id="captureArea" tabindex="0">
        <div class="capture-hint" id="captureHint">Click here, then press a new shortcut</div>
        <div class="capture-keys" id="captureKeys"></div>
      </div>

      <div class="capture-actions" id="captureActions">
        <button class="btn-confirm" id="confirmShortcutBtn">Save</button>
        <button class="btn-cancel"  id="cancelShortcutBtn">Cancel</button>
        <button class="btn-cancel"  id="resetShortcutBtn">Reset default</button>
      </div>

      <div class="shortcut-error" id="shortcutError"></div>
    </div>

    <!-- Area selection shortcut (static display) -->
    <div class="field">
      <div class="field-label">Area selection capture <span class="tag-rec">new</span></div>
      <div class="shortcut-static">
        <div class="shortcut-static-info">
          <div class="shortcut-static-name">Draw a selection on screen</div>
          <div class="shortcut-static-desc">Default: ⌘⇧S / Ctrl+Shift+S</div>
        </div>
        <div class="shortcut-static-keys">
          <kbd>⌘</kbd><span class="key-sep">+</span><kbd>⇧</kbd><span class="key-sep">+</span><kbd>S</kbd>
        </div>
      </div>
      <div class="field-desc">To change this shortcut, visit <strong>chrome://extensions/shortcuts</strong></div>
    </div>

    <div class="shortcut-note">
      <strong>Modifier keys:</strong> Ctrl, Alt, Shift (Ctrl = ⌘ on Mac)<br>
      <strong>Trigger key:</strong> Letter, number, F1–F12, arrow keys<br>
      <strong>Default full-screen:</strong> Ctrl+Shift+E
    </div>
  </div>

  <!-- ── Tab: Screenshot ── -->
  <div class="panel" id="tab-screenshot">
    <div class="field">
      <div class="field-label">Format</div>
      <div class="seg-ctrl" id="fmtCtrl">
        <button class="seg-btn active" data-val="jpeg">JPEG <span class="tag-rec">rec</span></button>
        <button class="seg-btn" data-val="png">PNG (lossless)</button>
      </div>
      <div class="field-desc">JPEG is smaller; PNG preserves full quality</div>
    </div>

    <div class="field" id="qualityField">
      <div class="field-label">JPEG quality</div>
      <div class="range-row">
        <input type="range" id="qualityRange" min="50" max="100" step="5" value="85">
        <span class="range-val" id="qualityVal">85%</span>
      </div>
      <div class="field-desc">Higher = better quality, larger file</div>
    </div>

    <div class="field">
      <label class="toggle-row" for="autoOpenToggle">
        <div class="toggle-row-text">
          <div class="toggle-row-title">Auto-open panel</div>
          <div class="toggle-row-sub">Show side panel after each capture</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="autoOpenToggle" checked>
          <span class="slider"></span>
        </label>
      </label>
    </div>

    <button class="btn-save" id="saveScreenshotBtn">Save screenshot settings</button>
    <div class="toast" id="toastScreenshot"></div>
  </div>

  <!-- ── Tab: Prefs ── -->
  <div class="panel" id="tab-prefs">
    <div class="field">
      <div class="field-label">Explanation language</div>
      <div class="seg-ctrl" id="langCtrl">
        <button class="seg-btn active" data-val="chinese">中文 <span class="tag-rec">rec</span></button>
        <button class="seg-btn" data-val="bilingual">双语</button>
        <button class="seg-btn" data-val="english">English</button>
      </div>
      <div class="field-desc">Controls vocabulary and dialogue translation language</div>
    </div>

    <div class="field">
      <div class="field-label">Analysis depth</div>
      <div class="seg-ctrl" id="detailCtrl">
        <button class="seg-btn active" data-val="normal">Standard</button>
        <button class="seg-btn" data-val="detailed">Detailed (+ grammar)</button>
        <button class="seg-btn" data-val="concise">Concise</button>
      </div>
      <div class="field-desc">Detailed mode adds grammar analysis (slower)</div>
    </div>

    <div class="field">
      <label>Max records kept</label>
      <select id="maxRecords">
        <option value="50">Last 50</option>
        <option value="100" selected>Last 100</option>
        <option value="200">Last 200</option>
        <option value="0">Unlimited</option>
      </select>
      <div class="field-desc">Oldest records are removed when limit is exceeded</div>
    </div>

    <button class="btn-save" id="savePrefsBtn">Save preferences</button>
    <div class="toast" id="toastPrefs"></div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify in Chrome**

Click the extension icon. Confirm:
- Header shows SVG logo + "Subtract" + "Open panel →"
- All 4 tabs switch correctly
- API tab: provider dropdown, key input, model select all work
- Shortcuts tab: full-screen recorder works (Edit → press keys → Save); static area selection display shows `⌘⇧S`
- Screenshot tab: format toggle, quality slider, auto-open toggle all work; Save persists correctly
- Prefs tab: language, depth, max records all save correctly

- [ ] **Step 3: Commit**

```bash
git add popup.html
git commit -m "feat: rebuild popup.html with Subtract warm paper theme"
```

---

## Task 5: Create selector.js

**Files:**
- Create: `selector.js`

- [ ] **Step 1: Create selector.js**

```js
// selector.js — injected on demand for manual area selection
// Sent from background.js via chrome.scripting.executeScript({ files: ['selector.js'] })

(function () {
  // Prevent double injection if triggered twice in quick succession
  if (document.getElementById('__subtract-selector__')) return;

  const overlay = document.createElement('div');
  overlay.id = '__subtract-selector__';

  Object.assign(overlay.style, {
    position:   'fixed',
    inset:      '0',
    zIndex:     '2147483647',
    cursor:     'crosshair',
    background: 'rgba(0,0,0,0.38)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  });

  // Selection rectangle
  const box = document.createElement('div');
  Object.assign(box.style, {
    position:   'fixed',
    border:     '2px solid #c8713a',
    background: 'rgba(200,113,58,0.08)',
    display:    'none',
    pointerEvents: 'none',
    boxSizing:  'border-box',
  });
  overlay.appendChild(box);

  // Hint label
  const hint = document.createElement('div');
  Object.assign(hint.style, {
    position:   'fixed',
    top:        '16px',
    left:       '50%',
    transform:  'translateX(-50%)',
    background: 'rgba(26,22,19,0.82)',
    color:      '#f8f5f0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize:   '13px',
    padding:    '7px 16px',
    borderRadius: '20px',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    zIndex:     '1',
  });
  hint.textContent = 'Drag to select area · Esc to cancel';
  overlay.appendChild(hint);

  let startX = 0, startY = 0, isDragging = false;

  overlay.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    Object.assign(box.style, {
      display: 'block',
      left:    startX + 'px',
      top:     startY + 'px',
      width:   '0',
      height:  '0',
    });
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    Object.assign(box.style, {
      left:   x + 'px',
      top:    y + 'px',
      width:  w + 'px',
      height: h + 'px',
    });
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    cleanup();

    // Ignore tiny accidental clicks
    if (w < 10 || h < 10) {
      chrome.runtime.sendMessage({ type: 'subtract-selection-cancelled' });
      return;
    }

    chrome.runtime.sendMessage({
      type: 'subtract-selection-rect',
      rect: { x, y, width: w, height: h },
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  });

  function onKeydown(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'subtract-selection-cancelled' });
    }
  }

  function cleanup() {
    overlay.remove();
    document.removeEventListener('keydown', onKeydown);
  }

  document.addEventListener('keydown', onKeydown);
  document.documentElement.appendChild(overlay);
})();
```

- [ ] **Step 2: Verify manually**

In background.js temporarily add after the `isCapturing = false` reset:
```js
// TEMP TEST — remove after verification
chrome.scripting.executeScript({ target: { tabId: (await chrome.tabs.query({active:true,currentWindow:true}))[0].id }, files: ['selector.js'] });
```
Reload extension, press `⌘⇧E`. Confirm:
- Dark overlay appears over the page
- "Drag to select area · Esc to cancel" hint shows
- Dragging creates an amber-bordered rectangle
- Esc dismisses the overlay

Remove the temp test code after verification.

- [ ] **Step 3: Commit**

```bash
git add selector.js
git commit -m "feat: add selector.js content script for area selection overlay"
```

---

## Task 6: Update background.js — manual capture command

**Files:**
- Modify: `background.js`

The refactor extracts `analyzeAndStore(tab, screenshotDataUrl, recordId, settings)` so both full-screen and manual paths share the AI + storage logic. The full-screen `captureAndAnalyze()` is unchanged except for delegating its final steps to the new helper.

- [ ] **Step 1: Replace background.js**

Replace the **entire** `background.js` with the following. The AI provider functions (analyzeWithGroq, analyzeWithGemini, analyzeWithOpenRouter, analyzeWithClaude), buildPrompt, and parseAnalysis are copied verbatim — they are NOT modified.

```js
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

// ── Prompt builder ──────────────────────────────────────────────

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

// ── Google Gemini ───────────────────────────────────────────────

async function analyzeWithGemini(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: prompt },
      ]}],
      generationConfig: { maxOutputTokens: 2048 },
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  return parseAnalysis(data.candidates?.[0]?.content?.parts?.[0]?.text || '');
}

// ── Anthropic Claude ────────────────────────────────────────────

async function analyzeWithClaude(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
        { type: 'text', text: prompt },
      ]}],
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  return parseAnalysis((await resp.json()).content[0].text);
}

// ── Groq ────────────────────────────────────────────────────────

async function analyzeWithGroq(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ]}],
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  return parseAnalysis((await resp.json()).choices?.[0]?.message?.content || '');
}

// ── OpenRouter ──────────────────────────────────────────────────

async function analyzeWithOpenRouter(screenshotUrl, apiKey, model, prompt) {
  const base64   = screenshotUrl.split(',')[1];
  const mimeType = screenshotUrl.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png';

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        { type: 'text', text: prompt },
      ]}],
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { msg = (await resp.json()).error?.message || msg; } catch (_) {}
    throw new Error(msg);
  }

  return parseAnalysis((await resp.json()).choices?.[0]?.message?.content || '');
}
```

- [ ] **Step 2: Verify full-screen capture still works**

Reload extension. Press `⌘⇧E` (or `Ctrl+Shift+E`) on any web page with video/subtitles.
Expected: screenshot appears in side panel, AI analysis runs, result displays with amber/sage styling.

- [ ] **Step 3: Verify manual capture**

Press `⌘⇧S` (or `Ctrl+Shift+S`) on any page.
Expected:
1. Dark overlay appears with "Drag to select area · Esc to cancel" hint
2. Dragging draws an amber-outlined selection box
3. Releasing the mouse dismisses the overlay
4. A record appears in the panel with the cropped screenshot
5. AI analysis runs on the cropped area
6. Pressing Esc during selection cancels gracefully (no record created — the pending record is already created, but it will show error if cancelled. Actually the record is created AFTER selection, so cancellation means no record at all.)

- [ ] **Step 4: Commit**

```bash
git add background.js
git commit -m "feat: add manual area selection capture, refactor captureAndAnalyze"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Covered by |
|---|---|
| Rename to "Subtract" | Task 1 (manifest), Tasks 3+4 (HTML) |
| TAB-OUT warm palette | Task 2 (panel.css), Task 4 (popup.html) |
| SVG logo (screen + extraction arrow) | Tasks 3+4 |
| Newsreader + DM Sans typography | Tasks 2+4 |
| Second shortcut `⌘⇧S` | Task 1 (manifest command), Task 4 (Shortcuts tab display) |
| Manual area selection overlay | Task 5 (selector.js) |
| Canvas crop in content script | Task 6 (cropScreenshot function) |
| Keep panel.js intact | ✓ No changes to panel.js |
| Keep popup.js intact | ✓ No changes to popup.js |
| Keep AI provider code | ✓ Copied verbatim in Task 6 |
| Badge color updated to amber/sage | Task 6 (setBadgeBackgroundColor) |
| Page toast redesigned (warm light) | Task 6 (showPageToast) |

**No placeholders** — all code blocks are complete and ready to copy-paste.

**Type/name consistency** — `createPendingRecord`, `analyzeAndStore`, `loadSettings`, `cropScreenshot`, `captureFullScreen`, `captureManual` are used consistently across Task 6.
