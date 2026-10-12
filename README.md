# GenAI Genesis 2027 — Landing Page

Scroll-driven landing page for GenAI Genesis 2027 (Toronto, January 2027): a pastel CN Tower snow globe that tells the story as you scroll, a 3D stats band orbiting the globe, and a TTC Flexity streetcar finale with the sign-up call to action.

## Run it locally

ES modules and the `.glb` model can't load from `file://`, so serve the folder over HTTP:

```bash
python -m http.server 8000
# open http://localhost:8000
```

No build step and no npm install: three.js r169 and Lenis load from a CDN through the import map in `index.html`.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Page markup and copy |
| `landing/styles.css` | All styles and design tokens (Google Sans Flex only) |
| `landing/main.js` | Scroll, reveals, tabs, FAQ, card tilt, nav, and the WebGL frame loop |
| `landing/city.js` | Toronto snow globe: CN Tower, skyline, dome, snow, orbiting stats band, camera poses |
| `landing/streetcar.js` | Finale: Flexity streetcar, LED destination sign, road, receding city, wind and snow |
| `landing/backdrop.js` | Cursor-reactive lava-lamp backdrop with grain |
| `landing/logos.js`, `landing/sign-font.js` | Sponsor wordmarks; glyph subset for the TORONTO sign |
| `assets/cn-tower/` | Web-ready CN Tower model |
| `source/cn-tower/` | Blender generator for the tower (see its README) |
| `design/figma-handoff/` | Design-system sheet (SVG) and section screenshots for Figma |

## Accessibility and performance

- `prefers-reduced-motion`: native scrolling, still 3D frames, and a plain stats list in place of the orbiting band.
- Without WebGL the page falls back to the CSS gradient and flat content.
- Weaker devices (4 cores / 4 GB or less) render without antialiasing at pixel ratio 1.
