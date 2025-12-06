// Configuration constants
export const CONFIG = {
  // Price for HD portrait in dollars
  PRICE_DISPLAY: "$19.99",
  PRICE_AMOUNT: 1999, // $19.99 in cents
  
  // Pack pricing - Tiered options
  // Starter Pack: $1 for 1 portrait
  PACK_1_PRICE_DISPLAY: "$1",
  PACK_1_PRICE_AMOUNT: 100, // $1 in cents
  PACK_1_PORTRAITS: 1,
  PACK_1_NAME: "Starter Pack",
  PACK_1_DESCRIPTION: "1 watermarked portrait to try it out",
  
  // Popular Pack: $5 for 5 portraits (Best Value)
  PACK_5_PRICE_DISPLAY: "$5",
  PACK_5_PRICE_AMOUNT: 500, // $5 in cents
  PACK_5_PORTRAITS: 5,
  PACK_5_NAME: "Popular Pack",
  PACK_5_DESCRIPTION: "5 watermarked portraits - Best value!",
  
  // Pro Pack: $10 for 10 portraits (Most Savings)
  PACK_10_PRICE_DISPLAY: "$10",
  PACK_10_PRICE_AMOUNT: 1000, // $10 in cents
  PACK_10_PORTRAITS: 10,
  PACK_10_NAME: "Pro Pack",
  PACK_10_DESCRIPTION: "10 watermarked portraits - Maximum savings!",
  
  // Legacy support (deprecated, use PACK_5 instead)
  PACK_2_PRICE_DISPLAY: "$5",
  PACK_2_PRICE_AMOUNT: 500, // $5 in cents
  PACK_2_PORTRAITS: 2, // 2 portraits per pack
  
  // Product details
  PRODUCT_NAME: "LumePet Royal Portrait",
  PRODUCT_DESCRIPTION: "Full-resolution, watermark-free royal portrait of your beloved pet as nobility",
  
  PACK_PRODUCT_NAME: "LumePet Portrait Pack",
  PACK_PRODUCT_DESCRIPTION: "Watermarked portraits (does not include the full HD version)",
  
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
