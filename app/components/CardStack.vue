<script setup lang="ts">
import type { Recipe } from '#shared/types/recipe'

const props = defineProps<{ recipes: Recipe[] }>()

const { markExported } = useRecipes()

const TAP_THRESHOLD = 8
const SWIPE_THRESHOLD = 90
const LONG_PRESS_MS = 450

// Card width + gap as a single shared source of truth: used both for the
// stage's CSS custom properties (actual layout) and the slide-distance math
// below (SLOT). Keeping both derived from the same constants is what keeps
// the release/reset math in step 5 pixel-exact with the layout — see the
// plan note this mirrors.
const CARD_WIDTH = 240
const CARD_GAP = 16
const SLOT = CARD_WIDTH + CARD_GAP
const NEIGHBOR_SCALE = 0.92
const NEIGHBOR_OPACITY = 0.6

const index = ref(0)
const side = ref<'front' | 'back'>('front')
const actionsShown = ref(false)
const exporting = ref(false)
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
  if (sliding.value || n.value === 0) return
  animateTrackTo(direction === 1 ? -SLOT : SLOT, () => {
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
  if (sliding.value) return
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
  // Clamped to +/- SLOT so the user can't drag past the ±1 neighbor into
  // the ±2 card that's waiting there for the next slide.
  trackX.value = Math.max(-SLOT, Math.min(SLOT, dx))
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
      // A tap while the actions are showing dismisses them and reverts to
      // the standard interactions, rather than also flipping the card.
      if (actionsShown.value) actionsShown.value = false
      else side.value = side.value === 'front' ? 'back' : 'front'
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

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') goPrev()
  else if (e.key === 'ArrowRight') goNext()
}
</script>

<template>
  <div class="card-stack">
    <div
      class="stage"
      tabindex="0"
      :style="{ '--card-width': `${CARD_WIDTH}px`, '--card-gap': `${CARD_GAP}px` }"
      @keydown="onKeydown"
    >
      <div
        v-if="recipes.length"
        class="track"
        :class="{ 'no-transition': dragging || noTrackTransition }"
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
            transform: `translateX(calc(-50% + ${slot.offset * SLOT}px)) scale(${slot.offset === 0 ? 1 : NEIGHBOR_SCALE})`,
            opacity: slot.offset === 0 ? 1 : NEIGHBOR_OPACITY,
            zIndex: 10 - Math.abs(slot.offset),
          }"
        >
          <FlipCard v-if="slot.offset === 0" :ref="setFlipCardRef" :recipe="slot.recipe" :side="side" />
          <RecipeCard v-else :recipe="slot.recipe" side="front" />

          <div v-if="slot.offset === 0" class="card-actions" :class="{ shown: actionsShown }">
            <button class="card-action-btn" aria-label="Upravit recept" @click.stop="onEdit">✎</button>
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

    <div v-if="recipes.length" class="stack-nav">
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

/* Capped width on every screen size — desktop looks like phone, with the
   neighbors' edges always peeking in at the sides. */
.stage {
  position: relative;
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  height: 528px;
  overflow: hidden;
  outline: none;
}

.track {
  position: relative;
  width: 100%;
  height: 100%;
  cursor: grab;
  touch-action: pan-y;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.track.no-transition {
  transition: none;
}

/* Each slot's own transform is static for the life of its DOM node — it's
   keyed by offset, not recipe id, so a given node's position never
   changes; only which recipe it displays does. Sliding is entirely the
   track's own transform animating, not the slots'. */
.card-slot {
  position: absolute;
  left: 50%;
  top: 0;
  width: var(--card-width);
  height: 502px;
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

.stack-count {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-dim);
  min-width: 52px;
  text-align: center;
}
</style>
