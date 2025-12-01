import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendLumeEmail1 } from "@/lib/lumeEmails";

/**
 * POST /api/lume-leads/send-email1
 * 
 * One-time endpoint to send Email #1 to all leads who haven't received it.
 * Protected by CRON_SECRET.
 * 
 * Use this for migrated leads who need their first email.
 */
export async function POST(request: NextRequest) {
  // Security check - require CRON_SECRET
  const authHeader = request.headers.get("Authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  console.log("📧 Starting Email #1 batch send...");
  
  try {
    // Get all leads who haven't received Email #1
    const { data: leads, error } = await supabase
      .from("lume_leads")
      .select("*")
      .eq("last_email_step_sent", 0)
      .eq("has_purchased", false)
      .eq("unsubscribed", false);
    
    if (error) {
      console.error("Failed to fetch leads:", error);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }
    
    if (!leads || leads.length === 0) {
      console.log("No leads need Email #1");
      return NextResponse.json({ message: "No leads need Email #1", sent: 0 });
    }
    
    console.log(`Found ${leads.length} leads needing Email #1`);
    
    let sentCount = 0;
    let failedCount = 0;
    const results: { email: string; success: boolean; error?: string }[] = [];
    
    for (const lead of leads) {
      console.log(`Sending Email #1 to ${lead.email}...`);
      
      const result = await sendLumeEmail1({
        id: lead.id,
        email: lead.email,
        created_at: lead.created_at,
        context: lead.context,
      });
      
      if (result.success) {
        // Update the lead's email step
        const { error: updateError } = await supabase
          .from("lume_leads")
          .update({ 
            last_email_step_sent: 1,
            updated_at: new Date().toISOString()
          })
          .eq("id", lead.id);
        
        if (updateError) {
          console.error(`Failed to update lead ${lead.email}:`, updateError);
        }
        
        sentCount++;
        results.push({ email: lead.email, success: true });
        console.log(`✅ Email #1 sent to ${lead.email}`);
      } else {
        failedCount++;
        results.push({ email: lead.email, success: false, error: result.error });
        console.error(`❌ Failed to send to ${lead.email}:`, result.error);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`📧 Batch complete: ${sentCount} sent, ${failedCount} failed`);
    
    return NextResponse.json({
      message: "Email #1 batch complete",
      total: leads.length,
      sent: sentCount,
      failed: failedCount,
      results,
    });
    
  } catch (error) {
    console.error("Batch send error:", error);
    return NextResponse.json({ error: "Batch send failed" }, { status: 500 });
  }
}

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}

