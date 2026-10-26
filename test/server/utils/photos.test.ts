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

describe('storeRecipePhoto input formats', () => {
  const solid = () => sharp({ create: { width: 40, height: 20, channels: 3, background: '#6f8f5c' } })

  it.each([
    ['png', () => solid().png().toBuffer()],
    ['webp', () => solid().webp().toBuffer()],
  ])('accepts %s', async (_, make) => {
    const file = await storeRecipePhoto(8, await make())
    await removePhotoFiles(file)
  })

  it('refuses an SVG, whatever it was uploaded as', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>')
    await expect(storeRecipePhoto(8, svg)).rejects.toThrow()
  })

  it('refuses other formats libvips could otherwise decode', async () => {
    await expect(storeRecipePhoto(8, await solid().gif().toBuffer())).rejects.toThrow()
    await expect(storeRecipePhoto(8, await solid().tiff().toBuffer())).rejects.toThrow()
  })
})

describe('removePhotoFiles', () => {
  it('ignores files that are already gone', async () => {
    await expect(removePhotoFiles('missing-1.webp')).resolves.toBeUndefined()
  })
})
