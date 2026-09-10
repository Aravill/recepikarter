<script setup lang="ts">
import type { Recipe } from '#shared/types/recipe'

const props = defineProps<{ recipes: Recipe[] }>()

const { markExported } = useRecipes()

const TAP_THRESHOLD = 8
const SWIPE_THRESHOLD = 90
const FLY_OUT_DISTANCE = 600
const LONG_PRESS_MS = 450

const index = ref(0)
const flipped = ref(false)
const actionsShown = ref(false)
const dragX = ref(0)
const dragging = ref(false)
const exporting = ref(false)
const frontFaceRef = ref<{ $el: HTMLElement } | null>(null)
const backFaceRef = ref<{ $el: HTMLElement } | null>(null)

let startX = 0
let pointerId: number | null = null
let movedPastTapThreshold = false
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressFired = false

const current = computed(() => props.recipes[index.value])
const canGoPrev = computed(() => index.value > 0)
const canGoNext = computed(() => index.value < props.recipes.length - 1)

const backgroundLayers = computed(() =>
  [2, 1]
    .map((depth) => ({ depth, recipe: props.recipes[index.value + depth] }))
    .filter((layer): layer is { depth: number; recipe: Recipe } => !!layer.recipe)
    .reverse(),
)

watch(
  () => props.recipes,
  () => {
    index.value = 0
    flipped.value = false
    actionsShown.value = false
  },
)

watch(index, () => {
  flipped.value = false
  actionsShown.value = false
})

async function onExportPng() {
  const frontEl = frontFaceRef.value?.$el
  const backEl = backFaceRef.value?.$el
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

function onEdit() {
  if (current.value) navigateTo(`/recipes/${current.value.id}`)
}

function clearLongPressTimer() {
  if (longPressTimer !== null) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.card-action-btn')) return
  dragging.value = true
  movedPastTapThreshold = false
  longPressFired = false
  startX = e.clientX
  pointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

  // Holding still (not dragging) for LONG_PRESS_MS reveals the edit/download
  // buttons instead of flipping the card.
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    if (!movedPastTapThreshold) {
      longPressFired = true
      actionsShown.value = true
    }
  }, LONG_PRESS_MS)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  if (longPressFired) return
  dragX.value = e.clientX - startX
  if (Math.abs(dragX.value) > TAP_THRESHOLD) {
    movedPastTapThreshold = true
    clearLongPressTimer()
  }
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

  const dx = dragX.value

  if (!movedPastTapThreshold) {
    dragX.value = 0
    // A tap while the actions are showing dismisses them and reverts to the
    // standard interactions, rather than also flipping the card.
    if (actionsShown.value) actionsShown.value = false
    else flipped.value = !flipped.value
    return
  }

  actionsShown.value = false
  const wantsNext = dx < 0
  const canGo = wantsNext ? canGoNext.value : canGoPrev.value

  if (Math.abs(dx) > SWIPE_THRESHOLD && canGo) {
    dragX.value = wantsNext ? -FLY_OUT_DISTANCE : FLY_OUT_DISTANCE
    setTimeout(() => {
      index.value += wantsNext ? 1 : -1
      dragX.value = 0
    }, 220)
  } else {
    dragX.value = 0
  }
}

function goPrev() {
  if (canGoPrev.value) index.value -= 1
}
function goNext() {
  if (canGoNext.value) index.value += 1
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') goPrev()
  else if (e.key === 'ArrowRight') goNext()
}
</script>

<template>
  <div class="card-stack">
    <div class="stage" tabindex="0" @keydown="onKeydown">
      <div
        v-for="layer in backgroundLayers"
        :key="layer.recipe.id"
        class="stack-card"
        :style="{
          transform: `translateX(-50%) translateY(${layer.depth * 12}px) scale(${1 - layer.depth * 0.05})`,
          zIndex: 10 - layer.depth,
          opacity: layer.depth === 2 ? 0.55 : 0.85,
        }"
      >
        <RecipeCard :recipe="layer.recipe" side="front" />
      </div>

      <div
        v-if="current"
        :key="current.id"
        class="stack-card is-top"
        :class="{ dragging }"
        :style="{ transform: `translateX(calc(-50% + ${dragX}px)) rotate(${dragX / 18}deg)`, zIndex: 10 }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="flip-inner" :class="{ flipped }">
          <RecipeCard ref="frontFaceRef" class="face face-front" :recipe="current" side="front" />
          <RecipeCard ref="backFaceRef" class="face face-back" :recipe="current" side="back" />
        </div>
        <div class="card-actions" :class="{ shown: actionsShown }">
          <button class="card-action-btn" aria-label="Upravit recept" @click.stop="onEdit">✎</button>
          <button
            class="card-action-btn"
            aria-label="Stáhnout PNG"
            :disabled="exporting"
            @click.stop="onExportPng"
          >
            ⬇
          </button>
        </div>
      </div>
    </div>

    <div v-if="recipes.length" class="stack-nav">
      <button type="button" :disabled="!canGoPrev" aria-label="Předchozí recept" @click="goPrev">‹</button>
      <span class="stack-count">{{ index + 1 }} / {{ recipes.length }}</span>
      <button type="button" :disabled="!canGoNext" aria-label="Další recept" @click="goNext">›</button>
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

.stage {
  position: relative;
  width: 100%;
  height: 528px;
  outline: none;
}

.stack-card {
  position: absolute;
  left: 50%;
  top: 0;
  width: 240px;
  height: 502px;
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

.stack-card:not(.is-top) {
  pointer-events: none;
  /* Anchor scaling at the bottom so a smaller, lower card actually peeks
     out below the top card instead of shrinking toward the same center
     point and canceling the translateY offset out. */
  transform-origin: bottom center;
}

.stack-card.is-top {
  cursor: grab;
  touch-action: pan-y;
  perspective: 1400px;
}

.stack-card.is-top.dragging {
  transition: none;
  cursor: grabbing;
}

.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-inner.flipped {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
}

.face-back {
  transform: rotateY(180deg);
}

/* Hidden by default on every input type — holding the card (not dragging)
   reveals them; tapping the card flips it instead of opening the buttons,
   and tapping anywhere while they're shown dismisses them again. */
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

.stack-nav button:disabled {
  opacity: 0.4;
  cursor: default;
}

.stack-count {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-dim);
  min-width: 52px;
  text-align: center;
}
</style>
