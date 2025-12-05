import { NextRequest, NextResponse } from "next/server";
import { addRoyalClubSubscriber } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/lume-leads
 * 
 * Royal Club newsletter signup endpoint.
 * 
 * Request body:
 * {
 *   email: string (required),
 *   context?: {
 *     source?: string,           // 'royal-club-signup'
 *     signupLocation?: string,   // 'homepage-footer', etc.
 *   },
 *   source?: string              // backwards compatibility
 * }
 * 
 * Behavior:
 * 1. Add email to Royal Club subscribers list
 * 2. If already subscribed, just returns success
 * 3. If unsubscribed, resubscribes them
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate limiting - prevent abuse
  const rateLimit = checkRateLimit(`lume-leads:${clientIP}`, RATE_LIMITS.contact);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() } }
    );
  }
  
  try {
    const body = await request.json();
    const { email, context } = body as { 
      email?: string; 
      context?: { 
        source?: string; 
        signupLocation?: string;
        [key: string]: unknown;
      };
    };
    
    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }
    
    console.log(`👑 Royal Club signup: ${email}`, context ? JSON.stringify(context) : '');
    
    // Add to Royal Club subscribers
    const { success, isNew, error: subscribeError } = await addRoyalClubSubscriber(
      email,
      {
        signupLocation: context?.signupLocation || 'homepage-footer',
        context: context,
      }
    );
    
    if (!success) {
      console.error("Failed to add subscriber:", subscribeError);
      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      isNew,
      message: isNew ? "Welcome to the Royal Club!" : "You're already subscribed!",
    });
    
  } catch (error) {
    console.error("Subscription error:", error);
    return NextResponse.json(
      { error: "Failed to process subscription" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lume-leads
 * 
 * Health check / info endpoint
 */
export async function GET() {
  return NextResponse.json({
    service: "royal-club",
    status: "ok",
    description: "Royal Club newsletter signup endpoint",
    endpoints: {
      "POST /api/lume-leads": "Subscribe to Royal Club",
    }
  });
}

