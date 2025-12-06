// TikTok Events API - Server-side tracking
// More reliable than browser pixel, can't be blocked by ad blockers

const TIKTOK_ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const TIKTOK_PIXEL_ID = process.env.TIKTOK_PIXEL_ID || "D4QAPOJC77UDLT7UQ8O0";
const TIKTOK_API_URL = "https://business-api.tiktok.com/open_api/v1.3/event/track/";

interface TikTokEventParams {
  event: string;
  event_id?: string;
  timestamp?: string;
  email?: string;
  phone?: string;
  content_id?: string;
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
  quantity?: number;
  ip?: string;
  user_agent?: string;
}

/**
 * Hash email for TikTok (SHA256)
 */
async function hashEmail(email: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Send event to TikTok Events API
 */
export async function trackTikTokServerEvent(params: TikTokEventParams): Promise<boolean> {
  if (!TIKTOK_ACCESS_TOKEN) {
    console.warn("⚠️ TikTok Events API: No access token configured");
    return false;
  }

  try {
    const eventTime = params.timestamp || new Date().toISOString();
    const eventId = params.event_id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build user data with hashed email if provided
    const userData: Record<string, string> = {};
    if (params.email) {
      userData.email = await hashEmail(params.email);
    }
    if (params.ip) {
      userData.ip = params.ip;
    }
    if (params.user_agent) {
      userData.user_agent = params.user_agent;
    }

    // Build properties/contents
    const properties: Record<string, unknown> = {
      currency: params.currency || "USD",
    };
    
    if (params.value) {
      properties.value = params.value;
    }
    
    if (params.content_id || params.content_name) {
      properties.contents = [{
        content_id: params.content_id || "product",
        content_type: params.content_type || "product",
        content_name: params.content_name || "Pet Portrait",
        quantity: params.quantity || 1,
        price: params.value || 0,
      }];
    }

    const payload = {
      pixel_code: TIKTOK_PIXEL_ID,
      event: params.event,
      event_id: eventId,
      timestamp: eventTime,
      context: {
        user: userData,
        page: {
          url: "https://lumepet.app",
        },
      },
      properties,
    };

    console.log(`📱 TikTok Server Event: ${params.event}`, JSON.stringify(payload, null, 2));

    const response = await fetch(TIKTOK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Access-Token": TIKTOK_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        data: [payload],
      }),
    });

    const result = await response.json();

    if (response.ok && result.code === 0) {
      console.log(`✅ TikTok Server Event sent: ${params.event}`);
      return true;
    } else {
      console.error(`❌ TikTok Server Event failed:`, result);
      return false;
    }
  } catch (error) {
    console.error("❌ TikTok Server Event error:", error);
    return false;
  }
}

/**
 * Track CompletePayment event server-side
 */
export async function trackServerCompletePayment(params: {
  email?: string;
  value: number;
  content_id?: string;
  content_name?: string;
  order_id?: string;
  ip?: string;
  user_agent?: string;
}): Promise<boolean> {
  return trackTikTokServerEvent({
    event: "CompletePayment",
    event_id: params.order_id || `purchase-${Date.now()}`,
    email: params.email,
    value: params.value,
    currency: "USD",
    content_id: params.content_id,
    content_name: params.content_name,
    content_type: "product",
    quantity: 1,
    ip: params.ip,
    user_agent: params.user_agent,
  });
}

/**
 * Track AddToCart event server-side
 */
export async function trackServerAddToCart(params: {
  email?: string;
  value: number;
  content_id?: string;
  content_name?: string;
}): Promise<boolean> {
  return trackTikTokServerEvent({
    event: "AddToCart",
    email: params.email,
    value: params.value,
    currency: "USD",
    content_id: params.content_id,
    content_name: params.content_name,
    content_type: "product",
    quantity: 1,
  });
}

