import { NextRequest, NextResponse } from "next/server";
import { sendOrderToProduction, getOrderStatus } from "@/lib/printify";
import { sendCanvasShippedEmail } from "@/lib/email";
import { supabase, getMetadata } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    // Basic auth check - you can enhance this with proper admin authentication
    const authHeader = request.headers.get("authorization");
    const expectedAuth = process.env.ADMIN_API_KEY;
    
    if (!expectedAuth || authHeader !== `Bearer ${expectedAuth}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { printifyOrderId, trackingNumber } = body;

    if (!printifyOrderId) {
      return NextResponse.json(
        { error: "printifyOrderId is required" },
        { status: 400 }
      );
    }

    // Get canvas order from database
    const { data: canvasOrder, error: orderError } = await supabase
      .from("canvas_orders")
      .select("*")
      .eq("printify_order_id", printifyOrderId)
      .single();

    if (orderError || !canvasOrder) {
      return NextResponse.json(
        { error: "Canvas order not found" },
        { status: 404 }
      );
    }

    // Check if already sent to production
    if (canvasOrder.status === "production" || canvasOrder.status === "shipped") {
      return NextResponse.json(
        { error: "Order already sent to production" },
        { status: 400 }
      );
    }

    // Send order to production in Printify
    try {
      await sendOrderToProduction(printifyOrderId);
      console.log(`✅ Order ${printifyOrderId} sent to production`);
    } catch (printifyError) {
      console.error("Failed to send order to production:", printifyError);
      return NextResponse.json(
        { error: `Failed to send to production: ${printifyError instanceof Error ? printifyError.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    // Update order status in database
    const { error: updateError } = await supabase
      .from("canvas_orders")
      .update({
        status: "production",
        sent_to_production_at: new Date().toISOString(),
        tracking_number: trackingNumber || null,
      })
      .eq("printify_order_id", printifyOrderId);

    if (updateError) {
      console.error("Failed to update order status:", updateError);
      // Don't fail - order was sent to production successfully
    }

    // Get pet metadata for email
    let petName: string | undefined;
    if (canvasOrder.image_id) {
      try {
        const metadata = await getMetadata(canvasOrder.image_id);
        petName = metadata?.pet_name;
      } catch (err) {
        console.warn("Failed to get pet metadata:", err);
      }
    }

    // Send shipped email to customer
    if (canvasOrder.customer_email) {
      try {
        const shippingAddress = canvasOrder.shipping_address as {
          first_name: string;
          last_name: string;
          address1: string;
          address2?: string;
          city: string;
          region: string;
          zip: string;
          country: string;
        };

        const shippedEmailResult = await sendCanvasShippedEmail({
          to: canvasOrder.customer_email,
          orderId: canvasOrder.stripe_session_id,
          printifyOrderId: printifyOrderId,
          canvasSize: canvasOrder.canvas_size,
          trackingNumber: trackingNumber || undefined,
          shippingAddress: {
            name: `${shippingAddress.first_name} ${shippingAddress.last_name}`,
            line1: shippingAddress.address1,
            line2: shippingAddress.address2,
            city: shippingAddress.city,
            state: shippingAddress.region,
            postalCode: shippingAddress.zip,
            country: shippingAddress.country,
          },
          petName: petName,
        });

        if (shippedEmailResult.success) {
          console.log(`📧 Canvas shipped email sent to ${canvasOrder.customer_email}`);
        } else {
          console.warn(`⚠️ Failed to send canvas shipped email: ${shippedEmailResult.error}`);
        }
      } catch (emailError) {
        console.warn(`⚠️ Canvas shipped email error:`, emailError);
        // Don't fail the request - order was sent to production
      }
    }

    return NextResponse.json({
      success: true,
      message: `Order ${printifyOrderId} sent to production`,
      orderId: printifyOrderId,
      status: "production",
    });
  } catch (error) {
    console.error("Send to production error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

