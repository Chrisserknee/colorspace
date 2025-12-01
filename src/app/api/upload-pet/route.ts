import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { uploadPetPhoto } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { validateImageMagicBytes } from "@/lib/validation";
import { CONFIG } from "@/lib/config";

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);

  // Rate limiting - use a more lenient limit for uploads
  const rateLimit = checkRateLimit(`upload:${clientIP}`, RATE_LIMITS.generate);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Please wait a moment." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;
    const source = formData.get("source") as string | null; // "lumepet" or "rainbow-bridge"

    if (!imageFile) {
      return NextResponse.json(
        { error: "No image file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!CONFIG.ACCEPTED_TYPES.includes(imageFile.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload JPEG, PNG, or WebP." },
        { status: 400 }
      );
    }

    // Validate file size
    if (imageFile.size > CONFIG.MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate magic bytes
    const isValidImage = await validateImageMagicBytes(bytes);
    if (!isValidImage) {
      console.warn(`Invalid image magic bytes from IP: ${clientIP}`);
      return NextResponse.json(
        { error: "Invalid image file." },
        { status: 400 }
      );
    }

    // Generate unique ID and upload
    const uploadId = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const extension = imageFile.type.split("/")[1] || "png";
    const sourcePrefix = source === "rainbow-bridge" ? "rb" : "lp";
    const fileName = `${sourcePrefix}-${uploadId}-${timestamp}.${extension}`;

    console.log(`📷 Uploading pet photo immediately: ${fileName}`);

    const url = await uploadPetPhoto(buffer, fileName, imageFile.type);

    if (url) {
      console.log(`✅ Pet photo uploaded successfully: ${fileName}`);
      return NextResponse.json({
        success: true,
        uploadId,
        fileName,
        url, // Return the full Supabase URL for session saving
      });
    } else {
      // Non-critical failure - still return success but note the upload failed
      console.warn(`⚠️ Pet photo upload failed but continuing: ${fileName}`);
      return NextResponse.json({
        success: true,
        uploadId,
        uploadFailed: true,
      });
    }
  } catch (error) {
    console.error("Upload error:", error);
    // Don't fail the user experience - just log the error
    return NextResponse.json({
      success: true,
      uploadFailed: true,
      error: "Upload failed but you can continue",
    });
  }
}

