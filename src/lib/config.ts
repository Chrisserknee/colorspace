// Configuration constants
export const CONFIG = {
  // Price for HD portrait in dollars
  PRICE_DISPLAY: "$19.99",
  PRICE_AMOUNT: 1999, // $19.99 in cents
  
  // Royal Unlimited Session - 2 hours of unlimited generations
  UNLIMITED_SESSION_PRICE_DISPLAY: "$4.99",
  UNLIMITED_SESSION_PRICE_AMOUNT: 499, // $4.99 in cents
  UNLIMITED_SESSION_DURATION_HOURS: 2,
  UNLIMITED_SESSION_NAME: "Royal Unlimited Session",
  UNLIMITED_SESSION_DESCRIPTION: "Unlimited generations for 2 hours - create as many portraits as you want!",
  
  // Product details
  PRODUCT_NAME: "LumePet Royal Portrait",
  PRODUCT_DESCRIPTION: "Full-resolution, watermark-free royal portrait of your beloved pet as nobility",
  
  // Canvas Print pricing (Printify integration)
  CANVAS_12X12_PRICE_DISPLAY: "$69",
  CANVAS_12X12_PRICE_AMOUNT: 6900, // $69 in cents
  CANVAS_12X12_SIZE: '12"x12"',
  CANVAS_12X12_NAME: "Gallery Canvas - 12×12",
  CANVAS_12X12_DESCRIPTION: "Museum-quality canvas print, 12×12 inches, ready to hang",
  
  CANVAS_16X16_PRICE_DISPLAY: "$129",
  CANVAS_16X16_PRICE_AMOUNT: 12900, // $129 in cents
  CANVAS_16X16_SIZE: '16"x16"',
  CANVAS_16X16_NAME: "Premium Canvas - 16×16",
  CANVAS_16X16_DESCRIPTION: "Large museum-quality canvas print, 16×16 inches, ready to hang",
  
  // API URLs
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  
  // Image settings
  // Vercel has a 4.5MB body size limit, so we limit to 4MB to be safe
  MAX_FILE_SIZE: 4 * 1024 * 1024, // 4MB (Vercel limit is 4.5MB)
  ACCEPTED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  
  // Style description for UI
  STYLE_DESCRIPTION: "Dutch Golden Age royal portrait with velvet robes, ermine trim, ornate jewelry, and dramatic Rembrandt lighting",
};
