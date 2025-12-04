import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FROM_EMAIL = "LumePet <noreply@lumepet.app>";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://lumepet.app";

// Support appeal email HTML
function getSupportEmailHTML(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LumePet Needs Your Help</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0908; font-family: Georgia, 'Times New Roman', serif;">
  
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #0A0908;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background: linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%); border-radius: 16px; border: 1px solid rgba(197, 165, 114, 0.2); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);">
          
          <!-- Header with Heart -->
          <tr>
            <td align="center" style="padding: 40px 40px 25px 40px;">
              <div style="font-size: 44px; line-height: 1; margin-bottom: 15px;">💛</div>
              <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: normal; color: #C5A572; letter-spacing: 3px; font-family: Georgia, 'Times New Roman', serif;">
                LUMEPET
              </h1>
              <p style="margin: 0; font-size: 12px; color: #7A756D; letter-spacing: 2px; text-transform: uppercase;">
                A Personal Message From Chris
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(197, 165, 114, 0.3), transparent);"></div>
            </td>
          </tr>
          
          <!-- Main Message -->
          <tr>
            <td style="padding: 30px 40px;">
              <h2 style="margin: 0 0 20px 0; font-size: 22px; font-weight: normal; color: #F0EDE8; text-align: center; font-family: Georgia, 'Times New Roman', serif; line-height: 1.4;">
                LumePet Needs Your Help to Stay Online
              </h2>
              
              <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 1.7; color: #B8B2A8;">
                I'm Chris — I built LumePet to celebrate our pets as the royalty they truly are. But I need to be honest: <strong style="color: #F0EDE8;">I'm struggling to keep it running.</strong>
              </p>
              
              <p style="margin: 0 0 15px 0; font-size: 15px; line-height: 1.7; color: #B8B2A8;">
                Every portrait costs real money to create. The AI technology is expensive, and <strong style="color: #E74C3C;">the costs are more than I can afford alone.</strong> Without support, I may have to shut down LumePet.
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.7; color: #B8B2A8;">
                If LumePet ever brought you joy — <strong style="color: #C5A572;">please consider helping me keep it alive.</strong> Even $1 makes a difference.
              </p>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding: 0 40px 30px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <a href="${BASE_URL}/?support=true" target="_blank" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #C5A572 0%, #A68B5B 100%); color: #0A0A0A; text-decoration: none; font-size: 17px; font-weight: bold; border-radius: 10px; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0.5px; box-shadow: 0 6px 20px rgba(197, 165, 114, 0.3);">
                      💛 Support LumePet
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 15px 0 0 0; font-size: 12px; color: #5A5650;">
                Secure via Stripe • Any amount helps
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, rgba(197, 165, 114, 0.3), transparent);"></div>
            </td>
          </tr>
          
          <!-- Personal Sign-off -->
          <tr>
            <td style="padding: 25px 40px;">
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 1.7; color: #B8B2A8;">
                Thank you from the bottom of my heart. 💛
              </p>
              <p style="margin: 0; font-size: 18px; color: #C5A572; font-family: Georgia, 'Times New Roman', serif; font-style: italic;">
                Chris Cerney
              </p>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #7A756D;">
                Creator of LumePet 🐾
              </p>
            </td>
          </tr>
          
          <!-- Paw Prints -->
          <tr>
            <td align="center" style="padding: 15px 40px 30px 40px;">
              <p style="margin: 0; font-size: 20px; letter-spacing: 12px; opacity: 0.3;">
                🐾 🐾 🐾
              </p>
            </td>
          </tr>
          
        </table>
        
        <!-- Footer -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px;">
          <tr>
            <td align="center" style="padding: 30px 20px;">
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #5A5650;">
                © 2024 LumePet. Made with love for pets everywhere.
              </p>
              <p style="margin: 0; font-size: 12px; color: #5A5650;">
                <a href="${BASE_URL}" style="color: #7A756D; text-decoration: underline;">Visit LumePet</a>
                &nbsp;&nbsp;•&nbsp;&nbsp;
                <a href="${BASE_URL}/about" style="color: #7A756D; text-decoration: underline;">Our Story</a>
              </p>
            </td>
          </tr>
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
}

/**
 * POST /api/send-support-email
 * 
 * Sends the support appeal email to all users.
 * Requires admin secret for authorization.
 * 
 * Request body:
 * {
 *   adminSecret: string (required - must match ADMIN_SECRET env var)
 *   testEmail?: string (optional - if provided, only sends to this email for testing)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminSecret, testEmail } = body;

    // Verify admin secret
    const expectedSecret = process.env.ADMIN_SECRET;
    if (!expectedSecret || adminSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if Resend is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    const subject = "LumePet Needs Your Help 💛";
    const html = getSupportEmailHTML();

    // If test email provided, only send to that one
    if (testEmail) {
      console.log(`📧 Sending test support email to: ${testEmail}`);
      
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [testEmail],
        subject,
        html,
      });

      if (error) {
        console.error("Failed to send test email:", error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Test email sent to ${testEmail}`,
        messageId: data?.id,
      });
    }

    // Fetch all unique emails from lume_leads
    const { data: leads, error: leadsError } = await supabase
      .from("lume_leads")
      .select("email")
      .not("email", "is", null);

    if (leadsError) {
      console.error("Failed to fetch leads:", leadsError);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    // Also fetch from pet_emails table if it exists
    const { data: petEmails } = await supabase
      .from("pet_emails")
      .select("email")
      .not("email", "is", null);

    // Combine and deduplicate emails
    const allEmails = new Set<string>();
    
    leads?.forEach((lead: { email: string }) => {
      if (lead.email) allEmails.add(lead.email.toLowerCase());
    });
    
    petEmails?.forEach((record: { email: string }) => {
      if (record.email) allEmails.add(record.email.toLowerCase());
    });

    const emailList = Array.from(allEmails);
    
    if (emailList.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No emails found to send to",
        sent: 0,
      });
    }

    console.log(`📧 Sending support email to ${emailList.length} users...`);

    // Send emails in batches to avoid rate limits
    const BATCH_SIZE = 50;
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second
    
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
      const batch = emailList.slice(i, i + BATCH_SIZE);
      
      // Send each email in the batch
      const results = await Promise.allSettled(
        batch.map(async (email) => {
          const { error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: [email],
            subject,
            html,
          });
          
          if (error) {
            throw new Error(`${email}: ${error.message}`);
          }
          return email;
        })
      );

      // Count successes and failures
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          successCount++;
        } else {
          failCount++;
          errors.push(result.reason?.message || "Unknown error");
        }
      });

      // Delay between batches if not the last batch
      if (i + BATCH_SIZE < emailList.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
      
      console.log(`📧 Progress: ${Math.min(i + BATCH_SIZE, emailList.length)}/${emailList.length} processed`);
    }

    console.log(`✅ Support email campaign complete: ${successCount} sent, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Support email sent to ${successCount} users`,
      sent: successCount,
      failed: failCount,
      total: emailList.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Only show first 10 errors
    });

  } catch (error) {
    console.error("Send support email error:", error);
    return NextResponse.json(
      { error: "Failed to send emails" },
      { status: 500 }
    );
  }
}

