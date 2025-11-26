import { NextRequest, NextResponse } from "next/server";
import { getMetadata } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate limiting
  const rateLimit = checkRateLimit(`image-info:${clientIP}`, RATE_LIMITS.imageInfo);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    // Validate imageId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(imageId)) {
      return NextResponse.json(
        { error: "Invalid image ID format" },
        { status: 400 }
      );
    }

    // Get metadata from Supabase
    const metadata = await getMetadata(imageId);

    if (!metadata) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // SECURITY: Only return HD URL if payment is confirmed
    // This prevents unauthorized access to the full-resolution image
    return NextResponse.json({
      imageId: metadata.id,
      hdUrl: metadata.paid ? metadata.hd_url : null, // Only expose HD URL after payment
      previewUrl: metadata.preview_url,
      paid: metadata.paid,
      createdAt: metadata.created_at,
    });
  } catch (error) {
    console.error("Image info error:", error);
    return NextResponse.json(
      { error: "Failed to get image info" },
      { status: 500 }
    );
  }
}


