/**
 * UTM Parameter Tracking
 * ======================
 * Captures and stores UTM parameters and referrer data
 * for attribution tracking on purchases.
 */

// UTM data structure
export interface UTMData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
}

const UTM_STORAGE_KEY = "lumepet_utm_data";

/**
 * Capture UTM parameters from URL and referrer
 * Call this on page load
 */
export function captureUTMParams(): UTMData | null {
  if (typeof window === "undefined") return null;
  
  const urlParams = new URLSearchParams(window.location.search);
  
  // Check if there are UTM params in the URL
  const utmSource = urlParams.get("utm_source");
  const utmMedium = urlParams.get("utm_medium");
  const utmCampaign = urlParams.get("utm_campaign");
  const utmTerm = urlParams.get("utm_term");
  const utmContent = urlParams.get("utm_content");
  
  // Get referrer
  const referrer = document.referrer || undefined;
  
  // Only store if we have new UTM data or referrer
  const hasUTM = utmSource || utmMedium || utmCampaign;
  const hasNewReferrer = referrer && !referrer.includes("lumepet.app");
  
  if (hasUTM || hasNewReferrer) {
    const utmData: UTMData = {
      utm_source: utmSource || undefined,
      utm_medium: utmMedium || undefined,
      utm_campaign: utmCampaign || undefined,
      utm_term: utmTerm || undefined,
      utm_content: utmContent || undefined,
      referrer: hasNewReferrer ? referrer : undefined,
      landing_page: window.location.pathname,
      captured_at: new Date().toISOString(),
    };
    
    // Store in localStorage (persists across sessions)
    localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
    
    console.log("📊 UTM data captured:", utmData);
    return utmData;
  }
  
  return null;
}

/**
 * Get stored UTM data
 */
export function getStoredUTMData(): UTMData | null {
  if (typeof window === "undefined") return null;
  
  const stored = localStorage.getItem(UTM_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as UTMData;
  } catch {
    return null;
  }
}

/**
 * Get UTM data for API calls (cleaned up)
 */
export function getUTMForAPI(): Record<string, string> {
  const data = getStoredUTMData();
  if (!data) return {};
  
  // Return only non-empty values
  const result: Record<string, string> = {};
  
  if (data.utm_source) result.utm_source = data.utm_source;
  if (data.utm_medium) result.utm_medium = data.utm_medium;
  if (data.utm_campaign) result.utm_campaign = data.utm_campaign;
  if (data.utm_term) result.utm_term = data.utm_term;
  if (data.utm_content) result.utm_content = data.utm_content;
  if (data.referrer) result.referrer = data.referrer;
  if (data.landing_page) result.landing_page = data.landing_page;
  
  return result;
}

/**
 * Clear stored UTM data (call after successful purchase)
 */
export function clearUTMData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(UTM_STORAGE_KEY);
}

/**
 * Extract source name from referrer URL
 */
export function getSourceFromReferrer(referrer?: string): string | undefined {
  if (!referrer) return undefined;
  
  try {
    const url = new URL(referrer);
    const hostname = url.hostname.toLowerCase();
    
    // Map common referrers to friendly names
    if (hostname.includes("facebook.com") || hostname.includes("fb.com")) return "facebook";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("pinterest.com")) return "pinterest";
    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) return "twitter";
    if (hostname.includes("nextdoor.com")) return "nextdoor";
    if (hostname.includes("google.com")) return "google";
    if (hostname.includes("bing.com")) return "bing";
    if (hostname.includes("youtube.com")) return "youtube";
    if (hostname.includes("reddit.com")) return "reddit";
    if (hostname.includes("linkedin.com")) return "linkedin";
    
    // Return the hostname without www
    return hostname.replace("www.", "");
  } catch {
    return undefined;
  }
}

