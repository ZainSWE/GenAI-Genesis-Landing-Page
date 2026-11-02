# GenAI Genesis design system → Figma (local plugin)

Builds design system v1.3 into the Figma file without using the Claude/MCP allowance.

1. Open the design system file in the **Figma desktop app**.
2. Menu → Plugins → Development → **Import plugin from manifest…** → pick `manifest.json` in this folder (one time only).
3. Menu → Plugins → Development → **GenAI Genesis — Design system v1.3** → it runs and closes with a ✓ message.

Safe to run again: it removes what it made last time and updates variables and styles in place.
After changing `code.src.js` or the skyline SVGs, rebuild with `node design/figma-plugin/build.js`.
