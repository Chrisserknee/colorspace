import { NextRequest, NextResponse } from "next/server";
import { saveContact } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { isValidEmail, sanitizeString } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  // Rate limiting
  const rateLimit = checkRateLimit(`contact:${clientIP}`, RATE_LIMITS.contact);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString() } }
    );
  }

  try {
    const body = await request.json();
    const { name, email, message } = body;

    // Validation
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { error: "Message must be at least 10 characters long" },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedName = sanitizeString(name.trim(), 100);
    const sanitizedEmail = sanitizeString(email.toLowerCase().trim(), 254);
    const sanitizedMessage = sanitizeString(message.trim(), 2000);

    // Save contact form submission (will fallback to emails table if contacts doesn't exist)
    const result = await saveContact({
      name: sanitizedName,
      email: sanitizedEmail,
      message: sanitizedMessage,
      ip_address: clientIP,
    });

    if (!result.success) {
      console.error("Failed to save contact form:", result.error);
      return NextResponse.json(
        { error: "Failed to send message. Please try again later." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, message: "Message sent successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    );
  }
}

