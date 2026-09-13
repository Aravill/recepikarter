# Plan: card carousel + Firefox flip fix

Note (2026-09-13): the "desktop looks like phone" decision below was
superseded — at ≥900px the cards now scale up and the stage shows all three
cards in full. See the "Card carousel" entry in `../design-system.md`.

Status: agreed with Michal 2026-09-11, not yet implemented. Two PRs, in this order.

## Context

`app/components/CardStack.vue` is the list page's card view: a Tinder-style
deck (prev card peeking above, next two behind, top card dragged off-screen
to advance). It's being replaced with a horizontal carousel. Reference
mockup: active card centered, the left/right neighbors partially visible at
the stage edges. Independently, the card flip is broken on Firefox for
Android; it's fixed first because the carousel builds on the same flip code.

Decisions already made:

- Stage width is capped (~360px) on every screen size, so neighbors only ever
  peek in from the edges — desktop looks like phone.
- Tapping a visible neighbor navigates to it.
- Wraparound is infinite in both directions, even with 1 or 2 recipes. With
  1 recipe the neighbors are clones of the same card.
- A swipe slides the card into the neighbor's slot; nothing flies off-screen.
- No rotation while dragging (that was a deck thing).
- The dark tall block behind the center card in the mockup is noise; ignore.

---

## PR 1 — `FlipCard` extraction + Firefox Android flip fix

### The bug

Symptom on Firefox Android: tap to flip, the back shows for ~0.5s, then the
**front** appears mirrored.

Cause: commit 861bf62 ("stop the flip animation from leaving cards blurry")
drops `perspective` + `transform-style: preserve-3d` once the 0.5s
transition ends (the transient `flipping` state), on the claim that at rest
at 180° the flattened result is identical. That's only true in Chrome. Per
spec (Firefox follows it), once `.flip-inner` is flattened,
`backface-visibility` on each face is evaluated **without** the parent's
rotation: the front face (no own transform) is "facing the viewer" → shown;
the back face (own `rotateY(180deg)`) is "facing away" → hidden. The parent's
`rotateY(180deg)` then mirrors that flat picture. Commit 8107ad7 (#16) fixed
the *start* of the animation with a 2×rAF deferral; the *end* was still broken.

The same pattern is duplicated in `app/pages/recipes/[id].vue`
(`.detail-preview` / `.flip-inner` / `flipping`), so the detail preview is
broken the same way.

### Fix

Never rely on `rotateY(180deg)` + `backface-visibility` at rest. Model the
flip as a single `phase` instead of `flipped` + `flipping` booleans:

| phase        | `.flip-inner`                                   | faces                                                    | 3D context |
|--------------|-------------------------------------------------|----------------------------------------------------------|------------|
| `rest-front` | `transform: none`, transition on                | front visible, back has its usual `rotateY(180deg)`       | off        |
| `to-back`    | enable 3D, wait 2 rAF (existing trick), then `rotateY(180deg)` | unchanged                                     | on         |
| `rest-back`  | `transform: none` set with transition **off** for that frame | back `transform: none`; front `visibility: hidden` | off  |
| `to-front`   | restore `rotateY(180deg)` + 3D with transition off, 2 rAF, then animate to 0° | restore normal face transforms | on |

Transitions between phases use `transitionend` on `.flip-inner` (with the
existing generation counter as a guard against stale callbacks), not a 520ms
`setTimeout`. Keep the 2×rAF "paint the 3D context before rotating" deferral
from #16 — it's still needed on Firefox Android for `to-back` and
`to-front`.

Extract this into `app/components/FlipCard.vue`:

- props: `recipe: Recipe | RecipeInput`, `side: 'front' | 'back'` (controlled
  by the parent; the component animates whenever `side` changes).
- renders two `RecipeCard`s (front/back) inside `.flip-inner`.
- `defineExpose({ frontEl, backEl })` so parents can hand the faces to
  `exportCardPng`.
- Use it from both `CardStack.vue` and `app/pages/recipes/[id].vue`, deleting
  the duplicated flip CSS/logic from each.

`app/utils/exportCard.ts`: when capturing the front face, pass
`style: { visibility: 'visible' }` (it's hidden while resting on the back);
the back-face capture already overrides `transform: 'none'` — keep that and
add `visibility` there too for symmetry.

Verify on the actual phone (Firefox Android): flip to back, wait, flip to
front, on both the list page and the detail page. Also check that cards are
still sharp at rest (the reason 861bf62 existed).

---

## PR 2 — carousel

### `app/components/CardStack.vue` rewrite

1. **Stage**: `width: 100%; max-width: 360px; overflow: hidden`, centered.
   Cards stay 240×502; with a ~16px gap that leaves ~44px of each neighbor
   visible. Height stays ~528px.
2. **Track**: a window of 5 slots, offsets `-2..+2`, each showing
   `recipes[(index + offset + n) % n]` (`n = recipes.length`). Key slots by
   **offset**, not recipe id — with 1 or 2 recipes the same recipe appears in
   several slots, including as its own neighbor. Slot position:
   `translateX(offset * SLOT)` where `SLOT = cardWidth + gap`. Offsets ±1/±2
   get `scale(~0.92)` + `opacity: ~0.6` and show the front face only.
   ±2 slots exist so a card is already in place when the track slides.
3. **Wrap**: `n === 0` → empty stage. ‹ › buttons are never disabled.
   `goPrev`/`goNext`/ArrowLeft/ArrowRight all use the slide animation, not an
   instant index change.
4. **Drag**: `dragX` translates the whole track (`translateX(dragX)`), no
   rotation. Clamp or rubber-band `|dragX|` to `SLOT` so the user can't drag
   past the ±1 neighbor into the ±2 card.
5. **Release**: `|dragX| > SWIPE_THRESHOLD` → animate the track to `∓SLOT`;
   on `transitionend`, update `index`, and reset the track translate to 0
   with transitions disabled for that frame. Because the window re-renders
   around the new index, the after-state is pixel-identical to the
   before-state → no visible jump. Under threshold → animate back to 0.
   Guard against a second gesture starting mid-slide (ignore pointerdown while
   sliding, or let the new drag take over from the current translate).
6. **Tap a neighbor**: ±1 slots get pointer events for a plain click →
   same slide as goPrev/goNext. ±2 slots stay `pointer-events: none`.
7. **Center slot only**: tap-to-flip (`FlipCard` from PR 1), long-press
   actions (✎ / ⬇ / `{}`), export refs. `watch(index)` and
   `watch(() => props.recipes)` still reset side to front and hide actions.
   Note the center card is **no longer remounted** on index change (its key
   is the slot), so resets go through `FlipCard`'s `side` prop, not a
   remount — if the recipe swaps while the card is at `rest-back`, the
   component must snap to `rest-front` without animating.
8. **Single source of truth for `SLOT`**: card width and gap as CSS custom
   properties on `.stage`, read in JS via `getComputedStyle` (or a shared
   constant used by both the style binding and the release math). The
   slide distance must match the layout exactly or the reset in step 5 jumps.
9. Keep: `touch-action: pan-y` on the track, pointer capture, TAP_THRESHOLD,
   LONG_PRESS_MS, the ‹ *n* / *total* › counter row, `markExported` after
   PNG export.

Remove: `prevRecipe`, `backgroundLayers`, `FLY_OUT_DISTANCE`, the
`rotate(dragX / 18deg)` transform, the deck-specific `transform-origin` rules.

### Other files

- `docs/design-system.md` lines ~125–141: rewrite the "Card stack" entry as
  "Card carousel" — side-by-side, edges of neighbors always visible in a
  capped-width stage, infinite wraparound (also update the "clamped at the
  ends, no wraparound" sentence), swipe slides the card into the neighbor's
  slot, tap a neighbor to go there, ‹ › row still there for non-touch.
  The flip/long-press paragraph stays.
- Optional: pull the wrap index helper (`wrapIndex(i, n)`) into
  `app/utils/` and give it a tiny Vitest case for n=1, n=2, negative deltas.

### Verify

`npm run lint`, `npm run test`, `npm run build`, then in the browser (and on
the phone): 0 / 1 / 2 / many recipes, swipe both directions repeatedly,
click neighbors, arrow keys, flip in the center, long-press actions, PNG
export while flipped to back, search/filter change resets to card 1.
