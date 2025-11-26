import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import sharp from "sharp";
import { v4 as uuidv4 } from "uuid";
import { CONFIG } from "@/lib/config";
import { uploadImage, saveMetadata } from "@/lib/supabase";

// Create watermarked version of image
async function createWatermarkedImage(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  // Create SVG watermark overlay
  const watermarkSvg = `
    <svg width="${width}" height="${height}">
      <defs>
        <pattern id="watermark" width="400" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="100" 
                font-family="Georgia, serif" 
                font-size="28" 
                font-weight="bold"
                fill="rgba(255,255,255,0.4)"
                text-anchor="start">
            PET RENAISSANCE – PREVIEW ONLY
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)"/>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.1)"/>
    </svg>
  `;

  return await sharp(inputBuffer)
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    // Check for Supabase config
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Storage not configured" },
        { status: 500 }
      );
    }

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Parse form data
    const formData = await request.formData();
    const imageFile = formData.get("image") as File | null;

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
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Generate unique ID for this generation
    const imageId = uuidv4();

    // Process original image for vision API
    const processedImage = await sharp(buffer)
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64Image = processedImage.toString("base64");

    // Step 1: Use GPT-4o Vision to analyze the pet with extreme detail for accuracy
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are an expert pet portrait artist. Analyze this pet photo with EXTREME PRECISION.

CRITICAL: Start your response with the EXACT species in caps, like this:
"[DOG] This is a..." or "[CAT] This is a..." or "[RABBIT] This is a..."

Then describe in meticulous detail:

1. SPECIES & BREED: Exact animal type (DOG, CAT, RABBIT, etc.) and specific breed. Be very precise.

2. COAT COLOR - BE EXTREMELY PRECISE:
   - If the fur is BLACK, say "JET BLACK" or "SOLID BLACK" - do NOT say dark gray or charcoal
   - If the fur is WHITE, say "PURE WHITE" 
   - For other colors, be specific: "golden blonde", "chocolate brown", "ginger orange"
   - Note any patterns: tabby stripes, spots, patches, etc.

3. FACE: Head shape, muzzle length, nose color, ear shape (pointed/floppy/folded)

4. EYES: Exact color (green, amber, blue, brown), shape, expression

5. DISTINCTIVE MARKINGS: Any unique features - white patches, facial markings, etc.

6. FUR TEXTURE: Short, medium, long, fluffy, sleek, wiry

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
"[SPECIES] This is a [breed] with [exact coat color] fur..."

The description must be accurate enough that the owner instantly recognizes their specific pet.`,
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
      max_tokens: 600,
    });

    const petDescription = visionResponse.choices[0]?.message?.content || "a beloved pet";

    // Log for debugging
    console.log("Pet description from vision:", petDescription);

    // Extract species from the description (format: [DOG], [CAT], etc.)
    const speciesMatch = petDescription.match(/\[(DOG|CAT|RABBIT|BIRD|HAMSTER|GUINEA PIG|FERRET|HORSE|PET)\]/i);
    let species = speciesMatch ? speciesMatch[1].toUpperCase() : "";
    
    // Fallback: search for species keywords if bracket format wasn't found
    if (!species) {
      const lowerDesc = petDescription.toLowerCase();
      if (lowerDesc.includes("dog") || lowerDesc.includes("puppy") || lowerDesc.includes("canine")) {
        species = "DOG";
      } else if (lowerDesc.includes("cat") || lowerDesc.includes("kitten") || lowerDesc.includes("feline")) {
        species = "CAT";
      } else if (lowerDesc.includes("rabbit") || lowerDesc.includes("bunny")) {
        species = "RABBIT";
      } else if (lowerDesc.includes("bird") || lowerDesc.includes("parrot") || lowerDesc.includes("parakeet")) {
        species = "BIRD";
      } else if (lowerDesc.includes("hamster") || lowerDesc.includes("guinea pig") || lowerDesc.includes("ferret")) {
        species = "SMALL PET";
      } else {
        species = "PET";
      }
    }
    
    // Create negative species instruction
    const notSpecies = species === "DOG" ? "DO NOT generate a cat or any feline." 
                     : species === "CAT" ? "DO NOT generate a dog or any canine."
                     : `DO NOT generate any animal other than a ${species}.`;
    
    console.log("Detected species:", species);

    // Randomize elements for unique paintings
    const cushions = [
      "BRIGHT EMERALD GREEN plush velvet cushion with luxurious deep pile, gold floral embroidery, and silk tassels",
      "VIVID RUBY RED thick velvet cushion with sumptuous velvety texture, silver damask pattern, and braided trim",
      "BRILLIANT ROYAL BLUE rich velvet cushion with lustrous sheen, gold leaf scrollwork, and pearl beading",
      "DEEP AMETHYST PURPLE plush velvet cushion with luxurious nap, gold heraldic embroidery, and silk fringe",
      "BRIGHT SCARLET crushed velvet cushion with rich texture, intricate gold brocade, and corner rosettes",
      "VIVID TEAL GREEN thick pile velvet ottoman with deep luxurious texture and antique gold filigree trim",
      "RICH SAPPHIRE BLUE plush velvet cushion with velvety sheen, silver arabesques, and gold tassels",
      "DEEP MAGENTA velvet cushion with sumptuous pile, gold crest embroidery, and silk piping"
    ];
    
    const robes = [
      "magnificent BRIGHT CRIMSON RED thick plush velvet royal robe with deep luxurious pile, white ermine fur collar, and gold clasps",
      "opulent VIBRANT ROYAL PURPLE rich velvet coronation cape with sumptuous velvety texture, pristine ermine trim, and pearl buttons",
      "regal VIVID SAPPHIRE BLUE deep-pile velvet emperor's mantle with lustrous sheen, silver fox fur lining, and diamond epaulettes",
      "sumptuous RICH SCARLET RED crushed velvet king's coat with plush texture, gold thread embroidery, and ermine cuffs",
      "majestic BRIGHT EMERALD GREEN thick velvet monarch's cloak with luxurious nap, sable fur trim, and jeweled brooch",
      "lavish DEEP MAGENTA plush velvet ceremonial robe with rich velvety sheen, ermine collar, and trailing cape",
      "stately VIVID VIOLET thick pile velvet duchess cape with sumptuous texture, chinchilla fur trim, and ruby clasp",
      "resplendent BRIGHT COBALT BLUE luxurious velvet imperial robe with deep lustrous pile, ermine lapels, and gold insignia"
    ];
    
    const jewelry = [
      "magnificent heavy gold chain of office with enormous ruby-studded royal medallion and hanging pearls",
      "stunning triple-strand pearl necklace with large pear-shaped emerald pendant surrounded by diamonds",
      "ornate gold ceremonial collar with brilliant sapphire centerpiece and cascading diamond drops",
      "exquisite platinum and diamond crown necklace with teardrop sapphire and filigree detailing",
      "opulent gold rope chain with carved imperial jade medallion encircled by rubies",
      "breathtaking jeweled gold torque with amethyst clusters and pearl accents fit for royalty",
      "elegant multi-strand pearl and gold choker with antique cameo pendant framed in diamonds",
      "regal layered gold chains bearing the royal family crest medallion with gemstone inlays"
    ];
    
    const backgrounds = [
      "grand palace throne room with soft gray marble walls, dusty blue velvet drapes, and towering white Corinthian columns",
      "elegant royal chamber with cream silk wallcovering, sage damask curtains, ornate gilded mirror, and crystal sconces",
      "majestic palace gallery with pale stone walls, flowing ivory silk drapes, classical Greek sculpture, and parquet floors",
      "stately drawing room with soft blue-gray paneled walls, white silk curtains, fine porcelain collection, and gold leaf moldings",
      "refined aristocratic library with light taupe walls, cool gray velvet drapery, leather-bound books, and brass telescope",
      "opulent palace salon with silver-gray walls, pale blue silk accents, magnificent crystal chandelier, and French windows",
      "grand ballroom corner with creamy ivory walls, muted teal velvet curtains, enormous gilded frame, and marble fireplace",
      "regal portrait gallery with cool neutral walls, blush pink silk drapery, classical marble busts, and heraldic tapestry"
    ];
    
    const lightingDirections = [
      "bright natural daylight from upper left, creating soft shadows",
      "clean diffused light from the left, with gentle fill light",
      "bright studio lighting from above and left, evenly illuminated",
      "soft natural window light from the left, bright and airy"
    ];

    // Pick random elements
    const cushion = cushions[Math.floor(Math.random() * cushions.length)];
    const robe = robes[Math.floor(Math.random() * robes.length)];
    const jewelryItem = jewelry[Math.floor(Math.random() * jewelry.length)];
    const background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
    const lighting = lightingDirections[Math.floor(Math.random() * lightingDirections.length)];

    // Step 2: Generate Renaissance royal portrait with DALL-E
    const generationPrompt = `!!!!! CRITICAL - THIS IS A ${species} !!!!!
Generate a portrait of a ${species}. ${notSpecies}

===== SPECIES VERIFICATION =====
Animal type: ${species}
${notSpecies}
The subject is a ${species}. Only generate a ${species}.

===== THE SUBJECT (${species}) =====
${petDescription}

===== REQUIREMENTS =====
1. SPECIES: This is a ${species}. Generate ONLY a ${species}. ${notSpecies}
2. COLOR ACCURACY: 
   - If described as BLACK fur, paint it TRUE BLACK/JET BLACK (not gray, not dark brown)
   - If described as WHITE fur, paint it PURE WHITE
   - Match the EXACT colors described above
3. The ${species} must be recognizable as the specific animal described

===== COMPOSITION (WIDE SHOT - PULL BACK) =====
- Frame from a DISTANCE showing the ${species}'s FULL BODY with generous space around
- The ${species} should occupy only 40-50% of the frame height
- Show LOTS of background and environment around the subject
- Include the complete cushion, visible floor, and architectural elements
- The scene should feel like a full room portrait, not a close-up

===== UNIQUE ELEMENTS FOR THIS PAINTING =====
- CUSHION: ${cushion}
- ATTIRE: ${robe}
- JEWELRY: ${jewelryItem}
- SETTING: ${background}

===== LIGHTING & COLOR (BRIGHT, NEUTRAL, HIGH WHITE BALANCE) =====
- ${lighting}
- HIGH WHITE BALANCE - NO orange cast, NO sepia tones, NO yellowed colors
- Clean, bright color palette with TRUE-TO-LIFE colors
- Soft shadows, well-illuminated scene - the ${species}'s features clearly visible
- Cool to neutral color temperature - like a professional photograph
- AVOID: warm/orange tint, grungy look, muddy colors, aged appearance

===== ARTISTIC STYLE (MAJESTIC & BEAUTIFUL) =====
- Breathtaking museum-quality oil painting with masterful brushwork and rich canvas texture
- Grand royal portraiture style inspired by court painters like Van Dyck and Velázquez
- The ${species} should look MAJESTIC, REGAL, and NOBLE - like true royalty
- Proud, dignified posture with head held high, exuding confidence and grace

VELVET & COLOR EMPHASIS:
- Render velvet fabric with RICH, LUXURIOUS, PLUSH texture - show the deep pile and lustrous sheen
- Colors should be BRIGHT, VIBRANT, and SATURATED - not muted or dull
- Reds should be VIVID CRIMSON/SCARLET, blues should be BRILLIANT SAPPHIRE/COBALT, purples should be RICH VIOLET/MAGENTA
- Show how light plays across the velvet surface - highlighting the nap and creating depth
- Jewels and gold should SPARKLE and GLEAM with lifelike brilliance
- Overall feeling: magnificent, stately, elegant, fit for a palace
- This is a BEAUTIFUL portrait worthy of hanging in a royal gallery

!!!!! FINAL CHECK: This portrait MUST show a ${species}. ${notSpecies} !!!!!`;

    const imageResponse = await openai.images.generate({
      model: "gpt-image-1",
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

    // Handle both base64 and URL responses
    if (imageData.b64_json) {
      // gpt-image-1 returns base64
      generatedBuffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      // DALL-E 3 returns URL
      const downloadResponse = await fetch(imageData.url);
      const arrayBuffer = await downloadResponse.arrayBuffer();
      generatedBuffer = Buffer.from(arrayBuffer);
    } else {
      throw new Error("Invalid image response format");
    }

    // Create watermarked preview
    const watermarkedBuffer = await createWatermarkedImage(generatedBuffer);

    // Upload HD image to Supabase Storage
    const hdUrl = await uploadImage(
      generatedBuffer,
      `${imageId}-hd.png`,
      "image/png"
    );

    // Upload watermarked preview to Supabase Storage
    const previewUrl = await uploadImage(
      watermarkedBuffer,
      `${imageId}-preview.png`,
      "image/png"
    );

    // Save metadata to Supabase database
    await saveMetadata(imageId, {
      created_at: new Date().toISOString(),
      paid: false,
      pet_description: petDescription,
      hd_url: hdUrl,
      preview_url: previewUrl,
    });

    // TODO: Change back to previewUrl for production (watermarked version)
    return NextResponse.json({
      imageId,
      previewUrl: hdUrl, // Using HD URL for testing - no watermark
    });
  } catch (error) {
    console.error("Generation error:", error);

    // Get detailed error message
    let errorMessage = "Failed to generate portrait. Please try again.";
    let statusCode = 500;

    if (error instanceof OpenAI.APIError) {
      console.error("OpenAI API Error:", error.message, error.status, error.code);
      
      if (error.status === 401) {
        errorMessage = "Invalid API key. Please check your configuration.";
      } else if (error.status === 429) {
        errorMessage = "Too many requests. Please try again in a moment.";
        statusCode = 429;
      } else if (error.status === 400) {
        errorMessage = `Invalid request: ${error.message}`;
        statusCode = 400;
      } else if (error.message.includes("content_policy")) {
        errorMessage = "Image couldn't be generated due to content policy. Please try a different photo.";
        statusCode = 400;
      } else {
        errorMessage = `OpenAI Error: ${error.message}`;
      }
    } else if (error instanceof Error) {
      errorMessage = `Error: ${error.message}`;
      console.error("Error details:", error.stack);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
