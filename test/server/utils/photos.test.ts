import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { photoPaths, photosDir, removePhotoFiles, storeRecipePhoto } from '../../../server/utils/photos'

describe('photoPaths', () => {
  it('resolves both variants inside the photos directory', () => {
    const paths = photoPaths('7-1700000000000.webp')
    expect(paths.full).toBe(`${photosDir}/7-1700000000000.webp`)
    expect(paths.thumb).toBe(`${photosDir}/7-1700000000000-thumb.webp`)
  })
})

describe('storeRecipePhoto', () => {
  it('writes a resized full image and a thumbnail as WebP', async () => {
    const source = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#b8502a' } })
      .jpeg()
      .toBuffer()

    const file = await storeRecipePhoto(7, source)
    const paths = photoPaths(file)

    expect(file).toMatch(/^7-\d+\.webp$/)
    expect((await sharp(paths.full).metadata()).width).toBe(1600)
    expect((await sharp(paths.thumb).metadata()).width).toBe(600)
    expect((await sharp(paths.full).metadata()).format).toBe('webp')

    await removePhotoFiles(file)
    expect(existsSync(paths.full)).toBe(false)
    expect(existsSync(paths.thumb)).toBe(false)
  })
})

describe('removePhotoFiles', () => {
  it('ignores files that are already gone', async () => {
    await expect(removePhotoFiles('missing-1.webp')).resolves.toBeUndefined()
  })
})
