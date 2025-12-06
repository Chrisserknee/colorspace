// TikTok Pixel tracking utilities

declare global {
  interface Window {
    ttq?: {
      track: (event: string, params?: Record<string, unknown>) => void;
      page: () => void;
      identify: (params: Record<string, unknown>) => void;
    };
  }
}

/**
 * Track TikTok Pixel events
 */
export function trackTikTokEvent(
  event: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== "undefined" && window.ttq) {
    try {
      window.ttq.track(event, params);
      console.log(`📱 TikTok Pixel: ${event}`, params);
    } catch (err) {
      console.warn("TikTok Pixel tracking failed:", err);
    }
  }
}

/**
 * Track Add to Cart - when user clicks "Download Now" to initiate checkout
 */
export function trackTikTokAddToCart(params?: {
  content_id?: string;
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  trackTikTokEvent("AddToCart", {
    content_type: "product",
    content_name: "Pet Portrait",
    currency: "USD",
    ...params,
  });
}

/**
 * Track Initiate Checkout - when checkout process begins
 */
export function trackTikTokInitiateCheckout(params?: {
  content_id?: string;
  content_type?: string;
  value?: number;
  currency?: string;
}) {
  trackTikTokEvent("InitiateCheckout", {
    content_type: "product",
    currency: "USD",
    ...params,
  });
}

/**
 * Track Complete Payment - when purchase is successful
 */
export function trackTikTokCompletePayment(params: {
  content_id?: string;
  content_type?: string;
  content_name?: string;
  value: number;
  currency?: string;
  quantity?: number;
}) {
  trackTikTokEvent("CompletePayment", {
    content_type: "product",
    content_name: "Pet Portrait",
    currency: "USD",
    quantity: 1,
    ...params,
  });
}

/**
 * Track View Content - when user views a generated portrait
 */
export function trackTikTokViewContent(params?: {
  content_id?: string;
  content_type?: string;
  content_name?: string;
}) {
  trackTikTokEvent("ViewContent", {
    content_type: "product",
    content_name: "Pet Portrait",
    ...params,
  });
}

/**
 * Identify user for TikTok Pixel
 */
export function identifyTikTokUser(email?: string) {
  if (typeof window !== "undefined" && window.ttq && email) {
    try {
      window.ttq.identify({
        email: email,
      });
      console.log("📱 TikTok Pixel: User identified");
    } catch (err) {
      console.warn("TikTok Pixel identify failed:", err);
    }
  }
}

