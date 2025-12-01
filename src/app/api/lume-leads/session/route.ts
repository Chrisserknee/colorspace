import { NextRequest, NextResponse } from "next/server";
import { getLumeLeadByEmail } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { isValidEmail } from "@/lib/validation";

/**
 * GET /api/lume-leads/session?email=...
 * 
 * Fetch session data for a lead to restore their progress.
 * Used when user clicks email link to continue where they left off.
 */
export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate limiting - prevent enumeration attacks
  const rateLimit = checkRateLimit(`session:${clientIP}`, RATE_LIMITS.imageInfo);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() } }
    );
  }
  
  const email = request.nextUrl.searchParams.get("email");
  
  if (!email) {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 }
    );
  }
  
  // Validate email format
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 }
    );
  }
  
  try {
    const lead = await getLumeLeadByEmail(email);
    
    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found", hasSession: false },
        { status: 404 }
      );
    }
    
    // Return session data from context
    const context = lead.context || {};
    
    return NextResponse.json({
      hasSession: true,
      hasPurchased: lead.has_purchased,
      session: {
        // Common fields
        style: context.style || "royal",
        gender: context.gender,
        uploadedImageUrl: context.uploadedImageUrl,
        
        // Generated image data
        imageId: context.imageId,
        previewUrl: context.previewUrl,
        
        // Rainbow Bridge specific
        petName: context.petName,
        quote: context.quote,
        
        // Metadata
        createdAt: lead.created_at,
        lastActivity: lead.updated_at,
      }
    });
    
  } catch (error) {
    console.error("Session fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}

