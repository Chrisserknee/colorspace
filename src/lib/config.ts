// Configuration constants
export const CONFIG = {
  // Price for HD portrait in dollars
  PRICE_DISPLAY: "$9",
  PRICE_AMOUNT: parseInt(process.env.PRICE_AMOUNT || "900", 10), // in cents
  
  // Product details
  PRODUCT_NAME: "Royal Renaissance Pet Portrait",
  PRODUCT_DESCRIPTION: "Full-resolution, watermark-free royal Renaissance portrait of your beloved pet as nobility",
  
  // API URLs
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  
  // Image settings
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ACCEPTED_TYPES: ["image/jpeg", "image/png", "image/webp"],
  
  // Style description for UI
  STYLE_DESCRIPTION: "Dutch Golden Age royal portrait with velvet robes, ermine trim, ornate jewelry, and dramatic Rembrandt lighting",
};
