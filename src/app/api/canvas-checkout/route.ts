import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CONFIG } from "@/lib/config";
import { getMetadata } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { isValidUUID, sanitizeString } from "@/lib/validation";
import { CanvasSize } from "@/lib/printify";

/**
 * POST /api/canvas-checkout
 * 
 * Creates a Stripe checkout session for canvas print orders.
 * Collects shipping address and payment in one flow.
 * 
 * Request body:
 * {
 *   imageId: string (required) - The portrait image ID
 *   size: "12x12" | "16x16" (required) - Canvas size
 *   email?: string - Customer email (optional, Stripe will collect if not provided)
 * }
 */
export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate limiting
  const rateLimit = checkRateLimit(`canvas-checkout:${clientIP}`, RATE_LIMITS.checkout);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() } }
    );
  }
  
  try {
    // Check for Stripe key
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("❌ STRIPE_SECRET_KEY environment variable is not set");
      return NextResponse.json(
        { error: "Payment system is not configured. Please contact support." },
        { status: 500 }
      );
    }

    // Initialize Stripe client
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Parse request body
    const body = await request.json();
    const { imageId, size, email } = body;

    // Validate imageId
    if (!imageId || !isValidUUID(imageId)) {
      return NextResponse.json(
        { error: "Valid image ID is required" },
        { status: 400 }
      );
    }

    // Validate size
    if (!size || !["12x12", "16x16"].includes(size)) {
      return NextResponse.json(
        { error: "Valid canvas size is required (12x12 or 16x16)" },
        { status: 400 }
      );
    }

    const canvasSize = size as CanvasSize;

    // Get the image metadata to verify it exists and has been purchased
    const metadata = await getMetadata(imageId);
    if (!metadata || !metadata.hd_url) {
      return NextResponse.json(
        { error: "Image not found. Please ensure the portrait has been purchased." },
        { status: 404 }
      );
    }

    // Verify the image has been paid for
    if (!metadata.paid) {
      return NextResponse.json(
        { error: "Please purchase the digital portrait first before ordering a canvas print." },
        { status: 400 }
      );
    }

    // Set up product details based on size
    const isLarge = canvasSize === "16x16";
    const productName = isLarge ? CONFIG.CANVAS_16X16_NAME : CONFIG.CANVAS_12X12_NAME;
    const productDescription = isLarge ? CONFIG.CANVAS_16X16_DESCRIPTION : CONFIG.CANVAS_12X12_DESCRIPTION;
    const priceAmount = isLarge ? CONFIG.CANVAS_16X16_PRICE_AMOUNT : CONFIG.CANVAS_12X12_PRICE_AMOUNT;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://lumepet.app";
    
    // Use preview image for Stripe checkout display
    const productImages = metadata.preview_url ? [metadata.preview_url] : [];

    // Create Stripe Checkout Session with shipping address collection
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      ...(email ? { customer_email: sanitizeString(email.toLowerCase().trim(), 254) } : {}),
      billing_address_collection: "required",
      shipping_address_collection: {
        allowed_countries: [
          "US", "CA", "GB", "AU", "DE", "FR", "IT", "ES", "NL", "BE", 
          "AT", "CH", "SE", "NO", "DK", "FI", "IE", "PT", "PL", "CZ",
          "NZ", "JP", "SG", "HK", "KR"
        ],
      },
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: productName,
              description: productDescription,
              images: productImages,
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/canvas-success?session_id={CHECKOUT_SESSION_ID}&imageId=${imageId}&size=${canvasSize}`,
      cancel_url: `${baseUrl}/success?imageId=${imageId}`,
      metadata: {
        type: "canvas",
        imageId: imageId,
        canvasSize: canvasSize,
      },
      // Add custom fields for phone number (helpful for shipping)
      phone_number_collection: {
        enabled: true,
      },
    });

    console.log(`🖼️ Canvas checkout session created: ${session.id} for ${canvasSize} canvas`);

    // Return the checkout URL
    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });

  } catch (error) {
    console.error("Canvas checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session. Please try again." },
      { status: 500 }
    );
  }
}

