/**
 * gen_icons.mjs — ANKxIOUS PWA icon generator
 *
 * Renders the space-themed "A" logomark SVG at all required PNG sizes.
 * Uses the `sharp` npm package (already a common dev dep; install if needed).
 *
 * Usage:
 *   npm install sharp --save-dev    (one-time)
 *   node scripts/gen_icons.mjs
 *
 * Output: public/icons/icon-{size}.png for all required PWA sizes.
 *
 * The source SVG is public/icons/icon.svg — edit that to change the design.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

async function main() {
  let sharp
  try {
    sharp = (await import('sharp')).default
  } catch {
    console.error(
      'sharp is not installed. Run: npm install sharp --save-dev\n' +
      'Then re-run: node scripts/gen_icons.mjs'
    )
    process.exit(1)
  }

  const svgPath = join(ROOT, 'public', 'icons', 'icon.svg')
  const svgBuf  = readFileSync(svgPath)

  for (const size of SIZES) {
    const outPath = join(ROOT, 'public', 'icons', `icon-${size}.png`)
    await sharp(svgBuf)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`✓  icon-${size}.png`)
  }

  console.log('\nAll icons generated successfully.')
  console.log('Commit the new PNGs in public/icons/ to version control.')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
