import { NextRequest, NextResponse } from "next/server";
import { markLeadAsPurchased, getLumeLeadByEmail } from "@/lib/supabase";

/**
 * POST /api/lume-leads/mark-purchased
 * 
 * Mark a lead as having completed a purchase.
 * This stops all follow-up emails from being sent.
 * 
 * Request body:
 * {
 *   email: string (required)
 * }
 * 
 * Called from:
 * - Stripe webhook after successful payment
 * - Manual admin action
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Add API key authentication for security
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.INTERNAL_API_KEY;
    
    // If INTERNAL_API_KEY is set, require it
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      // Also allow from Stripe webhook (no auth but from trusted source)
      const isFromWebhook = request.headers.get('stripe-signature');
      if (!isFromWebhook) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }
    
    const body = await request.json();
    const { email } = body as { email?: string };
    
    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }
    
    console.log(`💰 Marking lead as purchased: ${email}`);
    
    // Check if lead exists
    const lead = await getLumeLeadByEmail(email);
    
    if (!lead) {
      console.log(`⚠️ Lead not found for ${email} - creating and marking as purchased`);
      // Lead might have purchased without going through our capture flow
      // That's okay - we just won't have them in our sequence
      return NextResponse.json({
        success: true,
        message: "Lead not found in sequence - no action needed",
        leadFound: false,
      });
    }
    
    if (lead.has_purchased) {
      console.log(`ℹ️ Lead ${email} already marked as purchased`);
      return NextResponse.json({
        success: true,
        message: "Lead already marked as purchased",
        alreadyPurchased: true,
      });
    }
    
    // Mark as purchased
    const success = await markLeadAsPurchased(email);
    
    if (!success) {
      return NextResponse.json(
        { error: "Failed to update lead" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Lead marked as purchased - follow-up emails stopped",
      leadId: lead.id,
      emailStepWhenPurchased: lead.last_email_step_sent,
    });
    
  } catch (error) {
    console.error("Mark purchased error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

