import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "@/lib/config";
import { uploadImage, saveMetadata, incrementPortraitCount } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { validateImageMagicBytes } from "@/lib/validation";

// Analyze image to detect if pet is black/dark-colored
async function analyzeImageDarkness(imageBuffer: Buffer): Promise<{ isDark: boolean; averageBrightness: number }> {
  try {
    // Resize to smaller size for faster analysis
    const resized = await sharp(imageBuffer)
      .resize(200, 200, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer();
    
    // Calculate average brightness (0-255, where 0 is black, 255 is white)
    let totalBrightness = 0;
    for (let i = 0; i < resized.length; i++) {
      totalBrightness += resized[i];
    }
    const averageBrightness = totalBrightness / resized.length;
    
    // Consider dark if average brightness is below 80 (out of 255)
    // This threshold catches black/dark brown pets but not medium-colored ones
    const isDark = averageBrightness < 80;
    
    console.log(`🔍 Image darkness analysis: average brightness = ${averageBrightness.toFixed(1)}/255, isDark = ${isDark}`);
    
    return { isDark, averageBrightness };
  } catch (error) {
    console.warn("Failed to analyze image darkness:", error);
    return { isDark: false, averageBrightness: 128 }; // Default to medium brightness
  }
}

// Rainbow Bridge memorial quotes - randomly selected for each portrait
const RAINBOW_BRIDGE_QUOTES = [
  "Where there is love, there is never truly goodbye.",
  "Your pawprints may fade from the earth, but they shine forever at the Rainbow Bridge.",
  "Until we meet again at the Bridge, run free, sweet soul.",
  "The Rainbow Bridge is not the end—just a place where love waits.",
  "Every pet who crosses the Bridge carries a piece of our heart with them.",
  "What we shared cannot be lost; it just waits for us in the light.",
  "They walk beside us for a while, but stay in our hearts forever.",
  "Some angels have wings. Some have fur and wait for us at the Bridge.",
  "The hardest part of having a pet is saying goodbye. The most beautiful part is knowing love continues at the Bridge.",
  "One day, the love you shared will guide you back to each other at the Rainbow Bridge.",
];

// Add text overlay to rainbow bridge portrait (pet name and quote)
// Uses SVG compositing for serverless compatibility (sharp's text input requires libvips fonts)
async function addRainbowBridgeTextOverlay(
  imageBuffer: Buffer,
  petName: string
): Promise<{ buffer: Buffer; quote: string }> {
  console.log("🌈 Adding Rainbow Bridge text overlay for:", petName);
  console.log("   Input buffer size:", imageBuffer.length, "bytes");
  
  // Get random quote
  const quote = RAINBOW_BRIDGE_QUOTES[Math.floor(Math.random() * RAINBOW_BRIDGE_QUOTES.length)];
  console.log("   Selected quote:", quote);
  
  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  console.log(`   Image dimensions: ${width}x${height}`);
  
  try {
    const padding = Math.floor(width * 0.04);
    const nameFontSize = Math.floor(width * 0.055);
    const quoteFontSize = Math.floor(width * 0.024);
    
    // Word wrap the quote
    const maxQuoteWidth = width - padding * 8;
    const approxCharsPerLine = Math.floor(maxQuoteWidth / (quoteFontSize * 0.5));
    const words = quote.split(' ');
    const quoteLines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > approxCharsPerLine && currentLine) {
        quoteLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) quoteLines.push(currentLine);
    
    // Calculate text positioning
    const lineHeight = quoteFontSize * 1.4;
    const totalQuoteHeight = quoteLines.length * lineHeight;
    const nameY = height - padding - nameFontSize;
    const quoteStartY = nameY - padding - totalQuoteHeight;
    
    // Gradient height to cover text area
    const gradientHeight = Math.floor(height * 0.28);
    
    // Escape special XML characters
    const escapeXml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    // Create SVG with gradient, quote, and name
    // Use generic 'serif' font family for serverless compatibility (specific fonts like Georgia aren't available)
    const quoteLinesXml = quoteLines.map((line, i) => 
      `<text x="${width / 2}" y="${quoteStartY + i * lineHeight}" 
        font-family="DejaVu Serif, Liberation Serif, serif" 
        font-size="${quoteFontSize}" 
        font-style="italic"
        fill="rgba(255, 255, 255, 0.95)" 
        text-anchor="middle"
        filter="url(#shadow)">"${escapeXml(line)}"</text>`
    ).join('\n');
    
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fadeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
            <stop offset="40%" style="stop-color:rgb(0,0,0);stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#D4AF37" />
            <stop offset="50%" style="stop-color:#F5E6A3" />
            <stop offset="100%" style="stop-color:#D4AF37" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.8)"/>
          </filter>
        </defs>
        
        <!-- Dark gradient at bottom for text readability -->
        <rect x="0" y="${height - gradientHeight}" width="${width}" height="${gradientHeight}" fill="url(#fadeGradient)"/>
        
        <!-- Quote text -->
        ${quoteLinesXml}
        
        <!-- Pet name in gold -->
        <text x="${width / 2}" y="${nameY}" 
          font-family="DejaVu Serif, Liberation Serif, serif" 
          font-size="${nameFontSize}" 
          font-weight="bold"
          fill="url(#goldGradient)" 
          text-anchor="middle"
          filter="url(#shadow)">${escapeXml(petName.toUpperCase())}</text>
      </svg>
    `;
    
    console.log("   Created SVG overlay, compositing...");
    
    // Composite SVG onto image
    const result = await sharp(imageBuffer)
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      }])
      .png({ quality: 100, compressionLevel: 6 })
      .toBuffer();
    
    console.log("   Result buffer size:", result.length, "bytes");
    console.log("✅ Rainbow Bridge text overlay added successfully (SVG method)");
    return { buffer: result, quote };
  } catch (textError) {
    console.error("❌ Text rendering failed:", textError);
    console.error("   Error details:", textError instanceof Error ? textError.message : String(textError));
    
    // Final fallback: return image without text overlay
    console.log("   Returning image without text overlay");
    return { buffer: imageBuffer, quote };
  }
}


// Generate image using FLUX model via Replicate for better pet identity preservation
async function generateWithFlux(
  imageBase64: string,
  prompt: string
): Promise<Buffer> {
  console.log("=== FLUX IMAGE-TO-IMAGE GENERATION ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const imageDataUrl = imageBase64.startsWith("data:") 
    ? imageBase64 
    : `data:image/jpeg;base64,${imageBase64}`;

  // Get prompt strength from environment variable (default: 0.15 = 85% original preserved)
  // Lower values = more faithful to original image
  // Recommended range: 0.10 - 0.25
  const promptStrength = parseFloat(process.env.FLUX_PROMPT_STRENGTH || "0.15");
  
  // Lower guidance scale for subtle style application (default: 2.5)
  const guidanceScale = parseFloat(process.env.FLUX_GUIDANCE_SCALE || "2.5");

  console.log("FLUX parameters:");
  console.log("- Prompt strength:", promptStrength, `(${Math.round((1 - promptStrength) * 100)}% original preserved)`);
  console.log("- Guidance scale:", guidanceScale);
  console.log("- Prompt length:", prompt.length);
  
  try {
    // Use FLUX 1.1 Pro for best quality img2img
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro",
      {
        input: {
          prompt: prompt,
          image: imageDataUrl,
          prompt_strength: promptStrength, // 0.15 = 85% original image preserved
          num_inference_steps: 28,
          guidance_scale: guidanceScale, // Lower = more subtle style application
          output_format: "png",
          output_quality: 95,
          safety_tolerance: 5, // More permissive for pet images
          aspect_ratio: "1:1",
        }
      }
    );

    console.log("FLUX generation complete, output type:", typeof output);
    
    // FLUX returns a URL or array of URLs
    let imageUrl: string;
    if (Array.isArray(output)) {
      imageUrl = output[0] as string;
    } else if (typeof output === "string") {
      imageUrl = output;
    } else {
      throw new Error("Unexpected FLUX output format");
    }
    
    console.log("Downloading generated image from:", imageUrl.substring(0, 50) + "...");
    
    // Download the generated image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download FLUX image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("✅ FLUX generation successful, buffer size:", buffer.length);
    
    return buffer;
  } catch (error) {
    console.error("FLUX generation error:", error);
    throw error;
  }
}

// Generate image using OpenAI img2img (images.edit) for primary generation
// This uses OpenAI's image editing API to transform the pet photo into a late 18th-century aristocratic portrait
async function generateWithOpenAIImg2Img(
  imageBuffer: Buffer,
  prompt: string,
  openai: OpenAI
): Promise<Buffer> {
  console.log("=== OPENAI IMAGE-TO-IMAGE GENERATION ===");
  
  try {
    // Convert buffer to File for OpenAI API
    const uint8Array = new Uint8Array(imageBuffer);
    const imageBlob = new Blob([uint8Array], { type: "image/png" });
    const imageFile = new File([imageBlob], "pet-photo.png", { type: "image/png" });
    
    console.log("OpenAI img2img parameters:");
    console.log("- Model: gpt-image-1");
    console.log("- Prompt length:", prompt.length);
    console.log("- Image size:", imageBuffer.length, "bytes");
    
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No image generated from OpenAI img2img");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
      console.log("✅ OpenAI img2img generation successful (base64), buffer size:", buffer.length);
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download OpenAI img2img image: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
      console.log("✅ OpenAI img2img generation successful (URL), buffer size:", buffer.length);
    } else {
      throw new Error("No image data in OpenAI img2img response");
    }
    
    return buffer;
  } catch (error) {
    console.error("OpenAI img2img generation error:", error);
    throw error;
  }
}

// Generate image using IP-Adapter for maximum pet identity preservation
// IP-Adapter uses the reference image to preserve subject identity while applying style
async function generateWithIPAdapter(
  referenceImageBase64: string,
  prompt: string
): Promise<Buffer> {
  console.log("=== IP-ADAPTER IDENTITY-PRESERVING GENERATION ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const imageDataUrl = referenceImageBase64.startsWith("data:") 
    ? referenceImageBase64 
    : `data:image/jpeg;base64,${referenceImageBase64}`;

  // IP-Adapter scale controls how much the reference image influences the result
  // Higher values (0.7-0.9) = stronger identity preservation
  const ipAdapterScale = parseFloat(process.env.IP_ADAPTER_SCALE || "0.8");
  
  console.log("IP-Adapter parameters:");
  console.log("- IP Adapter Scale:", ipAdapterScale, "(higher = more faithful to reference)");
  console.log("- Prompt length:", prompt.length);
  
  try {
    // Use IP-Adapter SDXL for identity-preserving generation
    const output = await replicate.run(
      "lucataco/ip-adapter-sdxl:49b78367e7928e0ddfcc35a96854eb3c34c35e3d17a92d1ec30d69b88b97c9a1",
      {
        input: {
          prompt: prompt,
          image: imageDataUrl,
          scale: ipAdapterScale,
          negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated hands and fingers, disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, human face, human body, humanoid, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting",
          num_outputs: 1,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          scheduler: "K_EULER_ANCESTRAL",
        }
      }
    );

    console.log("IP-Adapter generation complete, output type:", typeof output);
    
    // IP-Adapter returns array of URLs
    let imageUrl: string;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0] as string;
    } else if (typeof output === "string") {
      imageUrl = output;
    } else {
      throw new Error("Unexpected IP-Adapter output format");
    }
    
    console.log("Downloading generated image from:", imageUrl.substring(0, 50) + "...");
    
    // Download the generated image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download IP-Adapter image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("✅ IP-Adapter generation successful, buffer size:", buffer.length);
    
    return buffer;
  } catch (error) {
    console.error("IP-Adapter generation error:", error);
    throw error;
  }
}

// Apply style transfer using SDXL img2img with very low denoising
// This preserves 90%+ of the pet's identity - only changes surface texture/style
async function applyStyleTransfer(
  contentImageBase64: string
): Promise<Buffer> {
  console.log("=== STYLE TRANSFER (SDXL low-denoise) ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const contentImageUrl = contentImageBase64.startsWith("data:") 
    ? contentImageBase64 
    : `data:image/jpeg;base64,${contentImageBase64}`;

  // Style strength controls how much artistic style is applied
  // 0.12 = 88% original preserved (good for identity + subtle texture)
  // Lower values = more photo-like, higher = more painterly
  const styleStrength = parseFloat(process.env.STYLE_TRANSFER_STRENGTH || "0.12");
  
  console.log("Style Transfer parameters:");
  console.log("- Denoise strength:", styleStrength, `(${Math.round((1 - styleStrength) * 100)}% original preserved)`);
  console.log("- Method: SDXL img2img with oil painting prompt");
  
  try {
    // Use SDXL img2img with very low denoising - essentially style transfer
    // This preserves the pet's structure while adding painterly texture
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: contentImageUrl,
          prompt: "AUTHENTIC 300-year-old HEAVILY AGED ANTIQUE oil painting portrait, late 18th-century European aristocratic masterpiece (1770-1830), EXTREMELY ROUGH WEATHERED TEXTURE like ancient artifact, PROMINENT CRAQUELURE visible crack network throughout like cracked earth, AGED VARNISH PATINA with subtle aging, THICK SCULPTURAL IMPASTO with worn peaks, COARSE CANVAS WEAVE clearly visible throughout, WEATHERED WORN EDGES paint thinned at corners and perimeter, SIGNIFICANT SURFACE WEAR rubbed areas, DRY BRUSH SCRATCHES, BROKEN JAGGED EDGES, FOXING age spots discoloration, PET IN NATURAL RELAXED comfortable pose, VIBRANT COLORS with GOOD CONTRAST, VARIED BACKGROUND COLOR randomly chosen from charcoal black or pure white or silver grey or powder blue or navy or teal or soft pink or dusty rose or emerald or sage or lavender or cream NOT BROWN, LOOSE FLOWING BRUSHWORK long sweeping strokes, Gainsborough LOOSE FEATHERY brushwork Reynolds glazes Vigée Le Brun elegance, DISCOVERED IN FORGOTTEN CASTLE after 300 years, LUSTROUS fabrics GLEAMING gold SPARKLING gems, ancient museum artifact quality",
          negative_prompt: "photograph, photo, photorealistic, modern, digital art, cartoon, anime, CGI, 3D render, blurry, low quality, watermark, gloomy, flat lighting, muted colors, dull colors, grey colors, muddy colors, brown background, dark brown background, tan background, beige background, sepia background, amber background, golden-brown, earth tones, muddy brown, brown tones, brownish, all brown, monotone brown, smooth gradients, airbrushed, plastic looking, too perfect, too smooth, too clean, too new, freshly painted, pristine, crisp clean edges, restored, cleaned, clinical, sharp edges everywhere, flat background, flat colors, no texture, no brushstrokes, no cracks, no aging, no patina, overly refined, digitally perfect, stiff pose, rigid posture, medieval, Renaissance, matte fabrics, human clothing, human-like pose, anthropomorphic, standing upright, bipedal, close-up, cropped, washed out, faded, low contrast",
          prompt_strength: styleStrength,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          scheduler: "K_EULER",
          refine: "no_refiner",
          high_noise_frac: 0.8,
          num_outputs: 1,
        }
      }
    );

    console.log("Style transfer complete, output type:", typeof output);
    
    // SDXL returns array of FileOutput objects (ReadableStream with url() method)
    let buffer: Buffer;
    
    if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      console.log("First output type:", typeof firstOutput);
      console.log("First output constructor:", firstOutput?.constructor?.name);
      
      if (typeof firstOutput === "string") {
        // Direct URL string
        console.log("Downloading from URL string:", firstOutput.substring(0, 80));
        const response = await fetch(firstOutput);
        if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
        buffer = Buffer.from(await response.arrayBuffer());
      } else if (firstOutput && typeof firstOutput === "object") {
        // FileOutput object from Replicate SDK
        // FileOutput has: blob() method, url getter, toString() method
        const outputObj = firstOutput as Record<string, unknown>;
        
        console.log("FileOutput detected, using blob() method");
        
        // Use blob() method - this is the most reliable way to get the data
        if (typeof outputObj.blob === "function") {
          const blob = await (outputObj.blob as () => Promise<Blob>)();
          console.log("Got blob, size:", blob.size, "type:", blob.type);
          buffer = Buffer.from(await blob.arrayBuffer());
        }
        // Fallback: try toString() which should return the URL string
        else if (typeof outputObj.toString === "function") {
          const urlString = outputObj.toString();
          console.log("Using toString() URL:", urlString);
          const response = await fetch(urlString);
          if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
          buffer = Buffer.from(await response.arrayBuffer());
        }
        else {
          throw new Error(`Cannot extract image data from FileOutput`);
        }
      } else {
        throw new Error(`Unexpected output item type: ${typeof firstOutput}`);
      }
    } else if (typeof output === "string") {
      console.log("Downloading from direct URL string");
      const response = await fetch(output);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`Unexpected SDXL output format: ${typeof output}`);
    }
    
    console.log("✅ Style transfer successful, buffer size:", buffer.length);
    
    return buffer;
  } catch (error) {
    console.error("Style transfer error:", error);
    throw error;
  }
}

// Full Stable Diffusion generation using SDXL img2img
// This uses moderate denoising to create a beautiful late 18th-century aristocratic portrait
// while preserving the pet's key identity features from the reference image
async function generateWithStableDiffusion(
  contentImageBase64: string,
  petDescription: string,
  species: string,
  breed: string
): Promise<Buffer> {
  console.log("=== FULL STABLE DIFFUSION GENERATION (SDXL) ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const contentImageUrl = contentImageBase64.startsWith("data:") 
    ? contentImageBase64 
    : `data:image/jpeg;base64,${contentImageBase64}`;

  // Prompt strength for full SD generation
  // LOWERED to 0.25 to preserve MORE of the original pet's identity (75% preserved)
  // Higher = more creative but loses pet identity, lower = closer to original
  // For cats especially, we need lower values to preserve their unique features
  const basePromptStrength = parseFloat(process.env.SD_PROMPT_STRENGTH || "0.25");
  // Use even lower strength for cats (they have more distinctive features that need preserving)
  // Grey cats need extra low strength to prevent color shifts
  const promptStrength = species === "CAT" ? Math.min(basePromptStrength, 0.22) : basePromptStrength;
  const guidanceScale = parseFloat(process.env.SD_GUIDANCE_SCALE || "7.5");
  const numSteps = parseInt(process.env.SD_NUM_STEPS || "30");
  
  console.log("Stable Diffusion parameters:");
  console.log("- Base prompt strength:", basePromptStrength);
  console.log("- Adjusted prompt strength:", promptStrength, `(${Math.round((1 - promptStrength) * 100)}% original preserved)`);
  console.log("- Species adjustment:", species === "CAT" ? "YES - using lower strength for cat" : "NO");
  console.log("- Guidance scale:", guidanceScale);
  console.log("- Inference steps:", numSteps);
  console.log("- Species:", species);
  console.log("- Breed:", breed || "Unknown");

  // Extract key identifying features from pet description for the prompt
  const breedInfo = breed ? `${breed} ${species.toLowerCase()}` : species.toLowerCase();
  
  // Detect fur color from description for color preservation
  const descLower = petDescription.toLowerCase();
  const isGreyFur = descLower.includes("grey") || descLower.includes("gray") || descLower.includes("silver") || 
                   descLower.includes("russian blue") || descLower.includes("chartreux") || descLower.includes("slate") ||
                   descLower.includes("ash") || descLower.includes("smoky") || descLower.includes("blue-grey");
  const isBlackFur = descLower.includes("black") || descLower.includes("ebony") || descLower.includes("jet black");
  const isWhiteFur = descLower.includes("white") || descLower.includes("snow white");
  const isOrangeFur = descLower.includes("orange") || descLower.includes("ginger") || descLower.includes("tabby") || descLower.includes("marmalade");
  
  // Color-specific preservation instructions
  const colorPreservation = isGreyFur 
    ? `\n- GREY/GRAY FUR: This cat has GREY fur - preserve the COOL GREY color exactly. DO NOT turn white/cream/golden.`
    : isBlackFur 
    ? `\n- BLACK FUR: This pet has BLACK fur - preserve the DEEP BLACK color exactly. DO NOT lighten to grey/white.`
    : isWhiteFur
    ? `\n- WHITE FUR: This pet has WHITE fur - preserve the pure white color.`
    : isOrangeFur
    ? `\n- ORANGE/GINGER FUR: This pet has ORANGE fur - preserve the warm orange/ginger color exactly.`
    : "";

  // Create species-specific identity preservation instructions
  const identityInstructions = species === "CAT" 
    ? `CRITICAL - PRESERVE THIS EXACT CAT'S IDENTITY:
- Keep the EXACT face shape, head structure, and facial proportions from the reference
- Preserve the EXACT eye color, eye shape, and eye spacing - do NOT change these
- Keep ALL fur patterns, markings, and FUR COLOR in their EXACT form - DO NOT CHANGE THE FUR COLOR
- Preserve ear shape, size, and placement precisely
- Maintain the cat's unique nose shape and whisker pattern${colorPreservation}
- This must be INSTANTLY RECOGNIZABLE as the same cat from the photo`
    : `CRITICAL - PRESERVE THIS EXACT ${species}'S IDENTITY:
- Keep the EXACT face shape, head structure, and facial proportions from the reference
- Preserve the EXACT eye color, eye shape, and expression
- Keep ALL markings, patterns, and FUR COLOR in their EXACT form - DO NOT CHANGE THE FUR COLOR${colorPreservation}
- Maintain the unique characteristics that make this pet recognizable
- This must be INSTANTLY RECOGNIZABLE as the same ${species.toLowerCase()} from the photo`;

  // Create a detailed prompt that describes both the pet and the desired style
  const sdPrompt = `AUTHENTIC 300-year-old HEAVILY AGED ANTIQUE oil painting masterpiece portrait of a ${breedInfo}, in NATURAL RELAXED POSE on luxurious velvet cushion. Late 18th-century European aristocratic style (1770-1830) Georgian/Regency/Napoleonic era.

${identityInstructions}

SUBJECT - THIS SPECIFIC ${species.toUpperCase()}:
The ${species.toLowerCase()} has the exact features from the reference image - preserve the face structure, eye color, markings, and unique characteristics.

NATURAL RELAXED POSE (NOT stiff or rigid):
- Pet looks COMFORTABLE and AT EASE - relaxed body language, soft posture
- Can be: slightly reclined, settled down naturally, head tilted, gently curved, or peacefully resting
- Expression AUTHENTIC and genuine - not forced or artificial
- Front paws visible, positioned naturally (crossed, tucked, or resting)
- Overall feeling of a beloved pet captured in a quiet, comfortable moment

HEAVILY AGED ANTIQUE OIL PAINTING (PUSH AGING EFFECTS HARD):
- LOOSE FLOWING BRUSHWORK: Long sweeping strokes 6-12 inches, graceful curves following form
- EXTREMELY ROUGH WEATHERED TEXTURE: Surface looks ANCIENT, heavily TEXTURED like artifact
- PROMINENT CRAQUELURE: CLEARLY VISIBLE network of cracks throughout - like cracked dried earth
- AGED VARNISH with subtle patina - NOT brown, maintains original colors
- THICK SCULPTURAL IMPASTO with WORN PEAKS from centuries of handling
- VISIBLE BRISTLE MARKS showing brush movement direction
- FEATHERY EDGES: Soft trailing brush endings that fade naturally
- DRY BRUSH SCRATCHES: Heavy scratchy, textured strokes throughout
- COARSE CANVAS WEAVE clearly visible - aged linen texture prominent
- SIGNIFICANT SURFACE WEAR: Obvious weathering on raised impasto, rubbed areas
- WEATHERED SOFT EDGES: Paint worn at corners and perimeter, canvas peeking through

VIBRANT COLORFUL PALETTE (NOT BROWN):
- BRILLIANT JEWEL TONES - rich saturated colors maintained through aging
- LUSTROUS velvet cloak in RICH COLORS (burgundy, royal blue, emerald, crimson)
- GLEAMING gold embroidery, SPARKLING gems with INTERNAL FIRE
- Colors remain VIBRANT and SATURATED - not dulled to brown
- COLORFUL backgrounds: deep blue, rich green, soft pink, cream, burgundy - NEVER brown

COMPOSITION:
- Subject LOW and CENTRAL on ornate velvet throne cushion
- NATURAL body position - comfortable, relaxed, at ease
- Front paws visible, positioned naturally
- Cloak draped naturally with realistic fabric folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest SECURING THE CLOAK CLOSED - two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver finish, catches the light brilliantly
- Authentic, genuine expression

BACKGROUND - HIGHLY VARIED (Different Every Time):
- RANDOMIZE from: charcoal black, pure white, silver grey, powder blue, sky blue, navy, teal, soft pink, dusty rose, emerald, sage, mint, lavender, lilac, cream, ivory, peach, coral
- IMPORTANT: Choose a DIFFERENT background color each time - avoid repetition
- SFUMATO depth with color receding into atmospheric haze
- CREATE CONTRAST - background should make the pet POP
- STRICTLY FORBIDDEN: brown, tan, beige, sepia, amber, earth tones, muddy colors

DISCOVERED IN FORGOTTEN CASTLE:
- Looks like ANCIENT 300-year-old painting by Gainsborough, Reynolds, or Vigée Le Brun
- LOOSE FEATHERY BRUSHWORK - light, airy, flowing, alive with movement
- HEAVY CRAQUELURE, THICK PATINA, SIGNIFICANT SURFACE WEAR throughout
- Discovered in a castle attic after 300 years - NOT cleaned or restored
- EXTREMELY ROUGH WEATHERED AUTHENTIC TEXTURE - ancient artifact quality
- Worth millions - belongs in National Portrait Gallery`;

  // Species-specific negative prompts to prevent identity changes
  const colorChangeNegative = isGreyFur 
    ? "white fur, cream fur, golden fur, warm tones on fur, beige fur, light colored cat, white cat,"
    : isBlackFur
    ? "grey fur, white fur, light fur, faded black, charcoal instead of black,"
    : isWhiteFur
    ? "grey fur, cream fur, yellow fur, dirty white,"
    : "";
    
  const speciesNegative = species === "CAT" 
    ? `wrong cat, different cat, generic cat, cat breed change, wrong eye color, wrong fur color, wrong fur pattern, wrong markings, wrong face shape, dog features, canine features, ${colorChangeNegative}`
    : species === "DOG"
    ? `wrong dog, different dog, generic dog, dog breed change, wrong eye color, wrong fur color, wrong fur pattern, wrong markings, wrong face shape, cat features, feline features, ${colorChangeNegative}`
    : `wrong animal, different animal, generic pet, wrong features, ${colorChangeNegative}`;

  const negativePrompt = `${speciesNegative}
photograph, photo, photorealistic, modern, digital art, cartoon, anime, 3d render, CGI,
blurry, low quality, watermark, text, logo, 
human body, humanoid, anthropomorphic, bipedal, standing upright, human pose, standing on hind legs,
wrong species, different animal, changed identity, unrecognizable pet,
flat colors, flat lighting, no texture, smooth gradients, airbrushed, plastic looking, too smooth, too perfect,
too clean, too new, freshly painted, pristine, crisp edges, restored, cleaned,
stiff pose, rigid posture, unnatural position, forced expression,
no cracks, no aging, no patina, no weathering,
overly refined, digitally perfect, clinical, polished, slick,
dark, gloomy, moody, dark lighting, heavy shadows, dim, underexposed, dark atmosphere, somber,
brown background, dark brown background, tan background, beige background, sepia background, amber background, golden-brown background, earth tone background, muddy background, brown tones, brown colors, brownish, all brown, monotone brown, dark muddy colors, heavy red background, dark red background, all red, dominant red,
muted colors, dull colors, grey colors, muddy colors, washed out, faded, low saturation,
deformed, disfigured, bad anatomy, wrong proportions,
ugly, duplicate, extra limbs, missing limbs, close-up, cropped`;
  
  console.log("Generating with SDXL...");
  
  try {
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: contentImageUrl,
          prompt: sdPrompt,
          negative_prompt: negativePrompt,
          prompt_strength: promptStrength,
          num_inference_steps: numSteps,
          guidance_scale: guidanceScale,
          scheduler: "K_EULER_ANCESTRAL",
          refine: "expert_ensemble_refiner",
          high_noise_frac: 0.8,
          num_outputs: 1,
          width: 1024,
          height: 1024,
        }
      }
    );

    console.log("SDXL generation complete, output type:", typeof output);
    
    // Handle FileOutput from Replicate
    let buffer: Buffer;
    
    if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      console.log("First output type:", typeof firstOutput);
      
      if (typeof firstOutput === "string") {
        console.log("Downloading from URL string");
        const response = await fetch(firstOutput);
        if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
        buffer = Buffer.from(await response.arrayBuffer());
      } else if (firstOutput && typeof firstOutput === "object") {
        const outputObj = firstOutput as Record<string, unknown>;
        
        if (typeof outputObj.blob === "function") {
          const blob = await (outputObj.blob as () => Promise<Blob>)();
          console.log("Got blob, size:", blob.size);
          buffer = Buffer.from(await blob.arrayBuffer());
        } else if (typeof outputObj.toString === "function") {
          const urlString = outputObj.toString();
          const response = await fetch(urlString);
          if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
          buffer = Buffer.from(await response.arrayBuffer());
        } else {
          throw new Error("Cannot extract image data from FileOutput");
        }
      } else {
        throw new Error(`Unexpected output type: ${typeof firstOutput}`);
      }
    } else if (typeof output === "string") {
      const response = await fetch(output);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`Unexpected SDXL output format: ${typeof output}`);
    }
    
    console.log("✅ Stable Diffusion generation successful, buffer size:", buffer.length);
    
    return buffer;
  } catch (error) {
    console.error("Stable Diffusion generation error:", error);
    throw error;
  }
}

// ============================================
// COMPOSITE APPROACH FUNCTIONS
// ============================================

// Step 1: Segment pet from background using rembg
async function segmentPet(imageBase64: string): Promise<Buffer> {
  console.log("=== PET SEGMENTATION (rembg) ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const imageDataUrl = imageBase64.startsWith("data:") 
    ? imageBase64 
    : `data:image/jpeg;base64,${imageBase64}`;

  console.log("Removing background from pet image...");
  
  try {
    const output = await replicate.run(
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      {
        input: {
          image: imageDataUrl,
        }
      }
    );

    console.log("Segmentation complete, output type:", typeof output);
    
    // Handle FileOutput from Replicate
    let buffer: Buffer;
    if (typeof output === "string") {
      const response = await fetch(output);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (output && typeof output === "object") {
      const outputObj = output as Record<string, unknown>;
      if (typeof outputObj.blob === "function") {
        const blob = await (outputObj.blob as () => Promise<Blob>)();
        buffer = Buffer.from(await blob.arrayBuffer());
      } else {
        throw new Error("Cannot extract segmented image");
      }
    } else {
      throw new Error("Unexpected rembg output format");
    }
    
    console.log("✅ Pet segmented successfully, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Segmentation error:", error);
    throw error;
  }
}

// Step 2: Generate Victorian royal scene (background + elements, no pet)
async function generateRoyalScene(
  species: string,
  openai: OpenAI
): Promise<Buffer> {
  console.log("=== GENERATING ROYAL SCENE ===");
  
  const scenePrompt = `A luxurious Victorian royal portrait scene with bright vibrant jewel tones and ornate details, empty and ready for a pet to be placed.

SCENE ELEMENTS:
- LUSTROUS velvet cushion with VISIBLE PILE texture catching light, GLEAMING gold embroidery with METALLIC SHEEN, ornate gold tassels
- SUMPTUOUS velvet royal robe with RICH SATURATED color, BRILLIANT gold filigree trim that SHIMMERS, natural draping folds
- SPARKLING jewelry: pearls with IRIDESCENT overtones, gems with INTERNAL FIRE and light refraction
- Cream/ivory RUFFLED LACE COLLAR with delicate texture details, Elizabethan ruff style
- RICH SATURATED velvet curtain draped to one side creating atmospheric depth
- LUMINOUS COLORFUL background with SFUMATO gradient - NOT BROWN

BACKGROUND COLORS (VARIED - NOT DARK BROWN):
- Choose from: deep royal blue, rich burgundy, forest green, soft cream, warm peach, dusty rose, sage green, powder blue, lavender, champagne gold, ivory white, muted teal
- Background should be BRIGHT and AIRY, not dark or muddy
- NEVER use dark brown, muddy brown, or monotonous brown tones

VIVID SATURATED COLORS:
- BRILLIANT jewel-toned velvet cushion - colors that SING with vibrancy
- RICH SATURATED burgundy/crimson robe with LUSTROUS sheen
- GLEAMING gold embroidery with true METALLIC reflection quality
- DEEP SATURATED forest green or royal blue curtain accent
- LUMINOUS COLORFUL background - soft cream, dusty rose, powder blue, or sage green
- LUSTROUS cream/ivory lace with subtle warm undertones
- SPARKLING gems: vivid ruby, rich emerald, deep sapphire with BRILLIANT internal fire
- VELVETY deep blacks with subtle undertones - never flat or grey

AUTHENTIC OIL PAINTING LIGHTING - BRIGHT AND CHEERFUL:
- BRILLIANT BRIGHT warm golden key light making everything RADIATE
- LUMINOUS UPLIFTING atmosphere - fabrics seem to GLOW from within
- VIBRANT COLORFUL palette - NOT dark, NOT gloomy, NOT moody
- GLEAMING SPARKLING highlights on polished silver and jewelry
- SATURATED rich colors throughout - jewel tones POP with vibrancy

AUTHENTIC OIL PAINTING STYLE:
- THICK IMPASTO texture with RAISED PAINT on highlights
- VISIBLE BRISTLE MARKS in brushstrokes
- TRANSPARENT GLAZES creating depth in shadows
- CANVAS WEAVE visible through thin paint areas
- VARNISHED SATIN FINISH with rich lustrous sheen
- Museum masterpiece quality - looks genuinely antique

IMPORTANT: 
- Leave clear space in center for a pet to be composited
- No animals or people in the scene
- The cushion and robe should be arranged for a pet to appear seated/resting
- Must look like genuine late 18th-century masterpiece by Gainsborough, Reynolds, or Vigée Le Brun
- AUTHENTIC hand-painted texture with natural paint imperfections`;

  console.log("Generating scene with GPT-Image-1...");
  
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: scenePrompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No scene generated");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
    } else {
      throw new Error("No image data in response");
    }
    
    console.log("✅ Royal scene generated, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Scene generation error:", error);
    throw error;
  }
}

// Step 3: Composite segmented pet onto royal scene
async function compositePortrait(
  petBuffer: Buffer,
  sceneBuffer: Buffer
): Promise<Buffer> {
  console.log("=== COMPOSITING PORTRAIT ===");
  
  try {
    // Get dimensions of the scene
    const sceneMetadata = await sharp(sceneBuffer).metadata();
    const sceneWidth = sceneMetadata.width || 1024;
    const sceneHeight = sceneMetadata.height || 1024;
    
    // Resize pet to fit nicely on the scene (about 70% of scene height)
    const targetPetHeight = Math.round(sceneHeight * 0.70);
    const resizedPet = await sharp(petBuffer)
      .resize({ height: targetPetHeight, fit: "inside" })
      .toBuffer();
    
    // Get resized pet dimensions
    const petMetadata = await sharp(resizedPet).metadata();
    const petWidth = petMetadata.width || 500;
    const petHeight = petMetadata.height || 700;
    
    // Position pet in center-bottom of scene (on the cushion)
    const leftOffset = Math.round((sceneWidth - petWidth) / 2);
    const topOffset = Math.round(sceneHeight - petHeight - (sceneHeight * 0.08)); // Slightly above bottom
    
    console.log(`Compositing pet (${petWidth}x${petHeight}) onto scene (${sceneWidth}x${sceneHeight})`);
    console.log(`Position: left=${leftOffset}, top=${topOffset}`);
    
    // Composite the pet onto the scene
    const composited = await sharp(sceneBuffer)
      .composite([
        {
          input: resizedPet,
          left: leftOffset,
          top: topOffset,
          blend: "over",
        }
      ])
      .png()
      .toBuffer();
    
    console.log("✅ Portrait composited successfully, buffer size:", composited.length);
    return composited;
  } catch (error) {
    console.error("Compositing error:", error);
    throw error;
  }
}

// Step 4: Apply final harmonization pass to blend pet with scene
async function harmonizePortrait(
  compositedBuffer: Buffer,
  species: string,
  openai: OpenAI
): Promise<Buffer> {
  console.log("=== HARMONIZING PORTRAIT ===");
  
  try {
    // Convert buffer to File for OpenAI
    const uint8Array = new Uint8Array(compositedBuffer);
    const imageBlob = new Blob([uint8Array], { type: "image/png" });
    const imageFile = new File([imageBlob], "composited.png", { type: "image/png" });
    
    const harmonizePrompt = `Add ONLY a soft shadow beneath the ${species} and very slightly blend the hard edges where the ${species} meets the background. 

CRITICAL - DO NOT MODIFY THE ${species.toUpperCase()} AT ALL:
- Do NOT change the ${species}'s appearance in any way
- Do NOT add texture or painterly effects to the ${species}
- Do NOT alter the ${species}'s colors, fur, face, or body
- The ${species} must remain EXACTLY as it appears - completely unchanged

ONLY ALLOWED CHANGES:
- Add a soft, subtle drop shadow under the ${species}
- Slightly soften the hard edge where ${species} meets background (1-2 pixels only)
- That's it - nothing else

Keep the image bright and beautiful. Museum-quality finish.`;

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: harmonizePrompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No harmonized image");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
    } else {
      throw new Error("No image data in response");
    }
    
    console.log("✅ Portrait harmonized successfully, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Harmonization error:", error);
    throw error;
  }
}

// Main composite generation function
async function generateCompositePortrait(
  petImageBase64: string,
  species: string,
  openai: OpenAI
): Promise<Buffer> {
  console.log("=== COMPOSITE PORTRAIT GENERATION ===");
  console.log("Step 1/4: Segmenting pet from background...");
  
  // Step 1: Segment pet
  const segmentedPet = await segmentPet(petImageBase64);
  
  console.log("Step 2/4: Generating royal scene...");
  
  // Step 2: Generate royal scene
  const royalScene = await generateRoyalScene(species, openai);
  
  console.log("Step 3/4: Compositing pet onto scene...");
  
  // Step 3: Composite
  const composited = await compositePortrait(segmentedPet, royalScene);
  
  console.log("Step 4/4: Harmonizing final portrait...");
  
  // Step 4: Harmonize (optional - disabled by default to preserve pet appearance)
  // Set ENABLE_HARMONIZATION=true to enable edge blending
  const enableHarmonization = process.env.ENABLE_HARMONIZATION === "true";
  
  if (enableHarmonization) {
    const harmonized = await harmonizePortrait(composited, species, openai);
    console.log("✅ Composite portrait complete (with harmonization)");
    return harmonized;
  } else {
    console.log("✅ Composite portrait complete (no harmonization)");
    return composited;
  }
}

// Analyze facial structure and breed-specific characteristics for high-fidelity portrait generation
async function analyzeFacialStructure(
  openai: OpenAI,
  imageBase64: string,
  species: string,
  breed: string
): Promise<string> {
  console.log("=== FACIAL STRUCTURE ANALYSIS ===");
  
  const facialAnalysisResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert in animal anatomy and breed identification. Analyze this ${species}'s facial structure with EXTREME PRECISION for portrait generation.

BREED CONTEXT: ${breed || "Unknown breed - analyze visible characteristics"}

Provide a DETAILED facial structure analysis:

=== SKULL AND HEAD STRUCTURE ===
1. SKULL TYPE: Classify as:
   - Brachycephalic (flat-faced, shortened skull - e.g., Pugs, Persians, Bulldogs)
   - Mesocephalic (medium proportions - e.g., Labradors, most cats)
   - Dolichocephalic (long, narrow skull - e.g., Greyhounds, Collies, Siamese)

2. HEAD SHAPE: Describe the overall silhouette
   - Round, oval, square, wedge-shaped, or heart-shaped?
   - Width-to-length ratio estimate (e.g., "head is 80% as wide as it is long")

=== SNOUT/MUZZLE ANALYSIS ===
3. SNOUT LENGTH: Estimate as percentage of total head length
   - Very short (<15% of head), Short (15-25%), Medium (25-35%), Long (35-45%), Very long (>45%)
   
4. SNOUT WIDTH: Relative to head width
   - Narrow, medium, or wide? Estimate percentage.
   
5. SNOUT SHAPE: Profile view characteristics
   - Straight, slightly curved, strongly curved, flat/pushed in?
   - Nose tip position: upturned, straight, or downturned?

=== EYE ANALYSIS ===
6. EYE SHAPE: Round, almond, oval, or triangular?

7. EYE SIZE: Relative to face
   - Small (<8% of face width), Medium (8-12%), Large (12-18%), Very large (>18%)
   
8. EYE POSITION: 
   - Set high, medium, or low on face?
   - Wide-set, normal, or close-set? Estimate distance between eyes relative to eye width.
   - Forward-facing or more lateral?

9. EYE ANGLE: Horizontal, slightly upward slant, or downward slant?

=== EAR ANALYSIS ===
10. EAR SIZE: Relative to head
    - Small (<15% of head height), Medium (15-25%), Large (25-40%), Very large (>40%)

11. EAR SHAPE: Pointed, rounded, folded, rose, button, drop/pendant?

12. EAR SET: High on head, medium, or low? Wide apart or close together?

13. EAR CARRIAGE: Erect, semi-erect, folded, or drooping?

=== DISTINCTIVE FEATURES ===
14. UNIQUE STRUCTURAL FEATURES:
    - Any asymmetry in facial features?
    - Distinctive bone structure visible?
    - Unusual proportions compared to breed standard?

15. BREED-SPECIFIC MARKERS:
    - What features confirm this breed identification?
    - Any mixed-breed indicators?

=== NUMERIC SUMMARY ===
Provide these estimates:
- Snout-to-skull ratio: X%
- Eye spacing (in eye-widths apart): X
- Ear-to-head ratio: X%
- Face width-to-height ratio: X:1
- Forehead prominence: Low/Medium/High

Format your response as structured data that can be used to ensure the generated portrait matches this EXACT facial structure.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 2000, // Increased for enhanced detailed facial structure analysis
    temperature: 0.05, // Very low temperature for extremely consistent, precise analysis
  });
  
  const facialAnalysis = facialAnalysisResponse.choices[0]?.message?.content || "";
  console.log("Facial structure analysis length:", facialAnalysis.length);
  console.log("Facial analysis preview:", facialAnalysis.substring(0, 300));
  
  return facialAnalysis;
}

// Compare original pet photo with generated portrait and create refinement prompt
// Enhanced with identity-focused corrections for maximum recognizability
async function compareAndRefine(
  openai: OpenAI,
  originalImageBuffer: Buffer,
  generatedImageBuffer: Buffer,
  originalDescription: string,
  species: string
): Promise<string> {
  console.log("=== STAGE 2: Identity-Focused Comparison and Refinement ===");
  
  // Process both images for vision API
  const processedOriginal = await sharp(originalImageBuffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
  
  const processedGenerated = await sharp(generatedImageBuffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
  
  const originalBase64 = processedOriginal.toString("base64");
  const generatedBase64 = processedGenerated.toString("base64");
  
  // Use GPT-4o vision to compare both images with identity focus
  const comparisonResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert at pet identification comparing two images. Your goal is to ensure the generated portrait is INSTANTLY RECOGNIZABLE as the original pet.

IMAGE 1 (LEFT): The ORIGINAL pet photo - the TRUE reference.
IMAGE 2 (RIGHT): The GENERATED portrait - must be refined to match.

ORIGINAL DESCRIPTION: ${originalDescription}

=== IDENTITY VERIFICATION (MOST CRITICAL) ===
Ask yourself: "Would the pet's owner instantly recognize this as THEIR pet?"

Rate these identity factors (1-10 each):
1. FACIAL STRUCTURE MATCH: Does the skull shape, snout length, and overall head structure match?
2. EYE RECOGNITION: Are the eyes the right shape, size, spacing, color, and expression?
3. EAR ACCURACY: Do the ears match in shape, size, position, and carriage?
4. DISTINCTIVE FEATURES: Are ALL unique markings in their EXACT locations?
5. OVERALL "LOOK": Does the portrait capture this pet's unique personality/expression?

=== DETAILED COMPARISON ===

1. SKULL AND FACIAL STRUCTURE (Critical for recognition):
   - Is the skull type correct? (brachycephalic/flat vs mesocephalic/medium vs dolichocephalic/long)
   - Is the snout-to-head ratio accurate?
   - Does the forehead prominence match?
   - Is the jaw/chin shape correct?
   - List EVERY structural discrepancy

2. EYES (The window to recognition):
   - Eye SHAPE: Round, almond, oval - is it exact?
   - Eye SIZE relative to face - is it accurate?
   - Eye SPACING - are they the right distance apart?
   - Eye COLOR - is the exact shade matched?
   - Eye EXPRESSION - does it capture the pet's "look"?
   - Eye ANGLE - horizontal or slanted?

3. EARS (Major recognition factor):
   - Shape accuracy (pointed, rounded, folded, etc.)
   - Size relative to head
   - Position on head (high, medium, low)
   - Carriage (erect, semi-erect, drooping)
   - Any asymmetry preserved?

4. MARKINGS AND PATTERNS:
   - Is EVERY marking present?
   - Is each marking in the EXACT correct location?
   - Are marking shapes accurate?
   - Are marking colors correct?
   - List EVERY missing, misplaced, or incorrect marking

5. COAT AND COLORING:
   - Is the base color the exact right shade?
   - Are color transitions/gradients preserved?
   - Is the coat texture represented correctly?
   - Are any color areas wrong?

=== IDENTITY MATCH SCORE ===
Overall Identity Match: X/10
(8+ = Owner would recognize immediately)
(6-7 = Somewhat recognizable but issues)
(<6 = Would not be recognized as this specific pet)

=== PRIORITY CORRECTIONS FOR IDENTITY ===
List corrections in order of impact on recognizability:

CRITICAL (Must fix - affects instant recognition):
1. [Issue]: [Specific fix required]
2. [Issue]: [Specific fix required]

IMPORTANT (Should fix - improves accuracy):
3. [Issue]: [Specific fix required]
4. [Issue]: [Specific fix required]

MINOR (Nice to fix - fine details):
5. [Issue]: [Specific fix required]

=== REFINED GENERATION PROMPT ===
Write a corrected description that addresses ALL issues, emphasizing:
- Exact facial structure corrections needed
- Precise eye, ear, and marking corrections
- Any proportion adjustments required

The refined prompt should result in a portrait the owner would INSTANTLY recognize as their beloved pet.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${originalBase64}`,
              detail: "high",
            },
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${generatedBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 2000, // Increased for more detailed analysis
    temperature: 0.2, // Lower temperature for consistent, precise analysis
  });
  
  const refinementPrompt = comparisonResponse.choices[0]?.message?.content || "";
  console.log("Identity-focused refinement analysis complete");
  console.log("Refinement prompt length:", refinementPrompt.length);
  console.log("Refinement preview:", refinementPrompt.substring(0, 400));
  
  return refinementPrompt;
}

// Enhance image brightness and sharpness using sharp (fast, runs locally)
async function enhanceImage(inputBuffer: Buffer): Promise<Buffer> {
  console.log("=== ENHANCING IMAGE (brightness + sharpness) ===");
  console.log(`Input buffer size: ${inputBuffer.length} bytes`);
  
  try {
    // Get brightness multiplier from env (default 1.15 = 15% brighter)
    const brightnessFactor = parseFloat(process.env.ENHANCE_BRIGHTNESS || "1.15");
    // Get sharpness sigma from env (default 0.8 = subtle sharpening)
    const sharpnessSigma = parseFloat(process.env.ENHANCE_SHARPNESS || "0.8");
    
    console.log(`- Brightness factor: ${brightnessFactor} (${Math.round((brightnessFactor - 1) * 100)}% increase)`);
    console.log(`- Sharpness sigma: ${sharpnessSigma}`);
    
    const enhancedBuffer = await sharp(inputBuffer)
      // Increase brightness and slight saturation boost
      .modulate({
        brightness: brightnessFactor,
        saturation: 1.1,  // 10% saturation boost for more vibrant colors
      })
      // Apply subtle sharpening
      .sharpen({
        sigma: sharpnessSigma,
        m1: 1.0,  // Flat areas sharpening
        m2: 2.0,  // Edge sharpening (more aggressive on edges)
      })
      // Slight contrast boost
      .linear(1.05, -10)  // 5% contrast increase
      .png({ quality: 100 })
      .toBuffer();
    
    console.log(`✅ Enhancement complete. Output size: ${enhancedBuffer.length} bytes`);
    return enhancedBuffer;
  } catch (error) {
    console.error("Enhancement failed, returning original:", error);
    return inputBuffer;
  }
}

// Upscale image using Real-ESRGAN for higher resolution (optional, controlled by env var)
async function upscaleImage(inputBuffer: Buffer, scale: number = 2): Promise<Buffer> {
  console.log("=== UPSCALING IMAGE ===");
  console.log(`Input buffer size: ${inputBuffer.length} bytes`);
  console.log(`Target scale: ${scale}x`);
  
  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn("REPLICATE_API_TOKEN not set, skipping upscale");
    return inputBuffer;
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  // Get original dimensions
  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width || 1024;
  const originalHeight = metadata.height || 1024;
  console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);
  
  // Convert buffer to base64 data URL
  const base64Image = inputBuffer.toString("base64");
  const mimeType = metadata.format === "png" ? "image/png" : "image/jpeg";
  const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
  
  try {
    // Use Real-ESRGAN for high-quality upscaling
    // Model: nightmareai/real-esrgan - great for artistic images
    console.log("Running Real-ESRGAN upscaler...");
    const startTime = Date.now();
    
    const output = await replicate.run(
      "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
      {
        input: {
          image: imageDataUrl,
          scale: scale, // 2x or 4x
          face_enhance: false, // Not for faces, just general upscale
        }
      }
    );
    
    const elapsedTime = Date.now() - startTime;
    console.log(`Upscale completed in ${elapsedTime}ms`);
    
    // Handle output - could be string URL or FileOutput object
    let upscaledBuffer: Buffer;
    
    if (typeof output === "string") {
      // Direct URL string
      console.log("Downloading upscaled image from URL...");
      const response = await fetch(output);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      upscaledBuffer = Buffer.from(await response.arrayBuffer());
    } else if (output && typeof output === "object") {
      // FileOutput object from Replicate SDK
      const outputObj = output as { url?: () => string } | string;
      let downloadUrl: string;
      
      if (typeof outputObj === "string") {
        downloadUrl = outputObj;
      } else if ("url" in outputObj && typeof outputObj.url === "function") {
        downloadUrl = outputObj.url();
      } else {
        downloadUrl = String(output);
      }
      
      console.log("Downloading upscaled image...");
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      upscaledBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error("Unexpected output format from upscaler");
    }
    
    // Get new dimensions
    const newMetadata = await sharp(upscaledBuffer).metadata();
    console.log(`Upscaled dimensions: ${newMetadata.width}x${newMetadata.height}`);
    console.log(`Upscaled buffer size: ${upscaledBuffer.length} bytes`);
    console.log("✅ Upscale successful");
    
    return upscaledBuffer;
  } catch (error) {
    console.error("Upscale error:", error);
    console.warn("Falling back to original image");
    return inputBuffer; // Return original on failure
  }
}

// Create watermarked version of image with LumePet logo
async function createWatermarkedImage(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  // Load LumePet logo from public folder
  const fs = await import("fs");
  const path = await import("path");
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

  // Get logo dimensions and resize it to be more intrusive
  const logoImage = sharp(logoBuffer);
  const logoMetadata = await logoImage.metadata();
  const logoWidth = logoMetadata.width || 200;
  const logoHeight = logoMetadata.height || 200;
  
  // Watermarks - about 35% of image size
  const watermarkSize = Math.max(width, height) * 0.35;
  const watermarkAspectRatio = logoWidth / logoHeight;
  const watermarkWidth = watermarkSize;
  const watermarkHeight = watermarkSize / watermarkAspectRatio;

  // Convert logo to base64 for SVG embedding
  const logoBase64 = logoBuffer.toString("base64");
  const logoMimeType = logoMetadata.format === "png" ? "image/png" : "image/jpeg";

  // Create SVG with 5 watermarks - 4 corners + center
  // Watermarks are WHITE but with lower opacity to be less intrusive
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
      
      <!-- 5 watermarks - 4 corners + center -->
      
      <!-- Top-left corner (30% opacity - lighter) -->
      <image 
        x="${Math.round(width * 0.02)}" 
        y="${Math.round(height * 0.02)}" 
        width="${Math.round(watermarkWidth)}" 
        height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}"
        opacity="0.30"
        filter="url(#whiteBright)"
      />
      <!-- Top-right corner (30% opacity - lighter) -->
      <image 
        x="${Math.round(width * 0.98 - watermarkWidth)}" 
        y="${Math.round(height * 0.02)}" 
        width="${Math.round(watermarkWidth)}" 
        height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}"
        opacity="0.30"
        filter="url(#whiteBright)"
      />
      <!-- Bottom-left corner (30% opacity - lighter) -->
      <image 
        x="${Math.round(width * 0.02)}" 
        y="${Math.round(height * 0.98 - watermarkHeight)}" 
        width="${Math.round(watermarkWidth)}" 
        height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}"
        opacity="0.30"
        filter="url(#whiteBright)"
      />
      <!-- Bottom-right corner (30% opacity - lighter) -->
      <image 
        x="${Math.round(width * 0.98 - watermarkWidth)}" 
        y="${Math.round(height * 0.98 - watermarkHeight)}" 
        width="${Math.round(watermarkWidth)}" 
        height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}"
        opacity="0.30"
        filter="url(#whiteBright)"
      />
      <!-- Center watermark (30% opacity) -->
      <image 
        x="${Math.round((width - watermarkWidth) / 2)}" 
        y="${Math.round((height - watermarkHeight) / 2)}" 
        width="${Math.round(watermarkWidth)}" 
        height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}"
        opacity="0.30"
        filter="url(#whiteBright)"
      />
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

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "unknown";
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const clientIP = getClientIP(request);
  
  console.log("=== Generate API called ===");
  console.log("Client IP:", clientIP);
  console.log("User agent:", userAgent);
  console.log("Is mobile:", isMobile);
  
  // Rate limiting - prevent abuse
  const rateLimit = checkRateLimit(`generate:${clientIP}`, RATE_LIMITS.generate);
  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { 
        status: 429,
        headers: {
          "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString(),
          "X-RateLimit-Remaining": "0",
        }
      }
    );
  }
  
  try {
    // Check for API keys
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Check for Supabase config
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    console.log("Using OpenAI for vision (GPT-4o) and image generation (DALL-E 3)");

    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const gender = formData.get("gender") as string | null;
    const usePackCredit = formData.get("usePackCredit") === "true";
    const useSecretCredit = formData.get("useSecretCredit") === "true";
    const style = formData.get("style") as string | null; // "rainbow-bridge" for memorial portraits
    const petName = formData.get("petName") as string | null; // Pet's name for rainbow bridge portraits
    
    const isRainbowBridge = style === "rainbow-bridge";
    
    // Log Rainbow Bridge parameters
    if (style || petName) {
      console.log(`🌈 Form data - style: "${style}", petName: "${petName}", isRainbowBridge: ${isRainbowBridge}`);
    }

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!CONFIG.ACCEPTED_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    // Validate file size (Vercel has 4.5MB body limit)
    if (imageFile.size > CONFIG.MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB. Please compress your image or use a smaller file.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // SECURITY: Validate file is actually an image by checking magic bytes
    // This prevents uploading malicious files with fake MIME types
    const isValidImage = await validateImageMagicBytes(bytes);
    if (!isValidImage) {
      console.warn(`Invalid image magic bytes from IP: ${clientIP}`);
      return NextResponse.json(
        { error: "Invalid image file. Please upload a valid JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    // Generate unique ID for this generation
    const imageId = uuidv4();

    // Note: Original pet photo is now uploaded immediately when user selects it
    // via the /api/upload-pet endpoint (in GenerationFlow and RainbowBridgeFlow)

    // Process original image for vision API - improved preprocessing for better detail
    // Use higher resolution and preserve full image without cropping
    const processedImage = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64Image = processedImage.toString("base64");

    // Step 1: Use GPT-4o to analyze pet(s) - OPTIMIZED for speed while keeping critical identity info
    const visionStartTime = Date.now();
    
    // First, quickly detect how many pets are in the image
    console.log("🔍 Detecting number of pets in image...");
    const petCountResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "How many pets (dogs or cats) are clearly visible in this image? Respond with ONLY a number: 1 or 2. If more than 2, respond with 2. If none or unclear, respond with 1.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });
    
    const petCountStr = petCountResponse.choices[0]?.message?.content?.trim() || "1";
    const detectedPetCount = petCountStr === "2" ? 2 : 1;
    console.log(`🐾 Detected ${detectedPetCount} pet(s) in image`);
    
    // Track multi-pet info
    let petDescription1 = "";
    let petDescription2 = "";
    let species1 = "";
    let species2 = "";
    let multiPetCombinedDescription = "";
    const isMultiPet = detectedPetCount === 2;
    
    if (isMultiPet) {
      // MULTI-PET MODE: Analyze both pets in the single image
      console.log("🐾🐾 Analyzing BOTH pets in image with GPT-4o...");
      
      const multiPetVisionResponse = await openai.chat.completions.create({
        model: "gpt-4o",  // Use full model for multi-pet - need better understanding
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This image contains TWO pets. Analyze BOTH pets for a royal portrait.

For EACH pet, provide:
1. SPECIES: [CAT] or [DOG] 
2. BREED: Specific breed or "Mixed"
3. COLORS: Fur color, markings, patterns
4. FACE: Eye color, distinctive features
5. SIZE: Small/Medium/Large (relative)
6. UNIQUE: 2-3 distinctive features

Format your response EXACTLY like this:
---PET 1---
[SPECIES] BREED: [breed]. COLORS: [colors]. FACE: [features]. SIZE: [size]. UNIQUE: [features].
---PET 2---
[SPECIES] BREED: [breed]. COLORS: [colors]. FACE: [features]. SIZE: [size]. UNIQUE: [features].
---TOGETHER---
Brief description of how they look together (e.g., "A regal golden retriever beside a sleek black cat").`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 1200,
        temperature: 0.2,
      });
      
      const multiPetResponse = multiPetVisionResponse.choices[0]?.message?.content || "";
      console.log("Multi-pet vision response:", multiPetResponse.substring(0, 500));
      
      // Parse the multi-pet response
      const pet1Match = multiPetResponse.match(/---PET 1---\s*([\s\S]*?)(?=---PET 2---|$)/i);
      const pet2Match = multiPetResponse.match(/---PET 2---\s*([\s\S]*?)(?=---TOGETHER---|$)/i);
      const togetherMatch = multiPetResponse.match(/---TOGETHER---\s*([\s\S]*?)$/i);
      
      petDescription1 = pet1Match ? pet1Match[1].trim() : "a beloved pet";
      petDescription2 = pet2Match ? pet2Match[1].trim() : "a beloved pet";
      multiPetCombinedDescription = togetherMatch ? togetherMatch[1].trim() : "";
      
      // Extract species for each pet
      const species1Match = petDescription1.match(/\[(DOG|CAT)\]/i);
      const species2Match = petDescription2.match(/\[(DOG|CAT)\]/i);
      species1 = species1Match ? species1Match[1].toUpperCase() : 
                 petDescription1.toLowerCase().includes("dog") ? "DOG" : "CAT";
      species2 = species2Match ? species2Match[1].toUpperCase() : 
                 petDescription2.toLowerCase().includes("dog") ? "DOG" : "CAT";
      
      console.log(`🐾 Pet 1: ${species1} - ${petDescription1.substring(0, 100)}`);
      console.log(`🐾 Pet 2: ${species2} - ${petDescription2.substring(0, 100)}`);
      console.log(`🐾 Together: ${multiPetCombinedDescription}`);
      
      console.log(`Multi-pet vision analysis took ${Date.now() - visionStartTime}ms`);
    } else {
      // SINGLE PET MODE: Original flow
      console.log("Analyzing single pet with GPT-4o (optimized prompt)...");
    
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // Use mini for faster analysis - still accurate for pet identification
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this pet photo. Start with [CAT] or [DOG] or [RABBIT].

SPECIES: Look at snout size, facial structure, ears. Dogs have larger snouts. Cats have compact faces with whiskers.

Provide a CONCISE description:
1. SPECIES & BREED: [SPECIES] - Breed name or "Mixed" (confidence: HIGH/MEDIUM/LOW)
2. AGE: PUPPY/KITTEN or ADULT
3. COLORS: Be SPECIFIC - for dark pets say "black" or "grey" or "dark brown" explicitly. List base color, any markings with locations.
4. FACE: Eye color, eye shape, nose color, any distinctive facial features
5. EARS: Shape, size, position
6. UNIQUE FEATURES: 3-5 things that make THIS pet recognizable (asymmetries, markings, expression)
7. FUR: Length and texture (short/medium/long, smooth/fluffy)

Format: "[SPECIES] BREED: [breed]. AGE: [stage]. COLORS: [detailed colors and markings]. FACE: [eye/nose details]. EARS: [description]. UNIQUE: [distinctive features]. FUR: [texture]."`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",  // Use low detail for faster processing - sufficient for pet ID
              },
            },
          ],
        },
      ],
      max_tokens: 800,  // Reduced - we only need essential info
      temperature: 0.1,
    });
    
    console.log(`Vision analysis took ${Date.now() - visionStartTime}ms`);
    
    // For single pet mode, set the petDescription from visionResponse
    petDescription1 = visionResponse.choices[0]?.message?.content || "a beloved pet";
    }
    
    // Use petDescription1 for single pet mode (backwards compatible)
    let petDescription = isMultiPet ? petDescription1 : petDescription1;

    // Log vision analysis output for debugging
    console.log("=== VISION ANALYSIS OUTPUT ===");
    console.log("Raw description length:", petDescription.length);
    console.log("Raw description preview:", petDescription.substring(0, 200));
    
    // Validate description quality
    if (petDescription.length < 100) {
      console.warn("⚠️ Vision description is too short - may lack detail");
    }
    if (!petDescription.toLowerCase().includes("unique") && !petDescription.toLowerCase().includes("distinctive")) {
      console.warn("⚠️ Vision description may lack unique features");
    }

    // Sanitize description to remove problematic characters that might fail Supabase pattern validation
    // Keep most characters but remove emojis and problematic unicode
    petDescription = petDescription
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Remove misc symbols  
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Remove dingbats
      .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Keep printable ASCII + common unicode (but not control chars)
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();

    // Ensure we have a valid description (not empty after sanitization)
    if (!petDescription || petDescription.length < 10) {
      petDescription = "a beloved pet with distinctive features";
      console.warn("Pet description was too short after sanitization, using fallback");
    }

    // Log for debugging
    console.log("Pet description from vision (sanitized):", petDescription);
    console.log("Description length:", petDescription.length);
    console.log("Description quality check:", {
      hasUniqueFeatures: petDescription.toLowerCase().includes("unique") || petDescription.toLowerCase().includes("distinctive"),
      hasColorDetails: petDescription.toLowerCase().includes("color") || petDescription.toLowerCase().includes("marking"),
      hasFaceDetails: petDescription.toLowerCase().includes("face") || petDescription.toLowerCase().includes("eye"),
      length: petDescription.length,
    });

    // Extract species from the description (format: [DOG], [CAT], etc.)
    const speciesMatch = petDescription.match(/\[(DOG|CAT|RABBIT|BIRD|HAMSTER|GUINEA PIG|FERRET|HORSE|PET)\]/i);
    let species = speciesMatch ? speciesMatch[1].toUpperCase() : "";
    
    // Extract age/stage from the description
    const ageMatch = petDescription.match(/AGE:\s*(PUPPY|KITTEN|ADULT)/i);
    let ageStage = ageMatch ? ageMatch[1].toUpperCase() : "";
    
    // Fallback: search for age keywords if explicit format wasn't found
    if (!ageStage) {
      const lowerDesc = petDescription.toLowerCase();
      if (lowerDesc.includes("puppy") || lowerDesc.includes("young dog")) {
        ageStage = "PUPPY";
      } else if (lowerDesc.includes("kitten") || lowerDesc.includes("young cat")) {
        ageStage = "KITTEN";
      } else {
        ageStage = "ADULT"; // Default to adult if not specified
      }
    }
    
    // Fallback: search for species keywords if bracket format wasn't found
    if (!species) {
      const lowerDesc = petDescription.toLowerCase();
      if (lowerDesc.includes("dog") || lowerDesc.includes("puppy") || lowerDesc.includes("canine")) {
        species = "DOG";
      } else if (lowerDesc.includes("cat") || lowerDesc.includes("kitten") || lowerDesc.includes("feline")) {
        species = "CAT";
      } else if (lowerDesc.includes("rabbit") || lowerDesc.includes("bunny")) {
        species = "RABBIT";
      } else if (lowerDesc.includes("bird") || lowerDesc.includes("parrot") || lowerDesc.includes("parakeet")) {
        species = "BIRD";
      } else if (lowerDesc.includes("hamster") || lowerDesc.includes("guinea pig") || lowerDesc.includes("ferret")) {
        species = "SMALL PET";
      } else {
        species = "PET";
      }
    }
    
    // CRITICAL: Double-check species detection by analyzing the image description more carefully
    // Count explicit mentions of each species
    const lowerDesc = petDescription.toLowerCase();
    const dogMentions = (lowerDesc.match(/\bdog\b|\bpuppy\b|\bcanine\b/g) || []).length;
    const catMentions = (lowerDesc.match(/\bcat\b|\bkitten\b|\bfeline\b/g) || []).length;
    
    // If there's a clear mismatch, correct it
    if (dogMentions > catMentions && species === "CAT") {
      console.warn("⚠️ CORRECTING: Description has more dog mentions but species was CAT. Changing to DOG.");
      species = "DOG";
    } else if (catMentions > dogMentions && species === "DOG") {
      console.warn("⚠️ CORRECTING: Description has more cat mentions but species was DOG. Changing to CAT.");
      species = "CAT";
    }
    
    // ALWAYS validate species with a direct image check - this is critical for accuracy
    console.log("🔍 Performing mandatory species validation check...");
    try {
      const speciesValidationCheck = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Look at this image VERY CAREFULLY. Is this a DOG or a CAT?

CRITICAL - Examine these features:
- NOSE SIZE: Dogs have larger/wider noses (snouts). Cats have smaller, more compact noses.
- FACIAL STRUCTURE: Dogs have wider heads and canine facial proportions. Cats have more compact, triangular faces.
- EARS: Both can have pointed ears, but look at the overall facial structure.
- WHISKERS: Cats typically have more prominent whiskers.
- EYE SHAPE: Cats often have more almond-shaped eyes. Dogs have rounder eyes.

Key differences:
- DOG: Larger snout/muzzle, wider head, canine facial structure, dog-like proportions
- CAT: Smaller nose, compact face, triangular face shape, feline features, prominent whiskers

Respond with ONLY one word: DOG or CAT

Be VERY careful - misidentifying will cause major errors.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high", // Use high detail for better accuracy
                },
              },
            ],
          },
        ],
        max_tokens: 10,
        temperature: 0, // Use deterministic response
      });
      const validatedSpecies = speciesValidationCheck.choices[0]?.message?.content?.trim().toUpperCase();
      
      // CRITICAL: Always use validation result if it's clear
      if (validatedSpecies === "DOG" || validatedSpecies === "CAT") {
        // If validation differs from initial detection, ALWAYS use validation result
        if (validatedSpecies !== species) {
          console.warn(`⚠️ SPECIES MISMATCH: Initial detection was ${species}, but validation says ${validatedSpecies}. FORCING validated species.`);
          species = validatedSpecies;
        } else {
          console.log(`✅ Species validation confirmed: ${species}`);
        }
      } else if (!species || species === "PET") {
        // If we don't have a species yet, use validation result
        if (validatedSpecies === "DOG" || validatedSpecies === "CAT") {
          species = validatedSpecies;
          console.log(`✅ Species set via validation: ${species}`);
        }
      }
      
      // CRITICAL: If validation failed but we have a species, log warning but continue
      if (!validatedSpecies || (validatedSpecies !== "DOG" && validatedSpecies !== "CAT")) {
        console.warn(`⚠️ Species validation returned unclear result: "${validatedSpecies}". Using detected species: ${species}`);
      }
    } catch (validationError) {
      console.error("⚠️ Species validation check failed:", validationError);
      // If validation fails, we MUST have a species from initial detection
      if (!species || species === "PET") {
        throw new Error("CRITICAL: Unable to determine pet species. Please ensure the image clearly shows a cat or dog.");
      }
      console.warn(`⚠️ Continuing with detected species: ${species} (validation failed)`);
    }
    
    // CRITICAL: Final check - we MUST have a valid species
    if (!species || species === "PET") {
      throw new Error("CRITICAL: Unable to determine pet species. Please ensure the image clearly shows a cat or dog.");
    }
    
    // CRITICAL: Ensure species is either DOG or CAT (most common)
    if (species !== "DOG" && species !== "CAT") {
      console.warn(`⚠️ Unusual species detected: ${species}. Proceeding but may need special handling.`);
    }
    
    console.log("Detected age/stage:", ageStage);
    if (ageStage === "PUPPY" || ageStage === "KITTEN") {
      console.log(`✨ Age preservation enabled: Will preserve ${ageStage} features`);
    }
    
    // Create STRONGER negative species instruction with multiple repetitions
    const notSpecies = species === "DOG" 
      ? "CRITICAL: This is a DOG. DO NOT generate a cat, kitten, or any feline. This MUST be a DOG. Generate ONLY a DOG." 
      : species === "CAT" 
      ? "CRITICAL: This is a CAT. DO NOT generate a dog, puppy, or any canine. This MUST be a CAT. Generate ONLY a CAT."
      : `CRITICAL: This is a ${species}. DO NOT generate any other animal. Generate ONLY a ${species}.`;
    
    console.log("=== SPECIES DETECTION ===");
    console.log("Detected species:", species);
    console.log("Species enforcement:", notSpecies);
    console.log("Pet description analysis:", {
      containsDog: petDescription.toLowerCase().includes("dog") || petDescription.toLowerCase().includes("puppy"),
      containsCat: petDescription.toLowerCase().includes("cat") || petDescription.toLowerCase().includes("kitten"),
      dogMentions,
      catMentions,
      speciesMatch: speciesMatch ? speciesMatch[1] : "none",
    });
    
    // Verify species detection is correct
    if (species === "DOG" && (petDescription.toLowerCase().includes("cat") || petDescription.toLowerCase().includes("kitten"))) {
      console.warn("⚠️ WARNING: Species mismatch detected! Description mentions cat but species is DOG");
    }
    if (species === "CAT" && (petDescription.toLowerCase().includes("dog") || petDescription.toLowerCase().includes("puppy"))) {
      console.warn("⚠️ WARNING: Species mismatch detected! Description mentions dog but species is CAT");
    }

    // Extract breed from description for facial structure analysis
    const breedMatch = petDescription.match(/BREED:\s*([^.(\n]+)/i);
    const detectedBreed = breedMatch ? breedMatch[1].trim() : "";
    console.log("Detected breed:", detectedBreed || "Unknown");

    // Step 1.5: Perform detailed facial structure analysis (OPTIONAL - disabled by default for speed)
    // Enable with ENABLE_FACIAL_ANALYSIS=true if needed for complex breeds
    let facialStructureAnalysis = "";
    const enableFacialAnalysis = process.env.ENABLE_FACIAL_ANALYSIS === "true";
    
    if (enableFacialAnalysis) {
      console.log("🔬 Performing detailed facial structure analysis (enabled via env)...");
      try {
        facialStructureAnalysis = await analyzeFacialStructure(openai, base64Image, species, detectedBreed);
        console.log("✅ Facial structure analysis complete");
      } catch (facialError) {
        console.error("⚠️ Facial structure analysis failed, continuing without it:", facialError);
      }
    } else {
      console.log("⏭️ Skipping facial structure analysis (disabled for speed)");
    }

    // Randomize elements for unique paintings - SIGNIFICANTLY EXPANDED for maximum variety
    const cushions = [
      // Original elegant tones
      "ORNATE SOFT SAGE GREEN velvet throne cushion with RICH intricate gold embroidery patterns, BRIGHT decorative gold tassels at corners, detailed ornate gold threadwork, luxurious thick velvet texture, visible fabric folds, elaborate decorative details",
      "ORNATE SOFT PERIWINKLE BLUE velvet throne cushion with RICH intricate gold thread embroidery, BRIGHT decorative gold tassels, detailed ornate patterns, rich plush texture, elaborate ornate details",
      "ORNATE WARM TAUPE velvet throne cushion with RICH elegant gold embroidery patterns, BRIGHT gold tassels, detailed ornate gold threadwork, sumptuous velvety texture, elaborate classical styling",
      "ORNATE MUTED EMERALD GREEN velvet cushion with RICH gold braided trim, BRIGHT ornate gold tassels, detailed intricate patterns, thick luxurious fabric, elaborate visible texture",
      "ORNATE DUSTY BLUE velvet throne cushion with RICH antique gold embroidery, BRIGHT decorative gold tassels at corners, detailed ornate patterns, plush royal texture, elaborate details",
      "ORNATE SOFT GREY velvet cushion with RICH gold thread patterns, BRIGHT ornate gold tassels, detailed intricate embroidery, thick velvety surface, elaborate classical details",
      "ORNATE SAGE GREEN velvet throne cushion with RICH intricate gold embroidery, BRIGHT gold tassels, detailed ornate patterns, luxurious deep pile, elaborate ornate styling",
      "ORNATE SOFT SAPPHIRE velvet cushion with RICH antique gold decorative embroidery, BRIGHT gold tassels, detailed ornate patterns, rich thick velvet, elaborate sumptuous texture",
      // Rich jewel tones
      "ORNATE DEEP RUBY RED velvet throne cushion with RICH silver thread embroidery, BRIGHT silver tassels, intricate baroque patterns, plush luxurious texture, regal commanding presence",
      "ORNATE ROYAL PURPLE velvet throne cushion with RICH gold damask patterns, ornate gold fringe trim, sumptuous imperial purple, thick velvet pile, elaborate royal details",
      "ORNATE MIDNIGHT NAVY velvet cushion with RICH gold fleur-de-lis embroidery, BRIGHT gold tassels, deep nautical blue, luxurious texture, aristocratic elegance",
      "ORNATE BURNT SIENNA velvet throne cushion with RICH copper thread embroidery, warm autumn tones, copper tassels, earthy luxury, Renaissance-inspired details",
      // Soft pastels
      "ORNATE BLUSH PINK velvet throne cushion with DELICATE rose gold embroidery, soft feminine tones, rose gold tassels, romantic pastel luxury, refined texture",
      "ORNATE POWDER BLUE velvet cushion with RICH silver thread detailing, soft dreamy blue, silver tassels, ethereal texture, gentle aristocratic elegance",
      "ORNATE SOFT CORAL velvet throne cushion with GOLD sunset-inspired embroidery, warm peachy coral, gold tassels, tropical warmth, luxurious comfort",
      "ORNATE CHAMPAGNE IVORY velvet cushion with RICH gold thread patterns, soft cream tones, gold tassels, elegant neutrality, timeless sophistication",
      // Bold contrasts
      "ORNATE JET BLACK velvet throne cushion with RICH gold baroque embroidery, dramatic contrast, gold tassels, mysterious depth, commanding presence",
      "ORNATE HUNTER GREEN velvet cushion with RICH bronze thread patterns, deep forest tones, bronze tassels, natural elegance, woodland nobility",
      "ORNATE TEAL velvet throne cushion with RICH gold Art Nouveau embroidery, vibrant blue-green, gold tassels, artistic flair, distinctive luxury",
      "ORNATE PLUM velvet cushion with RICH silver damask patterns, deep purple-red, silver tassels, wine-dark luxury, opulent texture",
      // Unique textures
      "ORNATE DUSTY MAUVE brocade throne cushion with WOVEN gold thread patterns, textured damask weave, gold tassels, antique charm, heirloom quality",
      "ORNATE STEEL BLUE silk cushion with EMBROIDERED silver dragons and clouds, Eastern-inspired luxury, silver tassels, exotic elegance, worldly sophistication",
      "ORNATE TERRACOTTA velvet throne cushion with RICH gold Moorish geometric patterns, warm Mediterranean tones, gold tassels, architectural elegance",
      "ORNATE SEAFOAM GREEN velvet cushion with RICH pearl and shell embroidery, oceanic elegance, pearl tassels, maritime luxury, coastal nobility"
    ];
    
    const robes = [
      // Original elegant options
      "DAINTY SOFT SAPPHIRE BLUE velvet cloak with delicate gold thread embroidery patterns, soft plush velvety texture with visible nap, ermine-style PURE BRIGHT WHITE fur trim with black spots, draped delicately over body, dainty refined luxurious velvet fabric with realistic folds",
      "DAINTY DUSTY ROSE velvet cloak with intricate delicate gold thread patterns, soft plush velvety texture, PURE WHITE ermine fur trim, dainty refined fabric draped over body and cushion, visible velvety texture and soft folds",
      "DAINTY CREAM WHITE velvet cloak with delicate ornate gold embroidery, soft plush velvety texture with visible nap, ermine-style PURE BRIGHT WHITE fur trim with black spots, dainty sumptuous velvet fabric draped naturally",
      "DAINTY SOFT PERIWINKLE BLUE velvet cloak with delicate gold thread detailing, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty refined velvet fabric with dramatic draping, realistic soft folds",
      "DAINTY MUTED BURGUNDY velvet cloak with delicate antique gold thread patterns, soft plush velvety texture with visible nap, PURE WHITE ermine fur trim, dainty luxurious velvet fabric draped over body",
      "DAINTY IVORY CREAM velvet cloak with delicate elaborate gold embroidery, soft plush velvety texture, ermine-style PURE BRIGHT WHITE fur trim, dainty refined velvet fabric with natural draping and soft folds",
      "DAINTY SAGE GREEN velvet cloak with delicate gold thread embroidery, soft plush velvety texture with visible nap, PURE BRIGHT WHITE ermine fur trim with black spots, dainty sumptuous velvet fabric draped dramatically",
      "DAINTY DUSTY CORAL velvet cloak with delicate intricate gold patterns, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty luxurious velvet fabric with realistic soft draping",
      // Rich jewel tones
      "LUXURIOUS DEEP EMERALD GREEN velvet cloak with silver thread Celtic knot embroidery, soft plush texture, PURE WHITE Arctic fox fur trim, dramatic aristocratic draping with elegant folds",
      "REGAL ROYAL PURPLE velvet cloak with gold fleur-de-lis embroidery throughout, rich imperial texture, PURE WHITE ermine fur trim with black spots, majestic commanding presence",
      "OPULENT RUBY RED velvet cloak with intricate gold Baroque scrollwork, sumptuous texture, PURE BRIGHT WHITE ermine fur trim, passionate dramatic elegance with deep folds",
      "DISTINGUISHED MIDNIGHT NAVY velvet cloak with silver star and moon embroidery, deep celestial blue, PURE WHITE fur trim, mysterious nocturnal elegance",
      // Metallic and shimmer
      "SHIMMERING GOLD BROCADE cloak with woven metallic threads, rich texture catching light, PURE WHITE ermine fur trim, sunlit warmth and opulence, draped with natural folds",
      "LUSTROUS SILVER-GREY velvet cloak with platinum thread detailing, moonlit elegance, PURE BRIGHT WHITE fur trim, sophisticated neutrality with visible texture",
      "BRONZE-TOUCHED COPPER velvet cloak with gold autumn leaf embroidery, warm sunset tones, CREAM WHITE fur trim, earthy nobility with soft draping",
      // Pastels and soft tones
      "DELICATE MINT GREEN velvet cloak with silver botanical embroidery, fresh spring tones, PURE WHITE fur trim, garden party elegance with gentle folds",
      "SOFT LAVENDER velvet cloak with gold butterfly and flower embroidery, gentle purple hues, PURE BRIGHT WHITE ermine fur trim, romantic whimsy",
      "WARM APRICOT velvet cloak with copper thread sunrise patterns, soft peachy tones, CREAM WHITE fur trim, golden hour warmth",
      "PALE SEAFOAM velvet cloak with pearl and shell embroidery, oceanic softness, PURE WHITE fur trim, coastal aristocracy",
      // Bold and dramatic
      "DRAMATIC JET BLACK velvet cloak with gold constellation embroidery, mysterious depth, PURE BRIGHT WHITE ermine fur trim with black spots, striking contrast",
      "RICH CHOCOLATE BROWN velvet cloak with gold oak leaf patterns, warm espresso tones, CREAM WHITE fur trim, woodland sophistication",
      "DEEP TEAL velvet cloak with gold Art Deco geometric patterns, vibrant blue-green, PURE WHITE fur trim, artistic modernist elegance",
      "WINE PLUM velvet cloak with silver grape vine embroidery, deep burgundy-purple, PURE BRIGHT WHITE fur trim, vineyard nobility",
      // Exotic and unique
      "PEACOCK BLUE velvet cloak with iridescent feather-inspired embroidery, exotic shimmer, PURE WHITE fur trim, magnificent display",
      "BURNT ORANGE velvet cloak with gold phoenix embroidery, fiery sunset warmth, CREAM WHITE fur trim, bold renaissance spirit",
      "FOREST HUNTER GREEN velvet cloak with bronze oak and acorn patterns, deep woodland tones, CREAM fur trim, noble outdoorsman elegance",
      "ANTIQUE ROSE velvet cloak with vintage gold filigree patterns, aged romantic pink, PURE BRIGHT WHITE ermine fur trim, nostalgic charm"
    ];
    
    const jewelry = [
      // Original classic multi-gem options
      "dainty antique multi-chain gold necklace with multiple gem clusters (ruby, emerald, amethyst, topaz), gold filigree details, small pearls interspersed, NOT modern jewelry",
      "delicate antique gold necklace with gem clusters (ruby red, emerald green, amethyst purple), intricate gold filigree, tiny pearls, multiple fine chains, classical styling",
      "ornate antique gold multi-chain necklace with small gem clusters (topaz, ruby, emerald), delicate gold filigree work, tiny pearl accents, dainty and refined",
      "elegant antique gold necklace with multiple gem clusters (amethyst, ruby, topaz, emerald), gold filigree details, small pearls, layered fine chains, NOT simple beads",
      "dainty gold filigree necklace with gem clusters (ruby, emerald, amethyst), multiple delicate chains, tiny pearl accents, antique classical styling",
      "refined antique gold multi-chain necklace with small gem clusters (topaz yellow, ruby red, emerald green, amethyst purple), intricate filigree, tiny pearls",
      "delicate antique gold necklace with ornate gem clusters (ruby, amethyst, emerald, topaz), gold filigree work, small pearls, multiple fine chains, dainty and elegant",
      "ornate antique gold necklace with multiple gem clusters (emerald, ruby, topaz, amethyst), delicate gold filigree, tiny pearl accents, NOT modern, classical jewelry",
      // Single statement gems
      "magnificent antique gold pendant necklace with LARGE central SAPPHIRE surrounded by diamond accents, royal blue brilliance, fine gold chain, statement piece",
      "elegant antique gold necklace with LARGE teardrop EMERALD pendant, surrounded by tiny pearls, deep green brilliance, refined single-gem elegance",
      "stunning antique gold necklace with LARGE oval RUBY pendant framed in gold filigree, passionate red brilliance, classical dramatic beauty",
      "regal antique gold necklace with LARGE cushion-cut AMETHYST pendant, royal purple depth, surrounded by seed pearls, Victorian grandeur",
      // Pearl-focused
      "classic triple-strand PEARL necklace with gold clasp featuring small ruby accent, timeless elegance, creamy white lustrous pearls, understated luxury",
      "elegant graduated PEARL necklace with ornate gold and emerald clasp, single strand of increasing pearl sizes, classic sophistication",
      "baroque PEARL choker with gold Art Nouveau setting, irregular lustrous pearls, unique organic shapes, artistic refinement",
      "delicate antique gold necklace with large central PEARL surrounded by tiny sapphires, moonlit elegance, romantic styling",
      // Silver/platinum variations
      "delicate antique SILVER filigree necklace with MOONSTONE pendant, ethereal opalescent shimmer, mystical elegance, silvery chain",
      "elegant antique SILVER necklace with cluster of AQUAMARINES and diamonds, icy blue beauty, winter elegance, platinum styling",
      "refined SILVER choker with OPAL pendant showing rainbow fire, iridescent mystery, Art Nouveau inspired, unique character",
      // Unique gems and combinations
      "antique gold necklace with TURQUOISE and coral cabochons, Southwestern inspired elegance, warm earthy tones, distinctive styling",
      "elegant gold necklace with GARNET cluster surrounded by seed pearls, deep wine-red warmth, Victorian romance, January birthstone",
      "delicate gold necklace with PERIDOT and diamond pendant, fresh lime green sparkle, spring elegance, August brightness",
      "ornate gold necklace with CITRINE sunburst pendant, warm golden amber, summer sunshine captured in stone, November radiance",
      // Layered and complex
      "elaborate antique gold BIB NECKLACE with cascading gems and pearls, statement piece, multiple layers of jeweled elegance, museum quality",
      "intricate antique gold COLLAR necklace with alternating rubies and diamonds, regal commanding presence, crown jewel elegance",
      "delicate THREE-TIER gold necklace with pearls on first tier, small gems on second, larger gems on third, layered luxury",
      // Cameo and vintage
      "elegant antique gold necklace with CAMEO pendant featuring classical profile, carved shell artistry, Victorian antiquity, timeless charm",
      "refined antique gold locket necklace with diamond and pearl accent, ornate engraving, sentimental elegance, heirloom quality",
      // Bold and dramatic
      "magnificent gold necklace with LARGE MEDALLION pendant featuring lion motif surrounded by rubies, royal heraldry, commanding presence",
      "dramatic antique gold necklace with BLACK ONYX and diamond pendant, striking contrast, mysterious elegance, bold sophistication"
    ];
    
    const backgrounds = [
      // Original warm neutral tones
      "SPACIOUS grand chamber background with DEPTH, soft gradient from WARM TAUPE to SOFT BROWN with atmospheric perspective, large DUSTY ROSE velvet drapery hanging behind with visible folds, BRIGHTER pastel-leaning tones, elegant and airy NOT gloomy",
      "DEEP SPACIOUS room background with sense of grand chamber, warm SOFT TAUPE to MUTED CARAMEL gradient, heavy SOFT BURGUNDY velvet brocade draped behind with rich texture, BRIGHTER pastel tones, elegant airy atmosphere",
      "grand chamber with ATMOSPHERIC DEPTH, soft WARM BEIGE to TAUPE painterly gradient, large MUTED MAUVE velvet fabric draped behind with visible texture, BRIGHTER color scheme, spacious elegant feel",
      "SPACIOUS background with sense of DEPTH, soft gradient from WARM TAUPE to SOFT OLIVE with atmospheric perspective, heavy SAGE GREEN brocade drapery behind with visible folds, BRIGHTER pastel-leaning jewel tones, airy classical style",
      "DEEP BLACK background creating STRONG CONTRAST with fabrics and jewelry, rich DEEP BLACK velvet drapery hanging behind, dramatic contrast with pet's natural colors and bright fabrics, elegant dramatic atmosphere",
      "ATMOSPHERIC DEPTH background suggesting grand chamber, soft WARM BEIGE to TAUPE to SOFT OLIVE gradient, MUTED LAVENDER velvet drapery behind with visible texture, BRIGHTER elegant pastel tones",
      "DEEP BLACK background with STRONG CONTRAST, rich DEEP BLACK velvet fabric draped behind creating dramatic contrast with bright fabrics and jewelry, elegant dramatic portrait atmosphere",
      "grand chamber with ATMOSPHERIC PERSPECTIVE and DEPTH, soft WARM CARAMEL to TAUPE gradient, large SOFT BURGUNDY brocade drapery with rich folds, BRIGHTER pastel tones, spacious elegant royal atmosphere",
      // Library and study settings
      "GRAND LIBRARY background with ATMOSPHERIC DEPTH, warm wood paneling visible, leather-bound books on shelves, DEEP FOREST GREEN velvet curtain to one side, scholarly aristocratic ambiance, warm lamplight glow",
      "DISTINGUISHED STUDY background, mahogany bookshelves receding into atmospheric shadow, RICH BURGUNDY leather chair arm visible, globe and brass instruments, intellectual nobility",
      // Palace and architectural
      "PALATIAL MARBLE COLUMN background with ATMOSPHERIC DEPTH, Corinthian column partially visible, DEEP CRIMSON silk drapery, grand architecture suggesting palace interior, regal opulence",
      "ORNATE GILDED FRAME background effect, as if portrait within portrait, DEEP NAVY velvet behind, gold rococo frame elements visible, museum gallery presentation",
      "GRAND BALLROOM suggestion in background, crystal chandelier reflections, SOFT GOLD silk drapery, atmospheric candlelit ambiance, festive aristocratic setting",
      // Nature and garden inspired
      "CONSERVATORY background with ATMOSPHERIC DEPTH, suggestion of exotic plants and palms, PEACOCK BLUE silk curtain, Victorian botanical garden elegance, natural light filtering through",
      "ENGLISH GARDEN view through window suggestion, SOFT SAGE GREEN silk drapery framing scene, roses and hedges in soft focus, country estate elegance",
      "AUTUMNAL ESTATE background, warm golden light suggesting harvest season, BURNT SIENNA velvet drapery, falling leaves impression, seasonal warmth",
      // Dramatic and moody
      "DRAMATIC STORM CLOUDS background, atmospheric turbulence suggesting heroic portrait, ROYAL PURPLE velvet drapery, Romantic era drama, theatrical presence",
      "VENETIAN EVENING background, suggestion of canal and architecture through window, DEEP TEAL silk curtain, Italian Renaissance mystery, exotic locale",
      "MOONLIT CHAMBER background, silvery blue atmospheric light, MIDNIGHT BLUE velvet drapery, nocturnal elegance, romantic mystery",
      // Rich jewel-toned
      "LUXURIOUS CHAMBER with EMERALD GREEN damask wallpaper suggestion, GOLD silk drapery, jewel-box richness, saturated aristocratic splendor",
      "REGAL THRONE ROOM suggestion, ROYAL PURPLE and GOLD heraldic elements in background, crown and scepter suggestions, imperial grandeur",
      "SAPPHIRE DRAWING ROOM background, RICH BLUE silk walls suggested, CREAM and GOLD accents, cool elegant sophistication",
      // Light and airy
      "BRIGHT MORNING CHAMBER, soft diffused daylight, SOFT PINK silk drapery, fresh and luminous atmosphere, optimistic elegance",
      "SEASIDE VILLA suggestion, Mediterranean light filtering in, SOFT AQUA silk curtain, coastal aristocratic living, breezy sophistication",
      "SUNLIT ORANGERY background, warm golden afternoon light, SOFT CORAL drapery, citrus and sunshine warmth, garden party elegance",
      // Unique and artistic
      "ARTIST'S STUDIO suggestion, painterly chaos in soft focus behind, OCHRE velvet curtain, creative aristocracy, Bohemian elegance",
      "MUSIC ROOM background, grand piano edge visible in shadow, SOFT ROSE silk drapery, cultured refinement, melodic atmosphere",
      "WINTER PALACE suggestion, frost patterns and icy elegance, SILVER-WHITE silk drapery, cool sophisticated splendor, crystalline beauty",
      // Light and bright colored backgrounds
      "SOFT SKY BLUE background with gentle gradient, LIGHT POWDER BLUE silk drapery, airy celestial atmosphere, bright and uplifting elegant mood",
      "PALE MINT GREEN background with soft atmospheric depth, LIGHT SEAFOAM silk curtain, fresh spring garden elegance, bright cheerful aristocratic setting",
      "LIGHT LAVENDER background with soft dreamy quality, PALE LILAC velvet drapery, romantic whimsical atmosphere, bright feminine elegance",
      "SOFT CREAM background with warm ivory undertones, CHAMPAGNE silk drapery with gold accents, bright luminous chamber, light airy sophistication",
      "PALE PEACH background with warm sunset glow, SOFT CORAL silk curtain, bright Mediterranean warmth, cheerful aristocratic villa feel",
      "LIGHT DUSTY ROSE background with romantic softness, BLUSH PINK velvet drapery, bright feminine boudoir elegance, warm inviting atmosphere",
      // Rich jewel backgrounds (lighter versions)
      "BRIGHT EMERALD GREEN background with rich jewel-tone depth, LIGHT JADE silk drapery, vivid botanical garden elegance, saturated but bright",
      "BRIGHT SAPPHIRE BLUE background with royal depth, LIGHT CERULEAN accents, brilliant aristocratic splendor, jewel-toned brightness",
      "BRIGHT RUBY RED background with passionate warmth, LIGHT CORAL silk highlights, vibrant dramatic elegance, saturated royal chamber",
      "RICH AMBER GOLD background with warm luminosity, LIGHT HONEY silk drapery, bright sun-drenched palace, golden hour warmth",
      // Deep contrasting backgrounds
      "RICH BLACK background with velvety depth, dramatic CONTRAST against bright subject, elegant noir sophistication, theatrical presence",
      "DEEP CHARCOAL background fading to black edges, DRAMATIC contrast with bright fabrics, mysterious elegant atmosphere",
      "DARK FOREST GREEN background with emerald depth, CONTRAST with bright jewels and fabrics, sophisticated woodland nobility",
      "MIDNIGHT NAVY background with deep blue richness, DRAMATIC contrast highlighting bright elements, nocturnal regal elegance",
      // Soft neutral backgrounds
      "SOFT DOVE GRAY background with silvery undertones, LIGHT PEWTER silk drapery, elegant understated sophistication, refined neutral palette",
      "WARM TAUPE background with gentle depth, LIGHT CAMEL silk accents, sophisticated earth-toned elegance, timeless classic atmosphere",
      "PALE SILVER background with cool metallic sheen, PLATINUM silk drapery, bright moonlit elegance, ethereal sophisticated glow",
      // Gray and black backgrounds (more variety)
      "LIGHT GRAY background with soft gradient, SILVER silk drapery, clean sophisticated neutral, bright and elegant atmosphere",
      "MEDIUM GRAY background with subtle texture, PEWTER velvet curtain, understated refined elegance, neutral classic backdrop",
      "SOFT SLATE GRAY background with cool undertones, SILVER-GRAY silk drapery, sophisticated neutral palette, elegant and bright",
      "WARM GRAY background with gentle taupe undertones, LIGHT GRAY velvet drapery, refined neutral sophistication, timeless elegance",
      "COOL GRAY background with silvery sheen, ASH GRAY silk curtain, modern classic neutral, clean sophisticated atmosphere",
      "DEEP CHARCOAL GRAY background with rich depth, dramatic contrast with bright subject, elegant noir sophistication",
      "DEEP BLACK background with velvety richness, STRONG DRAMATIC CONTRAST with bright fabrics and subject, theatrical elegant noir",
      "JET BLACK background with absolute depth, MAXIMUM CONTRAST highlighting bright elements, dramatic sophisticated presence",
      "SOFT BLACK background with subtle gray gradients, elegant dark backdrop contrasting with bright subject, refined drama",
      "MUTED CHARCOAL background fading to black edges, sophisticated dark neutral, bright subject stands out dramatically"
    ];
    
    const lightingDirections = [
      // EXTREMELY BRIGHT and COLORFUL lighting - NOT dark, NOT gloomy
      "BRILLIANT BRIGHT KEY LIGHT flooding subject with WARM GOLDEN illumination, VIBRANT COLORFUL highlights, LUMINOUS RADIANT presence, CHEERFUL and UPLIFTING atmosphere, NO dark shadows, NOT gloomy",
      "EXTREMELY BRIGHT and CHEERFUL lighting, subject GLOWING with WARM LIGHT, VIVID COLORFUL jewel-tone reflections from gems and fabrics, BRIGHT HAPPY atmosphere, NOT dark or moody",
      "INTENSELY BRIGHT WARM lighting bathing subject in GOLDEN RADIANCE, COLORFUL VIBRANT highlights on gems and silver, LUMINOUS cheerful portrait, LIGHT AND AIRY feel",
      "BRILLIANT SUNLIT quality, subject FLOODED WITH BRIGHT WARM LIGHT, VIBRANT colors popping, SPARKLING highlights on silver clasp and jewelry, UPBEAT cheerful atmosphere",
      // Warm colorful bright
      "VERY BRIGHT WARM KEY LIGHT, RICH SATURATED COLORS throughout, GLEAMING silver catching light, VIBRANT jewel tones, RADIANT and CHEERFUL, NOT dark NOT gloomy",
      "EXTREMELY BRIGHT diffused warm light, VIVID COLORFUL palette, subject BATHED IN LUMINOUS GLOW, BRIGHT reflections on polished silver, HAPPY uplifting mood",
      "BRILLIANT GOLDEN HOUR warmth, SATURATED VIBRANT COLORS, SPARKLING highlights everywhere, CHEERFUL BRIGHT atmosphere, RADIANT elegant presence",
      // Bright with color emphasis
      "INTENSELY BRIGHT lighting with RICH COLOR SATURATION, VIVID reds blues greens golds, GLEAMING polished silver, LUMINOUS and VIBRANT, NOT muted NOT dark",
      "VERY BRIGHT COLORFUL illumination, SATURATED jewel tones POP, BRILLIANT white highlights, CHEERFUL RADIANT mood, subject GLOWING with WARM LIGHT",
      // Professional bright colorful
      "PROFESSIONAL BRIGHT LIGHTING with ENHANCED COLOR VIBRANCY, subject PERFECTLY ILLUMINATED, RICH SATURATED palette, SPARKLING silver accents, UPLIFTING atmosphere",
      "STUDIO BRIGHT with WARM FILL, VIVID COLORFUL rendering, NO DARK SHADOWS, BRILLIANT highlights on fur and fabrics, CHEERFUL NOT gloomy",
      // Specialty bright colorful
      "BRILLIANT HALO LIGHT with COLORFUL VIBRANCY, RADIANT glowing subject, SATURATED rich tones, GLEAMING silver catching every light, ETHEREAL and BRIGHT",
      "VERY BRIGHT GLAMOUR lighting, VIVID COLORFUL palette, subject GLOWING RADIANTLY, SPARKLING BRILLIANT highlights, CHEERFUL elegant atmosphere",
      // Golden warm bright
      "INTENSELY BRIGHT GOLDEN WARM light, RICH SATURATED COLORS, LUMINOUS RADIANT subject, VIBRANT jewel tones, GLEAMING polished silver, UPLIFTING mood",
      "BRILLIANT WARM SUNSHINE quality, VIVID COLORFUL atmosphere, BRIGHT and CHEERFUL, SPARKLING highlights throughout, NOT dark NOT moody NOT gloomy"
    ];

    // Pick random elements
    let cushion = cushions[Math.floor(Math.random() * cushions.length)];
    let robe = robes[Math.floor(Math.random() * robes.length)];
    let jewelryItem = jewelry[Math.floor(Math.random() * jewelry.length)];
    let background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const lighting = lightingDirections[Math.floor(Math.random() * lightingDirections.length)];

    // Adjust for FEMALE pets - feminine aesthetic
    if (gender === "female") {
      // Lighter, softer cloak colors for female pets - EXPANDED variety
      const feminineRobes = [
        // Original options
        "DAINTY SOFT PINK velvet cloak with delicate gold thread embroidery, soft plush velvety texture, PURE WHITE ermine fur trim, dainty refined fabric - lighter softer feminine tones",
        "DAINTY LAVENDER velvet cloak with delicate gold patterns, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty luxurious fabric - soft feminine colors",
        "DAINTY SOFT ROSE velvet cloak with delicate ornate gold embroidery, soft plush velvety texture, PURE WHITE ermine fur trim, dainty refined fabric - lighter feminine tones",
        "DAINTY PEARL WHITE velvet cloak with delicate gold thread detailing, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty sumptuous fabric - soft luminous feminine",
        "DAINTY SOFT BLUE velvet cloak with delicate gold embroidery, soft plush velvety texture, PURE WHITE ermine fur trim, dainty luxurious fabric - lighter softer feminine colors",
        // Expanded pastels
        "DELICATE BLUSH PEACH velvet cloak with rose gold butterfly embroidery, soft ethereal texture, PURE WHITE swan feather trim, romantic feminine elegance",
        "SOFT MINT GREEN velvet cloak with silver botanical embroidery, fresh spring texture, PURE BRIGHT WHITE fur trim, garden fairy princess style",
        "ETHEREAL POWDER BLUE velvet cloak with silver snowflake patterns, dreamy winter texture, PURE WHITE Arctic fox trim, ice princess elegance",
        "GENTLE LILAC velvet cloak with gold wisteria embroidery, soft purple hues, PURE WHITE ermine trim, Victorian feminine grace",
        "WARM CHAMPAGNE velvet cloak with gold lace patterns, soft cream tones, PURE BRIGHT WHITE fur trim, bridal elegance",
        // Deeper feminine tones
        "RICH DUSTY MAUVE velvet cloak with antique rose gold embroidery, sophisticated feminine depth, PURE WHITE ermine trim, romantic vintage beauty",
        "SOFT CORAL PINK velvet cloak with gold seashell embroidery, warm sunset feminine tones, CREAM WHITE fur trim, mermaid princess elegance",
        "DELICATE PERIWINKLE velvet cloak with silver star embroidery, twilight feminine softness, PURE BRIGHT WHITE fur trim, celestial grace"
      ];
      robe = feminineRobes[Math.floor(Math.random() * feminineRobes.length)];
      
      // Finer, more delicate jewelry for female pets - EXPANDED variety
      const feminineJewelry = [
        // Original options
        "extra delicate fine antique gold necklace with tiny gem clusters (small ruby, emerald, amethyst), intricate gold filigree, tiny pearls, very fine chains - FINER and more delicate",
        "dainty delicate antique gold necklace with small gem clusters, ornate fine filigree work, tiny pearl accents, multiple fine delicate chains - FINER jewelry",
        "delicate fine gold necklace with petite gem clusters, intricate delicate filigree, small pearls, fine delicate chains - FINER and more refined",
        // Pearl-focused feminine
        "elegant triple-strand SEED PEARL choker with tiny diamond accent, delicate cream lustre, feminine grace, princess worthy",
        "dainty single PEARL pendant on fine gold chain, simple elegant femininity, luminous cream drop, understated beauty",
        "delicate FRESHWATER PEARL necklace with tiny pink tourmaline accents, romantic soft pink tones, feminine sweetness",
        // Single gem feminine
        "delicate fine gold necklace with single teardrop ROSE QUARTZ pendant, soft pink love stone, feminine romantic energy",
        "elegant thin gold necklace with small PINK SAPPHIRE pendant surrounded by seed pearls, feminine luxury",
        "dainty gold chain with AQUAMARINE drop and tiny diamonds, icy feminine elegance, mermaid treasure",
        "refined fine silver necklace with MOONSTONE pendant, ethereal feminine shimmer, mystical beauty",
        // Floral and nature
        "delicate gold necklace with tiny FLOWER CLUSTER of mixed gems (pink sapphire, peridot, citrine), garden femininity",
        "dainty gold chain with BUTTERFLY pendant set with tiny diamonds and sapphires, whimsical feminine charm",
        "elegant gold necklace with HEART-SHAPED locket featuring tiny ruby, sentimental feminine keepsake"
      ];
      jewelryItem = feminineJewelry[Math.floor(Math.random() * feminineJewelry.length)];
    }

    // Analyze image darkness to detect black/dark pets (even if description doesn't explicitly say "black")
    const imageDarkness = await analyzeImageDarkness(buffer);
    const petDescLower = petDescription.toLowerCase();
    
    // Check if white cat - add angelic luminous treatment
    const isWhiteCat = species === "CAT" && (
      petDescLower.includes("white") || 
      petDescLower.includes("snow white") ||
      petDescLower.includes("pure white")
    );
    
    // Check if GREY cat - CRITICAL: Grey cats often get turned white/cream, prevent this
    const isGreyCat = species === "CAT" && (
      petDescLower.includes("grey") ||
      petDescLower.includes("gray") ||
      petDescLower.includes("russian blue") ||
      petDescLower.includes("chartreux") ||
      petDescLower.includes("british shorthair") ||
      petDescLower.includes("korat") ||
      petDescLower.includes("nebelung") ||
      petDescLower.includes("blue cat") ||
      petDescLower.includes("silver") ||
      petDescLower.includes("slate") ||
      petDescLower.includes("ash") ||
      petDescLower.includes("smoky") ||
      petDescLower.includes("blue-grey") ||
      petDescLower.includes("blue-gray")
    );
    
    // Check if black cat or dark-coated pet - preserve deep black color
    // Use BOTH description analysis AND image pixel analysis for robust detection
    const descriptionSaysBlack = (
      petDescLower.includes("black") ||
      petDescLower.includes("ebony") ||
      petDescLower.includes("jet black") ||
      petDescLower.includes("coal black") ||
      petDescLower.includes("charcoal") ||
      petDescLower.includes("dark brown")
    );
    
    // Force black cat detection if: (1) it's a cat AND (2) image is dark AND (3) description doesn't contradict
    const isBlackCat = species === "CAT" && (
      descriptionSaysBlack || 
      (imageDarkness.isDark && !petDescLower.includes("white") && !petDescLower.includes("light"))
    );
    
    // Check if dark-coated pet (any species) - use image analysis as backup
    const isDarkCoated = (
      descriptionSaysBlack ||
      (imageDarkness.isDark && !petDescLower.includes("white") && !petDescLower.includes("light"))
    ) && !petDescLower.includes("white");
    
    // Log detection results for debugging
    if (species === "CAT") {
      console.log(`🐱 Cat color detection:`, {
        descriptionSaysBlack,
        imageIsDark: imageDarkness.isDark,
        averageBrightness: imageDarkness.averageBrightness,
        isBlackCat,
        isDarkCoated,
        descriptionPreview: petDescription.substring(0, 100)
      });
      
      // If image is dark but description doesn't mention black, add it to description
      if (imageDarkness.isDark && !descriptionSaysBlack && !isWhiteCat) {
        console.log("⚠️ DARK CAT DETECTED: Image is dark but description doesn't mention black. Adding 'black' to description.");
        petDescription = `black ${petDescription}`;
      }
    }

    // Step 2: Generate late 18th-century aristocratic royal portrait - SPECIES AND PET ACCURACY ARE #1 PRIORITY
    const genderInfo = gender ? `\n=== GENDER ===\nThis is a ${gender === "male" ? "male" : "female"} ${species}.` : "";
    
    // Add feminine aesthetic instructions for female pets
    const feminineAesthetic = gender === "female" ? `
=== FEMININE AESTHETIC ===
This is a FEMALE ${species} - apply feminine aesthetic:
- LIGHTER, SOFTER cloak colors - pastel pinks, lavenders, soft blues, pearl whites
- DELICATE fabrics - fine, refined, gentle textures
- FINER jewelry - more delicate, smaller gems, intricate filigree
- GENTLER visual tone - softer lighting, more graceful composition
- Overall elegant feminine refinement` : "";

    // Add angelic luminous treatment for white cats
    const whiteCatTreatment = isWhiteCat ? `
=== WHITE CAT - ANGELIC LUMINOUS TREATMENT ===
This is a WHITE CAT - apply angelic luminous aesthetic:
- ANGELIC appearance - ethereal, heavenly, divine
- LUMINOUS glow that enhances white fur - soft radiant light
- SOFT GLOW around the entire cat - gentle radiance
- Enhanced presence - the white cat should GLOW with light
- More luminous than other pets - special angelic treatment` : "";

    // Add GREY cat color preservation treatment - CRITICAL to prevent grey becoming white
    const greyCatTreatment = isGreyCat ? `
=== GREY CAT - CRITICAL COLOR PRESERVATION ===
This is a GREY/GRAY CAT - CRITICAL: Preserve the EXACT GREY fur color:
- The cat MUST remain GREY/GRAY - NEVER white, cream, beige, or golden
- Preserve the COOL GREY/BLUE-GREY fur tone exactly as in the reference
- This cat has GREY fur - NOT white, NOT cream, NOT golden, NOT warm-toned
- Russian Blue / Chartreux / British Shorthair type grey coloring
- Maintain the distinctive COOL GREY/SILVER/SLATE tone throughout
- The grey color is ESSENTIAL to this cat's identity - preserve it exactly
- DO NOT warm up the colors - keep the COOL GREY tones
- DO NOT brighten to white or cream - maintain GREY
- Any highlights should be silvery-grey, NOT warm or golden
- The cat's fur should read as DEFINITIVELY GREY in the final image` : "";
    
    // Add black cat color preservation treatment
    const blackCatTreatment = isBlackCat || isDarkCoated ? `
=== BLACK/DARK-COATED PET - CRITICAL COLOR PRESERVATION ===
This is a ${isBlackCat ? "BLACK CAT" : "DARK-COATED PET"} - CRITICAL: Preserve the DEEP BLACK/DARK color:
- The pet MUST remain DEEP BLACK or DARK BROWN - NEVER white, gray, or light colored
- Preserve RICH DEEP BLACK fur color throughout - maintain dark tones
- Use SUBTLE highlights ONLY - gentle rim lighting that doesn't wash out the black
- DEEP SHADOWS are correct - black pets have darker shadows naturally
- AVOID over-brightening - maintain the pet's natural dark coloration
- The black/dark color is ESSENTIAL to the pet's identity - preserve it exactly
- Use contrast with lighter backgrounds/cloaks to make the black fur stand out
- DO NOT lighten or brighten the fur color - keep it DEEP and RICH BLACK/DARK` : "";
    
    // Age preservation instructions
    let agePreservationInstructions = "";
    if (ageStage === "PUPPY" || ageStage === "KITTEN") {
      agePreservationInstructions = `
=== CRITICAL: PRESERVE YOUTHFUL APPEARANCE ===
This is a ${ageStage} - preserve their youthful, baby features EXACTLY:
- Keep large eyes relative to face size (puppies/kittens have proportionally larger eyes)
- Maintain rounder, softer facial features (not mature/adult proportions)
- Preserve smaller body proportions and youthful appearance
- Keep the playful, innocent expression characteristic of young animals
- DO NOT age them up - maintain their exact puppy/kitten stage
- The portrait should reflect the animal exactly as it appears - a ${ageStage}, not an adult
- Preserve all youthful characteristics: rounder head, larger eyes, smaller muzzle, softer features`;
    }
    
    // Build facial structure section if analysis was successful
    const facialStructureSection = facialStructureAnalysis ? `
=== DETAILED FACIAL STRUCTURE (CRITICAL FOR RECOGNITION) ===
The following facial structure analysis MUST be preserved exactly:
${facialStructureAnalysis}
` : "";

    const generationPrompt = `CRITICAL SPECIES REQUIREMENT: THIS IS A ${species}. YOU MUST GENERATE A ${species}. ${notSpecies} REPEAT: THIS IS A ${species} - GENERATE ONLY A ${species}. DO NOT GENERATE THE WRONG SPECIES.

THIS IS A ${species}. Generate a ${species}. ${notSpecies}

=== MASTER STYLE GUIDE (CRITICAL - FOLLOW EXACTLY) ===
A highly refined 18th-century European aristocratic oil-portrait style featuring BRIGHT LUMINOUS lighting and smooth old-master brushwork. Subjects are dressed in richly embroidered cloaks fastened with ornate metal clasps, often adorned with gold chains, gemstone jewelry, and decorative pendants. Fabrics include velvet, silk, and ermine trim rendered with meticulous realism.

Compositions use COLORFUL backgrounds (royal blue, burgundy, forest green, soft cream, dusty rose - NEVER brown or dark) that occasionally feature a single object, architectural detail, or a rich wall drapery to add depth. Colors are VIBRANT and LUMINOUS—BRIGHT REDS, GREENS, BLUES, and GOLDS—creating a regal, CHEERFUL, museum-quality atmosphere. The overall mood is noble, elegant, BRIGHT, and historically authentic. NOT dark, NOT gloomy.

=== VIBRANT COLOR PALETTE (HIGHLY VARIED - Different Every Time) ===
- RANDOMIZE colors each generation - avoid repetitive color schemes
- DARKS: Charcoal black, rich black, deep slate (for dramatic contrast)
- LIGHTS: Pure white, soft cream, ivory, champagne (for airy feel)
- GREYS: Silver grey, warm grey, dove grey, slate
- BLUES: Powder blue, sky blue, navy, teal, sapphire, periwinkle
- PINKS: Soft pink, dusty rose, blush, coral, peach
- GREENS: Emerald, sage, mint, forest green, olive
- PURPLES: Lavender, lilac, mauve, dusty purple
- MIX IT UP: Each portrait should have a unique, different color palette
- CREATE CONTRAST: Colors should make the pet stand out beautifully

=== IDENTITY PRESERVATION - MOST CRITICAL ===
This portrait MUST be instantly recognizable as THIS SPECIFIC ${species}. The owner should look at the portrait and immediately feel "That's MY pet!"

IDENTITY REQUIREMENTS:
- The facial structure must match the original EXACTLY - this is what makes pets recognizable
- Preserve the unique "look" in the eyes - the expression that defines this pet's personality
- Every distinctive marking must be in the EXACT correct location
- The overall silhouette and proportions must match the original
- Breed characteristics must be accurate but INDIVIDUAL features take priority
- If this pet has any asymmetrical features, they MUST be preserved
- The portrait should capture what makes THIS pet different from every other pet of the same breed

WHAT CREATES INSTANT RECOGNITION:
- Correct skull shape and snout proportions (these vary significantly even within breeds)
- Exact eye shape, size, spacing, and color
- Precise ear shape, size, and carriage
- Unique markings in their exact locations
- The pet's characteristic expression
- Correct coat color with accurate shading and patterns

=== CRITICAL: FULLY ANIMAL - NO HUMAN FEATURES ===
- The ${species} must be 100% ANIMAL - NOT a human-animal hybrid
- NO human body, NO human posture, NO bipedal stance
- NO human hands, arms, or humanoid body shape
- The ${species} has FOUR LEGS/PAWS - natural animal anatomy only
- Natural animal proportions and body structure
- The pet is a REAL ${species}, not an anthropomorphic character

=== COMPOSITION (CRITICAL - Follow Exactly) ===
- Subject positioned LOW and CENTRAL - resting on cushion, not standing or floating
- Body ¾ VIEW, head forward or slightly angled - classical portrait posture
- FRONT PAWS VISIBLE and resting on cushion - signature trait
- Cloak draped over body + cushion - looks heavy, rests naturally with realistic folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest PROPERLY SECURING THE CLOAK - two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver finish, clasp HOLDS THE CLOAK TOGETHER at the chest
- MEDIUM CLOSE-UP framing: chest to top of head (NOT full body, NOT face only)
- Camera at pet's eye level or slightly above

=== POSE: NATURAL AND RELAXED (Varied Positions) ===
Choose ONE of these natural, comfortable poses - NOT always stiffly upright:
- RELAXED RECLINE: Pet lounging comfortably, slightly reclined against cushion, relaxed posture
- SOFT SETTLE: Pet settled down naturally, paws tucked or crossed casually, at ease
- GENTLE TILT: Head tilted slightly to one side with curious or thoughtful expression
- COZY CURL: Body slightly curved, comfortable and content, like resting by a fire
- DIGNIFIED REST: Upright but relaxed, not stiff - natural noble bearing without tension
- SLEEPY ELEGANCE: Slightly drowsy, heavy-lidded eyes, peaceful and serene expression
- ALERT BUT CALM: Ears relaxed (not fully perked), attentive but comfortable

KEY POSE QUALITIES:
- The ${species} should look COMFORTABLE and AT EASE - not posed stiffly
- Natural body language - relaxed shoulders, soft posture, genuine expression
- Front paws visible, positioned naturally (crossed, tucked, or resting)
- Head position can vary: straight, tilted, slightly turned - whatever feels natural
- Expression should feel AUTHENTIC - not forced or artificial
- Cloak draped naturally over body - soft plush velvety texture
- Overall feeling of a beloved pet captured in a quiet, comfortable moment
${facialStructureSection}
=== THE ${species} - DETAILED DESCRIPTION ===
${petDescription}${genderInfo}${feminineAesthetic}${whiteCatTreatment}${greyCatTreatment}${blackCatTreatment}${agePreservationInstructions}

=== CRITICAL: EXACT MATCHING ===
The generated pet MUST match the description EXACTLY:
- Same colors - if described as 'midnight black', use midnight black, not charcoal gray
- Same markings in same locations - if description says 'white patch on left cheek', generate a white patch on the LEFT CHEEK
- Same face proportions - if described as 'round face', generate a round face, not oval
- Preserve color gradients exactly - if darker on back, lighter on belly, maintain this gradient
- Every marking, spot, patch, or stripe described MUST appear in the generated image in the EXACT same location
- If asymmetrical markings are described, they MUST be asymmetrical in the generated image
- Eye spacing, nose size, muzzle length must match the description precisely

This ${species} portrait must look like THIS EXACT ${species}. ${notSpecies}

=== STYLE: AUTHENTIC ANTIQUE OIL PAINTING - MUSEUM MASTERPIECE ===
This MUST look like a GENUINE 200+ YEAR OLD ANTIQUE OIL PAINTING - discovered in a grand estate:
- LOOSE FLOWING BRUSHWORK: Long, sweeping, elegant strokes that FLOW across the canvas with graceful energy
- ROUGH TACTILE TEXTURE: The surface should look ROUGH, WEATHERED, and TEXTURED - not smooth or digital
- AUTHENTIC OIL PAINTING TECHNIQUE: THICK IMPASTO with visible paint ridges, layered wet-on-wet glazing, scumbling effects
- GENUINE BRUSH TEXTURE: Individual bristle marks clearly visible, directional strokes following form, varying pressure creating THICK and THIN areas
- FEATHERY STROKES: Like Gainsborough's famous feathery brushwork - light, airy, flowing, alive with movement
- LATE 18TH-CENTURY MASTERS: Thomas Gainsborough's loose feathery luminosity, Joshua Reynolds' rich glazes, Élisabeth Vigée Le Brun's pearlescent elegance (1770-1830)
- PAINT SURFACE TEXTURE: Raised impasto peaks in highlights, rough canvas weave visible through thin areas, tactile weathered quality
- NATURAL PAINT BEHAVIOR: Paint pooling in crevices, dry brush scratches, uneven loading, age-related settling

ANTIQUE AGING EFFECTS (EXTREMELY CRITICAL - PUSH THIS HARD):
- HEAVY CRAQUELURE: PROMINENT network of cracks throughout entire paint surface - like a 300-year-old masterpiece
- DEEP CRACKS in thick impasto areas, fine spider-web cracks in thin glazed areas
- AGED VARNISH: HEAVY warm amber/golden/brown patina - noticeably yellowed and aged
- SIGNIFICANT SURFACE WEAR: Visible paint loss on edges, worn impasto peaks, rubbed areas
- WEATHERED EDGES: Paint worn away at corners and edges, canvas showing through in spots
- CANVAS AGING: Prominently visible aged linen texture, warping, uneven tension
- COLOR MELLOWING: Colors noticeably softened and warmed by centuries - rich amber cast throughout
- DUST AND GRIME: Visible accumulation in paint crevices and texture - the patina of centuries
- FOXING AND AGE SPOTS: Subtle discoloration spots from age
- VARNISH UNEVENNESS: Pooling, drips, and uneven application of aged varnish layers
- PATINA OF TIME: STRONG warm, golden-brown quality throughout - unmistakably antique
- LOOKS 300 YEARS OLD: Not just old - ANCIENT, like discovered in a forgotten castle

WEATHERED EDGE TREATMENT (CRITICAL):
- WORN CORNERS: Paint visibly thinned or missing at corners
- EDGE RUBBING: Soft, worn areas along all edges where handling has occurred
- FRAME SHADOW LINES: Subtle darkening suggesting centuries under a frame
- EXPOSED GROUND: Hints of reddish-brown ground layer showing through worn areas
- SOFT PERIMETER: Edges should feel soft, worn, weathered - NOT crisp or clean

- EXTREMELY ROUGH TEXTURE: Broken, tactile, weathered surface throughout
- DEPTH FROM LAYERING: Underpainting showing through worn areas, colored grounds visible
- LUSTROUS BUT AGED VARNISH: Rich patina with amber warmth, some areas more worn than others
- ABSOLUTELY NOT: digital, smooth, clean, new-looking, fresh, perfect, crisp edges, or pristine

=== COLOR PALETTE (HIGHLY VARIED - Different Every Time) ===
BACKGROUND (RANDOMIZE EACH GENERATION):
- Pick ONE at random: charcoal black, pure white, silver grey, powder blue, navy, teal, soft pink, dusty rose, emerald, sage, lavender, cream, peach, coral, lilac, periwinkle
- MAXIMIZE VARIETY - each portrait should look unique with different colors
- GLOWING atmospheric gradients with sfumato depth - colors seem to RADIATE from within
- CREATE STRONG CONTRAST with pet's fur - background should make pet POP
- BRIGHT and LUMINOUS - interesting color choices
- NEVER brown, tan, beige, or muddy earth tones

FABRICS & DRAPES:
- SATURATED JEWEL TONES with BRILLIANT sheen: vivid ruby red, deep sapphire blue, rich emerald green, royal purple, warm amber gold
- LUSTROUS silk and velvet that CATCHES LIGHT - visible sheen and reflection
- BRIGHT cream/ivory with warm undertones that GLOW
- BRILLIANT antique gold embroidery that SHIMMERS with metallic quality
- Colors should be RICH and RADIANT - like stained glass lit from behind

JEWELRY:
- GLEAMING gold with warm reflective highlights - looks like real polished metal
- BRILLIANT gems that SPARKLE: deep ruby, vivid emerald, rich sapphire, warm topaz, glowing amethyst
- Gems should have INTERNAL FIRE - light refracting within
- LUSTROUS pearls with iridescent overtones - pink, blue, green shimmer
- Metallic surfaces CATCH and REFLECT light realistically

FUR TONES:
- RICH naturalistic colors with LUMINOUS depth - fur should seem to GLOW with health
- Warm reflected light bouncing into shadows - no dead flat areas
- BRILLIANT WHITE highlights on fur tips that POP with brightness
- Multiple tones within single colors - warm and cool variations creating LIFE
- Preserve exact pet coloring with ENHANCED vibrancy
- Deep blacks should be VELVETY and RICH - with subtle blue or brown undertones

=== RENDERING STYLE (Critical - AUTHENTIC OIL PAINTING) ===
BRUSHWORK - LOOSE, FLOWING, EXPRESSIVE:
- LONG SWEEPING STROKES: Elegant flowing brush movements 6-12 inches long, graceful curves following form
- GESTURAL FLUIDITY: Brushwork should feel ALIVE and DYNAMIC - the energy of the artist's hand visible
- FEATHERY EDGES: Soft, wispy brush endings that trail off naturally - NOT hard stops
- VARIED STROKE WIDTH: Thick confident strokes transitioning to thin delicate trails within single movements
- VISIBLE BRISTLE TRACKS: Individual brush hair marks clearly visible, showing direction and speed of stroke
- DIRECTIONAL FLOW: All strokes follow the natural form - fur growth direction, fabric drape, facial contours
- IMPASTO RIDGES: Thick raised paint creating 3D texture on highlights - you could feel it with your fingers
- SCUMBLED ROUGHNESS: Broken color, dry brush dragging, unblended areas for textural interest

PAINT TEXTURE - EXTREMELY ROUGH AND WEATHERED:
- THICK AND THIN CONTRAST: Heavy impasto peaks in lights, thin scraped glazes in shadows
- PROMINENT CANVAS WEAVE: Coarse linen texture CLEARLY visible throughout - especially in thin areas
- HEAVY IMPASTO: Really thick, textured paint that stands up from the surface - almost sculptural
- NATURAL IMPERFECTIONS: Paint pooling, drips, uneven loading, brush running dry, palette scrapings
- EXTREMELY ROUGH TACTILE SURFACE: Should look like you could feel every bump and ridge
- BROKEN JAGGED EDGES: Rough, uneven, weathered transitions - like an ancient artifact
- DRY BRUSH SCRATCHES: Heavy scratchy, textured strokes throughout
- PALETTE KNIFE GOUGES: Thick angular paint, scraped areas, knife marks visible
- GRANULAR TEXTURE: Paint surface should have GRIT and TOOTH - not smooth anywhere
- CRACKS AND FISSURES: Age cracks throughout adding to textural complexity
- WORN PEAKS: Impasto highlights worn smooth from centuries of handling
- ACCUMULATED TEXTURE: Layers upon layers of paint, varnish, dirt, history

LUMINOSITY:
- GLOWING FROM WITHIN: Colors appear to radiate light, not just reflect it
- BRILLIANT HIGHLIGHTS: Pure white and warm highlights that seem to EMIT light
- RICH SATURATED DARKS: Shadows full of color, not grey or muddy
- OPTICAL MIXING: Layered transparent colors create depth and vibrancy
- WARM LIGHT BOUNCING: Reflected warm tones in shadow areas

FINISH QUALITY - HEAVILY AGED AND WEATHERED:
- THICK AMBER VARNISH PATINA: HEAVY warm amber/brown/golden varnish - noticeably aged and yellowed
- PROMINENT CRAQUELURE: CLEARLY VISIBLE network of cracks throughout - like cracked dried earth
- HEAVY SURFACE WEATHERING: Obvious wear on raised impasto, worn edges, rubbed areas, paint loss
- MULTIPLE VARNISH LAYERS: Uneven, pooled, dripped varnish accumulation over centuries
- DEPTH AND DIMENSION: Many visible paint and varnish layers creating complex depth
- EXTREMELY ROUGH TACTILE SURFACE: HEAVILY textured, weathered, rough - ancient artifact quality
- GRIME AND PATINA: Visible accumulation of dust, dirt, age in every crevice
- CANVAS AGING: Prominently visible aged coarse linen texture, warping, buckling
- FOXING AND SPOTS: Age spots, discoloration, the marks of time
- VISIBLE HAND OF ARTIST: Every stroke shows human creation - spontaneous, expressive, alive
- HEAVILY WORN EDGES: Corners and edges worn, paint thinned, canvas peeking through
- SOFT WEATHERED PERIMETER: All edges soft and worn from centuries of handling
- COLOR MELLOWING: Rich warm tones with STRONG amber cast from aged varnish
- DISCOVERED IN A CASTLE: Looks like found in an attic after 300 years - not cleaned or restored
- ABSOLUTELY NOT: smooth, clean, pristine, new-looking, digitally perfect, fresh, or crisp

=== KEY QUALITIES (VIVID, LUMINOUS, AUTHENTIC) ===
- ATMOSPHERIC DEPTH: Background recedes with sfumato, grand chamber feeling, air between elements
- SATURATED JEWEL-TONED fabrics: Rich ruby, deep sapphire, emerald green - colors that SING with vibrancy
- LUSTROUS VELVET TEXTURE: Visible pile direction, light catching raised nap, rich color depth in folds
- BRILLIANT WARM LIGHTING: Strong key light making subject GLOW, warm golden radiance
- LUMINOUS ATMOSPHERE: Everything seems to emit soft inner light - not just reflect
- GLEAMING GOLD accents: Metallic embroidery that catches light, warm reflective quality
- SPARKLING GEMS: Jewelry with internal fire, light refracting within stones, brilliant faceted highlights
- PURE BRILLIANT WHITE highlights: Crisp bright whites that POP against rich colors
- NATURAL ANIMAL BODY: Four legs, normal pet anatomy - never anthropomorphic
- VELVETY DEEP BLACKS: Rich saturated darks with subtle undertones - never flat or grey
- RICH CONTRAST: Bright lights against deep shadows creating dramatic depth
- AUTHENTIC BRUSHWORK: Visible paint texture, bristle marks, natural imperfections of hand-painting
- MUSEUM QUALITY: Looks like a genuine antique masterpiece worth millions

=== COLOR MATCHING REQUIREMENTS ===
- Match colors EXACTLY as described - if described as 'midnight black', use rich deep midnight black, not charcoal gray
- PRESERVE DEEP BLACKS: Any black fur or features must remain rich, deep, and saturated - never lighten black areas
- If described as 'snow white', use pure bright white, not off-white
- If described as 'honey gold', use that exact vibrant golden honey color
- Preserve color gradients exactly - if darker on back, lighter on belly, maintain this gradient
- Do not change or approximate colors - use the exact colors described
- Brighten lighter colors while keeping deep blacks intact and rich

=== MARKINGS AND PATTERNS ===
- Every marking, spot, patch, or stripe described MUST appear in the generated image in the EXACT same location
- If description mentions 'left cheek', place marking on LEFT cheek (viewer's perspective)
- If description mentions 'right shoulder', place marking on RIGHT shoulder
- If asymmetrical markings are described, they MUST be asymmetrical in the generated image
- Do not add markings that are not described
- Do not remove or relocate markings that are described

=== FACE PROPORTIONS ===
- Match face proportions EXACTLY - if described as 'round face', generate a round face, not oval
- If described as 'long/narrow face', generate a long narrow face
- Eye spacing must match the description precisely - if eyes are 'close together', they must be close together
- Nose size relative to face must match - if described as 'small nose', generate a small nose
- Muzzle length must match - if described as 'short muzzle', generate a short muzzle

FULL BODY PORTRAIT - ZOOMED OUT FRAMING: The ${species} is SITTING or RESTING NATURALLY on ${cushion} - like a real ${species} would sit or lie down. NEVER standing upright like a human. The pet should be clearly seated on the cushion or lying down comfortably. Show MORE OF THE BODY - zoom out to show from head to paws with space around the pet. Wide framing, NOT a close-up. With ${robe} draped over its back (NOT clothing, just draped fabric), secured by a BRIGHT POLISHED SILVER CLOAK CLASP at upper chest HOLDING THE CLOAK CLOSED (two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver that catches the light), with ${jewelryItem} around its neck. ${background}. ${lighting}. NO human clothing - ONLY a draped cloak with decorative clasp. NATURAL ANIMAL POSTURE - sitting, lying, or resting like a real pet would. 

RENDERING: AUTHENTIC 300-YEAR-OLD ANTIQUE OIL PAINTING with LOOSE FLOWING BRUSHWORK - long sweeping strokes that feel ALIVE. EXTREMELY ROUGH WEATHERED TEXTURE throughout - HEAVILY textured like ancient artifact. THICK SCULPTURAL IMPASTO, VISIBLE BRISTLE TRACKS, FEATHERY TRAILING EDGES. PROMINENT CRAQUELURE - visible crack network throughout like cracked earth. HEAVY AMBER VARNISH PATINA - noticeably yellowed and aged. COARSE CANVAS WEAVE clearly visible, DRY BRUSH SCRATCHES, BROKEN JAGGED EDGES. SIGNIFICANT SURFACE WEAR - worn impasto peaks, rubbed areas. WEATHERED SOFT EDGES - corners worn, paint thinned at perimeter. Colors with STRONG AMBER CAST from aged varnish. Gainsborough's LOOSE FEATHERY strokes/Reynolds' glazes/Vigée Le Brun's elegance. NOT digital, NOT smooth, NOT clean, NOT new. Pet in NATURAL RELAXED POSE - comfortable, at ease. ATMOSPHERIC DEPTH. PLUSH VELVET cloak, GLEAMING gold, SPARKLING gems. Pet MUST match original - fur with FLOWING brushstrokes. HEAVILY AGED ANTIQUE - looks DISCOVERED IN A FORGOTTEN CASTLE after 300 years, covered in dust and patina.`;

    // Determine which model to use for generation
    // Priority: OpenAI img2img > Stable Diffusion > Composite > Style Transfer > IP-Adapter > FLUX > GPT-Image-1
    // OpenAI img2img gets highest priority when explicitly enabled
    // 
    // CRITICAL: All generation types (free, pack credit, secret credit) use the SAME model selection logic.
    // The only difference is watermarking - the actual generation is identical for all types.
    // useSecretCredit and usePackCredit do NOT affect model selection - only watermarking.
    const useOpenAIImg2Img = process.env.USE_OPENAI_IMG2IMG === "true" && process.env.OPENAI_API_KEY;
    const useStableDiffusion = !useOpenAIImg2Img && process.env.USE_STABLE_DIFFUSION === "true" && process.env.REPLICATE_API_TOKEN;
    const useComposite = !useOpenAIImg2Img && !useStableDiffusion && process.env.USE_COMPOSITE === "true" && process.env.REPLICATE_API_TOKEN;
    const useStyleTransfer = !useOpenAIImg2Img && !useStableDiffusion && !useComposite && process.env.USE_STYLE_TRANSFER === "true" && process.env.REPLICATE_API_TOKEN;
    const useIPAdapter = !useOpenAIImg2Img && !useStableDiffusion && !useComposite && !useStyleTransfer && process.env.USE_IP_ADAPTER === "true" && process.env.REPLICATE_API_TOKEN;
    const useFluxModel = !useOpenAIImg2Img && !useStableDiffusion && !useComposite && !useStyleTransfer && !useIPAdapter && process.env.USE_FLUX_MODEL === "true" && process.env.REPLICATE_API_TOKEN;
    
    console.log("=== IMAGE GENERATION ===");
    console.log("Environment check:");
    console.log("- USE_OPENAI_IMG2IMG:", process.env.USE_OPENAI_IMG2IMG || "not set");
    console.log("- USE_STABLE_DIFFUSION:", process.env.USE_STABLE_DIFFUSION || "not set");
    console.log("- USE_COMPOSITE:", process.env.USE_COMPOSITE || "not set");
    console.log("- USE_STYLE_TRANSFER:", process.env.USE_STYLE_TRANSFER || "not set");
    console.log("- USE_IP_ADAPTER:", process.env.USE_IP_ADAPTER || "not set");
    console.log("- USE_FLUX_MODEL:", process.env.USE_FLUX_MODEL || "not set");
    console.log("- OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "set" : "not set");
    console.log("- REPLICATE_API_TOKEN:", process.env.REPLICATE_API_TOKEN ? "set" : "not set");
    console.log("- IS_MULTI_PET:", isMultiPet ? "true" : "false");
    
    let firstGeneratedBuffer: Buffer;
    
    // === MULTI-PET GENERATION PATH (auto-detected 2 pets in single image) ===
    if (isMultiPet && petDescription1 && petDescription2) {
      console.log("🐾🐾 === MULTI-PET GENERATION MODE (img2img) ===");
      console.log(`Pet 1 (${species1}): ${petDescription1.substring(0, 100)}...`);
      console.log(`Pet 2 (${species2}): ${petDescription2.substring(0, 100)}...`);
      
      // Create a prompt for transforming the image with both pets into a royal portrait
      // Using img2img preserves both pets' identities from the original photo
      // IMPORTANT: This prompt mirrors the single-pet prompt structure for consistent style
      const multiPetImg2ImgPrompt = `CRITICAL: These are TWO ${species1 === species2 ? `${species1}S` : `a ${species1} and a ${species2}`}. Keep BOTH pets exactly as shown - preserve both animals precisely.

=== MASTER STYLE GUIDE (CRITICAL - FOLLOW EXACTLY) ===
A highly refined 18th-century European aristocratic oil-portrait style featuring BRIGHT LUMINOUS lighting and THICK SCULPTURAL OIL PAINT TEXTURE. This must look like a PHYSICALLY PAINTED masterpiece with VISIBLE IMPASTO - raised paint peaks, brush bristle marks, and rich buttery paint application. Subjects are dressed in SUBTLE ELEGANT colored cloaks (soft blush, dusty lavender, gentle powder blue, muted mint, warm cream) fastened with SHINY SILVER or GOLD clasps, adorned with PEARL NECKLACES, gold chains, and gemstone jewelry. Fabrics rendered with THICK TEXTURED PAINT showing brushwork.

Compositions use SOFT ELEGANT BACKGROUNDS (warm cream, dusty powder blue, gentle pale pink, soft lavender, warm ivory - NEVER brown, NEVER dark, NEVER gloomy, NEVER oversaturated) with VISIBLE PAINT TEXTURE throughout. Colors are SUBTLE yet LUMINOUS—soft muted tones that are BRIGHT but REFINED, never garish—applied with THICK, SCULPTURAL brushstrokes creating a regal, SOPHISTICATED, museum-quality atmosphere. The overall mood is noble, elegant, BRIGHT but SUBTLE, with the TACTILE QUALITY of a real oil painting. NOT dark, NOT gloomy, NOT flat, NOT oversaturated.

18th-century aristocratic oil portrait of TWO pets with SIGNATURE THICK PAINT TEXTURE. Late 18th-century European aristocratic portraiture (1770-1830) - Georgian/Regency/Napoleonic era. Like Gainsborough, Reynolds, Vigée Le Brun with their characteristic SUBTLE, REFINED color palettes and RICH IMPASTO TECHNIQUE. NOT Renaissance. NOT digital. Looks PHYSICALLY PAINTED. BRIGHT but ELEGANT aesthetic.

=== CRITICAL - PRESERVE BOTH PETS' IDENTITIES EXACTLY ===
- Pet 1 (${species1}): ${petDescription1.substring(0, 200)}
- Pet 2 (${species2}): ${petDescription2.substring(0, 200)}
${multiPetCombinedDescription ? `- Together: ${multiPetCombinedDescription}` : ""}
- Preserve BOTH pets' face structures, skull shapes, snout proportions EXACTLY
- Keep all markings, colors, fur patterns in their EXACT locations for EACH pet
- Maintain the exact eye color, shape, spacing, and expression for BOTH
- Preserve ear shapes, sizes, and positions exactly for EACH pet
- The unique identifying features of BOTH pets must remain unchanged

=== COMPOSITION - TWO PETS SITTING NATURALLY TOGETHER ===
- ZOOMED OUT FRAMING - show BOTH pets' full bodies, not just heads
- WIDE and CENTERED composition with both pets visible
- Show LARGE CUSHION that comfortably fits BOTH pets
- BOTH pets SEATED or LYING DOWN NATURALLY side by side
- Position pets CLOSE TOGETHER like companions - shoulders touching or nearly touching
- NEVER standing upright like humans - always sitting, lying, or resting
- Natural animal posture for EACH: body low, front paws resting on cushion
- BOTH pets should look comfortable and naturally positioned together
- Natural sibling/companion pose - they should look like they belong together
- FRONT PAWS VISIBLE for both pets, resting naturally on the shared cushion
- Pets can be at slightly different angles (one more forward, one slightly turned)
- Create visual balance - neither pet should dominate or overshadow the other

=== SUBTLE ELEGANT COLOR PALETTE (BRIGHT yet REFINED - NOT DARK) ===
- SUBTLE, ELEGANT, SOFT colors throughout - NOT dark or gloomy, NOT oversaturated
- Colors should be BRIGHT but SOPHISTICATED - luminous yet refined
- AVOID dark colors: NO black backgrounds, NO dark browns, NO deep shadows
- BACKGROUNDS: Soft cream, dusty powder blue, gentle pale pink, soft lavender, muted mint, warm ivory
- SOFT PASTELS: Gentle blush, soft lavender, dusty periwinkle, muted sage, soft powder blue, gentle peach
- LIGHT AND AIRY feel - cheerful, elegant, luminous but never garish
- CREATE HARMONY with subtle colors that make BOTH pets stand out beautifully
- Overall palette should feel BRIGHT, REFINED, and SOPHISTICATED

=== LIGHTING (VERY BRIGHT - Both Subjects Well-Illuminated) ===
- VERY BRIGHT KEY LIGHT illuminating BOTH pets - WELL-LIT and LUMINOUS
- STRONG BRILLIANT HIGHLIGHTS on BOTH faces and fur - INTENSELY ILLUMINATED
- MINIMAL SHADOWS - use fill light to reduce dark areas
- BOTH subjects should GLOW with BRIGHT RADIANT light
- LIGHT AND AIRY feel - NOT heavy shadows, NOT dark, NOT gloomy
- BOTH pets are the BRIGHTEST elements - clearly visible and well-lit
- Ensure even lighting across both subjects - no one pet in shadow
- BRIGHT OVERALL COMPOSITION - cheerful and luminous

=== THRONE CUSHION (Large - Fits Both Pets - SUBTLE ELEGANT COLORS) ===
- LARGE embroidered SILKY velvet cushion that comfortably fits BOTH pets
- SUBTLE ELEGANT colors: soft blush, dusty powder blue, gentle lavender, muted mint, warm cream
- NOT dark colors - use SOFT, REFINED, SOPHISTICATED tones
- SILKY texture with visible sheen and luminous quality
- GOLD or SILVER embroidery, ornate details, tassels
- Wide enough for both pets to sit comfortably side by side

=== REGAL CLOAKS (One Draped Over Each Pet - SUBTLE BEAUTIFUL COLORS) ===
- DAINTY, DELICATE regal CLOAK DRAPED over EACH pet
- SUBTLE ELEGANT cloak colors: soft blush, dusty lavender, gentle powder blue, muted mint, warm cream, soft peach
- NOT oversaturated or garish - use SOFT, BEAUTIFUL, REFINED colors
- Coordinating but not necessarily identical cloaks for each
- More DAINTY and REFINED - not heavy or bulky
- NO human clothing elements - NO sleeves, NO buttons

=== JEWELRY & ACCESSORIES (SILVER, GOLD, PEARLS) ===
- SHINY SILVER cloak clasps - gleaming, polished, reflective
- GOLD chains and pendants - bright and luminous
- PEARL NECKLACES on each pet - elegant strings of lustrous pearls
- Gemstone accents - sparkling rubies, sapphires, emeralds
- Delicate filigree details in gold or silver
- Both pets should look regal and dignified with beautiful jewelry

=== SIGNATURE THICK OIL-PAINT TEXTURE (CRITICAL - Physically Painted Look) ===
This must look like a HIGH-END PHYSICAL OIL PAINTING that was PROFESSIONALLY SCANNED:

THICK SCULPTURAL IMPASTO:
- HEAVY, RAISED paint peaks you can almost FEEL - thick 3D paint texture
- SCULPTURAL paint application - paint stands up from the canvas surface
- Visible PAINT RIDGES and VALLEYS creating physical depth
- THICK BUTTERY strokes with paint that has BODY and WEIGHT
- Impasto highlights that CATCH THE LIGHT like real raised paint

VISIBLE BRUSH BRISTLE MARKS:
- Individual BRISTLE TRACKS embedded in the paint surface
- Directional brushwork following the form - fur direction, fabric drape
- FEATHERY brush edges where strokes trail off

CANVAS TEXTURE & PAINT APPLICATION:
- COARSE WOVEN CANVAS visible in thinner paint areas
- RICH, CREAMY paint consistency - not watery or thin
- Areas of THICK LOADED strokes next to THIN SCRAPED areas

PROFESSIONALLY SCANNED ARTWORK QUALITY:
- High-resolution detail capturing every paint texture
- Museum archival quality reproduction
- The texture and depth of a $50,000 original oil painting
- Classical oil painting technique - Gainsborough, Reynolds, Vigée Le Brun style
- NOT digital, NOT airbrushed, NOT smooth, NOT flat

CRITICAL: BOTH pets must look EXACTLY like themselves in the original photo. This is a portrait of THESE TWO SPECIFIC pets together - their identities must be instantly recognizable.`;

      console.log("Multi-pet img2img prompt length:", multiPetImg2ImgPrompt.length);
      
      try {
        // Use OpenAI img2img (images.edit) to transform the photo while preserving both pets
        console.log("🎨 Using OpenAI img2img for multi-pet portrait...");
        
        // Process the original image buffer for OpenAI
        const processedForOpenAI = await sharp(buffer)
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        
        // Convert buffer to File for OpenAI API
        const uint8Array = new Uint8Array(processedForOpenAI);
        const imageBlob = new Blob([uint8Array], { type: "image/png" });
        const imageFile2 = new File([imageBlob], "multi-pet-photo.png", { type: "image/png" });
        
        const multiPetResponse = await openai.images.edit({
          model: "gpt-image-1",
          image: imageFile2,
          prompt: multiPetImg2ImgPrompt,
          n: 1,
          size: "1024x1024",
        });
        
        const multiPetImageData = multiPetResponse.data?.[0];
        if (!multiPetImageData) {
          throw new Error("No image generated for multi-pet portrait");
        }
        
        if (multiPetImageData.b64_json) {
          firstGeneratedBuffer = Buffer.from(multiPetImageData.b64_json, "base64");
          console.log("✅ Multi-pet portrait generated (base64)");
        } else if (multiPetImageData.url) {
          console.log("Downloading multi-pet portrait from URL...");
          const downloadResponse = await fetch(multiPetImageData.url);
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download multi-pet image: ${downloadResponse.status}`);
          }
          firstGeneratedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
          console.log("✅ Multi-pet portrait generated (URL download)");
        } else {
          throw new Error("No image data in multi-pet response");
        }
        
        console.log("✅ Multi-pet portrait generated successfully!");
        console.log("Buffer size:", firstGeneratedBuffer.length);
        
        // For multi-pet, use combined species for later processing
        species = `${species1} and ${species2}`;
        petDescription = `A duo portrait featuring: Pet 1 (${species1}): ${petDescription1}. Pet 2 (${species2}): ${petDescription2}.`;
        
      } catch (multiPetError) {
        console.error("❌ Multi-pet generation failed:", multiPetError);
        throw new Error(`Multi-pet portrait generation failed: ${multiPetError instanceof Error ? multiPetError.message : "Unknown error"}`);
      }
    } else {
      // === SINGLE PET GENERATION PATH (Original) ===
    
    const modelName = useOpenAIImg2Img ? "OpenAI img2img (images.edit)"
      : useStableDiffusion ? "Stable Diffusion SDXL (full generation)"
      : useComposite ? "Composite (segment + scene + blend)"
      : useStyleTransfer ? "Style Transfer + GPT Refinement" 
      : useIPAdapter ? "IP-Adapter SDXL (identity preservation)" 
      : useFluxModel ? "FLUX (img2img)" 
      : "GPT-Image-1 (OpenAI)";
    console.log("Model selected:", modelName);
    console.log("Selection reason:", useOpenAIImg2Img ? "USE_OPENAI_IMG2IMG=true" 
      : useStableDiffusion ? "USE_STABLE_DIFFUSION=true"
      : useComposite ? "USE_COMPOSITE=true"
      : useStyleTransfer ? "USE_STYLE_TRANSFER=true"
      : useIPAdapter ? "USE_IP_ADAPTER=true"
      : useFluxModel ? "USE_FLUX_MODEL=true"
      : "No model flags set, using default GPT-Image-1");
    console.log("Generation type:", useSecretCredit ? "SECRET CREDIT (un-watermarked)" : usePackCredit ? "PACK CREDIT (watermarked)" : "FREE (watermarked)");
    console.log("⚠️ IMPORTANT: All generation types (free, pack credit, secret credit) use the SAME model:", modelName);
    console.log("⚠️ The only difference is watermarking - generation model is identical for all types.");
    console.log("Detected species:", species);
    console.log("Species enforcement:", notSpecies);
    
    if (useOpenAIImg2Img) {
      // Use OpenAI img2img for primary generation
      console.log("🎨 Using OpenAI img2img (images.edit) for primary generation...");
      console.log("📌 Pet identity will be preserved from original image");
      console.log("📌 Transforming pet photo directly into late 18th-century aristocratic portrait");
      
      // Create a focused prompt for OpenAI img2img
      // OpenAI's images.edit works best with SHORT, CLEAR instructions
      // Priority: preserve pet identity first, then add minimal styling
      // Extract key identifying features from description for better preservation
      const keyFeatures = petDescription.length > 200 
        ? petDescription.substring(0, 200) + "..."
        : petDescription;
      
      // CRITICAL: Explicitly state the species multiple times to prevent wrong animal generation
      const speciesEnforcement = species === "CAT" 
        ? "CRITICAL: This is a CAT. Generate ONLY a CAT. DO NOT generate a dog. This MUST be a CAT."
        : species === "DOG"
        ? "CRITICAL: This is a DOG. Generate ONLY a DOG. DO NOT generate a cat. This MUST be a DOG."
        : `CRITICAL: This is a ${species}. Generate ONLY a ${species}.`;
      
      // Use the same robust detection logic (petDescription already updated with "black" if needed)
      const petDescLowerForOpenAI = petDescription.toLowerCase();
      const isWhiteCatForOpenAI = species === "CAT" && (
        petDescLowerForOpenAI.includes("white") || 
        petDescLowerForOpenAI.includes("snow white") ||
        petDescLowerForOpenAI.includes("pure white")
      );
      
      // Check if GREY cat - CRITICAL: Grey cats often get turned white/cream
      const isGreyCatForOpenAI = species === "CAT" && (
        petDescLowerForOpenAI.includes("grey") ||
        petDescLowerForOpenAI.includes("gray") ||
        petDescLowerForOpenAI.includes("russian blue") ||
        petDescLowerForOpenAI.includes("chartreux") ||
        petDescLowerForOpenAI.includes("british shorthair") ||
        petDescLowerForOpenAI.includes("korat") ||
        petDescLowerForOpenAI.includes("nebelung") ||
        petDescLowerForOpenAI.includes("blue cat") ||
        petDescLowerForOpenAI.includes("silver") ||
        petDescLowerForOpenAI.includes("slate") ||
        petDescLowerForOpenAI.includes("ash") ||
        petDescLowerForOpenAI.includes("smoky") ||
        petDescLowerForOpenAI.includes("blue-grey") ||
        petDescLowerForOpenAI.includes("blue-gray")
      );
      
      // Check if black cat or dark-coated pet - use same logic as main detection
      const descSaysBlackForOpenAI = (
        petDescLowerForOpenAI.includes("black") ||
        petDescLowerForOpenAI.includes("ebony") ||
        petDescLowerForOpenAI.includes("jet black") ||
        petDescLowerForOpenAI.includes("coal black") ||
        petDescLowerForOpenAI.includes("charcoal") ||
        petDescLowerForOpenAI.includes("dark brown")
      );
      
      const isBlackCatForOpenAI = species === "CAT" && (
        descSaysBlackForOpenAI || 
        (imageDarkness.isDark && !petDescLowerForOpenAI.includes("white") && !petDescLowerForOpenAI.includes("light"))
      );
      
      const isDarkCoatedForOpenAI = (
        descSaysBlackForOpenAI ||
        (imageDarkness.isDark && !petDescLowerForOpenAI.includes("white") && !petDescLowerForOpenAI.includes("light"))
      ) && !petDescLowerForOpenAI.includes("white");
      
      const feminineAestheticForOpenAI = gender === "female" ? `
=== FEMININE AESTHETIC ===
This is a FEMALE ${species} - apply feminine aesthetic:
- LIGHTER, SOFTER cloak colors - pastel pinks, lavenders, soft blues, pearl whites
- DELICATE fabrics - fine, refined, gentle textures
- FINER jewelry - more delicate, smaller gems, intricate filigree
- GENTLER visual tone - softer lighting, more graceful composition
- Overall elegant feminine refinement
` : "";

      const whiteCatTreatmentForOpenAI = isWhiteCatForOpenAI ? `
=== WHITE CAT - ANGELIC LUMINOUS TREATMENT ===
This is a WHITE CAT - apply angelic luminous aesthetic:
- ANGELIC appearance - ethereal, heavenly, divine
- LUMINOUS glow that enhances white fur - soft radiant light
- SOFT GLOW around the entire cat - gentle radiance
- Enhanced presence - the white cat should GLOW with light
- More luminous than other pets - special angelic treatment
` : "";

      const greyCatTreatmentForOpenAI = isGreyCatForOpenAI ? `
=== GREY CAT - CRITICAL COLOR PRESERVATION ===
This is a GREY/GRAY CAT - CRITICAL: Preserve the EXACT GREY fur color:
- The cat MUST remain GREY/GRAY - NEVER white, cream, beige, or golden
- Preserve the COOL GREY/BLUE-GREY fur tone exactly as in the reference
- This cat has GREY fur - NOT white, NOT cream, NOT golden
- Maintain the distinctive COOL GREY/SILVER/SLATE tone throughout
- DO NOT warm up the colors - keep the COOL GREY tones
- DO NOT brighten to white or cream - maintain GREY
- Any highlights should be silvery-grey, NOT warm or golden
` : "";
      
      const blackCatTreatmentForOpenAI = isBlackCatForOpenAI || isDarkCoatedForOpenAI ? `
=== BLACK/DARK-COATED PET - CRITICAL COLOR PRESERVATION ===
This is a ${isBlackCatForOpenAI ? "BLACK CAT" : "DARK-COATED PET"} - CRITICAL: Preserve the DEEP BLACK/DARK color:
- The pet MUST remain DEEP BLACK or DARK BROWN - NEVER white, gray, or light colored
- Preserve RICH DEEP BLACK fur color throughout - maintain dark tones
- Use SUBTLE highlights ONLY - gentle rim lighting that doesn't wash out the black
- DEEP SHADOWS are correct - black pets have darker shadows naturally
- AVOID over-brightening - maintain the pet's natural dark coloration
- The black/dark color is ESSENTIAL to the pet's identity - preserve it exactly
- Use contrast with lighter backgrounds/cloaks to make the black fur stand out
- DO NOT lighten or brighten the fur color - keep it DEEP and RICH BLACK/DARK
` : "";

      // RAINBOW BRIDGE MEMORIAL PORTRAIT PROMPT
      // Used when style === "rainbow-bridge" for memorial portraits of pets who have passed
      const rainbowBridgePrompt = isRainbowBridge ? `${speciesEnforcement} DO NOT change the ${species} at all - keep it exactly as shown in the original image. This is a ${species}, not any other animal.

RAINBOW BRIDGE MEMORIAL PORTRAIT - Heavenly, angelic tribute to a beloved pet who has crossed the Rainbow Bridge.

=== CRITICAL PET PRESERVATION ===
- Preserve the face structure, skull shape, snout proportions EXACTLY from the original
- Keep all markings, colors, fur patterns in their EXACT locations
- Maintain the exact eye color, shape, spacing, and expression
- Preserve ear shape, size, and position exactly
- The pet's unique identifying features must remain unchanged
- This is a memorial - accuracy is paramount

=== HEAVENLY/ANGELIC AESTHETIC ===
- ETHEREAL, peaceful, serene atmosphere
- SOFT GLOWING LIGHT surrounding the pet - gentle radiance
- ANGELIC appearance - divine, heavenly, peaceful
- SOFT WHITES and CREAMS dominate the palette
- Gentle pastel rainbow colors subtly present (soft pink, peach, lavender, mint, sky blue)
- LUMINOUS quality throughout - pet appears to glow with inner light
- Peaceful, content expression - at rest in a better place
- Soft, diffused lighting with no harsh shadows
- Dream-like, ethereal quality

=== BACKGROUND VARIATIONS ===
VARY THE COMPOSITION - Use different heavenly settings:
- OPTION 1: Pet sitting or resting on a SOFT CLOUD PILLOW - fluffy, ethereal clouds that look like a comfortable cushion
- OPTION 2: Pet surrounded by gentle HEAVENLY MIST with soft clouds drifting
- OPTION 3: Pet in a field of soft LUMINOUS FLOWERS or petals floating gently
- OPTION 4: Pet on a SOFT GOLDEN LIGHT PLATFORM with ethereal mist below
- SOFT, GLOWING background - creamy whites, pale golds, gentle pastels
- VERY SUBTLE rainbow arc or prismatic light in background (gentle, not overwhelming)
- Soft light rays filtering through clouds
- NO dark elements - all light and peaceful
- Ethereal, heavenly atmosphere

=== COMPOSITION (ZOOMED OUT, Natural Resting Pose) ===
- ZOOMED OUT FRAMING - show MORE of the pet's body, not just head/shoulders
- CENTERED portrait composition with space around the pet
- Pet appears peaceful and serene
- SITTING or RESTING NATURALLY on the cloud/surface - NEVER standing upright like a human
- Pet should be clearly seated or lying down comfortably on the cloud pillow
- Natural resting pose - sitting, curled up, or lying down peacefully
- Show from head to paws - wide framing, NOT a close-up
- SOFT GLOW around the pet like a halo or aura
- No royal elements (no thrones, cloaks, jewelry)
- Simple, elegant, heavenly setting
- Pet looks comfortable and at peace in their resting position

=== LIGHTING ===
- SOFT, DIFFUSED heavenly light
- Gentle glow emanating from and around the pet
- NO harsh shadows - soft and peaceful
- Warm, golden undertones
- Ethereal rim lighting creating angelic glow
- Pet appears to be bathed in soft light
- Light filtering through clouds creates soft dappled effect

=== SIGNATURE THICK OIL-PAINT TEXTURE (Heavenly Yet Tactile) ===
This must look like a HIGH-END PHYSICAL OIL PAINTING that was PROFESSIONALLY SCANNED:

THICK SCULPTURAL IMPASTO:
- HEAVY, RAISED paint peaks - thick 3D paint texture even in ethereal clouds
- SCULPTURAL paint application on fur highlights and cloud formations
- Visible PAINT RIDGES creating physical depth in heavenly light
- THICK BUTTERY strokes with paint that has BODY and WEIGHT
- Impasto highlights that CATCH THE LIGHT like real raised paint

VISIBLE BRUSH BRISTLE MARKS:
- Individual BRISTLE TRACKS embedded in paint - clouds, fur, light rays
- Directional brushwork following the form - soft and ethereal yet textured
- FEATHERY brush edges creating soft, dreamy transitions

PROFESSIONALLY SCANNED ARTWORK QUALITY:
- High-resolution detail capturing every paint texture
- Museum archival quality reproduction
- Soft, dreamy, ethereal feel WITH visible paint texture
- The tactile quality of a $50,000 original memorial painting
- Classical technique like Gainsborough or Reynolds but heavenly
- NOT hyper-realistic - soft, artistic, PAINTED with visible texture

CRITICAL: The ${species} must look EXACTLY like the original photo - this is a memorial portrait. Vary the composition (sometimes on cloud pillow, sometimes floating, sometimes in mist). Use visible brushstrokes and painterly technique throughout. The pet should appear peaceful, serene, and surrounded by heavenly light. Create a beautiful, varied, painterly tribute that brings comfort.` : null;

      const openAIImg2ImgPrompt = isRainbowBridge ? rainbowBridgePrompt! : `${speciesEnforcement} DO NOT change the ${species} at all - keep it exactly as shown in the original image. This is a ${species}, not any other animal.

=== MASTER STYLE GUIDE (CRITICAL - FOLLOW EXACTLY) ===
A highly refined 18th-century European aristocratic oil-portrait style featuring BRIGHT LUMINOUS lighting and THICK SCULPTURAL OIL PAINT TEXTURE. This must look like a PHYSICALLY PAINTED masterpiece with VISIBLE IMPASTO - raised paint peaks, brush bristle marks, and rich buttery paint application. Subjects are dressed in richly embroidered cloaks fastened with ornate metal clasps, often adorned with gold chains, gemstone jewelry, and decorative pendants. Fabrics include velvet, silk, and ermine trim rendered with THICK TEXTURED PAINT showing brushwork.

Compositions use ELEGANT backgrounds (soft dusty blue, muted burgundy, gentle sage, soft cream, dusty rose - NEVER brown or dark) with VISIBLE PAINT TEXTURE throughout. Colors are SUBTLE yet LUMINOUS—soft muted tones that are still BRIGHT and CHEERFUL but never garish or overly saturated—applied with THICK, SCULPTURAL brushstrokes creating a regal, REFINED, museum-quality atmosphere. The overall mood is noble, elegant, BRIGHT but SOPHISTICATED, historically authentic with the TACTILE QUALITY of a real oil painting. NOT dark, NOT gloomy, NOT flat or digital, NOT oversaturated.

18th-century aristocratic oil portrait with SIGNATURE THICK PAINT TEXTURE. Late 18th-century European aristocratic portraiture (1770-1830) - Georgian/Regency/Napoleonic era. Like Gainsborough, Reynolds, Vigée Le Brun with their characteristic SUBTLE, REFINED color palettes and RICH IMPASTO TECHNIQUE. NOT Renaissance. NOT digital. Looks PHYSICALLY PAINTED.${feminineAestheticForOpenAI}${whiteCatTreatmentForOpenAI}${greyCatTreatmentForOpenAI}${blackCatTreatmentForOpenAI}

=== SUBTLE ELEGANT COLOR PALETTE (Bright but Refined - Different Every Time) ===
- RANDOMIZE colors each generation - avoid repetitive color schemes
- Colors should be SUBTLE yet LUMINOUS - bright but not garish, vibrant but sophisticated
- DARKS: Soft charcoal, muted slate, gentle black (for subtle contrast)
- LIGHTS: Warm white, soft cream, gentle ivory, muted champagne (for airy feel)
- GREYS: Soft silver, warm dove grey, gentle slate, muted pewter
- BLUES: Dusty powder blue, soft sky blue, muted navy, gentle teal, soft periwinkle
- PINKS: Soft blush, dusty rose, muted coral, gentle peach
- GREENS: Soft sage, muted mint, gentle olive, dusty emerald
- PURPLES: Soft lavender, gentle lilac, dusty mauve, muted violet
- MIX IT UP: Each portrait should have a unique, ELEGANT color palette
- CREATE HARMONY: Colors should complement the pet with SUBTLE sophistication

=== CRITICAL PET PRESERVATION ===
- Preserve the face structure, skull shape, snout proportions EXACTLY from the original
- Keep all markings, colors, fur patterns in their EXACT locations
- Maintain the exact eye color, shape, spacing, and expression
- Preserve ear shape, size, and position exactly
- Warm, natural fur tones with soft painterly highlights and fine brushwork
- The pet's unique identifying features must remain unchanged

=== LIGHTING (VERY BRIGHT - Subject Well-Illuminated) ===
- VERY BRIGHT KEY LIGHT illuminating the subject - WELL-LIT and LUMINOUS
- STRONG BRILLIANT HIGHLIGHTS on the FACE and fur - INTENSELY ILLUMINATED
- MINIMAL SHADOWS - use fill light to reduce dark areas
- Subject should GLOW with BRIGHT RADIANT light - NOT dark or moody
- BRIGHT warm highlights throughout - LUMINOUS presence
- LIGHT AND AIRY feel - NOT heavy shadows
- Subject is the BRIGHTEST element - clearly visible and well-lit
- Clean, professional, BRIGHT portrait lighting
- Soft shadows only where needed for dimension - NOT deep dark shadows

=== ELEGANT COLOR HARMONY (SUBTLE yet LUMINOUS - Refined Classical Palette) ===
Select ELEGANT, REFINED cloak, cushion, drapery, and gem colors based on the pet's natural fur tones. Colors should be SUBTLE yet LUMINOUS - bright but not garish, vibrant but sophisticated:

FOR WARM-TONED OR TAN PETS: Soft dusty blues, muted sage greens, elegant burgundy, or refined teal fabrics - SUBTLE and SOPHISTICATED
FOR BLACK OR DARK-COATED PETS: Soft cream, warm ivory, muted gold, soft sage, dusty blue, gentle lavender fabrics for contrast - ELEGANT and REFINED
FOR WHITE OR PALE PETS: Soft jewel tones (muted ruby, soft emerald, dusty sapphire, gentle periwinkle) or elegant velvets - SOPHISTICATED colors
FOR ORANGE/GINGER PETS: Soft teal, muted turquoise, gentle sage green, or dusty navy fabrics - SUBTLE ELEGANT tones
FOR GRAY OR SILVER PETS: Soft burgundy, dusty plum, muted amethyst, or warm gold-trimmed velvets - REFINED and ELEGANT
FOR MULTICOLOR PETS: harmonize with dominant fur tone using SUBTLE/ELEGANT colors, accent with complementary secondary tone

Apply same harmony to GEMSTONES: select ELEGANT gems that complement pet's eyes or fur (soft ruby, muted emerald, dusty sapphire, warm topaz, gentle amethyst) - SPARKLING but SUBTLE, LUMINOUS but REFINED

=== COMPOSITION (ZOOMED OUT, Wide, Centered, Full Body Visible) ===
- ZOOMED OUT FRAMING - show MORE of the pet's body, not just head/shoulders
- WIDE and CENTERED composition with space around the pet
- Show FULL CUSHION with pet clearly SITTING or RESTING on it
- Pet SEATED or LYING DOWN NATURALLY like a real ${species} would rest
- NEVER standing upright like a human - always sitting, lying, or resting
- Natural animal posture: body low, front paws resting on cushion, relaxed pose
- Pet should look comfortable and naturally positioned on the cushion
- Body ¾ view, head forward - natural animal resting posture
- FRONT PAWS VISIBLE and resting naturally on cushion
- Show from head to paws - wide framing, NOT a close-up
- NO human clothing - ONLY a cloak draped over the pet
- All colors automatically unified and harmonious with pet's natural palette

=== THRONE CUSHION ===
- Embroidered SILKY velvet cushion with VISIBLE GOLD TASSELS
- SUBTLE, ELEGANT color selected to complement pet's fur tones
- SILKY texture with visible sheen
- Gold embroidery, ornate details
- Refined, sophisticated tones - luminous but not garish

=== REGAL CLOAK (Draped Over Pet AND Cushion - NOT Clothing) ===
- DAINTY, DELICATE regal CLOAK DRAPED over BOTH the pet AND cushion - NOT clothing, just draped fabric
- More DAINTY and REFINED - not heavy or bulky
- NO human clothing elements - NO sleeves, NO buttons, NO tailored garments
- Just a DAINTY CLOAK/ROBE draped naturally over the pet's back and shoulders
- SOFT, PLUSH VELVETY texture - luxurious velvet with visible nap and plush feel
- VELVETY appearance - soft, plush, luxurious velvet fabric
- BRIGHT ANTIQUE GOLD EMBROIDERY - delicate and refined
- DEEP, RICH, SATURATED fabric colors adjusted to enhance and balance pet's tones
- WHITE FUR TRIM with BLACK ERMINE SPOTS
- Looks DAINTY, VELVETY, and luxurious - soft plush velvet texture
- Fabric GLOWS with DEEP, RICH color - saturated and luminous, retaining darker tones in folds
- Pet's natural body and fur visible beneath the draped cloak

=== BRIGHT POLISHED SILVER CLOAK CLASP (Fastener Securing Cloak at Upper Chest) ===
- BRIGHT SHINY POLISHED SILVER CLASP that PROPERLY SECURES and CONNECTS the cloak at upper chest
- TWO GLEAMING SILVER METAL PLATES connected by a BRIGHT REFLECTIVE SILVER CHAIN
- CLASP HOLDS THE CLOAK TOGETHER - fabric gathered and fastened by the clasp
- HIGHLY REFLECTIVE polished silver finish that CATCHES THE LIGHT brilliantly
- ELEGANT silverwork with BRIGHT LUMINOUS SHINE - not dull or antiqued
- The clasp is the FUNCTIONAL CONNECTOR that keeps the cloak closed and draped properly
- SILVER metal with polished antique finish - catches light beautifully
- May feature small gemstone accent, pearl, or enamel detail
- BRIGHT SILVER with aged patina - gleaming antique look
- Positioned where cloak edges meet at the chest - functional and decorative

=== ANTIQUE 18TH-CENTURY JEWELRY ===
- Layered MULTI-CHAIN gold necklaces
- Ornate FILIGREE details
- BRIGHT WHITE PEARLS and small CLUSTERED BRIGHT GEMSTONES
- BRIGHT SPARKLING gems match or complement pet's natural colors (eyes/fur)
- Gems GLOW and SPARKLE - not dull
- NOT modern jewelry, NOT simple beads

=== BACKGROUND DRAPERY ===
- Heavy SILKY velvet drapery with PAINTERLY FOLDS
- DEEP, RICH, SATURATED colors selected to support overall harmony with pet
- SILKY LUSTROUS texture with visible sheen
- Atmospheric depth with DARKER TONES in shadows and folds - retaining darker tones
- Colors should be DEEP, RICH, and SATURATED - rich jewel tones
- DARKER TONES in shadows and background depth
- ZERO modern elements

=== WHITE TONES ===
- All whites should be PURE BRIGHT WHITE - not grey, not muted
- Ermine fur trim: PURE WHITE with black spots
- Pearl accents: BRIGHT WHITE
- White highlights: PURE BRIGHT WHITE

=== SIGNATURE THICK OIL-PAINT TEXTURE (CRITICAL - Physically Painted Look) ===
This must look like a HIGH-END PHYSICAL OIL PAINTING that was PROFESSIONALLY SCANNED:

THICK SCULPTURAL IMPASTO:
- HEAVY, RAISED paint peaks you can almost FEEL - thick 3D paint texture
- SCULPTURAL paint application - paint stands up from the canvas surface
- Visible PAINT RIDGES and VALLEYS creating physical depth
- THICK BUTTERY strokes with paint that has BODY and WEIGHT
- Impasto highlights that CATCH THE LIGHT like real raised paint
- Paint texture most prominent on: fur highlights, jewelry, fabric folds, cloak edges

VISIBLE BRUSH BRISTLE MARKS:
- Individual BRISTLE TRACKS embedded in the paint surface
- You can see WHERE THE BRUSH DRAGGED through wet paint
- Directional brushwork following the form - fur direction, fabric drape
- FEATHERY brush edges where strokes trail off
- Varied brush sizes - fine detail brushes AND broad loaded brushes

CANVAS TEXTURE SHOWING THROUGH:
- COARSE WOVEN CANVAS visible in thinner paint areas
- Canvas weave pattern shows through glazed shadows
- Contrast between THICK impasto peaks and THIN canvas-revealing areas
- Professional artist's linen canvas texture

PAINT LOADING AND APPLICATION:
- RICH, CREAMY paint consistency - not watery or thin
- Areas of THICK LOADED strokes next to THIN SCRAPED areas
- Palette knife texture in some background areas
- Wet-into-wet blending visible in soft transitions

PROFESSIONALLY SCANNED ARTWORK QUALITY:
- High-resolution detail capturing every paint texture
- Museum archival quality reproduction
- The texture and depth of a $50,000 original oil painting
- Looks like it belongs in a prestigious gallery or private collection

RENDERING STYLE:
- LONG, FLOWING brush strokes with visible paint body
- NOT digital, NOT airbrushed, NOT smooth, NOT flat
- Hand-painted charm with intentional texture variations
- SUBTLE LUMINOUS GLOW throughout - paint has inner warmth
- SILKY LUSTROUS fabric textures with thick paint highlights
- DEEP, RICH, SATURATED colors with visible paint depth
- Subject GLOWS with BRIGHT warm light through textured paint

CRITICAL: The ${species} must sit NATURALLY like a real ${species} - NOT in a human-like pose. NO human clothing - ONLY a cloak draped over. The ${species} itself must remain completely unchanged and identical to the original photo. Remember: this is a ${species}, not a human.`;
      
      // Process the original image buffer for OpenAI
      const processedForOpenAI = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      
      firstGeneratedBuffer = await generateWithOpenAIImg2Img(
        processedForOpenAI,
        openAIImg2ImgPrompt,
        openai
      );
      
      console.log("✅ OpenAI img2img generation complete");
    } else if (useStableDiffusion) {
      // Use full Stable Diffusion SDXL for generation
      console.log("🎨 Using Full Stable Diffusion SDXL...");
      console.log("📌 Pet identity preserved from reference image");
      console.log("📌 Late 18th-century aristocratic portrait style applied via SDXL");
      
      firstGeneratedBuffer = await generateWithStableDiffusion(
        base64Image,
        petDescription,
        species,
        detectedBreed
      );
      
      console.log("✅ Stable Diffusion generation complete");
    } else if (useComposite) {
      // Use composite approach for maximum face preservation
      console.log("🎨 Using Composite Approach...");
      console.log("📌 Step 1: Segment pet from background");
      console.log("📌 Step 2: Generate Victorian royal scene");
      console.log("📌 Step 3: Composite pet onto scene");
      console.log("📌 Step 4: Harmonize final portrait");
      
      firstGeneratedBuffer = await generateCompositePortrait(
        base64Image,
        species,
        openai
      );
      
      console.log("✅ Composite portrait complete");
    } else if (useStyleTransfer) {
      // Use style transfer - preserves 88%+ of pet identity
      console.log("🎨 Using Style Transfer (SDXL low-denoise)...");
      console.log("📌 Pet photo will be transformed to oil painting style");
      
      // Stage 1: Apply style transfer for identity preservation
      const styleTransferBuffer = await applyStyleTransfer(base64Image);
      console.log("✅ Style transfer complete (Stage 1)");
      
      // Stage 2: GPT Refinement for quality enhancement (if enabled)
      const enableGptRefinement = process.env.ENABLE_GPT_REFINEMENT !== "false"; // Default to true
      
      if (enableGptRefinement) {
        console.log("🎨 Applying GPT-Image-1 refinement (Stage 2)...");
        console.log("📌 Enhancing quality while preserving identity");
        
        // Create enhancement prompt - focus on quality, keep the subject unchanged
        const enhancementPrompt = `Transform this into a beautiful Victorian royal portrait of a ${species}.

BACKGROUND - MAKE IT BEAUTIFUL:
- Create a LIGHTER, more luminous background - soft creams, warm ivories, gentle golden tones
- NOT dark or gloomy - bright and elegant like a sunlit palace
- Add elegant royal elements: plush cushion, luxurious velvet robe draped nearby, ornate gold details
- Soft, diffused late 18th-century portrait lighting throughout
- Beautiful color palette: soft golds, warm creams, touches of deep red velvet and teal

ADD ROYAL ELEMENTS TO THE ${species.toUpperCase()}:
- Elegant pearl necklace with ruby or sapphire pendant around neck
- Perhaps a delicate gold chain or royal collar
- The ${species} should look regal and noble

PAINTING STYLE:
- Classical Flemish/Dutch Golden Age oil painting
- Rich brushstroke texture, visible impasto
- Museum masterpiece quality
- Warm, inviting, elegant atmosphere

CRITICAL - PRESERVE THE ${species.toUpperCase()}'S IDENTITY:
- Keep the ${species}'s exact face, markings, and colors
- The ${species} must be recognizable as the same animal
- Maintain the natural proportions

This is a ${detectedBreed || species}. Create a royal portrait with a LIGHT, BEAUTIFUL background.`;

        try {
          // Create a File object from the buffer for OpenAI API
          // Convert Buffer to Uint8Array for Blob compatibility
          const uint8Array = new Uint8Array(styleTransferBuffer);
          const imageBlob = new Blob([uint8Array], { type: "image/png" });
          const imageFile = new File([imageBlob], "style_transfer.png", { type: "image/png" });
          
          const refinementResponse = await openai.images.edit({
            model: "gpt-image-1",
            image: imageFile,
            prompt: enhancementPrompt,
            n: 1,
            size: "1024x1024",
          });
          
          const refinedData = refinementResponse.data?.[0];
          if (refinedData?.b64_json) {
            firstGeneratedBuffer = Buffer.from(refinedData.b64_json, "base64");
            console.log("✅ GPT refinement complete (Stage 2)");
          } else if (refinedData?.url) {
            const downloadResponse = await fetch(refinedData.url);
            if (!downloadResponse.ok) throw new Error(`Failed to download refined image: ${downloadResponse.status}`);
            firstGeneratedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
            console.log("✅ GPT refinement complete (Stage 2)");
          } else {
            console.log("⚠️ GPT refinement returned no data, using style transfer result");
            firstGeneratedBuffer = styleTransferBuffer;
          }
        } catch (gptError) {
          console.error("⚠️ GPT refinement failed, using style transfer result:", gptError);
          firstGeneratedBuffer = styleTransferBuffer;
        }
      } else {
        console.log("📌 GPT refinement disabled, using style transfer result only");
        firstGeneratedBuffer = styleTransferBuffer;
      }
    } else if (useIPAdapter) {
      // Use IP-Adapter for identity preservation
      console.log("🎨 Using IP-Adapter SDXL for identity-preserving generation...");
      console.log("📌 Pet identity extracted from reference image");
      console.log("📌 No fallback - if Replicate fails, generation fails");
      
      // IP-Adapter prompt focuses ONLY on style/scene - identity comes from reference image
      const ipAdapterPrompt = `A majestic royal late 18th-century European aristocratic oil painting portrait of a ${species}. Georgian/Regency/Napoleonic era style (1770-1830).

PAINTING STYLE:
Classical oil painting with visible brushstrokes, rich impasto texture, luminous glazing.
Late 18th-century technique like Gainsborough, Reynolds, or Vigée Le Brun (1770-1830 Georgian/Regency/Napoleonic era).
Museum-quality fine art, dramatic lighting, rich colors.

COMPOSITION:
Seated NATURALLY like a real ${species} on ${cushion} - NOT human-like pose.
With ${robe} DRAPED over its back - NOT clothing, just draped fabric. NO human clothing elements.
BRIGHT POLISHED SILVER CLOAK CLASP at upper chest SECURING THE CLOAK CLOSED - two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver that catches the light.
Adorned with ${jewelryItem}.
${background}.
${lighting}.
Full body portrait, natural animal seated pose, all four paws visible.

The ${species} should match the reference image exactly - same face, markings, colors, and expression. CRITICAL: ${species} must sit NATURALLY like a real ${species} - NOT human-like pose. NO human clothing - ONLY a cloak draped over with decorative clasp.`;

      // No fallback - if IP-Adapter fails, we fail
      firstGeneratedBuffer = await generateWithIPAdapter(
        base64Image,
        ipAdapterPrompt
      );
      
      console.log("✅ IP-Adapter generation complete");
    } else if (useFluxModel) {
      // Use FLUX for image-to-image generation
      console.log("🎨 Using FLUX img2img for pet accuracy...");
      console.log("📌 Pet identity will be preserved from original image");
      console.log("📌 No fallback - if Replicate fails, generation fails");
      
      // Use the same robust detection logic (petDescription already updated with "black" if needed)
      const petDescLowerForFlux = petDescription.toLowerCase();
      const isWhiteCatForFlux = species === "CAT" && (
        petDescLowerForFlux.includes("white") || 
        petDescLowerForFlux.includes("snow white") ||
        petDescLowerForFlux.includes("pure white")
      );
      
      // Check if GREY cat - CRITICAL: Grey cats often get turned white/cream
      const isGreyCatForFlux = species === "CAT" && (
        petDescLowerForFlux.includes("grey") ||
        petDescLowerForFlux.includes("gray") ||
        petDescLowerForFlux.includes("russian blue") ||
        petDescLowerForFlux.includes("chartreux") ||
        petDescLowerForFlux.includes("british shorthair") ||
        petDescLowerForFlux.includes("korat") ||
        petDescLowerForFlux.includes("nebelung") ||
        petDescLowerForFlux.includes("blue cat") ||
        petDescLowerForFlux.includes("silver") ||
        petDescLowerForFlux.includes("slate") ||
        petDescLowerForFlux.includes("ash") ||
        petDescLowerForFlux.includes("smoky") ||
        petDescLowerForFlux.includes("blue-grey") ||
        petDescLowerForFlux.includes("blue-gray")
      );
      
      // Check if black cat or dark-coated pet - use same logic as main detection
      const descSaysBlackForFlux = (
        petDescLowerForFlux.includes("black") ||
        petDescLowerForFlux.includes("ebony") ||
        petDescLowerForFlux.includes("jet black") ||
        petDescLowerForFlux.includes("coal black") ||
        petDescLowerForFlux.includes("charcoal") ||
        petDescLowerForFlux.includes("dark brown")
      );
      
      const isBlackCatForFlux = species === "CAT" && (
        descSaysBlackForFlux || 
        (imageDarkness.isDark && !petDescLowerForFlux.includes("white") && !petDescLowerForFlux.includes("light"))
      );
      
      const isDarkCoatedForFlux = (
        descSaysBlackForFlux ||
        (imageDarkness.isDark && !petDescLowerForFlux.includes("white") && !petDescLowerForFlux.includes("light"))
      ) && !petDescLowerForFlux.includes("white");
      
      const feminineAestheticForFlux = gender === "female" ? `
=== FEMININE AESTHETIC ===
FEMALE ${species} - feminine aesthetic:
- LIGHTER, SOFTER cloak colors - pastel pinks, lavenders, soft blues, pearl whites
- DELICATE fabrics - fine, refined, gentle textures
- FINER jewelry - more delicate, smaller gems, intricate filigree
- GENTLER visual tone - softer lighting, more graceful
` : "";

      const whiteCatTreatmentForFlux = isWhiteCatForFlux ? `
=== WHITE CAT - ANGELIC LUMINOUS ===
WHITE CAT - angelic luminous:
- ANGELIC appearance - ethereal, heavenly
- LUMINOUS glow enhancing white fur - soft radiant light
- SOFT GLOW around entire cat - gentle radiance
- Enhanced presence - cat GLOWS with light
` : "";

      const greyCatTreatmentForFlux = isGreyCatForFlux ? `
=== GREY CAT - CRITICAL COLOR PRESERVATION ===
GREY/GRAY CAT - CRITICAL: Preserve EXACT GREY fur color:
- Cat MUST remain GREY/GRAY - NEVER white, cream, beige, golden
- Preserve COOL GREY/BLUE-GREY tone exactly as reference
- This cat has GREY fur - NOT white, NOT cream, NOT golden
- Maintain COOL GREY/SILVER/SLATE tone throughout
- DO NOT warm up colors - keep COOL GREY tones
- DO NOT brighten to white/cream - maintain GREY
` : "";
      
      const blackCatTreatmentForFlux = isBlackCatForFlux || isDarkCoatedForFlux ? `
=== BLACK/DARK-COATED PET - CRITICAL COLOR PRESERVATION ===
${isBlackCatForFlux ? "BLACK CAT" : "DARK-COATED PET"} - CRITICAL: Preserve DEEP BLACK/DARK color:
- Pet MUST remain DEEP BLACK or DARK BROWN - NEVER white, gray, or light
- Preserve RICH DEEP BLACK fur - maintain dark tones
- SUBTLE highlights ONLY - don't wash out black
- AVOID over-brightening - keep natural dark color
- Black/dark color is ESSENTIAL - preserve exactly
- DO NOT lighten fur - keep DEEP RICH BLACK/DARK
` : "";

      const fluxPrompt = `18th-century aristocratic oil portrait. Late 18th-century European aristocratic portraiture (1770-1830 Georgian/Regency/Napoleonic era). Style of Gainsborough, Reynolds, Vigée Le Brun. NOT Renaissance.${feminineAestheticForFlux}${whiteCatTreatmentForFlux}${greyCatTreatmentForFlux}${blackCatTreatmentForFlux}

=== LIGHTING (EXTREMELY BRIGHT - Well-Illuminated) ===
- EXTREMELY BRIGHT KEY LIGHT illuminating the subject - BRILLIANTLY LIT
- STRONG BRILLIANT HIGHLIGHTS on the FACE and fur - INTENSELY ILLUMINATED
- MINIMAL SHADOWS - use fill light to eliminate dark areas
- Subject should GLOW with BRIGHT RADIANT light - NEVER dark or moody
- BRIGHT warm highlights throughout - LUMINOUS and CHEERFUL
- LIGHT, BRIGHT, and AIRY atmosphere - NOT gloomy, NOT dark, NOT heavy
- Subject is the BRIGHTEST element - clearly visible and RADIANT
- Professional BRIGHT portrait lighting - cheerful and uplifting
- ABSOLUTELY NO dark moody lighting - this should feel BRIGHT and HAPPY

=== AUTOMATIC COLOR HARMONY (VARIED - Different Every Time) ===
RANDOMIZE background colors each generation - USE A DIFFERENT COLOR EACH TIME:
- COOL TONES: Powder blue, sky blue, teal, sapphire, navy, periwinkle, slate blue
- WARM TONES: Soft pink, dusty rose, peach, coral, champagne, warm cream
- NEUTRALS: Charcoal black, soft grey, silver grey, warm ivory, pure white, cream
- GREENS: Emerald, sage, mint, forest green, olive, hunter green
- PURPLES: Soft lavender, lilac, dusty purple, mauve, plum
- MIX IT UP: Each portrait should have a DIFFERENT background color - avoid repetition
- CREATE CONTRAST: Choose colors that make the pet POP and stand out
- AVOID: Brown, tan, beige, sepia, muddy tones

=== COMPOSITION (Wide, Centered, Full Cushion) ===
- WIDE and CENTERED composition showing FULL CUSHION
- Pet seated NATURALLY like a real ${species} on embroidered throne cushion with VISIBLE GOLD TASSELS
- Natural animal seated pose - NOT human-like posture
- Body ¾ view, FRONT PAWS VISIBLE resting naturally on cushion
- DAINTY, DELICATE regal CLOAK DRAPED over BOTH pet AND cushion - NOT clothing, just draped fabric
- More DAINTY and REFINED - not heavy or bulky
- NO human clothing - NO sleeves, NO buttons, NO tailored garments
- SOFT, PLUSH VELVETY texture - luxurious velvet with visible nap and plush feel
- VELVETY appearance - soft, plush, luxurious velvet fabric
- BRIGHT ANTIQUE GOLD EMBROIDERY - delicate and refined
- DEEP, RICH, SATURATED fabric colors
- WHITE FUR TRIM with BLACK ERMINE SPOTS
- Pet's natural body visible beneath draped cloak
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest SECURING THE CLOAK TOGETHER
- Two GLEAMING SHINY silver plates connected by BRIGHT silver chain - HIGHLY REFLECTIVE finish that catches the light brilliantly

=== JEWELRY (Antique 18th-Century) ===
- Layered MULTI-CHAIN gold necklaces, ornate FILIGREE
- BRIGHT WHITE PEARLS and small CLUSTERED BRIGHT GEMSTONES
- BRIGHT SPARKLING gems complement pet's natural colors

=== BACKGROUND (HIGHLY VARIED - Different Every Time) ===
- Heavy SILKY velvet drapery with PAINTERLY FOLDS
- VARY THE BACKGROUND COLOR - pick ONE at random each time:
  * BLACKS/DARKS: Rich charcoal, deep black, dark slate (dramatic contrast)
  * WHITES/LIGHTS: Pure white, soft cream, ivory, champagne (bright, airy)
  * GREYS: Silver grey, warm grey, slate grey, dove grey
  * BLUES: Powder blue, sky blue, navy, teal, sapphire, periwinkle
  * PINKS: Soft pink, dusty rose, blush, coral, peach
  * GREENS: Emerald, sage, mint, forest, olive
  * PURPLES: Lavender, lilac, mauve, dusty purple
- IMPORTANT: Use a DIFFERENT color each generation - maximize variety
- CREATE STRONG CONTRAST with the pet's fur color
- AVOID: Brown, tan, beige, sepia - keep it fresh and interesting

=== RENDERING (Old-Master Realism with Glow - BRIGHT) ===
- VISIBLE BRUSHSTROKES, TEXTURED OIL PAINT, CANVAS GRAIN
- MUSEUM-QUALITY rendering
- LONG FLOWING brush strokes
- Hand-painted charm with slight imperfections
- NOT digital, NOT airbrushed, NOT too perfect
- LUMINOUS GLOW throughout - BRIGHT and RADIANT
- SILKY LUSTROUS textures on fabrics - visible sheen
- VIBRANT, SATURATED colors throughout - rich jewel tones that POP
- BRIGHT overall atmosphere - NOT dark, NOT gloomy, NOT moody
- Subject GLOWS with BRIGHT warm light, fabrics GLOW with VIBRANT color
- CHEERFUL and UPLIFTING mood - like a sunlit portrait

=== PRESERVE FROM ORIGINAL ===
- Exact facial features, all markings, eye color, expression
- Warm natural fur with painterly highlights
- Deep black fur rich and saturated

CRITICAL: ${species} must sit NATURALLY like a real ${species} - NOT human-like pose. NO human clothing - ONLY a cloak draped over. Keep ${species} EXACTLY as shown. Only add 18th-century aristocratic styling with draped cloak.`;

      // No fallback - if FLUX fails, we fail
      firstGeneratedBuffer = await generateWithFlux(
        base64Image,
        fluxPrompt
      );
      
      console.log("✅ FLUX generation complete");
    } else {
      // Use GPT-Image-1 (original approach)
      console.log("🎨 Using GPT-Image-1 for generation...");
      
      const imageResponse = await openai.images.generate({
        model: "gpt-image-1",
        prompt: generationPrompt,
        n: 1,
        size: "1024x1024",
        quality: "high",
      });

      const imageData = imageResponse.data?.[0];

      if (!imageData) {
        throw new Error("No image generated");
      }

      // Handle both base64 (gpt-image-1) and URL (dall-e-3) responses
      if (imageData.b64_json) {
        console.log("Processing base64 image from gpt-image-1...");
        firstGeneratedBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        console.log("Downloading image from URL...");
        const downloadResponse = await fetch(imageData.url);
        if (!downloadResponse.ok) {
          throw new Error(`Failed to download image: ${downloadResponse.status}`);
        }
        const arrayBuffer = await downloadResponse.arrayBuffer();
        firstGeneratedBuffer = Buffer.from(arrayBuffer);
      } else {
        throw new Error("No image data in response");
      }
    }
    } // Close the single-pet else block
    
    console.log("✅ Stage 1 complete: First portrait generated");
    
    // STAGE 2: Compare and refine (disabled by default for faster generations)
    // Set ENABLE_TWO_STAGE_GENERATION=true to enable refinement pass
    const enableTwoStage = process.env.ENABLE_TWO_STAGE_GENERATION === "true"; // Default: disabled for speed
    let finalGeneratedBuffer: Buffer = firstGeneratedBuffer; // Fallback to first if refinement fails
    let refinementUsed = false;
    
    if (enableTwoStage) {
      try {
        console.log("=== Starting Stage 2: Comparison and Refinement ===");
        const refinementPrompt = await compareAndRefine(
          openai,
          buffer, // Original pet photo
          firstGeneratedBuffer, // First generated portrait
          petDescription,
          species
        );
      
      if (refinementPrompt && refinementPrompt.length > 100) {
        console.log("Refinement prompt received, generating refined portrait...");
        
        // Create refined generation prompt combining original prompt with corrections
        // Truncate refinement prompt if too long (API limits)
        const maxRefinementLength = 2000;
        const truncatedRefinement = refinementPrompt.length > maxRefinementLength 
          ? refinementPrompt.substring(0, maxRefinementLength) + "..."
          : refinementPrompt;
        
        const refinedGenerationPrompt = `${generationPrompt}

=== REFINEMENT STAGE - CRITICAL CORRECTIONS FROM COMPARISON ===
This is a SECOND PASS refinement. The first generation was compared with the original pet photo, and these specific corrections were identified:

${truncatedRefinement}

CRITICAL: The refined portrait MUST address EVERY correction listed above. This is your opportunity to fix all discrepancies and create a portrait that matches the original pet photo EXACTLY. Pay special attention to:
- Markings and their exact locations
- Color accuracy
- Face proportions
- Expression and unique features

Generate a refined portrait that addresses ALL corrections and matches the original pet photo with exceptional accuracy.`;
        
        // Generate refined image
        const refinedImageResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: refinedGenerationPrompt,
          n: 1,
          size: "1024x1024",
          quality: "high",
        });
        
        const refinedImageData = refinedImageResponse.data?.[0];
        
        if (refinedImageData) {
          if (refinedImageData.b64_json) {
            finalGeneratedBuffer = Buffer.from(refinedImageData.b64_json, "base64");
            refinementUsed = true;
            console.log("✅ Stage 2 complete: Refined portrait generated");
          } else if (refinedImageData.url) {
            const downloadResponse = await fetch(refinedImageData.url);
            if (downloadResponse.ok) {
              const arrayBuffer = await downloadResponse.arrayBuffer();
              finalGeneratedBuffer = Buffer.from(arrayBuffer);
              refinementUsed = true;
              console.log("✅ Stage 2 complete: Refined portrait downloaded");
            }
          }
        }
        } else {
          console.log("⚠️ Refinement prompt too short or empty, using first generation");
        }
      } catch (refinementError) {
        console.error("⚠️ Refinement stage failed, using first generation:", refinementError);
        // Continue with first generation as fallback
      }
    } else {
      console.log("Two-stage generation disabled, using first generation only");
    }
    
    // Use the final buffer (refined if available, otherwise first)
    let generatedBuffer = finalGeneratedBuffer;
    console.log(`Using ${refinementUsed ? "refined" : "first"} generation for final output`);

    // Enhance image (brighten + sharpen) - disabled by default, enable with ENABLE_ENHANCE=true
    const enableEnhance = process.env.ENABLE_ENHANCE === "true"; // Default to false
    
    if (enableEnhance) {
      console.log("=== ENHANCEMENT ENABLED (via env) ===");
      try {
        generatedBuffer = await enhanceImage(generatedBuffer);
        console.log("✅ Image enhanced successfully (brighter + sharper)");
      } catch (enhanceError) {
        console.error("Enhancement failed, using original:", enhanceError);
      }
    } else {
      console.log("Enhancement disabled (default - enable with ENABLE_ENHANCE=true)");
    }

    // Upscale image for higher resolution - enabled by default, disable with ENABLE_UPSCALE=false
    const enableUpscale = process.env.ENABLE_UPSCALE !== "false"; // Default to true
    const upscaleScale = parseInt(process.env.UPSCALE_SCALE || "2"); // 2x or 4x
    
    if (enableUpscale) {
      console.log("=== UPSCALE ENABLED (default) ===");
      console.log(`Upscaling by ${upscaleScale}x...`);
      try {
        generatedBuffer = await upscaleImage(generatedBuffer, upscaleScale);
        console.log("✅ Image upscaled successfully");
      } catch (upscaleError) {
        console.error("Upscale failed, using original resolution:", upscaleError);
        // Continue with original buffer
      }
    } else {
      console.log("Upscale disabled (ENABLE_UPSCALE=false)");
    }

    // For Rainbow Bridge, select a quote (text overlay is rendered client-side for reliable font support)
    let selectedQuote: string | null = null;
    
    console.log(`🌈 Rainbow Bridge check: isRainbowBridge=${isRainbowBridge}, petName="${petName}", style="${style}"`);
    if (isRainbowBridge) {
      // Select a random quote to send to client for Canvas rendering
      selectedQuote = RAINBOW_BRIDGE_QUOTES[Math.floor(Math.random() * RAINBOW_BRIDGE_QUOTES.length)];
      console.log(`🌈 Rainbow Bridge portrait - quote selected: "${selectedQuote}"`);
      console.log(`   Pet name: "${petName}" (text overlay will be rendered by client and uploaded)`);
    }

    // Create preview (watermarked for free and pack credits, un-watermarked only for secret credit testing)
    // NOTE: The generation model used above is IDENTICAL for all types (free, pack credit, secret credit).
    // The $5 pack gives watermarked generations - only secret credit is un-watermarked (for testing).
    let previewBuffer: Buffer;
    if (useSecretCredit) {
      // Un-watermarked preview ONLY for secret credit (testing)
      previewBuffer = generatedBuffer;
      console.log("Using secret credit - generating un-watermarked image for testing");
    } else {
      // Watermarked preview for free generations AND pack credits ($5 pack = watermarked)
      previewBuffer = await createWatermarkedImage(generatedBuffer);
      if (usePackCredit) {
        console.log("Using pack credit ($5 pack) - creating watermarked preview");
      } else {
        console.log("Free generation - creating watermarked preview");
      }
    }

    // Upload HD image to Supabase Storage (always un-watermarked, without text)
    // Note: For Rainbow Bridge, the client will upload the text-overlay version separately
    console.log(`📤 Uploading HD image to pet-portraits bucket: ${imageId}-hd.png${isRainbowBridge ? ' (Rainbow Bridge)' : ''}`);
    const hdUrl = await uploadImage(
      generatedBuffer,
      `${imageId}-hd.png`,
      "image/png"
    );
    console.log(`✅ HD image uploaded successfully: ${hdUrl.substring(0, 80)}...`);

    // Upload preview to Supabase Storage (without text)
    console.log(`📤 Uploading preview image to pet-portraits bucket: ${imageId}-preview.png${isRainbowBridge ? ' (Rainbow Bridge)' : ''}`);
    const previewUrl = await uploadImage(
      previewBuffer,
      `${imageId}-preview.png`,
      "image/png"
    );
    console.log(`✅ Preview image uploaded successfully: ${previewUrl.substring(0, 80)}...`);

    // Validate URLs before saving
    try {
      new URL(hdUrl);
      new URL(previewUrl);
    } catch (urlError) {
      console.error("Invalid URL format:", urlError);
      throw new Error("Failed to generate valid image URLs");
    }

    // Validate imageId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(imageId)) {
      throw new Error(`Invalid imageId format: ${imageId}`);
    }

    // Save metadata to Supabase database
    // Truncate pet_description if too long (some databases have length limits)
    const maxDescriptionLength = 2000; // Safe limit
    const truncatedDescription = petDescription.length > maxDescriptionLength 
      ? petDescription.substring(0, maxDescriptionLength) 
      : petDescription;
    
    // Additional sanitization: remove any remaining problematic characters
    const finalDescription = truncatedDescription
      .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '') // Keep Latin characters and common punctuation
      .replace(/['"]/g, "'") // Normalize quotes
      .trim();
    
    try {
      // Validate each field individually to identify which one fails
      console.log("Saving metadata with:", {
        imageId,
        imageIdValid: uuidRegex.test(imageId),
        descriptionLength: finalDescription.length,
        hdUrlLength: hdUrl.length,
        previewUrlLength: previewUrl.length,
        hdUrl: hdUrl.substring(0, 50) + "...",
        previewUrl: previewUrl.substring(0, 50) + "...",
        descriptionPreview: finalDescription.substring(0, 100),
      });
      
    await saveMetadata(imageId, {
      created_at: new Date().toISOString(),
        paid: useSecretCredit, // Mark as paid only if using secret credit (testing) - pack credits are watermarked
        pet_description: finalDescription,
      hd_url: hdUrl,
      preview_url: previewUrl,
        // Note: style, pet_name, and quote fields not in portraits table schema yet
        // Rainbow Bridge metadata: style="rainbow-bridge", pet_name, quote (stored in pet_description for now)
        // Note: pack_generation not tracked in DB - pack credits just give watermarked generations
        // Note: secret_generation not saved to DB (testing feature only)
      });
    
    // Log Rainbow Bridge metadata (for development/debugging)
    if (isRainbowBridge) {
      console.log("🌈 Rainbow Bridge metadata:", {
        pet_name: petName || "N/A",
        quote: selectedQuote || "N/A",
        style: "rainbow-bridge"
      });
    }
      
      if (refinementUsed) {
        console.log("✅ Two-stage generation completed successfully - refined portrait used");
      } else if (enableTwoStage) {
        console.log("ℹ️ Two-stage generation attempted but refinement not used - first generation used");
      }
      console.log("Metadata saved successfully");
      
      // Increment global portrait counter
      const newCount = await incrementPortraitCount();
      console.log(`Portrait count incremented to: ${newCount}`);
    } catch (metadataError) {
      console.error("Metadata save error:", metadataError);
      const errorMsg = metadataError instanceof Error ? metadataError.message : String(metadataError);
      console.error("Full error:", errorMsg);
      console.error("Error details:", JSON.stringify(metadataError, null, 2));
      
      // Always throw pattern validation errors - don't silently continue
      if (errorMsg.includes("pattern") || errorMsg.includes("String did not match") || errorMsg.includes("validation")) {
        throw new Error(`Database validation failed. Please try with a different image or contact support if the issue persists. Error: ${errorMsg}`);
      }
      
      // For other errors, throw as well so user knows something went wrong
      throw new Error(`Failed to save portrait metadata: ${errorMsg}`);
    }

    // Return watermarked preview - HD version only available after purchase
    // For Rainbow Bridge, also return quote and petName (client renders text overlay and uploads to Supabase)
    return NextResponse.json({
      imageId,
      previewUrl: previewUrl, // Watermarked version for preview (without text)
      ...(isRainbowBridge ? { 
        quote: selectedQuote,
        petName: petName,
        isRainbowBridge: true,
      } : {}),
    });
  } catch (error) {
    console.error("Generation error:", error);

    // Get detailed error message
    let errorMessage = "Failed to generate portrait. Please try again.";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("Error details:", error.stack);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
