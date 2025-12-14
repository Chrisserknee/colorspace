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
      
      // Use Real-ESRGAN for high-quality upscaling
      console.log("Running Real-ESRGAN upscaler...");
      const startTime = Date.now();
      
      const output = await replicate.run(
        "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
        {
          input: {
            image: imageDataUrl,
            scale: scale,
            face_enhance: false,
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

// Vintage book cover themes for child portraits
const CHILD_ART_PALETTES = [
  {
    name: "THE SECRET GARDEN",
    background: "an overgrown garden gate with climbing roses and hidden pathways",
    mood: "mysterious, enchanting",
    colors: "muted greens, dusty rose, aged cream, antique gold"
  },
  {
    name: "TREASURE ISLAND",
    background: "a rocky coastline with a distant ship and treasure map elements",
    mood: "adventurous, bold",
    colors: "sepia tones, ocean teal, weathered parchment, brass gold"
  },
  {
    name: "THE ENCHANTED WOOD",
    background: "a moonlit forest with ancient twisted trees and fireflies",
    mood: "magical, whimsical",
    colors: "deep forest green, silver moonlight, warm amber, soft cream"
  },
  {
    name: "VOYAGE TO THE STARS",
    background: "a telescope pointing at a starry sky with constellations",
    mood: "dreamy, wonder-filled",
    colors: "midnight blue, warm gold stars, dusty purple, ivory"
  },
  {
    name: "THE LITTLE EXPLORER",
    background: "rolling hills with a winding path leading to distant mountains",
    mood: "hopeful, adventurous",
    colors: "sage green, warm terracotta, sky blue, antique white"
  },
  {
    name: "TALES OF THE SEA",
    background: "gentle waves with seashells and a lighthouse in the distance",
    mood: "peaceful, nostalgic",
    colors: "soft ocean blue, sandy beige, coral pink, weathered white"
  },
];

// Get a random palette
function getRandomPalette(): typeof CHILD_ART_PALETTES[0] {
  return CHILD_ART_PALETTES[Math.floor(Math.random() * CHILD_ART_PALETTES.length)];
}

// Expression styles for children
const EXPRESSION_STYLES = [
  { name: "JOYFUL", description: "bright-eyed, genuine smile, radiating happiness" },
  { name: "CURIOUS", description: "wonder-filled eyes, gentle curiosity, thoughtful expression" },
  { name: "PLAYFUL", description: "mischievous grin, playful energy, sparkling eyes" },
  { name: "DREAMY", description: "soft gaze, peaceful expression, imaginative look" },
  { name: "CHEERFUL", description: "warm smile, friendly expression, welcoming demeanor" },
];

function getRandomExpression(): typeof EXPRESSION_STYLES[0] {
  return EXPRESSION_STYLES[Math.floor(Math.random() * EXPRESSION_STYLES.length)];
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "unknown";
  const clientIP = getClientIP(request);
  
  console.log("=== Child Art Portrait API called ===");
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
  const rateLimit = checkRateLimit(`generate-child:${clientIP}`, RATE_LIMITS.generate);
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
    const gender = (formData.get("gender") as string) || "child"; // "boy", "girl", or "child"

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

    // Process image for vision API
    const processedImage = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64Image = processedImage.toString("base64");

    // Step 1: Analyze the child's photo with GPT-4o
    console.log("🎨 Analyzing child's photo with GPT-4o...");
    const visionStartTime = Date.now();
    
    const genderContext = gender === "boy" ? "boy" : gender === "girl" ? "girl" : "child";
    
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an artist's assistant helping to create a whimsical storybook illustration. Your job is to describe the physical appearance of the ${genderContext} in the photo so an artist can create a beautiful illustrated portrait that captures their unique look. This is for a loving family keepsake - parents want an artistic illustration of their ${genderContext}. Focus purely on observable physical characteristics for artistic reference.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Please describe this ${genderContext}'s physical appearance for an illustrator to create a storybook-style portrait. I need specific details to ensure the illustration captures their unique look:

HAIR:
- Exact color (e.g., "golden blonde", "dark brown with auburn highlights", "jet black")
- Texture (straight, wavy, curly, coily)
- Length and style (short, shoulder-length, in pigtails, etc.)
- Any hair accessories visible

FACE SHAPE & SKIN:
- Face shape (round, oval, heart-shaped)
- Skin tone (fair, light, medium, olive, tan, brown, deep brown)
- Any distinctive features (freckles, dimples, birthmarks)

EYES:
- Color (be specific: "bright blue", "hazel with green flecks", "dark brown")
- Shape (round, almond, etc.)

NOSE & MOUTH:
- General nose shape
- Lip shape and expression

APPROXIMATE AGE RANGE:
- Toddler (1-3), young child (4-7), or older child (8-12)

CURRENT EXPRESSION:
- What emotion or mood do they appear to be showing?

Provide these details as a flowing description an artist would use. Be specific about colors and features so the illustration will be recognizable as THIS specific child.`,
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
      max_tokens: 800,
      temperature: 0.2,
    });

    let childDescription = visionResponse.choices[0]?.message?.content || "";
    console.log(`Vision analysis took ${Date.now() - visionStartTime}ms`);
    console.log("Child description:", childDescription.substring(0, 300));
    
    // Check if the model refused to analyze
    if (childDescription.toLowerCase().includes("i'm sorry") || 
        childDescription.toLowerCase().includes("i cannot") ||
        childDescription.toLowerCase().includes("can't analyze") ||
        childDescription.length < 50) {
      console.log("⚠️ Vision model refused or gave short response, using fallback prompt...");
      
      // Try a simpler, more direct approach
      const fallbackResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `I'm an artist creating a portrait commission. Please describe the visible physical characteristics in this reference photo:
- Hair: color, length, style, texture
- Eyes: color
- Skin tone
- Face shape
- Age range (young child, older child)
- Expression

Just list the observable features, nothing else.`,
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
        max_tokens: 400,
        temperature: 0.1,
      });
      
      childDescription = fallbackResponse.choices[0]?.message?.content || "a young child with a warm smile";
      console.log("Fallback description:", childDescription.substring(0, 200));
    }

    // Step 2: Select random style elements
    const palette = getRandomPalette();
    const expression = getRandomExpression();
    
    console.log(`Selected palette: ${palette.name}`);
    console.log(`Selected expression: ${expression.name}`);

    // Step 3: Build the generation prompt
    const childTerm = gender === "boy" ? "boy" : gender === "girl" ? "girl" : "child";
    const pronounHis = gender === "boy" ? "his" : gender === "girl" ? "her" : "their";
    
    const generationPrompt = `Create a vintage children's book cover illustration.

STYLE: Classic 1920s-1950s children's book illustration. Hand-drawn, crosshatching, soft watercolor washes, aged paper texture. Think Jessie Willcox Smith, N.C. Wyeth, or Golden Age illustrators.

THE ${childTerm.toUpperCase()} (MUST MATCH EXACTLY):
${childDescription}

BOOK COVER: "${palette.name}"
Scene: ${palette.background}
Colors: ${palette.colors}
Mood: ${palette.mood}

COMPOSITION:
- Full body portrait of the ${childTerm} as the main character
- Decorative vintage border or frame elements (NO TEXT)
- The ${childTerm} in period-appropriate adventure clothing
- Expression: ${expression.description}

CRITICAL:
- Preserve EXACT hair color, eye color, skin tone, and facial features
- Vintage illustration style - NOT modern digital art
- Warm, nostalgic, timeless quality
- Family must recognize their ${childTerm}

DO NOT: 
- Any text, words, letters, titles, or typography
- Book title text or cover text
- Any written words or numbers in the image
- Photorealistic rendering
- Modern cartoon style
- Dark themes
- Change any physical features

IMPORTANT: The image must contain NO TEXT whatsoever - no titles, no words, no letters, no numbers.`;

    console.log("Generating child art portrait with GPT-Image-1...");
    const generationStartTime = Date.now();

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
      console.log(`Upscaling by ${upscaleScale}x...`);
      try {
        generatedBuffer = await upscaleImage(generatedBuffer, upscaleScale);
        console.log("✅ Image upscaled successfully");
      } catch (upscaleError) {
        console.error("Upscale failed, using original resolution:", upscaleError);
      }
    } else {
      console.log("Upscale disabled (ENABLE_UPSCALE=false)");
    }

    // Process and optimize the generated image
    const upscaledMeta = await sharp(generatedBuffer).metadata();
    const finalSize = upscaledMeta.width || 2048; // Use upscaled size or default
    
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
        app: "child-art-portrait",
        style: palette.name,
        expression: expression.name,
        gender,
        childDescription: childDescription.substring(0, 500),
        hdUrl,
        previewUrl,
        createdAt: new Date().toISOString(),
      });
    } catch (metadataError) {
      console.warn("Failed to save metadata (table may not exist):", metadataError);
      // Continue anyway - the image was generated successfully
    }

    // Increment portrait count (optional)
    try {
      await incrementPortraitCount();
    } catch (countError) {
      console.warn("Failed to increment portrait count:", countError);
    }

    console.log("=== Child Art Portrait Generation Complete ===");
    console.log(`Image ID: ${imageId}`);

    return NextResponse.json({
      success: true,
      imageId,
      previewUrl,
      hdUrl,
      style: palette.name,
      expression: expression.name,
    });

  } catch (error) {
    console.error("Child Art Portrait generation error:", error);
    
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

