<script setup lang="ts">
import type { Recipe } from '#shared/types/recipe'

const props = defineProps<{ recipes: Recipe[] }>()

const { markExported } = useRecipes()

const TAP_THRESHOLD = 8
const SWIPE_THRESHOLD = 90
const LONG_PRESS_MS = 450

// Card size + gap as a single shared source of truth: exposed to the
// stylesheet as CSS custom properties on the stage (actual layout) and used
// for the slide-distance math below. The stage's stylesheet multiplies them
// by `--card-scale` (1 on phones, larger on desktop — see the media query in
// <style>), so the JS side reads the *effective* slot width back from the
// computed style (`slotPx`) instead of assuming the unscaled constant.
// Keeping layout and math derived from the same values is what keeps the
// release/reset step pixel-exact — a mismatch shows as a jump after a slide.
const CARD_WIDTH = 240
const CARD_HEIGHT = 502
const CARD_GAP = 16
const NEIGHBOR_SCALE = 0.92
const NEIGHBOR_OPACITY = 0.6

const index = ref(0)
const side = ref<'front' | 'back'>('front')
const actionsShown = ref(false)
const exporting = ref(false)
// Shopping mode: the center card's ingredients become a tick-off list and
// the stack freezes around it — no swipe, flip, long press, keyboard nav or
// actions until the user leaves the mode via the button under the card.
// The ticks themselves live in RecipeCard and are forgotten on exit.
const shopping = ref(false)
// The track's current translateX, in px. Tracks the live drag 1:1 while
// dragging; animated (via CSS transition) to a target slot offset or back
// to 0 otherwise.
const trackX = ref(0)
const dragging = ref(false)
// True for the duration of any track-settle animation (slide to a
// neighbor, or the under-threshold rebound back to 0) — guards against a
// second gesture starting mid-animation, per the plan's simpler option.
const sliding = ref(false)
// Suppresses the track's transition for exactly one frame: the "reset to
// 0" step after a slide completes, so the window can re-render around the
// new index without any visible jump (see slideTo).
const noTrackTransition = ref(false)
const flipCardRef = ref<{ frontEl: HTMLElement | null; backEl: HTMLElement | null } | null>(null)
const stageRef = ref<HTMLElement | null>(null)

let startX = 0
let pointerId: number | null = null
let movedPastTapThreshold = false
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressFired = false
// Which slot (by offset) the current gesture's pointerdown landed on — null
// when it started on the bare track (e.g. over a ±2 slot, which stays
// pointer-events: none and lets the event fall through).
let downOffset: number | null = null
let trackTransitionDone: (() => void) | null = null
// Distance between neighboring slots in screen px, i.e. (width + gap) ×
// the stage's current `--card-scale`. Only the slots are scaled (not the
// track), so drag deltas from clientX stay 1:1 with trackX and only the
// slide target/clamp need this. Read after mount and on resize; gestures
// can't happen before mount, so the unscaled default never actually
// drives one.
let slotPx = CARD_WIDTH + CARD_GAP

function readSlotPx() {
  if (!stageRef.value) return
  const scale = parseFloat(getComputedStyle(stageRef.value).getPropertyValue('--card-scale')) || 1
  slotPx = (CARD_WIDTH + CARD_GAP) * scale
}

onMounted(() => {
  readSlotPx()
  window.addEventListener('resize', readSlotPx)
})

onUnmounted(() => {
  window.removeEventListener('resize', readSlotPx)
})

const n = computed(() => props.recipes.length)
const current = computed(() => props.recipes[index.value])

// A window of 5 slots, offsets -2..+2, each showing the recipe that many
// steps ahead of/behind the current one, wrapping around the list.
// Slots are keyed by offset (not recipe id) below — with 1 or 2 recipes
// the same recipe legitimately appears in several slots at once, including
// as its own neighbor.
const slots = computed(() => {
  const total = n.value
  if (total === 0) return []
  return [-2, -1, 0, 1, 2].map((offset) => ({
    offset,
    recipe: props.recipes[wrapIndex(index.value + offset, total)],
  }))
})

watch(
  () => props.recipes,
  () => {
    index.value = 0
    side.value = 'front'
    actionsShown.value = false
    // The list under the stack changed (filter/search) — the card being
    // shopped for may not even be in it anymore.
    shopping.value = false
  },
)

watch(index, () => {
  side.value = 'front'
  actionsShown.value = false
})

function setFlipCardRef(el: unknown) {
  flipCardRef.value = el as { frontEl: HTMLElement | null; backEl: HTMLElement | null } | null
}

async function onExportPng() {
  const frontEl = flipCardRef.value?.frontEl
  const backEl = flipCardRef.value?.backEl
  const recipe = current.value
  if (!frontEl || !backEl || !recipe) return
  exporting.value = true
  try {
    await exportCardPng(frontEl, backEl, recipe.name)
    await markExported(recipe.id)
  } catch {
    // Quick-access export from the browse screen — on failure the user can
    // still export (and see an error) from the recipe's own detail page.
  } finally {
    exporting.value = false
  }
}

function onExportJson() {
  if (current.value) exportRecipeJson(current.value)
}

function onEdit() {
  if (current.value) navigateTo(`/recipes/${current.value.id}`)
}

function enterShopping() {
  if (!current.value) return
  actionsShown.value = false
  // Ingredients are on the front.
  side.value = 'front'
  shopping.value = true
}

function exitShopping() {
  shopping.value = false
}

function clearLongPressTimer() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onTrackTransitionEnd(e: TransitionEvent) {
  if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
  const done = trackTransitionDone
  trackTransitionDone = null
  done?.()
}

function animateTrackTo(target: number, onSettled: () => void) {
  sliding.value = true
  trackTransitionDone = () => {
    sliding.value = false
    onSettled()
  }
  trackX.value = target
}

function slideTo(direction: 1 | -1) {
  if (sliding.value || shopping.value || n.value === 0) return
  animateTrackTo(direction === 1 ? -slotPx : slotPx, () => {
    index.value = wrapIndex(index.value + direction, n.value)
    // The window re-renders around the new index, so the after-state is
    // pixel-identical to the before-state at trackX = 0 — reset with the
    // transition off for one frame so that re-centering isn't itself
    // animated (which would look like a snap-back).
    noTrackTransition.value = true
    trackX.value = 0
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        noTrackTransition.value = false
      })
    })
  })
}

function goPrev() {
  slideTo(-1)
}
function goNext() {
  slideTo(1)
}

function getSlotOffset(target: HTMLElement): number | null {
  const el = target.closest<HTMLElement>('.card-slot')
  const raw = el?.dataset.offset
  return raw !== undefined ? Number(raw) : null
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.card-action-btn')) return
  // In shopping mode the only interaction on the track is ticking the
  // checkboxes, which are plain native inputs — leaving the pointer alone
  // here is what lets their clicks through untouched.
  if (sliding.value || shopping.value) return
  dragging.value = true
  movedPastTapThreshold = false
  longPressFired = false
  startX = e.clientX
  pointerId = e.pointerId
  downOffset = getSlotOffset(e.target as HTMLElement)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

  // Holding still (not dragging) on the center card for LONG_PRESS_MS
  // reveals the edit/download buttons instead of flipping it.
  clearLongPressTimer()
  if (downOffset === 0) {
    longPressTimer = setTimeout(() => {
      if (!movedPastTapThreshold) {
        longPressFired = true
        actionsShown.value = true
      }
    }, LONG_PRESS_MS)
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  if (longPressFired) return
  const dx = e.clientX - startX
  if (Math.abs(dx) > TAP_THRESHOLD) {
    movedPastTapThreshold = true
    clearLongPressTimer()
  }
  // Clamped to +/- one slot so the user can't drag past the ±1 neighbor
  // into the ±2 card that's waiting there for the next slide.
  trackX.value = Math.max(-slotPx, Math.min(slotPx, dx))
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  dragging.value = false
  pointerId = null
  clearLongPressTimer()

  if (longPressFired) {
    // The long press already revealed the actions; releasing shouldn't also
    // flip the card.
    longPressFired = false
    return
  }

  if (!movedPastTapThreshold) {
    trackX.value = 0
    if (downOffset === 0) {
      flipCenter()
    } else if (downOffset === 1 || downOffset === -1) {
      actionsShown.value = false
      slideTo(downOffset)
    }
    // downOffset null or ±2: a tap on the bare track/an unreachable slot —
    // nothing to do.
    return
  }

  actionsShown.value = false
  const dx = trackX.value
  const wantsNext = dx < 0

  if (Math.abs(dx) > SWIPE_THRESHOLD) {
    slideTo(wantsNext ? 1 : -1)
  } else {
    animateTrackTo(0, () => {})
  }
}

function flipCenter() {
  // Same rule as a tap on the center card: while the actions are showing,
  // the gesture dismisses them instead of flipping.
  if (actionsShown.value) actionsShown.value = false
  else side.value = side.value === 'front' ? 'back' : 'front'
}

function onKeydown(e: KeyboardEvent) {
  if (shopping.value) return
  if (e.key === 'ArrowLeft') goPrev()
  else if (e.key === 'ArrowRight') goNext()
  else if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
    // Only when the stage itself is focused — not a button inside it, which
    // handles Enter/Space on its own.
    e.preventDefault()
    if (n.value) flipCenter()
  }
}
</script>

<template>
  <div class="card-stack">
    <div
      ref="stageRef"
      class="stage"
      :class="{ shopping }"
      tabindex="0"
      :style="{
        '--card-width': `${CARD_WIDTH}px`,
        '--card-height': `${CARD_HEIGHT}px`,
        '--card-gap': `${CARD_GAP}px`,
        '--neighbor-opacity': NEIGHBOR_OPACITY,
      }"
      @keydown="onKeydown"
    >
      <div
        v-if="recipes.length"
        class="track"
        :class="{ 'no-transition': dragging || noTrackTransition, dragging }"
        :style="{ transform: `translateX(${trackX}px)` }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @transitionend="onTrackTransitionEnd"
      >
        <div
          v-for="slot in slots"
          :key="slot.offset"
          class="card-slot"
          :class="{ center: slot.offset === 0, far: Math.abs(slot.offset) === 2 }"
          :data-offset="slot.offset"
          :style="{
            transform: `translateX(calc(-50% + ${slot.offset} * var(--slot))) scale(calc(var(--card-scale) * ${slot.offset === 0 ? 1 : NEIGHBOR_SCALE}))`,
            zIndex: 10 - Math.abs(slot.offset),
          }"
        >
          <FlipCard v-if="slot.offset === 0" :ref="setFlipCardRef" :recipe="slot.recipe" :side="side" :shopping="shopping" />
          <RecipeCard v-else :recipe="slot.recipe" side="front" />

          <div v-if="slot.offset === 0 && !shopping" class="card-actions" :class="{ shown: actionsShown }">
            <button class="card-action-btn" aria-label="Upravit recept" @click.stop="onEdit">✎</button>
            <button class="card-action-btn" aria-label="Nákupní režim" @click.stop="enterShopping">🛒</button>
            <button
              class="card-action-btn"
              aria-label="Stáhnout PNG"
              :disabled="exporting"
              @click.stop="onExportPng"
            >
              ⬇
            </button>
            <button class="card-action-btn" aria-label="Stáhnout JSON" @click.stop="onExportJson">{}</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="recipes.length && shopping" class="stack-nav">
      <button type="button" class="shopping-exit" @click="exitShopping">
        <span aria-hidden="true">🛒</span>
        Ukončit nákupní režim
      </button>
    </div>
    <div v-else-if="recipes.length" class="stack-nav">
      <button type="button" aria-label="Předchozí recept" @click="goPrev">‹</button>
      <span class="stack-count">{{ index + 1 }} / {{ recipes.length }}</span>
      <button type="button" aria-label="Další recept" @click="goNext">›</button>
    </div>
  </div>
</template>

<style scoped>
.card-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

/* Phone: a capped-width stage with just the neighbors' edges peeking in at
   the sides. The cards themselves are always laid out at their native
   240×502 (the printed-card facsimile RecipeCard is built around) and
   scaled as a whole via `--card-scale` — the desktop media query below
   raises it; nothing inside the card ever reflows. */
.stage {
  --card-scale: 1;
  --slot: calc((var(--card-width) + var(--card-gap)) * var(--card-scale));
  position: relative;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  /* card height + room for its drop shadow */
  height: calc(var(--card-height) * var(--card-scale) + 26px);
  overflow: hidden;
  outline: none;
}

/* Desktop (same breakpoint as the detail page's two-column layout): bigger
   cards, and a stage exactly wide enough for the center card plus both
   neighbors in full instead of cropped slivers. The ±2 cards enter/leave
   through a soft fade at the edges rather than a hard crop. */
@media (min-width: 900px) {
  .stage {
    --card-scale: 1.3;
    max-width: calc((3 * var(--card-width) + 2 * var(--card-gap)) * var(--card-scale));
    mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
  }
}

.track {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: pan-y;
  /* A mouse drag across the card text would otherwise start a selection. */
  user-select: none;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.track.no-transition {
  transition: none;
}

/* Each slot's own transform is static for the life of its DOM node — it's
   keyed by offset, not recipe id, so a given node's position never
   changes; only which recipe it displays does. Sliding is entirely the
   track's own transform animating, not the slots'.
   The slot box stays unscaled: `translateX(-50%)` is relative to its native
   width, and scaling about top-center keeps that horizontal center put, so
   slot 0 is centered and slot k lands at k × --slot for any scale. */
.card-slot {
  position: absolute;
  left: 50%;
  top: 0;
  width: var(--card-width);
  height: var(--card-height);
  transform-origin: top center;
  opacity: var(--neighbor-opacity);
}

.card-slot.center {
  opacity: 1;
}

/* Mouse: clicking is the primary action (flip the center card, go to a
   neighbor), so advertise that instead of dragging — dragging still works,
   and the cursor switches to grabbing once one actually starts. Hovering
   the center card reveals the action buttons that touch gets via long
   press, and neighbors brighten to read as click targets. Gated on a fine
   pointer so touch devices at desktop widths keep the touch behavior. */
@media (hover: hover) and (pointer: fine) {
  .track {
    cursor: default;
  }

  .track.dragging {
    cursor: grabbing;
  }

  .card-slot:not(.far) {
    cursor: pointer;
    transition: opacity 0.18s ease;
  }

  .card-slot:not(.center, .far):hover {
    opacity: 0.85;
  }

  .card-slot.center:hover .card-actions {
    opacity: 1;
    pointer-events: auto;
    transform: translate(0, 0) scale(1);
  }

  /* Neighbors aren't click targets while shopping, so don't advertise it. */
  .stage.shopping .card-slot:not(.center) {
    cursor: default;
  }

  .stage.shopping .card-slot:not(.center):hover {
    opacity: var(--neighbor-opacity);
  }
}

/* Shopping mode: the track stays put and the neighbors recede so the
   center card reads as the single thing on screen. */
.stage.shopping .track {
  cursor: default;
}

.stage.shopping .card-slot:not(.center) {
  opacity: calc(var(--neighbor-opacity) * 0.5);
  transition: opacity 0.18s ease;
}

/* ±2 slots exist purely so a card is already in place when the track
   slides one step further — never a tap target themselves. */
.card-slot.far {
  pointer-events: none;
}

/* Hidden by default on every input type — holding the center card (not
   dragging) reveals them; tapping the card flips it instead of opening the
   buttons, and tapping anywhere while they're shown dismisses them again. */
.card-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 1;
  opacity: 0;
  pointer-events: none;
  transform: translate(8px, -8px) scale(0.85);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.card-actions.shown {
  opacity: 1;
  pointer-events: auto;
  transform: translate(0, 0) scale(1);
}

.card-action-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: rgba(36, 31, 26, 0.72);
  color: #fdf9f2;
  font-size: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.card-action-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.stack-nav {
  display: flex;
  align-items: center;
  gap: 16px;
}

.stack-nav button {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--text);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Same specificity as the `.stack-nav button` rule above, or its fixed
   36px width would win and squash the label. */
.stack-nav .shopping-exit {
  width: auto;
  padding: 0 16px;
  border-color: var(--accent);
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  white-space: nowrap;
  gap: 8px;
}

.stack-count {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-dim);
  min-width: 52px;
  text-align: center;
}
</style>
