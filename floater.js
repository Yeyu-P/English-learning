// floater.js — floating capture button, injected on all pages via manifest content_scripts
(function () {
  if (document.getElementById('__subtract-floater__')) return;

  const LOGO_SVG = `<svg width="16" height="16" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="52" height="52" rx="10" fill="#1a1613"/>
    <rect x="8" y="10" width="36" height="22" rx="2.5" stroke="#f8f5f0" stroke-width="2.5" fill="none"/>
    <rect x="14" y="22" width="14" height="3" rx="1.5" fill="#c8713a"/>
    <line x1="26" y1="32" x2="26" y2="41" stroke="#f8f5f0" stroke-width="2.2" stroke-linecap="round"/>
    <polyline points="22,38 26,42 30,38" fill="none" stroke="#f8f5f0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const ICON_FULL = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f8f5f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`;

  const ICON_AREA = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f8f5f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
  </svg>`;

  const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5a7a62" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
  const ICON_X = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b35a5a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const ICON_SPIN = `<div style="width:14px;height:14px;border:2px solid rgba(248,245,240,0.25);border-top-color:#c8713a;border-radius:50%;animation:__sb_spin 0.75s linear infinite;flex-shrink:0"></div>`;

  const ICON_BLOCK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f8f5f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1" y="9" width="22" height="6" rx="1.5"/>
    <line x1="5" y1="12" x2="9" y2="12"/>
    <line x1="12" y1="12" x2="19" y2="12"/>
  </svg>`;

  const ICON_EYE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f8f5f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;

  chrome.storage.local.get(['floaterEnabled', 'floaterPos'], ({ floaterEnabled, floaterPos }) => {
    if (floaterEnabled === false) return;
    createFloater(floaterPos || { right: 20, bottom: 20 });
  });

  function createFloater({ right, bottom }) {
    // ── Styles
    if (!document.getElementById('__subtract-floater-style__')) {
      const s = document.createElement('style');
      s.id = '__subtract-floater-style__';
      s.textContent = `
        @keyframes __sb_spin { to { transform: rotate(360deg); } }
        #__subtract-floater__ {
          position: fixed; z-index: 2147483646;
          display: flex; flex-direction: column-reverse; align-items: center; gap: 6px;
          pointer-events: none;
        }
        #__subtract-floater__ * { box-sizing: border-box; }
        .__sb-main {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(26,22,19,0.75);
          border: 1.5px solid rgba(248,245,240,0.18);
          display: flex; align-items: center; justify-content: center;
          cursor: grab; pointer-events: all;
          transition: background 0.15s, transform 0.15s;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .__sb-main:hover { background: rgba(26,22,19,0.92); }
        .__sb-actions {
          display: flex; flex-direction: column-reverse;
          align-items: center; gap: 5px;
          opacity: 0; pointer-events: none;
          transition: opacity 0.15s, transform 0.15s;
          transform: translateY(4px);
        }
        #__subtract-floater__:hover .__sb-actions {
          opacity: 1; pointer-events: all; transform: translateY(0);
        }
        .__sb-action {
          position: relative;
          width: 30px; height: 30px; border-radius: 50%;
          background: rgba(26,22,19,0.80);
          border: 1.5px solid rgba(248,245,240,0.18);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; pointer-events: all;
          transition: background 0.15s;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
        }
        .__sb-action:hover { background: rgba(200,113,58,0.85); }
        .__sb-tip {
          position: absolute; right: 38px;
          background: rgba(26,22,19,0.85); color: #f8f5f0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 11px; padding: 3px 8px; border-radius: 4px;
          white-space: nowrap; pointer-events: none;
          opacity: 0; transition: opacity 0.1s;
        }
        .__sb-action:hover .__sb-tip { opacity: 1; }

        /* ── Blocker bar */
        #__subtract-blocker__ {
          position: fixed; z-index: 2147483646;
          height: 64px;
          background: rgba(26,22,19,0.82);
          border: 1.5px solid rgba(248,245,240,0.18);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 16px;
          cursor: grab;
          user-select: none;
          transition: opacity 0.2s;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-sizing: border-box;
        }
        .__sb-bl-resize-l, .__sb-bl-resize-r {
          position: absolute; top: 0; bottom: 0; width: 10px;
          cursor: ew-resize; z-index: 1;
        }
        .__sb-bl-resize-l { left: 0; border-radius: 12px 0 0 12px; }
        .__sb-bl-resize-r { right: 0; border-radius: 0 12px 12px 0; }
        .__sb-bl-resize-t {
          position: absolute; top: 0; left: 10px; right: 10px; height: 8px;
          cursor: ns-resize; z-index: 2;
        }
        .__sb-bl-eye, .__sb-bl-close {
          width: 30px; height: 30px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0;
          background: rgba(248,245,240,0.08);
          border: 1px solid rgba(248,245,240,0.12);
          transition: background 0.15s;
        }
        .__sb-bl-eye:hover { background: rgba(248,245,240,0.20); }
        .__sb-bl-close:hover { background: rgba(179,90,90,0.55); }
        .__sb-bl-center {
          display: flex; align-items: center; gap: 12px;
          flex: 1; justify-content: center;
        }
        .__sb-bl-btn {
          position: relative;
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(248,245,240,0.10);
          border: 1.5px solid rgba(248,245,240,0.18);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 0.15s;
        }
        .__sb-bl-btn:hover { background: rgba(200,113,58,0.85); }
        .__sb-bl-tip {
          position: absolute; bottom: 44px;
          background: rgba(26,22,19,0.85); color: #f8f5f0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 11px; padding: 3px 8px; border-radius: 4px;
          white-space: nowrap; pointer-events: none;
          opacity: 0; transition: opacity 0.1s;
        }
        .__sb-bl-btn:hover .__sb-bl-tip { opacity: 1; }
      `;
      document.head.appendChild(s);
    }

    // ── Build DOM
    const floater = document.createElement('div');
    floater.id = '__subtract-floater__';
    floater.style.right = right + 'px';
    floater.style.bottom = bottom + 'px';

    const actions = document.createElement('div');
    actions.className = '__sb-actions';
    const btnFull  = makeBtn(ICON_FULL,  'Full screen');
    const btnArea  = makeBtn(ICON_AREA,  'Select area');
    const btnBlock = makeBtn(ICON_BLOCK, 'Block subtitles');
    actions.appendChild(btnFull);
    actions.appendChild(btnArea);
    actions.appendChild(btnBlock);

    const main = document.createElement('div');
    main.className = '__sb-main';
    main.innerHTML = LOGO_SVG;

    floater.appendChild(actions);
    floater.appendChild(main);
    document.documentElement.appendChild(floater);

    // ── Click handlers
    btnFull.addEventListener('click', (e) => {
      e.stopPropagation();
      setStatus('loading');
      try {
        chrome.runtime.sendMessage({ type: 'subtract-float-capture', mode: 'full' }, () => {
          if (chrome.runtime.lastError) setStatus('error');
        });
      } catch (_) { setStatus('error'); setTimeout(() => setStatus('idle'), 2000); }
    });

    btnArea.addEventListener('click', (e) => {
      e.stopPropagation();
      floater.style.display = 'none';
      try {
        chrome.runtime.sendMessage({ type: 'subtract-float-capture', mode: 'area' });
      } catch (_) { floater.style.display = ''; setStatus('error'); setTimeout(() => setStatus('idle'), 2000); }
    });

    btnBlock.addEventListener('click', (e) => {
      e.stopPropagation();
      createBlocker();
    });

    // ── Background messages
    function onExtMsg(msg) {
      if (msg.type === 'subtract-float-restore') {
        if (blockerEl) {
          blockerEl.style.display = '';
        } else {
          floater.style.display = '';
        }
        setStatus('idle');
      }
      if (msg.type === 'subtract-float-status') {
        if (blockerEl) {
          if (msg.status === 'done') blockerEl.style.borderColor = 'rgba(90,122,98,0.7)';
          else if (msg.status === 'error' || msg.status === 'cancelled') blockerEl.style.borderColor = 'rgba(179,90,90,0.7)';
          if (msg.status === 'done' || msg.status === 'error' || msg.status === 'cancelled') {
            setTimeout(() => { if (blockerEl) blockerEl.style.borderColor = ''; }, 2000);
          }
        }
        setStatus(msg.status);
        if (msg.status === 'done' || msg.status === 'error' || msg.status === 'cancelled') {
          setTimeout(() => setStatus('idle'), 2000);
        }
      }
    }
    try { chrome.runtime.onMessage.addListener(onExtMsg); } catch (_) { /* context already gone, floater stays but won't receive messages */ }

    // ── Drag to reposition (drag vs click: only reposition if moved > 4px)
    let dragging = false, moved = false;
    let dragStartX = 0, dragStartY = 0, startRight = right, startBottom = bottom;

    main.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startRight  = parseInt(floater.style.right, 10)  || 20;
      startBottom = parseInt(floater.style.bottom, 10) || 20;
      main.style.cursor = 'grabbing';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (!moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      moved = true;
      floater.style.right  = Math.max(8, Math.min(window.innerWidth  - 44, startRight  - dx)) + 'px';
      floater.style.bottom = Math.max(8, Math.min(window.innerHeight - 44, startBottom - dy)) + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      main.style.cursor = 'grab';
      if (moved) {
        chrome.storage.local.set({
          floaterPos: {
            right:  parseInt(floater.style.right, 10)  || 20,
            bottom: parseInt(floater.style.bottom, 10) || 20,
          },
        });
      }
    });

    // ── Fullscreen: move floater/blocker into/out of fullscreen element
    document.addEventListener('fullscreenchange', () => {
      const container = document.fullscreenElement || document.documentElement;
      container.appendChild(floater);
      if (blockerEl) container.appendChild(blockerEl);
    });

    // ── Subtitle blocker bar
    let blockerEl = null;

    function createBlocker() {
      if (blockerEl) return;
      floater.style.display = 'none';

      const initW = Math.round(window.innerWidth * 0.6);
      const initL = Math.round((window.innerWidth - initW) / 2);
      const initB = 80;

      const bar = document.createElement('div');
      bar.id = '__subtract-blocker__';
      bar.style.left   = initL + 'px';
      bar.style.bottom = initB + 'px';
      bar.style.width  = initW + 'px';

      // Eye button
      const eyeBtn = document.createElement('div');
      eyeBtn.className = '__sb-bl-eye';
      eyeBtn.title = 'Hover to peek';
      eyeBtn.innerHTML = ICON_EYE;
      eyeBtn.addEventListener('mouseenter', () => { if (!bDragging) bar.style.opacity = '0.08'; });
      eyeBtn.addEventListener('mouseleave', () => { bar.style.opacity = ''; });

      // Center capture buttons
      const center = document.createElement('div');
      center.className = '__sb-bl-center';

      const blFull = makeBlockerBtn(ICON_FULL, 'Full screen');
      blFull.addEventListener('click', (e) => {
        e.stopPropagation();
        bar.style.borderColor = 'rgba(200,113,58,0.7)';
        try {
          chrome.runtime.sendMessage({ type: 'subtract-float-capture', mode: 'full' }, () => {
            if (chrome.runtime.lastError) bar.style.borderColor = 'rgba(179,90,90,0.7)';
          });
        } catch (_) { bar.style.borderColor = 'rgba(179,90,90,0.7)'; }
      });

      const blArea = makeBlockerBtn(ICON_AREA, 'Select area');
      blArea.addEventListener('click', (e) => {
        e.stopPropagation();
        bar.style.display = 'none';
        try {
          chrome.runtime.sendMessage({ type: 'subtract-float-capture', mode: 'area' });
        } catch (_) { bar.style.display = ''; }
      });

      center.appendChild(blFull);
      center.appendChild(blArea);
      center.addEventListener('mouseenter', () => {
        bar.style.background = 'rgba(26,22,19,0)';
        bar.style.borderColor = 'rgba(248,245,240,0)';
        bar.style.backdropFilter = 'none';
        bar.style.webkitBackdropFilter = 'none';
      });
      center.addEventListener('mouseleave', () => {
        bar.style.background = '';
        bar.style.borderColor = '';
        bar.style.backdropFilter = '';
        bar.style.webkitBackdropFilter = '';
      });

      // Close button
      const closeBtn = document.createElement('div');
      closeBtn.className = '__sb-bl-close';
      closeBtn.title = 'Exit blocker';
      closeBtn.innerHTML = ICON_X;
      closeBtn.addEventListener('click', (e) => { e.stopPropagation(); destroyBlocker(); });

      // Resize handles
      const resizeL = document.createElement('div');
      resizeL.className = '__sb-bl-resize-l';
      const resizeR = document.createElement('div');
      resizeR.className = '__sb-bl-resize-r';
      const resizeT = document.createElement('div');
      resizeT.className = '__sb-bl-resize-t';

      bar.appendChild(resizeL);
      bar.appendChild(resizeT);
      bar.appendChild(eyeBtn);
      bar.appendChild(center);
      bar.appendChild(closeBtn);
      bar.appendChild(resizeR);

      // ── Drag bar
      let bDragging = false, bMoved = false, rDragging = false, rSide = null;
      let startX, startY, startL, startB, startW, startH;

      bar.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        // resize handles stop their own propagation; exclude them as a safety net
        if (e.target === resizeL || e.target === resizeR || e.target === resizeT) return;
        bDragging = true;
        bMoved = false;
        startX = e.clientX; startY = e.clientY;
        startL = parseInt(bar.style.left)   || initL;
        startB = parseInt(bar.style.bottom) || initB;
        e.preventDefault();
      });

      // ── Resize handles
      function onResizeDown(side, e) {
        if (e.button !== 0) return;
        rDragging = true; rSide = side;
        startX = e.clientX;
        startY = e.clientY;
        startL = parseInt(bar.style.left)  || initL;
        startW = parseInt(bar.style.width) || initW;
        startH = bar.offsetHeight          || 64;
        e.preventDefault();
        e.stopPropagation();
      }
      resizeL.addEventListener('mousedown', (e) => onResizeDown('left',  e));
      resizeR.addEventListener('mousedown', (e) => onResizeDown('right', e));
      resizeT.addEventListener('mousedown', (e) => onResizeDown('top',   e));

      function onBMove(e) {
        if (bDragging) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          if (!bMoved && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
          if (!bMoved) { bMoved = true; bar.style.cursor = 'grabbing'; }
          const h = bar.offsetHeight || 64;
          const w = parseInt(bar.style.width) || initW;
          bar.style.left   = Math.max(0, Math.min(window.innerWidth  - w, startL + dx)) + 'px';
          bar.style.bottom = Math.max(0, Math.min(window.innerHeight - h, startB - dy)) + 'px';
        }
        if (rDragging) {
          const dx  = e.clientX - startX;
          const dy  = e.clientY - startY;
          const minW = 140, minH = 32;
          if (rSide === 'right') {
            const newW = Math.max(minW, Math.min(window.innerWidth - startL, startW + dx));
            bar.style.width = newW + 'px';
          } else if (rSide === 'left') {
            const newW = Math.max(minW, Math.min(startW + startL, startW - dx));
            bar.style.left  = Math.max(0, startL + startW - newW) + 'px';
            bar.style.width = newW + 'px';
          } else if (rSide === 'top') {
            // drag top edge up → bar grows taller (bottom fixed)
            const newH = Math.max(minH, startH - dy);
            bar.style.height = newH + 'px';
          }
        }
      }

      function onBUp() {
        bDragging = false; bMoved = false; rDragging = false; rSide = null;
        bar.style.cursor = 'grab';
      }

      document.addEventListener('mousemove', onBMove);
      document.addEventListener('mouseup',   onBUp);

      bar.__sbCleanup = () => {
        document.removeEventListener('mousemove', onBMove);
        document.removeEventListener('mouseup',   onBUp);
      };

      const container = document.fullscreenElement || document.documentElement;
      container.appendChild(bar);
      blockerEl = bar;
    }

    function destroyBlocker() {
      if (!blockerEl) return;
      if (blockerEl.__sbCleanup) blockerEl.__sbCleanup();
      blockerEl.remove();
      blockerEl = null;
      floater.style.display = '';
    }

    // ── Status icon
    function setStatus(status) {
      if (status === 'loading') {
        main.innerHTML = ICON_SPIN;
      } else if (status === 'done') {
        main.innerHTML = ICON_CHECK;
      } else if (status === 'error' || status === 'cancelled') {
        main.innerHTML = ICON_X;
      } else {
        main.innerHTML = LOGO_SVG;
      }
    }
  }

  function makeBtn(iconSvg, tooltip) {
    const btn = document.createElement('div');
    btn.className = '__sb-action';
    btn.innerHTML = `${iconSvg}<span class="__sb-tip">${tooltip}</span>`;
    return btn;
  }

  function makeBlockerBtn(iconSvg, tooltip) {
    const btn = document.createElement('div');
    btn.className = '__sb-bl-btn';
    btn.innerHTML = `${iconSvg}<span class="__sb-bl-tip">${tooltip}</span>`;
    return btn;
  }
})();
