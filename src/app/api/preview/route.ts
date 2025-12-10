import { NextRequest, NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET } from "@/lib/supabase";
import { createWatermarkedImage } from "@/lib/watermark";

/**
 * GET /api/preview?imageId=xxx
 * 
 * Serves watermarked preview images on-demand.
 * Fetches the HD image from Supabase and applies watermark in real-time.
 * This eliminates the need to store separate preview images.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageId = searchParams.get("imageId");

  if (!imageId) {
    return NextResponse.json(
      { error: "Missing imageId parameter" },
      { status: 400 }
    );
  }

  // Validate imageId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(imageId)) {
    return NextResponse.json(
      { error: "Invalid imageId format" },
      { status: 400 }
    );
  }

  try {
    // Download HD image from Supabase
    const hdFileName = `${imageId}-hd.png`;
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .download(hdFileName);

    if (error || !data) {
      console.error(`Failed to download HD image ${hdFileName}:`, error);
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const hdBuffer = Buffer.from(arrayBuffer);

    // Apply watermark
    const watermarkedBuffer = await createWatermarkedImage(hdBuffer);

    // Return watermarked image with caching headers
    // Cache for 1 hour since these are generated images that won't change
    return new NextResponse(new Uint8Array(watermarkedBuffer), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Content-Length": watermarkedBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}

