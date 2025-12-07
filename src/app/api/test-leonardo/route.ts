/**
 * Leonardo AI Test Route
 * FOR DEV TESTING ONLY - DO NOT USE IN PRODUCTION
 * 
 * Usage:
 * POST /api/test-leonardo
 * Body: { prompt: string, imageBase64?: string, strength?: number, modelId?: string }
 */

import { NextResponse } from "next/server";
import { leonardoImg2Img, leonardoTextToImage, LEONARDO_MODELS } from "@/lib/leonardo";

// Only allow in development
const isDev = process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";

export async function POST(request: Request) {
  // Safety check - only allow in dev/preview
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }
  
  try {
    const body = await request.json();
    const { 
      prompt, 
      imageBase64, 
      strength = 0.5,
      modelId = LEONARDO_MODELS.KINO_XL,
      guidanceScale = 7,
    } = body;
    
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }
    
    console.log("🧪 Leonardo test request received");
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`🎨 Model: ${modelId}`);
    console.log(`💪 Strength: ${strength}`);
    
    let resultBuffer: Buffer;
    
    if (imageBase64) {
      // img2img mode
      console.log("🖼️ Mode: img2img");
      const imageBuffer = Buffer.from(imageBase64, "base64");
      resultBuffer = await leonardoImg2Img(imageBuffer, prompt, {
        strength,
        modelId,
        guidanceScale,
      });
    } else {
      // text-to-image mode
      console.log("📝 Mode: text-to-image");
      resultBuffer = await leonardoTextToImage(prompt, {
        modelId,
        guidanceScale,
      });
    }
    
    // Return as base64
    const resultBase64 = resultBuffer.toString("base64");
    
    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${resultBase64}`,
      message: "Leonardo generation complete!",
    });
    
  } catch (error) {
    console.error("Leonardo test error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check available models and status
export async function GET() {
  if (!isDev) {
    return NextResponse.json(
      { error: "This endpoint is only available in development" },
      { status: 403 }
    );
  }
  
  const hasApiKey = !!process.env.LEONARDO_API_KEY;
  
  return NextResponse.json({
    status: "Leonardo API test endpoint",
    configured: hasApiKey,
    environment: process.env.NODE_ENV,
    models: LEONARDO_MODELS,
    usage: {
      textToImage: {
        method: "POST",
        body: {
          prompt: "Your prompt here",
          modelId: "optional - defaults to KINO_XL",
          guidanceScale: "optional - defaults to 7",
        },
      },
      img2img: {
        method: "POST", 
        body: {
          prompt: "Your prompt here",
          imageBase64: "base64 encoded image",
          strength: "0-1, how much to transform (default 0.5)",
          modelId: "optional",
          guidanceScale: "optional",
        },
      },
    },
  });
}

