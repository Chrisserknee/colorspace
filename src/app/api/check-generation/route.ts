import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Check for completed generations by session ID
 * This allows users who left during generation to retrieve their completed portrait
 */
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  
  if (!sessionId) {
    return NextResponse.json(
      { error: "Session ID is required" },
      { status: 400 }
    );
  }
  
  console.log(`Checking for completed generation with session ID: ${sessionId}`);
  
  try {
    // Look for a portrait with this session ID created in the last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from("portraits")
      .select("id, preview_url, hd_url, created_at, paid")
      .eq("generation_session_id", sessionId)
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) {
      console.error("Error checking for generation:", error);
      return NextResponse.json(
        { error: "Failed to check generation status" },
        { status: 500 }
      );
    }
    
    if (data) {
      console.log(`✅ Found completed generation: ${data.id}`);
      return NextResponse.json({
        found: true,
        imageId: data.id,
        previewUrl: data.preview_url,
        hdUrl: data.hd_url,
        createdAt: data.created_at,
        paid: data.paid,
      });
    }
    
    console.log("No completed generation found for this session");
    return NextResponse.json({
      found: false,
    });
  } catch (err) {
    console.error("Check generation error:", err);
    return NextResponse.json(
      { error: "Failed to check generation status" },
      { status: 500 }
    );
  }
}

