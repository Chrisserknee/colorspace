import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCanvasUpsellEmail } from "@/lib/lumeEmails";

// Secret key to prevent unauthorized access
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET;

// Target customers for this campaign
const TARGET_CUSTOMERS = [
  "chrisserknee@gmail.com",
  "rdeleon6@aol.com",
  "doltongang@cox.net",
  "verbie@comcast.net",
  "carmenwolff@icloud.com",
  "heidi@cypresspointclub.org",
];

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

export async function POST(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get("authorization");
    const providedKey = authHeader?.replace("Bearer ", "");
    
    if (!INTERNAL_API_KEY || providedKey !== INTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results: { email: string; status: string; imageId?: string; error?: string }[] = [];

    for (const email of TARGET_CUSTOMERS) {
      const imageId = await getCustomerImageId(email);
      
      if (!imageId) {
        results.push({ email, status: "skipped", error: "No image found" });
        continue;
      }
      
      const result = await sendCanvasUpsellEmail(email, imageId);
      
      if (result.success) {
        results.push({ email, status: "sent", imageId });
      } else {
        results.push({ email, status: "failed", imageId, error: result.error });
      }
      
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "failed").length;
    const skipped = results.filter(r => r.status === "skipped").length;

    return NextResponse.json({
      success: true,
      summary: { sent, failed, skipped, total: TARGET_CUSTOMERS.length },
      results
    });

  } catch (error) {
    console.error("Canvas upsell email error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Also support GET for easy browser testing (with auth)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized - add ?key=YOUR_KEY" }, { status: 401 });
  }
  
  // Convert to POST request internally
  const newRequest = new Request(request.url, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${key}`
    }
  });
  
  return POST(newRequest);
}

