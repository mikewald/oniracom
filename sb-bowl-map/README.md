# Venue Map

Interactive 3D multi-level venue map: floors stacked in isometric 3D, a searchable directory, category filters, map pins and a detail panel. Rebuilt for 2026 from the 2016 Codrops *Interactive 3D Mall Map* demo.

Everything about a venue (floors, places, categories, colours) lives in **`data/`**. To make a new map, swap the data. You don't need to change any code.

## Quick start

```bash
npm start          # serves on http://localhost:5173 (or: python3 -m http.server)
npm run check      # validates data/venue.json against the level SVGs
```

It's plain ES modules with no dependencies and no build step. It deploys to any static host (Netlify, Vercel, GitHub Pages, S3, WP Engine, etc.). You do need to serve it over HTTP, because opening `index.html` straight from disk blocks the data fetch.

## Project layout

```
index.html               Shell (loads tokens, styles, main.js)
data/
  venue.json             ← the venue: name, theme, categories, levels, spaces
  venue.schema.json      JSON Schema (gives autocomplete in VS Code)
  levels/level-N.svg     ← one floor plan per level
  surroundings.svg       Optional ground image under the stack
src/
  main.js                Boot + error state
  venue-map.js           The component: state, rendering, transitions
  data.js                Loads venue.json + SVGs, sanitises SVGs, validates
  icons.js               Stroke icon set + pin shape
  dom.js                 h() helper, settle() (animation-finished promise), search normalise
  styles/tokens.css      ← colours/fonts (light + dark)
  styles/app.css         Layout, 3D stack, pins, directory, detail panel
scripts/validate.mjs     Data checker (npm run check)
```

## Making a new venue

1. **Draw each floor** in Figma or Illustrator on the same artboard size (the demo uses 1200×800). Export each floor as SVG to `data/levels/`.
2. **Tag the shapes** with these classes. They're optional, and they pick up theme colours automatically:
   | class | use |
   |---|---|
   | `ground` | floor fill |
   | `outline` | walls / perimeter |
   | `space` | any unit or room |
   | `lake`, `tree` | decorative |

   Add `data-space="ID"` to every shape that should be clickable and highlightable.
3. **List the places** in `venue.json`:
   ```json
   {
     "id": "2.04",
     "name": "Cognitio",
     "level": "2",
     "category": "give",
     "meta": { "Hours": "8:30AM – 11:30PM", "Phone": "(805) 555-0142" },
     "description": "…",
     "url": "https://example.com"
   }
   ```
   `pin` (`[x, y]` in SVG units) is optional. If you leave it out, the pin sits at the centre of the matching shape. `logo` swaps the category icon for an image.
4. **Brand it** with `"theme": { "--accent": "#e4572e" }` in `venue.json`. To go further, edit `src/styles/tokens.css`. Category colours come from `categories[].color`.
5. Run `npm run check`.

Floors are listed bottom first. Any number of floors works, and the stack spacing adjusts automatically.

## Features

- **Deep links:** `?level=2` opens a floor and `?space=2.04` opens a place. The URL updates as you browse, so any view can be shared.
- **Keyboard:** `/` focuses search, `↑`/`↓` (or PgUp/PgDn) changes floor, and `Esc` closes the panel and then goes back to all floors. Floors, pins and list items are all real buttons with labels.
- **Accessibility:** hidden layers are made `inert`, changes are announced through a live region, and focus goes back to the pin when the panel closes. It respects `prefers-reduced-motion`.
- **Light and dark themes** follow the OS. You can force one with `<html data-theme="dark">`.
- **Responsive:** sizing uses container-query units, so the map scales to its box, not the window. Below 56rem wide, the directory becomes a slide-over drawer.
- **Safe SVG inlining:** scripts, `foreignObject` and event handlers are stripped from floor plans.

## Deploying on Cloudflare Pages (from GitHub)

- Build command: *none*. Build output directory: the folder that contains `index.html` (`/` if it's at the repo root).
- Keep `404.html`. Without it, Pages treats the site as a single-page app and returns `index.html` for any missing file, which shows up as "…is not valid SVG".
- File paths are case-sensitive. `data/levels/level-4.svg` has to match `venue.json` exactly.

## Embedding in another site

Host the folder anywhere and embed it with an iframe:

```html
<iframe src="https://maps.example.com/venue/?level=1" title="Venue map"
        style="width:100%;height:80vh;border:0" loading="lazy"></iframe>
```

To serve several venues from one install, copy `index.html` and change `data-venue="data/venue.json"` to point at another config.

## What changed from the 2016 original

| 2016 | Now |
|---|---|
| Modernizr, classie.js, List.js | No dependencies |
| ES5 IIFE, `var`, vendor prefixes, `transitionend` shims | ES modules, private class fields, Web Animations `finished` promises |
| 926 lines of hand-written HTML; adding a store meant editing 3 places | `venue.json` + one SVG per floor |
| CSS hard-coded to exactly 4 floors | Any number of floors (CSS custom properties) |
| Pin positions in per-pin CSS classes | `[x, y]` in data, or automatic from the shape |
| `href="#"` links, no keyboard nav | Buttons, `inert`, live region, keyboard shortcuts |
| Viewport units (broke when embedded) | Container-query units |
| Light theme only | Light and dark tokens, per-venue theming |
| Brand-logo icon font | Category icon set (or per-place image logos) |

**Browser support:** current Chrome, Edge, Safari and Firefox. It relies on `:has()`, `color-mix()`, container queries and `inert`, which have been supported everywhere since 2023.

## Credits & licence

This is based on [Interactive 3D Mall Map](https://github.com/codrops/Interactive3DMallMap) by Codrops (2016). The original JS is MIT-licensed. Codrops' licence allows building on it in personal and commercial projects, but not republishing or selling it "as-is". The demo floor plans and `surroundings.svg` come from the original. The 2016 brand-logo icons (Flaticon/Freepik) have been removed, and the icons in `src/icons.js` are new.
