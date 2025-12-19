import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "@/lib/config";
import { uploadImage, saveMetadata, incrementPortraitCount, supabase } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { validateImageMagicBytes } from "@/lib/validation";
import { createWatermarkedImage } from "@/lib/watermark";
import { HUMAN_PORTRAIT_LOCATIONS, getRandomHumanPortraitLocation } from "@/lib/apps/human-portrait";

// Upscale image using Real-ESRGAN for higher resolution
async function upscaleImage(inputBuffer: Buffer, scale: number = 2, maxRetries: number = 3): Promise<Buffer> {
  console.log("=== UPSCALING IMAGE ===");
  console.log(`Input buffer size: ${inputBuffer.length} bytes`);
  console.log(`Target scale: ${scale}x`);
  
  if (!process.env.REPLICATE_API_TOKEN) {
    console.warn("REPLICATE_API_TOKEN not set, skipping upscale");
    return inputBuffer;
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });
  
  // Get original dimensions
  const metadata = await sharp(inputBuffer).metadata();
  const originalWidth = metadata.width || 1024;
  const originalHeight = metadata.height || 1024;
  console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);
  
  // If image is very large, resize it first to avoid API issues (max 2048px on longest side)
  let processBuffer = inputBuffer;
  const maxInputSize = 2048;
  if (originalWidth > maxInputSize || originalHeight > maxInputSize) {
    console.log(`Image too large (${originalWidth}x${originalHeight}), resizing to max ${maxInputSize}px before upscale...`);
    processBuffer = await sharp(inputBuffer)
      .resize(maxInputSize, maxInputSize, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    const resizedMeta = await sharp(processBuffer).metadata();
    console.log(`Resized to ${resizedMeta.width}x${resizedMeta.height} for upscaling`);
  }
  
  // Convert buffer to base64 data URL
  const processMetadata = await sharp(processBuffer).metadata();
  const base64Image = processBuffer.toString("base64");
  const mimeType = processMetadata.format === "png" ? "image/png" : "image/jpeg";
  const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Upscale attempt ${attempt}/${maxRetries}...`);
      
      // Use Real-ESRGAN for high-quality upscaling with face enhancement
      console.log("Running Real-ESRGAN upscaler with face enhancement...");
      const startTime = Date.now();
      
      const output = await replicate.run(
        "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
        {
          input: {
            image: imageDataUrl,
            scale: scale,
            face_enhance: true, // Enable face enhancement for human portraits
          }
        }
      );
      
      const elapsedTime = Date.now() - startTime;
      console.log(`Upscale API completed in ${elapsedTime}ms`);
      
      // Handle output - could be string URL or FileOutput object
      let upscaledBuffer: Buffer;
      let downloadUrl: string | null = null;
      
      if (typeof output === "string") {
        downloadUrl = output;
      } else if (output && typeof output === "object") {
        const outputObj = output as { url?: () => string } | string;
        
        if (typeof outputObj === "string") {
          downloadUrl = outputObj;
        } else if ("url" in outputObj && typeof outputObj.url === "function") {
          downloadUrl = outputObj.url();
        } else {
          downloadUrl = String(output);
        }
      }
      
      if (!downloadUrl) {
        throw new Error("No download URL received from upscaler");
      }
      
      console.log("Downloading upscaled image...");
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Failed to download upscaled image: ${response.status}`);
      upscaledBuffer = Buffer.from(await response.arrayBuffer());
      
      // Validate upscaled image
      const newMetadata = await sharp(upscaledBuffer).metadata();
      const newWidth = newMetadata.width || 0;
      const newHeight = newMetadata.height || 0;
      
      console.log(`Upscaled dimensions: ${newWidth}x${newHeight}`);
      console.log(`Upscaled buffer size: ${upscaledBuffer.length} bytes`);
      
      // Verify the image was actually upscaled
      const inputWidth = processMetadata.width || 1024;
      const inputHeight = processMetadata.height || 1024;
      const expectedMinWidth = inputWidth * scale * 0.9;
      const expectedMinHeight = inputHeight * scale * 0.9;
      
      if (newWidth < expectedMinWidth || newHeight < expectedMinHeight) {
        console.warn(`⚠️ Upscaled image smaller than expected! Got ${newWidth}x${newHeight}, expected at least ${Math.round(expectedMinWidth)}x${Math.round(expectedMinHeight)}`);
        throw new Error(`Upscaled image dimensions too small: ${newWidth}x${newHeight}`);
      }
      
      console.log(`✅ Upscale successful on attempt ${attempt}! Final size: ${newWidth}x${newHeight}`);
      return upscaledBuffer;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Upscale attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        const delay = attempt * 2000;
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed - use sharp to upscale as fallback
  console.error(`❌ All ${maxRetries} upscale attempts failed. Using sharp fallback upscale.`);
  console.error(`Last error: ${lastError?.message}`);
  
  try {
    const targetWidth = originalWidth * scale;
    const targetHeight = originalHeight * scale;
    console.log(`Fallback: Using sharp to upscale to ${targetWidth}x${targetHeight}...`);
    
    const fallbackBuffer = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, { 
        kernel: 'lanczos3',
        fit: 'fill'
      })
      .sharpen({ sigma: 0.5 })
      .png()
      .toBuffer();
    
    const fallbackMeta = await sharp(fallbackBuffer).metadata();
    console.log(`✅ Fallback upscale complete: ${fallbackMeta.width}x${fallbackMeta.height}`);
    return fallbackBuffer;
  } catch (fallbackError) {
    console.error("Fallback upscale also failed:", fallbackError);
    return inputBuffer;
  }
}

// Portrait style palettes for human portraits
const PORTRAIT_STYLES = [
  {
    name: "ROYAL GOLD",
    background: "deep burgundy velvet backdrop with subtle gold accents",
    mood: "regal, majestic, commanding",
    colors: "rich burgundy, antique gold, ruby highlights",
    lighting: "warm golden candlelight from the side"
  },
  {
    name: "VENETIAN RENAISSANCE",
    background: "warm terracotta and cream tones, soft atmospheric perspective",
    mood: "romantic, painterly, timeless",
    colors: "warm ivory, sienna, muted emerald, antique gold",
    lighting: "soft diffused daylight, Venetian master style"
  },
  {
    name: "DUTCH GOLDEN AGE",
    background: "deep brown with subtle warm undertones, Rembrandt style",
    mood: "intimate, dignified, psychological depth",
    colors: "rich browns, warm blacks, creamy whites, golden highlights",
    lighting: "dramatic chiaroscuro, single light source"
  },
  {
    name: "ELEGANT IVORY",
    background: "pure ivory white with soft cream undertones",
    mood: "clean, sophisticated, timeless",
    colors: "ivory, champagne, soft rose gold, pearl",
    lighting: "bright diffused natural light"
  },
  {
    name: "ARISTOCRATIC BLUE",
    background: "deep midnight blue with subtle gold accents",
    mood: "refined, distinguished, noble",
    colors: "deep sapphire, navy, burnished gold, silver",
    lighting: "cool moonlight mixed with warm candlelight"
  },
  {
    name: "GARDEN ROMANTIC",
    background: "soft green gardens with distant pastoral landscape",
    mood: "romantic, pastoral, serene",
    colors: "sage green, cream, dusty rose, antique gold",
    lighting: "soft golden hour sunlight"
  },
  {
    name: "BAROQUE OPULENCE",
    background: "gilded palace interior with crystal chandeliers",
    mood: "grand, theatrical, magnificent",
    colors: "deep crimson, burnished gold, ivory, ebony",
    lighting: "dramatic golden light from multiple candelabras"
  },
  {
    name: "ENGLISH COUNTRY",
    background: "library interior with leather-bound books and hunting art",
    mood: "distinguished, scholarly, refined",
    colors: "forest green, burgundy leather, aged gold, oak brown",
    lighting: "warm firelight mixed with afternoon sun"
  },
];

// Get a random style
function getRandomStyle(): typeof PORTRAIT_STYLES[0] {
  return PORTRAIT_STYLES[Math.floor(Math.random() * PORTRAIT_STYLES.length)];
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIP(request);
  
  console.log("=== Human Portrait API called ===");
  console.log("Client IP:", clientIP);
  
  // Parse form data
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (e) {
    console.error("Failed to parse form data:", e);
    return NextResponse.json(
      { error: "Invalid request format" },
      { status: 400 }
    );
  }
  
  // Rate limiting
  const rateLimit = checkRateLimit(`generate-human:${clientIP}`, RATE_LIMITS.generate);
  if (!rateLimit.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 }
    );
  }
  
  try {
    // Check for API keys
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const imageFile = formData.get("image") as File | null;
    const enableWatermark = formData.get("enableWatermark") !== "false";

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
    
    // Validate image
    const isValidImage = await validateImageMagicBytes(bytes);
    if (!isValidImage) {
      return NextResponse.json(
        { error: "Invalid image file. Please upload a valid JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    const imageId = uuidv4();

    // Process image for vision API
    const processedImage = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64Image = processedImage.toString("base64");

    // Step 1: Analyze the photo with GPT-5.2 for detailed description (supports multiple people)
    console.log("🎨 Analyzing photo with GPT-5.2...");
    const visionStartTime = Date.now();
    
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-5.2" as "gpt-4o",
      reasoning_effort: "none",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this photo with EXTREME PRECISION for portrait generation. Describe ALL PEOPLE visible in the image (up to 15 people) so they would be INSTANTLY RECOGNIZABLE.

FIRST LINE: State the number of people and their genders like this:
- If 1 person: "PEOPLE: 1 (female)" or "PEOPLE: 1 (male)"
- If 2 people: "PEOPLE: 2 (male and female)" or "PEOPLE: 2 (both male)" etc.
- For groups: "PEOPLE: 8 (5 female, 3 male)" etc.

Then describe EACH PERSON in detail (for large groups 6+, you may use briefer descriptions focusing on the most distinctive features):

FOR EACH PERSON, provide:

1. FACE: Shape, key features (eyes, nose, mouth)
2. HAIR: Color, texture, style
3. SKIN: Tone and any distinctive marks
4. UNIQUE IDENTIFIERS: 3-5 features that make THIS person recognizable

For groups of 1-5, give DETAILED descriptions.
For groups of 6-15, focus on DISTINCTIVE features that differentiate each person.

Label each person clearly:
"PERSON 1 (position - e.g., front left): [description]"
"PERSON 2 (position - e.g., back center): [description]"
...continue for all people...

Describe their ARRANGEMENT (e.g., "family gathered around parents", "wedding party in rows", "friends in casual group").

The portrait MUST include ALL people in the image in their relative positions.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_completion_tokens: 3000, // Increased for large group descriptions (up to 15 people)
      temperature: 0.1,
    });

    let personDescription = visionResponse.choices[0]?.message?.content || "";
    console.log(`Vision analysis took ${Date.now() - visionStartTime}ms`);
    console.log("Person description (first 800 chars):", personDescription.substring(0, 800));
    
    // Extract number of people and composition info
    let numPeople = 1;
    let isCouple = false;
    let hasMale = false;
    let hasFemale = false;
    
    const peopleMatch = personDescription.match(/PEOPLE:\s*(\d+)\s*\(([^)]+)\)/i);
    if (peopleMatch) {
      numPeople = parseInt(peopleMatch[1]) || 1;
      const genderInfo = peopleMatch[2].toLowerCase();
      hasMale = genderInfo.includes("male") && !genderInfo.includes("female");
      hasFemale = genderInfo.includes("female");
      if (genderInfo.includes("male") && genderInfo.includes("female")) {
        hasMale = true;
        hasFemale = true;
      }
      if (genderInfo.includes("both male")) {
        hasMale = true;
        hasFemale = false;
      }
      if (genderInfo.includes("both female")) {
        hasMale = false;
        hasFemale = true;
      }
      isCouple = numPeople === 2;
      // Remove the PEOPLE line from description
      personDescription = personDescription.replace(/PEOPLE:\s*\d+\s*\([^)]+\)\n?/i, "").trim();
    } else {
      // Fallback: detect from content
      if (personDescription.toLowerCase().includes("female") || personDescription.toLowerCase().includes("woman")) {
        hasFemale = true;
      }
      if (personDescription.toLowerCase().includes("male") || personDescription.toLowerCase().includes("man")) {
        hasMale = true;
      }
    }
    
    console.log(`Detected: ${numPeople} people, male: ${hasMale}, female: ${hasFemale}, couple: ${isCouple}`);
    
    // Check if the model refused to analyze
    if (personDescription.toLowerCase().includes("i'm sorry") || 
        personDescription.toLowerCase().includes("i cannot") ||
        personDescription.toLowerCase().includes("can't analyze") ||
        personDescription.length < 50) {
      console.log("⚠️ Vision model refused or gave short response, using fallback prompt...");
      
      // Try a simpler, more direct approach
      const fallbackResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `I'm creating a classical oil portrait. Please describe ALL people visible in this reference photo:
- Number of people
- For each person: gender, face shape, eyes, eyebrows, nose, mouth, hair (color, texture, style), skin tone
- Their positions relative to each other
- Any distinctive features

Describe all observable features for the portrait artist.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: "high",
                },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
      });
      
      personDescription = fallbackResponse.choices[0]?.message?.content || "distinguished people with refined features";
      console.log("Fallback description:", personDescription.substring(0, 200));
    }

    // Step 2: Select random style and location
    const style = getRandomStyle();
    const location = getRandomHumanPortraitLocation();
    
    console.log(`Selected style: ${style.name}`);
    console.log(`Selected location: ${location.name}`);

    // Step 3: Build subject context based on number of people
    let subjectContext = "";
    let aestheticStyling = "";
    
    if (numPeople === 1) {
      subjectContext = hasFemale ? "this woman" : "this man";
      aestheticStyling = hasFemale ? `
=== FEMININE AESTHETIC ===
- Softer, more elegant styling
- Delicate fabrics and jewelry (pearl earrings, subtle necklace)
- Gentler lighting with flattering shadows
- Graceful, poised composition
- Elegant hairstyle appropriate to the era` : `
=== REFINED MASCULINE AESTHETIC ===
- Distinguished, elegant styling
- Rich but not harsh colors
- Refined fabrics with soft textures
- Sophisticated, warm lighting
- Strong but approachable composition`;
    } else if (isCouple && hasMale && hasFemale) {
      subjectContext = "this couple (man and woman together)";
      aestheticStyling = `
=== COUPLE PORTRAIT AESTHETIC ===
- Both subjects in elegant period-appropriate attire
- The woman in a beautiful gown with delicate jewelry
- The man in distinguished aristocratic clothing
- Romantic, intimate composition showing their connection
- Both positioned naturally together as they appear in the reference
- Complementary colors that harmonize between both subjects`;
    } else if (numPeople === 2) {
      subjectContext = "these two people together";
      aestheticStyling = `
=== DUAL PORTRAIT AESTHETIC ===
- Both subjects in elegant period-appropriate attire
- Each person's unique features preserved perfectly
- Harmonious composition showing both together
- Both positioned as they appear in the reference photo
- Complementary styling between both subjects`;
    } else if (numPeople === 3) {
      subjectContext = "these three people together";
      aestheticStyling = `
=== TRIO PORTRAIT AESTHETIC ===
- All three subjects in elegant period-appropriate attire
- Each person's unique features preserved perfectly
- Classic triangular group composition
- All three positioned as they appear in the reference photo
- Harmonious styling that connects all three subjects`;
    } else if (numPeople === 4) {
      subjectContext = "these four people together";
      aestheticStyling = `
=== FAMILY/GROUP PORTRAIT AESTHETIC ===
- All four subjects in elegant period-appropriate attire
- Each person's unique features preserved perfectly
- Classic family portrait composition
- All four positioned as they appear in the reference photo
- Harmonious styling across all subjects`;
    } else if (numPeople >= 5 && numPeople <= 8) {
      subjectContext = `these ${numPeople} people together`;
      aestheticStyling = `
=== GROUP PORTRAIT AESTHETIC ===
- All ${numPeople} subjects in elegant period-appropriate attire
- Each person's unique features preserved perfectly
- Classic group portrait composition (like aristocratic family portraits)
- All people positioned as they appear in the reference photo
- Harmonious, balanced styling across all subjects
- Ensure no one is cropped or obscured
- Clear visibility of each person's face`;
    } else if (numPeople >= 9 && numPeople <= 15) {
      subjectContext = `these ${numPeople} people together`;
      aestheticStyling = `
=== GRAND GROUP PORTRAIT AESTHETIC ===
- All ${numPeople} subjects in elegant period-appropriate attire
- Each person's distinctive features preserved
- Grand composition style (like royal court or wedding party portraits)
- Multiple rows/levels if needed for visibility
- All people positioned as they appear in the reference photo
- Harmonious styling that unifies the group
- CRITICAL: Every single person must be visible and recognizable
- Balanced lighting across all faces
- Classic formal group portrait arrangement`;
    } else {
      // Fallback for any edge cases
      const displayNum = Math.min(numPeople, 15);
      subjectContext = `these ${displayNum} people together`;
      aestheticStyling = `
=== GROUP PORTRAIT AESTHETIC ===
- All ${displayNum} subjects in elegant period-appropriate attire
- Each person's unique features preserved perfectly
- Classic group portrait composition
- All people positioned as they appear in the reference
- Harmonious styling across all subjects`;
    }

    // Step 4: Build the generation prompt for GPT-image-1.5
    let identityInstruction: string;
    if (numPeople === 1) {
      identityInstruction = `- Must look EXACTLY like this person
- Preserve exact face shape, features, expression
- Maintain skin tone, hair color, eye color precisely
- The person must INSTANTLY recognize themselves
- All unique features preserved perfectly`;
    } else if (numPeople <= 5) {
      identityInstruction = `- Must look EXACTLY like the ${numPeople} people in the reference
- Preserve EACH person's exact face shape, features, expression
- Maintain EACH person's skin tone, hair color, eye color precisely
- EVERYONE in the image must be INSTANTLY recognizable
- ALL unique features preserved perfectly for EACH person
- Keep the same relative positions as in the reference photo`;
    } else {
      // Large groups (6-15 people)
      identityInstruction = `- Must include ALL ${numPeople} people from the reference photo
- Preserve each person's distinctive facial features and characteristics
- Maintain each person's skin tone, hair color, eye color
- Each person should be recognizable by their unique features
- Keep the same arrangement/positions as in the reference
- Ensure every face is visible and distinguishable
- No one should be cropped out or obscured`;
    }

    const generationPrompt = `Classical aristocratic oil portrait of ${subjectContext}.

THE SUBJECT(S) (MUST MATCH EXACTLY):
${personDescription}

SETTING: ${location.name}
${location.description}
Lighting: ${location.lighting}
Mood: ${location.mood}

STYLE: ${style.name}
${style.background}
Colors: ${style.colors}
${style.lighting}

${aestheticStyling}

PORTRAIT STYLE (CRITICAL - MUST BE PAINTERLY):
- Classical oil painting with THICK, VISIBLE BRUSHSTROKES throughout
- Heavy impasto technique - textured paint application you can almost feel
- Bold, expressive brushwork like Rembrandt or John Singer Sargent
- NOT smooth or airbrushed - emphasize the hand-painted quality
- Visible paint texture on canvas, rough edges on brushstrokes
- Rich, layered paint with dimensional quality
- Oil painting craquelure and aged patina
- Museum masterpiece with authentic painted look

WARDROBE:
- Elegant period-appropriate attire for ${numPeople > 1 ? 'each person' : 'the subject'}
- Rich velvet or silk fabrics in jewel tones
- Tasteful jewelry appropriate to the era
- Refined, aristocratic clothing

COMPOSITION & FRAMING (CRITICAL):
- ${numPeople === 1 ? 'Three-quarter or classical portrait pose' : numPeople <= 5 ? 'Classic group portrait composition' : 'Grand formal group portrait composition (like royal court paintings)'}
- Natural, dignified expression${numPeople > 1 ? 's for all' : ''}
- ${numPeople === 1 ? 'Elegant hand positioning if visible' : `All ${numPeople} people positioned together as in the reference`}
- ${numPeople > 8 ? 'Multiple rows/levels to ensure everyone is visible' : 'Professional portrait framing'}
- ${numPeople > 5 ? 'Every single face must be clearly visible and recognizable' : 'Professional portrait framing'}
- FULL HEAD visible with SPACE ABOVE the head - never crop the top of the head
- Classic portrait framing: head positioned in upper third with room above
- Include from chest/shoulders up to well above the crown of the head
- Generous headroom - like traditional painted portraits in museums

IDENTITY PRESERVATION (CRITICAL):
${identityInstruction}

OUTPUT: Authentic hand-painted oil portrait with THICK VISIBLE BRUSHSTROKES. ${numPeople === 1 ? 'Natural human pose.' : `All ${numPeople} people included together, each recognizable.`} Textured, painterly museum masterpiece.

DO NOT: 
- Change any facial features
- Alter skin tone, eye color, or hair color
- ${numPeople > 1 ? `Omit ANY of the ${numPeople} people from the image` : 'Add extra people'}
- Add text, words, or typography
- Create photorealistic or smooth rendering
- Modern digital art style
- Smooth, airbrushed, or overly polished look
- Distort proportions
- ${numPeople > 1 ? 'Crop out or obscure any person' : 'Add extra elements'}
- CUT OFF or CROP the top of any head - full heads must be visible
- Tight framing that clips hair or forehead`;

    console.log("Generating human portrait with GPT-Image-1.5...");
    const generationStartTime = Date.now();

    // Prepare image for OpenAI img2img
    const processedForOpenAI = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    // Convert buffer to File for OpenAI API
    const uint8Array = new Uint8Array(processedForOpenAI);
    const imageBlob = new Blob([uint8Array], { type: "image/png" });
    const imageFileForOpenAI = new File([imageBlob], "photo.png", { type: "image/png" });

    // Generate portrait with img2img using GPT-image-1.5
    const imageResponse = await openai.images.edit({
      model: "gpt-image-1.5" as "gpt-image-1" | "dall-e-2",
      image: imageFileForOpenAI,
      prompt: generationPrompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    });

    const imageData = imageResponse.data?.[0];

    if (!imageData) {
      throw new Error("No image generated");
    }

    let generatedBuffer: Buffer;
    if (imageData.b64_json) {
      generatedBuffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download generated image: ${downloadResponse.status}`);
      }
      const arrayBuffer = await downloadResponse.arrayBuffer();
      generatedBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error("No image data in response");
    }

    console.log(`Image generation took ${Date.now() - generationStartTime}ms`);

    // Upscale image for higher resolution - enabled by default
    const enableUpscale = process.env.ENABLE_UPSCALE !== "false";
    const upscaleScale = parseInt(process.env.UPSCALE_SCALE || "2");
    
    if (enableUpscale) {
      console.log("=== UPSCALE ENABLED ===");
      console.log(`Upscaling by ${upscaleScale}x with face enhancement...`);
      try {
        generatedBuffer = await upscaleImage(generatedBuffer, upscaleScale);
        console.log("✅ Image upscaled successfully with face enhancement");
      } catch (upscaleError) {
        console.error("Upscale failed, using original resolution:", upscaleError);
      }
    } else {
      console.log("Upscale disabled (ENABLE_UPSCALE=false)");
    }

    // Process and optimize the generated image
    const upscaledMeta = await sharp(generatedBuffer).metadata();
    const finalSize = upscaledMeta.width || 2048;
    
    const finalImage = await sharp(generatedBuffer)
      .resize(finalSize, finalSize, { fit: "inside", withoutEnlargement: true })
      .png({ quality: 95, compressionLevel: 6 })
      .toBuffer();

    // Create watermarked preview if enabled
    let previewBuffer: Buffer;
    if (enableWatermark) {
      previewBuffer = await createWatermarkedImage(finalImage);
      console.log("Created watermarked preview");
    } else {
      previewBuffer = finalImage;
    }

    // Upload to storage
    console.log("Uploading to Supabase storage...");
    
    const [hdUrl, previewUrl] = await Promise.all([
      uploadImage(finalImage, `${imageId}-hd.png`, "image/png"),
      uploadImage(previewBuffer, `${imageId}-preview.png`, "image/png"),
    ]);

    if (!hdUrl || !previewUrl) {
      throw new Error("Failed to upload images to storage");
    }

    console.log("✅ Images uploaded successfully:");
    console.log("  HD URL:", hdUrl);
    console.log("  Preview URL:", previewUrl);
    
    // Verify files exist and are accessible
    try {
      const { data: files, error: listError } = await supabase.storage
        .from("Generations")
        .list("", {
          search: imageId,
        });
      
      if (listError) {
        console.warn("⚠️ Could not verify files exist:", listError);
      } else {
        console.log(`✅ Verified ${files?.length || 0} files with ID ${imageId}`);
      }
    } catch (verifyErr) {
      console.warn("⚠️ File verification error:", verifyErr);
    }
    
    // Delay to ensure Supabase storage URLs are accessible (CDN propagation)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Save metadata (optional - don't fail if table doesn't exist)
    try {
      await saveMetadata(imageId, {
        app: "human-portrait",
        style: style.name,
        location: location.name,
        numPeople,
        hasMale,
        hasFemale,
        personDescription: personDescription.substring(0, 500),
        hdUrl,
        previewUrl,
        createdAt: new Date().toISOString(),
      });
    } catch (metadataError) {
      console.warn("Failed to save metadata (table may not exist):", metadataError);
    }

    // Increment portrait count (optional)
    try {
      await incrementPortraitCount();
    } catch (countError) {
      console.warn("Failed to increment portrait count:", countError);
    }

    console.log("=== Human Portrait Generation Complete ===");
    console.log(`Image ID: ${imageId}`);

    return NextResponse.json({
      success: true,
      imageId,
      previewUrl,
      hdUrl,
      style: style.name,
      location: location.name,
    });

  } catch (error) {
    console.error("Human Portrait generation error:", error);
    
    if (error instanceof Error) {
      // Handle specific OpenAI errors
      if (error.message.includes("content_policy")) {
        return NextResponse.json(
          { error: "The image couldn't be processed. Please try a different photo." },
          { status: 400 }
        );
      }
      if (error.message.includes("rate_limit")) {
        return NextResponse.json(
          { error: "Service is busy. Please try again in a moment." },
          { status: 429 }
        );
      }
    }
    
    return NextResponse.json(
      { error: "Failed to generate portrait. Please try again." },
      { status: 500 }
    );
  }
}

export const maxDuration = 300; // 5 minutes for Vercel

