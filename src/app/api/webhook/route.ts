import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { saveMetadata, getMetadata, addCustomer, markSubscriberAsPurchased } from "@/lib/supabase";
import { sendPortraitEmail } from "@/lib/email";

// Initialize Stripe lazily to avoid build-time errors
function getStripe(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(secretKey);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify the webhook signature
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  // Handle the event with proper error handling
  // Always return 200 to Stripe to prevent retries, even if processing fails
  try {
    switch (event.type) {
      // ✅ Payment successful
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const imageId = session.metadata?.imageId;
        const customerEmail = session.customer_details?.email;
        const isPackPurchase = session.metadata?.type === "pack";
        
        if (imageId && !isPackPurchase) {
          try {
            // Save payment metadata
            await saveMetadata(imageId, {
              paid: true,
              paid_at: new Date().toISOString(),
              stripe_session_id: session.id,
              customer_email: customerEmail || null,
              status: "completed",
            });
            console.log(`✅ Payment confirmed for image: ${imageId}`);
            
            // Mark as purchased in emails table (for Royal Club conversion tracking)
            if (customerEmail) {
              try {
                await markSubscriberAsPurchased(customerEmail);
                console.log(`📧 Royal Club subscriber marked as converted: ${customerEmail}`);
              } catch (leadError) {
                console.warn(`⚠️ Failed to mark subscriber as purchased:`, leadError);
              }
              
              // Add to customers table (separate list of paying customers)
              try {
                const isRainbowBridge = session.metadata?.style === 'rainbow-bridge';
                await addCustomer(customerEmail, {
                  purchaseType: isRainbowBridge ? 'rainbow-bridge' : 'portrait',
                  imageId: imageId,
                  stripeSessionId: session.id,
                  context: {
                    petName: session.metadata?.petName,
                    style: session.metadata?.style,
                    // UTM attribution data
                    utm_source: session.metadata?.utm_source,
                    utm_medium: session.metadata?.utm_medium,
                    utm_campaign: session.metadata?.utm_campaign,
                    referrer: session.metadata?.referrer,
                  }
                });
                console.log(`🎉 Customer added to paying_customers table: ${customerEmail}`);
                if (session.metadata?.utm_source) {
                  console.log(`📊 Attribution: source=${session.metadata.utm_source}, medium=${session.metadata.utm_medium}`);
                }
              } catch (customerError) {
                console.warn(`⚠️ Failed to add customer:`, customerError);
                // Don't fail the webhook - this is non-critical
              }
            }
            
            // Send confirmation email with download link
            if (customerEmail) {
              const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://lumepet.app";
              const downloadUrl = `${baseUrl}/success?imageId=${imageId}`;
              
              // Get metadata to check if it's a Rainbow Bridge portrait
              const metadata = await getMetadata(imageId);
              const isRainbowBridge = metadata?.pet_description?.includes("rainbow") || 
                                       metadata?.pet_description?.includes("heavenly") ||
                                       metadata?.pet_description?.includes("memorial");
              
              // Try to get pet name from localStorage data sent via checkout
              // For now, we'll use a generic approach
              const petName = metadata?.pet_name || undefined;
              
              const emailResult = await sendPortraitEmail({
                to: customerEmail,
                confirmationId: imageId.substring(0, 8).toUpperCase(),
                downloadUrl,
                isRainbowBridge,
                petName,
              });
              
              if (emailResult.success) {
                console.log(`📧 Confirmation email sent to ${customerEmail}`);
              } else {
                console.warn(`⚠️ Failed to send email: ${emailResult.error}`);
              }
            }
          } catch (error) {
            console.error(`❌ Failed to process payment for image ${imageId}:`, error);
            // Log but don't throw - return 200 to prevent Stripe retries
          }
        } else if (isPackPurchase) {
          console.log(`📦 Pack purchase completed (session: ${session.id})`);
          // Pack purchases don't have a specific image to email about
          if (customerEmail) {
            // Mark as purchased in emails table (for Royal Club conversion tracking)
            try {
              await markSubscriberAsPurchased(customerEmail);
              console.log(`📧 Royal Club subscriber marked as converted (pack): ${customerEmail}`);
            } catch (leadError) {
              console.warn(`⚠️ Failed to mark subscriber as purchased:`, leadError);
            }
            
            // Add to customers table (separate list of paying customers)
            try {
              await addCustomer(customerEmail, {
                purchaseType: 'pack',
                stripeSessionId: session.id,
                context: {
                  packType: session.metadata?.packType,
                  // UTM attribution data
                  utm_source: session.metadata?.utm_source,
                  utm_medium: session.metadata?.utm_medium,
                  utm_campaign: session.metadata?.utm_campaign,
                  referrer: session.metadata?.referrer,
                }
              });
              console.log(`🎉 Customer added to paying_customers table (pack): ${customerEmail}`);
              if (session.metadata?.utm_source) {
                console.log(`📊 Attribution: source=${session.metadata.utm_source}, medium=${session.metadata.utm_medium}`);
              }
            } catch (customerError) {
              console.warn(`⚠️ Failed to add customer:`, customerError);
            }
          }
        } else {
          console.log(`⚠️ checkout.session.completed event has no imageId in metadata (session: ${session.id})`);
        }
        break;
      }

      // ⏰ Checkout session expired
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const imageId = session.metadata?.imageId;
        
        if (imageId) {
          try {
            await saveMetadata(imageId, {
              status: "expired",
              expired_at: new Date().toISOString(),
            });
            console.log(`⏰ Checkout expired for image: ${imageId}`);
          } catch (error) {
            console.error(`❌ Failed to save expired status for image ${imageId}:`, error);
            // Log but don't throw - return 200 to prevent Stripe retries
          }
        } else {
          // This is normal for pack purchases or sessions without imageId
          console.log(`ℹ️ checkout.session.expired event has no imageId (session: ${session.id}) - likely a pack purchase`);
        }
        break;
      }

      // 💸 Refund issued
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        console.log(`💸 Refund processed: ${charge.id}`);
        break;
      }

      // ⚠️ Dispute created
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        console.log(`⚠️ Dispute created: ${dispute.id}`);
        break;
      }

      // ❌ Payment failed
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log(`❌ Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    // Catch any unexpected errors in event handling
    console.error(`❌ Unexpected error processing webhook event ${event.type}:`, error);
    // Still return 200 to prevent infinite retries
  }

  // Always return 200 to Stripe to acknowledge receipt
  // This prevents Stripe from retrying on processing errors
  return NextResponse.json({ received: true });
}
