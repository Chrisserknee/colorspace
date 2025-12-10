import sharp from "sharp";
import fs from "fs";
import path from "path";

/**
 * Create watermarked version of image with LumePet logo
 * Used for preview images before purchase
 */
export async function createWatermarkedImage(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  // Load LumePet logo from public folder
  const logoPath = path.join(process.cwd(), "public", "samples", "LumePet2.png");
  
  let logoBuffer: Buffer;
  try {
    logoBuffer = fs.readFileSync(logoPath);
  } catch (error) {
    console.error("Failed to load logo, using text watermark:", error);
    // Fallback to text watermark if logo not found
    const watermarkSvg = `
      <svg width="${width}" height="${height}">
        <defs>
          <pattern id="watermark" width="400" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <text x="0" y="100" 
                  font-family="Georgia, serif" 
                  font-size="28" 
                  font-weight="bold"
                  fill="rgba(255,255,255,0.5)"
                  text-anchor="start">
              LUMEPET – PREVIEW ONLY
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#watermark)"/>
      </svg>
    `;
    return await sharp(inputBuffer)
      .composite([
        {
          input: Buffer.from(watermarkSvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  // Get logo dimensions
  const logoImage = sharp(logoBuffer);
  const logoMetadata = await logoImage.metadata();
  const logoWidth = logoMetadata.width || 200;
  const logoHeight = logoMetadata.height || 200;
  
  // Watermarks - about 18% of image size for denser coverage
  const watermarkSize = Math.max(width, height) * 0.18;
  const watermarkAspectRatio = logoWidth / logoHeight;
  const watermarkWidth = watermarkSize;
  const watermarkHeight = watermarkSize / watermarkAspectRatio;

  // Convert logo to base64 for SVG embedding
  const logoBase64 = logoBuffer.toString("base64");
  const logoMimeType = logoMetadata.format === "png" ? "image/png" : "image/jpeg";

  // Create dense grid of watermarks covering entire image
  // 5 rows with alternating 3 and 4 watermarks for full coverage
  const watermarkImages: string[] = [];
  const opacity = "0.45"; // Brighter opacity
  
  // Row 1 (top): 3 watermarks
  watermarkImages.push(`
      <image x="${Math.round(width * 0.15 - watermarkWidth / 2)}" y="${Math.round(height * 0.12 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.50 - watermarkWidth / 2)}" y="${Math.round(height * 0.12 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.85 - watermarkWidth / 2)}" y="${Math.round(height * 0.12 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 2: 4 watermarks offset
  watermarkImages.push(`
      <image x="${Math.round(width * 0.05 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.35 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.65 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.95 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 3 (middle): 3 watermarks
  watermarkImages.push(`
      <image x="${Math.round(width * 0.20 - watermarkWidth / 2)}" y="${Math.round(height * 0.55 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.50 - watermarkWidth / 2)}" y="${Math.round(height * 0.55 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.80 - watermarkWidth / 2)}" y="${Math.round(height * 0.55 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 4: 4 watermarks offset
  watermarkImages.push(`
      <image x="${Math.round(width * 0.05 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.35 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.65 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.95 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 5 (bottom): 3 watermarks
  watermarkImages.push(`
      <image x="${Math.round(width * 0.15 - watermarkWidth / 2)}" y="${Math.round(height * 0.92 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.50 - watermarkWidth / 2)}" y="${Math.round(height * 0.92 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.85 - watermarkWidth / 2)}" y="${Math.round(height * 0.92 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);

  // Create SVG with dense watermark coverage
  // Watermarks are WHITE with high visibility
  const watermarkSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- White filter to make logo appear white -->
        <filter id="whiteBright" x="-50%" y="-50%" width="200%" height="200%">
          <feColorMatrix type="matrix" values="
            0 0 0 0 1
            0 0 0 0 1
            0 0 0 0 1
            0 0 0 1 0"/>
        </filter>
      </defs>
      
      <!-- 17 watermarks with dense coverage -->
      ${watermarkImages.join('')}
    </svg>
  `;

  return await sharp(inputBuffer)
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        top: 0,
        left: 0,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
}

