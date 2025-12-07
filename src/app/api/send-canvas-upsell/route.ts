import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCanvasUpsellEmail } from "@/lib/lumeEmails";

// Secret key to prevent unauthorized access
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET;

async function getCustomerImageId(email: string): Promise<string | null> {
  // First check paying_customers table
  const { data: customer } = await supabase
    .from("paying_customers")
    .select("image_ids")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  
  if (customer?.image_ids?.[0]) {
    return customer.image_ids[0];
  }
  
  // Fallback: search metadata table
  const { data: metadata } = await supabase
    .from("metadata")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .order("created_at", { ascending: false })
    .limit(1);
  
  return metadata?.[0]?.id || null;
}

// GET: Send canvas upsell to a specific email
// Usage: /api/send-canvas-upsell?key=YOUR_KEY&email=customer@example.com
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const email = url.searchParams.get("email");
  
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized - add ?key=YOUR_KEY" }, { status: 401 });
  }
  
  if (!email) {
    return NextResponse.json({ error: "Missing email parameter - add &email=customer@example.com" }, { status: 400 });
  }
  
  try {
    const imageId = await getCustomerImageId(email);
    
    if (!imageId) {
      return NextResponse.json({ 
        success: false, 
        error: `No image found for ${email}. Customer may not exist in database.` 
      }, { status: 404 });
    }
    
    const result = await sendCanvasUpsellEmail(email, imageId, 1);
    
    if (result.success) {
      // Mark email 1 as sent
      await supabase
        .from("paying_customers")
        .update({ canvas_email_1_sent_at: new Date().toISOString() })
        .eq("email", email.toLowerCase().trim());
      
      return NextResponse.json({
        success: true,
        message: `Canvas upsell email sent to ${email}`,
        imageId
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        imageId
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Canvas upsell email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST: Send canvas upsell via JSON body
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const providedKey = authHeader?.replace("Bearer ", "");
    
    if (!INTERNAL_API_KEY || providedKey !== INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const email = body.email;
    
    if (!email) {
      return NextResponse.json({ error: "Missing email in request body" }, { status: 400 });
    }
    
    const imageId = await getCustomerImageId(email);
    
    if (!imageId) {
      return NextResponse.json({ 
        success: false, 
        error: `No image found for ${email}` 
      }, { status: 404 });
    }
    
    const result = await sendCanvasUpsellEmail(email, imageId, 1);
    
    if (result.success) {
      await supabase
        .from("paying_customers")
        .update({ canvas_email_1_sent_at: new Date().toISOString() })
        .eq("email", email.toLowerCase().trim());
      
      return NextResponse.json({
        success: true,
        message: `Canvas upsell email sent to ${email}`,
        imageId
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Canvas upsell email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

