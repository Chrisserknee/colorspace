/**
 * Leonardo AI API Integration
 * For testing on dev server only - DO NOT push to production without approval
 */

const LEONARDO_API_BASE = "https://cloud.leonardo.ai/api/rest/v1";

interface LeonardoGenerationResponse {
  sdGenerationJob: {
    generationId: string;
  };
}

interface LeonardoGenerationResult {
  generations_by_pk: {
    generated_images: Array<{
      url: string;
      id: string;
    }>;
    status: string;
  };
}

/**
 * Get Leonardo API key from environment
 */
function getLeonardoApiKey(): string {
  const apiKey = process.env.LEONARDO_API_KEY;
  if (!apiKey) {
    throw new Error("LEONARDO_API_KEY is not configured");
  }
  return apiKey;
}

/**
 * Upload an image to Leonardo for img2img generation
 */
export async function uploadImageToLeonardo(imageBuffer: Buffer): Promise<string> {
  const apiKey = getLeonardoApiKey();
  
  console.log("📤 Leonardo Upload Debug:");
  console.log("  - API Key prefix:", apiKey.substring(0, 10) + "...");
  console.log("  - Image buffer size:", imageBuffer.length, "bytes");
  console.log("  - Endpoint:", `${LEONARDO_API_BASE}/init-image`);
  
  // Step 1: Get presigned URL for upload
  console.log("📤 Step 1: Getting presigned URL from Leonardo...");
  
  const requestBody = { extension: "png" };
  console.log("  - Request body:", JSON.stringify(requestBody));
  
  const initResponse = await fetch(`${LEONARDO_API_BASE}/init-image`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  
  console.log("  - Response status:", initResponse.status);
  console.log("  - Response headers:", Object.fromEntries(initResponse.headers.entries()));
  
  const responseText = await initResponse.text();
  console.log("  - Response body:", responseText);
  
  if (!initResponse.ok) {
    console.error("❌ Leonardo init-image failed:", initResponse.status);
    throw new Error(`Failed to init Leonardo upload: ${initResponse.status} - ${responseText}`);
  }
  
  let initData;
  try {
    initData = JSON.parse(responseText);
  } catch (e) {
    throw new Error(`Leonardo returned non-JSON response: ${responseText}`);
  }
  
  console.log("📤 Init response parsed:", JSON.stringify(initData, null, 2));
  
  // Leonardo returns data in uploadInitImage object
  const uploadInitImage = initData.uploadInitImage;
  if (!uploadInitImage) {
    throw new Error(`Leonardo init-image returned unexpected format: ${JSON.stringify(initData)}`);
  }
  
  const { url: uploadUrl, fields: fieldsRaw, id: imageId } = uploadInitImage;
  console.log(`📤 Step 2: Uploading to presigned URL`);
  console.log("  - Upload URL:", uploadUrl);
  console.log("  - Image ID:", imageId);
  console.log("  - Fields (raw type):", typeof fieldsRaw);
  
  // Parse fields - Leonardo returns it as a JSON string!
  let fields: Record<string, string>;
  if (typeof fieldsRaw === 'string') {
    console.log("  - Parsing fields from JSON string...");
    fields = JSON.parse(fieldsRaw);
  } else {
    fields = fieldsRaw as Record<string, string>;
  }
  console.log("  - Parsed fields:", Object.keys(fields));
  
  // Step 2: Upload image to presigned URL using multipart form
  const formData = new FormData();
  
  // Add all fields from the presigned URL response FIRST (order matters for S3!)
  // IMPORTANT: 'key' must be one of the first fields for S3
  const fieldOrder = ['key', 'bucket', 'Content-Type', 'X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Security-Token', 'Policy', 'X-Amz-Signature'];
  
  // Add fields in the correct order
  for (const fieldName of fieldOrder) {
    if (fields[fieldName]) {
      console.log(`  - Adding field: ${fieldName}=${fields[fieldName].substring(0, 30)}...`);
      formData.append(fieldName, fields[fieldName]);
    }
  }
  
  // Add any remaining fields that weren't in our order list
  for (const [key, value] of Object.entries(fields)) {
    if (!fieldOrder.includes(key)) {
      console.log(`  - Adding extra field: ${key}=${value.substring(0, 30)}...`);
      formData.append(key, value);
    }
  }
  
  // Add the file LAST (S3 requires file to be last)
  const blob = new Blob([new Uint8Array(imageBuffer)], { type: "image/png" });
  formData.append("file", blob, "image.png");
  console.log("  - Added file: image.png (size:", imageBuffer.length, "bytes)");
  
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: formData,
  });
  
  console.log("  - S3 Upload status:", uploadResponse.status);
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error("❌ Leonardo S3 upload failed:", uploadResponse.status, errorText);
    throw new Error(`Failed to upload image to Leonardo S3: ${uploadResponse.status} - ${errorText}`);
  }
  
  console.log(`✅ Image uploaded successfully, imageId: ${imageId}`);
  return imageId;
}

/**
 * Generate image using Leonardo AI (img2img style)
 */
export async function generateWithLeonardo(
  prompt: string,
  options: {
    initImageId?: string;  // For img2img
    width?: number;
    height?: number;
    numImages?: number;
    modelId?: string;
    strength?: number;  // For img2img, how much to transform (0-1)
    guidanceScale?: number;
    negativePrompt?: string;
  } = {}
): Promise<{ generationId: string }> {
  const apiKey = getLeonardoApiKey();
  
  const {
    initImageId,
    width = 1024,
    height = 1024,
    numImages = 1,
    // Leonardo Kino XL is good for artistic styles
    modelId = "aa77f04e-3eec-4034-9c07-d0f619684628", // Leonardo Kino XL
    strength = 0.5,
    guidanceScale = 7,
    negativePrompt = "blurry, low quality, distorted, deformed, ugly, bad anatomy",
  } = options;
  
  const body: Record<string, unknown> = {
    prompt,
    modelId,
    width,
    height,
    num_images: numImages,
    guidance_scale: guidanceScale,
    negative_prompt: negativePrompt,
    // Use CREATIVE or ILLUSTRATION preset for more artistic transformation
    presetStyle: "ILLUSTRATION",
    scheduler: "LEONARDO",
    public: false,
    // Enable Alchemy for better quality transformations
    alchemy: true,
    // Higher contrast helps with painting look
    contrast: 3.5,
  };
  
  // Add init image for img2img
  if (initImageId) {
    body.init_image_id = initImageId;
    body.init_strength = strength;
    // Use IMAGE to IMAGE mode for style transfer
    body.imagePromptWeight = 0.4; // Balance between prompt and image
  }
  
  console.log("🎨 Leonardo API request:", JSON.stringify(body, null, 2));
  
  const response = await fetch(`${LEONARDO_API_BASE}/generations`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Leonardo generation failed: ${error}`);
  }
  
  const data: LeonardoGenerationResponse = await response.json();
  return { generationId: data.sdGenerationJob.generationId };
}

/**
 * Poll for generation result
 */
export async function getGenerationResult(
  generationId: string,
  maxAttempts: number = 60,
  delayMs: number = 2000
): Promise<string[]> {
  const apiKey = getLeonardoApiKey();
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`${LEONARDO_API_BASE}/generations/${generationId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get generation status: ${error}`);
    }
    
    const data: LeonardoGenerationResult = await response.json();
    const status = data.generations_by_pk?.status;
    
    console.log(`🎨 Leonardo generation status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);
    
    if (status === "COMPLETE") {
      const images = data.generations_by_pk.generated_images;
      if (images && images.length > 0) {
        return images.map(img => img.url);
      }
      throw new Error("Generation complete but no images returned");
    }
    
    if (status === "FAILED") {
      throw new Error("Leonardo generation failed");
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error("Leonardo generation timed out");
}

/**
 * Full img2img workflow: upload image, generate, get result
 */
export async function leonardoImg2Img(
  imageBuffer: Buffer,
  prompt: string,
  options: {
    strength?: number;
    modelId?: string;
    guidanceScale?: number;
    negativePrompt?: string;
  } = {}
): Promise<Buffer> {
  console.log("🎨 Starting Leonardo img2img generation...");
  
  // Step 1: Upload source image
  console.log("📤 Uploading image to Leonardo...");
  const initImageId = await uploadImageToLeonardo(imageBuffer);
  console.log(`✅ Image uploaded: ${initImageId}`);
  
  // Step 2: Start generation
  console.log("🖼️ Starting generation...");
  const { generationId } = await generateWithLeonardo(prompt, {
    initImageId,
    ...options,
  });
  console.log(`✅ Generation started: ${generationId}`);
  
  // Step 3: Poll for result
  console.log("⏳ Waiting for generation to complete...");
  const imageUrls = await getGenerationResult(generationId);
  console.log(`✅ Generation complete: ${imageUrls.length} image(s)`);
  
  // Step 4: Download the generated image
  const imageUrl = imageUrls[0];
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }
  
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Text-to-image generation with Leonardo
 */
export async function leonardoTextToImage(
  prompt: string,
  options: {
    width?: number;
    height?: number;
    modelId?: string;
    guidanceScale?: number;
    negativePrompt?: string;
  } = {}
): Promise<Buffer> {
  console.log("🎨 Starting Leonardo text-to-image generation...");
  
  // Start generation (no init image)
  const { generationId } = await generateWithLeonardo(prompt, options);
  console.log(`✅ Generation started: ${generationId}`);
  
  // Poll for result
  const imageUrls = await getGenerationResult(generationId);
  console.log(`✅ Generation complete: ${imageUrls.length} image(s)`);
  
  // Download the generated image
  const imageUrl = imageUrls[0];
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }
  
  const arrayBuffer = await imageResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// Leonardo model IDs for reference
export const LEONARDO_MODELS = {
  KINO_XL: "aa77f04e-3eec-4034-9c07-d0f619684628", // Good for cinematic/artistic
  LIGHTNING_XL: "b24e16ff-06e3-43eb-8d33-4416c2d75876", // Fast generation
  VISION_XL: "5c232a9e-9061-4777-980a-ddc8e65647c6", // Photorealistic
  ANIME_XL: "e71a1c2f-4f80-4800-934f-2c68979d8cc8", // Anime style
  DIFFUSION_XL: "1e60896f-3c26-4296-8ecc-53e2afecc132", // General purpose
};

