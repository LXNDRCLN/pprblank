# PprBlank — Claude Context

Browser-based instant drawing/sketching app. Zero friction — open and draw, no login.
**GitHub:** `github.com/LXNDRCLN/pprblank` | **Hosted:** GitHub Pages (custom domain via CNAME)
**Stack:** Vanilla HTML5 Canvas + JS + CSS, no build step, no dependencies.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell, sidebar HTML, canvas elements, Google Analytics (G-XC0R7F14LP) |
| `app.js` | All app logic — single IIFE, ~1600 lines |
| `style.css` | All styles including mobile responsive, mandala mode theme |
| `photos/` | Image assets (mandala button background) |
| `PPRBLANK_PROJECT.md` | Product/roadmap doc |

---

## Architecture

### Canvas system (dual-canvas)
- **`pixelCanvas` (`pc`)** — off-screen A4 canvas (794×1123px). Freehand strokes are drawn here permanently.
- **`mainCanvas` (`mc`)** — visible canvas. On every `render()`, the white background + `pixelCanvas` + all `objects[]` are composited here.
- **`overlayCanvas` (`oc`)** — transparent canvas stacked on top, pointer-events: none. Used for shape previews while dragging and selection/hover highlights.

### Object model
Shapes and text are stored in `objects[]`. Each entry:
```js
{ id, type, x1, y1, x2, y2, color, size, style, angle }   // shapes
{ id, type:'text', x, y, boxWidth, text, fontFamily, fontSize, fontBold, fontItalic, fontUnder, color, angle }
{ id, type:'triangle', pts:[{x,y},{x,y},{x,y}], color, size, style, angle }
```
Objects render on top of `pixelCanvas`. Only freehand (pen/brush/spray/eraser) goes into `pixelCanvas`.

### History (undo/redo)
`hist[]` stores `{ pixelData: ImageData, objects: deep-copy }` snapshots. `histIdx` tracks position. Max 50 entries. Call `saveState()` after any destructive change.

### Zoom
`setZoom(z)` scales the canvas CSS size only — internal resolution stays at 794×1123. `getPos(e)` converts client coords to canvas coords accounting for zoom.

---

## Tools
| Tool | Category | Notes |
|------|----------|-------|
| pen, brush, spray, eraser | Freehand | Drawn to `pixelCanvas`. Smooth stroke via quadraticCurveTo. |
| rect, square, ellipse, line, arrow, triangle, hexagon, parallelogram, star, curve | Shape | Stored as objects. Preview on overlay while dragging. |
| select | Select | Drag to move, handles to resize, right-click to duplicate, dblclick text to edit. |
| fill | Fill | Flood-fill on `pixelCanvas` with 3-pass anti-alias fringe fix. Also recolors filled shape objects. |
| text | Text | Drag to set box, overlay `<textarea>` appears, committed to `objects[]` on blur/Escape. |

**Mandala mode** — toggle via "Mandala" button. Shows mandala panel (20 patterns × 20 color palettes), hides fill/text section. Generated onto `pixelCanvas`.

---

## Key Patterns

- **`render()`** must be called after any change to `pixelCanvas` or `objects[]` to update the visible canvas.
- **`renderOverlay()`** redraws selection/hover box on the overlay canvas.
- **`saveState()`** must be called after any user action that should be undoable.
- Shape tools use `SHAPE_TOOLS` Set to check if a tool is a shape.
- `getPos(e)` handles both mouse and touch events and clamps to canvas bounds.
- Mobile: sidebar slides in/out, one-finger pan allowed when zoom > 1, pinch-zoom on `canvasScroll`.

---

## Keyboard shortcuts
| Key | Action |
|-----|--------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| V | Select tool |
| Delete / Backspace | Delete selected object |
| Escape | Deselect |
| Arrow keys | Nudge selected object (2px per key) |

---

## Roadmap
- **R01** (current): Static drawing app on GitHub Pages — ✅ done
- **R02**: User accounts, cloud save, sharing, layers (Supabase)
- **R03**: Real-time collaboration, mobile app, teams

---

## Contact
Made by Alexandru Calin — contact@pprblank.com
