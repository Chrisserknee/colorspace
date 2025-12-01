import { NextRequest, NextResponse } from "next/server";
import { upsertLumeLead, updateLeadEmailStep, LumeLeadContext } from "@/lib/supabase";
import { sendLumeEmail1 } from "@/lib/lumeEmails";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/lume-leads
 * 
 * Lead capture endpoint for the email sequence.
 * 
 * Request body:
 * {
 *   email: string (required),
 *   context?: {
 *     style?: string,      // "rainbow-bridge" | "royal"
 *     petType?: string,    // "cat" | "dog" | etc.
 *     petName?: string,
 *     source?: string,     // "checkout" | "upload" | etc.
 *   }
 * }
 * 
 * Behavior:
 * 1. Upsert the lead (create new or update existing)
 * 2. If new lead and hasn't purchased: send Email #1 immediately
 * 3. Update last_email_step_sent to 1 after sending
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
    const { email, context } = body as { email?: string; context?: LumeLeadContext };
    
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
    
    console.log(`📧 Lead capture: ${email}`, context ? JSON.stringify(context) : '');
    
    // Upsert the lead
    const { lead, isNew, error: upsertError } = await upsertLumeLead(
      email, 
      context,
      context?.source || 'checkout'
    );
    
    if (upsertError || !lead) {
      console.error("Failed to upsert lead:", upsertError);
      return NextResponse.json(
        { error: "Failed to save lead" },
        { status: 500 }
      );
    }
    
    // Determine if we should send Email #1
    const shouldSendEmail1 = !lead.has_purchased && lead.last_email_step_sent < 1;
    
    let emailSent = false;
    
    if (shouldSendEmail1) {
      console.log(`📤 Sending Email #1 to ${email}...`);
      
      const emailResult = await sendLumeEmail1({
        id: lead.id,
        email: lead.email,
        created_at: lead.created_at,
        context: lead.context,
      });
      
      if (emailResult.success) {
        // Update the email step
        await updateLeadEmailStep(lead.id, 1);
        emailSent = true;
        console.log(`✅ Email #1 sent to ${email}`);
      } else {
        // Log but don't fail the request - lead is still captured
        console.error(`❌ Failed to send Email #1 to ${email}:`, emailResult.error);
      }
    } else {
      console.log(`⏭️ Skipping Email #1 for ${email} - already sent or purchased`);
    }
    
    return NextResponse.json({
      success: true,
      leadId: lead.id,
      isNew,
      emailSent,
      hasPurchased: lead.has_purchased,
    });
    
  } catch (error) {
    console.error("Lead capture error:", error);
    return NextResponse.json(
      { error: "Failed to process lead" },
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
    service: "lume-leads",
    status: "ok",
    description: "Lead capture endpoint for LumePet email sequence",
    endpoints: {
      "POST /api/lume-leads": "Capture a new lead",
      "POST /api/lume-leads/mark-purchased": "Mark lead as purchased",
      "GET /api/cron/lume-followups": "Cron job for follow-up emails",
    }
  });
}

