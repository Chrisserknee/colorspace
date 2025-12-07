// Generate PNG favicons from SVG using sharp
// Run with: node scripts/generate-favicons.mjs

import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');

const svgBuffer = readFileSync(join(publicDir, 'favicon.svg'));

const sizes = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
];

async function generateIcons() {
  console.log('🎨 Generating favicon PNGs from SVG...\n');
  
  for (const { name, size } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(publicDir, name));
    
    console.log(`✅ Generated ${name} (${size}x${size})`);
  }
  
  console.log('\n🎉 All icons generated successfully!');
}

generateIcons().catch(console.error);

