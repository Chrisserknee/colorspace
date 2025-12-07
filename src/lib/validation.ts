/**
 * Input validation utilities for security
 */

// Email validation with strict regex
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  
  // RFC 5322 compliant email regex (simplified but secure)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(email)) return false;
  
  // Additional checks
  if (email.length > 254) return false; // Max email length
  if (email.includes("..")) return false; // No consecutive dots
  
  // Check for common disposable email domains (optional, add more as needed)
  const disposableDomains = ["tempmail.com", "throwaway.email", "mailinator.com"];
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && disposableDomains.includes(domain)) {
    return false;
  }
  
  return true;
}

// UUID validation
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== "string") return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Sanitize string input (prevent XSS/injection)
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input || typeof input !== "string") return "";
  
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim();
}

// Validate file type by magic bytes (more secure than MIME type)
export async function validateImageMagicBytes(buffer: ArrayBuffer): Promise<boolean> {
  const arr = new Uint8Array(buffer.slice(0, 12));
  
  // JPEG: FF D8 FF
  if (arr[0] === 0xff && arr[1] === 0xd8 && arr[2] === 0xff) {
    return true;
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    arr[0] === 0x89 &&
    arr[1] === 0x50 &&
    arr[2] === 0x4e &&
    arr[3] === 0x47 &&
    arr[4] === 0x0d &&
    arr[5] === 0x0a &&
    arr[6] === 0x1a &&
    arr[7] === 0x0a
  ) {
    return true;
  }
  
  // WebP: RIFF....WEBP
  if (
    arr[0] === 0x52 && // R
    arr[1] === 0x49 && // I
    arr[2] === 0x46 && // F
    arr[3] === 0x46 && // F
    arr[8] === 0x57 && // W
    arr[9] === 0x45 && // E
    arr[10] === 0x42 && // B
    arr[11] === 0x50 // P
  ) {
    return true;
  }
  
  return false;
}

// Validate URL format
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// Rate-safe parseInt (prevent prototype pollution)
export function safeParseInt(value: unknown, defaultValue: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

/**
 * Auto-correct common email typos
 * Returns the corrected email and whether it was changed
 */
export function fixEmailTypos(email: string): { email: string; wasFixed: boolean; fixes: string[] } {
  if (!email || typeof email !== "string") {
    return { email: "", wasFixed: false, fixes: [] };
  }
  
  let fixed = email.toLowerCase().trim();
  const fixes: string[] = [];
  
  // Split into local part and domain
  const atIndex = fixed.lastIndexOf("@");
  if (atIndex === -1) {
    return { email: fixed, wasFixed: false, fixes: [] };
  }
  
  let localPart = fixed.substring(0, atIndex);
  let domain = fixed.substring(atIndex + 1);
  
  // === FIX COMMON TLD TYPOS ===
  const tldFixes: Record<string, string> = {
    ".con": ".com",
    ".comb": ".com",
    ".comm": ".com",
    ".coim": ".com",
    ".cim": ".com",
    ".vom": ".com",
    ".xom": ".com",
    ".ocm": ".com",
    ".co": ".com", // Only if gmail/yahoo/etc
    ".ney": ".net",
    ".nte": ".net",
    ".ogr": ".org",
    ".orgg": ".org",
  };
  
  for (const [typo, correct] of Object.entries(tldFixes)) {
    if (domain.endsWith(typo)) {
      // Special case: .co is valid for some domains, only fix for common providers
      if (typo === ".co") {
        const commonProviders = ["gmail", "yahoo", "hotmail", "outlook", "aol", "icloud"];
        const shouldFix = commonProviders.some(p => domain.startsWith(p));
        if (!shouldFix) continue;
      }
      domain = domain.slice(0, -typo.length) + correct;
      fixes.push(`${typo} → ${correct}`);
    }
  }
  
  // === FIX COMMON DOMAIN TYPOS ===
  const domainFixes: Record<string, string> = {
    // Gmail
    "gmial.com": "gmail.com",
    "gmal.com": "gmail.com",
    "gmaill.com": "gmail.com",
    "gmali.com": "gmail.com",
    "gmailc.om": "gmail.com",
    "gmail.co": "gmail.com",
    "gmai.com": "gmail.com",
    "gnail.com": "gmail.com",
    "g]mail.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gemail.com": "gmail.com",
    "gimail.com": "gmail.com",
    "hmail.com": "gmail.com",
    // Yahoo
    "yaho.com": "yahoo.com",
    "yahooo.com": "yahoo.com",
    "tahoo.com": "yahoo.com",
    "uahoo.com": "yahoo.com",
    "yhoo.com": "yahoo.com",
    "yaoo.com": "yahoo.com",
    "yhaoo.com": "yahoo.com",
    // Hotmail
    "hotmal.com": "hotmail.com",
    "hotmial.com": "hotmail.com",
    "hotmil.com": "hotmail.com",
    "hotmaill.com": "hotmail.com",
    "hotmai.com": "hotmail.com",
    "hitmail.com": "hotmail.com",
    // Outlook
    "outlok.com": "outlook.com",
    "outllook.com": "outlook.com",
    "outook.com": "outlook.com",
    "outlool.com": "outlook.com",
    // iCloud
    "iclould.com": "icloud.com",
    "icoud.com": "icloud.com",
    "iclod.com": "icloud.com",
    // AOL
    "aoll.com": "aol.com",
    "ao.com": "aol.com",
    // Comcast
    "comast.net": "comcast.net",
    "concast.net": "comcast.net",
  };
  
  if (domainFixes[domain]) {
    fixes.push(`${domain} → ${domainFixes[domain]}`);
    domain = domainFixes[domain];
  }
  
  // === FIX DOUBLE DOTS ===
  if (domain.includes("..")) {
    domain = domain.replace(/\.{2,}/g, ".");
    fixes.push("removed double dots");
  }
  if (localPart.includes("..")) {
    localPart = localPart.replace(/\.{2,}/g, ".");
    fixes.push("removed double dots in username");
  }
  
  // === FIX LEADING/TRAILING DOTS ===
  if (domain.startsWith(".")) {
    domain = domain.substring(1);
    fixes.push("removed leading dot from domain");
  }
  if (domain.endsWith(".")) {
    domain = domain.slice(0, -1);
    fixes.push("removed trailing dot from domain");
  }
  
  // === FIX COMMON KEYBOARD MISTAKES ===
  // Space before @ or in domain
  if (localPart.includes(" ") || domain.includes(" ")) {
    localPart = localPart.replace(/\s/g, "");
    domain = domain.replace(/\s/g, "");
    fixes.push("removed spaces");
  }
  
  const result = `${localPart}@${domain}`;
  
  return {
    email: result,
    wasFixed: result !== email.toLowerCase().trim(),
    fixes
  };
}

/**
 * Validate and fix email - combines validation with auto-correction
 */
export function validateAndFixEmail(email: string): { 
  isValid: boolean; 
  email: string; 
  wasFixed: boolean; 
  fixes: string[];
  error?: string;
} {
  // First try to fix typos
  const { email: fixedEmail, wasFixed, fixes } = fixEmailTypos(email);
  
  // Then validate the fixed email
  if (!fixedEmail) {
    return { isValid: false, email: "", wasFixed: false, fixes: [], error: "Email is required" };
  }
  
  if (!fixedEmail.includes("@")) {
    return { isValid: false, email: fixedEmail, wasFixed, fixes, error: "Invalid email format" };
  }
  
  const domain = fixedEmail.split("@")[1];
  if (!domain || !domain.includes(".")) {
    return { isValid: false, email: fixedEmail, wasFixed, fixes, error: "Invalid domain" };
  }
  
  // Check if valid after fixes
  if (!isValidEmail(fixedEmail)) {
    return { isValid: false, email: fixedEmail, wasFixed, fixes, error: "Invalid email format" };
  }
  
  return { isValid: true, email: fixedEmail, wasFixed, fixes };
}




















