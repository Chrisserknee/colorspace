import { NextRequest, NextResponse } from "next/server";
import { getMetadata } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    // Get imageId from query params
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

    // Check if paid - only allow download of HD version after payment
    if (!metadata.paid) {
      return NextResponse.json(
        { error: "Payment required to download HD version" },
        { status: 402 }
      );
    }

    // Fetch the HD image from Supabase Storage
    const imageResponse = await fetch(metadata.hd_url);
    
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch image" },
        { status: 500 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    // Return the image with download headers
    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="pet-renaissance-${imageId}.png"`,
        "Content-Length": imageBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download image" },
      { status: 500 }
    );
  }
}
