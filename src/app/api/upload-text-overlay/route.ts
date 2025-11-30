import { NextRequest, NextResponse } from "next/server";
import { uploadImage, getMetadata } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

// API endpoint to upload client-rendered text overlay images to Supabase
// This is called by the client after rendering text on canvas (browser fonts work reliably)
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate limiting
  const rateLimit = checkRateLimit(`upload-text:${clientIP}`, RATE_LIMITS.upload);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many upload attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { imageId, imageDataUrl, type } = body;
    
    // Validate imageId
    if (!imageId) {
      return NextResponse.json({ error: "Image ID is required" }, { status: 400 });
    }
    
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(imageId)) {
      return NextResponse.json({ error: "Invalid image ID format" }, { status: 400 });
    }
    
    // Validate image data
    if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    
    // Validate type
    if (!type || !['hd-text', 'preview-text'].includes(type)) {
      return NextResponse.json({ error: "Invalid type. Must be 'hd-text' or 'preview-text'" }, { status: 400 });
    }
    
    // Verify the image exists in our database
    const metadata = await getMetadata(imageId);
    if (!metadata) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }
    
    // Convert data URL to buffer
    const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Validate buffer size (max 10MB)
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }
    
    // Upload to Supabase
    const fileName = `${imageId}-${type}.png`;
    console.log(`📤 Uploading client-rendered text overlay: ${fileName}`);
    
    const url = await uploadImage(buffer, fileName, "image/png");
    
    console.log(`✅ Text overlay uploaded successfully: ${url.substring(0, 80)}...`);
    
    return NextResponse.json({ 
      success: true, 
      url,
      fileName 
    });
  } catch (error) {
    console.error("Upload text overlay error:", error);
    return NextResponse.json(
      { error: "Failed to upload text overlay" },
      { status: 500 }
    );
  }
}

