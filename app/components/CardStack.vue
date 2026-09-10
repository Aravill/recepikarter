<script setup lang="ts">
import type { Recipe } from '#shared/types/recipe'

const props = defineProps<{ recipes: Recipe[] }>()

const TAP_THRESHOLD = 8
const SWIPE_THRESHOLD = 90
const FLY_OUT_DISTANCE = 600

const index = ref(0)
const flipped = ref(false)
const dragX = ref(0)
const dragging = ref(false)

let startX = 0
let pointerId: number | null = null
let movedPastTapThreshold = false

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
  },
)

watch(index, () => {
  flipped.value = false
})

function toggleFlip() {
  flipped.value = !flipped.value
}

function onPointerDown(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('.flip-btn')) return
  dragging.value = true
  movedPastTapThreshold = false
  startX = e.clientX
  pointerId = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  dragX.value = e.clientX - startX
  if (Math.abs(dragX.value) > TAP_THRESHOLD) movedPastTapThreshold = true
}

function onPointerUp(e: PointerEvent) {
  if (!dragging.value || e.pointerId !== pointerId) return
  dragging.value = false
  pointerId = null
  const dx = dragX.value

  if (!movedPastTapThreshold) {
    dragX.value = 0
    if (current.value) navigateTo(`/recipes/${current.value.id}`)
    return
  }

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
          <RecipeCard class="face face-front" :recipe="current" side="front" />
          <RecipeCard class="face face-back" :recipe="current" side="back" />
        </div>
        <button class="flip-btn" aria-label="Otočit kartu" @click.stop="toggleFlip">⟳</button>
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

.flip-btn {
  position: absolute;
  top: 10px;
  right: 10px;
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
  z-index: 1;
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
