import { NextResponse } from "next/server";

const BASE_URL = "https://lumepet.app";

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

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Use a sample image ID for preview, or allow custom via query param
  const imageId = url.searchParams.get("imageId") || "15068052-51d3-4b83-9802-72b7e98f59bf";
  
  const html = getCanvasUpsellHtml(imageId);
  
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

