import { NextRequest, NextResponse } from "next/server";
import { getLeadsDueForFollowup, updateLeadEmailStep } from "@/lib/supabase";
import { sendLumeEmailByStep, EMAIL_SCHEDULE, LumeLead } from "@/lib/lumeEmails";

/**
 * GET /api/cron/lume-followups
 * 
 * Cron job endpoint for sending follow-up emails.
 * Called daily by Vercel Cron (configured in vercel.json).
 * 
 * Email Schedule:
 * - Email #1: Immediately (sent by /api/lume-leads)
 * - Email #2: 1 day after signup
 * - Email #3: 3 days after signup
 * - Email #4: 7 days after signup
 * - Email #5: 21 days after signup
 * - Email #6: 30 days after signup
 * 
 * Logic:
 * 1. Fetch all leads where has_purchased = false AND last_email_step_sent < 6
 * 2. For each lead, calculate days since created_at
 * 3. Determine which email step they should be at based on days elapsed
 * 4. If they're behind (last_email_step_sent < target step), send next email
 * 5. Only send ONE email per lead per cron run (to avoid spam)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  // In production, verify the cron secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("⚠️ Unauthorized cron attempt");
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }
  
  console.log("🕐 Starting lume-followups cron job...");
  const startTime = Date.now();
  
  try {
    // Fetch all leads that need follow-up
    const leads = await getLeadsDueForFollowup();
    
    console.log(`📋 Found ${leads.length} leads to process`);
    
    if (leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No leads to process",
        processed: 0,
        emailsSent: 0,
        duration: Date.now() - startTime,
      });
    }
    
    const now = new Date();
    const results = {
      processed: 0,
      emailsSent: 0,
      errors: 0,
      skipped: 0,
      details: [] as Array<{
        email: string;
        action: string;
        step?: number;
        error?: string;
      }>,
    };
    
    // Process each lead
    for (const lead of leads) {
      results.processed++;
      
      try {
        const createdAt = new Date(lead.created_at);
        const daysSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        // Determine what email step they should be at based on days elapsed
        let targetStep = 1; // Everyone should have at least step 1
        
        if (daysSinceCreated >= EMAIL_SCHEDULE[6]) targetStep = 6;
        else if (daysSinceCreated >= EMAIL_SCHEDULE[5]) targetStep = 5;
        else if (daysSinceCreated >= EMAIL_SCHEDULE[4]) targetStep = 4;
        else if (daysSinceCreated >= EMAIL_SCHEDULE[3]) targetStep = 3;
        else if (daysSinceCreated >= EMAIL_SCHEDULE[2]) targetStep = 2;
        
        const currentStep = lead.last_email_step_sent;
        
        // If they're caught up, skip
        if (currentStep >= targetStep) {
          results.skipped++;
          continue;
        }
        
        // Send the NEXT email (current step + 1)
        const nextStep = currentStep + 1;
        
        // Only send if they've reached the day threshold for this step
        const daysRequiredForNextStep = EMAIL_SCHEDULE[nextStep as keyof typeof EMAIL_SCHEDULE];
        
        if (daysSinceCreated < daysRequiredForNextStep) {
          results.skipped++;
          continue;
        }
        
        console.log(`📧 Sending Email #${nextStep} to ${lead.email} (day ${daysSinceCreated})`);
        
        // Convert to the format expected by sendLumeEmailByStep
        const emailLead: LumeLead = {
          id: lead.id,
          email: lead.email,
          created_at: lead.created_at,
          context: lead.context as LumeLead['context'],
        };
        
        const emailResult = await sendLumeEmailByStep(nextStep, emailLead);
        
        if (emailResult.success) {
          // Update the step
          await updateLeadEmailStep(lead.id, nextStep);
          results.emailsSent++;
          results.details.push({
            email: lead.email,
            action: 'sent',
            step: nextStep,
          });
          console.log(`✅ Email #${nextStep} sent to ${lead.email}`);
        } else {
          results.errors++;
          results.details.push({
            email: lead.email,
            action: 'error',
            step: nextStep,
            error: emailResult.error,
          });
          console.error(`❌ Failed to send Email #${nextStep} to ${lead.email}:`, emailResult.error);
        }
        
        // Add delay between emails to respect Resend rate limit (2 req/sec)
        await new Promise(resolve => setTimeout(resolve, 600));
        
      } catch (leadError) {
        results.errors++;
        results.details.push({
          email: lead.email,
          action: 'error',
          error: leadError instanceof Error ? leadError.message : 'Unknown error',
        });
        console.error(`❌ Error processing lead ${lead.email}:`, leadError);
        // Continue to next lead - don't fail entire job
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Cron job completed in ${duration}ms`);
    console.log(`   Processed: ${results.processed}, Sent: ${results.emailsSent}, Skipped: ${results.skipped}, Errors: ${results.errors}`);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${results.processed} leads`,
      processed: results.processed,
      emailsSent: results.emailsSent,
      skipped: results.skipped,
      errors: results.errors,
      duration,
      // Only include details in non-production for debugging
      ...(process.env.NODE_ENV !== 'production' && { details: results.details }),
    });
    
  } catch (error) {
    console.error("❌ Cron job failed:", error);
    return NextResponse.json(
      { 
        error: "Cron job failed",
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for manual triggering (useful for testing)
 */
export async function POST(request: NextRequest) {
  // Reuse GET logic but with different auth check
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.INTERNAL_API_KEY;
  
  if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
    return NextResponse.json(
      { error: "Unauthorized - requires INTERNAL_API_KEY" },
      { status: 401 }
    );
  }
  
  // Call the GET handler logic
  return GET(request);
}

