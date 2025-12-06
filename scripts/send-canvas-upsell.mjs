/**
 * Canvas Upsell Email Script
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

const BASE_URL = "https://lumepet.app";
const FROM_EMAIL = "LumePet <noreply@lumepet.app>";

const targetCustomers = [
  "chrisserknee@gmail.com",
  "rdeleon6@aol.com",
  "doltongang@cox.net",
  "verbie@comcast.net",
  "carmenwolff@icloud.com",
  "heidi@cypresspointclub.org",
];

function getHtml(imageId) {
  const url = `${BASE_URL}/success?imageId=${imageId}`;
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0A0A0A;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0A0A0A;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border-radius:16px;border:1px solid rgba(197,165,114,0.2);">
<tr><td style="padding:50px 40px 30px;text-align:center;">
<div style="font-size:48px;margin-bottom:20px;">🖼️</div>
<h1 style="color:#C5A572;font-size:28px;margin:0 0 10px;font-weight:normal;">Your Portrait on Canvas</h1>
<p style="color:#7A756D;font-size:14px;margin:0;letter-spacing:2px;text-transform:uppercase;">Museum-Quality • Ready to Hang</p>
</td></tr>
<tr><td style="padding:20px 40px 40px;">
<p style="color:#F0EDE8;font-size:18px;line-height:1.8;margin:0 0 25px;">Hi there,</p>
<p style="color:#B8B2A8;font-size:16px;line-height:1.8;margin:0 0 25px;">Great news! Your pet's digital portrait is now available as a <strong style="color:#F0EDE8;">museum-quality canvas print</strong> — ready to hang and made to last.</p>
<p style="color:#B8B2A8;font-size:16px;line-height:1.8;margin:0 0 30px;">For a limited time, digital portrait customers get special pricing on our handcrafted <strong style="color:#C5A572;">12"×12"</strong> and <strong style="color:#C5A572;">16"×16"</strong> canvas prints. Each piece is produced with archival inks, rich detail, and a gallery finish that makes your pet look truly royal in real life.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
<tr><td style="padding:20px;background:rgba(197,165,114,0.1);border-radius:12px;border:1px solid rgba(197,165,114,0.2);">
<p style="color:#C5A572;font-size:16px;margin:0;text-align:center;">✨ See what your pet's portrait looks like on canvas</p>
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:35px 0;">
<tr><td align="center">
<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#C5A572 0%,#A68B5B 100%);color:#0A0A0A;text-decoration:none;padding:18px 40px;border-radius:50px;font-size:16px;font-weight:bold;">👉 View Your Canvas Print</a>
</td></tr></table>
<p style="color:#B8B2A8;font-size:16px;line-height:1.8;margin:25px 0 0;text-align:center;">Bring your pet's artwork off the screen and onto your wall — beautifully, effortlessly, and delivered straight to your door.</p>
</td></tr>
<tr><td style="padding:30px 40px;border-top:1px solid rgba(197,165,114,0.15);text-align:center;">
<p style="color:#B8B2A8;font-size:14px;margin:0 0 15px;">Warmly,</p>
<p style="color:#C5A572;font-size:18px;margin:0 0 5px;">The LumePet Team</p>
<p style="color:#7A756D;font-size:12px;margin:15px 0 0;">Royal Pet Portraits</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function getImageId(email) {
  const { data } = await supabase
    .from("paying_customers")
    .select("image_ids")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  
  if (data?.image_ids?.[0]) return data.image_ids[0];
  
  const { data: meta } = await supabase
    .from("metadata")
    .select("id")
    .eq("email", email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1);
  
  return meta?.[0]?.id || null;
}

async function main() {
  console.log("🖼️ Canvas Upsell Email Campaign\n");
  
  for (const email of targetCustomers) {
    const imageId = await getImageId(email);
    
    if (!imageId) {
      console.log(`⚠️ ${email} - No image found, skipping`);
      continue;
    }
    
    try {
      const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [email],
        subject: "Your Pet's Portrait is Now Available on Canvas 🖼️",
        html: getHtml(imageId),
      });
      
      if (error) {
        console.log(`❌ ${email} - ${error.message}`);
      } else {
        console.log(`✅ ${email} - Sent (${imageId})`);
      }
    } catch (err) {
      console.log(`❌ ${email} - ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log("\n✨ Done!");
}

main();

