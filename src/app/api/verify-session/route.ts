import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required", valid: false },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured", valid: false },
        { status: 500 }
      );
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session was paid
    if (session.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Payment not completed", valid: false },
        { status: 400 }
      );
    }

    // Verify it's an unlimited session purchase
    const isUnlimitedSession = session.metadata?.type === "unlimited-session" || session.metadata?.type === "pack";
    
    if (!isUnlimitedSession) {
      return NextResponse.json(
        { error: "Not an unlimited session purchase", valid: false },
        { status: 400 }
      );
    }

    // Return success
    return NextResponse.json({
      valid: true,
      sessionId: session.id,
      paymentStatus: session.payment_status,
      type: session.metadata?.type,
    });
  } catch (error) {
    console.error("Session verification error:", error);
    
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message, valid: false },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to verify session", valid: false },
      { status: 500 }
    );
  }
}

