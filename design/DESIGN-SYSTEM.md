# GenAI Genesis web design system — v1.3

**Who this is for.** Engineers building new pages for genaigenesis.ca without a designer in the loop.

**How to use it.** Build only from what is in this document and the Figma file. When something isn't covered, ask design before you invent it.

| Source | Location |
|---|---|
| Reference implementation | `index.html` + `landing/styles.css` (the landing page) |
| Reference sub-page | `genai-genesis-judge-page/` (judge application, rebuilt on this system in v1.2): the template for any standalone form page |
| Figma | GenAI Genesis — Web Design System (Read me, Foundations and Components pages; Patterns, Templates and Illustrations to come) |
| **Stylesheet for new pages** | `design/system/ds.css` + `design/system/ds.js`: every token and component in this document, ready to link (v1.3) |
| **Component gallery** | `design/system/index.html`: every component live, in both themes, with its class names and rules. Open it next to this document. |
| Illustrations | `landing/skyline.js` (live) and `design/skyline/*.svg` (static exports for Figma, slides and social) |

---

## 1. Principles

1. **One visual world.** Every page uses the same elements: lavender haze background, ink type, mint and lilac accents, glass surfaces and the illustrated Toronto skyline. A new page should look like a room in the same building.
2. **Readable first, playful second.** Decoration (3D, gradients, skyline, glow) never competes with text. When it does, the decoration moves.
3. **Calm motion.** Elements ease into place once. Nothing loops in the reader's face. Everything works with motion turned off.
4. **Toronto, not generic tech.** The skyline, the TTC, the CN Tower and the lake carry the identity. Generic AI imagery (robots, brains, circuits as the subject) doesn't.

---

## 2. Tokens

Use the CSS custom properties. Never hard-code hex values in new components. Every token has a dark value under `html[data-theme="dark"]`.

### Colour

**Page and surfaces**

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Page | `--haze` | #ECE6FB | #0F0A20 | Body background. The `.bg` haze sits on top of it. |
| Surface | `--surface` | white, 80% | violet, 68% | Cards and FAQ rows. |
| Solid surface | `--surface-solid` | #FFFFFF | #1D1440 | Fields on busy art, and the partner button. |
| Glass | `--glass` | white, 58% | violet, 55% | Glass buttons and fields. |
| Glass line | `--glass-line` | white, 85% | white, 12% | 1px border on every glass or surface element. |
| Nav | `--nav-bg` | white, 55% (+ blur) | violet, 62% | Nav bar only. |
| Rule | `--rule` | ink, 9% | white, 12% | Dividers and table lines. |

**Text**

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Ink | `--ink` | #0D0B16 | #F1EDFF | Headings, body text, primary button. |
| Ink soft | `--ink-soft` | #3B3650 | #C2BADE | Secondary text and ledes. |
| On ink | `--on-ink` | #FFFFFF | #120B26 | Text on ink buttons. |

**Accents and brand**

| Role | Token | Light | Dark | Use |
|---|---|---|---|---|
| Mint | `--mint` | #00FFDD | same | Fill only: primary button and glows. |
| Mint text | `--mint-text` | #22CBBD | #3DF0D8 | Mint accent words on light backgrounds. |
| Lilac | `--lilac` | #E09DFF | #EAB4FF | Accent words, the Toronto chapter. |
| Lilac pale | `--lilac-pale` | #F3DAFF | — | Soft fills behind tags. |
| Award gradient | `--g1…g4` | lilac → teal | brighter | Award and "found" labels only (≤ 4 words). |
| TTC red | `--ttc-red` | #E2231A | — | TTC references only. |
| Skyline | `--sk-*` | see `styles.css` | night palette | Illustrations only. Never use these for UI. |

### Type

There is one family, **Google Sans Flex** (variable, weights 400–800). Use `font-family: var(--font)` and never add a second family.

| Style | Size | Weight | Line height | Tracking | Where |
|---|---|---|---|---|---|
| Display `.display` | `--t-display` clamp(3.1rem, 8.4vw, 7rem) | 500 | `--lh-display` 1.02 | −0.035em | One per page, hero only |
| Section heading `.h2` | `--t-h2` clamp(2rem, 4.4vw, 3.5rem) | 600 | `--lh-heading` 1.08 | −0.03em | Each section |
| Card heading | 1.7rem | 700 | 1.08 | −0.02em | Cards |
| Sub heading | 1.25rem | 700 | 1.2 | −0.01em | Form titles, card groups |
| Lede `.lede` | `--t-lede` clamp(1.05rem, 1.4vw, 1.25rem) | 400 | `--lh-lede` 1.45 | 0 | Under a heading, ≤ 34ch |
| Body | `--t-body` 1.0625rem | 400 | `--lh-body` 1.55 | 0 | Paragraphs, ≤ 65ch |
| Small | `--t-small` 0.875rem | 400–500 | 1.5 | 0 | Helper text, captions |
| Eyebrow `.eyebrow` | 1rem | 700 | 1.2 | 0.01em | Above every section heading |
| Label / button | 1rem | 700 | 1 | 0 | Buttons, field labels, nav |
| Award / tag | 0.72rem | 600 | 1 | 0.06em, UPPERCASE | Award pills only |

Type rules:

- Headings use `text-wrap: balance` and paragraphs use `text-wrap: pretty`. Both are already global.
- Heading hierarchy follows the outline: one `h1` per page, `h2` per section, `h3` per card. Don't pick a heading level to get a size; use the class instead.
- A heading can have one accent word, coloured with `--mint-text` or `--lilac`.
- Use figures for numbers: "1,000+", "36 hours", "March 2027". Write dates out ("March 2027"), not as numbers.

### Space

Use the 4px scale: `--space-4 / 8 / 12 / 16 / 20 / 24 / 28 / 32 / 48 / 80 / 150`.

| Use | Value |
|---|---|
| Inside a component (icon to label, label to field) | 8–12 |
| Between related items (fields, cards in a grid) | 12–24 |
| Inside a card (padding) | 28 (24 on mobile) |
| Section heading block to content | 40 (`.section-head` margin) |
| Between sections | `--section-pad` = clamp(80px, 12vw, 150px), top and bottom |
| Page edges | `--gutter` = max(16px, 4vw); content max width `--maxw` 1180px |

Lay out siblings with `gap`, not margins.

### Radius

| Token | Value | Use |
|---|---|---|
| `--r-sm` | 10px | Photos inside polaroids, small chips |
| `--r-field` | 14px | Text inputs, selects, the station label |
| `--r-row` | 20px | FAQ rows, list rows |
| `--r-card` | 28px | Cards and panels |
| (section card) | clamp(28px, 4vw, 44px) | Full-width cards such as the sponsor wall and form card |
| `--r-pill` | 999px | Buttons, nav, tags, status pills |

### Elevation

| Level | Value | Use |
|---|---|---|
| 0 | none | Text, sections |
| 1 | `--shadow` | Cards and ink buttons |
| 2 | 0 30px 70px −40px violet | Section cards (sponsor wall, form card) |
| Mint glow | 0 8px 24px −10px mint | Primary button only |

### Motion

| Token | Value | Use |
|---|---|---|
| `--ease` | cubic-bezier(0.22, 1, 0.36, 1) | Default: reveals, fades, height and colour changes |
| `--spring` | cubic-bezier(0.5, 1.35, 0.4, 1) | Only for things moving into place (tab capsule, opening a panel). Never on close. |
| Button hover | scale(1.05), 500ms, cubic-bezier(0.34, 1.45, 0.5, 1) | All `.btn` |
| Durations | 180ms (press), 300ms (colour), 460ms (accordion), 700–1000ms (reveal) | — |
| Reveal | `data-reveal="up / left / right"` | Already wired in `main.js`. Use it on section heads and cards; don't write your own observers. |

Under `prefers-reduced-motion`:

- Turn off reveals, counters, marquees, tilts, shimmer, bounce, skyline rise and glow breathing.
- The page must still be complete and readable.

---

## 3. Layout

**Grid.** Content sits in `.wrap` (max 1180px plus gutters). Inside it, use CSS grid:

| Width | Columns | Typical use |
|---|---|---|
| ≥ 1000px | 12, gap 24px | 3 cards = 4 columns each; split = 5 / 7 |
| 761–999px | 6 | 2 cards per row; split stacks |
| ≤ 760px | 1 column | Everything stacks |

**Breakpoints.** Use only these:

| Query | What it controls |
|---|---|
| `max-width: 760px` | The main switch between phone and desktop layout |
| `max-width: 1000px` | Tablet |
| `min-width: 1240px` | Wide extras |
| `max-width: 420px` | Small phones |
| `(hover: none) and (pointer: coarse)` | Touch devices |

**Section anatomy.** Every content section has the same structure, top to bottom:

1. `section.section` with an `id`, `data-nav` and `aria-labelledby`.
2. `.wrap`.
3. `.section-head`, holding an eyebrow, then the `h2` (optionally with one accent word), then an optional lede.
4. The content block: a grid, list, form or logo wall.
5. An optional footer link (`.text-link`, e.g. "See every 2026 project →").

**Page anatomy.** Every page is built in this order:

1. Nav. Use the shared component and mark the current item.
2. Hero, which is either:
   - an eyebrow, a Display heading, a lede and up to 2 buttons, or
   - the compact form: eyebrow, `h1` at `.h2` size, lede.
3. 2–6 sections.
4. A closing CTA band.
5. The footer.

---

## 4. Components

These all exist in Figma (Components page). Their code lives in `styles.css` under the class shown.

### Buttons (`.btn`)

**Variants**

| Variant | Class | Use |
|---|---|---|
| Primary | `.btn-mint` | The single most important action on a screen, e.g. Apply. Ink text. |
| Secondary | `.btn-ink` | Other actions ("Become a judge", "Submit"). Inverts in dark mode. |
| Tertiary | `.btn-glass` | Low-emphasis actions on busy backgrounds. |
| Partner | `.btn-partner` | Only for "Partner with us". White with the gradient label. |
| Text link | `.text-link` | Navigation-style "See all →". |

**Sizes.** Minimum height 48px, padding 0.7em × 1.4em. There are no smaller buttons. On phones, a row of buttons becomes a 2-column grid of full-width buttons.

**States**

| State | Treatment |
|---|---|
| Hover | scale 1.05 |
| Press | scale 1 |
| Focus | `:focus-visible` 3px `--mint-deep` outline, 3px offset (global) |
| Disabled | opacity 0.55, `cursor: not-allowed`, no hover scale |
| Loading | keep the width, replace the label with "Sending…", add `aria-busy="true"` |

**Labels.** Verb first, ≤ 3 words, sentence case: "Apply as a hacker", "Submit enquiry". Never "Click here".

### Form fields

**Text field.** Label above (`Label/Field`, 1rem/700), then a 48px input with `--glass` fill, `--glass-line` border, `--r-field` radius and 14px padding.

- Mark required fields with a visible `*` and `required`.
- Put helper text below in Small.

**Field states**

| State | Treatment |
|---|---|
| Focus | 2px `--mint-deep` outline |
| Error | 1.5px #D92D5B border, a message below starting with what to do ("Enter an email like name@school.edu"), `aria-invalid` and `aria-describedby` |
| Disabled | 55% opacity |
| Success | Status line in `--mint-text`. Fields don't change. |

**Waitlist field.** A pill input with the button inside it (hero). Use it only for single-field email capture.

**Multi-step form.** Used for applications and sign-ups. The judge application is the reference build. It is a section card with:

- a progress bar at the top: mint → lilac fill on a lilac-pale track (white 10% in dark), 8px, pill radius, with `role="progressbar"` and `aria-valuenow` kept current;
- the step names beside it (Label/Nav). The current step is ink and bold, the others ink-soft. Steps you've reached are clickable; steps ahead are not. On phones the names move under the bar.
- the step title (Sub heading, 1.5rem/700);
- the fields, 16px apart;
- the buttons:
  - on the first step, Next (`.btn-mint`) at full width;
  - on later steps, Back (`.btn-glass`) and Next or Submit (`.btn-mint`) side by side in a 2-column grid of equal width;
- step dots below: an 8px dot for each step, with the current one a 22px mint-deep pill.

How it behaves:

- **Height.** Only the active step is in the layout. The card eases its height between steps (0.5s `--ease`) rather than reserving room for the tallest step.
- **Step change.** Fade and rise 12px (0.45s), with no transition under reduced motion. Focus moves to the new step's heading (`tabindex="-1"`), because the button that was pressed has just disappeared.
- **Validation.** Going forward validates the current step; going back never does.
- **Success state.** A centred line icon (76px, mint-text, a short pop with `--spring`), a heading and one line, in the same card with `role="status"`. Focus goes to its heading.

On desktop the page is two columns: pitch copy on the left (5fr), the card on the right (6fr, max 560px). Below 1000px it stacks with the copy first.

**Segmented choice (`.toggle-group` / `.toggle-btn`).** For a choice between 2–3 short options, such as Online / In-Person:

- a glass pill track with 6px padding;
- 44px-high pill options;
- the selected option filled with `--ink` and its text in `--on-ink`;
- `aria-pressed` on every option, inside a `role="group"` with a visible label.

Use it instead of radio buttons when the options fit on one line; for more options use a select.

**Repeatable row (`.links-list` / `.link-row`).** For "add another" inputs such as extra links. Each row is the input, then a remove button (glass icon button), then an add button (mint icon button, only on the last row). New rows slide in (0.35s) and focus their input. Each input gets an `aria-label` ("Link 2").

**Icon button (`.icon-btn`).**

- A 44px circle; glass by default, mint for an "add" action.
- The icon is an 18px inline SVG with `currentColor`.
- Always has an `aria-label`.
- Hover scales it to 1.08 with the button spring.

**Validation.** Validate on blur and on submit, never on every keystroke. Keep the user's input after an error. Invalid fields show the error border only after the user has interacted (`:user-invalid`).

### Content

| Component | Class | Rules |
|---|---|---|
| Section heading | `.section-head` (+ `.center`) | Eyebrow + `h2` + optional lede. Left-aligned by default; centre only for short, standalone sections. |
| Card | `.project` | Surface fill, `--r-card`, `--shadow`, 28px padding. Content: optional pill, `h3`, meta line, ≤ 2 lines of body. Cards in one row share a height. |
| Award pill | `.award` + `.grad` | Status only ("Winner · 2026"). Never facts, numbers or links. |
| Stat | `.stat` | A big figure plus a short label. Use 3–4 in a row, never alone. |
| Fact sheet | `.sc-facts` | Label/value pairs (When, Where, Who, Cost). Use instead of pills for facts. |
| Text surface | `.halo` / `.panel` | Frosted plate behind text that sits over 3D or art. |
| FAQ item | `.faq details` | Question in `Label/Question`, answer ≤ 3 sentences. Open one at a time. |
| Tabs | `.tabs` / `.tab` | 2–4 tabs, ≤ 2 words each. Use for filtering a single grid, not for page navigation. |
| Logo wall | `.sponsors-wall` | Section card, tiers in descending order, logos monochrome (ink in light mode, white in dark). |
| Photo | `.polaroid` | Candid photos only: white frame, slight rotation (±3°), caption under the photo. |

### Navigation

| Component | Rules |
|---|---|
| Nav bar | Shared on every page. Same items in the same order; the current page is bold. The Apply button stays at the far right. On sub-pages the links point back to the landing sections (`/#about` …). On phones a sub-page's nav can show just the logo and theme toggle. |
| Theme toggle | On every page. Saves the choice in `localStorage` under `gag-theme`. Each page reads it in a tiny inline script in `<head>`, before CSS paints, so dark mode carries across pages with no flash. |
| Footer | Shared. Logo, "Toronto, Ontario · © 2027 GenAI Genesis", About, Sponsors, FAQ. |

---

## 5. Patterns

Patterns are recipes made from components. New pages should be assembled almost entirely from these.

| Pattern | Recipe | Example |
|---|---|---|
| **Page hero** | Eyebrow (place · date) → Display or `h1` with one accent word → lede ≤ 2 lines → ≤ 2 buttons (one Primary) → optional status line in Small | Landing hero |
| **Split story** | 5/7 grid. Copy on the white or surface side, art (3D, photo or skyline) on the other. On mobile the copy comes first and the art goes below. | About chapter |
| **Card grid** | Section head → 3 cards per row (2 on tablet, 1 on phone), gap 24 → optional text link | Winners |
| **Facts row** | A Fact sheet or 3–4 Stats. Never use pills for these. | About facts |
| **Centred intro + section card** | Centred section head (≤ 760px) → button → full-width section card (logo wall, form), optionally with the skyline standing on it (once per page) | Sponsors |
| **Form card** | Eyebrow + Display heading (one accent word) + lede on the left; multi-step form card on the right with the skyline standing on it; shared nav and footer | Judge application |
| **FAQ** | 2-column grid (0.8fr / 1.2fr): heading on the left, accordion on the right. One column on mobile. | FAQ |
| **CTA band** | Short heading + lede + buttons (Primary + Secondary), with the Partner button spanning both | Finale |
| **Empty and error states** | Centred Sub heading + one line + one button, on a surface card. Friendly and plain: "Nothing here yet. Applications open in January." | — |

---

## 6. Illustration: the Toronto skyline

These are flat illustrated buildings in the site palette: white, lavender, lilac and periwinkle blocks with purple window grids, a few lit windows, thin white circuit traces and mint glow strips. They are adapted from the judge sign-up art.

**Building library.** `landing/skyline.js` contains each building; `design/skyline/` has a light and a dark SVG of each.

| Building | Description |
|---|---|
| `grid` | Window-grid tower (lilac, periwinkle or white front) |
| `bands` | Banded slab with a set-back crown and mint floor strips |
| `spire` | Tall slanted-roof tower with circuit traces and lit slots |
| `gable` | Gabled block with a round emblem |
| `dome` | Stadium dome, a nod to the Rogers Centre |
| `drum` | Tilted cylinder |
| `prism` | Glass slab with diagonal mint light lines |
| `cn` | Flat CN Tower, back row only |
| `cloud` | Cloud |

**Placement 1: standing on a section card.** This is the skyline's only placement in a page layout, and it's used once per page. It stands on the top edge of the page's main card, as wide as the card and no wider: never full-bleed, never touching the screen edges. The CN Tower rises behind the Rogers Centre dome.

| Page | Card |
|---|---|
| Landing | Sponsor wall |
| Judge application | Form card |

```html
<div class="skyline skyline-card" data-skyline="card" aria-hidden="true"></div>
<div class="sponsors-wall">…</div>   <!-- or .form-card -->
```

`mountSkylines()` from `skyline.js` renders the art and raises the buildings in on scroll. CSS handles dark mode and reduced motion. The card overlaps the buildings' bases by 10–12px.

**Pages in another repo.** For example the judge page. Copy `landing/skyline.js` as is, along with the `--sk-*` tokens and the `.skyline` rules. Don't edit the copy; changes are made in the landing repo and copied over.

**Clouds.** Clouds drift slowly left to right, like the hero ticker: one loop about every 70s. They fade in and out at the edges so none is ever cut off. Keep every cloud's top inside the artboard (`y ≥ 0.1 × w`). The drift pauses when the skyline is off screen and is off under reduced motion.

**Placement 2: the horizon of the TTC finale (3D).** The `horizon` preset (no CN Tower, since the 3D tower is already in the shot) is drawn into a texture at the far end of the road in `streetcar.js`, so the street leads into the city. A separate cloud strip drifts left to right above it. Both rebuild with the night palette in dark mode. Treat it as part of the 3D scene, not a page placement.

**Rules**

1. Once per page, on a section card (sponsor wall, form card), matching the card's width. Never repeat it, and never full-bleed.
2. Never under text, and never between a heading and its content.
3. Keep it decorative: always `aria-hidden="true"`, with no links or text inside.
4. Don't recolour, crop or rearrange it per page. New buildings or compositions are added to `skyline.js` by design, then exported with `node tools/export-skyline.mjs`.
5. If the 3D CN Tower is on screen, a flat skyline in the same view must be one without the CN Tower (`horizon`).
6. Single buildings (`design/skyline/building-*.svg`) are for slides, social and print, not for scattering around the site.

---

## 7. Iconography and imagery

**Icons**

- Simple line icons on a 24px grid, 2–2.2px stroke, round caps and joins, `currentColor`.
- Use them inline as SVG with `aria-hidden="true"` next to a text label. An icon-only button needs an `aria-label`.

**Photos**

- Use real event photos in the Polaroid component, as `.webp` with `loading="lazy"`, `decoding="async"` and meaningful `alt` text.
- No stock photos, no AI-generated people.

**Logos**

- Sponsor logos are SVG and monochrome on the wall.
- The GenAI Genesis logo is never recoloured outside ink and white.

---

## 8. Accessibility (must pass before merge)

**Contrast**

- Body text must be at least 4.5:1 and large text at least 3:1, in both themes.
- Don't put white text on mint, lilac-pale, haze or skyline.

**Keyboard**

- Everything works by keyboard.
- Focus is always visible (the global `:focus-visible` style).
- The skip link goes to `#main`.

**Semantics**

- One `h1` per page and no skipped heading levels.
- Use landmarks: `nav`, `main`, `footer`.
- Every section has `aria-labelledby` pointing to its heading.

**Forms**

- Every field has a `<label>`.
- Errors are announced through `role="status"` or `aria-live`.

**Touch and motion**

- Tap targets are at least 44px.
- The page is fully usable under reduced motion.

**Media**

- Every photo has `alt` text.
- Decorative art has `aria-hidden="true"`.

---

## 9. Content and voice

**Voice.** Short, confident, plain. Sentence case. Toronto first. No hype words (revolutionary, cutting-edge, game-changing).

**Application status.** Use one source of truth for status copy and the same sentence everywhere. Currently:

- "Hacker applications open the second week of January."
- "Get notified when hacker applications open."

**Names.** "GenAI Genesis" is always written out, never shortened to "GAG" in UI text. Write "AI", not "A.I.".

**CTAs.** The same labels everywhere: "Apply as a hacker", "Become a judge", "Partner with us".

---

## 10. Building a new page: checklist

1. Start from the page anatomy in section 3 and the patterns in section 5. Copy markup from `index.html`, not from scratch.
2. Use only tokens. Searching the new CSS for `#` hex values should only find token definitions.
3. Use one Primary button per screen and one accent word per heading.
4. Use the skyline at most once, card-wide, standing on a section card.
5. For a form or sign-up page, start from the judge application page and change the copy and fields, not the structure.
6. Check at 1440, 1000, 760, 390 and 360px wide, in both themes and with reduced motion on.
7. Run the accessibility checks in section 8 and the Lighthouse accessibility score (≥ 95).
8. Post screenshots (light, dark, phone) for design review before merging.

### How design reviews an engineer's page

The review against this system happens in a fixed order:

1. **Structure.** Does the page follow the page and section anatomy?
2. **Tokens.** Are there any raw colours, sizes or radii?
3. **Type.** Are only the defined styles used, with the hierarchy and accent-word rule?
4. **Components and patterns.** Is anything hand-rolled where a component exists?
5. **Hierarchy.** One primary action, and is the reading order clear?
6. **Illustration.** Is there space, and are the limits respected?
7. **Responsive, motion and accessibility.**
8. **Copy.** Voice and status consistency.

Fixes are made by swapping in the closest system part, not by adding new styles.

### Worked example: the judge application (v1.2)

This is the engineer's first version and what changed to bring it onto the system. The original is kept in `before-design-system/`.

| Before | After | Rule |
|---|---|---|
| Teal and dark-panel palette, raw hex everywhere | Lavender haze, glass card, ink type, mint and lilac accents, via tokens only | 2 Tokens |
| Inter, weight 900, title offset with fixed margins | Google Sans Flex. Display heading with "Judge?" as the single mint accent word, left-aligned on the grid | 2 Type |
| Swoosh, mountains, boat, spaceship, a separate CN Tower and loose clouds around the page | One skyline standing on the form card; clouds drift and fade at the edges | 6 Illustration |
| Progress bar in a separate dark bar at the top of the page | Progress and step names inside the card, above the step title | 4 Multi-step form |
| Square uppercase buttons in two different colours (purple Next, blue Submit) | Pill `.btn-mint` for the forward action, `.btn-glass` Back, equal widths | 4 Buttons |
| Purple outlined inputs, 6px radius | 48px glass fields, `--r-field`, mint focus outline, `:user-invalid` error border | 4 Form fields |
| Raster PNG icons (plus, trash, party) | Inline line icons in `currentColor`, which follow the theme | 7 Icons |
| Fixed-height card with an inner scroll, empty space on short steps | Card height follows the active step and eases between steps | 4 Multi-step form |
| No nav or footer, no dark mode, focus lost after Next | Shared nav and footer, shared theme setting, focus moved to each new step's heading | 4 Navigation, 8 Accessibility |

The copy, field names, IDs and the form flow were kept as the engineer wrote them.


---

## 11. Extended library (v1.3)

The landing page only uses part of the system. New pages also need forms, schedules, people, dialogs and long-form text. Everything below is designed from the same tokens and rules, and ships in `design/system/ds.css` (styles) and `ds.js` (behaviour, opt-in through markup). You can see each part in the gallery, `design/system/index.html`.

**How to start a new page**

1. Link the font, `ds.css`, then your page CSS. Add `ds.js` with `defer`.
2. Copy the theme line from the gallery's `<head>`.
3. Use the shared nav and footer.

Page CSS should be layout only; if you find yourself styling a control, it belongs in `ds.css` (ask design).

### 11.1 New tokens

**Text and accent colours**

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink-muted` | #6E6889 | #9A93B8 | Captions, placeholders (≥ 4.5:1 on white) |
| `--mint-ink` | #0B7F76 | #3DF0D8 | Mint for **small** text on light |
| `--teal` | #0F9F95 | #3DF0D8 | The site's teal label colour: award pill, active station, organisation names |
| `--lilac-ink` | #8A3FC0 | #EAB4FF | Lilac for small text and icons |

`--mint-deep` (#22CBBD) is only 2:1 on white. Keep it for large accent words (h2 and up) and for underlines; anything smaller uses `--mint-ink`.

**Status colours.** These come from the site's own swatches, the candid-card gradients, not a generic traffic light. There are no greens, ambers or reds anywhere in the system (TTC red stays reserved for TTC references).

| Status | Swatch | Text colour (on white) | Tint (tiles, avatars) |
|---|---|---|---|
| `--success` | mint | #0B7F76 | aqua-pale → #8FF7E9 |
| `--info` | lilac | #8A3FC0 | lilac-pale → #D7A6FF |
| `--warning` | peach | #B2452F | #FFE1D6 → #FFC9B0 |
| `--danger` | pink | #B8245E | #FFE1EA → #FFB3C7 |

How status colour is used:

- Status text sits on white pills shaped like the award pill, never on tinted fills. Each text colour passes 4.5:1 on white.
- The tints (`--*-tint`) only fill small tiles, avatars and icons, with ink icons on top.
- Every status has a `--*-ring` for 1px tinted outlines.

**Surfaces**

| Token | Use |
|---|---|
| `--surface-sunk` | Lavender wells: row hover, menu hover (never grey) |
| `--rule-strong` | Control borders: checkbox, radio, hover |
| `--overlay` | Lavender veil behind dialogs and drawers |

**Type sizes**

| Token | Size | Use |
|---|---|---|
| `--t-h1` | clamp(2.5rem, 5.6vw, 4.5rem) | Sub-page titles. Pages other than the landing use `.h1`, not `.display`. |
| `--t-h3` | 1.7rem | Cards |
| `--t-h4` | 1.25rem | Groups, dialogs |
| `--t-caption` | 0.78rem | Captions, overlines |
| `--font-code` | system mono | Only inside `code`, `kbd` and `pre`. Never for UI. |

**Shape, elevation, motion and layers**

| Group | Tokens | Use |
|---|---|---|
| Radius | `--r-xs` 6 | Code, tags, kbd |
| | `--r-section` | Section cards |
| Elevation | `--shadow-1` | Chips, small floating UI |
| | `--shadow` | Cards |
| | `--shadow-2` | Section cards, hovered link cards |
| | `--shadow-3` | Dialogs, drawers, menus, toasts |
| | `--ring` | Focus ring as a shadow, for inputs |
| Motion | `--dur-press` 180ms, `--dur-fast` 250ms, `--dur` 450ms, `--dur-slow` 800ms | Durations |
| | `--bounce` | The button-hover curve |
| Layers | `--z-sticky` 30, `--z-nav` 40, `--z-drawer` 60, `--z-dialog` 70, `--z-toast` 80, `--z-tooltip` 90 | Stacking order. Don't invent z-indexes. |

**Layout helpers**

| Helper | What it does |
|---|---|
| `.stack` | Vertical flow, `--gap` |
| `.cluster` | Wrapping row, `--gap` |
| `.grid` | `--cols`: 3 → 2 at 1000px → 1 at 760px |
| `.grid-auto` | Auto-fill grid, `--min` |
| `.split` | 5 / 7 columns |
| `.wrap-narrow` | 820px |
| `.prose` | 68ch long-form |

### 11.2 Actions

| Part | Classes | Rules |
|---|---|---|
| Button variants | `.btn-mint`, `.btn-ink`, `.btn-glass`, **`.btn-ghost`**, **`.btn-danger`** | Ghost is for the dismissive action beside a Primary (Cancel, Skip). Danger is the Partner button's shape (a white pill) with pink text and a pink ring. Never a solid red block. Use it only for irreversible actions, inside a confirm dialog. |
| Sizes | **`.btn-sm`** (40px), **`.btn-icon`** (44px circle), `.btn-block` | Small only in toolbars, tables and cards. Icon buttons need an `aria-label`. |
| States | `disabled` / `aria-disabled`, **`aria-busy="true"`** | Disabled drops back to an empty glass pill with muted text (never grey). Busy shows a spinner, keeps the width, and the label becomes "Submitting…". |
| Groups | `.btn-row` (2-column grid on phones), `.btn-pair` (Back + Next) | — |
| Links | **`.link`** (inline), `.text-link` (standalone), **`.back-link`** | Ink text with a 2px mint underline, like the landing's "See every project" link. Inline links always underline. |

### 11.3 Forms

| Part | Classes | Rules |
|---|---|---|
| Field anatomy | `.field` › `.label` (+ `.req` or **`.opt`**) › control › **`.help`** / **`.error-text`** / **`.counter`** | Mark either the required fields or the optional ones; whichever is rarer. Errors start with what to do. |
| Text | **`.input`**, **`.textarea`**, **`.select`** | 48px, glass, `--r-field`. Use a native `<select>` (styled), not a custom dropdown. |
| Affixes | **`.input-group`** + **`.affix`**, **`.search`** (pill) | Icons are 18px, in `--ink-muted`. |
| Counter | `textarea[data-max]` + `.counter` | Turns red and sets `aria-invalid` when over the limit. Don't block typing. |
| Checkbox / radio | **`.check`** (native inputs, restyled) | A checked box gets the mint button gradient with an ink tick. A checked radio is a metro station: white with a thick ink ring. Boxes are 22px on a 28px row. Group them in a `fieldset.fieldset` with a `legend`. |
| Option card | **`.option-card`** | A radio or checkbox as a card, when each choice needs a description (track, shirt size with fit notes). |
| Segmented | **`.segmented`** | 2–3 short options. Buttons with `aria-pressed`, or labels wrapping radios. |
| Switch | **`.switch`** + `role="switch"` | Mint-gradient track when on. Only for settings that apply immediately. In forms that are submitted, use a checkbox. |
| Range | **`.range`** + `data-range-out` | Always show the current value as text. |
| File upload | **`label.dropzone`** + `ul.file-list` | A glass panel with a dashed lavender border and a mint icon tile. Say the accepted types and size limit in the label. Show what was chosen. |
| Multi-step | `ol.stepper` for 3+ steps; progress bar + dots for 2 | See section 4. |

### 11.4 Status and feedback

| Part | Classes | Rules |
|---|---|---|
| Chip | **`.chip[aria-pressed]`** | Interactive filters only: a glass pill that turns ink when on, the same as the tabs. "All" goes first. |
| Badge | **`.badge`** + `-success`, `-info`, `-warning`, `-danger`, **`-live`** | Status of a thing ("Open", "Closing soon", "Live now"), styled exactly like the award pill (white, small caps, tinted ring), with text in the status colour. This is what "pills mean status" means. Live is a pulsing mint station dot. |
| Award | `.award` + `.grad` | Wins only. |
| Count | **`.count`** | A small mint-gradient counter on tabs and nav ("3"). |
| Tag | **`.tag`** | Quiet metadata (tech stack, room): a soft lilac label with an 8px radius. Smaller and squarer than a badge. |
| Alert | **`.alert`** (+ `-success`, `-warning`, `-danger`), `.close` | A white glass panel like the candid hint, with a rotated-square status tile in the matching candid-card gradient and an ink icon. Errors also get a pink ring. Bold title says what happened, one line says what to do. Use `role="alert"` only for errors. |
| Callout | **`.callout`** | Tips and asides in guides: a glass panel with a lilac rule on the left. |
| Banner | **`.banner`** | One site-wide message above the nav: the dark marquee strip, with the key words in mint (`<b>`). Max one, ≤ 1 line. |
| Toast | **`DS.toast("…")`** / `[data-toast]` | The candid-egg toast: an ink pill at the bottom centre, mint tick, mint `<b>` for the key word. It inverts in dark mode. Shows for 4s. Confirmations only ("Link copied"); never errors. |
| Progress | **`.progress`** (`--value`), `.indeterminate`, **`.spinner`** | The form card's bar: lilac-pale track, mint → lilac fill. A spinner (mint on lilac) is for waits inside a control. |
| Skeleton | **`.skeleton`** (`.line`, `.title`, `.circle`) | Lavender shapes that shimmer lilac, never grey. They match the shape of what's loading. Put `aria-busy` on the container. |
| Empty state | **`.empty`** | A tilted lilac gradient tile with an ink icon, a Sub heading, one line and one optional button. Friendly and specific. |

### 11.5 Overlays

| Part | Classes | Rules |
|---|---|---|
| Dialog | **`dialog.dialog`** (`.dialog-body`, `-head`, `-foot`), `[data-open]` / `[data-close]` | Styled like the section card: white to lavender, with a mint glow from the top. In dark mode it's the dark sponsor-wall card. It sits over a lavender veil. Use it for decisions and short forms (≤ 3 fields). The safe action is on the left; in a destructive dialog the confirm is `.btn-danger`. Escape and backdrop clicks close it. |
| Drawer / sheet | **`dialog.drawer`** | Filters and secondary panels. It's a side panel on desktop and becomes a bottom sheet on phones. |
| Menu | **`.menu[popover]`** + `popovertarget` | Styled like the station label: near-white card with a soft violet shadow, opening under its button. Up to 7 items; a destructive item (`.danger`, pink) goes last, after a divider. |
| Tooltip | **`.tip[data-tip]`** | A small ink pill. Labels for icon buttons only; never essential information. Shows after 350ms. |

### 11.6 Navigation

| Part | Classes | Rules |
|---|---|---|
| Breadcrumbs | **`nav.breadcrumbs`** | Pages two or more levels deep. The current page is not a link. |
| Tabs | `.tabs` + ARIA `tablist`, `tab`, `tabpanel` | Arrow keys switch tabs (ds.js). For views of the same content (days of a schedule), not page navigation. |
| Pagination | **`nav.pagination`** | Lists of more than 24 items. Prefer filters first. |
| Sub-nav | **`nav.subnav`** | Long pages (rules, resources, schedule). Sticky, highlights the current section as you scroll. Hidden under 1000px. |
| Stepper | **`ol.stepper`** | Flows of 3+ steps. Each step is labelled. |

### 11.7 Content and data

| Part | Classes | Rules |
|---|---|---|
| Cards | `.card` (+ `.card-flat`), **`.media-card`**, **`a.card.link-card`**, **`.card.prize`** (+ `.first`), `.section-card` (+ `.ink`), **`.well`** | A link card makes the whole card the link, with a tilted gradient icon tile and a mint-underlined arrow line. Prize amounts use tabular figures. Only one `.first`, which gets a mint glow and the award gradient on its amount. |
| People | **`.avatar`** (`.sm`, `.lg`, `.xl`; `.lilac`, `.peach`; image or initials), **`.avatar-group`**, **`.person`**, **`.person-row`** | Real people only, with permission. Name, role, and the organisation in teal. Square photos ≥ 256px. With no photo, initials go on a candid-card gradient (mint, lilac or peach), with a white ring. |
| Table | **`.table-wrap` › `table.table`** (+ **`.table-stack`**) | Numbers right-aligned in tabular figures. `.table-stack` turns rows into cards on phones (set `data-label` on each cell). |
| Facts and stats | `dl.facts`, `.stat`, **`ul.checklist`** | Checklist for what-to-bring lists and requirements. |
| Schedule | **`.agenda` › `.agenda-item`** (+ `.is-now`) | Time column 110px, then the title, one line, and tags or badges. The current item gets a mint station dot and a Live badge. Group days with tabs. |
| Timeline | **`ol.timeline`** (`data-state="done"`, `aria-current="step"`, `--done` %) | Drawn as a metro line, like the world route: a 5px mint track up to `--done`, then lilac. Stations are white with ink rings; a done station is aqua-filled; the current one is ringed with a mint halo. Use it for milestones: applications → event → results. |
| Countdown | **`.countdown[data-countdown]`** | One per page, only before a real date. Updates every second (every minute under reduced motion). |
| Quote | **`figure.quote`** | Real, attributed quotes with permission only. Never invented testimonials. |
| Logo tile | **`.logo-tile`** | Sponsor grids outside the logo wall: monochrome at rest, colour on hover. |
| Accordion | **`.accordion`** | The FAQ pattern for any page. |
| Long-form | **`.prose`** | Rules, privacy, code of conduct, guides, posts. Plain HTML inside: headings, lists with mint markers, lilac-rule blockquotes, ink links with mint underlines. |
| Code | `code`, `kbd`, **`pre.code-block`** | Resources and API docs. Inline code sits on lilac-pale; keys are small white caps. The code block is the dark sponsor-wall card with a mint glow, in both themes. |

### 11.8 Page templates to build next

These are assembled only from the parts above. Build them in this order:

| Page | Recipe |
|---|---|
| **Hacker application** | The judge page template: Form card, `ol.stepper` (Profile → Experience → Project → Review), option cards for track, dropzone for résumé, success state. |
| **Schedule** | `.h1` + lede, tabs per day, `.agenda` in a card, sub-nav on desktop, "Live now" badge on the current item. |
| **Prizes and tracks** | Section head, 3 prize cards (one `.first`), track table with sponsors and status badges. |
| **Judges and mentors** | Section head, chip filters, `.grid-auto` of `.person`. |
| **Hacker guide / resources** | Breadcrumbs, `.prose` with sub-nav, callouts, checklist, code blocks, link cards to tools. |
| **Code of conduct / privacy** | `.wrap-narrow` + `.prose`, last-updated caption. |
| **404** | An empty state on a section card, with the skyline standing on it, and a "Back to home" button. |

### 11.9 Adding something new

1. Check the gallery first. Most "new" components are a variant of an existing one.
2. If it's really new, build it from the site's own vocabulary, not a generic UI kit. That vocabulary is:
   - white or glass pills with 1px tinted rings (award, hint, partner)
   - the candid-card gradients (mint, lilac, peach, pink) for tiles
   - metro stations (white dot, ink ring, mint halo) for steps and states
   - ink pills for toasts and tooltips
   - the dark sponsor-wall card for anything dark
   - mint underlines for links

   Then use tokens only: a radius from the scale, an elevation level and the motion curves. No greys, no traffic-light colours, no square corners.
3. Add it to `ds.css` (and `ds.js` if it needs behaviour, opt-in through markup), add a demo and its rules to the gallery, and add a row here.
4. Bump the version at the top of this file and note what changed.
