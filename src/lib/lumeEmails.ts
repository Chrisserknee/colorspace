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

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// From email address - update if you have a custom domain
const FROM_EMAIL = 'LumePet <noreply@lumepet.app>';

// Base URL for CTAs
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://lumepet.app';

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
    previewUrl?: string;      // Generated portrait preview URL
    uploadedImageUrl?: string; // Original pet photo URL
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
  const previewUrl = lead.context?.previewUrl;
  
  const html = getEmail1HTML(lead.email, isRainbowBridge, petName, previewUrl);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #2 - 1 DAY (Gentle reminder)
// ============================================
export async function sendLumeEmail2(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Still thinking about that portrait? 🎨";
  
  const isRainbowBridge = lead.context?.style === 'rainbow-bridge';
  const petName = lead.context?.petName;
  const previewUrl = lead.context?.previewUrl;
  
  const html = getEmail2HTML(lead.email, isRainbowBridge, petName, previewUrl);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #3 - 3 DAYS (Value proposition)
// ============================================
export async function sendLumeEmail3(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Why pet lovers choose LumePet 👑";
  
  const isRainbowBridge = lead.context?.style === 'rainbow-bridge';
  const previewUrl = lead.context?.previewUrl;
  
  const html = getEmail3HTML(lead.email, isRainbowBridge, previewUrl);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #4 - 7 DAYS (Social proof)
// ============================================
export async function sendLumeEmail4(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "Join 10,000+ happy pet parents 🐕";
  
  const previewUrl = lead.context?.previewUrl;
  
  const html = getEmail4HTML(lead.email, previewUrl);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #5 - 21 DAYS (Limited offer / urgency)
// ============================================
export async function sendLumeEmail5(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "A special offer just for you ✨";
  
  const previewUrl = lead.context?.previewUrl;
  const petName = lead.context?.petName;
  
  const html = getEmail5HTML(lead.email, previewUrl, petName);
  
  return sendEmail(lead.email, subject, html);
}

// ============================================
// EMAIL #6 - 30 DAYS (Final / goodbye)
// ============================================
export async function sendLumeEmail6(lead: LumeLead): Promise<EmailSendResult> {
  const subject = "We'll miss you! One last chance 💔";
  
  const previewUrl = lead.context?.previewUrl;
  const petName = lead.context?.petName;
  
  const html = getEmail6HTML(lead.email, previewUrl, petName);
  
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

    const { data, error } = await resend.emails.send({
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

/**
 * Generates HTML for displaying the pet portrait preview image
 * Uses a cute frame/border with shadow effect
 */
function getPetPortraitImage(previewUrl: string | undefined, isRainbowBridge: boolean = false, petName?: string): string {
  if (!previewUrl) return '';
  
  const borderColor = isRainbowBridge ? '#D4AF37' : '#C5A572';
  const shadowColor = isRainbowBridge ? 'rgba(212, 175, 55, 0.3)' : 'rgba(197, 165, 114, 0.3)';
  const caption = petName ? `${petName}'s Portrait` : 'Your Pet\'s Portrait';
  const captionColor = isRainbowBridge ? '#9B8AA0' : '#7A756D';
  
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 25px 0;">
      <tr>
        <td align="center">
          <div style="display: inline-block; padding: 8px; background: linear-gradient(135deg, ${borderColor} 0%, ${isRainbowBridge ? '#E6C866' : '#D4B896'} 50%, ${borderColor} 100%); border-radius: 16px; box-shadow: 0 8px 30px ${shadowColor};">
            <img 
              src="${previewUrl}" 
              alt="${caption}" 
              width="200" 
              height="200" 
              style="display: block; border-radius: 12px; object-fit: cover;"
            />
          </div>
          <p style="font-size: 12px; color: ${captionColor}; margin: 12px 0 0; font-style: italic;">
            ✨ ${caption} ✨
          </p>
        </td>
      </tr>
    </table>
  `;
}

// ============================================
// INDIVIDUAL EMAIL HTML GENERATORS
// ============================================

function getEmail1HTML(email: string, isRainbowBridge: boolean, petName?: string, previewUrl?: string): string {
  const continueUrl = `${BASE_URL}${isRainbowBridge ? '/rainbow-bridge' : ''}?email=${encodeURIComponent(email)}`;
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  
  const greeting = petName 
    ? `We noticed you started creating ${petName}'s portrait but didn't finish.`
    : isRainbowBridge 
      ? "We noticed you started creating a memorial portrait but didn't finish."
      : "We noticed you started creating a royal portrait for your pet but didn't finish.";
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Your Portrait is Waiting!</h2>
    
    ${getPetPortraitImage(previewUrl, isRainbowBridge, petName)}
    
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

function getEmail2HTML(email: string, isRainbowBridge: boolean, petName?: string, previewUrl?: string): string {
  const continueUrl = `${BASE_URL}${isRainbowBridge ? '/rainbow-bridge' : ''}?email=${encodeURIComponent(email)}`;
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Still Thinking About It?</h2>
    
    ${getPetPortraitImage(previewUrl, isRainbowBridge, petName)}
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      We get it – choosing the perfect portrait for ${petName || 'your pet'} is a big decision! 
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 10px; color: ${subtextColor};">
      ${isRainbowBridge 
        ? "Our AI creates stunning memorial portraits that capture your pet's spirit in a beautiful, heavenly setting. Each one is unique and created with love."
        : "Our AI creates museum-quality royal portraits that transform your pet into aristocratic nobility. Each one is unique and absolutely adorable."
      }
    </p>
    
    ${getCTAButton('See My Portrait Preview', continueUrl, isRainbowBridge)}
  `;
  
  return wrapEmail(content, isRainbowBridge);
}

function getEmail3HTML(email: string, isRainbowBridge: boolean, previewUrl?: string): string {
  const continueUrl = `${BASE_URL}${isRainbowBridge ? '/rainbow-bridge' : ''}?email=${encodeURIComponent(email)}`;
  const subtextColor = isRainbowBridge ? '#6B6B6B' : '#B8B2A8';
  const accentColor = isRainbowBridge ? '#D4AF37' : '#C5A572';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Why Pet Lovers Choose LumePet</h2>
    
    ${getPetPortraitImage(previewUrl, isRainbowBridge)}
    
    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
      <tr>
        <td style="padding: 15px; text-align: center;">
          <p style="font-size: 24px; margin: 0 0 10px;">🎨</p>
          <p style="font-size: 14px; font-weight: bold; color: ${accentColor}; margin: 0 0 5px;">AI-Powered Art</p>
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
          <p style="font-size: 13px; color: ${subtextColor}; margin: 0;">High-resolution files perfect for framing</p>
        </td>
      </tr>
    </table>
    
    ${getCTAButton('Create My Portrait', continueUrl, isRainbowBridge)}
  `;
  
  return wrapEmail(content, isRainbowBridge);
}

function getEmail4HTML(email: string, previewUrl?: string): string {
  const continueUrl = `${BASE_URL}?email=${encodeURIComponent(email)}`;
  const subtextColor = '#B8B2A8';
  const accentColor = '#C5A572';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">Join 10,000+ Happy Pet Parents</h2>
    
    ${getPetPortraitImage(previewUrl, false)}
    
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

function getEmail5HTML(email: string, previewUrl?: string, petName?: string): string {
  const continueUrl = `${BASE_URL}?email=${encodeURIComponent(email)}`;
  const subtextColor = '#B8B2A8';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">A Special Offer Just for You ✨</h2>
    
    ${getPetPortraitImage(previewUrl, false, petName)}
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      We noticed you haven't completed your portrait yet. We'd love to see ${petName ? petName : 'your pet'} transformed into royalty!
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

function getEmail6HTML(email: string, previewUrl?: string, petName?: string): string {
  const continueUrl = `${BASE_URL}?email=${encodeURIComponent(email)}`;
  const subtextColor = '#B8B2A8';
  
  const content = `
    <h2 style="font-size: 24px; text-align: center; margin: 0 0 20px;">We'll Miss You! 💔</h2>
    
    ${getPetPortraitImage(previewUrl, false, petName)}
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      This is our last email – we don't want to bother you if you're not interested.
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 20px; color: ${subtextColor};">
      But if you ever want to immortalize ${petName ? petName : 'your pet'} as royalty, we'll be here. Just visit lumepet.app anytime!
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 10px; color: ${subtextColor};">
      In the meantime, here's one last chance to see ${petName ? petName + "'s portrait" : 'your pet transformed'}:
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

