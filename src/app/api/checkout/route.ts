import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { CONFIG } from "@/lib/config";
import { getMetadata, saveEmail } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // Check for Stripe key
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 500 }
      );
    }

    // Initialize Stripe client
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Parse request body
    const body = await request.json();
    const { imageId, email } = body;

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID is required" },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Verify the image exists in Supabase
    const metadata = await getMetadata(imageId);
    
    if (!metadata) {
      return NextResponse.json(
        { error: "Portrait not found. Please generate a new one." },
        { status: 404 }
      );
    }

    // Save email to emails table for marketing
    await saveEmail(email, imageId, "checkout");

    // Use 50 cents for testing (override env var if needed)
    const priceAmount = 50; // 50 cents for testing
    console.log(`Creating checkout session with price: ${priceAmount} cents ($${(priceAmount / 100).toFixed(2)})`);

    // Get the base URL from the request (works for both localhost and production)
    // Stripe requires absolute URLs, so we need to ensure we have a valid URL
    let baseUrl = CONFIG.BASE_URL;
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    
    // Try to get a valid absolute URL
    if (origin) {
      try {
        const originUrl = new URL(origin);
        baseUrl = `${originUrl.protocol}//${originUrl.host}`;
      } catch (e) {
        console.error("Invalid origin URL:", origin);
      }
    } else if (referer) {
      // Extract origin from referer URL
      try {
        const refererUrl = new URL(referer);
        baseUrl = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch (e) {
        console.error("Invalid referer URL:", referer);
      }
    }
    
    // Validate the baseUrl is a proper absolute URL
    try {
      const testUrl = new URL(baseUrl);
      baseUrl = `${testUrl.protocol}//${testUrl.host}`;
    } catch (e) {
      console.error("Invalid base URL, using CONFIG.BASE_URL:", baseUrl);
      baseUrl = CONFIG.BASE_URL;
      // Final validation
      try {
        new URL(baseUrl);
      } catch (e2) {
        console.error("CONFIG.BASE_URL is also invalid:", baseUrl);
        throw new Error("Invalid base URL configuration");
      }
    }
    
    baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
    console.log(`Using base URL: ${baseUrl}`);
    
    // Validate URLs before passing to Stripe
    const successUrl = `${baseUrl}/success?imageId=${imageId}&session_id={CHECKOUT_SESSION_ID}`;
    try {
      new URL(successUrl);
    } catch (e) {
      console.error("Invalid success URL:", successUrl);
      throw new Error("Failed to create valid success URL");
    }
    
    try {
      new URL(baseUrl);
    } catch (e) {
      console.error("Invalid cancel URL:", baseUrl);
      throw new Error("Failed to create valid cancel URL");
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: CONFIG.PRODUCT_NAME,
              description: CONFIG.PRODUCT_DESCRIPTION,
              images: [metadata.preview_url],
            },
            unit_amount: priceAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: baseUrl,
      metadata: {
        imageId,
        customerEmail: email,
      },
    });

    // Return the checkout URL
    return NextResponse.json({
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("Checkout error:", error);

    if (error instanceof Stripe.errors.StripeError) {
      console.error("Stripe error details:", error.message, error.type);
      return NextResponse.json(
        { error: error.message || "Payment service error. Please try again." },
        { status: 500 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Failed to create checkout session. Please try again.";
    console.error("Error message:", errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
