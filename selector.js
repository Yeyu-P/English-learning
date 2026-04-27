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
