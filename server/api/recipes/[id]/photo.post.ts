export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))

  // Multipart bodies are buffered in memory, so refuse oversized uploads
  // before reading rather than after.
  const declared = Number(getRequestHeader(event, 'content-length') || 0)
  if (declared > PHOTO_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Fotka je příliš velká (max. 15 MB).' })
  }

  const parts = await readMultipartFormData(event)
  const part = parts?.find((p) => p.name === 'photo')
  if (!part || !part.data.length) {
    throw createError({ statusCode: 400, statusMessage: 'Chybí soubor s fotkou.' })
  }
  if (!(PHOTO_MIME_TYPES as readonly string[]).includes(part.type ?? '')) {
    throw createError({ statusCode: 415, statusMessage: 'Podporované formáty jsou JPEG, PNG a WebP.' })
  }

  const existing = getRecipe(id)
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }

  const file = await storeRecipePhoto(id, part.data)
  const recipe = setRecipePhoto(id, file)
  if (!recipe) {
    // Recipe vanished between the read and the update — don't leave the
    // freshly written files orphaned.
    await removePhotoFiles(file)
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }
  if (existing.photoFile) await removePhotoFiles(existing.photoFile)
  return recipe
})
