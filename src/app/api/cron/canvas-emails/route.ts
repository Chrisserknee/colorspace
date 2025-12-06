import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendCanvasUpsellEmail } from "@/lib/lumeEmails";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

// Time thresholds for each email
const EMAIL_1_DELAY_MS = 1 * 60 * 60 * 1000; // 1 hour
const EMAIL_2_DELAY_MS = 24 * 60 * 60 * 1000; // 1 day
const EMAIL_3_DELAY_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

interface CustomerForEmail {
  id: string;
  email: string;
  image_ids: string[] | null;
  first_purchase_at: string;
  canvas_email_1_sent_at: string | null;
  canvas_email_2_sent_at: string | null;
  canvas_email_3_sent_at: string | null;
  canvas_purchased: boolean | null;
  purchase_type: string | null;
}

export async function GET(request: Request) {
  try {
    // Verify authorization
    const url = new URL(request.url);
    const providedSecret = url.searchParams.get("secret") || 
      request.headers.get("authorization")?.replace("Bearer ", "");
    
    if (!CRON_SECRET || providedSecret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const results = {
      email1: { sent: 0, skipped: 0, errors: [] as string[] },
      email2: { sent: 0, skipped: 0, errors: [] as string[] },
      email3: { sent: 0, skipped: 0, errors: [] as string[] },
    };

    // Get all customers who might need canvas emails
    // Only portrait and rainbow-bridge customers (not pack or canvas purchasers)
    const { data: customers, error: fetchError } = await supabase
      .from("paying_customers")
      .select("id, email, image_ids, first_purchase_at, canvas_email_1_sent_at, canvas_email_2_sent_at, canvas_email_3_sent_at, canvas_purchased, purchase_type")
      .in("purchase_type", ["portrait", "rainbow-bridge"])
      .or("canvas_purchased.is.null,canvas_purchased.eq.false")
      .not("image_ids", "is", null)
      .order("first_purchase_at", { ascending: true });

    if (fetchError) {
      console.error("Error fetching customers:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!customers || customers.length === 0) {
      return NextResponse.json({ 
        message: "No customers to process",
        results 
      });
    }

    console.log(`📧 Processing ${customers.length} customers for canvas emails...`);

    for (const customer of customers as CustomerForEmail[]) {
      const purchaseTime = new Date(customer.first_purchase_at).getTime();
      const timeSincePurchase = now.getTime() - purchaseTime;
      
      // Get first image ID for the link
      const imageId = customer.image_ids?.[0];
      if (!imageId) {
        continue;
      }

      // Check if customer has already purchased canvas
      if (customer.canvas_purchased) {
        continue;
      }

      // Email 1: Send 1 hour after purchase
      if (!customer.canvas_email_1_sent_at && timeSincePurchase >= EMAIL_1_DELAY_MS) {
        const result = await sendCanvasUpsellEmail(customer.email, imageId, 1);
        
        if (result.success) {
          await supabase
            .from("paying_customers")
            .update({ canvas_email_1_sent_at: now.toISOString() })
            .eq("id", customer.id);
          results.email1.sent++;
          console.log(`✅ Email 1 sent to ${customer.email}`);
        } else {
          results.email1.errors.push(`${customer.email}: ${result.error}`);
        }
        continue; // Don't send multiple emails in one run
      }

      // Email 2: Send 1 day after purchase (only if email 1 was sent)
      if (customer.canvas_email_1_sent_at && 
          !customer.canvas_email_2_sent_at && 
          timeSincePurchase >= EMAIL_2_DELAY_MS) {
        const result = await sendCanvasUpsellEmail(customer.email, imageId, 2);
        
        if (result.success) {
          await supabase
            .from("paying_customers")
            .update({ canvas_email_2_sent_at: now.toISOString() })
            .eq("id", customer.id);
          results.email2.sent++;
          console.log(`✅ Email 2 sent to ${customer.email}`);
        } else {
          results.email2.errors.push(`${customer.email}: ${result.error}`);
        }
        continue;
      }

      // Email 3: Send 2 days after purchase (only if email 2 was sent)
      if (customer.canvas_email_2_sent_at && 
          !customer.canvas_email_3_sent_at && 
          timeSincePurchase >= EMAIL_3_DELAY_MS) {
        const result = await sendCanvasUpsellEmail(customer.email, imageId, 3);
        
        if (result.success) {
          await supabase
            .from("paying_customers")
            .update({ canvas_email_3_sent_at: now.toISOString() })
            .eq("id", customer.id);
          results.email3.sent++;
          console.log(`✅ Email 3 (Last Chance) sent to ${customer.email}`);
        } else {
          results.email3.errors.push(`${customer.email}: ${result.error}`);
        }
      }
    }

    const totalSent = results.email1.sent + results.email2.sent + results.email3.sent;
    console.log(`📧 Canvas email run complete: ${totalSent} emails sent`);

    return NextResponse.json({
      success: true,
      message: `Processed ${customers.length} customers, sent ${totalSent} emails`,
      results,
    });

  } catch (error) {
    console.error("Canvas email cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// Also support POST for Vercel cron
export async function POST(request: Request) {
  return GET(request);
}

