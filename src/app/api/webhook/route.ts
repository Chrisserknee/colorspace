import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { saveMetadata, getMetadata, addCustomer, markSubscriberAsPurchased, supabase } from "@/lib/supabase";
import { sendPortraitEmail } from "@/lib/email";
import { sendCanvasUpsellEmail } from "@/lib/lumeEmails";
import { createFullCanvasOrder, CanvasSize, ShippingAddress } from "@/lib/printify";
import { trackServerCompletePayment } from "@/lib/tiktok-server";

// Determine traffic source from UTM params and referrer
function getTrafficSource(metadata: Stripe.Metadata | null): string {
  if (!metadata) return "Direct";
  
  const utmMedium = metadata.utm_medium?.toLowerCase() || "";
  const utmSource = metadata.utm_source?.toLowerCase() || "";
  
  // Check for paid traffic indicators
  const paidMediums = ["paid", "cpc", "cpm", "ppc", "ad", "ads", "sponsored", "retargeting"];
  const isPaid = paidMediums.some(m => utmMedium.includes(m)) || 
                 utmMedium === "paidsocial" ||
                 utmSource.includes("fb_ad") ||
                 utmSource.includes("ig_ad");
  
  if (isPaid) return "Paid Ad";
  
  // Check for organic social
  const referrer = metadata.referrer?.toLowerCase() || "";
  if (referrer.includes("facebook.com") || referrer.includes("fb.com") || 
      referrer.includes("instagram.com") || referrer.includes("tiktok.com") ||
      referrer.includes("twitter.com") || referrer.includes("x.com") ||
      referrer.includes("pinterest.com") || referrer.includes("youtube.com") ||
      referrer.includes("linkedin.com") || referrer.includes("snapchat.com") ||
      referrer.includes("reddit.com") || referrer.includes("threads.net") ||
      referrer.includes("nextdoor.com")) {
    return "Organic Social";
  }
  
  // Check for search traffic
  if (referrer.includes("google.") || referrer.includes("bing.") || 
      referrer.includes("yahoo.") || referrer.includes("duckduckgo.")) {
    return "Organic Search";
  }
  
  // If there's a referrer but not social/search, it's referral
  if (referrer && referrer !== "" && !referrer.includes("lumepet")) {
    return "Referral";
  }
  
  // No UTM, no referrer = Direct
  if (!metadata.utm_source && !referrer) {
    return "Direct";
  }
  
  return "Organic";
}

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
        const isUnlimitedSession = session.metadata?.type === "unlimited-session" || session.metadata?.type === "pack";
        
        if (imageId && !isUnlimitedSession) {
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
            
            // TikTok Events API: Track CompletePayment server-side
            try {
              const amountTotal = session.amount_total ? session.amount_total / 100 : 19.99;
              await trackServerCompletePayment({
                email: customerEmail || undefined,
                value: amountTotal,
                content_id: imageId,
                content_name: "Pet Portrait Download",
                order_id: session.id,
              });
              console.log(`📱 TikTok server event sent: CompletePayment $${amountTotal}`);
            } catch (tiktokError) {
              console.warn("⚠️ TikTok server tracking failed:", tiktokError);
              // Don't fail the webhook for tracking errors
            }
            
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
                const trafficSource = getTrafficSource(session.metadata);
                await addCustomer(customerEmail, {
                  purchaseType: isRainbowBridge ? 'rainbow-bridge' : 'portrait',
                  imageId: imageId,
                  stripeSessionId: session.id,
                  context: {
                    petName: session.metadata?.petName,
                    style: session.metadata?.style,
                    trafficSource,
                    // UTM attribution data
                    utm_source: session.metadata?.utm_source,
                    utm_medium: session.metadata?.utm_medium,
                    utm_campaign: session.metadata?.utm_campaign,
                    referrer: session.metadata?.referrer,
                  }
                });
                console.log(`🎉 Customer added to paying_customers table: ${customerEmail} (${trafficSource})`);
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
              
              // Send canvas upsell email immediately after purchase
              try {
                const upsellResult = await sendCanvasUpsellEmail(customerEmail, imageId, 1);
                if (upsellResult.success) {
                  // Mark email 1 as sent in the database
                  await supabase
                    .from("paying_customers")
                    .update({ canvas_email_1_sent_at: new Date().toISOString() })
                    .eq("email", customerEmail.toLowerCase().trim());
                  console.log(`🖼️ Canvas upsell email sent to ${customerEmail}`);
                } else {
                  console.warn(`⚠️ Failed to send canvas upsell email: ${upsellResult.error}`);
                }
              } catch (upsellError) {
                console.warn(`⚠️ Canvas upsell email error:`, upsellError);
                // Don't fail the webhook for upsell email errors
              }
            }
          } catch (error) {
            console.error(`❌ Failed to process payment for image ${imageId}:`, error);
            // Log but don't throw - return 200 to prevent Stripe retries
          }
        } else if (isUnlimitedSession) {
          console.log(`✨ Unlimited session purchase completed (session: ${session.id})`);
          
          // TikTok Events API: Track unlimited session purchase server-side
          try {
            await trackServerCompletePayment({
              email: customerEmail || undefined,
              value: 4.99,
              content_id: "unlimited-session",
              content_name: "Royal Unlimited Session",
              order_id: session.id,
            });
            console.log(`📱 TikTok server event sent: CompletePayment $4.99 (Royal Unlimited Session)`);
          } catch (tiktokError) {
            console.warn("⚠️ TikTok server tracking failed:", tiktokError);
          }
          
          // Unlimited session purchases don't have a specific image to email about
          if (customerEmail) {
            // Mark as purchased in emails table (for Royal Club conversion tracking)
            try {
              await markSubscriberAsPurchased(customerEmail);
              console.log(`📧 Royal Club subscriber marked as converted (unlimited): ${customerEmail}`);
            } catch (leadError) {
              console.warn(`⚠️ Failed to mark subscriber as purchased:`, leadError);
            }
            
            // Add to customers table (separate list of paying customers)
            try {
              const trafficSource = getTrafficSource(session.metadata);
              await addCustomer(customerEmail, {
                purchaseType: 'unlimited-session',
                stripeSessionId: session.id,
                context: {
                  trafficSource,
                  // UTM attribution data
                  utm_source: session.metadata?.utm_source,
                  utm_medium: session.metadata?.utm_medium,
                  utm_campaign: session.metadata?.utm_campaign,
                  referrer: session.metadata?.referrer,
                }
              });
              console.log(`🎉 Customer added to paying_customers table (unlimited): ${customerEmail} (${trafficSource})`);
              if (session.metadata?.utm_source) {
                console.log(`📊 Attribution: source=${session.metadata.utm_source}, medium=${session.metadata.utm_medium}`);
              }
            } catch (customerError) {
              console.warn(`⚠️ Failed to add customer:`, customerError);
            }
          }
        } else if (session.metadata?.type === "canvas") {
          // 🖼️ Canvas print order
          const canvasImageId = session.metadata.imageId;
          const canvasSize = session.metadata.canvasSize as CanvasSize;
          // shipping_details is available when shipping_address_collection is enabled
          const shippingDetails = (session as unknown as { 
            shipping_details?: { 
              name?: string; 
              address?: { 
                line1?: string; 
                line2?: string; 
                city?: string; 
                state?: string; 
                postal_code?: string; 
                country?: string; 
              }; 
            }; 
          }).shipping_details;
          
          console.log(`🖼️ Canvas order received: ${canvasSize} for image ${canvasImageId}`);
          
          // TikTok Events API: Track canvas purchase server-side
          try {
            const canvasValue = canvasSize === "16x16" ? 129 : 69;
            await trackServerCompletePayment({
              email: customerEmail || undefined,
              value: canvasValue,
              content_id: canvasImageId || "canvas",
              content_name: `Canvas Print ${canvasSize}`,
              order_id: session.id,
            });
            console.log(`📱 TikTok server event sent: CompletePayment $${canvasValue} (Canvas ${canvasSize})`);
          } catch (tiktokError) {
            console.warn("⚠️ TikTok server tracking failed:", tiktokError);
          }
          
          if (!canvasImageId || !canvasSize || !shippingDetails?.address) {
            console.error(`❌ Canvas order missing required data: imageId=${canvasImageId}, size=${canvasSize}, shipping=${!!shippingDetails}`);
          } else {
            try {
              // Get the HD image URL from metadata
              const portraitMetadata = await getMetadata(canvasImageId);
              if (!portraitMetadata?.hd_url) {
                throw new Error(`HD image URL not found for imageId: ${canvasImageId}`);
              }
              
              // Build shipping address for Printify
              const shippingAddress: ShippingAddress = {
                first_name: shippingDetails.name?.split(' ')[0] || 'Customer',
                last_name: shippingDetails.name?.split(' ').slice(1).join(' ') || '',
                email: customerEmail || '',
                phone: session.customer_details?.phone || undefined,
                country: shippingDetails.address.country || 'US',
                region: shippingDetails.address.state || '',
                address1: shippingDetails.address.line1 || '',
                address2: shippingDetails.address.line2 || undefined,
                city: shippingDetails.address.city || '',
                zip: shippingDetails.address.postal_code || '',
              };
              
              // Create order with Printify
              const printifyResult = await createFullCanvasOrder(
                portraitMetadata.hd_url,
                canvasSize,
                shippingAddress,
                {
                  petName: portraitMetadata.pet_name,
                  externalId: session.id,
                }
              );
              
              console.log(`✅ Printify order created: ${printifyResult.orderId}`);
              
              // Save canvas order to database
              const { error: dbError } = await supabase
                .from('canvas_orders')
                .insert({
                  image_id: canvasImageId,
                  customer_email: customerEmail || null,
                  canvas_size: canvasSize,
                  stripe_session_id: session.id,
                  printify_order_id: printifyResult.orderId,
                  printify_product_id: printifyResult.productId,
                  status: printifyResult.status, // 'pending' until manually approved in Printify
                  shipping_address: shippingAddress,
                  amount_paid: session.amount_total,
                });
              
              if (dbError) {
                console.error(`⚠️ Failed to save canvas order to database:`, dbError);
              } else {
                console.log(`💾 Canvas order saved to database`);
              }
              
              // Add customer if not already added and mark as canvas purchaser
              if (customerEmail) {
                try {
                  const trafficSource = getTrafficSource(session.metadata);
                  await addCustomer(customerEmail, {
                    purchaseType: 'canvas',
                    imageId: canvasImageId,
                    stripeSessionId: session.id,
                    context: {
                      canvasSize: canvasSize,
                      printifyOrderId: printifyResult.orderId,
                      trafficSource,
                      // UTM attribution data
                      utm_source: session.metadata?.utm_source,
                      utm_medium: session.metadata?.utm_medium,
                      utm_campaign: session.metadata?.utm_campaign,
                      referrer: session.metadata?.referrer,
                    }
                  });
                  
                  // Mark this customer as having purchased a canvas (stops upsell emails)
                  await supabase
                    .from("paying_customers")
                    .update({ 
                      canvas_purchased: true, 
                      canvas_purchased_at: new Date().toISOString() 
                    })
                    .eq("email", customerEmail.toLowerCase().trim());
                  
                  console.log(`🎉 Canvas customer added and marked: ${customerEmail}`);
                } catch (customerError) {
                  console.warn(`⚠️ Failed to add canvas customer:`, customerError);
                }
              }
              
            } catch (canvasError) {
              console.error(`❌ Failed to process canvas order:`, canvasError);
              // Don't throw - return 200 to prevent Stripe retries
              // The order is paid, we need to manually handle this
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
