<script setup lang="ts">
import type { Recipe, RecipeInput } from '#shared/types/recipe'

const props = defineProps<{
  recipe: Recipe | RecipeInput
  side: 'front' | 'back'
}>()

// The flip is modeled as one phase instead of `flipped` + `flipping`
// booleans. The two rest phases never rely on `rotateY(180deg)` +
// `backface-visibility` to present the right face — that combination is
// only reliable while the 3D rendering context (perspective +
// preserve-3d) is still active. Once flattened back to a plain 2D box (to
// avoid leaving the card permanently GPU-composited, see 861bf62), a
// spec-following browser evaluates each face's `backface-visibility`
// *without* the parent's rotation — Chrome happens to render the
// flattened result identically either way, but Firefox for Android
// doesn't: it shows the front face, mirrored. So `rest-back` instead
// zeroes `.flip-inner`'s own transform and swaps the faces' own transforms
// directly (back face flattened to `none`, front face `visibility:
// hidden`) — a plain, unambiguous 2D picture that needs no 3D context and
// no backface-visibility trick at rest.
type Phase = 'rest-front' | 'to-back' | 'rest-back' | 'to-front'

const phase = ref<Phase>(props.side === 'back' ? 'rest-back' : 'rest-front')
// Whether `.flip-inner` currently sits at rotateY(180deg). Only true while
// actually mid-animation (or in the single frame right before one starts,
// see `snapFlipInner`) — both rest phases sit at `transform: none`.
const rotated = ref(false)
// The 3D rendering context (perspective on `.flip-card`, preserve-3d on
// `.flip-inner`). On only while animating; off at rest, for the same
// GPU-layer-sharpness reason `flipping` existed before this extraction.
const has3d = ref(false)
// Suppresses `.flip-inner`'s transition for exactly one frame, for the
// instant, non-animated snaps between a rest phase and the matching
// starting point of an animation (see `snapFlipInner` / `hardResetTo`).
const noTransition = ref(false)

// Only true at rest-back: forces the faces into their "resting on the
// back" picture directly, without depending on the parent's rotation or
// on backface-visibility.
const atRestBack = computed(() => phase.value === 'rest-back')

const frontFaceRef = ref<{ $el: HTMLElement } | null>(null)
const backFaceRef = ref<{ $el: HTMLElement } | null>(null)
const frontEl = computed(() => frontFaceRef.value?.$el ?? null)
const backEl = computed(() => backFaceRef.value?.$el ?? null)

defineExpose({ frontEl, backEl })

let generation = 0

function releaseNoTransitionNextFrame() {
  // Two rAFs: the same "let the browser actually paint the current state
  // before the next change" trick as the 3D-context deferral below — one
  // frame to apply `transition: none`, a second to be sure it was
  // observed, before letting transitions apply again.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      noTransition.value = false
    })
  })
}

function snapFlipInner(nextRotated: boolean, nextHas3d: boolean) {
  noTransition.value = true
  rotated.value = nextRotated
  has3d.value = nextHas3d
  releaseNoTransitionNextFrame()
}

function waitTwoFrames(gen: number, cb: () => void) {
  // Firefox for Android needs the 3D rendering context (perspective +
  // preserve-3d) painted at least one frame before the rotation starts, or
  // backface-visibility fails to hide the trailing face. Two rAFs
  // guarantee that paint has happened. Guarded by the generation counter
  // so a stale deferred call from an interrupted flip can't fire late.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (gen === generation) cb()
    })
  })
}

function startToBack() {
  const gen = ++generation
  phase.value = 'to-back'
  has3d.value = true
  waitTwoFrames(gen, () => {
    rotated.value = true
  })
}

function startToFront() {
  const gen = ++generation
  phase.value = 'to-front'
  // Restore the resting-on-the-back look via the 3D/backface-visibility
  // mechanism (rather than rest-back's flattened one) so there's an actual
  // 180deg starting point to animate down from.
  snapFlipInner(true, true)
  waitTwoFrames(gen, () => {
    rotated.value = false
  })
}

// Used when the recipe itself changes (not a user-driven flip) — snaps
// straight to the resting phase matching `side`, no animation.
function hardResetTo(side: 'front' | 'back') {
  generation++
  noTransition.value = true
  phase.value = side === 'back' ? 'rest-back' : 'rest-front'
  rotated.value = false
  has3d.value = false
  releaseNoTransitionNextFrame()
}

function recipeKey(recipe: Recipe | RecipeInput): unknown {
  return 'id' in recipe ? recipe.id : recipe
}

// A single multi-source watcher (rather than two separate ones) so a
// simultaneous side + recipe change — e.g. CardStack resetting `side` to
// 'front' in the same tick the center card's recipe swaps underneath —
// is read atomically: the old/new tuples let us tell "the recipe changed
// under an unrelated side reset" (snap, no animation) apart from "the
// user flipped the same card" (animate), without a race between two
// independently-scheduled watcher callbacks.
watch(
  () => [props.side, recipeKey(props.recipe)] as const,
  ([newSide], [oldSide, oldKey]) => {
    const newKey = recipeKey(props.recipe)
    if (newKey !== oldKey) {
      hardResetTo(newSide)
    } else if (newSide !== oldSide) {
      if (newSide === 'back') startToBack()
      else startToFront()
    }
    // Neither changed (e.g. the recipe's own fields were edited in place)
    // — nothing to animate.
  },
)

function onFlipInnerTransitionEnd(e: TransitionEvent) {
  if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
  if (phase.value === 'to-back') {
    phase.value = 'rest-back'
    // Snap from the 3D/rotated representation to the flattened one — see
    // the type comment above for why rest-back never keeps `rotated` true.
    noTransition.value = true
    rotated.value = false
    has3d.value = false
    releaseNoTransitionNextFrame()
  } else if (phase.value === 'to-front') {
    phase.value = 'rest-front'
    has3d.value = false
  }
}
</script>

<template>
  <div class="flip-card" :class="{ 'has-3d': has3d }">
    <div class="flip-inner" :class="{ rotated, 'has-3d': has3d, 'no-transition': noTransition }" @transitionend="onFlipInnerTransitionEnd">
      <RecipeCard ref="frontFaceRef" class="face face-front" :class="{ 'force-hidden': atRestBack }" :recipe="recipe" side="front" />
      <RecipeCard ref="backFaceRef" class="face face-back" :class="{ 'force-flat': atRestBack }" :recipe="recipe" side="back" />
    </div>
  </div>
</template>

<style scoped>
.flip-card {
  position: relative;
  width: 240px;
  height: 502px;
}

/* perspective only while actually animating — kept off at rest so the
   card renders in the same flat, non-3D-composited context as the rest of
   the UI, the reason 861bf62 introduced `flipping` in the first place. */
.flip-card.has-3d {
  perspective: 1400px;
}

.flip-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.flip-inner.no-transition {
  transition: none;
}

/* transform-style: preserve-3d is what lets the front/back faces combine
   correctly with the parent's rotation into an actual 3D turn — needed
   only while animating. */
.flip-inner.has-3d {
  transform-style: preserve-3d;
}

.flip-inner.rotated {
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

/* rest-back's flattened picture: the back face presented directly instead
   of via backface-visibility, the front face hidden outright instead of
   relying on facing-away detection. See the Phase comment above. */
.face-back.force-flat {
  transform: none;
}

.face-front.force-hidden {
  visibility: hidden;
}
</style>
