import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "@/lib/config";
import { uploadImage, saveMetadata, incrementPortraitCount, supabase } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { validateImageMagicBytes } from "@/lib/validation";
import { createWatermarkedImage } from "@/lib/watermark";
import { HUMAN_PORTRAIT_LOCATIONS, getRandomHumanPortraitLocation } from "@/lib/apps/human-portrait";

// Upscale image using Real-ESRGAN for higher resolution
async function upscaleImage(inputBuffer: Buffer, scale: number = 2, maxRetries: number = 3): Promise<Buffer> {
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
  
  // If image is very large, resize it first to avoid API issues (max 2048px on longest side)
  let processBuffer = inputBuffer;
  const maxInputSize = 2048;
  if (originalWidth > maxInputSize || originalHeight > maxInputSize) {
    console.log(`Image too large (${originalWidth}x${originalHeight}), resizing to max ${maxInputSize}px before upscale...`);
    processBuffer = await sharp(inputBuffer)
      .resize(maxInputSize, maxInputSize, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const resizedMeta = await sharp(processBuffer).metadata();
    console.log(`Resized to ${resizedMeta.width}x${resizedMeta.height} for upscaling`);
  }
  
  // Convert buffer to base64 data URL
  const processMetadata = await sharp(processBuffer).metadata();
  const base64Image = processBuffer.toString("base64");
  const mimeType = processMetadata.format === "png" ? "image/png" : "image/jpeg";
  const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upscale attempt ${attempt}/${maxRetries}...`);
      
      // Use Real-ESRGAN for high-quality upscaling with face enhancement
      console.log("Running Real-ESRGAN upscaler with face enhancement...");
      const startTime = Date.now();
      
      const output = await replicate.run(
        "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
        {
          input: {
            image: imageDataUrl,
            scale: scale,
            face_enhance: true, // Enable face enhancement for human portraits
          }
        }
      );
      
      const elapsedTime = Date.now() - startTime;
      console.log(`Upscale API completed in ${elapsedTime}ms`);
      
      // Handle output - could be string URL or FileOutput object
      let upscaledBuffer: Buffer;
      let downloadUrl: string | null = null;
      
      if (typeof output === "string") {
        downloadUrl = output;
      } else if (output && typeof output === "object") {
        const outputObj = output as { url?: () => string } | string;
        
        if (typeof outputObj === "string") {
          downloadUrl = outputObj;
        } else if ("url" in outputObj && typeof outputObj.url === "function") {
          downloadUrl = outputObj.url();
        } else {
          downloadUrl = String(output);
        }
      }
      
      if (!downloadUrl) {
        throw new Error("No download URL received from upscaler");
      }
      
      console.log("Downloading upscaled image...");
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Failed to download upscaled image: ${response.status}`);
      upscaledBuffer = Buffer.from(await response.arrayBuffer());
      
      // Validate upscaled image
      const newMetadata = await sharp(upscaledBuffer).metadata();
      const newWidth = newMetadata.width || 0;
      const newHeight = newMetadata.height || 0;
      
      console.log(`Upscaled dimensions: ${newWidth}x${newHeight}`);
      console.log(`Upscaled buffer size: ${upscaledBuffer.length} bytes`);
      
      // Verify the image was actually upscaled
      const inputWidth = processMetadata.width || 1024;
      const inputHeight = processMetadata.height || 1024;
      const expectedMinWidth = inputWidth * scale * 0.9;
      const expectedMinHeight = inputHeight * scale * 0.9;
      
      if (newWidth < expectedMinWidth || newHeight < expectedMinHeight) {
        console.warn(`⚠️ Upscaled image smaller than expected! Got ${newWidth}x${newHeight}, expected at least ${Math.round(expectedMinWidth)}x${Math.round(expectedMinHeight)}`);
        throw new Error(`Upscaled image dimensions too small: ${newWidth}x${newHeight}`);
      }
      
      console.log(`✅ Upscale successful on attempt ${attempt}! Final size: ${newWidth}x${newHeight}`);
      return upscaledBuffer;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Upscale attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed - use sharp to upscale as fallback
  console.error(`❌ All ${maxRetries} upscale attempts failed. Using sharp fallback upscale.`);
  console.error(`Last error: ${lastError?.message}`);
  
  try {
    const targetWidth = originalWidth * scale;
    const targetHeight = originalHeight * scale;
    console.log(`Fallback: Using sharp to upscale to ${targetWidth}x${targetHeight}...`);
    
    const fallbackBuffer = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, { 
        kernel: 'lanczos3',
        fit: 'fill'
      })
      .sharpen({ sigma: 0.5 })
      .png()
      .toBuffer();
    
    const fallbackMeta = await sharp(fallbackBuffer).metadata();
    console.log(`✅ Fallback upscale complete: ${fallbackMeta.width}x${fallbackMeta.height}`);
    return fallbackBuffer;
  } catch (fallbackError) {
    console.error("Fallback upscale also failed:", fallbackError);
    return inputBuffer;
  }
}

// Portrait style palettes for human portraits
const PORTRAIT_STYLES = [
  {
    name: "ROYAL GOLD",
    background: "deep burgundy velvet backdrop with subtle gold accents",
    mood: "regal, majestic, commanding",
    colors: "rich burgundy, antique gold, ruby highlights",
    lighting: "warm golden candlelight from the side"
  },
  {
    name: "VENETIAN RENAISSANCE",
    background: "warm terracotta and cream tones, soft atmospheric perspective",
    mood: "romantic, painterly, timeless",
    colors: "warm ivory, sienna, muted emerald, antique gold",
    lighting: "soft diffused daylight, Venetian master style"
  },
  {
    name: "DUTCH GOLDEN AGE",
    background: "deep brown with subtle warm undertones, Rembrandt style",
    mood: "intimate, dignified, psychological depth",
    colors: "rich browns, warm blacks, creamy whites, golden highlights",
    lighting: "dramatic chiaroscuro, single light source"
  },
  {
    name: "ELEGANT IVORY",
    background: "pure ivory white with soft cream undertones",
    mood: "clean, sophisticated, timeless",
    colors: "ivory, champagne, soft rose gold, pearl",
    lighting: "bright diffused natural light"
  },
  {
    name: "ARISTOCRATIC BLUE",
    background: "deep midnight blue with subtle gold accents",
    mood: "refined, distinguished, noble",
    colors: "deep sapphire, navy, burnished gold, silver",
    lighting: "cool moonlight mixed with warm candlelight"
  },
  {
    name: "GARDEN ROMANTIC",
    background: "soft green gardens with distant pastoral landscape",
    mood: "romantic, pastoral, serene",
    colors: "sage green, cream, dusty rose, antique gold",
    lighting: "soft golden hour sunlight"
  },
  {
    name: "BAROQUE OPULENCE",
    background: "gilded palace interior with crystal chandeliers",
    mood: "grand, theatrical, magnificent",
    colors: "deep crimson, burnished gold, ivory, ebony",
    lighting: "dramatic golden light from multiple candelabras"
  },
  {
    name: "ENGLISH COUNTRY",
    background: "library interior with leather-bound books and hunting art",
    mood: "distinguished, scholarly, refined",
    colors: "forest green, burgundy leather, aged gold, oak brown",
    lighting: "warm firelight mixed with afternoon sun"
  },
];

// Get a random style
function getRandomStyle(): typeof PORTRAIT_STYLES[0] {
  return PORTRAIT_STYLES[Math.floor(Math.random() * PORTRAIT_STYLES.length)];
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  console.log("=== Human Portrait API called ===");
  console.log("Client IP:", clientIP);
  
  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("Failed to parse form data:", e);
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }
  
  // Rate limiting
  const rateLimit = checkRateLimit(`generate-human:${clientIP}`, RATE_LIMITS.generate);
  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 }
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

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const imageFile = formData.get("image") as File | null;
    const enableWatermark = formData.get("enableWatermark") !== "false";

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

    // Validate file size
    if (imageFile.size > CONFIG.MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Validate image
    const isValidImage = await validateImageMagicBytes(bytes);
    if (!isValidImage) {
      return NextResponse.json(
        { error: "Invalid image file. Please upload a valid JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    const imageId = uuidv4();

    // Skip vision analysis - just send image directly to gpt-image-1.5 (like ChatGPT does)
    console.log("🎨 Skipping vision analysis - direct image generation like ChatGPT...");

    // Generate with GPT-image-1.5 (simple prompt, no analysis)
    const generationPrompt = `Turn this photo into a beautiful classical oil painting portrait in the style of the Old Masters.`;

    console.log("Generating human portrait with GPT-image-1.5...");
    const generationStartTime = Date.now();

    // Use original image directly for best quality
    const uint8Array = new Uint8Array(buffer);
    const imageBlob = new Blob([uint8Array], { type: imageFile.type });
    const imageFileForOpenAI = new File([imageBlob], `photo.${imageFile.type.split('/')[1] || 'jpg'}`, { type: imageFile.type });

    // Generate with gpt-image-1.5
    const imageResponse = await openai.images.edit({
      model: "gpt-image-1.5" as "gpt-image-1" | "dall-e-2",
      image: imageFileForOpenAI,
      prompt: generationPrompt,
      n: 1,
      quality: "high",
    });

    const imageData = imageResponse.data?.[0];

    if (!imageData) {
      throw new Error("No image generated");
    }

    let generatedBuffer: Buffer;
    if (imageData.b64_json) {
      generatedBuffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download generated image: ${downloadResponse.status}`);
      }
      const arrayBuffer = await downloadResponse.arrayBuffer();
      generatedBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error("No image data in response");
    }

    console.log(`Image generation took ${Date.now() - generationStartTime}ms`);

    // Upscale image for higher resolution - enabled by default
    const enableUpscale = process.env.ENABLE_UPSCALE !== "false";
    const upscaleScale = parseInt(process.env.UPSCALE_SCALE || "2");
    
    if (enableUpscale) {
      console.log("=== UPSCALE ENABLED ===");
      console.log(`Upscaling by ${upscaleScale}x with face enhancement...`);
      try {
        generatedBuffer = await upscaleImage(generatedBuffer, upscaleScale);
        console.log("✅ Image upscaled successfully with face enhancement");
      } catch (upscaleError) {
        console.error("Upscale failed, using original resolution:", upscaleError);
      }
    } else {
      console.log("Upscale disabled (ENABLE_UPSCALE=false)");
    }

    // Process and optimize the generated image
    const upscaledMeta = await sharp(generatedBuffer).metadata();
    const finalSize = upscaledMeta.width || 2048;
    
    const finalImage = await sharp(generatedBuffer)
      .resize(finalSize, finalSize, { fit: "inside", withoutEnlargement: true })
      .png({ quality: 95, compressionLevel: 6 })
      .toBuffer();

    // Create watermarked preview if enabled
    let previewBuffer: Buffer;
    if (enableWatermark) {
      previewBuffer = await createWatermarkedImage(finalImage);
      console.log("Created watermarked preview");
    } else {
      previewBuffer = finalImage;
    }

    // Upload to storage
    console.log("Uploading to Supabase storage...");
    
    const [hdUrl, previewUrl] = await Promise.all([
      uploadImage(finalImage, `${imageId}-hd.png`, "image/png"),
      uploadImage(previewBuffer, `${imageId}-preview.png`, "image/png"),
    ]);

    if (!hdUrl || !previewUrl) {
      throw new Error("Failed to upload images to storage");
    }

    console.log("✅ Images uploaded successfully:");
    console.log("  HD URL:", hdUrl);
    console.log("  Preview URL:", previewUrl);
    
    // Verify files exist and are accessible
    try {
      const { data: files, error: listError } = await supabase.storage
        .from("Generations")
        .list("", {
          search: imageId,
        });
      
      if (listError) {
        console.warn("⚠️ Could not verify files exist:", listError);
      } else {
        console.log(`✅ Verified ${files?.length || 0} files with ID ${imageId}`);
      }
    } catch (verifyErr) {
      console.warn("⚠️ File verification error:", verifyErr);
    }
    
    // Delay to ensure Supabase storage URLs are accessible (CDN propagation)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Save metadata (optional - don't fail if table doesn't exist)
    try {
      await saveMetadata(imageId, {
        app: "human-portrait",
        style: "classical",
        location: "studio",
        hdUrl,
        previewUrl,
        createdAt: new Date().toISOString(),
      });
    } catch (metadataError) {
      console.warn("Failed to save metadata (table may not exist):", metadataError);
    }

    // Increment portrait count (optional)
    try {
      await incrementPortraitCount();
    } catch (countError) {
      console.warn("Failed to increment portrait count:", countError);
    }

    console.log("=== Human Portrait Generation Complete ===");
    console.log(`Image ID: ${imageId}`);

    return NextResponse.json({
      success: true,
      imageId,
      previewUrl,
      hdUrl,
      style: "classical",
      location: "studio",
    });

  } catch (error) {
    console.error("Human Portrait generation error:", error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes("content_policy")) {
        return NextResponse.json(
          { error: "The image couldn't be processed. Please try a different photo." },
          { status: 400 }
        );
      }
      if (error.message.includes("rate_limit")) {
        return NextResponse.json(
          { error: "Service is busy. Please try again in a moment." },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to generate portrait. Please try again." },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minutes for Vercel

