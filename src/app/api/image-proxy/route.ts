import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return NextResponse.json({ error: "No URL provided" }, { status: 400 });
  }

  // Only allow Supabase storage URLs for security
  if (!imageUrl.includes("supabase.co/storage")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    console.log("Proxy: Fetching image from:", imageUrl);
    
    // Extract filename from URL (format: .../storage/v1/object/public/Generations/filename.png)
    const urlParts = imageUrl.split("/");
    const fileName = urlParts[urlParts.length - 1].split("?")[0]; // Remove query params
    
    console.log("Proxy: Extracted filename:", fileName);
    
    // Try direct download from Supabase storage first (bypasses public bucket requirement)
    try {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("Generations")
        .download(fileName);
      
      if (!downloadError && fileData) {
        console.log("Proxy: Successfully downloaded from Supabase storage");
        const arrayBuffer = await fileData.arrayBuffer();
        return new NextResponse(arrayBuffer, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      } else {
        console.warn("Proxy: Direct download failed, trying public URL:", downloadError);
      }
    } catch (directErr) {
      console.warn("Proxy: Direct download error, falling back to public URL:", directErr);
    }
    
    // Fallback: Try fetching from public URL
    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    console.log("Proxy: Response status:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Proxy: Failed to fetch image:", response.status, errorText);
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status} ${response.statusText}`, details: errorText.substring(0, 200), fileName },
        { status: response.status }
      );
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/png";

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy image", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
