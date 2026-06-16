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
  const fillTextSection = document.getElementById('fill-text-section');
  const mandalaSection = document.getElementById('mandala-section');
  const mandalaModeBtn = document.getElementById('mandala-mode-btn');
  const drawSection = document.getElementById('draw-section');
  const shapesSection = document.getElementById('shapes-section');
  const selectInfoSec = document.getElementById('select-info');
  const rotateValue   = document.getElementById('rotate-value');
  const rotateLeftBtn = document.getElementById('rotate-left-btn');
  const rotateRightBtn= document.getElementById('rotate-right-btn');
  const deleteSelBtn  = document.getElementById('delete-selected-btn');
  const undoBtn       = document.getElementById('undo-btn');
  const redoBtn       = document.getElementById('redo-btn');
  const clearBtn      = document.getElementById('clear-btn');
  const exportPng     = document.getElementById('export-png');
  const exportJpg     = document.getElementById('export-jpg');
  const canvasWrapper = document.getElementById('canvas-wrapper');
  const zoomSlider    = document.getElementById('zoom-slider');
  const zoomDisplay   = document.getElementById('zoom-display');
  const mandalaBtn    = document.getElementById('mandala-btn');
  const mandalaSlices = document.getElementById('mandala-slices');
  const mandalaValue  = document.getElementById('mandala-value');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar       = document.getElementById('sidebar');
  const sidebarHandle = document.getElementById('sidebar-handle');
  const canvasScroll  = document.getElementById('canvas-scroll');

  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width  = A4_W;
  pixelCanvas.height = A4_H;
  const pc = pixelCanvas.getContext('2d');
  pc.clearRect(0, 0, A4_W, A4_H);

  // ── Tool state ─────────────────────────────────────────────
  let tool       = 'pen';
  let color      = '#000000';
  let brushSize  = 4;
  let shapeStyle = 'outline';
  let fontFamily = 'Arial';
  let mandalaMode = false;
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
  let hoverId      = null;
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
    const { x1, y1, x2, y2, type, color: c, size: s, style: st, angle = 0 } = obj;
    const filled = st === 'filled';
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx1 = x1 - cx, ry1 = y1 - cy;
    const rx2 = x2 - cx, ry2 = y2 - cy;
    ctx.save();
    ctx.translate(cx, cy);
    if (angle) ctx.rotate(angle);
    ctx.strokeStyle = c; ctx.fillStyle = c;
    ctx.lineWidth = s; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    switch (type) {
      case 'rect':
        if (filled) ctx.fillRect(rx1, ry1, rx2-rx1, ry2-ry1);
        ctx.strokeRect(rx1, ry1, rx2-rx1, ry2-ry1);
        break;
      case 'square': {
        const sLen = Math.min(Math.abs(rx2-rx1), Math.abs(ry2-ry1));
        const sx2 = rx1 + Math.sign(rx2-rx1)*sLen;
        const sy2 = ry1 + Math.sign(ry2-ry1)*sLen;
        if (filled) ctx.fillRect(rx1, ry1, sx2-rx1, sy2-ry1);
        ctx.strokeRect(rx1, ry1, sx2-rx1, sy2-ry1);
        break;
      }
      case 'ellipse': {
        const ecx = (rx1 + rx2) / 2;
        const ecy = (ry1 + ry2) / 2;
        const rx = Math.abs(rx2-rx1)/2;
        const ry = Math.abs(ry2-ry1)/2;
        ctx.beginPath();
        ctx.ellipse(ecx, ecy, Math.max(rx,0.5), Math.max(ry,0.5), 0, 0, Math.PI*2);
        if (filled) ctx.fill(); ctx.stroke();
        break;
      }
      case 'line':
        ctx.beginPath(); ctx.moveTo(rx1,ry1); ctx.lineTo(rx2,ry2); ctx.stroke(); break;
      case 'arrow': {
        const a = Math.atan2(ry2-ry1, rx2-rx1), hl = Math.max(18, s*5);
        ctx.beginPath(); ctx.moveTo(rx1,ry1); ctx.lineTo(rx2,ry2);
        ctx.moveTo(rx2,ry2); ctx.lineTo(rx2-hl*Math.cos(a-Math.PI/6), ry2-hl*Math.sin(a-Math.PI/6));
        ctx.moveTo(rx2,ry2); ctx.lineTo(rx2-hl*Math.cos(a+Math.PI/6), ry2-hl*Math.sin(a+Math.PI/6));
        ctx.stroke(); break;
      }
      case 'triangle': {
        const mid = (rx1 + rx2) / 2;
        ctx.beginPath(); ctx.moveTo(mid,ry1); ctx.lineTo(rx2,ry2); ctx.lineTo(rx1,ry2);
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'hexagon': {
        const ecx = (rx1 + rx2) / 2;
        const ecy = (ry1 + ry2) / 2;
        const rx = Math.abs(rx2-rx1)/2;
        const ry = Math.abs(ry2-ry1)/2;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI/3)*k;
          const hx = ecx + rx*Math.cos(a), hy = ecy + ry*Math.sin(a);
          k === 0 ? ctx.moveTo(hx,hy) : ctx.lineTo(hx,hy);
        }
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'parallelogram': {
        const bx = Math.min(rx1, rx2), by = Math.min(ry1, ry2);
        const bw = Math.abs(rx2-rx1), bh = Math.abs(ry2-ry1);
        const skew = bw * 0.25;
        ctx.beginPath();
        ctx.moveTo(bx+skew, by); ctx.lineTo(bx+bw, by);
        ctx.lineTo(bx+bw-skew, by+bh); ctx.lineTo(bx, by+bh);
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'star': {
        const ecx = (rx1 + rx2) / 2;
        const ecy = (ry1 + ry2) / 2;
        const outer = Math.min(Math.abs(rx2-rx1), Math.abs(ry2-ry1)) / 2;
        const inner = outer * 0.45;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outer : inner;
          const a = Math.PI/2 + i * Math.PI / 5;
          const px = ecx + r * Math.cos(a);
          const py = ecy - r * Math.sin(a);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); if (filled) ctx.fill(); ctx.stroke(); break;
      }
      case 'curve': {
        const ctrlX1 = rx1 + (rx2 - rx1) * 0.4;
        const ctrlY1 = ry1 - Math.abs(ry2 - ry1) * 0.4;
        const ctrlX2 = rx1 + (rx2 - rx1) * 0.6;
        const ctrlY2 = ry2 + Math.abs(ry2 - ry1) * 0.4;
        ctx.beginPath();
        ctx.moveTo(rx1, ry1);
        ctx.bezierCurveTo(ctrlX1, ctrlY1, ctrlX2, ctrlY2, rx2, ry2);
        ctx.stroke(); break;
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
    let maxW = obj.boxWidth || 20;
    if (!obj.boxWidth) lines.forEach(line => { const w = ctx.measureText(line).width; if (w > maxW) maxW = w; });
    const totalH = lines.length * lineH;
    const angle = obj.angle || 0;
    if (angle) {
      ctx.translate(obj.x + maxW / 2, obj.y + totalH / 2);
      ctx.rotate(angle);
      ctx.translate(-maxW / 2, -totalH / 2);
    }
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, i * lineH);
      if (obj.fontUnder) {
        const tw = ctx.measureText(line).width;
        const uy = i * lineH + obj.fontSize + 2;
        ctx.beginPath(); ctx.strokeStyle = obj.color;
        ctx.lineWidth = Math.max(1, obj.fontSize / 14);
        ctx.moveTo(0, uy); ctx.lineTo(tw, uy); ctx.stroke();
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
      return getRotatedBounds({ x: obj.x, y: obj.y, w: maxW, h: lines.length * obj.fontSize * 1.3 }, obj.angle || 0);
    }
    const { x1, y1, x2, y2, type } = obj;
    if (type === 'square') {
      const sLen = Math.min(Math.abs(x2-x1), Math.abs(y2-y1));
      const sx2 = x1+Math.sign(x2-x1)*sLen, sy2 = y1+Math.sign(y2-y1)*sLen;
      return { x: Math.min(x1,sx2), y: Math.min(y1,sy2), w: sLen, h: sLen };
    }
    if (type === 'star' || type === 'curve') {
      return getRotatedBounds({ x: Math.min(x1,x2), y: Math.min(y1,y2), w: Math.abs(x2-x1), h: Math.abs(y2-y1) }, obj.angle || 0);
    }
    return getRotatedBounds({ x: Math.min(x1,x2), y: Math.min(y1,y2), w: Math.abs(x2-x1), h: Math.abs(y2-y1) }, obj.angle || 0);
  }

  function hitTest(obj, x, y) {
    const b = getBounds(obj);
    const base = Math.max(10, (obj.size||1)/2 + 8);
    const pad = obj.type === 'line' || obj.type === 'arrow' || obj.type === 'curve' ? base + 10 : base + 6;
    return x>=b.x-pad && x<=b.x+b.w+pad && y>=b.y-pad && y<=b.y+b.h+pad;
  }

  function getRotatedBounds(rect, angle) {
    if (!angle) return rect;
    const cx = rect.x + rect.w/2;
    const cy = rect.y + rect.h/2;
    const corners = [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.w, y: rect.y },
      { x: rect.x + rect.w, y: rect.y + rect.h },
      { x: rect.x, y: rect.y + rect.h },
    ];
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const pts = corners.map(p => {
      const rx = p.x - cx;
      const ry = p.y - cy;
      return { x: cx + rx * cosA - ry * sinA, y: cy + rx * sinA + ry * cosA };
    });
    const xs = pts.map(p => p.x);
    const ys = pts.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
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
    if (hoverId !== null && hoverId !== selectedId) {
      const hoverObj = objects.find(o => o.id === hoverId);
      if (hoverObj) drawHoverBox(hoverObj);
    }
    if (selectedId !== null) {
      const obj = objects.find(o => o.id === selectedId);
      if (obj) drawSelectionBox(obj);
    }
  }

  function drawHoverBox(obj) {
    const b = getBounds(obj), pad = 10;
    const label = obj.type.replace(/([a-z])([A-Z])/g, '$1 $2');
    const text = label.charAt(0).toUpperCase() + label.slice(1);
    oc.save();
    oc.strokeStyle = 'rgba(58,120,212,0.65)'; oc.lineWidth = 2; oc.setLineDash([4,4]);
    oc.strokeRect(b.x-pad, b.y-pad, b.w+pad*2, b.h+pad*2);
    oc.setLineDash([]);
    oc.font = '14px Arial';
    oc.textBaseline = 'top';
    const textWidth = oc.measureText(text).width;
    const labelX = b.x - pad;
    const labelY = b.y - pad - 22;
    oc.fillStyle = 'rgba(58,120,212,0.9)';
    oc.fillRect(labelX - 4, labelY - 4, textWidth + 10, 22);
    oc.fillStyle = '#ffffff';
    oc.fillText(text, labelX + 1, labelY + 1);
    oc.restore();
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
        fontFamily, fontSize, fontBold, fontItalic, fontUnder, color,
        angle: 0 });
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

  // ── Mandala palettes (100+ color schemes) ──────────────────
  const mandalaColorPalettes = [
    ['#3a78d4','#e53935','#f9a825','#43a047','#5e35b1'], // Original
    ['#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#98D8C8'], // Coral Dream
    ['#2C3E50','#E74C3C','#ECF0F1','#3498DB','#9B59B6'], // Dark Modern
    ['#F38181','#AA96DA','#FCBAD3','#A8DADC','#457B9D'], // Pastel
    ['#1B1B3F','#16213E','#E94560','#FF6B9D','#C44569'], // Deep Purple
    ['#2D6A4F','#40916C','#52B788','#95D5B2','#D8F3DC'], // Forest
    ['#A23B72','#F18F01','#C73E1D','#6A994E','#BC4749'], // Warm Earthy
    ['#0D1117','#1F6FEB','#58A6FF','#79C0FF','#D2DAFF'], // Github Dark
    ['#FFB703','#FB8500','#8ECAE6','#219EBC','#023047'], // Ocean Blue
    ['#5D3A1A','#E8B4B8','#A55C7F','#DBADBC','#FFF1E6'], // Vintage
    ['#390099','#9D0208','#FF006E','#FFBE0B','#8338EC'], // Neon
    ['#264653','#2A9D8F','#E9C46A','#F4A261','#E76F51'], // Warm Retro
    ['#1D3557','#457B9D','#A8DADC','#F1FAEE','#E63946'], // Nautical
    ['#EF476F','#FFD166','#06D6A0','#118AB2','#073B4C'], // Bold Primary
    ['#6D4C41','#9CCC65','#FFCA28','#EF5350','#AB47BC'], // Earth Tones
    ['#C41E3A','#FFC72C','#003DA5','#FFB612','#FDB913'], // USA Patriotic
    ['#E0115F','#FF1493','#FF69B4','#FFB6C1','#FFC0CB'], // Hot Pink
    ['#00008B','#0000CD','#4169E1','#87CEEB','#ADD8E6'], // Blues
    ['#FF8C00','#FFA500','#FFD700','#FFFF00','#FFFFE0'], // Warm Yellows
    ['#2E0854','#A6192E','#FFB612','#001B48','#F9A825'], // University Colors
  ];

  // ── Mandala pattern generators (20 algorithms) ──────────────
  const mandalaPatterns = [
    // Pattern 1: Classic Wedges (original)
    function(ctx, cx, cy, r, slices, colors) {
      const br = r / 5, step = Math.PI * 2 / slices;
      for (let ring = 0; ring < 5; ring++) {
        const r1 = br * (ring + 1.2), r2 = br * (ring + 1.8);
        for (let i = 0; i < slices; i++) {
          const a = i * step, next = a + step;
          ctx.beginPath();
          ctx.moveTo(r1 * Math.cos(a), r1 * Math.sin(a));
          ctx.lineTo(r2 * Math.cos(a + step * 0.4), r2 * Math.sin(a + step * 0.4));
          ctx.lineTo(r2 * Math.cos(next - step * 0.4), r2 * Math.sin(next - step * 0.4));
          ctx.closePath();
          ctx.fillStyle = colors[(ring + i) % colors.length];
          ctx.fill();
        }
      }
      ctx.beginPath(); ctx.arc(0, 0, br * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = colors[0]; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < slices; i++) { const a = i * step; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r * Math.cos(a), r * Math.sin(a)); ctx.stroke(); }
    },
    // Pattern 2: Spiral Petals
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let ring = 0; ring < 8; ring++) {
        const rad = r * (ring / 8);
        for (let i = 0; i < slices; i++) {
          const a = i * step + ring * 0.3;
          const x = rad * Math.cos(a), y = rad * Math.sin(a);
          ctx.fillStyle = colors[(ring + i) % colors.length];
          ctx.beginPath(); ctx.arc(x, y, (r / slices) * 0.6, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
    // Pattern 3: Concentric Circles
    function(ctx, cx, cy, r, slices, colors) {
      for (let ring = 0; ring < 10; ring++) {
        ctx.strokeStyle = colors[ring % colors.length];
        ctx.lineWidth = r / 20;
        ctx.beginPath();
        ctx.arc(0, 0, r * (ring / 10), 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    // Pattern 4: Flower Petals
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let i = 0; i < slices; i++) {
        const a = i * step;
        const cx1 = r * 0.6 * Math.cos(a);
        const cy1 = r * 0.6 * Math.sin(a);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.ellipse(cx1, cy1, r * 0.3, r * 0.15, a, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    // Pattern 5: Star Burst
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let i = 0; i < slices; i++) {
        const a = i * step;
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
        ctx.stroke();
      }
      for (let ring = 1; ring <= 5; ring++) {
        ctx.strokeStyle = colors[ring % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r * (ring / 5), 0, Math.PI * 2);
        ctx.stroke();
      }
    },
    // Pattern 6: Triangular Grid
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let ring = 0; ring < 6; ring++) {
        const rad = r * (ring / 6);
        for (let i = 0; i < slices; i++) {
          const a = i * step;
          const x = rad * Math.cos(a), y = rad * Math.sin(a);
          ctx.fillStyle = colors[(ring + i) % colors.length];
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 8, y + 5);
          ctx.lineTo(x - 8, y + 5);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    // Pattern 7: Nested Squares
    function(ctx, cx, cy, r, slices, colors) {
      for (let ring = 0; ring < 8; ring++) {
        const size = r * (ring / 8);
        ctx.strokeStyle = colors[ring % colors.length];
        ctx.lineWidth = 2;
        ctx.strokeRect(-size, -size, size * 2, size * 2);
      }
    },
    // Pattern 8: Curved Ribbons
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let i = 0; i < slices; i++) {
        const a = i * step;
        ctx.strokeStyle = colors[i % colors.length];
        ctx.lineWidth = r / 15;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, a, a + step * 0.9);
        ctx.stroke();
      }
    },
    // Pattern 9: Radial Waves
    function(ctx, cx, cy, r, slices, colors) {
      for (let w = 0; w < 6; w++) {
        const rad = r * (w / 6);
        ctx.strokeStyle = colors[w % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= slices; i++) {
          const a = (i / slices) * Math.PI * 2;
          const dist = rad + Math.sin(a * 4) * (r * 0.1);
          const x = dist * Math.cos(a);
          const y = dist * Math.sin(a);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    },
    // Pattern 10: Dot Grid
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let ring = 0; ring < 7; ring++) {
        const rad = r * (ring / 7);
        for (let i = 0; i < slices; i++) {
          const a = i * step;
          const x = rad * Math.cos(a), y = rad * Math.sin(a);
          ctx.fillStyle = colors[(ring + i) % colors.length];
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    // Pattern 11: Stacked Rings
    function(ctx, cx, cy, r, slices, colors) {
      for (let ring = 0; ring < 12; ring++) {
        ctx.fillStyle = colors[ring % colors.length];
        ctx.beginPath();
        ctx.arc(0, 0, r * ((ring + 1) / 12), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    },
    // Pattern 12: Geometric Diamonds
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let ring = 0; ring < 5; ring++) {
        const rad = r * (ring / 5);
        for (let i = 0; i < slices; i++) {
          const a = i * step;
          const x = rad * Math.cos(a), y = rad * Math.sin(a);
          ctx.fillStyle = colors[(ring + i) % colors.length];
          ctx.beginPath();
          ctx.moveTo(x + 6, y);
          ctx.lineTo(x, y + 6);
          ctx.lineTo(x - 6, y);
          ctx.lineTo(x, y - 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    // Pattern 13: Spiral Galaxy
    function(ctx, cx, cy, r, slices, colors) {
      for (let i = 0; i < 200; i++) {
        const a = (i / 200) * Math.PI * 4;
        const rad = r * (i / 200);
        const x = rad * Math.cos(a), y = rad * Math.sin(a);
        ctx.fillStyle = colors[Math.floor((i / 200) * colors.length) % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    // Pattern 14: Chakra Layers
    function(ctx, cx, cy, r, slices, colors) {
      for (let ring = 0; ring < colors.length; ring++) {
        ctx.fillStyle = colors[ring];
        const innerR = r * (ring / colors.length);
        const outerR = r * ((ring + 1) / colors.length);
        ctx.beginPath();
        ctx.arc(0, 0, outerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, innerR, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    // Pattern 15: Hexagon Honeycomb
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / 6;
      const rings = 4;
      for (let ring = 0; ring < rings; ring++) {
        const rad = r * (ring / rings);
        for (let i = 0; i < 6; i++) {
          const a = i * step;
          const x = rad * Math.cos(a), y = rad * Math.sin(a);
          ctx.fillStyle = colors[(ring + i) % colors.length];
          ctx.beginPath();
          for (let j = 0; j < 6; j++) {
            const ha = (j / 6) * Math.PI * 2;
            const hx = x + 10 * Math.cos(ha), hy = y + 10 * Math.sin(ha);
            j === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    },
    // Pattern 16: Organic Blobs
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let i = 0; i < slices; i++) {
        const a = i * step;
        const rad = r * (0.5 + Math.sin(a * 3) * 0.3);
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(rad * Math.cos(a), rad * Math.sin(a), r * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    // Pattern 17: Kaleidoscope Triangles
    function(ctx, cx, cy, r, slices, colors) {
      const step = Math.PI * 2 / slices;
      for (let i = 0; i < slices; i++) {
        const a = i * step;
        const a1 = a + step * 0.5;
        const a2 = a + step;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * Math.cos(a1), r * Math.sin(a1));
        ctx.lineTo(r * 0.7 * Math.cos(a2), r * 0.7 * Math.sin(a2));
        ctx.closePath();
        ctx.fill();
      }
    },
    // Pattern 18: Rose Curve
    function(ctx, cx, cy, r, slices, colors) {
      const k = slices / 3;
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 360; i += 2) {
        const theta = (i * Math.PI) / 180;
        const rho = r * Math.cos(k * theta);
        const x = rho * Math.cos(theta);
        const y = rho * Math.sin(theta);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
    // Pattern 19: Rings and Spokes
    function(ctx, cx, cy, r, slices, colors) {
      for (let ring = 0; ring < 6; ring++) {
        ctx.strokeStyle = colors[ring % colors.length];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r * (ring / 6), 0, Math.PI * 2);
        ctx.stroke();
      }
      const step = Math.PI * 2 / slices;
      for (let i = 0; i < slices; i++) {
        const a = i * step;
        ctx.strokeStyle = colors[(i + slices) % colors.length];
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r * 0.9 * Math.cos(a), r * 0.9 * Math.sin(a));
        ctx.stroke();
      }
    },
    // Pattern 20: Fractal Spirals
    function(ctx, cx, cy, r, slices, colors) {
      const drawSpiral = (x, y, size, depth) => {
        if (depth === 0) return;
        ctx.fillStyle = colors[depth % colors.length];
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        const step = Math.PI * 2 / 3;
        for (let i = 0; i < 3; i++) {
          const a = i * step;
          const nx = x + size * Math.cos(a);
          const ny = y + size * Math.sin(a);
          drawSpiral(nx, ny, size * 0.5, depth - 1);
        }
      };
      drawSpiral(0, 0, r * 0.3, 4);
    }
  ];

  let mandalaPatternIndex = 0;
  let mandalaColorIndex = 0;

  function drawMandala(centerX, centerY, radius, slices) {
    pc.save();
    pc.translate(centerX, centerY);
    const pattern = mandalaPatterns[mandalaPatternIndex % mandalaPatterns.length];
    const colors = mandalaColorPalettes[mandalaColorIndex % mandalaColorPalettes.length];
    pattern(pc, centerX, centerY, radius, slices, colors);
    pc.restore();
  }

  function generateMandala() {
    commitText();
    const count = parseInt(mandalaSlices.value, 10) || 12;
    const maxR = Math.min(A4_W, A4_H) * 0.42;
    pc.fillStyle = '#ffffff';
    pc.fillRect(0, 0, A4_W, A4_H);
    drawMandala(A4_W/2, A4_H/2, maxR, count);
    render();
    saveState();
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
    const hit = [...objects].reverse().find(o => o.id!==selectedId && hitTest(o, x, y));
    if (hit) {
      selectedId=hit.id; isDragging=true; isResizing=false;
      dragStartX=x; dragStartY=y;
      dragSnap=JSON.parse(JSON.stringify(hit)); didMove=false;
      if (hit.type==='text') syncSidebarToTextObj(hit);
    } else if (selectedId !== null) {
      const selObj = objects.find(o => o.id===selectedId && hitTest(o, x, y));
      if (selObj) {
        isDragging=true; isResizing=false;
        dragStartX=x; dragStartY=y;
        dragSnap=JSON.parse(JSON.stringify(selObj)); didMove=false;
      } else {
        selectedId=null; isDragging=false; isResizing=false;
      }
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
      // Update hover cursor and preview highlight
      hoverId = null;
      if (selectedId!==null) {
        const selObj = objects.find(o => o.id===selectedId);
        if (selObj && selObj.type!=='text') {
          const hi = getHandleAt(selObj, x, y);
          if (hi >= 0) { mainCanvas.style.cursor = HANDLE_CURSORS[hi]; return; }
        }
      }
      const hit = [...objects].reverse().find(o => hitTest(o, x, y));
      hoverId = hit ? hit.id : null;
      mainCanvas.style.cursor = hit ? 'move' : 'default';
      renderOverlay();
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

  function duplicateSelected() {
    if (selectedId===null) return;
    const obj = objects.find(o => o.id===selectedId);
    if (!obj) return;
    const copy = JSON.parse(JSON.stringify(obj));
    copy.id = makeId();
    if (copy.type === 'text') {
      copy.x += 20;
      copy.y += 20;
    } else {
      copy.x1 += 20; copy.y1 += 20;
      copy.x2 += 20; copy.y2 += 20;
    }
    objects.push(copy);
    selectedId = copy.id;
    render(); renderOverlay(); updateSelectUI(); saveState();
  }

  function updateSelectUI() {
    const obj = selectedId!==null ? objects.find(o => o.id===selectedId) : null;
    selectInfoSec.style.display = obj ? 'block' : 'none';
    if (obj && obj.type==='text' && tool==='select') textOptSec.style.display='block';
    else if (tool!=='text') textOptSec.style.display='none';
    if (obj && rotateValue) rotateValue.textContent = Math.round((obj.angle || 0) * 180 / Math.PI) + '°';
  }

  function rotateSelected(deltaDegrees) {
    if (selectedId === null) return;
    const obj = objects.find(o => o.id===selectedId);
    if (!obj) return;
    const delta = deltaDegrees * Math.PI / 180;
    obj.angle = ((obj.angle || 0) + delta) % (2 * Math.PI);
    if (obj.angle < 0) obj.angle += 2 * Math.PI;
    render(); renderOverlay(); updateSelectUI(); saveState();
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
  const SHAPE_TOOLS = new Set(['rect','square','ellipse','line','arrow','triangle','hexagon','parallelogram','star','curve']);

  mainCanvas.addEventListener('mousedown', onDown);
  document.addEventListener('mousemove',  onMove);
  document.addEventListener('mouseup',    onUp);
  mainCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const {x,y} = getPos(e);
    if (tool==='select' && selectedId !== null) {
      const selectedObj = objects.find(o => o.id === selectedId);
      if (selectedObj && hitTest(selectedObj, x, y)) {
        duplicateSelected();
      }
    }
  });
  mainCanvas.addEventListener('dblclick', e => {
    if (tool!=='select') return;
    const {x,y} = getPos(e);
    const hit = [...objects].reverse().find(o => hitTest(o, x, y));
    if (!hit) return;
    selectedId = hit.id;
    renderOverlay(); updateSelectUI();
    if (hit.type === 'text') editTextObject(hit);
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
    if (e.button === 2) return;
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
      objects.push({ id:makeId(), type:tool, x1:startX,y1:startY,x2:x,y2:y, color,size:brushSize,style:shapeStyle, angle: 0 });
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
    if (!t) return;
    commitText();
    if (t!=='select') { selectedId=null; renderOverlay(); updateSelectUI(); }
    tool=t;
    document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool===t));
    shapeFillSec.style.display = (SHAPE_TOOLS.has(t) && !mandalaMode) ? 'block' : 'none';
    textOptSec.style.display   = t==='text'          ? 'block' : 'none';
    mainCanvas.style.cursor    = t==='select' ? 'default' : 'crosshair';
  }

  function setMandalaMode(enabled) {
    mandalaMode = enabled;
    if (mandalaModeBtn) {
      mandalaModeBtn.classList.toggle('active', enabled);
      // change label when in mandala mode so user can switch back to sketch/main page
      mandalaModeBtn.textContent = enabled ? 'Sketch mode' : '☸ Mandala';
      mandalaModeBtn.title = enabled ? 'Return to Sketch mode' : 'Mandala mode';
    }
    if (sidebar) sidebar.classList.toggle('mandala-mode', enabled);
    if (mandalaSection) mandalaSection.style.display = enabled ? 'block' : 'none';
    if (fillTextSection) fillTextSection.style.display = enabled ? 'none' : 'block';
    if (drawSection) drawSection.style.display = 'block';
    if (shapesSection) shapesSection.style.display = 'block';
    if (enabled) {
      shapeStyle = 'outline';
      shapeFillSec.style.display = 'none';
      document.querySelectorAll('.toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.fill === 'outline'));
    } else {
      shapeFillSec.style.display = SHAPE_TOOLS.has(tool) ? 'block' : 'none';
    }

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      const toolName = btn.dataset.tool;
      const allowed = ['pen','brush','spray','eraser','rect','square','ellipse','line','arrow','triangle','hexagon','parallelogram','star','curve','select'];
      btn.style.display = enabled ? (allowed.includes(toolName) ? '' : 'none') : '';
    });

    if (enabled && !['pen','brush','spray','eraser','select','rect','square','ellipse','line','arrow','triangle','hexagon','parallelogram','star','curve'].includes(tool)) {
      selectTool('pen');
    }
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
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => btn.addEventListener('click', () => selectTool(btn.dataset.tool)));
  if (mandalaModeBtn) mandalaModeBtn.addEventListener('click', () => setMandalaMode(!mandalaMode));

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

  if (mandalaBtn && mandalaSlices && mandalaValue) {
    mandalaBtn.addEventListener('click', generateMandala);
    mandalaSlices.addEventListener('input', () => {
      mandalaValue.textContent = mandalaSlices.value;
    });
  }

  const mandalaPattern = document.getElementById('mandala-pattern');
  const mandalaDesign = document.getElementById('mandala-design');
  if (mandalaPattern) mandalaPattern.addEventListener('change', (e) => { mandalaPatternIndex = parseInt(e.target.value); });
  if (mandalaDesign) mandalaDesign.addEventListener('change', (e) => { mandalaColorIndex = parseInt(e.target.value); });

  if (rotateLeftBtn) rotateLeftBtn.addEventListener('click', () => rotateSelected(-5));
  if (rotateRightBtn) rotateRightBtn.addEventListener('click', () => rotateSelected(5));

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

  // ── Mouse wheel zoom ───────────────────────────────────────
  canvasScroll.addEventListener('wheel', e => {
    if (e.ctrlKey) return;
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const factor = direction * 0.08;
    const newZoom = Math.max(0.25, Math.min(8, zoom * (1 + factor)));
    setZoom(newZoom);
    syncZoomSlider(newZoom);
  }, { passive: false });

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
        const newZoom = Math.max(0.25, Math.min(8, pinchStart.zoom * scale));
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
  setMandalaMode(false);
  selectTool('pen');
  setZoom(1);
  render();
  saveState();

})();
