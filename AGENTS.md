# AGENTS.md

## Cursor Cloud specific instructions

This repo is a static Vite portfolio (`porfolio`). There is no backend, database, or auth.

### Run

- Dev server: `npm run dev` — http://localhost:5173/ (`strictPort: true` in `vite.config.js`)
- Production preview: `npm run preview` (also port 5173; stop the dev server first)
- Standard scripts live in `package.json`. There are **no lint or test scripts**.

### Notes

- Dependencies: `npm ci` (Node 22, lockfile present).
- Linux is case-sensitive: paths in `src/portfolio-images.js` must match files in `public/images` exactly (including case).
- Runtime fallbacks try webp → png → jpg automatically (`src/image-assets.js`) — no re-sync needed for format mismatches.
- `npm run images:sync` — copy sources from `Images/` to `public/` + refresh manifest (no optimization).
- `npm run images:manifest` — refresh manifest only from files already in `public/`.
- `npm run images:optimize` — WebP compression only; run once when adding new sources, not on every dev session.
- GitHub Pages builds use `npm run build:gh-pages` (`GITHUB_PAGES=true`, base `/Porfolio/`). Local dev uses `base: '/'`.
