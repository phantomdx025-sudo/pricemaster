# Phase AX-0 — Full Colour Palette Swap ✅

## What Was Built

Pure palette swap — no component logic changed, no new files added, no Supabase changes.

Replaced the existing warm amber/cream theme with a **deep space dark + electric violet** palette across all three styling entry points.

---

## Files Modified

### 1. `src/index.css`
- Replaced `:root` block entirely — amber/cream variables → space/violet variables
- Replaced `.dark` block entirely — warm brown darks → deeper navy darks
- **Both light and dark mode are now dark-background** — `--bg-base` is `#080b14` (light mode) and `#04060d` (dark mode). This is intentional; ANKxIOUS is a dark-first app with no cream/white mode.
- Also updated the one hardcoded `rgba(212,132,42,0.15)` focus-ring shadow in `.input-field:focus` → `rgba(124,111,247,0.20)` to match the new violet brand.
- All other CSS below the variable blocks is **unchanged** — animations, utilities, scrollbar, etc. all untouched.

**Key new values:**

| Variable | Old | New |
|---|---|---|
| `--bg-base` | `#fffbf0` cream | `#080b14` deep space |
| `--bg-surface` | `#ffffff` | `#0e1220` |
| `--bg-elevated` | `#faf7f5` | `#151a2e` |
| `--brand` | `#d4842a` amber | `#7c6ff7` electric violet |
| `--brand-hover` | `#b86820` | `#9d94f9` |
| `--brand-light` | `#faefd9` | `#1e1a3d` |
| `--text-primary` | `#2b1e1a` dark brown | `#e8eaf5` cool off-white |
| `--text-secondary` | `#7a4020` | `#8b91b8` muted blue-grey |
| `--border` | `#e6d9cf` | `#1e2440` |

### 2. `src/components/financial/FinPdfExport.jsx`
- Replaced the `C` object RGB arrays with new violet/space values.
- **PDF remains light-background** for printability (per masterplan recommendation). Page background stays white (`C.white`, `C.surface`), body text uses near-black navy `C.text = [20, 20, 40]`.
- `C.brand` → `[124, 111, 247]` — violet header bars.
- `C.brandLight` → `[240, 238, 255]` — very light violet tint for alternating rows (replaces amber `[250, 239, 217]`).
- Added `C.bgBase`, `C.bgSurface`, `C.textPrimary`, `C.textMuted`, `C.border` as reference entries (matching masterplan spec) — these are present in the object for completeness but the existing PDF draw code uses `C.brand`, `C.brandLight`, `C.surface`, `C.text`, `C.muted`, `C.white` etc., which are all updated.
- `C.black` → `[4, 6, 13]` (near-black, per masterplan).

### 3. `tailwind.config.js`
- Replaced `extend.colors` amber/cream tokens (`brand`, `surface`, `cream`) with new space/violet tokens (`brand`, `surface`, `space`).
- Replaced `warm-sm/warm/warm-lg/warm-xl` box shadows with `space-sm/space/space-lg/space-xl` equivalents.
- **No component code uses these Tailwind colour tokens directly** (the codebase uses CSS variables exclusively for colour), but the old amber tokens were present as potential override vectors — removing them prevents any accidental Tailwind utility class conflicts in future phases.

---

## Files NOT Changed

Everything else is untouched:
- All JSX components (`src/components/`, `src/pages/`)
- All hooks (`src/hooks/`)
- All lib files (`src/lib/`)
- `App.jsx`, `main.jsx`
- `public/manifest.json`, `public/sw.js`, icons
- `vite.config.js`, `postcss.config.js`, `package.json`
- All Supabase migrations and edge functions
- `sync/` Python tool

---

## Non-Obvious Decisions

1. **PDF stays light background.** The masterplan explicitly recommends keeping PDF white for printability. Only the accent colour (header bar, tint rows) switches to violet. Body text on PDF uses `[20, 20, 40]` (dark navy) rather than pure black for visual softness while remaining printable.

2. **`brandLight` in PDF = `[240, 238, 255]`.** This is a very light violet tint, suitable for alternating table rows on a white page. The dark `#1e1a3d` CSS variable version would be unreadable on a white PDF background, so this diverges intentionally.

3. **`tailwind.config.js` updated even though not in the two listed files.** The masterplan explicitly states: *"Check and remove any hardcoded amber/cream hex values if present — they override CSS vars in unexpected ways."* The config had a full amber `brand` scale and `cream` palette — these were replaced.

4. **Focus ring rgba updated.** The `.input-field:focus` rule had `rgba(212,132,42,0.15)` hardcoded (amber glow). This would look jarring with violet brand — updated to `rgba(124,111,247,0.20)`.

---

## What the Next Phase (AX-1) Must Know

- All colours are now space/violet. AX-1 rebranding (PriceMaster → ANKxIOUS) should test against dark backgrounds only — there is no light mode to test.
- `tailwind.config.js` now has `brand-500 = #7c6ff7` (violet), matching `--brand` CSS var — any Tailwind utility classes using `brand-*` will now emit violet.
- The `BUSINESS_NAME` constant in `FinPdfExport.jsx` still reads from `VITE_BUSINESS_NAME` env var — AX-1 will handle renaming this.
- No Supabase changes were made in this phase.

---

## Supabase Setup Steps

None required for AX-0.
