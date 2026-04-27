# Subtract v2 — Shortcuts Simplification, Floating Button, Export Redesign

**Date:** 2026-04-27
**Branch:** claude/english-screenshot-recorder-ENXKF

---

## Overview

Three independent features added on top of the existing Subtract redesign:

1. **Shortcuts tab simplification** — remove in-popup recorder, replace with a link to `chrome://extensions/shortcuts`
2. **Floating button** — always-on-screen overlay for click-to-capture without keyboard
3. **Export redesign** — format choice (JSON/Markdown) + granular content selection

---

## Feature 1: Shortcuts Tab Simplification

### What changes

**popup.js:** Remove all shortcut-recorder logic (~100 lines):
- `shortcutKeysEl`, `modifyBtn`, `captureArea`, `captureHint`, `captureKeysEl`, `captureActions`, `confirmShortcut`, `cancelShortcut`, `resetShortcut`, `shortcutError` references
- `renderKeys()`, `loadCurrentShortcut()`, `startRecording()`, `stopRecording()` functions
- All `keydown` recorder listeners
- Replace with a single button handler: `chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })`

**popup.html:** Replace the Shortcuts tab body entirely:
- Two static rows (read-only display, no Edit button):
  - Full Screen Capture · `⌘⇧E` / `Ctrl+Shift+E`
  - Area Selection · `⌘⇧S` / `Ctrl+Shift+S`
- One full-width button: **"Customize shortcuts →"**
- One hint line: *"Chrome requires shortcuts to be set in the system extensions page"*

### IDs removed from popup.js (no longer needed)
`shortcutKeys` `modifyBtn` `captureArea` `captureHint` `captureKeys` `captureActions`
`confirmShortcutBtn` `cancelShortcutBtn` `resetShortcutBtn` `shortcutError`

### New element needed in popup.html
`#openShortcutsBtn` — the "Customize shortcuts →" button

---

## Feature 2: Floating Button (floater.js)

### Architecture

New file `floater.js` declared as a `content_script` in `manifest.json` matching `<all_urls>`. Runs on every page load. Reads `floaterEnabled` from `chrome.storage.local` on init; if `false`, exits without rendering anything.

### Visual design

- **Resting state:** 36×36px circle, `rgba(26,22,19,0.72)` background, centered Subtract logo SVG (white, 16px), fixed bottom-right corner (20px from edges), `z-index: 2147483646` (one below selector overlay)
- **Hover state:** expands upward; two 32×32px circular icon buttons appear above:
  - Top: area-select icon (✂ scissors / dashed square)
  - Bottom: full-screen icon (monitor / expand arrows)
  - Main button stays visible as anchor
- **Loading state:** amber spinner ring replaces logo
- **Done state:** sage checkmark for 2s, then reverts to logo
- **Error state:** rose X for 2s, then reverts to logo

### Dragging

Mouse drag on the main button repositions it. Position saved as `{floaterX, floaterY}` in `chrome.storage.local` (in px from right/bottom edges to stay stable on window resize). On load, restored from storage; defaults to 20/20.

### Hiding during area selection

When user clicks "Area select" button:
1. floater hides itself (`display: none`)
2. Sends `{type: 'subtract-float-capture', mode: 'area'}` to background
3. Background injects `selector.js`
4. Background sends `{type: 'subtract-float-restore'}` to the tab after selection completes (success or cancel)
5. floater.js listens for `subtract-float-restore` → restores display

### Message protocol

**floater → background:**
```js
{ type: 'subtract-float-capture', mode: 'full' | 'area' }
```

**background → floater (after capture):**
```js
{ type: 'subtract-float-status', status: 'loading' | 'done' | 'error' }
{ type: 'subtract-float-restore' }  // after area selection ends
```

### background.js changes

Add `chrome.runtime.onMessage` listener:
```js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== 'subtract-float-capture') return;
  handleFloatCapture(msg.mode, sender.tab);
  return false;
});
```

`handleFloatCapture(mode, tab)`:
- Sets `isCapturing` guard
- Sends `subtract-float-status: loading` to tab
- Calls `captureFullScreen(tab)` or `captureManual(tab)` (refactor to accept optional tab arg)
- On complete: sends `subtract-float-status: done/error` to tab

### Popup settings

In `tab-prefs` panel, add a new toggle row:
- Label: "Floating capture button"
- Sub: "Show on all pages for click-to-capture"
- Toggle: `#floaterToggle` (checkbox)
- Saves `floaterEnabled` to storage

`popup.js` adds save/load for `floaterEnabled` alongside existing prefs.

### manifest.json changes

```json
"content_scripts": [
  {
    "matches": ["<all_urls>"],
    "js": ["floater.js"],
    "run_at": "document_idle"
  }
]
```

---

## Feature 3: Export Redesign

### Trigger

Click `#exportBtn` → shows an export modal overlay inside the panel (does NOT immediately download).

### Modal design

A modal centered over the panel content (dark overlay behind). Structure:

```
┌─────────────────────────────┐
│  Export records             │
│                             │
│  Format                     │
│  [ JSON ]  [ Markdown ]     │
│                             │
│  Include                    │
│  ☑ Time                    │
│  ☑ Source                  │
│  ☑ Dialogues               │
│  ☑ Vocabulary              │
│    ☑ Vocab notes  (indent) │
│  ☑ Scene                   │
│  ☐ Screenshot              │
│                             │
│  [ Cancel ]  [ Export → ]  │
└─────────────────────────────┘
```

"Vocab notes" is indented under Vocabulary and is greyed out + auto-unchecked when Vocabulary is unchecked.

### Settings persistence

`exportPrefs` saved to `chrome.storage.local`:
```js
{
  format: 'json' | 'markdown',       // default: 'json'
  includeTime: true,
  includeSource: true,
  includeDialogues: true,
  includeVocabulary: true,
  includeVocabNotes: true,
  includeScene: true,
  includeScreenshot: false,
}
```

Loaded when modal opens; saved on every Export click.

### JSON export format

Each record becomes:
```json
{
  "time": "2026-04-27T14:32:00.000Z",       // if includeTime
  "source": "Breaking Bad S02E03",           // if includeSource
  "dialogues": [...],                        // if includeDialogues
  "vocabulary": [                            // if includeVocabulary
    { "word": "...", "meaning": "..." }      // note omitted if !includeVocabNotes
  ],
  "scene": "...",                            // if includeScene
  "screenshot": "data:image/jpeg;base64,..."// if includeScreenshot
}
```

### Markdown export format (Notion-compatible)

```markdown
# Subtract Export — 2026-04-27

---

## Breaking Bad S02E03 · 2026-04-27 14:32

### Dialogues
- "I am the one who knocks." → 我才是那个敲门的人。

### Vocabulary
- **hang out** — 闲逛；出去玩 *(常用于口语)*
- **pull off** — 成功做到某事

### Scene
*Walter confronts Skyler in the kitchen...*

---
```

- `**word** — meaning *(note)*` format for vocab (note omitted if unchecked)
- Screenshot not included in MD (ignored even if checked)
- File name: `subtract-export-2026-04-27.md`

### panel.js changes

- `exportBtn` click → `openExportModal()` instead of direct download
- New functions: `openExportModal()`, `buildExportData(records, prefs)`, `buildMarkdown(records, prefs)`, `doExport(records, prefs)`
- Modal rendered as a DOM element appended to `#app`, removed on Cancel/Export

### panel.html changes

No structural changes needed — modal is created dynamically by panel.js. CSS for modal added to `panel.css`.

---

## Files Changed Summary

| File | Feature | Change type |
|------|---------|-------------|
| `popup.html` | 1, 2 | Modify: simplify Shortcuts tab, add floater toggle in Prefs |
| `popup.js` | 1, 2 | Modify: remove recorder, add shortcut link, add floaterEnabled save/load |
| `manifest.json` | 2 | Modify: add content_scripts entry for floater.js |
| `floater.js` | 2 | Create: floating button content script |
| `background.js` | 2 | Modify: add onMessage listener for float-capture, send status back |
| `panel.css` | 3 | Modify: add export modal styles |
| `panel.js` | 3 | Modify: replace direct export with modal + format/content selection |

---

## What Does NOT Change

- `selector.js` — unchanged
- `panel.html` — unchanged (modal is DOM-injected by panel.js)
- All AI provider functions in `background.js`
- All Chrome storage keys for existing data (`records`, `apiKey`, `provider`, etc.)
- Panel card rendering, lightbox, delete logic in `panel.js`
