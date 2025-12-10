import { NextRequest, NextResponse } from "next/server";
import { getSiteWideGuidance, setSiteWideGuidance } from "@/lib/supabase";

// Simple password check for admin endpoints
const STUDIO_PASSWORD = "LumePetLover1325519*";

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  
  const password = authHeader.replace("Bearer ", "");
  return password === STUDIO_PASSWORD;
}

// GET - Retrieve current site-wide guidance
export async function GET(request: NextRequest) {
  // No auth required for GET - guidance is applied to all generations
  try {
    const guidance = await getSiteWideGuidance();
    return NextResponse.json({ 
      success: true, 
      guidance: guidance || "" 
    });
  } catch (error) {
    console.error("Error getting site guidance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get site guidance" },
      { status: 500 }
    );
  }
}

// POST - Update site-wide guidance (requires Studio password)
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { guidance } = body;
    
    if (typeof guidance !== "string") {
      return NextResponse.json(
        { success: false, error: "Guidance must be a string" },
        { status: 400 }
      );
    }
    
    const success = await setSiteWideGuidance(guidance.trim());
    
    if (success) {
      console.log(`🌐 Site-wide guidance updated: "${guidance.substring(0, 50)}..."`);
      return NextResponse.json({ 
        success: true, 
        message: "Site-wide guidance updated",
        guidance: guidance.trim()
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Failed to save guidance" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error setting site guidance:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update site guidance" },
      { status: 500 }
    );
  }
}

