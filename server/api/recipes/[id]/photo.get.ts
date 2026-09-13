import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const recipe = getRecipe(id)
  if (!recipe?.photoFile) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  // The path comes from the stored filename only, never from the request.
  const paths = photoPaths(recipe.photoFile)
  const path = getQuery(event).size === 'thumb' ? paths.thumb : paths.full
  const info = await stat(path).catch(() => null)
  if (!info) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }

  // Every upload gets a new filename (and so a new `v` in the URL), so the
  // response for one URL never changes — safe to cache for good.
  setResponseHeaders(event, {
    'Content-Type': 'image/webp',
    'Content-Length': String(info.size),
    'Cache-Control': 'private, max-age=31536000, immutable',
  })
  return sendStream(event, createReadStream(path))
})
