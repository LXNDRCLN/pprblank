(function () {
  'use strict';

  const A4_W = 794;
  const A4_H = 1123;

  const PALETTE = [
    '#000000','#1c1c1c','#3d3d3d','#666666','#909090','#b3b3b3','#d6d6d6','#ffffff',
    '#e53935','#e64a19','#f9a825','#43a047','#00897b','#1e88e5','#5e35b1','#d81b60',
    '#b71c1c','#bf360c','#e65100','#558b2f','#00695c','#1565c0','#4527a0','#880e4f',
    '#6d4c41','#795548','#a1887f','#ffcc80','#b3e5fc','#c5cae9','#f8bbd0','#dcedc8',
  ];

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
  const selectInfoSec = document.getElementById('select-info');
  const deleteSelBtn  = document.getElementById('delete-selected-btn');
  const undoBtn       = document.getElementById('undo-btn');
  const redoBtn       = document.getElementById('redo-btn');
  const clearBtn      = document.getElementById('clear-btn');
  const exportPng     = document.getElementById('export-png');
  const exportJpg     = document.getElementById('export-jpg');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const zoomSlider    = document.getElementById('zoom-slider');
  const zoomDisplay   = document.getElementById('zoom-display');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar       = document.getElementById('sidebar');
  const sidebarHandle = document.getElementById('sidebar-handle');
  const canvasScroll  = document.getElementById('canvas-scroll');

  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width  = A4_W;
  pixelCanvas.height = A4_H;
  const pc = pixelCanvas.getContext('2d');
  pc.fillStyle = '#ffffff';
  pc.fillRect(0, 0, A4_W, A4_H);

  // ── Tool state ─────────────────────────────────────────────
  let tool       = 'pen';
  let color      = '#000000';
  let brushSize  = 4;
  let shapeStyle = 'outline';
  let fontFamily = 'Arial';
  let fontSize   = 20;
  let fontBold   = false;
  let fontItalic = false;
  let fontUnder  = false;
  let zoom       = 1;

  // ── Objects ────────────────────────────────────────────────
  let objects = [];
  let nextId  = 0;
  function makeId() { return ++nextId; }

  // ── Selection state ────────────────────────────────────────
  let selectedId   = null;
  let isDragging   = false;
  let isResizing   = false;
  let resizeHandle = -1;
  let resizeSnap   = null;
  let dragStartX   = 0, dragStartY = 0;
  let dragSnap     = null;
  let didMove      = false;

  // ── Drawing state ──────────────────────────────────────────
  let drawing    = false;
  let startX     = 0, startY = 0;
  let lastX      = 0, lastY  = 0;
  let sprayTimer = null;

  let activeTextarea = null;

  // ── History ────────────────────────────────────────────────
  const MAX_HIST = 50;
  let hist    = [];
  let histIdx = -1;

  function makeEntry() {
    return { pixelData: pc.getImageData(0, 0, A4_W, A4_H), objects: JSON.parse(JSON.stringify(objects)) };
  }
  function saveState() {
    hist.splice(histIdx + 1);
    hist.push(makeEntry());
    if (hist.length > MAX_HIST) hist.shift(); else histIdx++;
  }
  function restoreEntry(e) {
    pc.putImageData(e.pixelData, 0, 0);
    objects = JSON.parse(JSON.stringify(e.objects));
    selectedId = null;
    render(); renderOverlay(); updateSelectUI();
  }
  function undo() { if (histIdx > 0)               { histIdx--; restoreEntry(hist[histIdx]); } }
  function redo() { if (histIdx < hist.length - 1) { histIdx++; restoreEntry(hist[histIdx]); } }

  // ── Canvas + zoom ──────────────────────────────────────────
  mainCanvas.width    = A4_W;  mainCanvas.height   = A4_H;
  overlayCanvas.width = A4_W;  overlayCanvas.height = A4_H;

  function setZoom(z) {
    zoom = z;
    const w = Math.round(A4_W * z) + 'px';
    const h = Math.round(A4_H * z) + 'px';
    mainCanvas.style.width     = w; mainCanvas.style.height    = h;
    overlayCanvas.style.width  = w; overlayCanvas.style.height = h;
    if (zoomDisplay) zoomDisplay.textContent = Math.round(z * 100) + '%';
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    mc.fillStyle = '#ffffff';
    mc.fillRect(0, 0, A4_W, A4_H);
    mc.drawImage(pixelCanvas, 0, 0);
    objects.forEach(obj => drawObject(mc, obj));
  }

  function drawObject(ctx, obj) {
    if (obj.type === 'text') drawTextObj(ctx, obj);
    else                     drawShapeObj(ctx, obj);
  }

  function drawShapeObj(ctx, obj) {
    const { x1, y1, x2, y2, type, color: c, size: s, style: st } = obj;
    const filled = st === 'filled';
    ctx.save();
    ctx.strokeStyle = c; ctx.fillStyle = c;
    ctx.lineWidth = s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    switch (type) {
      case 'rect':
        if (filled) ctx.fillRect(x1, y1, x2-x1, y2-y1);
        ctx.strokeRect(x1, y1, x2-x1, y2-y1); break;
      case 'square': {
        const sLen = Math.min(Math.abs(x2-x1), Math.abs(y2-y1));
        const sx2  = x1 + Math.sign(x2-x1)*sLen, sy2 = y1 + Math.sign(y2-y1)*sLen;
        if (filled) ctx.fillRect(x1, y1, sx2-x1, sy2-y1);
        ctx.strokeRect(x1, y1, sx2-x1, sy2-y1); break;
      }
      case 'ellipse': {
        const cx = (x1+x2)/2, cy = (y1+y2)/2;
        const rx = Math.abs(x2-x1)/2, ry = Math.abs(y2-y1)/2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx,0.5), Math.max(ry,0.5), 0, 0, Math.PI*2);
        if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'line':
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke(); break;
      case 'arrow': {
        const angle = Math.atan2(y2-y1, x2-x1), hl = Math.max(18, s*5);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
        ctx.moveTo(x2,y2); ctx.lineTo(x2-hl*Math.cos(angle-Math.PI/6), y2-hl*Math.sin(angle-Math.PI/6));
        ctx.moveTo(x2,y2); ctx.lineTo(x2-hl*Math.cos(angle+Math.PI/6), y2-hl*Math.sin(angle+Math.PI/6));
        ctx.stroke(); break;
      }
      case 'triangle': {
        const mid = (x1+x2)/2;
        ctx.beginPath(); ctx.moveTo(mid,y1); ctx.lineTo(x2,y2); ctx.lineTo(x1,y2);
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'hexagon': {
        const cx = (x1+x2)/2, cy = (y1+y2)/2;
        const rx = Math.abs(x2-x1)/2, ry = Math.abs(y2-y1)/2;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI/3)*k;
          const hx = cx + rx*Math.cos(a), hy = cy + ry*Math.sin(a);
          k === 0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
        }
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'parallelogram': {
        const bx = Math.min(x1,x2), by = Math.min(y1,y2);
        const bw = Math.abs(x2-x1), bh = Math.abs(y2-y1);
        const skew = bw * 0.25;
        ctx.beginPath();
        ctx.moveTo(bx+skew, by); ctx.lineTo(bx+bw, by);
        ctx.lineTo(bx+bw-skew, by+bh); ctx.lineTo(bx, by+bh);
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
    }
    ctx.restore();
  }

  function buildFont(obj) {
    return [obj.fontItalic?'italic':'', obj.fontBold?'bold':'', obj.fontSize+'px', '"'+obj.fontFamily+'"'].filter(Boolean).join(' ');
  }

  function wrapText(ctx, text, maxWidth) {
    const out = [];
    text.split('\n').forEach(para => {
      if (!maxWidth) { out.push(para); return; }
      const words = para.split(' ');
      let cur = '';
      words.forEach(w => {
        const test = cur ? cur+' '+w : w;
        if (ctx.measureText(test).width > maxWidth && cur) { out.push(cur); cur = w; }
        else cur = test;
      });
      out.push(cur);
    });
    return out;
  }

  function drawTextObj(ctx, obj) {
    if (!obj.text || obj._editing) return;
    ctx.save();
    ctx.font = buildFont(obj); ctx.fillStyle = obj.color; ctx.textBaseline = 'top';
    const lineH = obj.fontSize * 1.3;
    const lines = obj.boxWidth ? wrapText(ctx, obj.text, obj.boxWidth - 8) : obj.text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, obj.x, obj.y + i*lineH);
      if (obj.fontUnder) {
        const tw = ctx.measureText(line).width, uy = obj.y + i*lineH + obj.fontSize + 2;
        ctx.beginPath(); ctx.strokeStyle = obj.color;
        ctx.lineWidth = Math.max(1, obj.fontSize/14);
        ctx.moveTo(obj.x, uy); ctx.lineTo(obj.x+tw, uy); ctx.stroke();
      }
    });
    ctx.restore();
  }

  // ── Bounds & hit test ──────────────────────────────────────
  function getBounds(obj) {
    if (obj.type === 'text') {
      mc.save(); mc.font = buildFont(obj);
      const lines = obj.boxWidth ? wrapText(mc, obj.text || '', obj.boxWidth - 8) : (obj.text ? obj.text.split('\n') : ['']);
      let maxW = obj.boxWidth || 20;
      if (!obj.boxWidth) lines.forEach(l => { const w = mc.measureText(l).width; if (w > maxW) maxW = w; });
      mc.restore();
      return { x: obj.x, y: obj.y, w: maxW, h: lines.length * obj.fontSize * 1.3 };
    }
    const { x1, y1, x2, y2, type } = obj;
    if (type === 'square') {
      const sLen = Math.min(Math.abs(x2-x1), Math.abs(y2-y1));
      const sx2 = x1+Math.sign(x2-x1)*sLen, sy2 = y1+Math.sign(y2-y1)*sLen;
      return { x: Math.min(x1,sx2), y: Math.min(y1,sy2), w: sLen, h: sLen };
    }
    return { x: Math.min(x1,x2), y: Math.min(y1,y2), w: Math.abs(x2-x1), h: Math.abs(y2-y1) };
  }

  function hitTest(obj, x, y) {
    const b = getBounds(obj), pad = Math.max(8, (obj.size||1)/2+5);
    return x>=b.x-pad && x<=b.x+b.w+pad && y>=b.y-pad && y<=b.y+b.h+pad;
  }

  const HANDLE_CURSORS = ['nw-resize','n-resize','ne-resize','e-resize','se-resize','s-resize','sw-resize','w-resize'];

  function getHandlePoints(obj) {
    const b = getBounds(obj), pad = 7;
    const hx = b.x-pad, hy = b.y-pad, hw = b.w+pad*2, hh = b.h+pad*2;
    return [
      [hx,       hy],       [hx+hw/2, hy],       [hx+hw, hy],
      [hx+hw,    hy+hh/2],  [hx+hw,   hy+hh],
      [hx+hw/2,  hy+hh],    [hx,      hy+hh],    [hx, hy+hh/2],
    ];
  }

  function getHandleAt(obj, x, y) {
    const pts = getHandlePoints(obj);
    for (let i = 0; i < pts.length; i++) {
      if (Math.abs(x - pts[i][0]) <= 8 && Math.abs(y - pts[i][1]) <= 8) return i;
    }
    return -1;
  }

  // ── Overlay ────────────────────────────────────────────────
  function renderOverlay() {
    oc.clearRect(0, 0, A4_W, A4_H);
    if (selectedId !== null) {
      const obj = objects.find(o => o.id === selectedId);
      if (obj) drawSelectionBox(obj);
    }
  }

  function drawSelectionBox(obj) {
    const b = getBounds(obj), pad = 7;
    oc.save();
    oc.strokeStyle = '#3a78d4'; oc.lineWidth = 1.5; oc.setLineDash([5,3]);
    oc.strokeRect(b.x-pad, b.y-pad, b.w+pad*2, b.h+pad*2);
    oc.setLineDash([]);
    getHandlePoints(obj).forEach(([cx,cy]) => {
      oc.fillStyle = '#ffffff'; oc.fillRect(cx-4, cy-4, 8, 8);
      oc.strokeStyle = '#3a78d4'; oc.strokeRect(cx-4, cy-4, 8, 8);
    });
    oc.restore();
  }

  function previewShape(x1, y1, x2, y2) {
    oc.clearRect(0, 0, A4_W, A4_H);
    drawShapeObj(oc, { x1, y1, x2, y2, type: tool, color, size: brushSize, style: shapeStyle });
  }

  // ── Freehand ──────────────────────────────────────────────
  let strokePoints   = [];
  let strokeSnapshot = null;

  function eraseObjectsAt(x, y) {
    const r = brushSize * 2, before = objects.length;
    objects = objects.filter(obj => {
      const b = getBounds(obj);
      const nx = Math.max(b.x, Math.min(x, b.x+b.w));
      const ny = Math.max(b.y, Math.min(y, b.y+b.h));
      return Math.hypot(x-nx, y-ny) > r;
    });
    if (objects.length < before && selectedId !== null && !objects.find(o => o.id === selectedId)) {
      selectedId = null; renderOverlay(); updateSelectUI();
    }
  }

  function drawSmoothStroke(points) {
    if (points.length === 0) return;
    pc.beginPath();
    pc.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 1; i++) {
      const mx = (points[i].x + points[i+1].x) / 2;
      const my = (points[i].y + points[i+1].y) / 2;
      pc.quadraticCurveTo(points[i].x, points[i].y, mx, my);
    }
    if (points.length > 1) {
      const last = points[points.length - 1];
      pc.lineTo(last.x, last.y);
    }
    pc.stroke();
  }

  function freehandStart(x, y) {
    strokePoints = [{x, y}];
    strokeSnapshot = pc.getImageData(0, 0, A4_W, A4_H);
    if (tool === 'eraser') eraseObjectsAt(x, y);
  }

  function freehandMove(x, y) {
    strokePoints.push({x, y});
    if (tool === 'eraser') {
      pc.strokeStyle = '#ffffff'; pc.lineWidth = brushSize*4; pc.globalAlpha = 1;
      eraseObjectsAt(x, y);
    } else if (tool === 'brush') {
      pc.strokeStyle = color; pc.lineWidth = brushSize*2.5; pc.globalAlpha = 0.65;
    } else {
      pc.strokeStyle = color; pc.lineWidth = brushSize; pc.globalAlpha = 1;
    }
    pc.lineCap = 'round'; pc.lineJoin = 'round';
    pc.putImageData(strokeSnapshot, 0, 0);
    drawSmoothStroke(strokePoints);
    render();
  }

  function freehandEnd() {
    strokePoints = [];
    strokeSnapshot = null;
    pc.globalAlpha = 1;
  }

  function doSpray(x, y) {
    const density = 25+brushSize*2, radius = brushSize*4;
    pc.fillStyle = color;
    for (let i = 0; i < density; i++) {
      const a = Math.random()*Math.PI*2, r = Math.random()*radius;
      pc.fillRect(x+r*Math.cos(a), y+r*Math.sin(a), 1.5, 1.5);
    }
    render();
  }

  // ── Flood fill ─────────────────────────────────────────────
  function hexToRgb(hex) {
    return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  }

  function floodFill(px, py) {
    // Change color of a filled shape if clicked inside one
    const filledHit = [...objects].reverse().find(o => {
      if (o.style !== 'filled') return false;
      const b = getBounds(o);
      return px >= b.x && px <= b.x+b.w && py >= b.y && py <= b.y+b.h;
    });
    if (filledHit) { filledHit.color = color; render(); return; }

    // Composite scene for boundary-aware fill
    const tmp = document.createElement('canvas');
    tmp.width = A4_W; tmp.height = A4_H;
    const tc = tmp.getContext('2d');
    tc.fillStyle = '#ffffff'; tc.fillRect(0, 0, A4_W, A4_H);
    tc.drawImage(pixelCanvas, 0, 0);
    objects.forEach(obj => drawObject(tc, obj));

    const imgData = tc.getImageData(0, 0, A4_W, A4_H);
    const data = imgData.data;
    const W = A4_W, H = A4_H;
    const base = (py*W+px)*4;
    const tR = data[base], tG = data[base+1], tB = data[base+2];
    const [fR, fG, fB] = hexToRgb(color);
    if (tR===fR && tG===fG && tB===fB) return;

    const TOL = 30;
    function match(i) {
      return Math.abs(data[i]-tR)<=TOL && Math.abs(data[i+1]-tG)<=TOL && Math.abs(data[i+2]-tB)<=TOL;
    }
    const filled = new Uint8Array(W*H), visited = new Uint8Array(W*H);
    const stack = [py*W+px]; visited[py*W+px] = 1;
    while (stack.length) {
      const pos = stack.pop(), xi = pos%W;
      filled[pos] = 1;
      for (const n of [pos-1, pos+1, pos-W, pos+W]) {
        if (n<0||n>=W*H||visited[n]||Math.abs((n%W)-xi)>1||!match(n*4)) continue;
        visited[n] = 1; stack.push(n);
      }
    }

    // Anti-aliasing fringe fix: 8-neighbour expansion for pixels close to the seed
    // colour that were blocked only by soft anti-aliased blending at shape edges.
    const FRINGE_TOL = 70;
    const fringe = new Uint8Array(W*H);
    for (let i = 0; i < W*H; i++) {
      if (!filled[i]) continue;
      const xi = i%W, yi = (i/W)|0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = xi+dx, ny = yi+dy;
          if (nx<0||nx>=W||ny<0||ny>=H) continue;
          const n = ny*W+nx;
          if (filled[n]||fringe[n]) continue;
          const ni = n*4;
          if (Math.abs(data[ni]-tR)<=FRINGE_TOL && Math.abs(data[ni+1]-tG)<=FRINGE_TOL && Math.abs(data[ni+2]-tB)<=FRINGE_TOL)
            fringe[n] = 1;
        }
      }
    }
    for (let i = 0; i < W*H; i++) { if (fringe[i]) filled[i] = 1; }

    const pcData = pc.getImageData(0, 0, A4_W, A4_H);
    for (let i = 0; i < W*H; i++) {
      if (filled[i]) {
        pcData.data[i*4]=fR; pcData.data[i*4+1]=fG; pcData.data[i*4+2]=fB; pcData.data[i*4+3]=255;
      }
    }
    pc.putImageData(pcData, 0, 0);
    render();
  }

  // ── Text tool ──────────────────────────────────────────────
  function placeTextInput(x, y, boxW, boxH) {
    commitText();
    const r = mainCanvas.getBoundingClientRect();
    const scX = r.width/A4_W, scY = r.height/A4_H;
    const ta = document.createElement('textarea');
    ta.className = 'text-input-overlay';
    ta.style.left = (x*scX)+'px'; ta.style.top = (y*scY)+'px';
    ta.style.width = (boxW*scX)+'px'; ta.style.height = (boxH*scY)+'px';
    ta.style.fontFamily = fontFamily; ta.style.fontSize = (fontSize*scY)+'px';
    ta.style.fontWeight = fontBold?'bold':'normal'; ta.style.fontStyle = fontItalic?'italic':'normal';
    ta.style.color = color;
    ta.dataset.cx = x; ta.dataset.cy = y; ta.dataset.bw = boxW;
    canvasWrapper.appendChild(ta); activeTextarea = ta;
    requestAnimationFrame(() => { if (activeTextarea===ta) ta.focus(); });
    function onOutside(e) {
      if (e.target===ta) return;
      document.removeEventListener('pointerdown', onOutside, true); commitText();
    }
    requestAnimationFrame(() => document.addEventListener('pointerdown', onOutside, true));
    ta.addEventListener('input', () => { ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; });
    ta.addEventListener('keydown', e => {
      if (e.key==='Escape') { document.removeEventListener('pointerdown', onOutside, true); ta.remove(); activeTextarea=null; }
    });
  }

  function commitText() {
    if (!activeTextarea) return;
    const ta = activeTextarea, raw = ta.value;
    activeTextarea = null;
    const bw = parseInt(ta.dataset.bw)||0;
    const editId = ta.dataset.editId ? parseInt(ta.dataset.editId) : null;
    if (editId !== null) {
      const obj = objects.find(o => o.id===editId);
      if (obj) {
        obj._editing = false;
        if (raw.trim()) {
          obj.text = raw;
          obj.boxWidth = bw; obj.fontFamily = fontFamily; obj.fontSize = fontSize;
          obj.fontBold = fontBold; obj.fontItalic = fontItalic; obj.fontUnder = fontUnder; obj.color = color;
        } else { objects = objects.filter(o => o.id!==editId); }
      }
      render(); saveState();
    } else if (raw.trim()) {
      objects.push({ id: makeId(), type: 'text',
        x: parseInt(ta.dataset.cx), y: parseInt(ta.dataset.cy), boxWidth: bw,
        text: raw,
        fontFamily, fontSize, fontBold, fontItalic, fontUnder, color });
      render(); saveState();
    }
    if (ta.parentNode) ta.remove();
  }

  function editTextObject(obj) {
    commitText();
    fontFamily=obj.fontFamily; fontSize=obj.fontSize; fontBold=obj.fontBold;
    fontItalic=obj.fontItalic; fontUnder=obj.fontUnder; color=obj.color;
    syncFontUI(); setColor(color);
    textOptSec.style.display = 'block';
    selectedId = null; renderOverlay(); updateSelectUI();

    const r = mainCanvas.getBoundingClientRect();
    const scX = r.width/A4_W, scY = r.height/A4_H;
    const bw = obj.boxWidth || Math.max(getBounds(obj).w+8, 100);
    const bh = Math.max(getBounds(obj).h+8, 32);
    const ta = document.createElement('textarea');
    ta.className = 'text-input-overlay';
    ta.style.left=(obj.x*scX)+'px'; ta.style.top=(obj.y*scY)+'px';
    ta.style.width=(bw*scX)+'px'; ta.style.height=(bh*scY)+'px';
    ta.style.fontFamily=obj.fontFamily; ta.style.fontSize=(obj.fontSize*scY)+'px';
    ta.style.fontWeight=obj.fontBold?'bold':'normal'; ta.style.fontStyle=obj.fontItalic?'italic':'normal';
    ta.style.textDecoration=obj.fontUnder?'underline':'none'; ta.style.color=obj.color;
    ta.value=obj.text; ta.dataset.cx=obj.x; ta.dataset.cy=obj.y; ta.dataset.bw=bw; ta.dataset.editId=obj.id;
    obj._editing = true; render(); canvasWrapper.appendChild(ta); activeTextarea = ta;
    requestAnimationFrame(() => { if (activeTextarea===ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } });
    function onOutside(e) {
      if (e.target===ta) return;
      document.removeEventListener('pointerdown', onOutside, true); commitText();
    }
    requestAnimationFrame(() => document.addEventListener('pointerdown', onOutside, true));
    ta.addEventListener('input', () => { ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; });
    ta.addEventListener('keydown', e => {
      if (e.key==='Escape') {
        document.removeEventListener('pointerdown', onOutside, true);
        obj._editing=false; render(); ta.remove(); activeTextarea=null;
      }
    });
  }

  // ── Select tool ────────────────────────────────────────────
  function syncFontUI() {
    fontFamilySel.value = fontFamily; fontSizeInput.value = fontSize;
    boldBtn.classList.toggle('active', fontBold);
    italicBtn.classList.toggle('active', fontItalic);
    underlineBtn.classList.toggle('active', fontUnder);
  }

  function syncSidebarToTextObj(obj) {
    fontFamily=obj.fontFamily; fontSize=obj.fontSize;
    fontBold=obj.fontBold; fontItalic=obj.fontItalic; fontUnder=obj.fontUnder;
    syncFontUI(); setColor(obj.color);
  }

  function applyFontToSelected() {
    if (tool!=='select'||selectedId===null) return;
    const obj = objects.find(o => o.id===selectedId && o.type==='text');
    if (!obj) return;
    obj.fontFamily=fontFamily; obj.fontSize=fontSize;
    obj.fontBold=fontBold; obj.fontItalic=fontItalic; obj.fontUnder=fontUnder;
    render(); renderOverlay();
  }

  function applyColorToSelected() {
    if (tool!=='select'||selectedId===null) return;
    const obj = objects.find(o => o.id===selectedId);
    if (obj) { obj.color=color; render(); renderOverlay(); }
  }

  function saveSelectedState() {
    if (tool==='select'&&selectedId!==null) saveState();
  }

  function applyResize(obj, handle, dx, dy) {
    const s = resizeSnap;
    switch(handle) {
      case 0: obj.x1=s.x1+dx; obj.y1=s.y1+dy; break;
      case 1: obj.y1=s.y1+dy; break;
      case 2: obj.x2=s.x2+dx; obj.y1=s.y1+dy; break;
      case 3: obj.x2=s.x2+dx; break;
      case 4: obj.x2=s.x2+dx; obj.y2=s.y2+dy; break;
      case 5: obj.y2=s.y2+dy; break;
      case 6: obj.x1=s.x1+dx; obj.y2=s.y2+dy; break;
      case 7: obj.x1=s.x1+dx; break;
    }
  }

  function selectDown(x, y) {
    commitText();
    // Check resize handles on currently selected object
    if (selectedId !== null) {
      const selObj = objects.find(o => o.id===selectedId);
      if (selObj && selObj.type!=='text') {
        const hi = getHandleAt(selObj, x, y);
        if (hi >= 0) {
          isResizing=true; resizeHandle=hi;
          resizeSnap=JSON.parse(JSON.stringify(selObj));
          dragStartX=x; dragStartY=y; isDragging=false; return;
        }
      }
    }
    const hit = [...objects].reverse().find(o => hitTest(o, x, y));
    if (hit) {
      selectedId=hit.id; isDragging=true; isResizing=false;
      dragStartX=x; dragStartY=y;
      dragSnap=JSON.parse(JSON.stringify(hit)); didMove=false;
      if (hit.type==='text') syncSidebarToTextObj(hit);
    } else {
      selectedId=null; isDragging=false; isResizing=false;
    }
    render(); renderOverlay(); updateSelectUI();
  }

  function selectMove(x, y) {
    if (isResizing && selectedId!==null) {
      const obj = objects.find(o => o.id===selectedId);
      if (obj) { applyResize(obj, resizeHandle, x-dragStartX, y-dragStartY); render(); renderOverlay(); }
      return;
    }
    if (!isDragging || selectedId===null) {
      // Update hover cursor
      if (selectedId!==null) {
        const selObj = objects.find(o => o.id===selectedId);
        if (selObj && selObj.type!=='text') {
          const hi = getHandleAt(selObj, x, y);
          if (hi >= 0) { mainCanvas.style.cursor = HANDLE_CURSORS[hi]; return; }
        }
      }
      const hit = [...objects].reverse().find(o => hitTest(o, x, y));
      mainCanvas.style.cursor = hit ? 'move' : 'default';
      return;
    }
    const obj = objects.find(o => o.id===selectedId);
    if (!obj) return;
    const dx=x-dragStartX, dy=y-dragStartY;
    if (obj.type==='text') { obj.x=dragSnap.x+dx; obj.y=dragSnap.y+dy; }
    else { obj.x1=dragSnap.x1+dx; obj.y1=dragSnap.y1+dy; obj.x2=dragSnap.x2+dx; obj.y2=dragSnap.y2+dy; }
    didMove=true; render(); renderOverlay();
  }

  function selectUp() {
    if ((isDragging&&didMove)||isResizing) saveState();
    isDragging=false; isResizing=false; dragSnap=null; resizeSnap=null;
  }

  function deleteSelected() {
    if (selectedId===null) return;
    objects=objects.filter(o => o.id!==selectedId); selectedId=null;
    render(); renderOverlay(); updateSelectUI(); saveState();
  }

  function updateSelectUI() {
    const obj = selectedId!==null ? objects.find(o => o.id===selectedId) : null;
    selectInfoSec.style.display = obj ? 'block' : 'none';
    if (obj && obj.type==='text' && tool==='select') textOptSec.style.display='block';
    else if (tool!=='text') textOptSec.style.display='none';
  }

  // ── Coordinate helper ──────────────────────────────────────
  function getPos(e) {
    const r = mainCanvas.getBoundingClientRect();
    const sx = A4_W/r.width, sy = A4_H/r.height;
    let cx, cy;
    if (e.changedTouches && e.changedTouches.length) { cx=e.changedTouches[0].clientX; cy=e.changedTouches[0].clientY; }
    else if (e.touches && e.touches.length)          { cx=e.touches[0].clientX;        cy=e.touches[0].clientY; }
    else                                              { cx=e.clientX;                   cy=e.clientY; }
    return {
      x: Math.max(0, Math.min(A4_W, Math.round((cx-r.left)*sx))),
      y: Math.max(0, Math.min(A4_H, Math.round((cy-r.top)*sy))),
    };
  }

  // ── Pointer events ─────────────────────────────────────────
  const SHAPE_TOOLS = new Set(['rect','square','ellipse','line','arrow','triangle','hexagon','parallelogram']);

  mainCanvas.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove',  onMove);
  document.addEventListener('mouseup',    onUp);
  mainCanvas.addEventListener('contextmenu', e => e.preventDefault());
  mainCanvas.addEventListener('dblclick', e => {
    if (tool!=='select') return;
    const {x,y} = getPos(e);
    const hit = [...objects].reverse().find(o => o.type==='text' && hitTest(o,x,y));
    if (hit) editTextObject(hit);
  });

  mainCanvas.addEventListener('touchstart', e => {
    if (e.touches.length >= 2) return;
    if (zoom > 1.01) return; // let browser pan when zoomed in
    e.preventDefault(); onDown(e);
  }, {passive:false});
  mainCanvas.addEventListener('touchmove', e => {
    if (e.touches.length >= 2) return;
    if (zoom > 1.01) return; // let browser pan when zoomed in
    e.preventDefault(); onMove(e);
  }, {passive:false});
  mainCanvas.addEventListener('touchend', e => { e.preventDefault(); onUp(e); }, {passive:false});

  function onDown(e) {
    const {x,y} = getPos(e);
    if (tool==='select') { selectDown(x,y); return; }
    if (tool==='fill')   { floodFill(x,y); saveState(); return; }
    if (tool==='text')   { commitText(); drawing=true; startX=x; startY=y; return; }
    drawing=true; startX=x; startY=y; lastX=x; lastY=y;
    if (tool==='pen'||tool==='brush'||tool==='eraser') freehandStart(x,y);
    if (tool==='spray') { doSpray(x,y); sprayTimer=setInterval(()=>{ if(drawing) doSpray(lastX,lastY); },30); }
  }

  function onMove(e) {
    if (!e.touches && e.buttons===0) {
      if (drawing) { onUp(e); return; }
      if (isDragging||isResizing) { selectUp(); return; }
    }
    const {x,y} = getPos(e);
    lastX=x; lastY=y;
    if (tool==='select') { selectMove(x,y); return; }
    if (!drawing) return;
    if (tool==='text') {
      oc.clearRect(0,0,A4_W,A4_H); oc.save();
      oc.strokeStyle='#3a78d4'; oc.lineWidth=1.5; oc.setLineDash([5,3]);
      oc.strokeRect(startX,startY,x-startX,y-startY); oc.setLineDash([]); oc.restore(); return;
    }
    if (tool==='pen'||tool==='brush'||tool==='eraser') freehandMove(x,y);
    if (tool==='spray') doSpray(x,y);
    if (SHAPE_TOOLS.has(tool)) previewShape(startX,startY,x,y);
  }

  function onUp(e) {
    const {x,y} = getPos(e);
    if (tool==='select') { selectUp(); return; }
    if (!drawing) return;
    drawing=false;
    if (tool==='text') {
      oc.clearRect(0,0,A4_W,A4_H);
      placeTextInput(Math.min(startX,x), Math.min(startY,y), Math.max(Math.abs(x-startX),80), Math.max(Math.abs(y-startY),32));
      return;
    }
    if (tool==='spray') { clearInterval(sprayTimer); sprayTimer=null; saveState(); return; }
    if (tool==='pen'||tool==='brush'||tool==='eraser') { freehandEnd(); saveState(); return; }
    if (SHAPE_TOOLS.has(tool)) {
      oc.clearRect(0,0,A4_W,A4_H);
      objects.push({ id:makeId(), type:tool, x1:startX,y1:startY,x2:x,y2:y, color,size:brushSize,style:shapeStyle });
      render(); saveState();
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────
  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag==='TEXTAREA'||tag==='INPUT'||tag==='SELECT') return;
    if ((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))) { e.preventDefault(); redo(); }
    if ((e.key==='Delete'||e.key==='Backspace')&&selectedId!==null) { e.preventDefault(); deleteSelected(); }
    if (e.key==='v'||e.key==='V') selectTool('select');
    if (e.key==='Escape') { selectedId=null; renderOverlay(); updateSelectUI(); }
  });

  // ── Tool selection ─────────────────────────────────────────
  function selectTool(t) {
    commitText();
    if (t!=='select') { selectedId=null; renderOverlay(); updateSelectUI(); }
    tool=t;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.tool===t));
    shapeFillSec.style.display = SHAPE_TOOLS.has(t) ? 'block' : 'none';
    textOptSec.style.display   = t==='text'          ? 'block' : 'none';
    mainCanvas.style.cursor    = t==='select' ? 'default' : 'crosshair';
  }

  // ── Color palette ──────────────────────────────────────────
  function buildPalette() {
    PALETTE.forEach(c => {
      const btn = document.createElement('button');
      btn.className='color-swatch'; btn.style.background=c; btn.dataset.color=c; btn.title=c;
      btn.addEventListener('click', () => { setColor(c); applyColorToSelected(); saveSelectedState(); });
      swatchesEl.appendChild(btn);
    });
  }

  function setColor(c) {
    color=c; colorBox.style.background=c;
    if (/^#[0-9a-f]{6}$/i.test(c)) colorPicker.value=c;
    document.querySelectorAll('.color-swatch').forEach(sw => sw.classList.toggle('selected', sw.dataset.color===c));
  }

  // ── UI wiring ──────────────────────────────────────────────
  document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));

  sizeSlider.addEventListener('input', () => { brushSize=parseInt(sizeSlider.value); sizeDisplay.textContent=brushSize; });

  colorPicker.addEventListener('input',  () => { setColor(colorPicker.value); applyColorToSelected(); });
  colorPicker.addEventListener('change', () => saveSelectedState());

  document.querySelectorAll('.toggle-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); shapeStyle=btn.dataset.fill;
  }));

  fontFamilySel.addEventListener('change', () => { fontFamily=fontFamilySel.value; applyFontToSelected(); saveSelectedState(); });
  fontSizeInput.addEventListener('change', () => { fontSize=Math.max(8,parseInt(fontSizeInput.value)||20); applyFontToSelected(); saveSelectedState(); });

  boldBtn.addEventListener('click', () => { fontBold=!fontBold; boldBtn.classList.toggle('active',fontBold); applyFontToSelected(); saveSelectedState(); });
  italicBtn.addEventListener('click', () => { fontItalic=!fontItalic; italicBtn.classList.toggle('active',fontItalic); applyFontToSelected(); saveSelectedState(); });
  underlineBtn.addEventListener('click', () => { fontUnder=!fontUnder; underlineBtn.classList.toggle('active',fontUnder); applyFontToSelected(); saveSelectedState(); });

  deleteSelBtn.addEventListener('click', deleteSelected);
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear the canvas? This cannot be undone.')) return;
    pc.fillStyle='#ffffff'; pc.fillRect(0,0,A4_W,A4_H);
    objects=[]; selectedId=null; render(); renderOverlay(); updateSelectUI(); saveState();
  });

  exportPng.addEventListener('click', () => {
    commitText(); render();
    const a=document.createElement('a'); a.download='pprblank.png'; a.href=mainCanvas.toDataURL('image/png'); a.click();
  });

  exportJpg.addEventListener('click', () => {
    commitText(); render();
    const tmp=document.createElement('canvas'); tmp.width=A4_W; tmp.height=A4_H;
    const t=tmp.getContext('2d'); t.fillStyle='#ffffff'; t.fillRect(0,0,A4_W,A4_H); t.drawImage(mainCanvas,0,0);
    const a=document.createElement('a'); a.download='pprblank.jpg'; a.href=tmp.toDataURL('image/jpeg',0.95); a.click();
  });

  // ── Zoom slider ────────────────────────────────────────────
  if (zoomSlider) {
    zoomSlider.addEventListener('input', () => {
      const v = parseInt(zoomSlider.value);
      // 1→10%, 100→800%, logarithmic
      const z = 0.1 * Math.pow(80, (v-1)/99);
      setZoom(z);
    });
  }

  // ── Sidebar toggle (mobile) ────────────────────────────────
  function setSidebarOpen(open) {
    sidebar.classList.toggle('open', open);
    if (sidebarHandle) sidebarHandle.classList.toggle('sidebar-open', open);
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', e => { e.stopPropagation(); setSidebarOpen(!sidebar.classList.contains('open')); });
    document.getElementById('canvas-area').addEventListener('pointerdown', () => {
      if (sidebar.classList.contains('open')) setSidebarOpen(false);
    });
  }

  if (sidebarHandle) {
    sidebarHandle.addEventListener('click', e => { e.stopPropagation(); setSidebarOpen(!sidebar.classList.contains('open')); });
  }

  // Auto-close sidebar on mobile after picking a tool
  document.querySelectorAll('.tool-btn').forEach(btn => btn.addEventListener('click', () => {
    if (window.innerWidth <= 700 && sidebar.classList.contains('open')) {
      setTimeout(() => setSidebarOpen(false), 1000);
    }
  }));

  // ── Pinch zoom + pan (mobile) ──────────────────────────────
  let pinchStart = null;

  function syncZoomSlider(z) {
    if (!zoomSlider) return;
    zoomSlider.value = Math.max(1, Math.min(100, Math.round(1 + 99 * Math.log(z / 0.1) / Math.log(80))));
  }

  canvasScroll.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      if (drawing) { freehandEnd(); drawing = false; }
      const t0 = e.touches[0], t1 = e.touches[1];
      pinchStart = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        zoom,
        midX: (t0.clientX + t1.clientX) / 2,
        midY: (t0.clientY + t1.clientY) / 2,
      };
    }
  }, {passive: true});

  canvasScroll.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinchStart) {
      e.preventDefault();
      const t0 = e.touches[0], t1 = e.touches[1];
      const dist  = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      const midX  = (t0.clientX + t1.clientX) / 2;
      const midY  = (t0.clientY + t1.clientY) / 2;
      const scale = dist / pinchStart.dist;
      if (Math.abs(scale - 1) > 0.01) {
        const newZoom = Math.max(0.25, Math.min(4, pinchStart.zoom * scale));
        setZoom(newZoom);
        syncZoomSlider(newZoom);
      }
      canvasScroll.scrollLeft += pinchStart.midX - midX;
      canvasScroll.scrollTop  += pinchStart.midY - midY;
      pinchStart.midX = midX;
      pinchStart.midY = midY;
    }
  }, {passive: false});

  canvasScroll.addEventListener('touchend', e => {
    if (e.touches.length < 2) pinchStart = null;
  }, {passive: true});

  // ── Impressum popup ────────────────────────────────────────
  const impressumBtn   = document.getElementById('impressum-btn');
  const impressumPopup = document.getElementById('impressum-popup');
  if (impressumBtn) {
    impressumBtn.addEventListener('click', e => { e.stopPropagation(); impressumPopup.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!impressumPopup.contains(e.target)) impressumPopup.classList.remove('open'); });
  }

  // ── About popup ────────────────────────────────────────────
  const aboutBtn   = document.getElementById('about-btn');
  const aboutPopup = document.getElementById('about-popup');
  if (aboutBtn) {
    aboutBtn.addEventListener('click', e => { e.stopPropagation(); aboutPopup.classList.toggle('open'); });
    document.addEventListener('click', e => { if (!aboutPopup.contains(e.target)) aboutPopup.classList.remove('open'); });
  }

  // ── Init ───────────────────────────────────────────────────
  buildPalette();
  setColor('#000000');
  selectTool('pen');
  setZoom(1);
  render();
  saveState();

})();
