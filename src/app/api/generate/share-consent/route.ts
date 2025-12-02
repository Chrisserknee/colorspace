import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API endpoint to update share consent tag on an existing image
export async function POST(request: NextRequest) {
  try {
    const { imageId, consent } = await request.json();

    if (!imageId) {
      return NextResponse.json({ error: "Missing imageId" }, { status: 400 });
    }

    // Validate consent value
    const validConsent = consent === "yes" || consent === "no" ? consent.toUpperCase() : "N/A";
    
    console.log(`Updating share consent for ${imageId}: SHARE=${validConsent}`);

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase not configured");
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rename the HD file to include the share consent tag
    const oldHdPath = `${imageId}-hd.png`;
    const newHdPath = `${imageId}-SHARE=${validConsent}-hd.png`;

    // Copy to new name with consent tag
    const { error: copyError } = await supabase.storage
      .from("pet-portraits")
      .copy(oldHdPath, newHdPath);

    if (copyError) {
      console.error("Error copying file with consent tag:", copyError);
      // Non-critical error - the image still exists, just without the tag
      return NextResponse.json({ 
        success: true, 
        consent: validConsent,
        note: "Could not rename file, but consent was recorded"
      });
    }

    // Delete the old file
    await supabase.storage
      .from("pet-portraits")
      .remove([oldHdPath]);

    console.log(`✅ Share consent updated: ${oldHdPath} → ${newHdPath}`);

    return NextResponse.json({ 
      success: true, 
      consent: validConsent,
      newPath: newHdPath
    });

  } catch (error) {
    console.error("Share consent update error:", error);
    return NextResponse.json(
      { error: "Failed to update share consent" },
      { status: 500 }
    );
  }
}

