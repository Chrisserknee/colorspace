import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: NextRequest) {
  try {
    const { amount } = await request.json();

    if (!amount || amount < 1) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum donation is $1." },
        { status: 400 }
      );
    }

    // Create a Stripe checkout session for the donation
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Support LumePet",
              description: `Thank you for supporting LumePet with a $${amount} contribution! Your generosity helps keep the magic alive. 💛`,
              images: ["https://lumepet.app/samples/LumePet2.png"],
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://lumepet.app"}/?donation=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://lumepet.app"}/?donation=cancelled`,
      metadata: {
        type: "donation",
        amount: amount.toString(),
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Donation error:", error);
    return NextResponse.json(
      { error: "Failed to create donation session" },
      { status: 500 }
    );
  }
}

