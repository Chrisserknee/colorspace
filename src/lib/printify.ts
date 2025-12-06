/**
 * Printify API Integration for Canvas Prints
 * 
 * This module handles all communication with Printify's API for creating
 * canvas print orders from pet portraits.
 * 
 * Required environment variables:
 * - PRINTIFY_API_KEY: Your Printify API token
 * - PRINTIFY_SHOP_ID: Your Printify shop ID
 */

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

// Canvas product configuration
// These IDs come from Printify's product catalog - you may need to adjust based on your provider
export const CANVAS_PRODUCTS = {
  "12x12": {
    blueprintId: 3, // Canvas blueprint ID (may vary by provider)
    printProviderId: 29, // Common print provider for canvas
    variantId: 17348, // 12x12 variant (check Printify catalog for exact ID)
    size: '12"x12"',
    priceInCents: 9900,
  },
  "16x16": {
    blueprintId: 3,
    printProviderId: 29,
    variantId: 17349, // 16x16 variant (check Printify catalog for exact ID)
    size: '16"x16"',
    priceInCents: 15000,
  },
} as const;

export type CanvasSize = keyof typeof CANVAS_PRODUCTS;

export interface ShippingAddress {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  country: string;
  region: string; // State/Province
  address1: string;
  address2?: string;
  city: string;
  zip: string;
}

export interface PrintifyOrderResponse {
  id: string;
  status: string;
  created_at: string;
  address_to: ShippingAddress;
  line_items: Array<{
    product_id: string;
    quantity: number;
    variant_id: number;
  }>;
}

export interface PrintifyProductResponse {
  id: string;
  title: string;
  description: string;
  images: Array<{ src: string }>;
  created_at: string;
  updated_at: string;
  visible: boolean;
  is_locked: boolean;
  blueprint_id: number;
  print_provider_id: number;
  variants: Array<{
    id: number;
    sku: string;
    cost: number;
    price: number;
    title: string;
    is_enabled: boolean;
  }>;
}

interface PrintifyError {
  errors?: { reason: string }[];
  message?: string;
}

/**
 * Get Printify API headers
 */
function getHeaders(): HeadersInit {
  const apiKey = process.env.PRINTIFY_API_KEY;
  if (!apiKey) {
    throw new Error("PRINTIFY_API_KEY environment variable is not set");
  }
  
  return {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

/**
 * Get Printify Shop ID
 */
function getShopId(): string {
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!shopId) {
    throw new Error("PRINTIFY_SHOP_ID environment variable is not set");
  }
  return shopId;
}

/**
 * Upload an image to Printify
 * Returns the image ID for use in product creation
 */
export async function uploadImageToPrintify(imageUrl: string, fileName: string): Promise<string> {
  const shopId = getShopId();
  
  // First, fetch the image and convert to base64
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image from ${imageUrl}: ${imageResponse.status}`);
  }
  
  const imageBuffer = await imageResponse.arrayBuffer();
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  
  // Upload to Printify
  const response = await fetch(`${PRINTIFY_API_BASE}/uploads/images.json`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      file_name: fileName,
      contents: base64Image,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json() as PrintifyError;
    throw new Error(`Printify image upload failed: ${errorData.message || JSON.stringify(errorData)}`);
  }
  
  const data = await response.json();
  console.log(`✅ Image uploaded to Printify: ${data.id}`);
  return data.id;
}

/**
 * Create a product on Printify for the canvas
 * This creates a "one-off" product with the customer's image
 */
export async function createCanvasProduct(
  imageId: string, 
  size: CanvasSize,
  petName?: string
): Promise<string> {
  const shopId = getShopId();
  const config = CANVAS_PRODUCTS[size];
  
  const productTitle = petName 
    ? `${petName}'s Royal Portrait - ${config.size} Canvas`
    : `Royal Pet Portrait - ${config.size} Canvas`;
  
  const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/products.json`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      title: productTitle,
      description: "Museum-quality canvas print of your royal pet portrait. Ready to hang.",
      blueprint_id: config.blueprintId,
      print_provider_id: config.printProviderId,
      variants: [
        {
          id: config.variantId,
          price: config.priceInCents,
          is_enabled: true,
        },
      ],
      print_areas: [
        {
          variant_ids: [config.variantId],
          placeholders: [
            {
              position: "front",
              images: [
                {
                  id: imageId,
                  x: 0.5,
                  y: 0.5,
                  scale: 1,
                  angle: 0,
                },
              ],
            },
          ],
        },
      ],
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json() as PrintifyError;
    throw new Error(`Printify product creation failed: ${errorData.message || JSON.stringify(errorData)}`);
  }
  
  const data = await response.json() as PrintifyProductResponse;
  console.log(`✅ Canvas product created on Printify: ${data.id}`);
  return data.id;
}

/**
 * Publish a product to make it orderable
 */
export async function publishProduct(productId: string): Promise<void> {
  const shopId = getShopId();
  
  const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/products/${productId}/publish.json`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      title: true,
      description: true,
      images: true,
      variants: true,
      tags: true,
      keyFeatures: true,
      shipping_template: true,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json() as PrintifyError;
    console.warn(`Printify publish warning: ${errorData.message || JSON.stringify(errorData)}`);
    // Publishing is optional for API orders, so we don't throw
  }
}

/**
 * Create an order on Printify
 * This submits the order for production and shipping
 */
export async function createPrintifyOrder(
  productId: string,
  variantId: number,
  shippingAddress: ShippingAddress,
  externalId?: string
): Promise<PrintifyOrderResponse> {
  const shopId = getShopId();
  
  const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/orders.json`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      external_id: externalId || `order-${Date.now()}`,
      label: "LumePet Canvas Order",
      line_items: [
        {
          product_id: productId,
          variant_id: variantId,
          quantity: 1,
        },
      ],
      shipping_method: 1, // Standard shipping
      is_printify_express: false,
      is_economy_shipping: false,
      send_shipping_notification: true,
      address_to: shippingAddress,
    }),
  });
  
  if (!response.ok) {
    const errorData = await response.json() as PrintifyError;
    throw new Error(`Printify order creation failed: ${errorData.message || JSON.stringify(errorData)}`);
  }
  
  const data = await response.json() as PrintifyOrderResponse;
  console.log(`✅ Printify order created: ${data.id}`);
  return data;
}

/**
 * Send an order to production
 * This actually charges you and starts printing
 */
export async function sendOrderToProduction(orderId: string): Promise<void> {
  const shopId = getShopId();
  
  const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/orders/${orderId}/send_to_production.json`, {
    method: "POST",
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const errorData = await response.json() as PrintifyError;
    throw new Error(`Failed to send order to production: ${errorData.message || JSON.stringify(errorData)}`);
  }
  
  console.log(`✅ Order ${orderId} sent to production`);
}

/**
 * Get order status
 */
export async function getOrderStatus(orderId: string): Promise<PrintifyOrderResponse> {
  const shopId = getShopId();
  
  const response = await fetch(`${PRINTIFY_API_BASE}/shops/${shopId}/orders/${orderId}.json`, {
    headers: getHeaders(),
  });
  
  if (!response.ok) {
    const errorData = await response.json() as PrintifyError;
    throw new Error(`Failed to get order status: ${errorData.message || JSON.stringify(errorData)}`);
  }
  
  return response.json() as Promise<PrintifyOrderResponse>;
}

/**
 * Full canvas order workflow
 * 1. Upload image to Printify
 * 2. Create product with image
 * 3. Create order with shipping address
 * 4. Send to production
 */
export async function createFullCanvasOrder(
  imageUrl: string,
  size: CanvasSize,
  shippingAddress: ShippingAddress,
  options?: {
    petName?: string;
    externalId?: string;
  }
): Promise<{ orderId: string; productId: string }> {
  console.log(`🖼️ Starting canvas order: ${size} to ${shippingAddress.city}, ${shippingAddress.country}`);
  
  const config = CANVAS_PRODUCTS[size];
  
  // Step 1: Upload image
  const fileName = `portrait-${options?.externalId || Date.now()}.png`;
  const printifyImageId = await uploadImageToPrintify(imageUrl, fileName);
  
  // Step 2: Create product
  const productId = await createCanvasProduct(printifyImageId, size, options?.petName);
  
  // Step 3: Create order
  const order = await createPrintifyOrder(
    productId,
    config.variantId,
    shippingAddress,
    options?.externalId
  );
  
  // Step 4: Send to production
  await sendOrderToProduction(order.id);
  
  console.log(`🎉 Canvas order complete! Order ID: ${order.id}`);
  
  return {
    orderId: order.id,
    productId: productId,
  };
}

/**
 * Calculate shipping cost estimate (approximate)
 * Actual shipping is calculated by Printify during order
 */
export function estimateShipping(country: string): { cost: number; display: string } {
  // Approximate shipping costs for canvas
  const shippingRates: Record<string, number> = {
    US: 12,
    CA: 15,
    GB: 18,
    AU: 22,
    DE: 18,
    FR: 18,
    DEFAULT: 25,
  };
  
  const cost = shippingRates[country] || shippingRates.DEFAULT;
  return {
    cost: cost * 100, // In cents
    display: `$${cost}`,
  };
}

