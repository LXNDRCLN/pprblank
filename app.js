(function () {
  'use strict';

  // ── Canvas dimensions (A4 at 96 dpi) ──────────────────────
  const A4_W = 794;
  const A4_H = 1123;

  // ── Color palette ──────────────────────────────────────────
  const PALETTE = [
    '#000000','#1c1c1c','#3d3d3d','#666666','#909090','#b3b3b3','#d6d6d6','#ffffff',
    '#e53935','#e64a19','#f9a825','#43a047','#00897b','#1e88e5','#5e35b1','#d81b60',
    '#b71c1c','#bf360c','#e65100','#558b2f','#00695c','#1565c0','#4527a0','#880e4f',
    '#6d4c41','#795548','#a1887f','#ffcc80','#b3e5fc','#c5cae9','#f8bbd0','#dcedc8',
  ];

  // ── DOM refs ───────────────────────────────────────────────
  const mainCanvas    = document.getElementById('main-canvas');
  const overlayCanvas = document.getElementById('overlay-canvas');
  const mc            = mainCanvas.getContext('2d');
  const oc            = overlayCanvas.getContext('2d');
  const sizeSlider    = document.getElementById('size-slider');
  const sizeDisplay   = document.getElementById('size-display');
  const colorPicker   = document.getElementById('color-picker');
  const swatchesEl    = document.getElementById('color-swatches');
  const colorBox      = document.getElementById('current-color-box');
  const fontFamilySel = document.getElementById('font-family');
  const fontSizeInput = document.getElementById('font-size');
  const boldBtn       = document.getElementById('bold-btn');
  const italicBtn     = document.getElementById('italic-btn');
  const underlineBtn  = document.getElementById('underline-btn');
  const shapeFillSec  = document.getElementById('shape-fill-section');
  const textOptSec    = document.getElementById('text-options-section');
  const undoBtn       = document.getElementById('undo-btn');
  const redoBtn       = document.getElementById('redo-btn');
  const clearBtn      = document.getElementById('clear-btn');
  const exportPng     = document.getElementById('export-png');
  const exportJpg     = document.getElementById('export-jpg');
  const canvasWrapper = document.getElementById('canvas-wrapper');

  // ── State ──────────────────────────────────────────────────
  let tool       = 'pen';
  let color      = '#000000';
  let brushSize  = 4;
  let shapeStyle = 'outline';
  let fontFamily = 'Arial';
  let fontSize   = 20;
  let fontBold   = false;
  let fontItalic = false;
  let fontUnder  = false;

  let drawing = false;
  let startX = 0, startY = 0;
  let lastX  = 0, lastY  = 0;
  let sprayTimer = null;
  let activeTextarea = null;

  // ── History ────────────────────────────────────────────────
  const MAX_HIST = 50;
  let hist    = [];
  let histIdx = -1;

  function saveState() {
    hist.splice(histIdx + 1);
    hist.push(mc.getImageData(0, 0, A4_W, A4_H));
    if (hist.length > MAX_HIST) hist.shift();
    else histIdx++;
  }

  function undo() {
    if (histIdx > 0) { histIdx--; mc.putImageData(hist[histIdx], 0, 0); }
  }

  function redo() {
    if (histIdx < hist.length - 1) { histIdx++; mc.putImageData(hist[histIdx], 0, 0); }
  }

  // ── Canvas init ────────────────────────────────────────────
  mainCanvas.width    = A4_W;
  mainCanvas.height   = A4_H;
  overlayCanvas.width  = A4_W;
  overlayCanvas.height = A4_H;

  mc.fillStyle = '#ffffff';
  mc.fillRect(0, 0, A4_W, A4_H);
  saveState();

  // ── Palette ────────────────────────────────────────────────
  function buildPalette() {
    PALETTE.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'color-swatch';
      btn.style.background = c;
      btn.dataset.color = c;
      btn.title = c;
      btn.addEventListener('click', () => setColor(c));
      swatchesEl.appendChild(btn);
    });
  }

  function setColor(c) {
    color = c;
    colorBox.style.background = c;
    if (/^#[0-9a-f]{6}$/i.test(c)) colorPicker.value = c;
    document.querySelectorAll('.color-swatch').forEach(sw => {
      sw.classList.toggle('selected', sw.dataset.color === c);
    });
  }

  // ── Tool selection ─────────────────────────────────────────
  const SHAPE_TOOLS = new Set(['rect', 'ellipse', 'line', 'arrow', 'triangle']);

  function selectTool(t) {
    commitText();
    tool = t;
    document.querySelectorAll('.tool-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tool === t));
    shapeFillSec.style.display = SHAPE_TOOLS.has(t) ? 'block' : 'none';
    textOptSec.style.display   = t === 'text'        ? 'block' : 'none';
    mainCanvas.style.cursor    = t === 'text' ? 'text' : 'crosshair';
  }

  // ── Coordinate helper ──────────────────────────────────────
  function getPos(e) {
    const r  = mainCanvas.getBoundingClientRect();
    const sx = A4_W / r.width;
    const sy = A4_H / r.height;
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    return { x: Math.round((cx - r.left) * sx), y: Math.round((cy - r.top) * sy) };
  }

  // ── Freehand drawing ───────────────────────────────────────
  function freehandStart(x, y) {
    mc.beginPath();
    mc.moveTo(x, y);
    lastX = x; lastY = y;
  }

  function freehandMove(x, y) {
    if (tool === 'eraser') {
      mc.globalCompositeOperation = 'source-over';
      mc.strokeStyle = '#ffffff';
      mc.lineWidth   = brushSize * 4;
      mc.globalAlpha = 1;
    } else if (tool === 'brush') {
      mc.globalCompositeOperation = 'source-over';
      mc.strokeStyle = color;
      mc.lineWidth   = brushSize * 2.5;
      mc.globalAlpha = 0.65;
    } else {
      mc.globalCompositeOperation = 'source-over';
      mc.strokeStyle = color;
      mc.lineWidth   = brushSize;
      mc.globalAlpha = 1;
    }
    mc.lineCap    = 'round';
    mc.lineJoin   = 'round';
    mc.lineTo(x, y);
    mc.stroke();
    mc.beginPath();
    mc.moveTo(x, y);
    lastX = x; lastY = y;
  }

  function freehandEnd() {
    mc.globalAlpha = 1;
    mc.globalCompositeOperation = 'source-over';
  }

  // ── Spray ──────────────────────────────────────────────────
  function spray(x, y) {
    const density = 25 + brushSize * 2;
    const radius  = brushSize * 4;
    mc.fillStyle  = color;
    for (let i = 0; i < density; i++) {
      const a  = Math.random() * Math.PI * 2;
      const r  = Math.random() * radius;
      mc.fillRect(x + r * Math.cos(a), y + r * Math.sin(a), 1.5, 1.5);
    }
  }

  // ── Shapes ─────────────────────────────────────────────────
  function applyShapeStyle(ctx) {
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = brushSize;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.setLineDash([]);
  }

  function renderShape(ctx, x1, y1, x2, y2) {
    const filled = shapeStyle === 'filled';
    switch (tool) {
      case 'rect': {
        if (filled) ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        break;
      }
      case 'ellipse': {
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        const rx = Math.abs(x2 - x1) / 2, ry = Math.abs(y2 - y1) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
        if (filled) ctx.fill();
        ctx.stroke();
        break;
      }
      case 'line': {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
      }
      case 'arrow': {
        renderArrow(ctx, x1, y1, x2, y2);
        break;
      }
      case 'triangle': {
        const mid = (x1 + x2) / 2;
        ctx.beginPath();
        ctx.moveTo(mid, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x1, y2);
        ctx.closePath();
        if (filled) ctx.fill();
        ctx.stroke();
        break;
      }
    }
  }

  function renderArrow(ctx, x1, y1, x2, y2) {
    const angle   = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(18, brushSize * 5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6),
               y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6),
               y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  function previewShape(x1, y1, x2, y2) {
    oc.clearRect(0, 0, A4_W, A4_H);
    applyShapeStyle(oc);
    renderShape(oc, x1, y1, x2, y2);
  }

  function commitShape(x1, y1, x2, y2) {
    oc.clearRect(0, 0, A4_W, A4_H);
    applyShapeStyle(mc);
    renderShape(mc, x1, y1, x2, y2);
  }

  // ── Flood fill ─────────────────────────────────────────────
  function hexToRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
  }

  function floodFill(px, py) {
    const imgData = mc.getImageData(0, 0, A4_W, A4_H);
    const data    = imgData.data;
    const W = A4_W, H = A4_H;
    const base = (py * W + px) * 4;
    const tR = data[base], tG = data[base + 1], tB = data[base + 2];
    const [fR, fG, fB] = hexToRgb(color);

    if (tR === fR && tG === fG && tB === fB) return;

    const TOL = 30;
    function match(i) {
      return Math.abs(data[i]   - tR) <= TOL &&
             Math.abs(data[i+1] - tG) <= TOL &&
             Math.abs(data[i+2] - tB) <= TOL;
    }

    const visited = new Uint8Array(W * H);
    const stack   = [py * W + px];
    visited[py * W + px] = 1;

    while (stack.length) {
      const pos = stack.pop();
      const x   = pos % W;
      const y   = (pos / W) | 0;
      const i   = pos * 4;
      data[i] = fR; data[i+1] = fG; data[i+2] = fB; data[i+3] = 255;

      const neighbors = [pos - 1, pos + 1, pos - W, pos + W];
      for (const n of neighbors) {
        if (n < 0 || n >= W * H) continue;
        if (visited[n]) continue;
        const nx = n % W, px2 = pos % W;
        if (Math.abs(nx - px2) > 1) continue;
        if (!match(n * 4)) continue;
        visited[n] = 1;
        stack.push(n);
      }
    }
    mc.putImageData(imgData, 0, 0);
  }

  // ── Text ───────────────────────────────────────────────────
  function placeTextInput(x, y) {
    commitText();
    const r   = mainCanvas.getBoundingClientRect();
    const scX = r.width  / A4_W;
    const scY = r.height / A4_H;

    const ta = document.createElement('textarea');
    ta.className = 'text-input-overlay';
    ta.style.left       = (x * scX) + 'px';
    ta.style.top        = (y * scY) + 'px';
    ta.style.fontFamily = fontFamily;
    ta.style.fontSize   = (fontSize * scY) + 'px';
    ta.style.fontWeight = fontBold   ? 'bold'   : 'normal';
    ta.style.fontStyle  = fontItalic ? 'italic' : 'normal';
    ta.style.color      = color;
    ta.dataset.cx = x;
    ta.dataset.cy = y;
    canvasWrapper.appendChild(ta);
    activeTextarea = ta;
    ta.focus();

    ta.addEventListener('blur',    () => commitText());
    ta.addEventListener('keydown', e => { if (e.key === 'Escape') { ta.remove(); activeTextarea = null; } });
  }

  function commitText() {
    if (!activeTextarea) return;
    const ta   = activeTextarea;
    const text = ta.value;
    activeTextarea = null;

    if (text.trim()) {
      const x  = parseInt(ta.dataset.cx);
      const y  = parseInt(ta.dataset.cy);
      const fStr = [
        fontItalic ? 'italic' : '',
        fontBold   ? 'bold'   : '',
        fontSize + 'px',
        '"' + fontFamily + '"'
      ].filter(Boolean).join(' ');

      mc.font         = fStr;
      mc.fillStyle    = color;
      mc.textBaseline = 'top';

      const lineH = fontSize * 1.3;
      text.split('\n').forEach((line, i) => {
        mc.fillText(line, x, y + i * lineH);
        if (fontUnder) {
          const tw = mc.measureText(line).width;
          const uy = y + i * lineH + fontSize + 2;
          mc.beginPath();
          mc.strokeStyle = color;
          mc.lineWidth   = Math.max(1, fontSize / 14);
          mc.moveTo(x, uy);
          mc.lineTo(x + tw, uy);
          mc.stroke();
        }
      });
      saveState();
    }
    if (ta.parentNode) ta.remove();
  }

  // ── Pointer events ─────────────────────────────────────────
  mainCanvas.addEventListener('mousedown',  onDown);
  mainCanvas.addEventListener('mousemove',  onMove);
  mainCanvas.addEventListener('mouseup',    onUp);
  mainCanvas.addEventListener('mouseleave', onLeave);
  mainCanvas.addEventListener('contextmenu', e => e.preventDefault());

  function onDown(e) {
    const { x, y } = getPos(e);
    drawing = true;
    startX = x; startY = y;
    lastX  = x; lastY  = y;

    if (tool === 'fill') {
      floodFill(x, y);
      saveState();
      drawing = false;
      return;
    }
    if (tool === 'text') {
      placeTextInput(x, y);
      drawing = false;
      return;
    }
    if (tool === 'pen' || tool === 'brush' || tool === 'eraser') {
      freehandStart(x, y);
    }
    if (tool === 'spray') {
      spray(x, y);
      sprayTimer = setInterval(() => { if (drawing) spray(lastX, lastY); }, 30);
    }
  }

  function onMove(e) {
    if (!drawing) return;
    const { x, y } = getPos(e);
    lastX = x; lastY = y;

    if (tool === 'pen' || tool === 'brush' || tool === 'eraser') {
      freehandMove(x, y);
    }
    if (tool === 'spray') {
      spray(x, y);
    }
    if (SHAPE_TOOLS.has(tool)) {
      previewShape(startX, startY, x, y);
    }
  }

  function onUp(e) {
    if (!drawing) return;
    const { x, y } = getPos(e);
    drawing = false;

    if (tool === 'spray') {
      clearInterval(sprayTimer); sprayTimer = null;
      saveState(); return;
    }
    if (tool === 'pen' || tool === 'brush' || tool === 'eraser') {
      freehandEnd(); saveState(); return;
    }
    if (SHAPE_TOOLS.has(tool)) {
      commitShape(startX, startY, x, y);
      saveState();
    }
  }

  function onLeave(e) {
    if (drawing) onUp(e);
  }

  // ── Keyboard shortcuts ─────────────────────────────────────
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
  });

  // ── UI wiring ──────────────────────────────────────────────
  document.querySelectorAll('.tool-btn').forEach(btn =>
    btn.addEventListener('click', () => selectTool(btn.dataset.tool)));

  sizeSlider.addEventListener('input', () => {
    brushSize = parseInt(sizeSlider.value);
    sizeDisplay.textContent = brushSize;
  });

  colorPicker.addEventListener('input', () => setColor(colorPicker.value));

  document.querySelectorAll('.toggle-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      shapeStyle = btn.dataset.fill;
    }));

  fontFamilySel.addEventListener('change', () => { fontFamily = fontFamilySel.value; });
  fontSizeInput.addEventListener('change', () => { fontSize   = Math.max(8, parseInt(fontSizeInput.value) || 20); });

  boldBtn.addEventListener('click', () => {
    fontBold = !fontBold;
    boldBtn.classList.toggle('active', fontBold);
  });
  italicBtn.addEventListener('click', () => {
    fontItalic = !fontItalic;
    italicBtn.classList.toggle('active', fontItalic);
  });
  underlineBtn.addEventListener('click', () => {
    fontUnder = !fontUnder;
    underlineBtn.classList.toggle('active', fontUnder);
  });

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear the canvas? This cannot be undone.')) return;
    mc.fillStyle = '#ffffff';
    mc.fillRect(0, 0, A4_W, A4_H);
    saveState();
  });

  exportPng.addEventListener('click', () => {
    const a = document.createElement('a');
    a.download = 'pprblank.png';
    a.href = mainCanvas.toDataURL('image/png');
    a.click();
  });

  exportJpg.addEventListener('click', () => {
    const tmp = document.createElement('canvas');
    tmp.width = A4_W; tmp.height = A4_H;
    const t = tmp.getContext('2d');
    t.fillStyle = '#ffffff';
    t.fillRect(0, 0, A4_W, A4_H);
    t.drawImage(mainCanvas, 0, 0);
    const a = document.createElement('a');
    a.download = 'pprblank.jpg';
    a.href = tmp.toDataURL('image/jpeg', 0.95);
    a.click();
  });

  // ── Init ───────────────────────────────────────────────────
  buildPalette();
  setColor('#000000');
  selectTool('pen');

})();
