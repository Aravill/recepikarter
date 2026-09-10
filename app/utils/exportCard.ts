function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'recept'
}

// Renders both faces of a recipe card into one PNG, front and back side by
// side — the way they'd be laid out for printing and cutting out, and the
// natural "save one image per recipe" shape for a two-sided card. Both
// elements must already be in the DOM (front/back are rendered
// simultaneously via the flip-card CSS technique, not swapped in and out),
// so there's no state to toggle and no visible flicker during export.
export async function exportCardPng(frontEl: HTMLElement, backEl: HTMLElement, recipeName: string): Promise<void> {
  // Loaded on demand: html-to-image touches the DOM/canvas, so it must
  // never be evaluated during SSR.
  const { toCanvas } = await import('html-to-image')
  // skipFonts: the fonts are Google Fonts loaded cross-origin, so
  // html-to-image can't read their stylesheet to embed them (a CORS
  // restriction on CSSOM access) — it logs a caught error and continues
  // regardless. Skipping the embed attempt avoids that noise; the canvas
  // still rasterizes with the already-loaded fonts correctly either way.
  const opts = { pixelRatio: 3, cacheBust: true, skipFonts: true }
  const frontCanvas = await toCanvas(frontEl, opts)
  // The back face carries its own `transform: rotateY(180deg)` — the
  // flip-card trick that makes it read right-way-round once the shared
  // parent also rotates 180deg on screen. Captured on its own, outside that
  // parent rotation, the raw transform bakes into the raster as a flipped
  // image instead. Override it to `none` for the capture only.
  const backCanvas = await toCanvas(backEl, { ...opts, style: { transform: 'none' } })

  const gap = 72 // px at the 3x pixelRatio above, i.e. a 24 CSS px gap
  const combined = document.createElement('canvas')
  combined.width = frontCanvas.width + backCanvas.width + gap
  combined.height = Math.max(frontCanvas.height, backCanvas.height)
  const ctx = combined.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')
  ctx.drawImage(frontCanvas, 0, 0)
  ctx.drawImage(backCanvas, frontCanvas.width + gap, 0)

  const link = document.createElement('a')
  link.href = combined.toDataURL('image/png')
  link.download = `${slugify(recipeName)}.png`
  link.click()
}
