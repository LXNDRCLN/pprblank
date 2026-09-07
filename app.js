(function () {
  'use strict';

  const A4_W = 794;
  const A4_H = 1123;
  const dpr  = Math.min(Math.ceil(window.devicePixelRatio || 1), 2);

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
  const modeSketchBtn = document.getElementById('mode-sketch-btn');
  const modeMandalaBtn = document.getElementById('mode-mandala-btn');
  const selectSection = document.getElementById('select-section');
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
  let brushSize  = 1;
  let shapeStyle = 'outline';
  let fontFamily = 'Arial';
  let mandalaMode = false;
  let mandalaSnapshot = null; // persists mandala canvas across mode switches
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
  mainCanvas.width    = A4_W * dpr;  mainCanvas.height   = A4_H * dpr;
  overlayCanvas.width = A4_W * dpr;  overlayCanvas.height = A4_H * dpr;
  mc.scale(dpr, dpr);
  oc.scale(dpr, dpr);
  mc.imageSmoothingEnabled = true;
  mc.imageSmoothingQuality = 'high';

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
    mc.drawImage(pixelCanvas, 0, 0, A4_W, A4_H);
    objects.forEach(obj => drawObject(mc, obj));
  }

  function drawObject(ctx, obj) {
    if (obj.type === 'text') drawTextObj(ctx, obj);
    else                     drawShapeObj(ctx, obj);
  }

  function drawShapeObj(ctx, obj) {
    if (obj.type === 'triangle' && obj.pts) {
      const [p0, p1, p2] = obj.pts;
      const filled = obj.style === 'filled';
      const tcx = (p0.x + p1.x + p2.x) / 3, tcy = (p0.y + p1.y + p2.y) / 3;
      ctx.save();
      ctx.translate(tcx, tcy);
      if (obj.angle) ctx.rotate(obj.angle);
      ctx.strokeStyle = obj.color; ctx.fillStyle = obj.color;
      ctx.lineWidth = obj.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(p0.x - tcx, p0.y - tcy);
      ctx.lineTo(p1.x - tcx, p1.y - tcy);
      ctx.lineTo(p2.x - tcx, p2.y - tcy);
      ctx.closePath();
      if (filled) ctx.fill(); ctx.stroke();
      ctx.restore();
      return;
    }
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
    if (obj.type === 'triangle' && obj.pts) {
      const xs = obj.pts.map(p => p.x), ys = obj.pts.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
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
    if (obj.type === 'triangle' && obj.pts) return obj.pts.map(p => [p.x, p.y]);
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
    if (points.length === 1) {
      pc.beginPath();
      pc.arc(points[0].x, points[0].y, Math.max(pc.lineWidth / 2, 0.5), 0, Math.PI * 2);
      pc.fill();
      return;
    }
    pc.beginPath();
    pc.moveTo(points[0].x, points[0].y);
    if (points.length === 2) { pc.lineTo(points[1].x, points[1].y); pc.stroke(); return; }
    // Catmull-Rom → cubic Bezier: passes through every recorded point for smooth natural curves
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0               ? points[0]               : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2]           : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      pc.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    pc.stroke();
  }

  function freehandStart(x, y) {
    strokePoints = [{x, y}];
    strokeSnapshot = pc.getImageData(0, 0, A4_W, A4_H);
    if (tool === 'eraser') eraseObjectsAt(x, y);
  }

  function freehandMove(x, y) {
    const lp = strokePoints[strokePoints.length - 1];
    if (Math.hypot(x - lp.x, y - lp.y) < 1.5) return;
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

  function pointInTriangle(px, py, ax, ay, bx, by, cx2, cy2) {
    const d1=(px-bx)*(ay-by)-(ax-bx)*(py-by);
    const d2=(px-cx2)*(by-cy2)-(bx-cx2)*(py-cy2);
    const d3=(px-ax)*(cy2-ay)-(cx2-ax)*(py-ay);
    return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
  }

  function pointInPolygon(px, py, pts) {
    let inside=false;
    for (let i=0,j=pts.length-1; i<pts.length; j=i++) {
      const xi=pts[i].x,yi=pts[i].y,xj=pts[j].x,yj=pts[j].y;
      if (((yi>py)!==(yj>py))&&px<(xj-xi)*(py-yi)/(yj-yi)+xi) inside=!inside;
    }
    return inside;
  }

  function pointInShape(o, px, py) {
    if (o.type==='text'||o.type==='line'||o.type==='arrow'||o.type==='curve') return false;
    if (o.type==='triangle'&&o.pts) {
      const [p0,p1,p2]=o.pts;
      const tcx=(p0.x+p1.x+p2.x)/3, tcy=(p0.y+p1.y+p2.y)/3;
      let lx=px-tcx, ly=py-tcy;
      if (o.angle) { const c=Math.cos(-o.angle),s=Math.sin(-o.angle); [lx,ly]=[lx*c-ly*s,lx*s+ly*c]; }
      return pointInTriangle(lx,ly, p0.x-tcx,p0.y-tcy, p1.x-tcx,p1.y-tcy, p2.x-tcx,p2.y-tcy);
    }
    const {x1,y1,x2,y2,angle=0}=o;
    const cx=(x1+x2)/2, cy=(y1+y2)/2;
    let lx=px-cx, ly=py-cy;
    if (angle) { const c=Math.cos(-angle),s=Math.sin(-angle); [lx,ly]=[lx*c-ly*s,lx*s+ly*c]; }
    const rx1=x1-cx, ry1=y1-cy, rx2=x2-cx, ry2=y2-cy;
    switch (o.type) {
      case 'rect': return lx>=Math.min(rx1,rx2)&&lx<=Math.max(rx1,rx2)&&ly>=Math.min(ry1,ry2)&&ly<=Math.max(ry1,ry2);
      case 'square': { const sLen=Math.min(Math.abs(rx2-rx1),Math.abs(ry2-ry1)); const sx2=rx1+Math.sign(rx2-rx1)*sLen,sy2=ry1+Math.sign(ry2-ry1)*sLen; return lx>=Math.min(rx1,sx2)&&lx<=Math.max(rx1,sx2)&&ly>=Math.min(ry1,sy2)&&ly<=Math.max(ry1,sy2); }
      case 'ellipse': { const ecx=(rx1+rx2)/2,ecy=(ry1+ry2)/2,rx=Math.abs(rx2-rx1)/2,ry=Math.abs(ry2-ry1)/2; if(rx<0.5||ry<0.5) return false; const dx=(lx-ecx)/rx,dy=(ly-ecy)/ry; return dx*dx+dy*dy<=1; }
      case 'triangle': { const mid=(rx1+rx2)/2; return pointInTriangle(lx,ly, mid,ry1, rx2,ry2, rx1,ry2); }
      case 'hexagon': { const ecx=(rx1+rx2)/2,ecy=(ry1+ry2)/2,hrx=Math.abs(rx2-rx1)/2,hry=Math.abs(ry2-ry1)/2; const pts=[]; for(let k=0;k<6;k++){const a=(Math.PI/3)*k; pts.push({x:ecx+hrx*Math.cos(a),y:ecy+hry*Math.sin(a)});} return pointInPolygon(lx,ly,pts); }
      case 'parallelogram': { const bx=Math.min(rx1,rx2),by=Math.min(ry1,ry2),bw=Math.abs(rx2-rx1),bh=Math.abs(ry2-ry1),skew=bw*0.25; return pointInPolygon(lx,ly,[{x:bx+skew,y:by},{x:bx+bw,y:by},{x:bx+bw-skew,y:by+bh},{x:bx,y:by+bh}]); }
      case 'star': { const ecx=(rx1+rx2)/2,ecy=(ry1+ry2)/2,outer=Math.min(Math.abs(rx2-rx1),Math.abs(ry2-ry1))/2,inner=outer*0.45; const pts=[]; for(let i=0;i<10;i++){const r=i%2===0?outer:inner,a=Math.PI/2+i*Math.PI/5; pts.push({x:ecx+r*Math.cos(a),y:ecy-r*Math.sin(a)});} return pointInPolygon(lx,ly,pts); }
      default: return false;
    }
  }

  function floodFill(px, py) {
    // Recolor a filled shape only when no outline shape is also at the click point.
    if (!objects.some(o => o.style !== 'filled' && pointInShape(o, px, py))) {
      const hit = [...objects].reverse().find(o => o.style === 'filled' && pointInShape(o, px, py));
      if (hit) { hit.color = color; render(); return; }
    }

    const W = A4_W, H = A4_H;
    const ipx = Math.round(px), ipy = Math.round(py);
    if (ipx < 0 || ipx >= W || ipy < 0 || ipy >= H) return;

    // BFS composite: render all shapes with min 2px stroke. A 4-directional BFS cannot cross
    // a 2px solid stroke, so every visible outline (including strokes from OTHER shapes that
    // cross through the fill region) acts as a hard barrier. This lets any closed area formed
    // by crossing shape strokes fill correctly as an independent region.
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    const tc = tmp.getContext('2d');
    tc.fillStyle = '#ffffff'; tc.fillRect(0, 0, W, H);
    tc.drawImage(pixelCanvas, 0, 0);
    objects.forEach(obj => drawObject(tc, (obj.size || 1) >= 2 ? obj : Object.assign({}, obj, { size: 2 })));

    const imgData = tc.getImageData(0, 0, W, H);
    const data = imgData.data;
    const startIdx = ipy * W + ipx;
    const tR = data[startIdx * 4], tG = data[startIdx * 4 + 1], tB = data[startIdx * 4 + 2];
    const [fR, fG, fB] = hexToRgb(color);
    if (tR === fR && tG === fG && tB === fB) return;

    const TOL = 30;
    const visited  = new Uint8Array(W * H);
    const bfsFilled = new Uint8Array(W * H);
    const stack = [startIdx];
    visited[startIdx] = 1;
    while (stack.length) {
      const pos = stack.pop();
      bfsFilled[pos] = 1;
      const xi = pos % W;
      for (const n of [pos - 1, pos + 1, pos - W, pos + W]) {
        if (n < 0 || n >= W * H || visited[n] || Math.abs((n % W) - xi) > 1) continue;
        const ni = n * 4;
        if (Math.abs(data[ni]-tR) <= TOL && Math.abs(data[ni+1]-tG) <= TOL && Math.abs(data[ni+2]-tB) <= TOL) {
          visited[n] = 1; stack.push(n);
        }
      }
    }

    // Gap correction: the 2px BFS stroke stops fill ~1px short of each shape's actual boundary,
    // leaving a thin white ring. For every outline shape geometrically containing the click,
    // expand bfsFilled by 1 pixel into that shape's exact geometry mask — closing the gap
    // without bleeding outside the mathematical shape boundary.
    objects.filter(o => o.style !== 'filled' && pointInShape(o, px, py)).forEach(sh => {
      const gc = document.createElement('canvas');
      gc.width = W; gc.height = H;
      const gctx = gc.getContext('2d');
      drawShapeObj(gctx, Object.assign({}, sh, { style: 'filled', color: '#000000', size: 0.001 }));
      const gmask = gctx.getImageData(0, 0, W, H).data;
      // Two-pass dilation: collect candidates against the ORIGINAL bfsFilled state, then
      // apply. Single-pass would cascade (each expansion enables the next), letting fill
      // propagate across a 2px stroke barrier instead of stopping 1px into it.
      const toExpand = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        if (bfsFilled[i] || gmask[i * 4 + 3] === 0) continue;
        const xi = i % W;
        for (const n of [i - 1, i + 1, i - W, i + W]) {
          if (n >= 0 && n < W * H && bfsFilled[n] && Math.abs((n % W) - xi) <= 1) {
            toExpand[i] = 1; break;
          }
        }
      }
      for (let i = 0; i < W * H; i++) { if (toExpand[i]) bfsFilled[i] = 1; }
    });

    const pcData = pc.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) {
      if (bfsFilled[i]) {
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

  // ── Coloring pages (black-outline art for free coloring) ────
  function cpCircle(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function cpEllipse(ctx, cx, cy, rx, ry, rot) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, rot || 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function cpPolygon(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.stroke();
  }

  function cpLine(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // One ring of petal shapes pointing outward from the origin.
  function cpPetals(ctx, count, innerR, outerR, width, startAngle) {
    for (let i = 0; i < count; i++) {
      const a = (startAngle || 0) + i * (Math.PI * 2 / count);
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(0, -innerR);
      ctx.quadraticCurveTo(width, -(innerR + outerR) / 2, 0, -outerR);
      ctx.quadraticCurveTo(-width, -(innerR + outerR) / 2, 0, -innerR);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Smooth closed organic blob through radius multipliers around a circle.
  function cpBlob(ctx, cx, cy, baseR, variance) {
    const n = variance.length;
    const pts = variance.map((v, i) => {
      const a = i * (Math.PI * 2 / n);
      return [cx + baseR * v * Math.cos(a), cy + baseR * v * Math.sin(a)];
    });
    ctx.beginPath();
    const last = pts[n - 1];
    ctx.moveTo((last[0] + pts[0][0]) / 2, (last[1] + pts[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const cur = pts[i], next = pts[(i + 1) % n];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function cpHex(ctx, cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + i * (Math.PI / 3);
      const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  // Each shape draws within a local -100..100 coordinate box, centered on the origin.
  const coloringPages = {
    animals: [
      { name: 'Cat', draw: (ctx) => {
        cpEllipse(ctx, 0, 55, 38, 42);
        cpCircle(ctx, 0, -8, 42);
        cpPolygon(ctx, [[-38,-34],[-56,-74],[-14,-46]]);
        cpPolygon(ctx, [[38,-34],[56,-74],[14,-46]]);
        cpCircle(ctx, -16, -10, 6);
        cpCircle(ctx, 16, -10, 6);
        cpPolygon(ctx, [[-6,6],[6,6],[0,14]]);
        ctx.beginPath();
        ctx.moveTo(0,14); ctx.quadraticCurveTo(-10,22,-18,16);
        ctx.moveTo(0,14); ctx.quadraticCurveTo(10,22,18,16);
        ctx.stroke();
        cpLine(ctx,-8,10,-48,2); cpLine(ctx,-8,15,-48,18);
        cpLine(ctx,8,10,48,2);  cpLine(ctx,8,15,48,18);
        ctx.beginPath();
        ctx.moveTo(34,90); ctx.bezierCurveTo(70,85,78,50,58,15);
        ctx.stroke();
        cpLine(ctx,-20,95,-20,110); cpLine(ctx,-5,97,-5,112);
        cpLine(ctx,10,97,10,112);  cpLine(ctx,22,95,22,110);
      } },
      { name: 'Dog', draw: (ctx) => {
        cpEllipse(ctx, 0, 58, 42, 36);
        cpCircle(ctx, 0, -10, 36);
        cpEllipse(ctx, 0, 18, 20, 15);
        cpCircle(ctx, 0, 10, 4);
        [1,-1].forEach((sign) => {
          ctx.beginPath();
          ctx.moveTo(sign*30,-25);
          ctx.bezierCurveTo(sign*55,-15, sign*58,25, sign*38,40);
          ctx.bezierCurveTo(sign*30,20, sign*28,-5, sign*30,-25);
          ctx.closePath();
          ctx.stroke();
        });
        cpCircle(ctx, -14, -18, 5);
        cpCircle(ctx, 14, -18, 5);
        cpLine(ctx,-28,94,-28,114); cpLine(ctx,-10,94,-10,116);
        cpLine(ctx,10,94,10,116);  cpLine(ctx,28,94,28,114);
        ctx.beginPath();
        ctx.moveTo(40,40); ctx.quadraticCurveTo(75,20,65,-10);
        ctx.stroke();
      } },
      { name: 'Fish', draw: (ctx) => {
        cpEllipse(ctx, 5, 0, 55, 34);
        cpPolygon(ctx, [[-50,0],[-85,-28],[-85,28]]);
        cpPolygon(ctx, [[-5,-32],[15,-58],[35,-30]]);
        cpPolygon(ctx, [[-5,32],[10,56],[30,30]]);
        cpCircle(ctx, 42, -8, 6);
        ctx.beginPath();
        ctx.moveTo(-12,-22); ctx.quadraticCurveTo(-22,0,-12,22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8,-26); ctx.quadraticCurveTo(0,0,8,26);
        ctx.stroke();
      } },
      { name: 'Bird', draw: (ctx) => {
        cpEllipse(ctx, 0, 25, 38, 48);
        cpCircle(ctx, 26, -30, 24);
        cpPolygon(ctx, [[48,-32],[68,-26],[47,-18]]);
        cpCircle(ctx, 30, -34, 3.5);
        ctx.beginPath();
        ctx.moveTo(-10,-5);
        ctx.quadraticCurveTo(-55,10,-30,55);
        ctx.quadraticCurveTo(-15,35,10,30);
        ctx.closePath();
        ctx.stroke();
        cpLine(ctx,-15,68,-45,95); cpLine(ctx,0,72,-10,105); cpLine(ctx,12,68,20,100);
        cpLine(ctx,-8,72,-8,95); cpLine(ctx,8,72,8,95);
        cpPolygon(ctx, [[-14,95],[-8,95],[-11,102]]);
        cpPolygon(ctx, [[4,95],[10,95],[7,102]]);
      } },
      { name: 'Butterfly', draw: (ctx) => {
        cpEllipse(ctx, 0, 0, 6, 58);
        cpCircle(ctx, 0, -55, 8);
        ctx.beginPath();
        ctx.moveTo(-4,-62); ctx.quadraticCurveTo(-25,-85,-35,-95);
        ctx.moveTo(4,-62);  ctx.quadraticCurveTo(25,-85,35,-95);
        ctx.stroke();
        cpCircle(ctx,-35,-95,3); cpCircle(ctx,35,-95,3);
        [1,-1].forEach((sign) => {
          ctx.beginPath();
          ctx.moveTo(0,-35);
          ctx.bezierCurveTo(sign*40,-70, sign*95,-45, sign*80,0);
          ctx.bezierCurveTo(sign*55,-10, sign*20,-5, 0,10);
          ctx.closePath();
          ctx.stroke();
          cpCircle(ctx, sign*45, -30, 12);
        });
        [1,-1].forEach((sign) => {
          ctx.beginPath();
          ctx.moveTo(0,10);
          ctx.bezierCurveTo(sign*30,25, sign*55,55, sign*30,80);
          ctx.bezierCurveTo(sign*10,60, sign*5,30, 0,25);
          ctx.closePath();
          ctx.stroke();
        });
      } },
      { name: 'Owl', draw: (ctx) => {
        cpEllipse(ctx, 0, 15, 46, 55);
        cpPolygon(ctx, [[-30,-45],[-40,-75],[-15,-52]]);
        cpPolygon(ctx, [[30,-45],[40,-75],[15,-52]]);
        cpCircle(ctx, -20, -10, 22); cpCircle(ctx, -20, -10, 10);
        cpCircle(ctx, 20, -10, 22);  cpCircle(ctx, 20, -10, 10);
        cpPolygon(ctx, [[-8,15],[8,15],[0,30]]);
        ctx.beginPath(); ctx.moveTo(-40,10); ctx.quadraticCurveTo(-58,45,-30,75); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(40,10);  ctx.quadraticCurveTo(58,45,30,75);  ctx.stroke();
        cpLine(ctx,-15,68,-20,80); cpLine(ctx,-15,68,-10,80);
        cpLine(ctx,15,68,20,80);  cpLine(ctx,15,68,10,80);
      } },
    ],
    flowers: [
      { name: 'Daisy', draw: (ctx) => {
        cpPetals(ctx, 10, 18, 55, 14);
        cpCircle(ctx, 0, 0, 20); cpCircle(ctx, 0, 0, 10);
        ctx.beginPath(); ctx.moveTo(0,55); ctx.quadraticCurveTo(-10,85,0,100); ctx.stroke();
        cpEllipse(ctx, -20, 75, 22, 10, -0.4);
      } },
      { name: 'Sunflower', draw: (ctx) => {
        cpPetals(ctx, 14, 20, 58, 10);
        cpCircle(ctx, 0, 0, 22); cpCircle(ctx, 0, 0, 14); cpCircle(ctx, 0, 0, 7);
        ctx.beginPath(); ctx.moveTo(0,58); ctx.quadraticCurveTo(5,90,0,105); ctx.stroke();
        cpEllipse(ctx, 22, 85, 24, 10, 0.5);
        cpEllipse(ctx, -22, 95, 24, 10, -0.5);
      } },
      { name: 'Lotus', draw: (ctx) => {
        cpPetals(ctx, 7, 15, 65, 26, Math.PI / 7);
        cpPetals(ctx, 6, 10, 42, 16, 0);
        cpCircle(ctx, 0, 0, 12);
        cpEllipse(ctx, 0, 78, 55, 14);
      } },
      { name: 'Hibiscus', draw: (ctx) => {
        cpPetals(ctx, 5, 12, 65, 36, 0);
        cpCircle(ctx, 0, 0, 10);
        ctx.beginPath(); ctx.moveTo(0,-5); ctx.quadraticCurveTo(6,-45,2,-80); ctx.stroke();
        cpCircle(ctx, 2, -82, 4);
        ctx.beginPath(); ctx.moveTo(0,55); ctx.quadraticCurveTo(-8,85,0,105); ctx.stroke();
        cpEllipse(ctx, -18, 80, 20, 9, -0.5);
      } },
      { name: 'Tulip', draw: (ctx) => {
        ctx.beginPath();
        ctx.moveTo(0,-70);
        ctx.bezierCurveTo(-22,-70,-28,-30,-20,10);
        ctx.bezierCurveTo(-10,25,10,25,20,10);
        ctx.bezierCurveTo(28,-30,22,-70,0,-70);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-8,-55);
        ctx.bezierCurveTo(-40,-55,-48,-15,-30,15);
        ctx.bezierCurveTo(-25,0,-15,-10,-8,-30);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(8,-55);
        ctx.bezierCurveTo(40,-55,48,-15,30,15);
        ctx.bezierCurveTo(25,0,15,-10,8,-30);
        ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0,20); ctx.quadraticCurveTo(-5,60,0,105); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0,50); ctx.quadraticCurveTo(-45,45,-55,80); ctx.quadraticCurveTo(-25,70,0,65);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0,70); ctx.quadraticCurveTo(40,65,50,95); ctx.quadraticCurveTo(22,88,0,85);
        ctx.stroke();
      } },
      { name: 'Rose', draw: (ctx) => {
        ctx.beginPath();
        const turns = 2.2, steps = 50;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps, a = t * turns * Math.PI * 2, r = 3 + t * 26;
          const x = r * Math.cos(a), y = -25 + r * Math.sin(a);
          if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
        ctx.save();
        ctx.translate(0,-25);
        cpPetals(ctx, 6, 26, 55, 28);
        ctx.restore();
        cpPolygon(ctx, [[-18,35],[0,15],[18,35]]);
        ctx.beginPath(); ctx.moveTo(0,40); ctx.quadraticCurveTo(-10,75,0,105); ctx.stroke();
        cpEllipse(ctx, 22, 78, 20, 9, 0.5);
      } },
    ],
    abstract: [
      { name: 'Concentric Rings', draw: (ctx) => {
        for (let r = 15; r <= 90; r += 15) cpCircle(ctx, 0, 0, r);
      } },
      { name: 'Honeycomb', draw: (ctx) => {
        const hexR = 22, rowSpacing = hexR * 1.5, colSpacing = hexR * Math.sqrt(3);
        for (let row = -3; row <= 3; row++) {
          const y = row * rowSpacing;
          const rowOffset = (row % 2 !== 0) ? colSpacing / 2 : 0;
          for (let col = -3; col <= 3; col++) {
            const x = col * colSpacing + rowOffset;
            if (Math.hypot(x, y) > 95) continue;
            cpHex(ctx, x, y, hexR);
          }
        }
      } },
      { name: 'Geometric Triangles', draw: (ctx) => {
        for (let i = 0; i < 8; i++) {
          const a = i * (Math.PI * 2 / 8);
          ctx.save(); ctx.rotate(a);
          cpPolygon(ctx, [[0,-20],[-30,-75],[30,-75]]);
          ctx.restore();
        }
        for (let i = 0; i < 8; i++) {
          const a = i * (Math.PI * 2 / 8) + Math.PI / 8;
          ctx.save(); ctx.rotate(a);
          cpPolygon(ctx, [[0,-10],[-15,-40],[15,-40]]);
          ctx.restore();
        }
        cpCircle(ctx, 0, 0, 10);
      } },
      { name: 'Blob Cluster', draw: (ctx) => {
        [
          {cx:-25,cy:-20,r:35,v:[1,0.85,1.1,0.9,1,0.8,1.05,0.9]},
          {cx:30,cy:-15,r:30,v:[0.9,1.1,0.85,1,0.95,1.15,0.85,1]},
          {cx:-10,cy:35,r:32,v:[1,0.9,1.1,0.85,1.05,0.9,1,0.95]},
          {cx:35,cy:40,r:25,v:[0.85,1.05,0.9,1.1,0.9,1,0.95,1.05]},
          {cx:-40,cy:20,r:22,v:[1,0.8,1.1,0.9,1,0.85,1.05,0.9]},
        ].forEach(b => cpBlob(ctx, b.cx, b.cy, b.r, b.v));
      } },
      { name: 'Wave Bands', draw: (ctx) => {
        const startY = -75, spacing = 40, steps = 20, width = 180, amp = 12;
        for (let b = 0; b < 4; b++) {
          const y = startY + b * spacing;
          ctx.beginPath();
          for (let i = 0; i <= steps; i++) {
            const x = -width / 2 + (i / steps) * width;
            const yy = y + amp * Math.sin((i / steps) * Math.PI * 3);
            if (i === 0) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
          }
          for (let i = steps; i >= 0; i--) {
            const x = -width / 2 + (i / steps) * width;
            const yy = y + 18 + amp * Math.sin((i / steps) * Math.PI * 3);
            ctx.lineTo(x,yy);
          }
          ctx.closePath();
          ctx.stroke();
        }
      } },
      { name: 'Spiral', draw: (ctx) => {
        ctx.beginPath();
        const turns = 3.5, steps = 100;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps, a = t * turns * Math.PI * 2, r = 5 + t * 90;
          const x = r * Math.cos(a), y = r * Math.sin(a);
          if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      } },
    ],
  };

  function coloringDrawContext(ctx, size, drawFn) {
    ctx.save();
    ctx.strokeStyle = '#242424';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const scale = size / 200;
    ctx.scale(scale, scale);
    drawFn(ctx);
    ctx.restore();
  }

  function applyColoringPage(item) {
    commitText();
    pc.fillStyle = '#ffffff';
    pc.fillRect(0, 0, A4_W, A4_H);
    pc.save();
    pc.translate(A4_W / 2, A4_H / 2);
    coloringDrawContext(pc, Math.min(A4_W, A4_H) * 0.78, item.draw);
    pc.restore();
    render();
    saveState();
  }

  const coloringGalleryEl = document.getElementById('coloring-gallery');
  const coloringCategoryRow = document.getElementById('coloring-category-row');
  let coloringCategory = 'animals';

  function renderColoringGallery() {
    if (!coloringGalleryEl) return;
    coloringGalleryEl.innerHTML = '';
    coloringPages[coloringCategory].forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'coloring-thumb';
      btn.title = item.name;
      const canvas = document.createElement('canvas');
      canvas.width = 60; canvas.height = 60;
      const cctx = canvas.getContext('2d');
      cctx.translate(30, 30);
      coloringDrawContext(cctx, 52, item.draw);
      const label = document.createElement('span');
      label.textContent = item.name;
      btn.appendChild(canvas);
      btn.appendChild(label);
      btn.addEventListener('click', () => applyColoringPage(item));
      coloringGalleryEl.appendChild(btn);
    });
  }

  if (coloringCategoryRow) {
    const catBtns = coloringCategoryRow.querySelectorAll('.toggle-btn');
    catBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        catBtns.forEach((b) => b.classList.toggle('active', b === btn));
        coloringCategory = btn.dataset.category;
        renderColoringGallery();
      });
    });
  }

  renderColoringGallery();

  function applyResize(obj, handle, dx, dy) {
    if (obj.type === 'triangle' && obj.pts) {
      const snap = resizeSnap.pts[handle];
      obj.pts[handle] = { x: snap.x + dx, y: snap.y + dy };
      return;
    }
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
    // Check resize handles on currently selected object, then drag it if clicked inside
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
      // Clicking within the already-selected shape drags it without switching to an overlapping shape
      if (selObj && hitTest(selObj, x, y)) {
        isDragging=true; isResizing=false;
        dragStartX=x; dragStartY=y;
        dragSnap=JSON.parse(JSON.stringify(selObj)); didMove=false;
        if (selObj.type==='text') syncSidebarToTextObj(selObj);
        render(); renderOverlay(); updateSelectUI(); return;
      }
    }
    const allHits = objects.filter(o => o.id!==selectedId && hitTest(o, x, y));
    const hit = allHits.length === 0 ? null
      : allHits.reduce((a, b) => { const ba=getBounds(a), bb=getBounds(b); return ba.w*ba.h <= bb.w*bb.h ? a : b; });
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
          if (hi >= 0) { mainCanvas.style.cursor = (selObj.type==='triangle'&&selObj.pts) ? 'crosshair' : HANDLE_CURSORS[hi]; return; }
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
    else if (obj.type==='triangle'&&obj.pts) { obj.pts=dragSnap.pts.map(p=>({x:p.x+dx,y:p.y+dy})); }
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
  const CENTER_SHAPE_TOOLS = new Set(['rect','square','ellipse','hexagon','parallelogram','star']);

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
    if (SHAPE_TOOLS.has(tool)) {
      if (CENTER_SHAPE_TOOLS.has(tool)) {
        const dx=Math.abs(x-startX), dy=Math.abs(y-startY);
        previewShape(Math.max(0,startX-dx), Math.max(0,startY-dy), Math.min(A4_W,startX+dx), Math.min(A4_H,startY+dy));
      } else {
        previewShape(startX, startY, x, y);
      }
    }
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
      let newObj;
      if (tool === 'triangle') {
        newObj = { id:makeId(), type:'triangle',
          pts:[{x:Math.round((startX+x)/2),y:startY},{x,y},{x:startX,y}],
          color, size:brushSize, style:shapeStyle, angle:0 };
      } else if (CENTER_SHAPE_TOOLS.has(tool)) {
        const dx=Math.abs(x-startX), dy=Math.abs(y-startY);
        newObj = { id:makeId(), type:tool, x1:Math.max(0,startX-dx),y1:Math.max(0,startY-dy),x2:Math.min(A4_W,startX+dx),y2:Math.min(A4_H,startY+dy), color,size:brushSize,style:shapeStyle, angle:0 };
      } else {
        newObj = { id:makeId(), type:tool, x1:startX,y1:startY,x2:x,y2:y, color,size:brushSize,style:shapeStyle, angle:0 };
      }
      objects.push(newObj);
      render(); saveState();
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────
  let arrowMoved = false;

  document.addEventListener('keydown', e => {
    const tag = document.activeElement.tagName;
    if (tag==='TEXTAREA'||tag==='INPUT'||tag==='SELECT') return;
    if ((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key==='z') { e.preventDefault(); undo(); }
    if ((e.ctrlKey||e.metaKey)&&(e.key==='y'||(e.shiftKey&&e.key==='Z'))) { e.preventDefault(); redo(); }
    if ((e.key==='Delete'||e.key==='Backspace')&&selectedId!==null) { e.preventDefault(); deleteSelected(); }
    if (e.key==='v'||e.key==='V') selectTool('select');
    if (e.key==='Escape') { selectedId=null; renderOverlay(); updateSelectUI(); }
    if (selectedId!==null && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const obj = objects.find(o => o.id===selectedId);
      if (obj) {
        const dx = e.key==='ArrowLeft' ? -2 : e.key==='ArrowRight' ? 2 : 0;
        const dy = e.key==='ArrowUp'   ? -2 : e.key==='ArrowDown'  ? 2 : 0;
        if (obj.type==='text') { obj.x+=dx; obj.y+=dy; }
        else if (obj.type==='triangle'&&obj.pts) { obj.pts=obj.pts.map(p=>({x:p.x+dx,y:p.y+dy})); }
        else { obj.x1+=dx; obj.y1+=dy; obj.x2+=dx; obj.y2+=dy; }
        render(); renderOverlay();
        arrowMoved = true;
      }
    }
  });

  document.addEventListener('keyup', e => {
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && arrowMoved) {
      saveState(); arrowMoved = false;
    }
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
    const wasEnabled = mandalaMode;
    mandalaMode = enabled;

    if (!wasEnabled && enabled) {
      // Entering mandala: restore saved mandala work (or keep current canvas blank)
      commitText(); selectedId = null;
      if (mandalaSnapshot) {
        pc.putImageData(mandalaSnapshot.pixelData, 0, 0);
        objects = JSON.parse(JSON.stringify(mandalaSnapshot.objects));
        hist = [makeEntry()]; histIdx = 0;
        render(); renderOverlay(); updateSelectUI();
      }
    } else if (wasEnabled && !enabled) {
      // Leaving mandala: save mandala work, give sketch a fresh blank canvas
      commitText(); selectedId = null;
      mandalaSnapshot = makeEntry();
      pc.fillStyle = '#ffffff'; pc.fillRect(0, 0, A4_W, A4_H);
      objects = [];
      hist = [makeEntry()]; histIdx = 0;
      render(); renderOverlay(); updateSelectUI();
    }

    if (modeSketchBtn && modeMandalaBtn) {
      modeSketchBtn.classList.toggle('active', !enabled);
      modeMandalaBtn.classList.toggle('active', enabled);
    }
    if (sidebar) sidebar.classList.toggle('mandala-mode', enabled);
    document.body.classList.toggle('mandala-mode', enabled);
    if (mandalaSection) mandalaSection.style.display = enabled ? 'block' : 'none';
    if (fillTextSection) fillTextSection.style.display = enabled ? 'none' : 'block';
    if (selectSection) selectSection.style.display = 'block';
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
      const allowed = ['pen','brush','spray','eraser','fill','rect','square','ellipse','line','arrow','triangle','hexagon','parallelogram','star','curve','select'];
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
  if (modeSketchBtn) modeSketchBtn.addEventListener('click', () => setMandalaMode(false));
  if (modeMandalaBtn) modeMandalaBtn.addEventListener('click', () => setMandalaMode(true));

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
