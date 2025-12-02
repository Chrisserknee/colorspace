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

    // Download the HD image from pet-portraits bucket
    const hdPath = `${imageId}-hd.png`;
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("pet-portraits")
      .download(hdPath);

    if (downloadError || !fileData) {
      console.error("Error downloading image for sharing:", downloadError);
      return NextResponse.json({ 
        success: false, 
        error: "Could not find image to share"
      }, { status: 404 });
    }

    // Upload to Shareable_Pet_Portraits bucket
    const shareablePath = `${imageId}-hd.png`;
    
    const { error: uploadError } = await supabase.storage
      .from("Shareable_Pet_Portraits")
      .upload(shareablePath, fileData, {
        contentType: "image/png",
        upsert: true // Overwrite if exists
      });

    if (uploadError) {
      console.error("Error uploading to shareable bucket:", uploadError);
      return NextResponse.json({ 
        success: false, 
        error: "Could not copy to shareable bucket"
      }, { status: 500 });
    }

    console.log(`✅ Image copied to Shareable_Pet_Portraits: ${shareablePath}`);

    return NextResponse.json({ 
      success: true, 
      shared: true,
      path: shareablePath
    });

  } catch (error) {
    console.error("Share consent error:", error);
    return NextResponse.json(
      { error: "Failed to process share consent" },
      { status: 500 }
    );
  }
}

