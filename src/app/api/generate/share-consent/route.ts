import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API endpoint to handle share consent - if YES, copy image to Shareable_Pet_Portraits bucket
export async function POST(request: NextRequest) {
  try {
    const { imageId, consent } = await request.json();

    if (!imageId) {
      return NextResponse.json({ error: "Missing imageId" }, { status: 400 });
    }

    console.log(`Share consent for ${imageId}: ${consent || "not answered"}`);

    // Only proceed if user said YES
    if (consent !== "yes") {
      console.log("User did not consent to sharing, skipping copy");
      return NextResponse.json({ 
        success: true, 
        shared: false,
        reason: consent === "no" ? "User declined" : "No response"
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase not configured");
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download and copy both HD (unwatermarked) and preview (watermarked) images
    const hdPath = `${imageId}-hd.png`;
    const previewPath = `${imageId}-preview.png`;
    
    // Download HD image
    const { data: hdData, error: hdDownloadError } = await supabase.storage
      .from("pet-portraits")
      .download(hdPath);

    if (hdDownloadError || !hdData) {
      console.error("Error downloading HD image for sharing:", hdDownloadError);
      return NextResponse.json({ 
        success: false, 
        error: "Could not find HD image to share"
      }, { status: 404 });
    }

    // Download preview (watermarked) image
    const { data: previewData, error: previewDownloadError } = await supabase.storage
      .from("pet-portraits")
      .download(previewPath);

    if (previewDownloadError || !previewData) {
      console.error("Error downloading preview image for sharing:", previewDownloadError);
      // Continue with just HD if preview not found
    }

    // Upload HD to Shareable_Pet_Portraits bucket
    const { error: hdUploadError } = await supabase.storage
      .from("Shareable_Pet_Portraits")
      .upload(`${imageId}-hd.png`, hdData, {
        contentType: "image/png",
        upsert: true
      });

    if (hdUploadError) {
      console.error("Error uploading HD to shareable bucket:", hdUploadError);
      return NextResponse.json({ 
        success: false, 
        error: "Could not copy HD to shareable bucket"
      }, { status: 500 });
    }

    console.log(`✅ HD image copied to Shareable_Pet_Portraits: ${imageId}-hd.png`);

    // Upload preview (watermarked) to Shareable_Pet_Portraits bucket
    if (previewData) {
      const { error: previewUploadError } = await supabase.storage
        .from("Shareable_Pet_Portraits")
        .upload(`${imageId}-preview.png`, previewData, {
          contentType: "image/png",
          upsert: true
        });

      if (previewUploadError) {
        console.error("Error uploading preview to shareable bucket:", previewUploadError);
        // Non-critical, HD was already uploaded
      } else {
        console.log(`✅ Preview (watermarked) image copied to Shareable_Pet_Portraits: ${imageId}-preview.png`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      shared: true,
      files: {
        hd: `${imageId}-hd.png`,
        preview: previewData ? `${imageId}-preview.png` : null
      }
    });

  } catch (error) {
    console.error("Share consent error:", error);
    return NextResponse.json(
      { error: "Failed to process share consent" },
      { status: 500 }
    );
  }
}

