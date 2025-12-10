// Meta Pixel tracking utilities
// Documentation: https://developers.facebook.com/docs/meta-pixel

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

/**
 * Track Meta Pixel standard events
 * https://developers.facebook.com/docs/meta-pixel/reference
 */
export function trackMetaEvent(
  event: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== "undefined" && window.fbq) {
    try {
      window.fbq("track", event, params);
      console.log(`📘 Meta Pixel: ${event}`, params);
    } catch (err) {
      console.warn("Meta Pixel tracking failed:", err);
    }
  }
}

/**
 * Track custom Meta Pixel events
 */
export function trackMetaCustomEvent(
  event: string,
  params?: Record<string, unknown>
) {
  if (typeof window !== "undefined" && window.fbq) {
    try {
      window.fbq("trackCustom", event, params);
      console.log(`📘 Meta Pixel Custom: ${event}`, params);
    } catch (err) {
      console.warn("Meta Pixel custom tracking failed:", err);
    }
  }
}

/**
 * Track ViewContent - when user views a generated portrait
 */
export function trackMetaViewContent(params?: {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  trackMetaEvent("ViewContent", {
    content_type: "product",
    content_name: "Pet Portrait",
    currency: "USD",
    ...params,
  });
}

/**
 * Track Add to Cart - when user clicks "Download Now" to initiate checkout
 */
export function trackMetaAddToCart(params?: {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  trackMetaEvent("AddToCart", {
    content_type: "product",
    content_name: "Pet Portrait",
    currency: "USD",
    ...params,
  });
}

/**
 * Track Initiate Checkout - when checkout process begins
 */
export function trackMetaInitiateCheckout(params?: {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  value?: number;
  currency?: string;
  num_items?: number;
}) {
  trackMetaEvent("InitiateCheckout", {
    content_type: "product",
    currency: "USD",
    num_items: 1,
    ...params,
  });
}

/**
 * Track Purchase - when purchase is successful
 */
export function trackMetaPurchase(params: {
  content_ids?: string[];
  content_type?: string;
  content_name?: string;
  value: number;
  currency?: string;
  num_items?: number;
}) {
  trackMetaEvent("Purchase", {
    content_type: "product",
    content_name: "Pet Portrait",
    currency: "USD",
    num_items: 1,
    ...params,
  });
}

/**
 * Track Lead - when user captures email or starts generation
 */
export function trackMetaLead(params?: {
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  trackMetaEvent("Lead", {
    content_name: "Pet Portrait Generation",
    ...params,
  });
}

/**
 * Track Complete Registration - when user completes email capture
 */
export function trackMetaCompleteRegistration(params?: {
  content_name?: string;
  value?: number;
  currency?: string;
}) {
  trackMetaEvent("CompleteRegistration", {
    content_name: "Email Capture",
    ...params,
  });
}

/**
 * Initialize user data for Advanced Matching
 * Call this when you have user email to improve attribution
 */
export function initMetaUserData(email?: string) {
  if (typeof window !== "undefined" && window.fbq && email) {
    try {
      // fbq('init') with user data enables Advanced Matching
      // This helps match conversions to users even without cookies
      window.fbq("init", process.env.NEXT_PUBLIC_META_PIXEL_ID, {
        em: email.toLowerCase().trim(),
      });
      console.log("📘 Meta Pixel: User data initialized");
    } catch (err) {
      console.warn("Meta Pixel user data init failed:", err);
    }
  }
}

