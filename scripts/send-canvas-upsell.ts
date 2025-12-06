/**
 * Canvas Upsell Email Script
 * Sends canvas upsell emails to existing portrait customers
 * 
 * Usage: npx ts-node scripts/send-canvas-upsell.ts
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const resendApiKey = process.env.RESEND_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const resend = new Resend(resendApiKey);

const BASE_URL = "https://lumepet.app";
const FROM_EMAIL = "LumePet <noreply@lumepet.app>";

// Customers to send the canvas upsell email to
const targetCustomers = [
  "chrisserknee@gmail.com",
  "rdeleon6@aol.com",
  "doltongang@cox.net",
  "verbie@comcast.net",
  "carmenwolff@icloud.com",
  "heidi@cypresspointclub.org",
];

function getCanvasUpsellHtml(imageId: string): string {
  const successPageUrl = `${BASE_URL}/success?imageId=${imageId}`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Portrait on Canvas</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0A0A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1A1A1A; border-radius: 16px; border: 1px solid rgba(197, 165, 114, 0.2);">
          
          <!-- Header -->
          <tr>
            <td style="padding: 50px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 20px;">🖼️</div>
              <h1 style="color: #C5A572; font-size: 28px; margin: 0 0 10px; font-weight: normal; letter-spacing: 1px;">Your Portrait on Canvas</h1>
              <p style="color: #7A756D; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Museum-Quality • Ready to Hang</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="color: #F0EDE8; font-size: 18px; line-height: 1.8; margin: 0 0 25px;">
                Hi there,
              </p>
              
              <p style="color: #B8B2A8; font-size: 16px; line-height: 1.8; margin: 0 0 25px;">
                Great news! Your pet's digital portrait is now available as a <strong style="color: #F0EDE8;">museum-quality canvas print</strong> — ready to hang and made to last.
              </p>
              
              <p style="color: #B8B2A8; font-size: 16px; line-height: 1.8; margin: 0 0 30px;">
                For a limited time, digital portrait customers get special pricing on our handcrafted <strong style="color: #C5A572;">12"×12"</strong> and <strong style="color: #C5A572;">16"×16"</strong> canvas prints. Each piece is produced with archival inks, rich detail, and a gallery finish that makes your pet look truly royal in real life.
              </p>
              
              <!-- Highlight Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="padding: 20px; background: rgba(197, 165, 114, 0.1); border-radius: 12px; border: 1px solid rgba(197, 165, 114, 0.2);">
                    <p style="color: #C5A572; font-size: 16px; margin: 0; text-align: center;">
                      ✨ See what your pet's portrait looks like on canvas
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 35px 0;">
                <tr>
                  <td align="center">
                    <a href="${successPageUrl}" style="display: inline-block; background: linear-gradient(135deg, #C5A572 0%, #A68B5B 100%); color: #0A0A0A; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 16px; font-weight: bold; letter-spacing: 0.5px;">
                      👉 View Your Canvas Print
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #B8B2A8; font-size: 16px; line-height: 1.8; margin: 25px 0 0; text-align: center;">
                Bring your pet's artwork off the screen and onto your wall — beautifully, effortlessly, and delivered straight to your door.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(197, 165, 114, 0.15); text-align: center;">
              <p style="color: #B8B2A8; font-size: 14px; margin: 0 0 15px;">Warmly,</p>
              <p style="color: #C5A572; font-size: 18px; margin: 0 0 5px; font-weight: normal;">The LumePet Team</p>
              <p style="color: #7A756D; font-size: 12px; margin: 15px 0 0;">Royal Pet Portraits</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function getCustomerImageIds(email: string): Promise<string[]> {
  // First check paying_customers table
  const { data: customer, error: customerError } = await supabase
    .from("paying_customers")
    .select("image_ids")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  
  if (customer?.image_ids && customer.image_ids.length > 0) {
    return customer.image_ids;
  }
  
  // Fallback: search metadata table for images associated with this email
  const { data: metadata, error: metaError } = await supabase
    .from("metadata")
    .select("id")
    .eq("email", email.toLowerCase().trim())
    .order("created_at", { ascending: false });
  
  if (metadata && metadata.length > 0) {
    return metadata.map(m => m.id);
  }
  
  return [];
}

async function sendCanvasUpsellEmail(email: string, imageId: string): Promise<boolean> {
  const subject = "Your Pet's Portrait is Now Available on Canvas 🖼️";
  const html = getCanvasUpsellHtml(imageId);
  
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error(`❌ Failed to send to ${email}:`, error);
      return false;
    }

    console.log(`✅ Sent to ${email} (Image: ${imageId}, Email ID: ${data?.id})`);
    return true;
  } catch (err) {
    console.error(`❌ Error sending to ${email}:`, err);
    return false;
  }
}

async function main() {
  console.log("🖼️ Canvas Upsell Email Campaign");
  console.log("================================\n");
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("❌ Missing Supabase credentials in environment");
    process.exit(1);
  }
  
  if (!resendApiKey) {
    console.error("❌ Missing RESEND_API_KEY in environment");
    process.exit(1);
  }
  
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  
  for (const email of targetCustomers) {
    console.log(`\n📧 Processing: ${email}`);
    
    // Get image IDs for this customer
    const imageIds = await getCustomerImageIds(email);
    
    if (imageIds.length === 0) {
      console.log(`   ⚠️ No images found, skipping...`);
      skipped++;
      continue;
    }
    
    // Use the most recent image (first in array since we order desc)
    const imageId = imageIds[0];
    console.log(`   📷 Found ${imageIds.length} image(s), using: ${imageId}`);
    
    // Send the email
    const success = await sendCanvasUpsellEmail(email, imageId);
    if (success) {
      sent++;
    } else {
      failed++;
    }
    
    // Small delay between emails
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("\n================================");
  console.log(`📊 Results: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  console.log("================================\n");
}

main().catch(console.error);

