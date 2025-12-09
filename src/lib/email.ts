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

const FROM_EMAIL = 'LumePet <noreply@lumepet.app>';

interface SendPortraitEmailParams {
  to: string;
  confirmationId: string;
  downloadUrl: string;
  isRainbowBridge?: boolean;
  petName?: string;
}

export async function sendPortraitEmail({
  to,
  confirmationId,
  downloadUrl,
  isRainbowBridge = false,
  petName,
}: SendPortraitEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping email');
      return { success: false, error: 'Email not configured' };
    }

    const subject = isRainbowBridge
      ? `${petName ? `${petName}'s ` : ''}Rainbow Bridge Portrait is Ready 🌈`
      : 'Your LumePet Royal Portrait is Ready! 👑';

    const htmlContent = isRainbowBridge
      ? getRainbowBridgeEmailHTML(confirmationId, downloadUrl, petName)
      : getRegularEmailHTML(confirmationId, downloadUrl);

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html: htmlContent,
    });

    if (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }

    console.log('Email sent successfully:', data?.id);
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function getRegularEmailHTML(confirmationId: string, downloadUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your LumePet Portrait is Ready!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1A; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1A1A1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #242424; border-radius: 16px; border: 1px solid rgba(197, 165, 114, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="color: #C5A572; font-size: 28px; margin: 0 0 10px; font-weight: normal;">👑 LumePet</h1>
              <p style="color: #B8B2A8; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Royal Pet Portraits</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <h2 style="color: #F0EDE8; font-size: 24px; text-align: center; margin: 0 0 20px;">Your Royal Portrait is Ready!</h2>
              
              <p style="color: #B8B2A8; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 30px;">
                Thank you for your purchase! Your pet has been immortalized as royalty. Click the button below to download your masterpiece.
              </p>
              
              <!-- Confirmation Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(197, 165, 114, 0.1); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="color: #7A756D; font-size: 12px; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 1px;">Confirmation Number</p>
                    <p style="color: #C5A572; font-size: 18px; margin: 0; font-family: monospace;">${confirmationId}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Download Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #C5A572 0%, #D4B896 50%, #C5A572 100%); color: #1A1A1A; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      Download Your Portrait
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #7A756D; font-size: 14px; text-align: center; margin: 30px 0 0;">
                This download link will be available for 7 days.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(197, 165, 114, 0.1); text-align: center;">
              <p style="color: #7A756D; font-size: 12px; margin: 0 0 10px;">
                Questions? Reply to this email or visit <a href="https://lumepet.app" style="color: #C5A572;">lumepet.app</a>
              </p>
              <p style="color: #5A5A5A; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} LumePet. All rights reserved.
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

function getRainbowBridgeEmailHTML(confirmationId: string, downloadUrl: string, petName?: string): string {
  const petNameText = petName ? `${petName}'s` : 'Your';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rainbow Bridge Memorial Portrait</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FEFEFE; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #FEFEFE; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #FFFFFF; border-radius: 16px; border: 1px solid rgba(212, 175, 55, 0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="color: #D4AF37; font-size: 28px; margin: 0 0 10px; font-weight: normal;">🌈 Rainbow Bridge</h1>
              <p style="color: #9B8AA0; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Memorial Portraits by LumePet</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <h2 style="color: #4A4A4A; font-size: 24px; text-align: center; margin: 0 0 20px;">${petNameText} Memorial Portrait is Ready</h2>
              
              <p style="color: #6B6B6B; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 30px;">
                Thank you for honoring your beloved companion with this memorial portrait. ${petName ? petName : 'They'} will always hold a special place in your heart.
              </p>
              
              <!-- Quote -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center; font-style: italic;">
                    <p style="color: #9B8AA0; font-size: 15px; margin: 0; line-height: 1.6;">
                      "Until we meet again at the Bridge, run free, sweet soul."
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- Confirmation Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(212, 175, 55, 0.08); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <p style="color: #8B8B8B; font-size: 12px; margin: 0 0 5px; text-transform: uppercase; letter-spacing: 1px;">Confirmation Number</p>
                    <p style="color: #D4AF37; font-size: 18px; margin: 0; font-family: monospace;">${confirmationId}</p>
                  </td>
                </tr>
              </table>
              
              <!-- Download Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #D4AF37 0%, #E6C866 50%, #D4AF37 100%); color: #FFFFFF; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      Download Memorial Portrait
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #9B8AA0; font-size: 14px; text-align: center; margin: 30px 0 0;">
                This download link will be available for 7 days.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(212, 175, 55, 0.1); text-align: center;">
              <p style="color: #9B8AA0; font-size: 12px; margin: 0 0 10px;">
                With love from the <a href="https://lumepet.app" style="color: #D4AF37;">LumePet</a> team
              </p>
              <p style="color: #BEBEBE; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} LumePet. In loving memory of all pets who have crossed the Rainbow Bridge.
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

interface SendCanvasOrderConfirmationEmailParams {
  to: string;
  orderId: string;
  printifyOrderId: string;
  canvasSize: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  petName?: string;
}

export async function sendCanvasOrderConfirmationEmail({
  to,
  orderId,
  printifyOrderId,
  canvasSize,
  shippingAddress,
  petName,
}: SendCanvasOrderConfirmationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping canvas confirmation email');
      return { success: false, error: 'Email not configured' };
    }

    const subject = `Your Canvas Order Confirmation 🖼️ - Order #${orderId.slice(-8)}`;
    const html = getCanvasOrderConfirmationHTML({
      orderId,
      printifyOrderId,
      canvasSize,
      shippingAddress,
      petName,
    });

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Failed to send canvas confirmation email:', error);
      return { success: false, error: error.message };
    }

    console.log('Canvas confirmation email sent successfully:', data?.id);
    return { success: true };
  } catch (err) {
    console.error('Canvas confirmation email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

interface SendCanvasShippedEmailParams {
  to: string;
  orderId: string;
  printifyOrderId: string;
  canvasSize: string;
  trackingNumber?: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  petName?: string;
}

export async function sendCanvasShippedEmail({
  to,
  orderId,
  printifyOrderId,
  canvasSize,
  trackingNumber,
  shippingAddress,
  petName,
}: SendCanvasShippedEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY not configured, skipping canvas shipped email');
      return { success: false, error: 'Email not configured' };
    }

    const subject = `Your Canvas Print Has Shipped! 🚚 - Order #${orderId.slice(-8)}`;
    const html = getCanvasShippedHTML({
      orderId,
      printifyOrderId,
      canvasSize,
      trackingNumber,
      shippingAddress,
      petName,
    });

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error('Failed to send canvas shipped email:', error);
      return { success: false, error: error.message };
    }

    console.log('Canvas shipped email sent successfully:', data?.id);
    return { success: true };
  } catch (err) {
    console.error('Canvas shipped email send error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function getCanvasOrderConfirmationHTML(params: {
  orderId: string;
  printifyOrderId: string;
  canvasSize: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  petName?: string;
}): string {
  const { orderId, printifyOrderId, canvasSize, shippingAddress, petName } = params;
  const displaySize = canvasSize === '16x16' ? '16" × 16"' : '12" × 12"';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Canvas Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1A; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1A1A1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #242424; border-radius: 16px; border: 1px solid rgba(197, 165, 114, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="color: #C5A572; font-size: 28px; margin: 0 0 10px; font-weight: normal;">👑 LumePet</h1>
              <p style="color: #B8B2A8; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Royal Pet Portraits</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <h2 style="color: #F0EDE8; font-size: 24px; text-align: center; margin: 0 0 20px;">Order Confirmed! 🖼️</h2>
              
              <p style="color: #B8B2A8; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 30px;">
                Thank you for your order! ${petName ? `We're preparing ${petName}'s` : "We're preparing your"} royal canvas print and will send it to production soon.
              </p>
              
              <!-- Order Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(197, 165, 114, 0.1); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #7A756D; font-size: 12px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Order Number</p>
                    <p style="color: #C5A572; font-size: 18px; margin: 0 0 20px; font-family: monospace;">#${orderId.slice(-8)}</p>
                    
                    <p style="color: #7A756D; font-size: 12px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px;">Canvas Size</p>
                    <p style="color: #F0EDE8; font-size: 16px; margin: 0 0 20px;">${displaySize} Premium Canvas</p>
                    
                    <p style="color: #7A756D; font-size: 12px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px;">Shipping To</p>
                    <p style="color: #F0EDE8; font-size: 14px; margin: 0; line-height: 1.6;">
                      ${shippingAddress.name}<br>
                      ${shippingAddress.line1}${shippingAddress.line2 ? `<br>${shippingAddress.line2}` : ''}<br>
                      ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postalCode}<br>
                      ${shippingAddress.country}
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #B8B2A8; font-size: 15px; line-height: 1.7; margin: 0 0 15px; text-align: center;">
                Your order is currently being reviewed. Once approved, we'll send it to production and you'll receive a shipping notification with tracking information.
              </p>
              
              <p style="color: #7A756D; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Estimated delivery: 5-7 business days after production begins
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(197, 165, 114, 0.1); text-align: center;">
              <p style="color: #7A756D; font-size: 12px; margin: 0 0 10px;">
                Questions? Reply to this email or visit <a href="https://lumepet.app" style="color: #C5A572;">lumepet.app</a>
              </p>
              <p style="color: #5A5A5A; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} LumePet. All rights reserved.
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

function getCanvasShippedHTML(params: {
  orderId: string;
  printifyOrderId: string;
  canvasSize: string;
  trackingNumber?: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  petName?: string;
}): string {
  const { orderId, printifyOrderId, canvasSize, trackingNumber, shippingAddress, petName } = params;
  const displaySize = canvasSize === '16x16' ? '16" × 16"' : '12" × 12"';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Canvas Has Shipped!</title>
</head>
<body style="margin: 0; padding: 0; background-color: #1A1A1A; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1A1A1A; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #242424; border-radius: 16px; border: 1px solid rgba(197, 165, 114, 0.2);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="color: #C5A572; font-size: 28px; margin: 0 0 10px; font-weight: normal;">👑 LumePet</h1>
              <p style="color: #B8B2A8; font-size: 14px; margin: 0; letter-spacing: 2px; text-transform: uppercase;">Royal Pet Portraits</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <h2 style="color: #F0EDE8; font-size: 24px; text-align: center; margin: 0 0 20px;">Your Canvas Has Shipped! 🚚</h2>
              
              <p style="color: #B8B2A8; font-size: 16px; line-height: 1.6; text-align: center; margin: 0 0 30px;">
                Great news! ${petName ? `${petName}'s` : "Your"} royal canvas print is on its way to you.
              </p>
              
              <!-- Order Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: rgba(197, 165, 114, 0.1); border-radius: 12px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #7A756D; font-size: 12px; margin: 0 0 10px; text-transform: uppercase; letter-spacing: 1px;">Order Number</p>
                    <p style="color: #C5A572; font-size: 18px; margin: 0 0 20px; font-family: monospace;">#${orderId.slice(-8)}</p>
                    
                    <p style="color: #7A756D; font-size: 12px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px;">Canvas Size</p>
                    <p style="color: #F0EDE8; font-size: 16px; margin: 0 0 20px;">${displaySize} Premium Canvas</p>
                    
                    ${trackingNumber ? `
                    <p style="color: #7A756D; font-size: 12px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px;">Tracking Number</p>
                    <p style="color: #C5A572; font-size: 16px; margin: 0 0 20px; font-family: monospace;">${trackingNumber}</p>
                    ` : ''}
                    
                    <p style="color: #7A756D; font-size: 12px; margin: 20px 0 10px; text-transform: uppercase; letter-spacing: 1px;">Shipping To</p>
                    <p style="color: #F0EDE8; font-size: 14px; margin: 0; line-height: 1.6;">
                      ${shippingAddress.name}<br>
                      ${shippingAddress.line1}${shippingAddress.line2 ? `<br>${shippingAddress.line2}` : ''}<br>
                      ${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.postalCode}<br>
                      ${shippingAddress.country}
                    </p>
                  </td>
                </tr>
              </table>
              
              <p style="color: #B8B2A8; font-size: 15px; line-height: 1.7; margin: 0 0 15px; text-align: center;">
                Your canvas is being printed and will be shipped within 2-3 business days. ${trackingNumber ? 'Use the tracking number above to follow your shipment.' : 'You\'ll receive tracking information once it ships.'}
              </p>
              
              <p style="color: #7A756D; font-size: 14px; text-align: center; margin: 30px 0 0;">
                Estimated delivery: 5-7 business days
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; border-top: 1px solid rgba(197, 165, 114, 0.1); text-align: center;">
              <p style="color: #7A756D; font-size: 12px; margin: 0 0 10px;">
                Questions? Reply to this email or visit <a href="https://lumepet.app" style="color: #C5A572;">lumepet.app</a>
              </p>
              <p style="color: #5A5A5A; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} LumePet. All rights reserved.
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
}

