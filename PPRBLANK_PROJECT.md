# PprBlank — Project Documentation

> "The digital sheet of paper that's always there when you need one."

---

## Overview

**PprBlank** is a lightweight, browser-based drawing and sketching tool designed for instant use — no login, no setup, no friction. You open the page and you immediately have a blank sheet of paper with drawing tools at hand. It exists for the moments when you need to scribble something quickly and can't find a physical sheet.

The name is a contraction of **"Paper Blank"** — the simplest possible canvas.

---

## Product Vision

| Principle        | Description |
|-----------------|-------------|
| **Zero friction** | No loading screens, no modals, no sign-up walls — the canvas is ready on arrival |
| **Familiar feel** | Tools and layout should feel like picking up a pen and paper |
| **Progressive**   | The product grows in three defined releases without breaking what came before |
| **Accessible**    | Works on any modern browser, no installation required |

---

## Releases Roadmap

### Release 01 — The Blank Sheet *(build target: Session 1)*

The core drawing experience. A single A4 white canvas with essential tools.

**Canvas**
- A4 white page (210 × 297 mm ratio), centered on the screen
- Clean neutral UI surrounding the canvas (minimal chrome)

**Drawing Tools**
| Tool    | Description |
|---------|-------------|
| Pen     | Precise hard-edged strokes |
| Brush   | Soft, slightly blended strokes |
| Spray   | Scattered dot pattern, like an aerosol can |
| Eraser  | Remove drawn content |

- All tools: adjustable **thickness / size** via slider
- Active tool highlighted in the toolbar

**Color Tools**
- Color palette (preset swatches)
- Color picker (custom hex/RGB input)
- Color fill / bucket tool (fill enclosed areas)

**Shapes**
- Rectangle, Ellipse/Circle, Line, Arrow, Triangle
- Polygon (basic)
- All shapes: outline or filled, with stroke color and fill color controls

**Text**
- Text box tool — click to place, type to fill
- Font family selector (system fonts: Arial, Georgia, Courier New, Times New Roman, Verdana, Comic Sans, Impact)
- Font size selector
- Bold, Italic, Underline toggles
- Text color

**Utility Actions**
- Undo / Redo (Ctrl+Z / Ctrl+Y)
- Clear canvas
- Download as PNG
- Download as JPEG

---

### Release 02 — The Shared Sheet *(build target: Session 2)*

Adds user accounts so work can be saved, retrieved, and shared.

**User System**
- Sign up / Log in (email + password, or OAuth: Google/GitHub)
- User profile with saved drawings gallery
- Drawings auto-save to the cloud on the user's account

**Saving & Sharing**
- Save drawing to personal library (named, with thumbnail)
- Share drawing via link (public or private)
- Duplicate / fork a shared drawing
- Export remains available (PNG, JPEG, + SVG in this release)

**UX Improvements**
- Drawing history (versions per drawing)
- Layers panel (basic: add, rename, reorder, toggle visibility)
- Zoom in/out and pan the canvas

---

### Release 03 — The Connected Sheet *(build target: Session 3)*

Transforms PprBlank from a personal tool into a collaborative platform.

**Collaboration**
- Real-time multi-user drawing (like Google Docs for sketching)
- Cursor presence — see where teammates are drawing
- In-canvas chat / comments

**Mobile App**
- iOS and Android app (React Native or PWA)
- Touch-optimized tools (pressure sensitivity if device supports it)
- Camera integration: photograph a physical sketch and import it to continue digitally

**Extended Features**
- Instant **lists** mode: toggle between sketch canvas and a structured list (shopping list, to-do, etc.) on the same "sheet"
- Emoji / sticker library (insert emoticons as canvas objects)
- Templates: blank page, lined page, grid page, dotted page, music staff
- Notifications: get notified when someone edits a shared drawing

**Future Suggestions (backlog)**
- Voice-to-text for the text box tool
- AI sketch assist (autocomplete shapes, suggest labels)
- PDF import/export
- Presentation mode (step through drawings as slides)
- Marketplace: share and download templates/sticker packs

---

## Technical Stack (proposed)

| Layer       | Release 01         | Release 02            | Release 03              |
|-------------|--------------------|-----------------------|-------------------------|
| Frontend    | HTML5 Canvas + Vanilla JS | React (SPA) | React + WebSockets |
| Styling     | CSS3               | CSS Modules / Tailwind | Same                   |
| Backend     | None (static)      | Node.js / Express or Supabase | Node.js + Socket.io |
| Auth        | None               | Supabase Auth or Auth0 | Same                   |
| Storage     | LocalStorage (temp)| Supabase / S3          | Same                   |
| Hosting     | GitHub Pages       | Vercel / Netlify       | Vercel / Netlify        |
| Mobile      | —                  | PWA (installable)      | React Native            |

---

## File Structure (Release 01)

```
pprblank/
├── index.html          # Entry point — the app
├── style.css           # Layout and theme
├── app.js              # Main app logic
├── tools/
│   ├── pen.js
│   ├── brush.js
│   ├── spray.js
│   ├── eraser.js
│   ├── shapes.js
│   └── text.js
├── ui/
│   ├── toolbar.js      # Tool selection UI
│   ├── colorpicker.js  # Color palette + picker
│   └── options.js      # Thickness slider, font controls
├── utils/
│   └── export.js       # PNG / JPEG download
├── assets/
│   └── icons/          # Toolbar icons (SVG)
└── PPRBLANK_PROJECT.md # This file
```

---

## Non-Goals (Release 01)

- No user accounts or server — fully static
- No cloud sync — nothing leaves the browser
- No mobile-specific optimizations (comes in R03)
- No collaboration — single user only

---

## Success Metrics

| Release | Metric |
|---------|--------|
| R01 | Page loads instantly; drawing feels responsive with no lag |
| R02 | Users can save, retrieve, and share a drawing in under 60 seconds |
| R03 | Two users can draw on the same canvas simultaneously with < 200ms latency |

---

## Open Questions

- [ ] Custom domain for pprblank? (e.g. pprblank.io, pprblank.com)
- [ ] Should R01 use localStorage to survive a page refresh (optional auto-save)?
- [ ] Any specific icon style for the toolbar (outlined, filled, emoji-style)?
- [ ] R02 backend preference: self-hosted Node.js vs Supabase (BaaS)?

---

*Document created: 2026-05-25 | Version: 0.1 | Status: Pre-build*
