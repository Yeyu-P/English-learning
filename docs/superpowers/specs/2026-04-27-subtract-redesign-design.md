# Subtract — Redesign & Area Selection Design Spec

**Date:** 2026-04-27
**Branch:** claude/english-screenshot-recorder-ENXKF

---

## Overview

Rebrand the extension from "美剧英语助手" to **Subtract** (subt = subtitle, tract = extract). Redesign the UI to match the editorial aesthetic of TAB-OUT (warm paper palette, Newsreader + DM Sans typography). Add a second shortcut for manual area selection in addition to the existing full-screen capture.

---

## Decisions Made

| Topic | Decision |
|---|---|
| Name | Subtract |
| Theme | Warm light (TAB-OUT style) — `#f8f5f0` paper, `#1a1613` ink |
| Logo | Screen + extraction arrow (SVG, dark rounded square) |
| Screenshot modes | Two shortcuts: full-screen (existing) + area selection (new) |
| Refactor approach | Keep all JS logic intact; rebuild HTML + CSS only |

---

## Visual Design

### Color Palette

```
--paper:      #f8f5f0   background
--card-bg:    #fffdf9   card surfaces
--warm-gray:  #e8e2da   borders, dividers
--ink:        #1a1613   primary text
--muted:      #9a918a   secondary text, labels
--amber:      #c8713a   primary accent (status done, tab active)
--sage:       #5a7a62   secondary accent (vocab, success)
--slate:      #5a6b7a   word color in vocab
--rose:       #b35a5a   danger/delete
```

### Typography

- **Headings / section labels:** Newsreader (serif, italic for labels)
- **Body / UI elements:** DM Sans
- Both loaded from Google Fonts

### Logo (SVG)

Dark rounded square (`#1a1613`, rx=10) containing:
- Monitor outline (white stroke)
- Amber highlighted subtitle bar (middle line)
- Down-arrow extraction indicator (white)

Used at 22×22px in headers.

---

## Files to Change

### `manifest.json`
- `name`: "Subtract"
- `description`: "Capture subtitles from any video. Extract English with AI."
- Add second command `capture-screenshot-manual` with suggested key `Ctrl+Shift+S` / `Command+Shift+S`

### `panel.html` + `panel.css`
Full rebuild. Structure:
- **Header:** Logo SVG + "Subtract" wordmark · export icon btn · clear icon btn
- **Section header:** italic Newsreader "Recent captures" + horizontal rule + count
- **Record cards:** white card, 1px warm-gray border, **3px top colored border** (amber=done, warm-gray=loading/pending), expandable body
- **Card body:** screenshot image, Dialogue section (amber left border), Vocabulary section (sage left border), Scene section, Delete button
- **Empty state:** sage circle icon, italic serif title, two kbd hints showing both shortcuts

### `popup.html`
Full rebuild. Structure:
- **Header:** Logo + "Subtract" wordmark · "Open panel →" button
- **4 tabs:** API · Shortcuts · Screenshot · Prefs
  - Tab active color: amber `#c8713a`
- **API tab:** Provider select, tip box, API key (with eye toggle), Model select, Save button
- **Shortcuts tab:** Two shortcut rows (Full screen capture + Area selection), each with key display and Edit button
- **Screenshot tab:** Format seg-ctrl, JPEG quality slider, auto-open toggle, *(divider)*, explanation language seg-ctrl, analysis depth seg-ctrl, Save button
  - Note: Screenshot + Prefs merged into one tab to reduce clutter

### `background.js`
- Add listener for `capture-screenshot-manual` command
- Extract shared capture+analyze logic into `captureAndAnalyze(screenshotDataUrl)` accepting a pre-cropped image URL
- `captureAndAnalyze()` (no args) = full screen: calls `chrome.tabs.captureVisibleTab`, then delegates
- Manual command: sends message to content script to show selection overlay, listens for result with cropped dataURL, then delegates to analyze

### New file: `selector.js` (content script)
Injected on demand when manual capture is triggered. Responsibilities:
- Overlay: full-viewport semi-transparent backdrop (`rgba(0,0,0,0.4)`) with crosshair cursor
- Drag to draw selection rectangle (amber `#c8713a` border, semi-transparent fill)
- On mouseup: capture `{x, y, width, height}` in CSS pixels
- Send `{type: 'selection-complete', rect}` message back to background
- Background takes full screenshot, crops to rect (accounting for `devicePixelRatio`) using an offscreen canvas via content script
- Remove overlay after capture

---

## Manual Screenshot Flow

```
User presses ⌘⇧S
  → background.js receives 'capture-screenshot-manual'
  → inject selector.js into current tab
  → selector.js shows overlay
  → user drags selection
  → selector.js sends rect to background
  → background calls captureVisibleTab (full screen)
  → background sends {screenshot, rect} to content script
  → content script crops on canvas → returns cropped dataURL
  → background passes cropped dataURL to AI analysis
  → same flow as full-screen from here
```

---

## What Does NOT Change

- `popup.js` — all settings logic, shortcut recorder, API save/load
- `panel.js` — all record rendering, export, delete, lightbox
- `background.js` AI provider functions (Groq, Gemini, OpenRouter, Claude)
- `background.js` prompt builder
- All Chrome storage keys and data structures
- Extension permissions (no new permissions needed — `scripting` already present)
