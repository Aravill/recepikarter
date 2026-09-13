import { mkdirSync } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

// Recipe photos live next to the SQLite file so the one Docker volume
// (`/app/data`) carries both. RECIPE_PHOTOS_DIR overrides it, like
// RECIPE_DB_PATH does for the database.
export const photosDir = process.env.RECIPE_PHOTOS_DIR || join(process.cwd(), 'data', 'photos')

// Two sizes per upload: the detail page's strip and the gallery's tile. Both
// re-encoded, so whatever a phone hands over comes out as a small, EXIF-free
// (and therefore correctly rotated) WebP.
const FULL_MAX_PX = 1600
const THUMB_MAX_PX = 600

// The prebuilt sharp binaries don't decode HEIC (patented HEVC), so iPhone
// originals are out — in practice iOS converts to JPEG for `accept="image/*"`
// file inputs, which is what the form uses.
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024

// Files are stored by basename only; the id + timestamp makes each upload a
// new name, so a replaced photo never collides with browser caches of the
// old one (see shared/utils/recipe-photo.ts).
export function photoPaths(file: string): { full: string; thumb: string } {
  return {
    full: join(photosDir, file),
    thumb: join(photosDir, file.replace(/\.webp$/, '-thumb.webp')),
  }
}

export async function storeRecipePhoto(recipeId: number, source: Buffer): Promise<string> {
  const file = `${recipeId}-${Date.now()}.webp`
  const paths = photoPaths(file)
  // `rotate()` with no argument applies the EXIF orientation before the
  // metadata is dropped in the re-encode.
  const image = sharp(source).rotate()
  const [full, thumb] = await Promise.all([
    image.clone().resize(FULL_MAX_PX, FULL_MAX_PX, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer(),
    image.clone().resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
  ])
  mkdirSync(photosDir, { recursive: true })
  await Promise.all([writeFile(paths.full, full), writeFile(paths.thumb, thumb)])
  return file
}

export async function removePhotoFiles(file: string): Promise<void> {
  const paths = photoPaths(file)
  await Promise.all([paths.full, paths.thumb].map((p) => unlink(p).catch(ignoreMissing)))
}

function ignoreMissing(err: NodeJS.ErrnoException): void {
  if (err.code !== 'ENOENT') throw err
}
