# Aviary — Visual Design Language

**Always use the `frontend-design` skill** when making UI/visual changes.

**Brand personality:** Warm, friendly, a little poppy and fun. "Aviary" is a bird-themed expense splitting app — it should feel like hanging out with friends, not doing accounting. Approachable and cheerful, never corporate or sterile.

**Color system:**
- **Primary action color: Amber** (`amber-600` buttons, `amber-500` dark mode). This is the app's signature — warm, inviting, and energetic. Used for all primary CTAs, focus rings, and brand highlights.
- **Neutral warmth: Stone** (not gray). Use `stone-*` for text, borders, and surfaces to keep everything warm-toned. `stone-800` for dark text, `stone-200` for borders, `stone-50` for hover states.
- **Background:** `#faf9f7` (light — warm cream), `#0c0a09` (dark — warm charcoal). Never cool blue-toned.
- **Semantic colors:** Emerald for positive/lent, rose for owed/negative, red for danger/errors. These should feel natural alongside the warm palette.
- **Group identity colors:** 12 nature-named hues (honeycomb, teal tanager, iris, rosefinch, jay blue, forest warbler, terracotta, plum starling, kingfisher, ochre oriole, indigo bunting, cardinal). Used as subtle card tints with bold accent stripes. Adjacent groups must never share a color.

**Typography:**
- **Body/UI:** Geist Sans (`--font-sans`) — clean, modern, readable. Set via CSS variable, falls back to system-ui.
- **Logo/editorial:** Cormorant Garamond (`--font-serif-logo`, weight 400) — the "Aviary" wordmark in the nav and bird fact section. Gives editorial warmth. Don't overuse it.
- **Hierarchy:** `font-bold` + `tracking-tight` for headings, `font-semibold` for card titles, `font-medium` for labels. Generous size contrast between heading and body.

**Components:**
- **Buttons:** `amber-600` primary (warm and poppy), white/stone secondary, ghost for tertiary. `rounded-xl` for friendly softness. All have `active:scale-[0.97]` press feedback.
- **Inputs:** `rounded-xl` (auth pages) or `rounded-lg` (app forms), `border-stone-200`, `focus:ring-amber-500`. Amber focus ring ties to brand.
- **Cards:** `bg-white` / `dark:bg-stone-900`, `border-stone-200` / `dark:border-stone-800`. Soft shadow (`shadow-sm`). Hover: lift + shadow increase.
- **Modals:** Backdrop blur (`backdrop-blur-sm`), slide-up entrance animation, `rounded-2xl`.

**Motion:**
- Entrance: `slide-up` (0.2–0.4s, `ease-out`). Stagger with `animation-delay` for lists (80ms between items).
- Hover: `transition-all duration-200`. Lift (`-translate-y-0.5`) + shadow for cards. Scale for small interactive elements.
- Press: `active:scale-[0.97]` on buttons for tactile feedback.
- Keep motion subtle and purposeful — it should feel alive, not distracting.

**Dark mode:** All components must support `dark:` variants. Dark surfaces use `stone-900`/`stone-950` (warm), not cold `gray-*`. Text in dark mode: `stone-200`/`stone-300`.
