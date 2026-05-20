/**
 * gen-icons.mjs — BX-6: Regenerate PWA PNG icons from public/icons/icon.svg
 *
 * Run once from the project root:
 *   node scripts/gen-icons.mjs
 *
 * Requires: sharp (listed as devDependency in package.json)
 *   npm install  (will pick it up from package.json)
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

const svgPath = join(projectRoot, 'public', 'icons', 'icon.svg')
const svg = readFileSync(svgPath)

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

console.log('Regenerating ANKxIOUS PWA icons from icon.svg...\n')

for (const size of sizes) {
  const outPath = join(projectRoot, 'public', 'icons', `icon-${size}.png`)
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outPath)
  console.log(`  ✓ icon-${size}.png (${size}×${size})`)
}

console.log('\nAll icons generated. Commit public/icons/ to update your PWA.')
