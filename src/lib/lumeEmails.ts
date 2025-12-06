/**
 * LumePet Email Sequence Templates
 * ================================
 * 
 * This module contains all email templates for the lead nurturing sequence.
 * Each email is designed to re-engage users who entered their email but didn't purchase.
 * 
 * Sequence timing:
 * - Email 1: Immediately after email capture
 * - Email 2: 1 day later
 * - Email 3: 3 days later
 * - Email 4: 7 days later
 * - Email 5: 21 days later
 * - Email 6: 30 days later (final)
 * 
 * To customize: Edit the subject lines and HTML bodies below.
 * All emails use inline styles for maximum email client compatibility.
 */

import { Resend } from 'resend';

// Lazy-initialize Resend client to avoid build errors when env var is not set
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// From email address - update if you have a custom domain
const FROM_EMAIL = 'LumePet <noreply@lumepet.app>';

// Base URL for CTAs
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lumepet.app';

// ============================================
// ROYAL CLUB WELCOME EMAIL
// ============================================

/**
 * Send welcome email to new Royal Club subscribers
 */
export async function sendRoyalClubWelcomeEmail(email: string): Promise<{ success: boolean; error?: string }> {
  const subject = "Welcome to the Royal Club! 👑";
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Royal Club</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0A0A0A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1A1A1A; border-radius: 16px; border: 1px solid rgba(197, 165, 114, 0.2);">
          
          <!-- Header with Crown -->
          <tr>
            <td style="padding: 50px 40px 30px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 20px;">👑</div>
              <h1 style="color: #C5A572; font-size: 32px; margin: 0 0 10px; font-weight: normal; letter-spacing: 1px;">Welcome to the Royal Club</h1>
              <p style="color: #7A756D; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">You're officially part of the LumePet family</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="color: #F0EDE8; font-size: 18px; line-height: 1.7; text-align: center; margin: 0 0 30px;">
                Thank you for joining our exclusive community of pet lovers! You're now first in line for:
              </p>
              
              <!-- Benefits List -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td style="padding: 15px 20px; background: rgba(197, 165, 114, 0.08); border-radius: 12px; margin-bottom: 10px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50" style="color: #C5A572; font-size: 24px; vertical-align: top;">🎨</td>
                        <td style="color: #B8B2A8; font-size: 16px;">
                          <strong style="color: #F0EDE8;">New Portrait Styles</strong><br>
                          Be the first to try new artistic styles before anyone else
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 15px 20px; background: rgba(197, 165, 114, 0.08); border-radius: 12px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50" style="color: #C5A572; font-size: 24px; vertical-align: top;">💰</td>
                        <td style="color: #B8B2A8; font-size: 16px;">
                          <strong style="color: #F0EDE8;">Exclusive Discounts</strong><br>
                          Special pricing only for Royal Club members
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 15px 20px; background: rgba(197, 165, 114, 0.08); border-radius: 12px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="50" style="color: #C5A572; font-size: 24px; vertical-align: top;">🎁</td>
                        <td style="color: #B8B2A8; font-size: 16px;">
                          <strong style="color: #F0EDE8;">Monthly Giveaways</strong><br>
                          Chance to win free custom pet portraits every month
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 40px 0;">
                <tr>
                  <td align="center">
                    <a href="${BASE_URL}" style="display: inline-block; background: linear-gradient(135deg, #C5A572 0%, #A68B5B 100%); color: #0A0A0A; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 16px; font-weight: bold; letter-spacing: 0.5px;">
                      Create Your First Portrait
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(197, 165, 114, 0.15); text-align: center;">
              <p style="color: #C5A572; font-size: 18px; margin: 0 0 5px; font-weight: normal;">LumePet</p>
              <p style="color: #7A756D; font-size: 12px; margin: 0 0 15px;">Royal Pet Portraits</p>
              <p style="color: #5A5550; font-size: 11px; margin: 0;">
                You're receiving this because you joined the Royal Club.<br>
                <a href="${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}" style="color: #7A756D;">Unsubscribe</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping welcome email');
      return { success: false, error: 'Email not configured' };
    }

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error(`Failed to send Royal Club welcome email to ${email}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`👑 Royal Club welcome email sent to ${email} (ID: ${data?.id})`);
    return { success: true };
  } catch (err) {
    console.error(`Royal Club welcome email error for ${email}:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// CANVAS UPSELL EMAIL SEQUENCE
// ============================================

type CanvasEmailStep = 1 | 2 | 3;

const CANVAS_EMAIL_CONFIG: Record<CanvasEmailStep, { subject: string; headline: string; subheadline: string; ctaText: string; urgencyText?: string }> = {
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

/**
 * Send canvas upsell email (1 of 3 in sequence)
 */
export async function sendCanvasUpsellEmail(
  email: string, 
  imageId: string, 
  step: CanvasEmailStep = 1
): Promise<{ success: boolean; error?: string }> {
  const config = CANVAS_EMAIL_CONFIG[step];
  const subject = config.subject;
  // Add #canvas anchor to auto-scroll to canvas section
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

  const html = `<!DOCTYPE html>
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

  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping canvas upsell email');
      return { success: false, error: 'Email not configured' };
    }

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject,
      html,
    });

    if (error) {
      console.error(`Failed to send canvas upsell email to ${email}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`🖼️ Canvas upsell email sent to ${email} (ID: ${data?.id})`);
    return { success: true };
  } catch (err) {
    console.error(`Canvas upsell email error for ${email}:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// Lead data type
export interface LumeLead {
  id: string;
  email: string;
  created_at: string;
  context?: {
    style?: string;
    petType?: string;
    petName?: string;
    source?: string;
  } | null;
}

// Email send result type
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================
// EMAIL #1 - IMMEDIATE (Welcome / Your portrait is waiting)
// ============================================
export async function sendLumeEmail1(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Your LumePet portrait is waiting 🐾";
  
  const isRainbowBridge = lead.context?.style === 'rainbow-bridge';
  const petName = lead.context?.petName;
  
  const html = getEmail1HTML(lead.email, isRainbowBridge, petName);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #2 - 1 DAY (Gentle reminder)
// ============================================
export async function sendLumeEmail2(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Still thinking about that portrait? 🎨";
  
  const isRainbowBridge = lead.context?.style === 'rainbow-bridge';
  const petName = lead.context?.petName;
  
  const html = getEmail2HTML(lead.email, isRainbowBridge, petName);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #3 - 3 DAYS (Value proposition)
// ============================================
export async function sendLumeEmail3(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Why pet lovers choose LumePet 👑";
  
  const isRainbowBridge = lead.context?.style === 'rainbow-bridge';
  
  const html = getEmail3HTML(lead.email, isRainbowBridge);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #4 - 7 DAYS (Social proof)
// ============================================
export async function sendLumeEmail4(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Join 10,000+ happy pet parents 🐕";
  
  const html = getEmail4HTML(lead.email);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #5 - 21 DAYS (Limited offer / urgency)
// ============================================
export async function sendLumeEmail5(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "A special offer just for you ✨";
  
  const html = getEmail5HTML(lead.email);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #6 - 30 DAYS (Final / goodbye)
// ============================================
export async function sendLumeEmail6(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "We'll miss you! One last chance 💔";
  
  const html = getEmail6HTML(lead.email);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// HELPER: Send email via Resend
// ============================================
async function sendEmail(to: string, subject: string, html: string): Promise<EmailSendResult> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email not configured' };
    }

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error(`Failed to send email to ${to}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Email sent to ${to}: ${subject} (ID: ${data?.id})`);
    return { success: true, messageId: data?.id };
  } catch (err) {
    console.error(`Email send error to ${to}:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ============================================
// EMAIL TEMPLATES (HTML)
// ============================================

/**
 * Email wrapper with consistent header/footer
 * @param content - The main email content
 * @param isRainbowBridge - Whether to use Rainbow Bridge styling
 */
function wrapEmail(content: string, isRainbowBridge: boolean = false): string {
  const bgColor = isRainbowBridge ? '#FEFEFE' : '#1A1A1A';
  const cardBg = isRainbowBridge ? '#FFFFFF' : '#242424';
  const borderColor = isRainbowBridge ? 'rgba(212, 175, 55, 0.2)' : 'rgba(197, 165, 114, 0.2)';
  const accentColor = isRainbowBridge ? '#D4AF37' : '#C5A572';
  const textColor = isRainbowBridge ? '#4A4A4A' : '#F0EDE8';
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  const mutedColor = isRainbowBridge ? '#9B8AA0' : '#7A756D';
  const headerTitle = isRainbowBridge ? '🌈 Rainbow Bridge' : '👑 LumePet';
  const headerSubtitle = isRainbowBridge ? 'Memorial Portraits by LumePet' : 'Royal Pet Portraits';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LumePet</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${bgColor}; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${bgColor}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${cardBg}; border-radius: 16px; border: 1px solid ${borderColor};">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="color: ${accentColor}; font-size: 28px; margin: 0 0 10px; font-weight: normal;">${headerTitle}</h1>
              <p style="color: ${mutedColor}; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">${headerSubtitle}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px 40px; color: ${textColor};">
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid ${borderColor}; text-align: center;">
              <p style="color: ${mutedColor}; font-size: 12px; margin: 0 0 10px;">
                Questions? Reply to this email or visit <a href="${BASE_URL}" style="color: ${accentColor};">lumepet.app</a>
              </p>
              <p style="color: ${mutedColor}; font-size: 11px; margin: 0 0 10px;">
                © ${new Date().getFullYear()} LumePet. All rights reserved.
              </p>
              <p style="color: ${mutedColor}; font-size: 10px; margin: 0;">
                <a href="${BASE_URL}/unsubscribe?email=__EMAIL__" style="color: ${mutedColor};">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.replace(/__EMAIL__/g, encodeURIComponent(''));
}

function getCTAButton(text: string, url: string, isRainbowBridge: boolean = false): string {
  const gradient = isRainbowBridge 
    ? 'linear-gradient(135deg, #D4AF37 0%, #E6C866 50%, #D4AF37 100%)'
    : 'linear-gradient(135deg, #C5A572 0%, #D4B896 50%, #C5A572 100%)';
  const textColor = isRainbowBridge ? '#FFFFFF' : '#1A1A1A';
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
      <tr>
        <td align="center">
          <a href="${url}" style="display: inline-block; background: ${gradient}; color: ${textColor}; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
            ${text}
          </a>
        </td>
      </tr>
    </table>
  `;
}

// ============================================
// INDIVIDUAL EMAIL HTML GENERATORS
// ============================================

function getEmail1HTML(email: string, isRainbowBridge: boolean, petName?: string): string {
  const continueUrl = `${BASE_URL}${isRainbowBridge ? '/rainbow-bridge' : ''}?email=${encodeURIComponent(email)}`;
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  
  const greeting = petName 
    ? `We noticed you started creating ${petName}'s portrait but didn't finish.`
    : isRainbowBridge 
      ? "We noticed you started creating a memorial portrait but didn't finish."
      : "We noticed you started creating a royal portrait for your pet but didn't finish.";
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Your Portrait is Waiting!</h2>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      ${greeting}
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 10px; color: ${subtextColor};">
      ${isRainbowBridge 
        ? "Your beloved companion deserves a beautiful memorial. Come back and complete your portrait – we'll keep your progress saved."
        : "Your furry friend deserves to be immortalized as royalty! Come back and complete your portrait – we'll keep your progress saved."
      }
    </p>
    
    ${getCTAButton('Continue My Portrait', continueUrl, isRainbowBridge)}
    
    <p style="font-size: 14px; text-align: center; color: ${subtextColor}; margin: 0;">
      This link will take you right back to where you left off.
    </p>
  `;
  
  return wrapEmail(content, isRainbowBridge);
}

function getEmail2HTML(email: string, isRainbowBridge: boolean, petName?: string): string {
  const continueUrl = `${BASE_URL}${isRainbowBridge ? '/rainbow-bridge' : ''}?email=${encodeURIComponent(email)}`;
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Still Thinking About It?</h2>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      We get it – choosing the perfect portrait for ${petName || 'your pet'} is a big decision! 
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 10px; color: ${subtextColor};">
      ${isRainbowBridge 
        ? "We create stunning memorial portraits that capture your pet's spirit in a beautiful, heavenly setting. Each one is unique and created with love."
        : "We create museum-quality royal portraits that transform your pet into aristocratic nobility. Each one is unique and absolutely adorable."
      }
    </p>
    
    ${getCTAButton('See My Portrait Preview', continueUrl, isRainbowBridge)}
  `;
  
  return wrapEmail(content, isRainbowBridge);
}

function getEmail3HTML(email: string, isRainbowBridge: boolean): string {
  const continueUrl = `${BASE_URL}${isRainbowBridge ? '/rainbow-bridge' : ''}?email=${encodeURIComponent(email)}`;
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  const accentColor = isRainbowBridge ? '#D4AF37' : '#C5A572';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Why Pet Lovers Choose LumePet</h2>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; text-align: center;">
          <p style="font-size: 24px; margin: 0 0 10px;">🎨</p>
          <p style="font-size: 14px; font-weight: bold; color: ${accentColor}; margin: 0 0 5px;">Stunning Artistry</p>
          <p style="font-size: 13px; color: ${subtextColor}; margin: 0;">Museum-quality portraits in seconds</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 15px; text-align: center;">
          <p style="font-size: 24px; margin: 0 0 10px;">❤️</p>
          <p style="font-size: 14px; font-weight: bold; color: ${accentColor}; margin: 0 0 5px;">Made with Love</p>
          <p style="font-size: 13px; color: ${subtextColor}; margin: 0;">Every portrait captures your pet's unique personality</p>
        </td>
      </tr>
      <tr>
        <td style="padding: 15px; text-align: center;">
          <p style="font-size: 24px; margin: 0 0 10px;">🖼️</p>
          <p style="font-size: 14px; font-weight: bold; color: ${accentColor}; margin: 0 0 5px;">Print-Ready Quality</p>
          <p style="font-size: 13px; color: ${subtextColor}; margin: 0;">4K resolution files perfect for framing</p>
        </td>
      </tr>
    </table>
    
    ${getCTAButton('Create My Portrait', continueUrl, isRainbowBridge)}
  `;
  
  return wrapEmail(content, isRainbowBridge);
}

function getEmail4HTML(email: string): string {
  const continueUrl = `${BASE_URL}?email=${encodeURIComponent(email)}`;
  const subtextColor = '#B8B2A8';
  const accentColor = '#C5A572';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Join 10,000+ Happy Pet Parents</h2>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 30px; color: ${subtextColor};">
      See what our customers are saying about their LumePet portraits:
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(197, 165, 114, 0.1); border-radius: 12px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 14px; font-style: italic; color: ${subtextColor}; margin: 0 0 10px;">
            "I couldn't believe how accurate the portrait was! It captured my dog's personality perfectly. Now it's framed in my living room!"
          </p>
          <p style="font-size: 12px; color: ${accentColor}; margin: 0;">— Sarah M. ⭐⭐⭐⭐⭐</p>
        </td>
      </tr>
    </table>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(197, 165, 114, 0.1); border-radius: 12px; margin: 20px 0;">
      <tr>
        <td style="padding: 20px;">
          <p style="font-size: 14px; font-style: italic; color: ${subtextColor}; margin: 0 0 10px;">
            "The Rainbow Bridge memorial for my cat brought tears to my eyes. Such a beautiful way to remember her."
          </p>
          <p style="font-size: 12px; color: ${accentColor}; margin: 0;">— Michael R. ⭐⭐⭐⭐⭐</p>
        </td>
      </tr>
    </table>
    
    ${getCTAButton('Create My Portrait', continueUrl, false)}
  `;
  
  return wrapEmail(content, false);
}

function getEmail5HTML(email: string): string {
  const continueUrl = `${BASE_URL}?email=${encodeURIComponent(email)}`;
  const subtextColor = '#B8B2A8';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">A Special Offer Just for You ✨</h2>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      We noticed you haven't completed your portrait yet. We'd love to see your pet transformed into royalty!
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background: rgba(197, 165, 114, 0.15); border-radius: 12px; border: 2px dashed #C5A572; margin: 20px 0;">
      <tr>
        <td style="padding: 25px; text-align: center;">
          <p style="font-size: 14px; color: #7A756D; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 1px;">Limited Time Offer</p>
          <p style="font-size: 28px; color: #C5A572; margin: 0 0 10px; font-weight: bold;">Try Free Preview</p>
          <p style="font-size: 14px; color: ${subtextColor}; margin: 0;">See your pet's portrait before you buy!</p>
        </td>
      </tr>
    </table>
    
    ${getCTAButton('Claim My Free Preview', continueUrl, false)}
    
    <p style="font-size: 12px; text-align: center; color: #7A756D; margin: 20px 0 0;">
      No payment required to see your preview.
    </p>
  `;
  
  return wrapEmail(content, false);
}

function getEmail6HTML(email: string): string {
  const continueUrl = `${BASE_URL}?email=${encodeURIComponent(email)}`;
  const subtextColor = '#B8B2A8';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">We'll Miss You! 💔</h2>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      This is our last email – we don't want to bother you if you're not interested.
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      But if you ever want to immortalize your pet as royalty, we'll be here. Just visit lumepet.app anytime!
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 10px; color: ${subtextColor};">
      In the meantime, here's one last chance to see your pet transformed:
    </p>
    
    ${getCTAButton('One Last Look', continueUrl, false)}
    
    <p style="font-size: 14px; text-align: center; color: #7A756D; margin: 20px 0 0;">
      Thanks for considering LumePet. We wish you and your furry friend all the best! 🐾
    </p>
  `;
  
  return wrapEmail(content, false);
}

// ============================================
// EMAIL STEP DISPATCHER
// ============================================

/**
 * Send the appropriate email based on step number
 */
export async function sendLumeEmailByStep(step: number, lead: LumeLead): Promise<EmailSendResult> {
  switch (step) {
    case 1:
      return sendLumeEmail1(lead);
    case 2:
      return sendLumeEmail2(lead);
    case 3:
      return sendLumeEmail3(lead);
    case 4:
      return sendLumeEmail4(lead);
    case 5:
      return sendLumeEmail5(lead);
    case 6:
      return sendLumeEmail6(lead);
    default:
      return { success: false, error: `Unknown email step: ${step}` };
  }
}

/**
 * Get the day offset for each email step
 */
export const EMAIL_SCHEDULE = {
  1: 0,   // Immediately
  2: 1,   // 1 day
  3: 3,   // 3 days
  4: 7,   // 7 days
  5: 21,  // 21 days
  6: 30,  // 30 days
} as const;

