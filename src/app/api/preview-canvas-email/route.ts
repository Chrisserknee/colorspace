import { NextResponse } from "next/server";

const BASE_URL = "https://lumepet.app";

type EmailStep = 1 | 2 | 3;

const EMAIL_CONFIG: Record<EmailStep, { subject: string; headline: string; subheadline: string; ctaText: string; urgencyText?: string }> = {
  1: {
    subject: "Your Pet's Portrait is Now Available on Canvas 🖼️",
    headline: "Your Portrait on Canvas",
    subheadline: "Museum-Quality • Ready to Hang",
    ctaText: "👉 View Your Canvas Print",
  },
  2: {
    subject: "Still thinking about that canvas print? 🎨",
    headline: "Your Portrait Awaits",
    subheadline: "Handcrafted Canvas Prints",
    ctaText: "👉 See Your Canvas Options",
    urgencyText: "Don't miss out on bringing your pet's artwork to life!",
  },
  3: {
    subject: "Last chance: Get your pet's canvas print 🖼️",
    headline: "Last Chance!",
    subheadline: "Limited Time Canvas Offer",
    ctaText: "👉 Order Your Canvas Now",
    urgencyText: "This is your final reminder — your exclusive canvas offer expires soon!",
  },
};

function getCanvasUpsellHtml(imageId: string, step: EmailStep = 1): string {
  const config = EMAIL_CONFIG[step];
  const successPageUrl = `${BASE_URL}/success?imageId=${imageId}#canvas`;
  
  const urgencySection = config.urgencyText ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 25px 0;">
                <tr>
                  <td style="padding: 15px 20px; background: rgba(197, 165, 114, 0.15); border-radius: 12px; border: 1px solid rgba(197, 165, 114, 0.3);">
                    <p style="color: #C5A572; font-size: 15px; margin: 0; text-align: center; font-weight: bold;">
                      ⏰ ${config.urgencyText}
                    </p>
                  </td>
                </tr>
              </table>` : '';

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
              <h1 style="color: #C5A572; font-size: 28px; margin: 0 0 10px; font-weight: normal; letter-spacing: 1px;">${config.headline}</h1>
              <p style="color: #7A756D; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">${config.subheadline}</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              ${urgencySection}
              
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
                      ${config.ctaText}
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Use a sample image ID for preview, or allow custom via query param
  const imageId = url.searchParams.get("imageId") || "15068052-51d3-4b83-9802-72b7e98f59bf";
  const stepParam = url.searchParams.get("step") || "1";
  const step = (parseInt(stepParam) as EmailStep) || 1;
  
  // Validate step
  const validStep: EmailStep = [1, 2, 3].includes(step) ? step : 1;
  const config = EMAIL_CONFIG[validStep];
  
  // Add navigation header for easy preview switching
  const navHeader = `
    <div style="position: fixed; top: 0; left: 0; right: 0; background: #333; padding: 10px 20px; z-index: 1000; display: flex; gap: 15px; align-items: center;">
      <span style="color: white; font-family: sans-serif; font-size: 14px;">Preview Email:</span>
      <a href="?step=1&imageId=${imageId}" style="color: ${validStep === 1 ? '#C5A572' : '#888'}; font-family: sans-serif; font-size: 14px; text-decoration: none;">Email 1 (1 hour)</a>
      <a href="?step=2&imageId=${imageId}" style="color: ${validStep === 2 ? '#C5A572' : '#888'}; font-family: sans-serif; font-size: 14px; text-decoration: none;">Email 2 (1 day)</a>
      <a href="?step=3&imageId=${imageId}" style="color: ${validStep === 3 ? '#C5A572' : '#888'}; font-family: sans-serif; font-size: 14px; text-decoration: none;">Email 3 (Last Chance)</a>
      <span style="color: #888; font-family: sans-serif; font-size: 12px; margin-left: auto;">Subject: ${config.subject}</span>
    </div>
    <div style="height: 50px;"></div>
  `;
  
  const html = navHeader + getCanvasUpsellHtml(imageId, validStep);
  
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
