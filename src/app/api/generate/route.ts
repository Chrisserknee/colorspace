import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import Replicate from "replicate";
import sharp from "sharp";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
// Note: Video creation will use frame-based approach with FFmpeg
import { CONFIG } from "@/lib/config";
import { uploadImage, saveMetadata, incrementPortraitCount, uploadBeforeAfterImage } from "@/lib/supabase";
import { checkRateLimit, getClientIP, RATE_LIMITS } from "@/lib/rate-limit";
import { validateImageMagicBytes } from "@/lib/validation";

// Analyze image to detect if pet is black/dark-colored
async function analyzeImageDarkness(imageBuffer: Buffer): Promise<{ isDark: boolean; averageBrightness: number }> {
  try {
    // Resize to smaller size for faster analysis
    const resized = await sharp(imageBuffer)
      .resize(200, 200, { fit: 'inside' })
      .greyscale()
      .raw()
      .toBuffer();
    
    // Calculate average brightness (0-255, where 0 is black, 255 is white)
    let totalBrightness = 0;
    for (let i = 0; i < resized.length; i++) {
      totalBrightness += resized[i];
    }
    const averageBrightness = totalBrightness / resized.length;
    
    // Consider dark if average brightness is below 80 (out of 255)
    // This threshold catches black/dark brown pets but not medium-colored ones
    const isDark = averageBrightness < 80;
    
    console.log(`🔍 Image darkness analysis: average brightness = ${averageBrightness.toFixed(1)}/255, isDark = ${isDark}`);
    
    return { isDark, averageBrightness };
  } catch (error) {
    console.warn("Failed to analyze image darkness:", error);
    return { isDark: false, averageBrightness: 128 }; // Default to medium brightness
  }
}

// Portrait style palettes - each creates a unique mood
// ALL BACKGROUNDS ARE WHITE/LIGHT WHITE - NO GREEN, NO MUDDY COLORS
const PORTRAIT_PALETTES = [
  // WHITE & LIGHT WHITE VARIATIONS
  {
    name: "PURE WHITE",
    background: "pure bright white, clean and luminous",
    mood: "clean, bright, elegant",
    cloakColor: "dusty rose velvet with subtle gold thread",
    cushionColor: "soft pastel pink with delicate gold embroidery",
    lighting: "bright diffused natural light, clean and luminous"
  },
  {
    name: "WARM WHITE",
    background: "warm white with subtle cream undertones, bright and airy",
    mood: "warm, gentle, serene",
    cloakColor: "pale lilac velvet with silver accents",
    cushionColor: "soft pastel lavender with pearl details",
    lighting: "warm bright daylight, gentle and inviting"
  },
  {
    name: "COOL WHITE",
    background: "cool white with subtle blue-grey undertones, crisp and clean",
    mood: "calm, fresh, tranquil",
    cloakColor: "pale blue velvet with silver trim",
    cushionColor: "soft pastel pink with silver embroidery",
    lighting: "cool bright natural light, crisp and clear"
  },
  {
    name: "IVORY WHITE",
    background: "ivory white with gentle warm undertones, soft and elegant",
    mood: "serene, airy, calm",
    cloakColor: "pale sky blue velvet with silver clasp",
    cushionColor: "soft pastel blue with lavender accents",
    lighting: "soft bright daylight, gentle and clear"
  },
  {
    name: "PEARL WHITE",
    background: "pearl white with subtle pink-grey undertones, luminous",
    mood: "classic, timeless, elegant",
    cloakColor: "rich burgundy velvet with gold details",
    cushionColor: "soft pastel cream with gold tassels",
    lighting: "bright golden afternoon light"
  },
  {
    name: "SNOW WHITE",
    background: "snow white, pure and bright, no undertones",
    mood: "refined, sophisticated, calm",
    cloakColor: "pale blue velvet with silver embroidery",
    cushionColor: "soft pastel lavender with silver accents",
    lighting: "balanced bright light"
  },
  {
    name: "CREAM WHITE",
    background: "cream white with subtle warm undertones, soft and inviting",
    mood: "vintage, romantic, soft",
    cloakColor: "soft mauve velvet with pearl details",
    cushionColor: "soft pastel pink with gold thread",
    lighting: "warm bright candlelight glow"
  },
  {
    name: "LIGHT GREY WHITE",
    background: "very light grey-white, neutral and elegant",
    mood: "modern, clean, refined",
    cloakColor: "charcoal velvet with silver clasp",
    cushionColor: "soft pastel lavender with silver embroidery",
    lighting: "bright diffused studio light"
  },
  {
    name: "OFF WHITE",
    background: "off-white with subtle warm undertones, bright and clean",
    mood: "warm, gentle, inviting",
    cloakColor: "dusty rose velvet with gold clasp",
    cushionColor: "soft pastel pink with gold accents",
    lighting: "warm bright light"
  },
  {
    name: "BRIGHT WHITE",
    background: "bright white, pure and luminous, maximum brightness",
    mood: "clean, bright, cheerful",
    cloakColor: "pale blue velvet with silver details",
    cushionColor: "soft pastel blue with silver embroidery",
    lighting: "very bright natural light, maximum luminosity"
  },
  {
    name: "SOFT WHITE",
    background: "soft white with minimal warm undertones, gentle and bright",
    mood: "soft, gentle, peaceful",
    cloakColor: "deep purple velvet with gold trim",
    cushionColor: "soft pastel lavender with gold tassels",
    lighting: "soft bright light"
  },
  {
    name: "PRISTINE WHITE",
    background: "pristine white, absolutely pure and clean, no color cast",
    mood: "classic, timeless, distinguished",
    cloakColor: "deep grey velvet with silver clasp",
    cushionColor: "soft pastel lavender with silver details",
    lighting: "bright clean light, classic portrait style"
  }
];

// Helper to get a random palette
function getRandomPalette(): typeof PORTRAIT_PALETTES[0] {
  return PORTRAIT_PALETTES[Math.floor(Math.random() * PORTRAIT_PALETTES.length)];
}

// Legacy function for backwards compatibility
function getRandomBackgroundColor(): string {
  return getRandomPalette().background;
}

// Natural relaxed pet poses - LYING DOWN focused for variety and authenticity
const NATURAL_PET_POSES = [
  // LYING DOWN poses - these should be the most common
  {
    name: "PEACEFUL SPRAWL",
    description: "Pet lying flat on stomach, front legs extended forward, back legs relaxed behind or to side. Head may rest on paws or be lifted slightly. Completely relaxed full-body sprawl on cushion.",
    bodyPosition: "lying flat on stomach, FULL BODY visible sprawled on cushion",
    headPosition: "resting on front paws OR lifted slightly looking at viewer",
    pawPosition: "front legs stretched forward, back legs visible behind - ALL FOUR LEGS SHOWING",
    expression: "peaceful, content, relaxed"
  },
  {
    name: "SIDE LOUNGE",
    description: "Pet lying on their side, body curved naturally, all four legs visible and relaxed. Head turned toward viewer. Like a pet napping in a sunbeam.",
    bodyPosition: "lying on side, FULL BODY visible, natural curve to body",
    headPosition: "resting on cushion or lifted slightly toward viewer",
    pawPosition: "ALL FOUR LEGS visible - front paws together, back legs relaxed",
    expression: "drowsy, warm, content"
  },
  {
    name: "SPHINX POSE",
    description: "Classic sphinx position - lying down with chest on cushion, front paws extended forward parallel, head held up with dignity. Back legs tucked beside body.",
    bodyPosition: "lying in sphinx pose, chest down, FULL BODY visible on cushion",
    headPosition: "held up regally but relaxed",
    pawPosition: "front paws extended forward parallel, back legs visible tucked at sides",
    expression: "noble, calm, observant"
  },
  {
    name: "COZY CURL",
    description: "Pet curled into a comfortable ball shape, body forming C-curve, paws tucked in, tail may wrap around. Viewed from slight angle to show full body.",
    bodyPosition: "curled comfortably, FULL BODY in rounded shape on cushion",
    headPosition: "resting on paws or cushion, turned toward viewer",
    pawPosition: "front paws tucked under or beside chin, back legs curled",
    expression: "cozy, sleepy, utterly content"
  },
  {
    name: "RELAXED RECLINE",
    description: "Pet lying back against cushion at an angle, front legs extended, back legs visible to the side. Body at slight diagonal showing full length.",
    bodyPosition: "reclined against cushion, FULL BODY LENGTH visible at slight angle",
    headPosition: "resting back against cushion, looking at viewer",
    pawPosition: "front legs extended casually, back legs visible to side",
    expression: "relaxed, confident, at ease"
  },
  {
    name: "LAZY STRETCH",
    description: "Pet mid-stretch or just finishing a stretch, body long and extended, front paws reaching forward, back legs stretched behind. Maximum body length visible.",
    bodyPosition: "stretched out long, MAXIMUM BODY LENGTH visible on cushion",
    headPosition: "low, between front paws or resting on them",
    pawPosition: "front paws stretched FAR forward, back legs extended behind",
    expression: "blissful, relaxed, comfortable"
  },
  {
    name: "DROWSY SETTLE",
    description: "Pet settled into cushion as if about to fall asleep, body weight sunk down, eyes half-closed or soft. Full body visible, all muscles relaxed.",
    bodyPosition: "sunk into cushion, FULL BODY relaxed and visible",
    headPosition: "lowered, resting comfortably, may be tilted",
    pawPosition: "all paws relaxed and visible in natural positions",
    expression: "drowsy, heavy-lidded, peaceful"
  },
  {
    name: "REGAL REST",
    description: "Pet lying down in dignified pose, head held up with quiet nobility, body stretched elegantly on cushion. All four legs arranged gracefully.",
    bodyPosition: "lying down elegantly, FULL BODY displayed on cushion",
    headPosition: "held up with natural dignity, not stiff",
    pawPosition: "front legs together extended forward, back legs visible to side",
    expression: "dignified, serene, peacefully noble"
  },
  {
    name: "ELEGANT REACH",
    description: "Pet lying down with one front paw extended forward elegantly, body slightly turned, showing graceful extension. Like reaching for something with refined poise.",
    bodyPosition: "lying down with body slightly angled, FULL BODY visible",
    headPosition: "turned toward extended paw or viewer, elegant angle",
    pawPosition: "one front paw extended forward gracefully, other front paw relaxed, back legs visible",
    expression: "curious, elegant, poised"
  },
  {
    name: "NOBLE PROFILE",
    description: "Pet lying on side in profile view, head turned to show elegant profile line, body curved gracefully. Classic portrait angle showing regal silhouette.",
    bodyPosition: "lying on side in profile, FULL BODY visible in elegant curve",
    headPosition: "turned to show profile, elegant neck line visible",
    pawPosition: "all four legs visible in profile, arranged gracefully",
    expression: "noble, contemplative, serene"
  },
  {
    name: "PLAYFUL PAW TUCK",
    description: "Pet lying down with front paws tucked under chest, head resting on paws, back legs relaxed. Cozy, comfortable, inviting pose.",
    bodyPosition: "lying down comfortably, FULL BODY visible",
    headPosition: "resting on tucked front paws, looking at viewer",
    pawPosition: "front paws tucked under chest, back legs relaxed and visible",
    expression: "cozy, content, inviting"
  },
  {
    name: "DRAMATIC STRETCH",
    description: "Pet in full body stretch, front legs reaching far forward, back legs extended behind, body elongated. Maximum length and grace visible.",
    bodyPosition: "fully stretched out, MAXIMUM BODY LENGTH visible",
    headPosition: "low, between or on front paws",
    pawPosition: "front paws reaching FAR forward, back legs stretched FAR behind",
    expression: "blissful, relaxed, satisfied"
  },
  {
    name: "ROYAL RECLINE",
    description: "Pet reclining back against cushion at elegant angle, front legs extended forward, back legs relaxed. Like a royal lounging on a throne.",
    bodyPosition: "reclined back elegantly, FULL BODY visible at angle",
    headPosition: "held up regally, looking at viewer with dignity",
    pawPosition: "front legs extended forward elegantly, back legs relaxed to side",
    expression: "regal, confident, majestic"
  },
  {
    name: "CONTEMPLATIVE CURL",
    description: "Pet curled in tight ball, head resting on side, all paws tucked in. Viewed from angle to show full rounded form. Peaceful, introspective.",
    bodyPosition: "curled in tight ball, FULL ROUNDED BODY visible",
    headPosition: "resting on side, turned toward viewer",
    pawPosition: "all paws tucked in, creating rounded shape",
    expression: "contemplative, peaceful, introspective"
  },
  {
    name: "GRACEFUL EXTENSION",
    description: "Pet lying down with body extended, one front leg stretched forward, other relaxed, back legs visible. Showing elegant length and grace.",
    bodyPosition: "extended elegantly, FULL BODY LENGTH visible",
    headPosition: "held up gracefully, looking forward or at viewer",
    pawPosition: "one front leg extended forward, other relaxed, back legs visible",
    expression: "graceful, elegant, refined"
  },
  {
    name: "SUNBATHING LOUNGE",
    description: "Pet lying flat on back or side, completely relaxed, all four legs visible and relaxed. Like basking in warm sunlight, utterly at ease.",
    bodyPosition: "lying flat, FULL BODY visible and relaxed",
    headPosition: "resting comfortably, may be tilted back or to side",
    pawPosition: "all four legs relaxed and visible in natural positions",
    expression: "blissful, sun-warmed, completely relaxed"
  },
  {
    name: "ALERT REST",
    description: "Pet lying down but alert, head up and attentive, body relaxed but ready. Showing both comfort and awareness.",
    bodyPosition: "lying down comfortably, FULL BODY visible",
    headPosition: "held up alertly, ears perked, looking at viewer",
    pawPosition: "front paws positioned ready, back legs relaxed",
    expression: "alert, attentive, but comfortable"
  },
  {
    name: "ELEGANT TWIST",
    description: "Pet lying down with body twisted slightly, showing elegant turn of the torso, head turned toward viewer. Dynamic but graceful pose.",
    bodyPosition: "lying down with elegant body twist, FULL BODY visible",
    headPosition: "turned toward viewer over shoulder",
    pawPosition: "front paws positioned naturally, back legs visible",
    expression: "elegant, dynamic, graceful"
  },
  {
    name: "PEACEFUL SETTLE",
    description: "Pet settling into cushion, body weight shifting down, all muscles relaxing. Captured moment of complete comfort and peace.",
    bodyPosition: "settling into cushion, FULL BODY visible sinking down",
    headPosition: "lowering comfortably, eyes soft",
    pawPosition: "all paws relaxing into natural positions",
    expression: "peaceful, settling, content"
  },
  {
    name: "REGAL SIDE VIEW",
    description: "Pet lying on side viewed from three-quarter angle, showing elegant body curve, head turned toward viewer. Classic portrait elegance.",
    bodyPosition: "lying on side at three-quarter angle, FULL BODY visible",
    headPosition: "turned toward viewer, elegant neck curve",
    pawPosition: "all four legs visible, arranged gracefully",
    expression: "regal, elegant, serene"
  },
  {
    name: "COMFORTABLE SPREAD",
    description: "Pet lying down with legs spread comfortably, taking up space, completely relaxed. Showing confidence and comfort in their space.",
    bodyPosition: "lying down spread out, FULL BODY visible taking space",
    headPosition: "resting comfortably, may be on side or lifted",
    pawPosition: "legs spread comfortably, all four visible",
    expression: "confident, comfortable, at home"
  },
  {
    name: "GRACEFUL ARCH",
    description: "Pet lying down with elegant arch to the back, head held high, showing graceful curve of spine. Like a dancer's elegant line.",
    bodyPosition: "lying down with elegant arch, FULL BODY showing graceful curve",
    headPosition: "held high with grace, elegant neck line",
    pawPosition: "front paws extended forward, back legs relaxed",
    expression: "graceful, elegant, refined"
  },
  {
    name: "COZY NEST",
    description: "Pet curled tightly into cushion, making themselves small and cozy, all paws tucked, tail wrapped. Maximum coziness and comfort.",
    bodyPosition: "curled tightly, FULL BODY in compact cozy shape",
    headPosition: "tucked into body or resting on paws",
    pawPosition: "all paws tucked in tightly, creating nest-like shape",
    expression: "cozy, nested, completely comfortable"
  },
  {
    name: "NOBLE EXTENSION",
    description: "Pet lying down with regal extension, front legs stretched forward elegantly, head held high. Showing both relaxation and dignity.",
    bodyPosition: "lying down with regal extension, FULL BODY visible",
    headPosition: "held high with nobility, looking forward",
    pawPosition: "front legs extended forward elegantly, back legs visible",
    expression: "noble, dignified, regal"
  },
  {
    name: "RELAXED SPRAWL",
    description: "Pet sprawled out completely relaxed, taking up maximum space, all limbs extended. Utterly comfortable and at ease.",
    bodyPosition: "sprawled out completely, MAXIMUM BODY SPREAD visible",
    headPosition: "resting comfortably, may be on side or back",
    pawPosition: "all limbs extended and relaxed, maximum sprawl",
    expression: "completely relaxed, blissful, carefree"
  },
  {
    name: "ELEGANT FOLD",
    description: "Pet lying down with elegant fold of body, front legs crossed or folded, back legs relaxed. Showing refined, composed posture.",
    bodyPosition: "lying down with elegant body fold, FULL BODY visible",
    headPosition: "held up elegantly, composed",
    pawPosition: "front legs elegantly folded or crossed, back legs relaxed",
    expression: "elegant, composed, refined"
  },
  {
    name: "PEACEFUL REPOSE",
    description: "Pet in complete repose, all tension released, body completely relaxed, eyes soft. The ultimate state of peace and comfort.",
    bodyPosition: "in complete repose, FULL BODY relaxed and visible",
    headPosition: "resting peacefully, soft and relaxed",
    pawPosition: "all paws in natural relaxed positions",
    expression: "peaceful, serene, in complete repose"
  }
];

// Helper to get a random natural pose
function getRandomNaturalPose(): typeof NATURAL_PET_POSES[0] {
  return NATURAL_PET_POSES[Math.floor(Math.random() * NATURAL_PET_POSES.length)];
}

// Large dog breeds that need zoomed-out composition to show full head and body
const LARGE_DOG_BREEDS = [
  // Giant breeds
  "great dane", "irish wolfhound", "scottish deerhound", "english mastiff", "mastiff",
  "neapolitan mastiff", "tibetan mastiff", "saint bernard", "st. bernard", "st bernard",
  "newfoundland", "leonberger", "great pyrenees", "pyrenean mountain", "bernese mountain",
  "greater swiss mountain", "anatolian shepherd", "kangal", "caucasian shepherd",
  "central asian shepherd", "spanish mastiff", "dogue de bordeaux", "cane corso",
  "boerboel", "tosa inu", "fila brasileiro", "black russian terrier", "komondor",
  // Large breeds
  "german shepherd", "golden retriever", "labrador", "lab retriever", "rottweiler",
  "doberman", "dobermann", "boxer", "husky", "siberian husky", "alaskan malamute",
  "akita", "belgian malinois", "belgian shepherd", "collie", "rough collie", "border collie",
  "german shorthaired pointer", "weimaraner", "vizsla", "rhodesian ridgeback",
  "bloodhound", "basset hound", "irish setter", "gordon setter", "english setter",
  "afghan hound", "borzoi", "saluki", "greyhound", "scottish greyhound",
  "standard poodle", "old english sheepdog", "briard", "bouvier des flandres",
  "giant schnauzer", "airedale terrier", "chesapeake bay retriever", "flat-coated retriever",
  "curly-coated retriever", "dutch shepherd", "samoyed", "chow chow",
  "american bulldog", "english bulldog", "bull mastiff", "bullmastiff",
  // Medium-large that often get cropped
  "australian shepherd", "aussie shepherd", "pit bull", "pitbull", "american pit bull",
  "staffordshire", "american staffordshire", "dalmatian", "springer spaniel",
  "english springer", "standard schnauzer", "bluetick coonhound", "redbone coonhound",
  "treeing walker", "plott hound"
];

// Horses and large animals that need even more zoomed out composition
const VERY_LARGE_ANIMALS = [
  "horse", "pony", "mare", "stallion", "foal", "colt", "filly", "gelding",
  "donkey", "mule", "burro", "miniature horse", "mini horse",
  "llama", "alpaca", "goat", "sheep", "pig", "potbelly", "pot belly",
  "cow", "calf", "bull", "steer"
];

// Helper to check if a breed/description indicates a large dog
function isLargeBreed(breed: string, petDescription: string): boolean {
  const breedLower = breed.toLowerCase();
  const descLower = petDescription.toLowerCase();
  
  return LARGE_DOG_BREEDS.some(largeBeed => 
    breedLower.includes(largeBeed) || descLower.includes(largeBeed)
  );
}

// Helper to check if animal is very large (horse, etc.)
function isVeryLargeAnimal(breed: string, petDescription: string): boolean {
  const breedLower = breed.toLowerCase();
  const descLower = petDescription.toLowerCase();
  
  return VERY_LARGE_ANIMALS.some(animal => 
    breedLower.includes(animal) || descLower.includes(animal)
  );
}

// Get composition instructions based on pet size
function getCompositionForSize(breed: string, petDescription: string, species: string): string {
  const isVeryLarge = isVeryLargeAnimal(breed, petDescription);
  const isLarge = species === "DOG" && isLargeBreed(breed, petDescription);
  
  if (isVeryLarge) {
    console.log("📐 Detected VERY LARGE animal - using MAXIMUM zoom out composition");
    return `COMPOSITION - MAXIMUM ZOOM OUT FOR VERY LARGE ANIMAL:
=== CRITICAL FRAMING REQUIREMENTS ===
- ZOOM WAY OUT - pet should occupy only 60% of frame height
- Subject positioned in LOWER THIRD of frame
- MINIMUM 20% empty space above the TOP OF EARS
- Show COMPLETE animal from ear tips to paws
- Camera FAR BACK - wide angle view
- Pet appears MUCH SMALLER in frame to fit entirely with room to spare

=== ABSOLUTELY FORBIDDEN ===
- DO NOT crop ANY part of the head
- DO NOT crop the ears - FULL EAR TIPS must be visible
- DO NOT position subject in upper half of frame
- DO NOT frame tightly - leave generous margins

=== REQUIRED SPACING ===
- Top of ears must have clear sky/background above them
- At least 15-20% of frame height as headroom above ears
- Cloak draped naturally with realistic fabric folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest`;
  } else if (isLarge) {
    console.log("📐 Detected LARGE DOG breed - using zoomed out composition");
    return `COMPOSITION - ZOOMED OUT FOR LARGE DOG BREED:
=== CRITICAL FRAMING REQUIREMENTS ===
- ZOOM OUT significantly - pet should occupy only 70% of frame height  
- Subject positioned in LOWER 40% of frame - NOT centered vertically
- MINIMUM 15% empty space above the TOP OF EARS
- The ENTIRE head including FULL EAR TIPS must be completely visible
- Camera positioned FURTHER BACK than normal portrait distance

=== ABSOLUTELY FORBIDDEN ===
- DO NOT crop the top of the head
- DO NOT crop the ears - even partially
- DO NOT let ears touch or go past the top edge
- DO NOT frame tightly around the head

=== REQUIRED SPACING ===
- Clear background visible ABOVE the ear tips
- Headroom of at least 10-15% of frame height above ears
- Include neck, chest, and shoulder area
- Cloak draped naturally with realistic fabric folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest`;
  }
  
  // Standard composition for smaller pets - ZOOMED OUT with headroom
  return `COMPOSITION:
=== CRITICAL FRAMING - ZOOMED OUT, NOT CLOSE-UP ===
- PULL BACK from subject - pet should occupy only 65-75% of frame height (NOT filling the frame)
- ALWAYS leave GENEROUS HEADROOM above the pet's ears - at least 15% of frame height
- The TOP OF EARS must NEVER touch or approach the top edge of the frame
- Position subject in LOWER 55% of the frame - NOT centered vertically
- FULL HEAD visible including COMPLETE EARS with AMPLE space above them
- Show HEAD, NECK, CHEST, and UPPER BODY - not just the face
- DO NOT crop ANY part of the head or ears - ever

=== POSITIONING ===
- Subject LOW and CENTRAL on ornate velvet throne cushion
- Camera positioned FURTHER BACK than typical portrait - show more of the pet
- NATURAL body position - comfortable, relaxed, at ease
- Front paws visible, positioned naturally on the cushion
- Cloak draped naturally with realistic fabric folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest SECURING THE CLOAK CLOSED - two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver finish, catches the light brilliantly
- Authentic, genuine expression
- WIDER FRAMING showing the pet in their full regal glory

=== ABSOLUTELY FORBIDDEN ===
- NEVER frame too tight or too close to the pet
- NEVER crop the top of the head
- NEVER crop ANY part of the ears
- NEVER let ears touch the top edge of frame
- NEVER center subject vertically - always leave headroom above
- NEVER make the pet fill the entire frame - leave breathing room`;
}

// Rainbow Bridge memorial quotes - randomly selected for each portrait
const RAINBOW_BRIDGE_QUOTES = [
  "Where there is love, there is never truly goodbye.",
  "Your pawprints may fade from the earth, but they shine forever at the Rainbow Bridge.",
  "Until we meet again at the Bridge, run free, sweet soul.",
  "The Rainbow Bridge is not the end—just a place where love waits.",
  "Every pet who crosses the Bridge carries a piece of our heart with them.",
  "What we shared cannot be lost; it just waits for us in the light.",
  "They walk beside us for a while, but stay in our hearts forever.",
  "Some angels have wings. Some have fur and wait for us at the Bridge.",
  "The hardest part of having a pet is saying goodbye. The most beautiful part is knowing love continues at the Bridge.",
  "One day, the love you shared will guide you back to each other at the Rainbow Bridge.",
];

// Add text overlay to rainbow bridge portrait (pet name and quote)
// Uses SVG compositing for serverless compatibility (sharp's text input requires libvips fonts)
async function addRainbowBridgeTextOverlay(
  imageBuffer: Buffer,
  petName: string
): Promise<{ buffer: Buffer; quote: string }> {
  console.log("🌈 Adding Rainbow Bridge text overlay for:", petName);
  console.log("   Input buffer size:", imageBuffer.length, "bytes");
  
  // Get random quote
  const quote = RAINBOW_BRIDGE_QUOTES[Math.floor(Math.random() * RAINBOW_BRIDGE_QUOTES.length)];
  console.log("   Selected quote:", quote);
  
  // Get image dimensions
  const metadata = await sharp(imageBuffer).metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;
  console.log(`   Image dimensions: ${width}x${height}`);
  
  try {
    const padding = Math.floor(width * 0.04);
    const nameFontSize = Math.floor(width * 0.055);
    const quoteFontSize = Math.floor(width * 0.024);
    
    // Word wrap the quote
    const maxQuoteWidth = width - padding * 8;
    const approxCharsPerLine = Math.floor(maxQuoteWidth / (quoteFontSize * 0.5));
    const words = quote.split(' ');
    const quoteLines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length > approxCharsPerLine && currentLine) {
        quoteLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) quoteLines.push(currentLine);
    
    // Calculate text positioning
    const lineHeight = quoteFontSize * 1.4;
    const totalQuoteHeight = quoteLines.length * lineHeight;
    const nameY = height - padding - nameFontSize;
    const quoteStartY = nameY - padding - totalQuoteHeight;
    
    // Gradient height to cover text area
    const gradientHeight = Math.floor(height * 0.28);
    
    // Escape special XML characters
    const escapeXml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
    
    // Create SVG with gradient, quote, and name
    // Use generic 'serif' font family for serverless compatibility (specific fonts like Georgia aren't available)
    const quoteLinesXml = quoteLines.map((line, i) => 
      `<text x="${width / 2}" y="${quoteStartY + i * lineHeight}" 
        font-family="DejaVu Serif, Liberation Serif, serif" 
        font-size="${quoteFontSize}" 
        font-style="italic"
        fill="rgba(255, 255, 255, 0.95)" 
        text-anchor="middle"
        filter="url(#shadow)">"${escapeXml(line)}"</text>`
    ).join('\n');
    
    const svgOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="fadeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:rgb(0,0,0);stop-opacity:0" />
            <stop offset="40%" style="stop-color:rgb(0,0,0);stop-opacity:0.4" />
            <stop offset="100%" style="stop-color:rgb(0,0,0);stop-opacity:0.7" />
          </linearGradient>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#D4AF37" />
            <stop offset="50%" style="stop-color:#F5E6A3" />
            <stop offset="100%" style="stop-color:#D4AF37" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.8)"/>
          </filter>
        </defs>
        
        <!-- Dark gradient at bottom for text readability -->
        <rect x="0" y="${height - gradientHeight}" width="${width}" height="${gradientHeight}" fill="url(#fadeGradient)"/>
        
        <!-- Quote text -->
        ${quoteLinesXml}
        
        <!-- Pet name in gold -->
        <text x="${width / 2}" y="${nameY}" 
          font-family="DejaVu Serif, Liberation Serif, serif" 
          font-size="${nameFontSize}" 
          font-weight="bold"
          fill="url(#goldGradient)" 
          text-anchor="middle"
          filter="url(#shadow)">${escapeXml(petName.toUpperCase())}</text>
      </svg>
    `;
    
    console.log("   Created SVG overlay, compositing...");
    
    // Composite SVG onto image
    const result = await sharp(imageBuffer)
      .composite([{
        input: Buffer.from(svgOverlay),
        top: 0,
        left: 0,
      }])
      .png({ quality: 100, compressionLevel: 6 })
      .toBuffer();
    
    console.log("   Result buffer size:", result.length, "bytes");
    console.log("✅ Rainbow Bridge text overlay added successfully (SVG method)");
    return { buffer: result, quote };
  } catch (textError) {
    console.error("❌ Text rendering failed:", textError);
    console.error("   Error details:", textError instanceof Error ? textError.message : String(textError));
    
    // Final fallback: return image without text overlay
    console.log("   Returning image without text overlay");
    return { buffer: imageBuffer, quote };
  }
}


// Generate image using OpenAI img2img (images.edit) for primary generation
// This uses OpenAI's image editing API to transform the pet photo into a late 18th-century aristocratic portrait
async function generateWithOpenAIImg2Img(
  imageBuffer: Buffer,
  prompt: string,
  openai: OpenAI
): Promise<Buffer> {
  console.log("=== OPENAI IMAGE-TO-IMAGE GENERATION ===");
  
  try {
    // Convert buffer to File for OpenAI API
    const uint8Array = new Uint8Array(imageBuffer);
    const imageBlob = new Blob([uint8Array], { type: "image/png" });
    const imageFile = new File([imageBlob], "pet-photo.png", { type: "image/png" });
    
    console.log("OpenAI img2img parameters:");
    console.log("- Model: gpt-image-1");
    console.log("- Prompt length:", prompt.length);
    console.log("- Image size:", imageBuffer.length, "bytes");
    
    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: prompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No image generated from OpenAI img2img");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
      console.log("✅ OpenAI img2img generation successful (base64), buffer size:", buffer.length);
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download OpenAI img2img image: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
      console.log("✅ OpenAI img2img generation successful (URL), buffer size:", buffer.length);
    } else {
      throw new Error("No image data in OpenAI img2img response");
    }
    
    return buffer;
  } catch (error) {
    console.error("OpenAI img2img generation error:", error);
    throw error;
  }
}


// Retry helper for Replicate API calls with exponential backoff for rate limits
async function retryReplicateCall<T>(
  callFn: () => Promise<T>,
  maxRetries: number = 5, // Increased retries for rate limits
  baseDelay: number = 5000 // Increased base delay to 5 seconds
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callFn();
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message || String(error);
      const errorStatus = error?.status || error?.statusCode;
      
      // Check if it's a rate limit error (429) or account balance warning
      const isRateLimit = errorStatus === 429 || 
                         errorMsg.includes('429') || 
                         errorMsg.includes('rate limit') || 
                         errorMsg.includes('throttled') ||
                         errorMsg.includes('Rate limit') ||
                         errorMsg.includes('too many requests');
      
      if (isRateLimit && attempt < maxRetries) {
        // Extract retry_after from error if available
        let retryAfter = baseDelay;
        try {
          // Try to extract from error message first (Replicate includes it in the detail)
          const errorMsgStr = String(error?.message || error);
          const retryMatch = errorMsgStr.match(/resets in ~(\d+)s/i) || 
                           errorMsgStr.match(/retry_after[":\s]+(\d+)/i) ||
                           errorMsgStr.match(/wait (\d+) seconds/i) ||
                           errorMsgStr.match(/(\d+)s/i);
          if (retryMatch && retryMatch[1]) {
            retryAfter = Math.max(parseInt(retryMatch[1]) * 1000, baseDelay);
          }
          
          // Also try to get from response if available
          if (error && typeof error === 'object' && 'response' in error) {
            const response = (error as any).response;
            if (response) {
              const errorData = await response.json().catch(() => ({}));
              if (errorData.retry_after) {
                retryAfter = Math.max(errorData.retry_after * 1000, baseDelay);
              }
            }
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
        
        // Exponential backoff with longer delays for rate limits
        // Use retry_after if available, otherwise exponential with longer base
        const delay = retryAfter > baseDelay ? retryAfter : baseDelay * Math.pow(2, attempt - 1);
        const delaySeconds = Math.ceil(delay / 1000);
        console.log(`⏳ Rate limit hit (attempt ${attempt}/${maxRetries}). Waiting ${delaySeconds}s before retry...`);
        console.log(`💡 Tip: Replicate applies stricter rate limits when balance is ≤$20. Consider adding more credits.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If not a rate limit error or out of retries, throw immediately
      throw error;
    }
  }
  
  throw lastError || new Error("Replicate API call failed after retries");
}

// Local SD API generation (Automatic1111 or ComfyUI)
async function generateWithLocalSDAPI(
  referenceImageBase64: string,
  prompt: string,
  model: string,
  apiUrl: string
): Promise<Buffer> {
  console.log("🏠 Generating with LOCAL SD API...");
  
  // Get parameters from environment
  const sdGuidanceScale = parseFloat(process.env.SD_GUIDANCE_SCALE || "7.5");
  const sdSteps = parseInt(process.env.SD_STEPS || "35");
  const sdStrength = parseFloat(process.env.SD_STRENGTH || "0.6");
  const ipAdapterScale = parseFloat(process.env.IP_ADAPTER_SCALE || "0.85");
  
  // Convert base64 to Buffer
  const imageBuffer = Buffer.from(
    referenceImageBase64.replace(/^data:image\/\w+;base64,/, ""),
    "base64"
  );
  
  // Detect API type (Automatic1111 or ComfyUI)
  const apiType = process.env.LOCAL_SD_API_TYPE || "automatic1111"; // "automatic1111" or "comfyui"
  
  try {
    if (apiType === "comfyui") {
      // ComfyUI API format
      console.log("🎨 Using ComfyUI API format...");
      
      // ComfyUI requires a workflow JSON - simplified version for IP-Adapter Plus
      const workflow = {
        "1": {
          "inputs": {
            "image": imageBuffer.toString("base64"),
            "text": prompt,
            "clip": ["CLIPTextEncode", 1, 0]
          },
          "class_type": "IPAdapterPlus"
        }
      };
      
      // Note: ComfyUI API is more complex - you may need to customize this based on your workflow
      const response = await fetch(`${apiUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: workflow }),
      });
      
      if (!response.ok) {
        throw new Error(`ComfyUI API error: ${response.status}`);
      }
      
      const data = await response.json();
      // ComfyUI returns a prompt_id - you'd need to poll for completion
      // This is a simplified version - you may need to implement polling
      throw new Error("ComfyUI API requires polling - use Automatic1111 format or implement polling");
      
    } else {
      // Automatic1111 (Stable Diffusion WebUI) API format
      console.log("🎨 Using Automatic1111 API format...");
      
      // Convert image to base64 data URL
      const imageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString("base64")}`;
      
      // Automatic1111 img2img endpoint
      const requestBody: any = {
        prompt: prompt,
        negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, rigid posture, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
        init_images: [imageDataUrl],
        denoising_strength: sdStrength,
        cfg_scale: sdGuidanceScale,
        steps: sdSteps,
        width: 1024,
        height: 1024,
        sampler_index: "Euler a", // or "DPM++ 2M Karras" for better quality
        restore_faces: false,
        tiling: false,
      };
      
      // Add IP-Adapter if model supports it (requires ControlNet extension)
      if (model.includes("ip-adapter")) {
        requestBody.alwayson_scripts = {
          controlnet: {
            args: [{
              input_image: imageDataUrl,
              module: "ip-adapter_plus",
              model: "ip-adapter-plus_sdxl [2a9b6b7c]", // Adjust based on your installed models
              weight: ipAdapterScale,
              control_mode: 1, // Balanced
            }]
          }
        };
      }
      
      const response = await fetch(`${apiUrl}/sdapi/v1/img2img`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Automatic1111 API error (${response.status}): ${errorText.substring(0, 200)}`);
      }
      
      const data = await response.json();
      
      if (!data.images || !data.images[0]) {
        throw new Error("No image returned from Automatic1111 API");
      }
      
      // Decode base64 image
      const imageBase64 = data.images[0].replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(imageBase64, "base64");
      
      console.log("✅ Local SD API generation successful, buffer size:", buffer.length);
      return buffer;
    }
  } catch (error) {
    console.error("Local SD API generation error:", error);
    throw error;
  }
}

// ⚠️ STABLE DIFFUSION GENERATION - DEV SERVER ONLY - DO NOT DEPLOY TO PRODUCTION ⚠️
// This function uses advanced Stable Diffusion models with IP-Adapter Plus, ControlNet, and LoRA support
// Supports both Replicate (cloud) and local API endpoints
// Available models: "sdxl-ip-adapter-plus", "sdxl-controlnet-pose", "sdxl-controlnet-depth", "sdxl-controlnet-canny", "sdxl-lora", "flux", "sd3", "sdxl-img2img", "ip-adapter-faceid"
async function generateWithStableDiffusion(
  referenceImageBase64: string,
  prompt: string,
  model: string = "sdxl-ip-adapter-plus"
): Promise<Buffer> {
  console.log("=== ⚠️ STABLE DIFFUSION GENERATION (DEV SERVER ONLY) ===");
  console.log(`📌 Model: ${model}`);
  
  // Check if using local API endpoint
  const localApiUrl = process.env.LOCAL_SD_API_URL; // e.g., "http://localhost:7860" for Automatic1111 or "http://localhost:8188" for ComfyUI
  const useLocalApi = !!localApiUrl;
  
  if (useLocalApi) {
    console.log("🏠 Using LOCAL SD API:", localApiUrl);
    return generateWithLocalSDAPI(referenceImageBase64, prompt, model, localApiUrl);
  }
  
  // Use Replicate (cloud)
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured. Set LOCAL_SD_API_URL for local testing or REPLICATE_API_TOKEN for cloud.");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const imageDataUrl = referenceImageBase64.startsWith("data:") 
    ? referenceImageBase64 
    : `data:image/jpeg;base64,${referenceImageBase64}`;

  // Get SD-specific parameters from environment
  // Higher strength (0.75-0.85) needed for painterly transformation - lower values keep too much original photo
  const sdGuidanceScale = parseFloat(process.env.SD_GUIDANCE_SCALE || "7.5");
  const sdSteps = parseInt(process.env.SD_STEPS || "35");
  const sdStrength = parseFloat(process.env.SD_STRENGTH || "0.8");
  const ipAdapterScale = parseFloat(process.env.IP_ADAPTER_SCALE || "0.85"); // IP-Adapter Plus works best at 0.8-0.9
  const controlnetScale = parseFloat(process.env.CONTROLNET_SCALE || "0.8"); // ControlNet condition scale
  const loraUrl = process.env.LORA_URL; // Custom LoRA URL for style training
  
  // ControlNet type (pose, depth, canny)
  const controlnetType = process.env.CONTROLNET_TYPE || "canny";

  console.log("SD parameters:");
  console.log("- Guidance scale:", sdGuidanceScale);
  console.log("- Steps:", sdSteps);
  console.log("- Strength (img2img):", sdStrength);
  console.log("- IP-Adapter scale:", ipAdapterScale, "(higher = more identity preserved)");
  console.log("- ControlNet scale:", controlnetScale, "(higher = more structure preserved)");
  console.log("- ControlNet type:", controlnetType);
  console.log("- LoRA URL:", loraUrl || "none (using base SDXL)");
  console.log("- Prompt length:", prompt.length);

  try {
    let output: unknown;
    
    if (model === "flux") {
      // Flux - Most advanced, highest quality
      // Using flux-dev for better quality (flux-schnell is faster but lower quality)
      console.log("🚀 Using Flux Dev (black-forest-labs/flux-dev)...");
      
      // Flux doesn't support img2img directly, so we use the text-to-image with detailed description
      // For identity preservation, we'd need to use Flux with IP-Adapter or ControlNet
      // For now, using flux-dev-lora which can accept reference images
      output = await retryReplicateCall(() =>
        replicate.run(
          "black-forest-labs/flux-dev",
          {
            input: {
              prompt: prompt,
              guidance: sdGuidanceScale,
              num_inference_steps: sdSteps,
              output_format: "png",
              output_quality: 100,
              aspect_ratio: "1:1",
            }
          }
        )
      );
    } else if (model === "flux-img2img") {
      // Flux with img2img capability using a community model
      console.log("🚀 Using Flux img2img (lucataco/flux-dev-lora)...");
      
      // No fallback - fail clearly if it doesn't work
      output = await retryReplicateCall(() =>
        replicate.run(
          "lucataco/flux-dev-lora",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              strength: sdStrength,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
            }
          }
        )
      );
    } else if (model === "sd3") {
      // Stable Diffusion 3 - Latest SD model
      console.log("🚀 Using Stable Diffusion 3 (stability-ai/stable-diffusion-3)...");
      
      output = await retryReplicateCall(() =>
        replicate.run(
          "stability-ai/stable-diffusion-3",
          {
            input: {
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, rigid posture, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              cfg_scale: sdGuidanceScale,
              steps: sdSteps,
              output_format: "png",
              aspect_ratio: "1:1",
            }
          }
        )
      );
    } else if (model === "sdxl-img2img") {
      // SDXL with img2img for identity preservation
      console.log("🚀 Using SDXL img2img for identity preservation...");
      
      // No fallback - fail clearly if it doesn't work
      output = await retryReplicateCall(() =>
        replicate.run(
          "stability-ai/sdxl",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, rigid posture, oversaturated, harsh colors, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              prompt_strength: sdStrength,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
              refine: "expert_ensemble_refiner",
              high_noise_frac: 0.8,
              num_outputs: 1,
            }
          }
        )
      );
    } else if (model === "sdxl-controlnet") {
      // SDXL with ControlNet for better structure preservation
      console.log("🚀 Using SDXL ControlNet (canny) for structure preservation...");
      
      output = await retryReplicateCall(() =>
        replicate.run(
          "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd9751047043a5a8cf13ef1",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, oversaturated, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              condition_scale: 0.8, // How much to follow the structure
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
            }
          }
        )
      );
    } else if (model === "sdxl-ip-adapter-plus") {
      // IP-Adapter Plus - BEST for full body identity preservation (better than FaceID)
      // This preserves the entire pet's appearance, not just the face
      console.log("🚀 Using SDXL img2img (identity preservation via img2img)...");
      console.log("⚠️ Note: IP-Adapter models not available, using SDXL img2img instead");
      
      // Use SDXL img2img with specific version hash - works reliably and preserves identity
      // No fallbacks, fail clearly if it doesn't work
      output = await retryReplicateCall(() =>
        replicate.run(
          "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, rigid posture, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              prompt_strength: sdStrength,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
              refine: "expert_ensemble_refiner",
              high_noise_frac: 0.8,
              num_outputs: 1,
            }
          }
        )
      );
    } else if (model === "sdxl-controlnet-pose") {
      // SDXL with ControlNet Pose - locks in pet's pose/structure
      console.log("🚀 Using SDXL ControlNet (Pose) for pose preservation...");
      
      output = await retryReplicateCall(() =>
        replicate.run(
          "lucataco/sdxl-controlnet-pose",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              condition_scale: controlnetScale,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
            }
          }
        )
      );
    } else if (model === "sdxl-controlnet-depth") {
      // SDXL with ControlNet Depth - preserves 3D structure
      console.log("🚀 Using SDXL ControlNet (Depth) for structure preservation...");
      
      output = await retryReplicateCall(() =>
        replicate.run(
          "lucataco/sdxl-controlnet-depth",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              condition_scale: controlnetScale,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
            }
          }
        )
      );
    } else if (model === "sdxl-controlnet-canny") {
      // SDXL with ControlNet Canny - preserves edges/structure (existing, but updated)
      console.log("🚀 Using SDXL ControlNet (Canny) for edge/structure preservation...");
      
      output = await retryReplicateCall(() =>
        replicate.run(
          "lucataco/sdxl-controlnet:06d6fae3b75ab68a28cd2900afa6033166910dd09fd9751047043a5a8cf13ef1",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              condition_scale: controlnetScale,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
            }
          }
        )
      );
    } else if (model === "sdxl-lora") {
      // SDXL with custom LoRA for style training
      // Requires LORA_URL environment variable pointing to your trained LoRA
      console.log("🚀 Using SDXL + Custom LoRA for style matching...");
      
      if (!loraUrl) {
        throw new Error("LORA_URL environment variable is required for sdxl-lora model. Set LORA_URL to your trained LoRA URL.");
      }
      
      console.log("📌 Using LoRA:", loraUrl);
      
      // Use SDXL base with LoRA support
      // Note: Replicate LoRA support varies by model - may need to use a LoRA-enabled SDXL variant
      output = await retryReplicateCall(() =>
        replicate.run(
          "stability-ai/sdxl",
          {
            input: {
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated, ugly, blurry, human face, human body, humanoid, standing upright, bipedal, stiff pose, rigid posture, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
              scheduler: "K_EULER_ANCESTRAL",
              refine: "expert_ensemble_refiner",
              high_noise_frac: 0.8,
              num_outputs: 1,
              // Note: LoRA integration may require a different model endpoint that supports LoRA
              // You may need to use a community model like "lucataco/sdxl-lora" or similar
            }
          }
        )
      );
      
      console.log("⚠️ Note: Direct LoRA support in Replicate may require a specialized model. Consider using IP-Adapter Plus with your style images instead.");
    } else if (model === "ip-adapter-faceid") {
      // IP-Adapter FaceID for face preservation (works great for pet faces too)
      // Note: IP-Adapter Plus is generally better for full body, but FaceID is good for face-only focus
      console.log("🚀 Using IP-Adapter FaceID for face preservation...");
      
      // No fallback - fail clearly if it doesn't work
      output = await retryReplicateCall(() =>
        replicate.run(
          "lucataco/ip-adapter-faceid-sdxl",
          {
            input: {
              image: imageDataUrl,
              prompt: prompt,
              negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, mutated, ugly, blurry, human, standing upright, oversaturated, harsh colors, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting, hat, crown, headwear, floating objects, floating jewelry, floating brooch, decorative items above head, weird artifacts, strange objects, elaborate architecture, columns, staircases, complex backgrounds, excessive jewelry, multiple necklaces, heavy robes, elaborate costumes, human clothing",
              ip_adapter_scale: ipAdapterScale,
              num_inference_steps: sdSteps,
              guidance_scale: sdGuidanceScale,
            }
          }
        )
      );
    } else {
      throw new Error(`Unknown SD model: ${model}. Available models: sdxl-ip-adapter-plus (RECOMMENDED), sdxl-controlnet-pose, sdxl-controlnet-depth, sdxl-controlnet-canny, sdxl-lora, flux, flux-img2img, sd3, sdxl-img2img, ip-adapter-faceid`);
    }

    console.log("SD generation complete, output type:", typeof output);
    console.log("SD output value:", JSON.stringify(output, null, 2).substring(0, 500)); // Log first 500 chars

    // Handle various output formats from Replicate
    let buffer: Buffer = Buffer.alloc(0); // Initialize to empty buffer
    
    try {
      if (Array.isArray(output) && output.length > 0) {
        console.log("📦 Output is array, length:", output.length);
        const firstItem = output[0];
        console.log("📦 First item type:", typeof firstItem, "value:", firstItem);
        let imageUrl: string | undefined;
        
        if (typeof firstItem === 'string') {
          imageUrl = firstItem;
          console.log("✅ Got string URL from array");
        } else if ((firstItem as any) instanceof URL || (firstItem && (firstItem as any).href)) {
          // Array item is itself a URL object
          imageUrl = firstItem.href || firstItem.toString();
          if (imageUrl) {
            console.log("✅ Got URL object from array, converted to string:", imageUrl.substring(0, 80));
          }
        } else if (typeof firstItem === 'object' && firstItem !== null) {
          console.log("📦 First item is object");
          console.log("📦 Object keys:", Object.keys(firstItem));
          console.log("📦 Object values:", Object.values(firstItem));
          console.log("📦 Full object:", JSON.stringify(firstItem, null, 2).substring(0, 500));
          
          // Check if it's a URL object directly
          if ((firstItem as any).href || (firstItem as any) instanceof URL) {
            imageUrl = firstItem.href || firstItem.toString();
            if (imageUrl) {
              console.log("✅ Array item is URL object, converted:", imageUrl.substring(0, 80));
            }
          } else if ('url' in firstItem) {
            const urlValue = (firstItem as { url: string | (() => string | Promise<string> | any) }).url;
            console.log("📦 url property type:", typeof urlValue);
            
            if (typeof urlValue === 'function') {
              console.log("🔗 Calling url() function...");
              const urlResult = await urlValue();
              console.log("🔗 url() returned type:", typeof urlResult, "value:", typeof urlResult === 'string' ? urlResult.substring(0, 100) : urlResult);
              
              // Handle if url() returns a string, URL object, or other
              console.log("🔍 urlResult type check:", typeof urlResult, "has href:", !!(urlResult as any)?.href, "instanceof URL:", (urlResult as any) instanceof URL);
              
              if (typeof urlResult === 'string') {
                imageUrl = urlResult;
                console.log("✅ url() returned string");
              } else if (urlResult && ((urlResult as any).href || (urlResult as any) instanceof URL)) {
                // URL object - use .href property for the string URL (most reliable)
                imageUrl = urlResult.href || urlResult.toString();
                if (imageUrl) {
                  console.log("✅ url() returned URL object, converted to string:", imageUrl.substring(0, 80));
                }
              } else if (urlResult && typeof urlResult.toString === 'function') {
                const stringResult = urlResult.toString();
                // Check if toString() gives us a URL-like string
                if (stringResult.startsWith('http')) {
                  imageUrl = stringResult;
                  console.log("✅ url() returned object, toString() gave URL string:", stringResult.substring(0, 80));
                } else {
                  console.error("❌ toString() didn't give URL:", stringResult);
                  throw new Error(`url() returned object but toString() didn't give URL: ${stringResult}`);
                }
              } else {
                console.error("❌ url() returned unexpected type:", typeof urlResult, urlResult);
                throw new Error(`url() returned non-string type: ${typeof urlResult}. Value: ${JSON.stringify(urlResult)}`);
              }
            } else if (typeof urlValue === 'string') {
              imageUrl = urlValue;
              console.log("✅ Got string URL from object.url property");
            } else {
              throw new Error(`url property is not a string or function: ${typeof urlValue}`);
            }
          } else {
            // Maybe it's a FileOutput object - try to stringify it
            console.log("⚠️ Object doesn't have 'url' property, trying toString...");
            const stringified = String(firstItem);
            if (stringified.startsWith('http')) {
              imageUrl = stringified;
            } else {
              throw new Error(`Unexpected array item format. Object keys: ${Object.keys(firstItem).join(', ')}`);
            }
          }
        } else {
          throw new Error(`Unexpected array item type: ${typeof firstItem}`);
        }
        
        console.log("📥 Final imageUrl before conversion:", imageUrl, "type:", typeof imageUrl);
        
        // Final conversion check - handle URL objects that might have slipped through
        if (imageUrl && typeof imageUrl !== 'string') {
          const urlObj = imageUrl as any;
          if (urlObj instanceof URL || (urlObj && urlObj.href)) {
            console.log("🔄 Converting URL object to string...");
            imageUrl = urlObj.href || urlObj.toString();
          } else {
            throw new Error(`Invalid URL type: ${typeof imageUrl}. Value: ${imageUrl}`);
          }
        }
        
        console.log("📥 Final imageUrl after conversion:", imageUrl, "type:", typeof imageUrl);
        if (!imageUrl || typeof imageUrl !== 'string') {
          throw new Error(`Invalid URL: ${imageUrl} (type: ${typeof imageUrl})`);
        }
        // Validate URL format before fetching
        try {
          new URL(imageUrl);
        } catch (urlError) {
          throw new Error(`Invalid URL format from Replicate: ${imageUrl}. Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
        }
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        buffer = Buffer.from(await response.arrayBuffer());
      } else if (typeof output === 'object' && output !== null) {
        // Handle FileOutput or object with url
        console.log("📦 Output is object, keys:", Object.keys(output));
        const fileOutput = output as { url?: string | (() => string | Promise<string>) } | { url: string };
        
        if ('url' in fileOutput && fileOutput.url !== undefined) {
          let url: string | null = null;
          let streamHandled = false;
          
          if (typeof fileOutput.url === 'function') {
            console.log("🔗 url is a function, calling it...");
            const urlResult = await fileOutput.url();
            console.log("🔗 url() returned:", typeof urlResult, typeof urlResult === 'string' ? urlResult.substring(0, 100) : urlResult);
            
            // Handle if url() returns a ReadableStream or other non-string
            if (typeof urlResult === 'string') {
              url = urlResult;
            } else if ((urlResult as any) instanceof ReadableStream || (urlResult && typeof (urlResult as any).getReader === 'function')) {
              // If it's a ReadableStream, we need to read it directly
              console.log("📥 Reading from ReadableStream...");
              const reader = (urlResult as ReadableStream).getReader();
              const chunks: Uint8Array[] = [];
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) chunks.push(value);
              }
              buffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
              console.log(`✅ Read ${buffer.length} bytes from stream`);
              streamHandled = true;
            } else {
              throw new Error(`url() returned unexpected type: ${typeof urlResult}. Value: ${JSON.stringify(urlResult)}`);
            }
          } else if (typeof fileOutput.url === 'string') {
            url = fileOutput.url;
          } else {
            throw new Error(`url property is not a string or function: ${typeof fileOutput.url}`);
          }
          
          // Only fetch if we got a URL string (not a stream)
          if (!streamHandled && url) {
            console.log("📥 Downloading from URL:", url);
            if (!url.startsWith('http')) {
              throw new Error(`Invalid URL format: ${url}`);
            }
            // Validate URL format before fetching
            try {
              new URL(url);
            } catch (urlError) {
              throw new Error(`Invalid URL format from Replicate: ${url}. Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
            }
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
            buffer = Buffer.from(await response.arrayBuffer());
          } else if (!streamHandled) {
            throw new Error("No URL or stream available from output");
          }
        } else {
          console.error("❌ Object output missing 'url' property. Output:", JSON.stringify(output, null, 2).substring(0, 500));
          throw new Error("Unexpected output format from SD model: object without 'url' property");
        }
      } else if (typeof output === 'string') {
        // Direct URL
        console.log("📥 Downloading from direct URL string:", output);
        if (!output.startsWith('http')) {
          throw new Error(`Invalid URL string: ${output}`);
        }
        // Validate URL format before fetching
        try {
          new URL(output);
        } catch (urlError) {
          throw new Error(`Invalid URL format from Replicate: ${output}. Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
        }
        const response = await fetch(output);
        if (!response.ok) throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        buffer = Buffer.from(await response.arrayBuffer());
      } else {
        console.error("❌ Unexpected output type:", typeof output, "value:", output);
        throw new Error(`No valid image output from SD model. Type: ${typeof output}`);
      }
      console.log(`✅ SD generation complete (${model}), buffer size: ${buffer.length} bytes`);
      return buffer;
    } catch (error) {
      console.error("❌ Error processing SD output:", error);
      console.error("❌ Output was:", JSON.stringify(output, null, 2));
      throw error;
    }
    
  } catch (error) {
    console.error(`❌ SD generation error (${model}):`, error);
    
    // Provide helpful error message for version/permission errors
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMsg = String(error.message);
      
      // Rate limit errors (429)
      if (errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('throttled') || errorMsg.includes('Too Many Requests')) {
        throw new Error(
          `Replicate rate limit exceeded. You have less than $5 credit, so you're limited to 6 requests per minute.\n` +
          `The request will automatically retry with exponential backoff. If this persists:\n` +
          `1. Add more credit to your Replicate account (minimum $5)\n` +
          `2. Wait a few minutes between generations\n` +
          `3. Reduce batch size in Studio mode\n` +
          `Original error: ${errorMsg}`
        );
      }
      
      // Version/permission errors (422)
      if (errorMsg.includes('422') || errorMsg.includes('Invalid version') || errorMsg.includes('not permitted')) {
        const alternativeModels = model === 'ip-adapter-faceid' 
          ? 'Try: SD_MODEL=sdxl-img2img or SD_MODEL=sdxl-controlnet'
          : model === 'flux-img2img'
          ? 'Try: SD_MODEL=sdxl-img2img or SD_MODEL=ip-adapter-faceid'
          : 'Try: SD_MODEL=sdxl-img2img';
        
        throw new Error(
          `Replicate model version error for ${model}. The model version may be outdated or you may not have permission.\n` +
          `Suggested fix: Set a different model in .env.local:\n` +
          `${alternativeModels}\n` +
          `Original error: ${errorMsg}`
        );
      }
    }
    
    throw error;
  }
}

// Generate image using IP-Adapter for maximum pet identity preservation
// IP-Adapter uses the reference image to preserve subject identity while applying style
async function generateWithIPAdapter(
  referenceImageBase64: string,
  prompt: string
): Promise<Buffer> {
  console.log("=== IP-ADAPTER IDENTITY-PRESERVING GENERATION ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const imageDataUrl = referenceImageBase64.startsWith("data:") 
    ? referenceImageBase64 
    : `data:image/jpeg;base64,${referenceImageBase64}`;

  // IP-Adapter scale controls how much the reference image influences the result
  // Higher values (0.7-0.9) = stronger identity preservation
  const ipAdapterScale = parseFloat(process.env.IP_ADAPTER_SCALE || "0.8");
  
  console.log("IP-Adapter parameters:");
  console.log("- IP Adapter Scale:", ipAdapterScale, "(higher = more faithful to reference)");
  console.log("- Prompt length:", prompt.length);
  
  try {
    // Use IP-Adapter SDXL for identity-preserving generation
    const output = await replicate.run(
      "lucataco/ip-adapter-sdxl:49b78367e7928e0ddfcc35a96854eb3c34c35e3d17a92d1ec30d69b88b97c9a1",
      {
        input: {
          prompt: prompt,
          image: imageDataUrl,
          scale: ipAdapterScale,
          negative_prompt: "deformed, distorted, disfigured, poorly drawn, bad anatomy, wrong anatomy, extra limb, missing limb, floating limbs, mutated hands and fingers, disconnected limbs, mutation, mutated, ugly, disgusting, blurry, amputation, human face, human body, humanoid, dark, gloomy, shadowy, moody, dark background, brown background, dark brown, muddy colors, muted colors, dull colors, heavy shadows, dim lighting",
          num_outputs: 1,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          scheduler: "K_EULER_ANCESTRAL",
        }
      }
    );

    console.log("IP-Adapter generation complete, output type:", typeof output);
    
    // IP-Adapter returns array of URLs
    let imageUrl: string;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = output[0] as string;
    } else if (typeof output === "string") {
      imageUrl = output;
    } else {
      throw new Error("Unexpected IP-Adapter output format");
    }
    
    console.log("Downloading generated image from:", imageUrl.substring(0, 50) + "...");
    
    // Download the generated image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download IP-Adapter image: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("✅ IP-Adapter generation successful, buffer size:", buffer.length);
    
    return buffer;
  } catch (error) {
    console.error("IP-Adapter generation error:", error);
    throw error;
  }
}

// Apply style transfer using SDXL img2img with very low denoising
// This preserves 90%+ of the pet's identity - only changes surface texture/style
async function applyStyleTransfer(
  contentImageBase64: string
): Promise<Buffer> {
  console.log("=== STYLE TRANSFER (SDXL low-denoise) ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  // Convert base64 to data URL if needed
  const contentImageUrl = contentImageBase64.startsWith("data:") 
    ? contentImageBase64 
    : `data:image/jpeg;base64,${contentImageBase64}`;

  // Style strength controls how much artistic style is applied
  // 0.12 = 88% original preserved (good for identity + subtle texture)
  // Lower values = more photo-like, higher = more painterly
  const styleStrength = parseFloat(process.env.STYLE_TRANSFER_STRENGTH || "0.12");
  
  console.log("Style Transfer parameters:");
  console.log("- Denoise strength:", styleStrength, `(${Math.round((1 - styleStrength) * 100)}% original preserved)`);
  console.log("- Method: SDXL img2img with oil painting prompt");
  
  try {
    // Use SDXL img2img with very low denoising - essentially style transfer
    // This preserves the pet's structure while adding painterly texture
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: contentImageUrl,
          prompt: "AUTHENTIC 300-year-old HEAVILY AGED ANTIQUE oil painting portrait, late 18th-century European aristocratic masterpiece (1770-1830), EXTREMELY ROUGH WEATHERED TEXTURE like ancient artifact, PROMINENT CRAQUELURE visible crack network throughout like cracked earth, AGED VARNISH PATINA with subtle aging, THICK SCULPTURAL IMPASTO with worn peaks, COARSE CANVAS WEAVE clearly visible throughout, WEATHERED WORN EDGES paint thinned at corners and perimeter, SIGNIFICANT SURFACE WEAR rubbed areas, DRY BRUSH SCRATCHES, BROKEN JAGGED EDGES, FOXING age spots discoloration, PET IN NATURAL RELAXED comfortable pose, VIBRANT COLORS with GOOD CONTRAST, VARIED BACKGROUND COLOR randomly chosen from charcoal black or pure white or silver grey or powder blue or navy or teal or soft pink or dusty rose or emerald or sage or lavender or cream NOT BROWN, LOOSE FLOWING BRUSHWORK long sweeping strokes, Gainsborough LOOSE FEATHERY brushwork Reynolds glazes Vigée Le Brun elegance, DISCOVERED IN FORGOTTEN CASTLE after 300 years, LUSTROUS fabrics GLEAMING gold SPARKLING gems, ancient museum artifact quality",
          negative_prompt: "photograph, photo, photorealistic, modern, digital art, cartoon, anime, CGI, 3D render, blurry, low quality, watermark, gloomy, flat lighting, muted colors, dull colors, grey colors, muddy colors, brown background, dark brown background, tan background, beige background, sepia background, amber background, golden-brown, earth tones, muddy brown, brown tones, brownish, all brown, monotone brown, smooth gradients, airbrushed, plastic looking, too perfect, too smooth, too clean, too new, freshly painted, pristine, crisp clean edges, restored, cleaned, clinical, sharp edges everywhere, flat background, flat colors, no texture, no brushstrokes, no cracks, no aging, no patina, overly refined, digitally perfect, stiff pose, rigid posture, medieval, Renaissance, matte fabrics, human clothing, human-like pose, anthropomorphic, standing upright, bipedal, close-up, cropped, washed out, faded, low contrast",
          prompt_strength: styleStrength,
          num_inference_steps: 25,
          guidance_scale: 7.5,
          scheduler: "K_EULER",
          refine: "no_refiner",
          high_noise_frac: 0.8,
          num_outputs: 1,
        }
      }
    );

    console.log("Style transfer complete, output type:", typeof output);
    
    // SDXL returns array of FileOutput objects (ReadableStream with url() method)
    let buffer: Buffer;
    
    if (Array.isArray(output) && output.length > 0) {
      const firstOutput = output[0];
      console.log("First output type:", typeof firstOutput);
      console.log("First output constructor:", firstOutput?.constructor?.name);
      
      if (typeof firstOutput === "string") {
        // Direct URL string
        console.log("Downloading from URL string:", firstOutput.substring(0, 80));
        const response = await fetch(firstOutput);
        if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
        buffer = Buffer.from(await response.arrayBuffer());
      } else if (firstOutput && typeof firstOutput === "object") {
        // FileOutput object from Replicate SDK
        // FileOutput has: blob() method, url getter, toString() method
        const outputObj = firstOutput as Record<string, unknown>;
        
        console.log("FileOutput detected, using blob() method");
        
        // Use blob() method - this is the most reliable way to get the data
        if (typeof outputObj.blob === "function") {
          const blob = await (outputObj.blob as () => Promise<Blob>)();
          console.log("Got blob, size:", blob.size, "type:", blob.type);
          buffer = Buffer.from(await blob.arrayBuffer());
        }
        // Fallback: try toString() which should return the URL string
        else if (typeof outputObj.toString === "function") {
          const urlString = outputObj.toString();
          console.log("Using toString() URL:", urlString);
          const response = await fetch(urlString);
          if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
          buffer = Buffer.from(await response.arrayBuffer());
        }
        else {
          throw new Error(`Cannot extract image data from FileOutput`);
        }
      } else {
        throw new Error(`Unexpected output item type: ${typeof firstOutput}`);
      }
    } else if (typeof output === "string") {
      console.log("Downloading from direct URL string");
      const response = await fetch(output);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      throw new Error(`Unexpected SDXL output format: ${typeof output}`);
    }
    
    console.log("✅ Style transfer successful, buffer size:", buffer.length);
    
    return buffer;
  } catch (error) {
    console.error("Style transfer error:", error);
    throw error;
  }
}

// ============================================
// COMPOSITE APPROACH FUNCTIONS
// ============================================

// Step 1: Segment pet from background using rembg
async function segmentPet(imageBase64: string): Promise<Buffer> {
  console.log("=== PET SEGMENTATION (rembg) ===");
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN not configured");
  }
  
  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  const imageDataUrl = imageBase64.startsWith("data:") 
    ? imageBase64 
    : `data:image/jpeg;base64,${imageBase64}`;

  console.log("Removing background from pet image...");
  
  try {
    const output = await replicate.run(
      "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003",
      {
        input: {
          image: imageDataUrl,
        }
      }
    );

    console.log("Segmentation complete, output type:", typeof output);
    
    // Handle FileOutput from Replicate
    let buffer: Buffer;
    if (typeof output === "string") {
      const response = await fetch(output);
      if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
      buffer = Buffer.from(await response.arrayBuffer());
    } else if (output && typeof output === "object") {
      const outputObj = output as Record<string, unknown>;
      if (typeof outputObj.blob === "function") {
        const blob = await (outputObj.blob as () => Promise<Blob>)();
        buffer = Buffer.from(await blob.arrayBuffer());
      } else {
        throw new Error("Cannot extract segmented image");
      }
    } else {
      throw new Error("Unexpected rembg output format");
    }
    
    console.log("✅ Pet segmented successfully, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Segmentation error:", error);
    throw error;
  }
}

// Step 2: Generate Victorian royal scene (background + elements, no pet)
async function generateRoyalScene(
  species: string,
  openai: OpenAI,
  selectedPose?: { name: string; description: string; bodyPosition: string; headPosition: string; pawPosition: string; expression: string },
  selectedPalette?: { name: string; background: string; cushionColor: string; cloakColor: string; lighting: string; mood: string }
): Promise<Buffer> {
  console.log("=== GENERATING ROYAL SCENE ===");
  
  const poseContext = selectedPose ? `
POSE CONTEXT (pet will be in this pose):
- ${selectedPose.name}: ${selectedPose.description}
- Body: ${selectedPose.bodyPosition}
- Head: ${selectedPose.headPosition}
- Paws: ${selectedPose.pawPosition}
- Expression: ${selectedPose.expression}
- Arrange cushion and robe to accommodate this specific pose` : "";
  
  const paletteContext = selectedPalette ? `
COLOR PALETTE "${selectedPalette.name}":
- Background: ${selectedPalette.background}
- Cushion: ${selectedPalette.cushionColor}
- Cloak/Robe: ${selectedPalette.cloakColor}
- Lighting: ${selectedPalette.lighting}
- Mood: ${selectedPalette.mood}` : "";
  
  const scenePrompt = `A luxurious 18th-century European aristocratic portrait scene with bright vibrant colors and ornate details, empty and ready for a ${species} to be placed.${poseContext}${paletteContext}

SCENE ELEMENTS:

SCENE ELEMENTS:
- LUSTROUS velvet cushion with VISIBLE PILE texture catching light, GLEAMING gold embroidery with METALLIC SHEEN, ornate gold tassels
- SUMPTUOUS velvet royal robe with RICH SATURATED color, BRILLIANT gold filigree trim that SHIMMERS, natural draping folds
- Cream/ivory RUFFLED LACE COLLAR with delicate texture details, Elizabethan ruff style
- RICH SATURATED velvet curtain draped to one side creating atmospheric depth
- LUMINOUS background matching the SPECIFIED BACKGROUND COLOR - NOT BROWN

LUXURIOUS JEWELRY & METALLICS (WOW FACTOR):
- LIQUID GOLD: Gold jewelry that looks MOLTEN and DRIPPING with warm light - not flat or dull
- GLEAMING PEARLS: Iridescent luster with subtle pink/blue reflections, luminous from within
- DIAMOND SPARKLE: Tiny points of pure white BRILLIANT light on gems - like captured starlight
- SPARKLING GEMS: Ruby, emerald, sapphire with INTERNAL FIRE and light refraction - ALIVE with color
- HIGHLY POLISHED SILVER: Mirror-bright reflective surfaces that catch and throw light
- METALLIC DEPTH: Multiple layers of reflection in gold and silver - not flat metallic paint

BACKGROUND COLOR - SPECIFIC FOR THIS PORTRAIT:
- USE THIS EXACT BACKGROUND COLOR: ${getRandomBackgroundColor().toUpperCase()}
- This is the REQUIRED background color - do not use any other color
- Background should be BRIGHT and AIRY, not dark or muddy
- NEVER use dark brown, muddy brown, or monotonous brown tones

VIVID SATURATED COLORS:
- BRILLIANT jewel-toned velvet cushion - colors that SING with vibrancy
- RICH SATURATED burgundy/crimson robe with LUSTROUS sheen
- GLEAMING gold embroidery with true METALLIC reflection quality - LIQUID GOLD appearance
- DEEP SATURATED forest green or royal blue curtain accent
- LUMINOUS background using the SPECIFIED BACKGROUND COLOR from above
- LUSTROUS cream/ivory lace with subtle warm undertones
- SPARKLING gems: vivid ruby, rich emerald, deep sapphire with BRILLIANT internal fire - ALIVE with light
- VELVETY deep blacks with subtle undertones - never flat or grey
- IRIDESCENT PEARLS: Glowing with inner light, pink and blue overtones
AUTHENTIC OIL PAINTING LIGHTING - BRIGHT AND CHEERFUL:
- BRILLIANT BRIGHT warm golden key light making everything RADIATE
- LUMINOUS UPLIFTING atmosphere - fabrics seem to GLOW from within
- VIBRANT COLORFUL palette - NOT dark, NOT gloomy, NOT moody
- GLEAMING SPARKLING highlights on polished silver and jewelry
- SATURATED rich colors throughout - jewel tones POP with vibrancy

AUTHENTIC OIL PAINTING STYLE:
- THICK IMPASTO texture with RAISED PAINT on highlights
- VISIBLE BRISTLE MARKS in brushstrokes
- TRANSPARENT GLAZES creating depth in shadows
- CANVAS WEAVE visible through thin paint areas
- VARNISHED SATIN FINISH with rich lustrous sheen
- Museum masterpiece quality - looks genuinely antique

IMPORTANT: 
- Leave clear space in center for a pet to be composited
- No animals or people in the scene
- The cushion and robe should be arranged for a pet to appear seated/resting
- Must look like genuine late 18th-century masterpiece by Gainsborough, Reynolds, or Vigée Le Brun
- AUTHENTIC hand-painted texture with natural paint imperfections`;

  console.log("Generating scene with GPT-Image-1...");
  
  try {
    const response = await openai.images.generate({
      model: "gpt-image-1",
      prompt: scenePrompt,
      n: 1,
      size: "1024x1024",
      quality: "high",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No scene generated");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
    } else {
      throw new Error("No image data in response");
    }
    
    console.log("✅ Royal scene generated, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Scene generation error:", error);
    throw error;
  }
}

// Step 3: Composite segmented pet onto royal scene
async function compositePortrait(
  petBuffer: Buffer,
  sceneBuffer: Buffer
): Promise<Buffer> {
  console.log("=== COMPOSITING PORTRAIT ===");
  
  try {
    // Get dimensions of the scene
    const sceneMetadata = await sharp(sceneBuffer).metadata();
    const sceneWidth = sceneMetadata.width || 1024;
    const sceneHeight = sceneMetadata.height || 1024;
    
    // Resize pet to fit nicely on the scene (about 70% of scene height)
    const targetPetHeight = Math.round(sceneHeight * 0.70);
    const resizedPet = await sharp(petBuffer)
      .resize({ height: targetPetHeight, fit: "inside" })
      .toBuffer();
    
    // Get resized pet dimensions
    const petMetadata = await sharp(resizedPet).metadata();
    const petWidth = petMetadata.width || 500;
    const petHeight = petMetadata.height || 700;
    
    // Position pet in center-bottom of scene (on the cushion)
    const leftOffset = Math.round((sceneWidth - petWidth) / 2);
    const topOffset = Math.round(sceneHeight - petHeight - (sceneHeight * 0.08)); // Slightly above bottom
    
    console.log(`Compositing pet (${petWidth}x${petHeight}) onto scene (${sceneWidth}x${sceneHeight})`);
    console.log(`Position: left=${leftOffset}, top=${topOffset}`);
    
    // Composite the pet onto the scene
    const composited = await sharp(sceneBuffer)
      .composite([
        {
          input: resizedPet,
          left: leftOffset,
          top: topOffset,
          blend: "over",
        }
      ])
      .png()
      .toBuffer();
    
    console.log("✅ Portrait composited successfully, buffer size:", composited.length);
    return composited;
  } catch (error) {
    console.error("Compositing error:", error);
    throw error;
  }
}

// Step 4: Apply final harmonization pass to blend pet with scene and add painterly effects
async function harmonizePortrait(
  compositedBuffer: Buffer,
  species: string,
  openai: OpenAI,
  selectedPalette?: { name: string; background: string; cushionColor: string; cloakColor: string; lighting: string; mood: string }
): Promise<Buffer> {
  console.log("=== HARMONIZING PORTRAIT ===");
  
  try {
    // Convert buffer to File for OpenAI
    const uint8Array = new Uint8Array(compositedBuffer);
    const imageBlob = new Blob([uint8Array], { type: "image/png" });
    const imageFile = new File([imageBlob], "composited.png", { type: "image/png" });
    
    const lightingContext = selectedPalette ? `Lighting: ${selectedPalette.lighting}. Mood: ${selectedPalette.mood}.` : "";
    
    const harmonizePrompt = `Transform this composite into an AUTHENTIC 18th-century European aristocratic OIL PAINTING PORTRAIT.

CRITICAL - PRESERVE THE ${species.toUpperCase()} EXACTLY:
- The ${species}'s face, fur color, markings, and features must remain EXACTLY as shown
- Do NOT change the ${species}'s appearance, colors, or distinctive features
- The ${species} must look IDENTICAL to the original - same face, same markings, same everything

PAINTERLY TRANSFORMATION (apply to ENTIRE image):
- Add THICK IMPASTO oil paint texture with visible brushstrokes throughout
- Apply heavy sculptural paint texture, palette knife ridges, bristle marks
- Add rich glazing layers like Gainsborough, Reynolds, or Vigée Le Brun masterwork
- Make canvas weave texture visible through thin paint areas
- Add antique craquelure, aged varnish patina for museum-quality finish
- Transform the ENTIRE image to look like authentic 300-year-old oil painting
- NOT photo-realistic - must look like hand-painted masterpiece

HARMONIZATION:
- Add a soft, natural drop shadow beneath the ${species}
- Blend the edges where ${species} meets background (subtle, 2-3 pixels)
- Ensure lighting matches across pet and scene
- Make shadows and highlights consistent throughout
${lightingContext}

RESULT:
- Museum-quality 18th-century oil painting portrait
- ${species} looks EXACTLY like the original photo
- Entire image has authentic painterly texture and style
- Bright, beautiful, luminous finish`;

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: harmonizePrompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No harmonized image");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
    } else {
      throw new Error("No image data in response");
    }
    
    console.log("✅ Portrait harmonized successfully, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Harmonization error:", error);
    throw error;
  }
}

// Step 1.5: Apply painterly effects to segmented pet (preserves identity, adds style)
async function applyPainterlyToPet(
  petBuffer: Buffer,
  species: string,
  openai: OpenAI
): Promise<Buffer> {
  console.log("=== APPLYING PAINTERLY EFFECTS TO PET ===");
  
  try {
    // Convert buffer to File for OpenAI
    const uint8Array = new Uint8Array(petBuffer);
    const imageBlob = new Blob([uint8Array], { type: "image/png" });
    const imageFile = new File([imageBlob], "pet.png", { type: "image/png" });
    
    const painterlyPrompt = `Transform this ${species} into an 18th-century oil painting style while preserving EXACT identity.

CRITICAL - PRESERVE EXACT ${species.toUpperCase()} IDENTITY:
- Face, fur color, markings, and features must remain EXACTLY the same
- Do NOT change the ${species}'s appearance, colors, or distinctive features
- The ${species} must look IDENTICAL to the original - same face, same markings, same everything
- Only add painterly TEXTURE and STYLE, not new features

PAINTERLY TRANSFORMATION:
- Add THICK IMPASTO oil paint texture with visible brushstrokes
- Apply heavy sculptural paint texture, palette knife ridges, bristle marks
- Add rich glazing layers like Gainsborough or Reynolds masterwork
- Make it look like authentic hand-painted oil painting
- NOT photo-realistic - must look like painted portrait
- Bright, luminous lighting with warm golden highlights

RESULT:
- ${species} looks EXACTLY like the original photo
- Entire ${species} has authentic painterly texture and style
- Museum-quality 18th-century oil painting appearance`;

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: imageFile,
      prompt: painterlyPrompt,
      n: 1,
      size: "1024x1024",
    });
    
    const imageData = response.data?.[0];
    if (!imageData) throw new Error("No painterly pet generated");
    
    let buffer: Buffer;
    if (imageData.b64_json) {
      buffer = Buffer.from(imageData.b64_json, "base64");
    } else if (imageData.url) {
      const downloadResponse = await fetch(imageData.url);
      if (!downloadResponse.ok) throw new Error(`Failed to download: ${downloadResponse.status}`);
      buffer = Buffer.from(await downloadResponse.arrayBuffer());
    } else {
      throw new Error("No image data in response");
    }
    
    console.log("✅ Painterly effects applied to pet, buffer size:", buffer.length);
    return buffer;
  } catch (error) {
    console.error("Painterly application error:", error);
    // If painterly step fails, return original segmented pet
    console.log("⚠️ Falling back to original segmented pet (no painterly effects)");
    return petBuffer;
  }
}

// Main composite generation function
async function generateCompositePortrait(
  petImageBase64: string,
  species: string,
  openai: OpenAI,
  selectedPose?: { name: string; description: string; bodyPosition: string; headPosition: string; pawPosition: string; expression: string },
  selectedPalette?: { name: string; background: string; cushionColor: string; cloakColor: string; lighting: string; mood: string }
): Promise<Buffer> {
  console.log("=== COMPOSITE PORTRAIT GENERATION ===");
  console.log("Step 1/5: Segmenting pet from background...");
  
  // Step 1: Segment pet (preserves exact pet appearance)
  const segmentedPet = await segmentPet(petImageBase64);
  
  console.log("Step 2/5: Applying painterly effects to pet...");
  
  // Step 1.5: Apply painterly effects to pet (optional - preserves identity, adds style)
  const enablePetPainterly = process.env.USE_PET_PAINTERLY !== "false"; // Default: enabled
  let styledPet = segmentedPet;
  if (enablePetPainterly) {
    styledPet = await applyPainterlyToPet(segmentedPet, species, openai);
  }
  
  console.log("Step 3/5: Generating royal scene...");
  
  // Step 2: Generate royal scene with pose/palette context
  const royalScene = await generateRoyalScene(species, openai, selectedPose, selectedPalette);
  
  console.log("Step 4/5: Compositing pet onto scene...");
  
  // Step 3: Composite pet onto scene
  const composited = await compositePortrait(styledPet, royalScene);
  
  console.log("Step 5/5: Applying final harmonization...");
  
  // Step 4: Harmonize with painterly effects (enabled by default for better integration)
  // This adds shadows, edge blending, and ensures consistent painterly texture
  const enableHarmonization = process.env.USE_COMPOSITE_HARMONIZATION !== "false"; // Default: enabled
  
  if (enableHarmonization) {
    const harmonized = await harmonizePortrait(composited, species, openai, selectedPalette);
    console.log("✅ Composite portrait complete (with harmonization)");
    return harmonized;
  } else {
    console.log("✅ Composite portrait complete (no harmonization)");
    return composited;
  }
}

// Analyze facial structure and breed-specific characteristics for high-fidelity portrait generation
async function analyzeFacialStructure(
  openai: OpenAI,
  imageBase64: string,
  species: string,
  breed: string
): Promise<string> {
  console.log("=== FACIAL STRUCTURE ANALYSIS ===");
  
  const facialAnalysisResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert in animal anatomy and breed identification. Analyze this ${species}'s facial structure with EXTREME PRECISION for portrait generation.

BREED CONTEXT: ${breed || "Unknown breed - analyze visible characteristics"}

*** BREED-SPECIFIC FACIAL TEMPLATES (use as reference) ***

FOR CATS - Common breed facial structures:

- MAINE COON (CRITICAL - very distinctive breed):
  * EARS: VERY TALL, LARGE, pointed ears - often 40%+ of head height. Lynx tips (tufts at ear tips) are ESSENTIAL. Ears set HIGH and WIDE on head. Ear furnishings (hair inside ears).
  * HEAD: Large, slightly longer than wide. Strong bone structure. High cheekbones.
  * MUZZLE: SQUARE, strong, medium length - distinctive "box" shape when viewed from front. NOT pointed like Siamese.
  * EYES: Large, slightly oval, wide-set. Often green, gold, or copper. Expressive, alert look.
  * CHIN: Strong, in line with nose and upper lip.
  * COAT: Long, flowing fur. Distinctive "ruff" around neck like a lion's mane. Fluffy chest.
  * FOR KITTENS: Even larger ears relative to head, rounder face, larger eyes.

- BRITISH SHORTHAIR / CHARTREUX: Very FLAT, WIDE face. Round head. SHORT muzzle (almost flat). WIDE-SET eyes. Full, puffy cheeks. Broad skull. "Smiling" expression. Small to medium ears.

- RUSSIAN BLUE: Wedge-shaped head. Medium muzzle. LARGE ears set wide. Vivid green almond eyes. More angular than British Shorthair. Silvery-blue coat.

- PERSIAN: Extremely flat face (brachycephalic). Very short/flat muzzle. Large round eyes. Small ears set low and wide. Long flowing coat.

- SIAMESE: Long, wedge-shaped head. Long pointed muzzle. VERY LARGE pointed ears set low. Almond eyes angled upward. Blue eyes. Sleek body.

- RAGDOLL: Semi-long fur. Blue eyes. Medium-large ears with rounded tips. Docile expression.

- NORWEGIAN FOREST CAT: Similar to Maine Coon but with more triangular head. Almond eyes. Large tufted ears.

- DOMESTIC SHORTHAIR: Variable - analyze individual features carefully.

FOR DOGS - Common breed facial structures:
- PUG/BULLDOG: Brachycephalic. Very flat face. Wrinkled. Large round eyes.
- LABRADOR: Square muzzle. Medium proportions. Friendly expression.
- GERMAN SHEPHERD: Long muzzle. Wedge head. Alert ears. Intelligent expression.
- GOLDEN RETRIEVER: Medium muzzle. Soft expression. Gentle features.
- HUSKY: Wolf-like. Almond eyes. Erect triangular ears.

*** ANALYZE THIS SPECIFIC PET ***

Provide a DETAILED facial structure analysis:

=== SKULL AND HEAD STRUCTURE ===
1. SKULL TYPE: Classify as:
   - Brachycephalic (flat-faced, shortened skull - e.g., Pugs, Persians, Bulldogs)
   - Mesocephalic (medium proportions - e.g., Labradors, most cats)
   - Dolichocephalic (long, narrow skull - e.g., Greyhounds, Collies, Siamese)

2. HEAD SHAPE: Describe the overall silhouette
   - Round, oval, square, wedge-shaped, or heart-shaped?
   - Width-to-length ratio estimate (e.g., "head is 80% as wide as it is long")

=== SNOUT/MUZZLE ANALYSIS ===
3. SNOUT LENGTH: Estimate as percentage of total head length
   - Very short (<15% of head), Short (15-25%), Medium (25-35%), Long (35-45%), Very long (>45%)
   
4. SNOUT WIDTH: Relative to head width
   - Narrow, medium, or wide? Estimate percentage.
   
5. SNOUT SHAPE: Profile view characteristics
   - Straight, slightly curved, strongly curved, flat/pushed in?
   - Nose tip position: upturned, straight, or downturned?

=== EYE ANALYSIS ===
6. EYE SHAPE: Round, almond, oval, or triangular?

7. EYE SIZE: Relative to face
   - Small (<8% of face width), Medium (8-12%), Large (12-18%), Very large (>18%)
   
8. EYE POSITION: 
   - Set high, medium, or low on face?
   - Wide-set, normal, or close-set? Estimate distance between eyes relative to eye width.
   - Forward-facing or more lateral?

9. EYE ANGLE: Horizontal, slightly upward slant, or downward slant?

=== EAR ANALYSIS ===
10. EAR SIZE: Relative to head
    - Small (<15% of head height), Medium (15-25%), Large (25-40%), Very large (>40%)

11. EAR SHAPE: Pointed, rounded, folded, rose, button, drop/pendant?

12. EAR SET: High on head, medium, or low? Wide apart or close together?

13. EAR CARRIAGE: Erect, semi-erect, folded, or drooping?

=== DISTINCTIVE FEATURES ===
14. UNIQUE STRUCTURAL FEATURES:
    - Any asymmetry in facial features?
    - Distinctive bone structure visible?
    - Unusual proportions compared to breed standard?

15. BREED-SPECIFIC MARKERS:
    - What features confirm this breed identification?
    - Any mixed-breed indicators?

=== NUMERIC SUMMARY ===
Provide these estimates:
- Snout-to-skull ratio: X%
- Eye spacing (in eye-widths apart): X
- Ear-to-head ratio: X%
- Face width-to-height ratio: X:1
- Forehead prominence: Low/Medium/High

Format your response as structured data that can be used to ensure the generated portrait matches this EXACT facial structure.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 2000, // Increased for enhanced detailed facial structure analysis
    temperature: 0.05, // Very low temperature for extremely consistent, precise analysis
  });
  
  const facialAnalysis = facialAnalysisResponse.choices[0]?.message?.content || "";
  console.log("Facial structure analysis length:", facialAnalysis.length);
  console.log("Facial analysis preview:", facialAnalysis.substring(0, 300));
  
  return facialAnalysis;
}

// Compare original pet photo with generated portrait and create refinement prompt
// Enhanced with identity-focused corrections for maximum recognizability
async function compareAndRefine(
  openai: OpenAI,
  originalImageBuffer: Buffer,
  generatedImageBuffer: Buffer,
  originalDescription: string,
  species: string
): Promise<string> {
  console.log("=== STAGE 2: Identity-Focused Comparison and Refinement ===");
  
  // Process both images for vision API
  const processedOriginal = await sharp(originalImageBuffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
  
  const processedGenerated = await sharp(generatedImageBuffer)
    .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
  
  const originalBase64 = processedOriginal.toString("base64");
  const generatedBase64 = processedGenerated.toString("base64");
  
  // Use GPT-4o vision to compare both images with identity focus
  const comparisonResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `You are an expert at pet identification comparing two images. Your goal is to ensure the generated portrait is INSTANTLY RECOGNIZABLE as the original pet.

IMAGE 1 (LEFT): The ORIGINAL pet photo - the TRUE reference.
IMAGE 2 (RIGHT): The GENERATED portrait - must be refined to match.

ORIGINAL DESCRIPTION: ${originalDescription}

=== IDENTITY VERIFICATION (MOST CRITICAL) ===
Ask yourself: "Would the pet's owner instantly recognize this as THEIR pet?"

Rate these identity factors (1-10 each):
1. FACIAL STRUCTURE MATCH: Does the skull shape, snout length, and overall head structure match?
2. EYE RECOGNITION: Are the eyes the right shape, size, spacing, color, and expression?
3. EAR ACCURACY: Do the ears match in shape, size, position, and carriage?
4. DISTINCTIVE FEATURES: Are ALL unique markings in their EXACT locations?
5. OVERALL "LOOK": Does the portrait capture this pet's unique personality/expression?

=== DETAILED COMPARISON ===

1. SKULL AND FACIAL STRUCTURE (Critical for recognition):
   - Is the skull type correct? (brachycephalic/flat vs mesocephalic/medium vs dolichocephalic/long)
   - Is the snout-to-head ratio accurate?
   - Does the forehead prominence match?
   - Is the jaw/chin shape correct?
   - List EVERY structural discrepancy

2. EYES (The window to recognition):
   - Eye SHAPE: Round, almond, oval - is it exact?
   - Eye SIZE relative to face - is it accurate?
   - Eye SPACING - are they the right distance apart?
   - Eye COLOR - is the exact shade matched?
   - Eye EXPRESSION - does it capture the pet's "look"?
   - Eye ANGLE - horizontal or slanted?

3. EARS (Major recognition factor):
   - Shape accuracy (pointed, rounded, folded, etc.)
   - Size relative to head
   - Position on head (high, medium, low)
   - Carriage (erect, semi-erect, drooping)
   - Any asymmetry preserved?

4. MARKINGS AND PATTERNS:
   - Is EVERY marking present?
   - Is each marking in the EXACT correct location?
   - Are marking shapes accurate?
   - Are marking colors correct?
   - List EVERY missing, misplaced, or incorrect marking

5. COAT AND COLORING:
   - Is the base color the exact right shade?
   - Are color transitions/gradients preserved?
   - Is the coat texture represented correctly?
   - Are any color areas wrong?

=== IDENTITY MATCH SCORE ===
Overall Identity Match: X/10
(8+ = Owner would recognize immediately)
(6-7 = Somewhat recognizable but issues)
(<6 = Would not be recognized as this specific pet)

=== PRIORITY CORRECTIONS FOR IDENTITY ===
List corrections in order of impact on recognizability:

CRITICAL (Must fix - affects instant recognition):
1. [Issue]: [Specific fix required]
2. [Issue]: [Specific fix required]

IMPORTANT (Should fix - improves accuracy):
3. [Issue]: [Specific fix required]
4. [Issue]: [Specific fix required]

MINOR (Nice to fix - fine details):
5. [Issue]: [Specific fix required]

=== REFINED GENERATION PROMPT ===
Write a corrected description that addresses ALL issues, emphasizing:
- Exact facial structure corrections needed
- Precise eye, ear, and marking corrections
- Any proportion adjustments required

The refined prompt should result in a portrait the owner would INSTANTLY recognize as their beloved pet.`,
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${originalBase64}`,
              detail: "high",
            },
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${generatedBase64}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    max_tokens: 2000, // Increased for more detailed analysis
    temperature: 0.2, // Lower temperature for consistent, precise analysis
  });
  
  const refinementPrompt = comparisonResponse.choices[0]?.message?.content || "";
  console.log("Identity-focused refinement analysis complete");
  console.log("Refinement prompt length:", refinementPrompt.length);
  console.log("Refinement preview:", refinementPrompt.substring(0, 400));
  
  return refinementPrompt;
}

// Enhance image brightness and sharpness using sharp (fast, runs locally)
async function enhanceImage(inputBuffer: Buffer): Promise<Buffer> {
  console.log("=== ENHANCING IMAGE (brightness + sharpness) ===");
  console.log(`Input buffer size: ${inputBuffer.length} bytes`);
  
  try {
    // Get brightness multiplier from env (default 1.15 = 15% brighter)
    const brightnessFactor = parseFloat(process.env.ENHANCE_BRIGHTNESS || "1.15");
    // Get sharpness sigma from env (default 0.8 = subtle sharpening)
    const sharpnessSigma = parseFloat(process.env.ENHANCE_SHARPNESS || "0.8");
    
    console.log(`- Brightness factor: ${brightnessFactor} (${Math.round((brightnessFactor - 1) * 100)}% increase)`);
    console.log(`- Sharpness sigma: ${sharpnessSigma}`);
    
    const enhancedBuffer = await sharp(inputBuffer)
      // Increase brightness and slight saturation boost
      .modulate({
        brightness: brightnessFactor,
        saturation: 1.1,  // 10% saturation boost for more vibrant colors
      })
      // Apply subtle sharpening
      .sharpen({
        sigma: sharpnessSigma,
        m1: 1.0,  // Flat areas sharpening
        m2: 2.0,  // Edge sharpening (more aggressive on edges)
      })
      // Slight contrast boost
      .linear(1.05, -10)  // 5% contrast increase
      .png({ quality: 100 })
      .toBuffer();
    
    console.log(`✅ Enhancement complete. Output size: ${enhancedBuffer.length} bytes`);
    return enhancedBuffer;
  } catch (error) {
    console.error("Enhancement failed, returning original:", error);
    return inputBuffer;
  }
}

// Upscale image using Real-ESRGAN for higher resolution (with retry mechanism)
async function upscaleImage(inputBuffer: Buffer, scale: number = 2, maxRetries: number = 3): Promise<Buffer> {
  console.log("=== UPSCALING IMAGE ===");
  console.log(`Input buffer size: ${inputBuffer.length} bytes`);
  console.log(`Target scale: ${scale}x`);
  console.log(`Max retries: ${maxRetries}`);
  
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
      
      // Use Real-ESRGAN for high-quality upscaling
      // Model: nightmareai/real-esrgan - great for artistic images
      console.log("Running Real-ESRGAN upscaler...");
      const startTime = Date.now();
      
      const output = await replicate.run(
        "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
        {
          input: {
            image: imageDataUrl,
            scale: scale, // 2x or 4x
            face_enhance: false, // Not for faces, just general upscale
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
        // FileOutput object from Replicate SDK
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
      
      // Verify the image was actually upscaled (should be larger than input)
      const inputWidth = processMetadata.width || 1024;
      const inputHeight = processMetadata.height || 1024;
      const expectedMinWidth = inputWidth * scale * 0.9; // Allow 10% tolerance
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
        const delay = attempt * 2000; // Increasing delay: 2s, 4s, 6s
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // All retries failed - use sharp to upscale as fallback
  console.error(`❌ All ${maxRetries} upscale attempts failed. Using sharp fallback upscale.`);
  console.error(`Last error: ${lastError?.message}`);
  
  // Fallback: Use sharp's lanczos3 upscaling (not as good as Real-ESRGAN but ensures we get higher resolution)
  try {
    const targetWidth = originalWidth * scale;
    const targetHeight = originalHeight * scale;
    console.log(`Fallback: Using sharp to upscale to ${targetWidth}x${targetHeight}...`);
    
    const fallbackBuffer = await sharp(inputBuffer)
      .resize(targetWidth, targetHeight, { 
        kernel: 'lanczos3',
        fit: 'fill'
      })
      .sharpen({ sigma: 0.5 }) // Light sharpening to reduce blur
      .png()
      .toBuffer();
    
    const fallbackMeta = await sharp(fallbackBuffer).metadata();
    console.log(`✅ Fallback upscale complete: ${fallbackMeta.width}x${fallbackMeta.height}`);
    return fallbackBuffer;
  } catch (fallbackError) {
    console.error("Fallback upscale also failed:", fallbackError);
    return inputBuffer; // Return original only as last resort
  }
}

// Create watermarked version of image with LumePet logo
async function createWatermarkedImage(inputBuffer: Buffer): Promise<Buffer> {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 1024;
  const height = metadata.height || 1024;

  // Load LumePet logo from public folder
  const fs = await import("fs");
  const path = await import("path");
  const logoPath = path.join(process.cwd(), "public", "samples", "LumePet2.png");
  
  let logoBuffer: Buffer;
  try {
    logoBuffer = fs.readFileSync(logoPath);
  } catch (error) {
    console.error("Failed to load logo, using text watermark:", error);
    // Fallback to text watermark if logo not found
  const watermarkSvg = `
    <svg width="${width}" height="${height}">
      <defs>
        <pattern id="watermark" width="400" height="200" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="100" 
                font-family="Georgia, serif" 
                font-size="28" 
                font-weight="bold"
                  fill="rgba(255,255,255,0.5)"
                text-anchor="start">
              LUMEPET – PREVIEW ONLY
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)"/>
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

  // Get logo dimensions
  const logoImage = sharp(logoBuffer);
  const logoMetadata = await logoImage.metadata();
  const logoWidth = logoMetadata.width || 200;
  const logoHeight = logoMetadata.height || 200;
  
  // Watermarks - about 18% of image size for denser coverage
  const watermarkSize = Math.max(width, height) * 0.18;
  const watermarkAspectRatio = logoWidth / logoHeight;
  const watermarkWidth = watermarkSize;
  const watermarkHeight = watermarkSize / watermarkAspectRatio;

  // Convert logo to base64 for SVG embedding
  const logoBase64 = logoBuffer.toString("base64");
  const logoMimeType = logoMetadata.format === "png" ? "image/png" : "image/jpeg";

  // Create dense grid of watermarks covering entire image
  // 4 rows with alternating 3 and 4 watermarks for full coverage
  const watermarkImages: string[] = [];
  const opacity = "0.45"; // Brighter opacity
  
  // Row 1 (top): 3 watermarks
  watermarkImages.push(`
      <image x="${Math.round(width * 0.15 - watermarkWidth / 2)}" y="${Math.round(height * 0.12 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.50 - watermarkWidth / 2)}" y="${Math.round(height * 0.12 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.85 - watermarkWidth / 2)}" y="${Math.round(height * 0.12 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 2: 4 watermarks offset
  watermarkImages.push(`
      <image x="${Math.round(width * 0.05 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.35 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.65 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.95 - watermarkWidth / 2)}" y="${Math.round(height * 0.35 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 3 (middle): 3 watermarks
  watermarkImages.push(`
      <image x="${Math.round(width * 0.20 - watermarkWidth / 2)}" y="${Math.round(height * 0.55 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.50 - watermarkWidth / 2)}" y="${Math.round(height * 0.55 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.80 - watermarkWidth / 2)}" y="${Math.round(height * 0.55 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 4: 4 watermarks offset
  watermarkImages.push(`
      <image x="${Math.round(width * 0.05 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.35 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.65 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.95 - watermarkWidth / 2)}" y="${Math.round(height * 0.75 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  
  // Row 5 (bottom): 3 watermarks
  watermarkImages.push(`
      <image x="${Math.round(width * 0.15 - watermarkWidth / 2)}" y="${Math.round(height * 0.92 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.50 - watermarkWidth / 2)}" y="${Math.round(height * 0.92 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);
  watermarkImages.push(`
      <image x="${Math.round(width * 0.85 - watermarkWidth / 2)}" y="${Math.round(height * 0.92 - watermarkHeight / 2)}" 
        width="${Math.round(watermarkWidth)}" height="${Math.round(watermarkHeight)}" 
        href="data:${logoMimeType};base64,${logoBase64}" opacity="${opacity}" filter="url(#whiteBright)"/>`);

  // Create SVG with dense watermark coverage
  // Watermarks are WHITE with high visibility
  const watermarkSvg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- White filter to make logo appear white -->
        <filter id="whiteBright" x="-50%" y="-50%" width="200%" height="200%">
          <feColorMatrix type="matrix" values="
            0 0 0 0 1
            0 0 0 0 1
            0 0 0 0 1
            0 0 0 1 0"/>
        </filter>
      </defs>
      
      <!-- 17 watermarks with dense coverage -->
      ${watermarkImages.join('')}
    </svg>
  `;

  return await sharp(inputBuffer)
    .composite([
      {
        input: Buffer.from(watermarkSvg),
        top: 0,
        left: 0,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();
}// Create side-by-side before/after image using FULL RESOLUTION images
async function createBeforeAfterImage(
  originalBuffer: Buffer,
  generatedBuffer: Buffer,
  imageId: string,
  studioMode: boolean = false
): Promise<void> {
  try {
    // Get metadata for both images (full resolution)
    const originalMeta = await sharp(originalBuffer).metadata();
    const generatedMeta = await sharp(generatedBuffer).metadata();
    
    console.log(`📐 Original image: ${originalMeta.width}x${originalMeta.height}`);
    console.log(`📐 Generated image: ${generatedMeta.width}x${generatedMeta.height}`);
    
    const originalWidth = originalMeta.width || 1024;
    const originalHeight = originalMeta.height || 1024;
    const generatedWidth = generatedMeta.width || 1024;
    const generatedHeight = generatedMeta.height || 1024;
    
    // Always create horizontal side-by-side (for all users)
    try {
      const targetHeight = Math.max(originalHeight, generatedHeight);
      const originalTop = Math.floor((targetHeight - originalHeight) / 2);
      const generatedTop = Math.floor((targetHeight - generatedHeight) / 2);
      const combinedWidth = originalWidth + generatedWidth;
      
      const horizontalBuffer = await sharp({
        create: {
          width: combinedWidth,
          height: targetHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .composite([
          { input: originalBuffer, left: 0, top: originalTop },
          { input: generatedBuffer, left: originalWidth, top: generatedTop }
        ])
        .png()
        .toBuffer();
      
      await uploadBeforeAfterImage(
        horizontalBuffer,
        `${imageId}-before-after.png`,
        "image/png"
      );
      console.log(`✅ Horizontal before/after uploaded: ${imageId}-before-after.png`);
    } catch (error) {
      console.error(`⚠️ Failed to create horizontal before/after:`, error);
    }
    
    // Only create additional variations for Studio mode
    if (!studioMode) {
      console.log(`✅ Single before/after image created for regular user: ${imageId}`);
      return;
    }
    
    console.log(`🖼️ Creating multiple before/after image variations (Studio mode) for ${imageId}...`);
    
    // 2. PORTRAIT STACKED (vertical)
    try {
      const targetWidth = Math.max(originalWidth, generatedWidth);
      const originalLeft = Math.floor((targetWidth - originalWidth) / 2);
      const generatedLeft = Math.floor((targetWidth - generatedWidth) / 2);
      const combinedHeight = originalHeight + generatedHeight;
      
      const portraitBuffer = await sharp({
        create: {
          width: targetWidth,
          height: combinedHeight,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .composite([
          { input: originalBuffer, left: originalLeft, top: 0 },
          { input: generatedBuffer, left: generatedLeft, top: originalHeight }
        ])
        .png()
        .toBuffer();
      
      await uploadBeforeAfterImage(
        portraitBuffer,
        `${imageId}-before-after-portrait.png`,
        "image/png"
      );
      console.log(`✅ Portrait (vertical) before/after uploaded: ${imageId}-before-after-portrait.png`);
    } catch (error) {
      console.error(`⚠️ Failed to create portrait before/after:`, error);
    }
    
    console.log(`✅ Studio mode before/after images created (horizontal + vertical) for ${imageId}`);
  } catch (error) {
    // Don't fail the generation if before/after upload fails
    console.error(`⚠️ Failed to create before/after images:`, error);
  }
}

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") || "unknown";
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(userAgent);
  const clientIP = getClientIP(request);
  
  console.log("=== Generate API called ===");
  console.log("Client IP:", clientIP);
  console.log("User agent:", userAgent);
  console.log("Is mobile:", isMobile);
  
  // Check if this is studio mode (check form data early for rate limit bypass)
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
  
  const isStudioMode = formData.get("studioMode") === "true";
  
  // Rate limiting - bypass for studio mode (password protected)
  if (!isStudioMode) {
    const rateLimit = checkRateLimit(`generate:${clientIP}`, RATE_LIMITS.generate);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for IP: ${clientIP}`);
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment before trying again." },
        { 
          status: 429,
          headers: {
            "Retry-After": Math.ceil(rateLimit.resetIn / 1000).toString(),
            "X-RateLimit-Remaining": "0",
          }
        }
      );
    }
  } else {
    console.log("🎨 Studio mode - bypassing rate limit");
  }
  
  try {
    // Check for API keys
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
    
    console.log("Using OpenAI for vision (GPT-4o) and image generation (DALL-E 3)");

    // Form data already parsed above for studio mode check
    const imageFile = formData.get("image") as File | null;
    const gender = formData.get("gender") as string | null;
    const usePackCredit = formData.get("usePackCredit") === "true";
    const useSecretCredit = formData.get("useSecretCredit") === "true";
    const style = formData.get("style") as string | null; // "rainbow-bridge" for memorial portraits
    const petName = formData.get("petName") as string | null; // Pet's name for rainbow bridge portraits
    const generationSessionId = formData.get("generationSessionId") as string | null; // For recovering abandoned generations
    
    // Studio mode - unlimited generations with custom prompts (already checked above as isStudioMode)
    const studioMode = isStudioMode;
    const customPrompt = formData.get("customPrompt") as string | null;
    const enableWatermark = formData.get("enableWatermark") !== "false"; // Default true unless explicitly false
    
    const isRainbowBridge = style === "rainbow-bridge";
    
    // Log Rainbow Bridge parameters
    if (style || petName) {
      console.log(`🌈 Form data - style: "${style}", petName: "${petName}", isRainbowBridge: ${isRainbowBridge}`);
    }

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

    // Validate file size (Vercel has 4.5MB body limit)
    if (imageFile.size > CONFIG.MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB. Please compress your image or use a smaller file.` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // SECURITY: Validate file is actually an image by checking magic bytes
    // This prevents uploading malicious files with fake MIME types
    const isValidImage = await validateImageMagicBytes(bytes);
    if (!isValidImage) {
      console.warn(`Invalid image magic bytes from IP: ${clientIP}`);
      return NextResponse.json(
        { error: "Invalid image file. Please upload a valid JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    // Generate unique ID for this generation
    const imageId = uuidv4();

    // Note: Original pet photo is now uploaded immediately when user selects it
    // via the /api/upload-pet endpoint (in GenerationFlow and RainbowBridgeFlow)

    // Process original image for vision API - improved preprocessing for better detail
    // Use higher resolution and preserve full image without cropping
    const processedImage = await sharp(buffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    const base64Image = processedImage.toString("base64");

    // Step 1: Use GPT-4o to analyze pet(s) - OPTIMIZED for speed while keeping critical identity info
    const visionStartTime = Date.now();
    
    // First, quickly detect how many pets are in the image
    console.log("🔍 Detecting number of pets in image...");
    const petCountResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "How many pets (dogs or cats) are clearly visible in this image? Respond with ONLY a single number: 1, 2, 3, or 4. If more than 4, respond with 4. If none or unclear, respond with 1.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      max_tokens: 10,
      temperature: 0,
    });
    
    const petCountStr = petCountResponse.choices[0]?.message?.content?.trim() || "1";
    const detectedPetCount = Math.min(4, Math.max(1, parseInt(petCountStr) || 1));
    console.log(`🐾 Detected ${detectedPetCount} pet(s) in image`);
    
    // Track multi-pet info (supports up to 4 pets)
    const petDescriptions: string[] = [];
    const petSpecies: string[] = [];
    let multiPetCombinedDescription = "";
    const isMultiPet = detectedPetCount >= 2;
    
    // Legacy variables for backwards compatibility
    let petDescription1 = "";
    let petDescription2 = "";
    let species1 = "";
    let species2 = "";
    
    if (isMultiPet) {
      // MULTI-PET MODE: Analyze all pets in the single image (2-4 pets)
      console.log(`🐾🐾 Analyzing ${detectedPetCount} pets in image with GPT-4o...`);
      
      // Build dynamic prompt for number of pets detected
      const petSections = Array.from({ length: detectedPetCount }, (_, i) => `---PET ${i + 1}---
[SPECIES] BREED: [breed]. SIZE: [size and build]. BODY: [proportions]. COLORS: [colors]. FACE: [features]. UNIQUE: [features].`).join('\n');
      
      const multiPetVisionResponse = await openai.chat.completions.create({
        model: "gpt-4o",  // Use full model for multi-pet - need better understanding
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `This image contains ${detectedPetCount} pets. Analyze ALL ${detectedPetCount} pets for a royal portrait.

For EACH pet, provide:
1. SPECIES: [DOG], [CAT], [BIRD], [RABBIT], [HAMSTER], [GUINEA PIG], [REPTILE], [FERRET], [TURTLE], [HORSE], [PONY], [DONKEY], [GOAT], [PIG], [LLAMA], [ALPACA], [RAT], or [EXOTIC]
2. BREED: Specific breed/variety or "Mixed" (for horses: Arabian, Quarter Horse, Thoroughbred, etc.)
3. SIZE & BUILD: Size (tiny/small/medium/large/giant/massive) + body type (petite, compact, stocky, athletic, muscular, slender, lanky, fluffy, barrel-chested, leggy, chunky, powerful)
4. COLORS: Fur color, markings, patterns
5. FACE: Eye color, distinctive features
6. BODY: Notable proportions (long body, short legs, broad chest, big paws, etc.)
7. UNIQUE: 2-3 distinctive features that make THIS specific pet recognizable

Format your response EXACTLY like this:
${petSections}
---TOGETHER---
Brief description of how they look together, noting their relative sizes and positions.`,
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
        max_tokens: 2000,  // Increased for more pets
        temperature: 0.2,
      });
      
      const multiPetResponse = multiPetVisionResponse.choices[0]?.message?.content || "";
      console.log("Multi-pet vision response:", multiPetResponse.substring(0, 800));
      
      // Parse the multi-pet response for each pet
      for (let i = 1; i <= detectedPetCount; i++) {
        const nextPetMarker = i < detectedPetCount ? `---PET ${i + 1}---` : "---TOGETHER---";
        const petRegex = new RegExp(`---PET ${i}---\\s*([\\s\\S]*?)(?=${nextPetMarker}|$)`, 'i');
        const petMatch = multiPetResponse.match(petRegex);
        const description = petMatch ? petMatch[1].trim() : "a beloved pet";
        petDescriptions.push(description);
        
        // Extract species (expanded list for exotic pets)
        const speciesMatch = description.match(/\[(DOG|CAT|BIRD|FISH|RABBIT|HAMSTER|GUINEA PIG|REPTILE|FERRET|TURTLE|HORSE|PONY|DONKEY|GOAT|PIG|LLAMA|ALPACA|RAT|EXOTIC)\]/i);
        const species = speciesMatch ? speciesMatch[1].toUpperCase() : 
                   description.toLowerCase().includes("dog") ? "DOG" : 
                   description.toLowerCase().includes("cat") ? "CAT" : "PET";
        petSpecies.push(species);
        
        console.log(`🐾 Pet ${i}: ${species} - ${description.substring(0, 100)}`);
      }
      
      const togetherMatch = multiPetResponse.match(/---TOGETHER---\s*([\s\S]*?)$/i);
      multiPetCombinedDescription = togetherMatch ? togetherMatch[1].trim() : "";
      console.log(`🐾 Together: ${multiPetCombinedDescription}`);
      
      // Set legacy variables for backwards compatibility
      petDescription1 = petDescriptions[0] || "";
      petDescription2 = petDescriptions[1] || "";
      species1 = petSpecies[0] || "";
      species2 = petSpecies[1] || "";
      
      console.log(`Multi-pet vision analysis took ${Date.now() - visionStartTime}ms`);
    } else {
      // SINGLE PET MODE: Original flow
      console.log("Analyzing single pet with GPT-4o (optimized prompt)...");
    
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // Use mini for faster analysis - still accurate for pet identification
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this pet photo with EXTREME PRECISION for identity preservation. The goal is to capture THIS EXACT pet's unique appearance so it can be recreated perfectly.

SUPPORTED SPECIES (use these exact tags):
[DOG], [CAT], [BIRD], [FISH], [RABBIT], [HAMSTER], [GUINEA PIG], [REPTILE], [FERRET], [TURTLE], [HORSE], [PONY], [DONKEY], [GOAT], [PIG], [LLAMA], [ALPACA], [RAT], [EXOTIC]

Provide an EXTREMELY DETAILED description focusing on what makes THIS SPECIFIC pet unique:

1. SPECIES & BREED: [SPECIES] - Breed/variety or "Mixed" (confidence: HIGH/MEDIUM/LOW)

2. FACE GEOMETRY (CRITICAL - be extremely precise):
   - HEAD SHAPE: Round, oval, triangular, square, heart-shaped? How wide vs long?
   - SNOUT/MUZZLE: Length (short/medium/long), width, shape (pointed, blunt, flat)
   - FOREHEAD: Flat, domed, sloped? Prominent or subtle?
   - CHEEKS: Full/puffy, hollow, angular, rounded?
   - CHIN: Prominent, recessed, pointed, rounded?
   - JAW LINE: Sharp, soft, wide, narrow?

3. EYES (CRITICAL - be extremely precise):
   - COLOR: Exact shade (golden-yellow, amber, emerald green, copper, etc.)
   - SHAPE: Round, almond, oval, hooded? How open or squinted?
   - SIZE: Large, medium, small relative to face?
   - SPACING: Wide-set, close-set, or average?
   - TILT: Upward slant, downward, straight?
   - EXPRESSION: Alert, sleepy, curious, intense?

4. EARS:
   - SIZE: Large, medium, small relative to head?
   - SHAPE: Pointed, rounded, folded, tufted?
   - POSITION: High-set, low-set, wide apart, close together?
   - ANGLE: Upright, tilted forward, tilted back, sideways?

5. NOSE:
   - SIZE: Large, medium, small relative to face?
   - SHAPE: Wide, narrow, button, triangular?
   - COLOR: Pink, black, brown, multicolored?

6. BODY & BUILD:
   - SIZE: Tiny/small/medium/large/giant
   - BUILD: Petite, compact, stocky, athletic, muscular, slender, fluffy, chunky
   - PROPORTIONS: Long body, short legs, barrel-chested, leggy, etc.

7. COAT:
   - COLOR: Primary and secondary colors with EXACT shades
   - PATTERN: Solid, tabby, tuxedo, calico, pointed, etc.
   - MARKINGS: Specific locations of any markings, patches, or patterns
   - TEXTURE: Short, medium, long, fluffy, sleek, wiry, double-coat?

8. UNIQUE IDENTIFIERS (CRITICAL - be extremely detailed):
   - List 5-7 specific features that would let you identify THIS pet in a crowd of similar pets
   - Include: asymmetrical markings, unique fur patterns, distinctive scars or marks, unusual proportions, one-of-a-kind features
   - Be specific about locations: "small white spot above right eye", "crooked tail tip", "one ear slightly droopy", "distinctive swirl pattern on chest"
   - Note any facial asymmetry: "left eye slightly larger", "nose slightly off-center", "one cheek fuller than the other"
   - Capture individual quirks: "distinctive wrinkle pattern", "unique cowlick", "unusual fur direction", "one paw slightly different color"

Format your response as a detailed paragraph that could be used to recreate this EXACT pet's appearance. Focus on what makes THIS pet unique and distinguishable from others of the same breed.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high",  // Use HIGH detail for accurate facial feature capture
              },
            },
          ],
        },
      ],
      max_tokens: 1200,  // Increased for detailed facial analysis
      temperature: 0.1,
    });
    
    console.log(`Vision analysis took ${Date.now() - visionStartTime}ms`);
    
    // For single pet mode, set the petDescription from visionResponse
    petDescription1 = visionResponse.choices[0]?.message?.content || "a beloved pet";
    }
    
    // Use petDescription1 for single pet mode (backwards compatible)
    let petDescription = isMultiPet ? petDescription1 : petDescription1;

    // Log vision analysis output for debugging
    console.log("=== VISION ANALYSIS OUTPUT ===");
    console.log("Raw description length:", petDescription.length);
    console.log("Raw description preview:", petDescription.substring(0, 200));
    
    // Validate description quality
    if (petDescription.length < 100) {
      console.warn("⚠️ Vision description is too short - may lack detail");
    }
    if (!petDescription.toLowerCase().includes("unique") && !petDescription.toLowerCase().includes("distinctive")) {
      console.warn("⚠️ Vision description may lack unique features");
    }

    // Sanitize description to remove problematic characters that might fail Supabase pattern validation
    // Keep most characters but remove emojis and problematic unicode
    petDescription = petDescription
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Remove misc symbols  
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Remove dingbats
      .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Keep printable ASCII + common unicode (but not control chars)
      .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
      .replace(/\n{3,}/g, '\n\n') // Limit consecutive newlines
      .trim();

    // Ensure we have a valid description (not empty after sanitization)
    if (!petDescription || petDescription.length < 10) {
      petDescription = "a beloved pet with distinctive features";
      console.warn("Pet description was too short after sanitization, using fallback");
    }

    // Log for debugging
    console.log("Pet description from vision (sanitized):", petDescription);
    console.log("Description length:", petDescription.length);
    console.log("Description quality check:", {
      hasUniqueFeatures: petDescription.toLowerCase().includes("unique") || petDescription.toLowerCase().includes("distinctive"),
      hasColorDetails: petDescription.toLowerCase().includes("color") || petDescription.toLowerCase().includes("marking"),
      hasFaceDetails: petDescription.toLowerCase().includes("face") || petDescription.toLowerCase().includes("eye"),
      length: petDescription.length,
    });

    // Extract species from the description (format: [DOG], [CAT], etc.)
    const speciesMatch = petDescription.match(/\[(DOG|CAT|BIRD|FISH|RABBIT|HAMSTER|GUINEA PIG|REPTILE|FERRET|TURTLE|HORSE|PONY|DONKEY|GOAT|PIG|LLAMA|ALPACA|RAT|EXOTIC|PET)\]/i);
    let species = speciesMatch ? speciesMatch[1].toUpperCase() : "";
    
    // Extract age/stage from the description
    const ageMatch = petDescription.match(/AGE:\s*(PUPPY|KITTEN|ADULT)/i);
    let ageStage = ageMatch ? ageMatch[1].toUpperCase() : "";
    
    // Fallback: search for age keywords if explicit format wasn't found
    if (!ageStage) {
      const lowerDesc = petDescription.toLowerCase();
      if (lowerDesc.includes("puppy") || lowerDesc.includes("young dog")) {
        ageStage = "PUPPY";
      } else if (lowerDesc.includes("kitten") || lowerDesc.includes("young cat")) {
        ageStage = "KITTEN";
      } else {
        ageStage = "ADULT"; // Default to adult if not specified
      }
    }
    
    // Fallback: search for species keywords if bracket format wasn't found
    if (!species) {
      const lowerDesc = petDescription.toLowerCase();
      if (lowerDesc.includes("dog") || lowerDesc.includes("puppy") || lowerDesc.includes("canine")) {
        species = "DOG";
      } else if (lowerDesc.includes("cat") || lowerDesc.includes("kitten") || lowerDesc.includes("feline")) {
        species = "CAT";
      } else if (lowerDesc.includes("bird") || lowerDesc.includes("parrot") || lowerDesc.includes("parakeet") || lowerDesc.includes("cockatiel") || lowerDesc.includes("budgie")) {
        species = "BIRD";
      } else if (lowerDesc.includes("fish") || lowerDesc.includes("goldfish") || lowerDesc.includes("betta") || lowerDesc.includes("aquatic")) {
        species = "FISH";
      } else if (lowerDesc.includes("rabbit") || lowerDesc.includes("bunny")) {
        species = "RABBIT";
      } else if (lowerDesc.includes("hamster")) {
        species = "HAMSTER";
      } else if (lowerDesc.includes("guinea pig")) {
        species = "GUINEA PIG";
      } else if (lowerDesc.includes("reptile") || lowerDesc.includes("bearded dragon") || lowerDesc.includes("gecko") || lowerDesc.includes("snake") || lowerDesc.includes("iguana") || lowerDesc.includes("lizard")) {
        species = "REPTILE";
      } else if (lowerDesc.includes("ferret")) {
        species = "FERRET";
      } else if (lowerDesc.includes("turtle") || lowerDesc.includes("tortoise")) {
        species = "TURTLE";
      } else if (lowerDesc.includes("horse") || lowerDesc.includes("mare") || lowerDesc.includes("stallion") || lowerDesc.includes("foal") || lowerDesc.includes("equine")) {
        species = "HORSE";
      } else if (lowerDesc.includes("pony") || lowerDesc.includes("shetland")) {
        species = "PONY";
      } else if (lowerDesc.includes("donkey") || lowerDesc.includes("mule") || lowerDesc.includes("burro")) {
        species = "DONKEY";
      } else if (lowerDesc.includes("goat") || lowerDesc.includes("kid goat") || lowerDesc.includes("billy") || lowerDesc.includes("nanny goat")) {
        species = "GOAT";
      } else if (lowerDesc.includes("pig") || lowerDesc.includes("piglet") || lowerDesc.includes("hog") || lowerDesc.includes("potbelly") || lowerDesc.includes("pot belly")) {
        species = "PIG";
      } else if (lowerDesc.includes("llama")) {
        species = "LLAMA";
      } else if (lowerDesc.includes("alpaca")) {
        species = "ALPACA";
      } else if (lowerDesc.includes("rat") || lowerDesc.includes("mouse")) {
        species = "RAT";
      } else {
        species = "PET";
      }
    }
    
    // CRITICAL: Double-check species detection by analyzing the image description more carefully
    // Count explicit mentions of each species
    const lowerDesc = petDescription.toLowerCase();
    const dogMentions = (lowerDesc.match(/\bdog\b|\bpuppy\b|\bcanine\b/g) || []).length;
    const catMentions = (lowerDesc.match(/\bcat\b|\bkitten\b|\bfeline\b/g) || []).length;
    
    // If there's a clear mismatch, correct it
    if (dogMentions > catMentions && species === "CAT") {
      console.warn("⚠️ CORRECTING: Description has more dog mentions but species was CAT. Changing to DOG.");
      species = "DOG";
    } else if (catMentions > dogMentions && species === "DOG") {
      console.warn("⚠️ CORRECTING: Description has more cat mentions but species was DOG. Changing to CAT.");
      species = "CAT";
    }
    
    // Validate species with a direct image check - helps ensure accuracy for dogs/cats
    // For other species, we trust the initial detection
    const commonSpecies = ["DOG", "CAT"];
    const allValidSpecies = ["DOG", "CAT", "BIRD", "FISH", "RABBIT", "HAMSTER", "GUINEA PIG", "REPTILE", "FERRET", "TURTLE", "HORSE", "PONY", "DONKEY", "GOAT", "PIG", "LLAMA", "ALPACA", "RAT", "EXOTIC"];
    
    if (commonSpecies.includes(species) || !species || species === "PET") {
      console.log("🔍 Performing species validation check for dog/cat...");
      try {
        const speciesValidationCheck = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Look at this image VERY CAREFULLY. What type of pet is this?

Identify the species. Respond with ONLY ONE of these words:
DOG, CAT, BIRD, FISH, RABBIT, HAMSTER, GUINEA PIG, REPTILE, FERRET, TURTLE, HORSE, PONY, DONKEY, GOAT, PIG, LLAMA, ALPACA, RAT, or EXOTIC

Key identification features:
- DOG: Larger snout/muzzle, canine facial structure
- CAT: Compact face, whiskers, feline features
- BIRD: Feathers, beak
- FISH: Scales, fins, aquatic
- RABBIT: Long ears, compact furry body
- HAMSTER: Small, round, short ears
- GUINEA PIG: Larger than hamster, no tail
- REPTILE: Scales (lizard, gecko, snake, bearded dragon)
- FERRET: Long body, small face
- TURTLE: Shell
- HORSE: Large equine, long face, mane
- PONY: Smaller equine, stocky build
- DONKEY: Long ears, equine body
- GOAT: Horns or horn buds, rectangular pupils, beard
- PIG: Snout, curly tail, round body
- LLAMA: Long neck, banana-shaped ears, woolly
- ALPACA: Smaller than llama, fluffy face, woolly
- RAT: Long tail, pointed face
- EXOTIC: Other unique pets

Respond with ONLY the species name.`,
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
          max_tokens: 20,
          temperature: 0,
        });
        const validatedSpeciesRaw = speciesValidationCheck.choices[0]?.message?.content?.trim().toUpperCase().replace(/[^A-Z ]/g, '');
        const validatedSpecies = validatedSpeciesRaw || "";
        
        // Use validation result if it's a recognized species
        if (validatedSpecies && allValidSpecies.includes(validatedSpecies)) {
          if (validatedSpecies !== species) {
            console.log(`🔄 Species updated: ${species || 'unknown'} → ${validatedSpecies}`);
            species = validatedSpecies;
          } else {
            console.log(`✅ Species validation confirmed: ${species}`);
          }
        } else if (!species || species === "PET") {
          // Default to the validation result even if not in our list
          if (validatedSpecies) {
            species = validatedSpecies;
            console.log(`✅ Species set via validation: ${species}`);
          }
        }
      } catch (validationError) {
        console.error("⚠️ Species validation check failed:", validationError);
        // Continue with detected species
        if (!species || species === "PET") {
          species = "PET"; // Default to generic PET if we can't determine
          console.warn("⚠️ Unable to determine exact species, using generic PET");
        }
      }
    } else {
      console.log(`✅ Non-dog/cat species detected, skipping validation: ${species}`);
    }
    
    // Final species check - allow any detected species
    if (!species) {
      species = "PET";
      console.warn("⚠️ No species detected, defaulting to PET");
    }
    
    // Log for all species types
    if (!allValidSpecies.includes(species) && species !== "PET") {
      console.log(`ℹ️ Unique species detected: ${species}. Proceeding with portrait generation.`);
    }
    
    console.log("Detected age/stage:", ageStage);
    if (ageStage === "PUPPY" || ageStage === "KITTEN") {
      console.log(`✨ Age preservation enabled: Will preserve ${ageStage} features`);
    }
    
    // Create STRONGER negative species instruction with multiple repetitions
    // Species-specific enforcement message
    const speciesEnforcement: Record<string, string> = {
      "DOG": "CRITICAL: This is a DOG. DO NOT generate a cat or any other animal. This MUST be a DOG.",
      "CAT": "CRITICAL: This is a CAT. DO NOT generate a dog or any other animal. This MUST be a CAT.",
      "BIRD": "CRITICAL: This is a BIRD. Preserve feathers and beak. DO NOT generate a mammal.",
      "FISH": "CRITICAL: This is a FISH. Preserve fins and scales. Keep aquatic appearance.",
      "RABBIT": "CRITICAL: This is a RABBIT. Preserve long ears and bunny features.",
      "HAMSTER": "CRITICAL: This is a HAMSTER. Preserve small, round body and short ears.",
      "GUINEA PIG": "CRITICAL: This is a GUINEA PIG. Preserve rounded body without tail.",
      "REPTILE": "CRITICAL: This is a REPTILE. Preserve scales and reptilian features.",
      "FERRET": "CRITICAL: This is a FERRET. Preserve long body and small face.",
      "TURTLE": "CRITICAL: This is a TURTLE. Preserve shell and reptilian features.",
      "HORSE": "CRITICAL: This is a HORSE. Preserve equine features, long face, mane, and proportions. Show full majestic body.",
      "PONY": "CRITICAL: This is a PONY. Preserve smaller equine features, stocky build. Show full body.",
      "DONKEY": "CRITICAL: This is a DONKEY. Preserve long ears, equine body. Show full body.",
      "GOAT": "CRITICAL: This is a GOAT. Preserve horns/horn buds, rectangular pupils, beard if present.",
      "PIG": "CRITICAL: This is a PIG. Preserve snout, round body, curly tail.",
      "LLAMA": "CRITICAL: This is a LLAMA. Preserve long neck, banana-shaped ears, woolly coat. Show full body.",
      "ALPACA": "CRITICAL: This is an ALPACA. Preserve fluffy face, woolly coat, smaller than llama. Show full body.",
      "RAT": "CRITICAL: This is a RAT. Preserve pointed face and long tail.",
    };
    const notSpecies = speciesEnforcement[species] || `CRITICAL: This is a ${species}. DO NOT generate any other animal. Generate ONLY a ${species}.`;
    
    console.log("=== SPECIES DETECTION ===");
    console.log("Detected species:", species);
    console.log("Species enforcement:", notSpecies);
    console.log("Pet description analysis:", {
      containsDog: petDescription.toLowerCase().includes("dog") || petDescription.toLowerCase().includes("puppy"),
      containsCat: petDescription.toLowerCase().includes("cat") || petDescription.toLowerCase().includes("kitten"),
      dogMentions,
      catMentions,
      speciesMatch: speciesMatch ? speciesMatch[1] : "none",
    });
    
    // Verify species detection is correct
    if (species === "DOG" && (petDescription.toLowerCase().includes("cat") || petDescription.toLowerCase().includes("kitten"))) {
      console.warn("⚠️ WARNING: Species mismatch detected! Description mentions cat but species is DOG");
    }
    if (species === "CAT" && (petDescription.toLowerCase().includes("dog") || petDescription.toLowerCase().includes("puppy"))) {
      console.warn("⚠️ WARNING: Species mismatch detected! Description mentions dog but species is CAT");
    }

    // Extract breed from description for facial structure analysis
    const breedMatch = petDescription.match(/BREED:\s*([^.(\n]+)/i);
    const detectedBreed = breedMatch ? breedMatch[1].trim() : "";
    console.log("Detected breed:", detectedBreed || "Unknown");
    
    // Get random pose and palette early - needed for prompt generation
    const selectedPose = getRandomNaturalPose();
    const selectedPalette = getRandomPalette();
    console.log(`🎨 Selected pose: ${selectedPose.name}`);
    console.log(`🎨 Selected palette: ${selectedPalette.name} (${selectedPalette.mood})`);

    // Step 1.5: Perform detailed facial structure analysis (ENABLED by default for identity accuracy)
    // Disable with DISABLE_FACIAL_ANALYSIS=true if speed is more important than accuracy
    let facialStructureAnalysis = "";
    const disableFacialAnalysis = process.env.DISABLE_FACIAL_ANALYSIS === "true";
    
    if (!disableFacialAnalysis) {
      console.log("🔬 Performing detailed facial structure analysis for identity accuracy...");
      try {
        facialStructureAnalysis = await analyzeFacialStructure(openai, base64Image, species, detectedBreed);
        console.log("✅ Facial structure analysis complete");
      } catch (facialError) {
        console.error("⚠️ Facial structure analysis failed, continuing without it:", facialError);
      }
    } else {
      console.log("⏭️ Skipping facial structure analysis (disabled via env)");
    }

    // Randomize elements for unique paintings - SIGNIFICANTLY EXPANDED for maximum variety
    const cushions = [
      // Original elegant tones
      "ORNATE SOFT SAGE GREEN velvet throne cushion with RICH intricate gold embroidery patterns, BRIGHT decorative gold tassels at corners, detailed ornate gold threadwork, luxurious thick velvet texture, visible fabric folds, elaborate decorative details",
      "ORNATE SOFT PERIWINKLE BLUE velvet throne cushion with RICH intricate gold thread embroidery, BRIGHT decorative gold tassels, detailed ornate patterns, rich plush texture, elaborate ornate details",
      "ORNATE WARM TAUPE velvet throne cushion with RICH elegant gold embroidery patterns, BRIGHT gold tassels, detailed ornate gold threadwork, sumptuous velvety texture, elaborate classical styling",
      "ORNATE MUTED EMERALD GREEN velvet cushion with RICH gold braided trim, BRIGHT ornate gold tassels, detailed intricate patterns, thick luxurious fabric, elaborate visible texture",
      "ORNATE DUSTY BLUE velvet throne cushion with RICH antique gold embroidery, BRIGHT decorative gold tassels at corners, detailed ornate patterns, plush royal texture, elaborate details",
      "ORNATE SOFT GREY velvet cushion with RICH gold thread patterns, BRIGHT ornate gold tassels, detailed intricate embroidery, thick velvety surface, elaborate classical details",
      "ORNATE SAGE GREEN velvet throne cushion with RICH intricate gold embroidery, BRIGHT gold tassels, detailed ornate patterns, luxurious deep pile, elaborate ornate styling",
      "ORNATE SOFT SAPPHIRE velvet cushion with RICH antique gold decorative embroidery, BRIGHT gold tassels, detailed ornate patterns, rich thick velvet, elaborate sumptuous texture",
      // Rich jewel tones
      "ORNATE DEEP RUBY RED velvet throne cushion with RICH silver thread embroidery, BRIGHT silver tassels, intricate baroque patterns, plush luxurious texture, regal commanding presence",
      "ORNATE ROYAL PURPLE velvet throne cushion with RICH gold damask patterns, ornate gold fringe trim, sumptuous imperial purple, thick velvet pile, elaborate royal details",
      "ORNATE MIDNIGHT NAVY velvet cushion with RICH gold fleur-de-lis embroidery, BRIGHT gold tassels, deep nautical blue, luxurious texture, aristocratic elegance",
      "ORNATE BURNT SIENNA velvet throne cushion with RICH copper thread embroidery, warm autumn tones, copper tassels, earthy luxury, Renaissance-inspired details",
      // Soft pastels
      "ORNATE BLUSH PINK velvet throne cushion with DELICATE rose gold embroidery, soft feminine tones, rose gold tassels, romantic pastel luxury, refined texture",
      "ORNATE POWDER BLUE velvet cushion with RICH silver thread detailing, soft dreamy blue, silver tassels, ethereal texture, gentle aristocratic elegance",
      "ORNATE SOFT CORAL velvet throne cushion with GOLD sunset-inspired embroidery, warm peachy coral, gold tassels, tropical warmth, luxurious comfort",
      "ORNATE CHAMPAGNE IVORY velvet cushion with RICH gold thread patterns, soft cream tones, gold tassels, elegant neutrality, timeless sophistication",
      // Bold contrasts
      "ORNATE JET BLACK velvet throne cushion with RICH gold baroque embroidery, dramatic contrast, gold tassels, mysterious depth, commanding presence",
      "ORNATE HUNTER GREEN velvet cushion with RICH bronze thread patterns, deep forest tones, bronze tassels, natural elegance, woodland nobility",
      "ORNATE TEAL velvet throne cushion with RICH gold Art Nouveau embroidery, vibrant blue-green, gold tassels, artistic flair, distinctive luxury",
      "ORNATE PLUM velvet cushion with RICH silver damask patterns, deep purple-red, silver tassels, wine-dark luxury, opulent texture",
      // Unique textures
      "ORNATE DUSTY MAUVE brocade throne cushion with WOVEN gold thread patterns, textured damask weave, gold tassels, antique charm, heirloom quality",
      "ORNATE STEEL BLUE silk cushion with EMBROIDERED silver dragons and clouds, Eastern-inspired luxury, silver tassels, exotic elegance, worldly sophistication",
      "ORNATE TERRACOTTA velvet throne cushion with RICH gold Moorish geometric patterns, warm Mediterranean tones, gold tassels, architectural elegance",
      "ORNATE SEAFOAM GREEN velvet cushion with RICH pearl and shell embroidery, oceanic elegance, pearl tassels, maritime luxury, coastal nobility"
    ];
    
    const robes = [
      // Original elegant options
      "DAINTY SOFT SAPPHIRE BLUE velvet cloak with delicate gold thread embroidery patterns, soft plush velvety texture with visible nap, ermine-style PURE BRIGHT WHITE fur trim with black spots, draped delicately over body, dainty refined luxurious velvet fabric with realistic folds",
      "DAINTY DUSTY ROSE velvet cloak with intricate delicate gold thread patterns, soft plush velvety texture, PURE WHITE ermine fur trim, dainty refined fabric draped over body and cushion, visible velvety texture and soft folds",
      "DAINTY CREAM WHITE velvet cloak with delicate ornate gold embroidery, soft plush velvety texture with visible nap, ermine-style PURE BRIGHT WHITE fur trim with black spots, dainty sumptuous velvet fabric draped naturally",
      "DAINTY SOFT PERIWINKLE BLUE velvet cloak with delicate gold thread detailing, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty refined velvet fabric with dramatic draping, realistic soft folds",
      "DAINTY MUTED BURGUNDY velvet cloak with delicate antique gold thread patterns, soft plush velvety texture with visible nap, PURE WHITE ermine fur trim, dainty luxurious velvet fabric draped over body",
      "DAINTY IVORY CREAM velvet cloak with delicate elaborate gold embroidery, soft plush velvety texture, ermine-style PURE BRIGHT WHITE fur trim, dainty refined velvet fabric with natural draping and soft folds",
      "DAINTY SAGE GREEN velvet cloak with delicate gold thread embroidery, soft plush velvety texture with visible nap, PURE BRIGHT WHITE ermine fur trim with black spots, dainty sumptuous velvet fabric draped dramatically",
      "DAINTY DUSTY CORAL velvet cloak with delicate intricate gold patterns, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty luxurious velvet fabric with realistic soft draping",
      // Rich jewel tones
      "LUXURIOUS DEEP EMERALD GREEN velvet cloak with silver thread Celtic knot embroidery, soft plush texture, PURE WHITE Arctic fox fur trim, dramatic aristocratic draping with elegant folds",
      "REGAL ROYAL PURPLE velvet cloak with gold fleur-de-lis embroidery throughout, rich imperial texture, PURE WHITE ermine fur trim with black spots, majestic commanding presence",
      "OPULENT RUBY RED velvet cloak with intricate gold Baroque scrollwork, sumptuous texture, PURE BRIGHT WHITE ermine fur trim, passionate dramatic elegance with deep folds",
      "DISTINGUISHED MIDNIGHT NAVY velvet cloak with silver star and moon embroidery, deep celestial blue, PURE WHITE fur trim, mysterious nocturnal elegance",
      // Metallic and shimmer
      "SHIMMERING GOLD BROCADE cloak with woven metallic threads, rich texture catching light, PURE WHITE ermine fur trim, sunlit warmth and opulence, draped with natural folds",
      "LUSTROUS SILVER-GREY velvet cloak with platinum thread detailing, moonlit elegance, PURE BRIGHT WHITE fur trim, sophisticated neutrality with visible texture",
      "BRONZE-TOUCHED COPPER velvet cloak with gold autumn leaf embroidery, warm sunset tones, CREAM WHITE fur trim, earthy nobility with soft draping",
      // Pastels and soft tones
      "DELICATE MINT GREEN velvet cloak with silver botanical embroidery, fresh spring tones, PURE WHITE fur trim, garden party elegance with gentle folds",
      "SOFT LAVENDER velvet cloak with gold butterfly and flower embroidery, gentle purple hues, PURE BRIGHT WHITE ermine fur trim, romantic whimsy",
      "WARM APRICOT velvet cloak with copper thread sunrise patterns, soft peachy tones, CREAM WHITE fur trim, golden hour warmth",
      "PALE SEAFOAM velvet cloak with pearl and shell embroidery, oceanic softness, PURE WHITE fur trim, coastal aristocracy",
      // Bold and dramatic
      "DRAMATIC JET BLACK velvet cloak with gold constellation embroidery, mysterious depth, PURE BRIGHT WHITE ermine fur trim with black spots, striking contrast",
      "RICH CHOCOLATE BROWN velvet cloak with gold oak leaf patterns, warm espresso tones, CREAM WHITE fur trim, woodland sophistication",
      "DEEP TEAL velvet cloak with gold Art Deco geometric patterns, vibrant blue-green, PURE WHITE fur trim, artistic modernist elegance",
      "WINE PLUM velvet cloak with silver grape vine embroidery, deep burgundy-purple, PURE BRIGHT WHITE fur trim, vineyard nobility",
      // Exotic and unique
      "PEACOCK BLUE velvet cloak with iridescent feather-inspired embroidery, exotic shimmer, PURE WHITE fur trim, magnificent display",
      "BURNT ORANGE velvet cloak with gold phoenix embroidery, fiery sunset warmth, CREAM WHITE fur trim, bold renaissance spirit",
      "FOREST HUNTER GREEN velvet cloak with bronze oak and acorn patterns, deep woodland tones, CREAM fur trim, noble outdoorsman elegance",
      "ANTIQUE ROSE velvet cloak with vintage gold filigree patterns, aged romantic pink, PURE BRIGHT WHITE ermine fur trim, nostalgic charm"
    ];
    
    const jewelry = [
      // ULTRA-BRIGHT MULTI-GEM STATEMENT PIECES - MAXIMUM VIBRANCY AND SPARKLE
      "DAZZLING ULTRA-BRIGHT antique gold multi-chain necklace with BLAZING BRILLIANT gem clusters (NEON-BRIGHT ruby, ELECTRIC-GREEN emerald, GLOWING amethyst, SUNBURST topaz), GLEAMING gold filigree CATCHING LIGHT, RADIANT pearls, CROWN JEWEL brilliance, BLINDING sparkle",
      "LUMINOUS SPECTACULAR antique gold necklace with ULTRA-SATURATED GLOWING gems (LASER-BRIGHT ruby red, NEON emerald green, ELECTRIC amethyst purple, BLAZING topaz gold), MIRROR-FINISH gold filigree, RADIANT SPARKLING pearls, BLINDING BRIGHTNESS",
      "RADIANT ULTRA-BRIGHT antique gold necklace with BLAZING gem clusters (FIRE-BRIGHT topaz, NEON ruby, ELECTRIC emerald), GLEAMING gold filigree with LIGHT-CATCHING scrollwork, LUMINOUS pearls, MAXIMUM SPARKLE and SHINE",
      "SPECTACULAR DAZZLING antique gold necklace with GLOWING VIBRANT gems (ELECTRIC amethyst, BLAZING ruby, NEON topaz, RADIANT emerald), BRIGHT gold filigree with LIGHT REFLECTIONS, SPARKLING pearls, ULTRA-BRIGHT BRILLIANCE",
      "BLAZING MAGNIFICENT gold necklace with NEON-BRIGHT gems (ELECTRIC ruby, GLOWING emerald, RADIANT amethyst), MIRROR-SHINE gold chains, LUMINOUS pearl accents, ULTRA-SATURATED colors, MAXIMUM BRIGHTNESS",
      "GLOWING SPECTACULAR antique gold necklace with ULTRA-BRIGHT SATURATED gems (LASER-RED ruby, NEON-GREEN emerald, ELECTRIC-PURPLE amethyst, BLAZING-YELLOW topaz), GLEAMING filigree, RADIANT pearls, BLINDING SPARKLE",
      "LUMINOUS DAZZLING antique gold necklace with BRIGHT GLOWING gems (ELECTRIC ruby, NEON amethyst, BLAZING emerald, RADIANT topaz), LIGHT-CATCHING gold patterns, SPARKLING pearls, ULTRA-VIBRANT colors, MAXIMUM SHINE",
      "SPECTACULAR ULTRA-BRIGHT gold necklace with NEON gem clusters (BLAZING EMERALD, ELECTRIC ruby, GLOWING topaz, RADIANT amethyst), GLEAMING gold filigree, LUMINOUS pearls, BLINDING BRILLIANCE",
      // SINGLE STATEMENT GEMS - MAXIMUM GLOW AND RADIANCE
      "BLAZING SPECTACULAR antique gold necklace with EXTRA LARGE NEON SAPPHIRE that GLOWS with inner light, surrounded by SPARKLING diamonds, ELECTRIC BLUE RADIANCE, LIGHT-CATCHING gold setting, BLINDING brilliance",
      "LUMINOUS ULTRA-BRIGHT antique gold necklace with EXTRA LARGE GLOWING EMERALD pendant, NEON-GREEN inner fire, surrounded by RADIANT pearls, BLAZING brilliance that CATCHES ALL LIGHT",
      "SPECTACULAR DAZZLING antique gold necklace with EXTRA LARGE NEON RUBY pendant, ELECTRIC-RED GLOW, framed in GLEAMING gold filigree, BLINDING radiance, LIGHT-CATCHING fire",
      "RADIANT BLAZING antique gold necklace with EXTRA LARGE GLOWING AMETHYST, ELECTRIC-PURPLE inner light, surrounded by LUMINOUS pearls, NEON brilliance, MAXIMUM SPARKLE",
      // PEARL-FOCUSED - MAXIMUM IRIDESCENCE AND GLOW
      "LUMINOUS SPECTACULAR triple-strand GLOWING PEARL necklace with GLEAMING gold clasp, BLAZING ruby accent, RAINBOW IRIDESCENCE on every pearl, LIGHT-CATCHING shimmer, ULTRA-BRIGHT elegance",
      "RADIANT DAZZLING graduated GLOWING PEARL necklace with BRIGHT gold and NEON EMERALD clasp, IRIDESCENT pearls with RAINBOW FIRE, MAXIMUM LUSTRE, LIGHT-CATCHING beauty",
      "SPECTACULAR ULTRA-BRIGHT GLOWING PEARL choker with GLEAMING gold Art Nouveau setting, RAINBOW-FIRE iridescence, NEON overtones (pink, blue, green, gold), BLINDING SHIMMER",
      "LUMINOUS BLAZING antique gold necklace with LARGE GLOWING PEARL centerpiece, RAINBOW IRIDESCENCE, surrounded by SPARKLING sapphires, ELECTRIC elegance, MAXIMUM BRIGHTNESS",
      // SILVER/PLATINUM - MAXIMUM SPARKLE AND SHINE
      "DAZZLING ULTRA-BRIGHT antique SILVER necklace with GLOWING MOONSTONE, BLAZING RAINBOW FIRE, ELECTRIC opalescent shimmer, NEON inner light, LIGHT-CATCHING brilliance",
      "SPECTACULAR LUMINOUS antique SILVER necklace with NEON AQUAMARINES and BLAZING diamonds, ELECTRIC ICY-BLUE glow, MAXIMUM SPARKLE, BLINDING winter brilliance",
      "RADIANT DAZZLING SILVER choker with GLOWING OPAL showing NEON RAINBOW FIRE, ELECTRIC mystery, BLAZING iridescence, ULTRA-BRIGHT ethereal shimmer",
      // UNIQUE GEMS - MAXIMUM VIBRANCY
      "LUMINOUS SPECTACULAR gold necklace with NEON TURQUOISE and GLOWING CORAL, BLAZING warm tones, ELECTRIC vibrancy, ULTRA-SATURATED colors, MAXIMUM BRIGHTNESS",
      "DAZZLING ULTRA-BRIGHT gold necklace with GLOWING GARNET cluster, NEON WINE-RED fire, surrounded by RADIANT pearls, ELECTRIC warmth, BLINDING brilliance",
      "SPECTACULAR LUMINOUS gold necklace with NEON PERIDOT and BLAZING diamonds, ELECTRIC LIME-GREEN glow, RADIANT sparkle, ULTRA-BRIGHT spring fire",
      "RADIANT GLOWING gold necklace with NEON CITRINE sunburst, BLAZING GOLDEN-AMBER light, ELECTRIC warmth, MAXIMUM SUNSHINE brilliance",
      // LAYERED - MAXIMUM OPULENCE AND SPARKLE
      "SPECTACULAR ULTRA-BRIGHT gold BIB NECKLACE with CASCADING NEON gems, GLOWING pearls, BLAZING colors, ELECTRIC radiance, MULTIPLE LAYERS of BLINDING BRILLIANCE, CROWN JEWEL opulence",
      "LUMINOUS DAZZLING gold COLLAR necklace with ALTERNATING NEON rubies and BLAZING diamonds, ELECTRIC fire, ULTRA-BRIGHT commanding presence, MAXIMUM SPARKLE",
      "RADIANT SPECTACULAR THREE-TIER gold necklace with GLOWING pearls, NEON small gems, BLAZING large gems, ELECTRIC layered luxury, BLINDING brilliance",
      // CAMEO AND VINTAGE - WITH BRIGHT ACCENTS
      "LUMINOUS SPECTACULAR antique gold necklace with ORNATE CAMEO pendant, NEON gem accents, GLEAMING gold frame, RADIANT classical beauty, ULTRA-BRIGHT vintage charm",
      "DAZZLING RADIANT antique gold locket with BLAZING diamond and GLOWING pearl, NEON accents, ELECTRIC elegance, MAXIMUM BRIGHTNESS",
      // BOLD AND DRAMATIC - MAXIMUM IMPACT
      "SPECTACULAR ULTRA-BRIGHT gold necklace with EXTRA LARGE MEDALLION, NEON rubies surrounding, BLAZING royal heraldry, ELECTRIC commanding presence, BLINDING CROWN JEWEL brilliance",
      "LUMINOUS DAZZLING antique gold necklace with GLOWING BLACK ONYX and NEON diamonds, ELECTRIC contrast, BLAZING mystery, ULTRA-BRIGHT sophistication",
      // NEW ULTRA-BRIGHT ADDITIONS
      "RADIANT SPECTACULAR gold necklace with CASCADING NEON gems (BLAZING ruby, ELECTRIC emerald, GLOWING sapphire, NEON amethyst, RADIANT topaz), ULTRA-BRIGHT waterfall, BLINDING brilliance",
      "LUMINOUS DAZZLING gold necklace with LARGE NEON DIAMOND centerpiece, GLOWING gem halo, BLAZING colors, ELECTRIC radiance, CROWN JEWEL brilliance, MAXIMUM SPARKLE",
      "EXTRAVAGANT ELABORATE antique gold necklace with CLUSTER of BRILLIANT STAR SAPPHIRES showing ASTERISM, SURROUNDED by SPARKLING diamonds, EXTREMELY ORNATE celestial theme, MYSTICAL VIBRANT beauty",
      "MAGNIFICENT ORNATE gold necklace with LARGE BRILLIANT ALEXANDRITE pendant that CHANGES COLOR (green to red), SURROUNDED by SPARKLING diamonds, EXTREMELY RARE VIBRANT gem, EXTREMELY ORNATE unique beauty",
      "STUNNING EXTRAVAGANT antique gold necklace with MULTIPLE LAYERS of BRILLIANT gems (RUBY, EMERALD, SAPPHIRE) ALTERNATING with LUSTROUS pearls, ELABORATE baroque goldwork, EXTREMELY ORNATE cascading design, REGAL opulence"
    ];
    
    const backgrounds = [
      // Original warm neutral tones
      "SPACIOUS grand chamber background with DEPTH, soft gradient from WARM TAUPE to SOFT BROWN with atmospheric perspective, large DUSTY ROSE velvet drapery hanging behind with visible folds, BRIGHTER pastel-leaning tones, elegant and airy NOT gloomy",
      "DEEP SPACIOUS room background with sense of grand chamber, warm SOFT TAUPE to MUTED CARAMEL gradient, heavy SOFT BURGUNDY velvet brocade draped behind with rich texture, BRIGHTER pastel tones, elegant airy atmosphere",
      "grand chamber with ATMOSPHERIC DEPTH, soft WARM BEIGE to TAUPE painterly gradient, large MUTED MAUVE velvet fabric draped behind with visible texture, BRIGHTER color scheme, spacious elegant feel",
      "SPACIOUS background with sense of DEPTH, soft gradient from WARM TAUPE to SOFT OLIVE with atmospheric perspective, heavy SAGE GREEN brocade drapery behind with visible folds, BRIGHTER pastel-leaning jewel tones, airy classical style",
      "DEEP BLACK background creating STRONG CONTRAST with fabrics and jewelry, rich DEEP BLACK velvet drapery hanging behind, dramatic contrast with pet's natural colors and bright fabrics, elegant dramatic atmosphere",
      "ATMOSPHERIC DEPTH background suggesting grand chamber, soft WARM BEIGE to TAUPE to SOFT OLIVE gradient, MUTED LAVENDER velvet drapery behind with visible texture, BRIGHTER elegant pastel tones",
      "DEEP BLACK background with STRONG CONTRAST, rich DEEP BLACK velvet fabric draped behind creating dramatic contrast with bright fabrics and jewelry, elegant dramatic portrait atmosphere",
      "grand chamber with ATMOSPHERIC PERSPECTIVE and DEPTH, soft WARM CARAMEL to TAUPE gradient, large SOFT BURGUNDY brocade drapery with rich folds, BRIGHTER pastel tones, spacious elegant royal atmosphere",
      // Library and study settings
      "GRAND LIBRARY background with ATMOSPHERIC DEPTH, warm wood paneling visible, leather-bound books on shelves, DEEP FOREST GREEN velvet curtain to one side, scholarly aristocratic ambiance, warm lamplight glow",
      "DISTINGUISHED STUDY background, mahogany bookshelves receding into atmospheric shadow, RICH BURGUNDY leather chair arm visible, globe and brass instruments, intellectual nobility",
      // Palace and architectural
      "PALATIAL MARBLE COLUMN background with ATMOSPHERIC DEPTH, Corinthian column partially visible, DEEP CRIMSON silk drapery, grand architecture suggesting palace interior, regal opulence",
      "ORNATE GILDED FRAME background effect, as if portrait within portrait, DEEP NAVY velvet behind, gold rococo frame elements visible, museum gallery presentation",
      "GRAND BALLROOM suggestion in background, crystal chandelier reflections, SOFT GOLD silk drapery, atmospheric candlelit ambiance, festive aristocratic setting",
      // Nature and garden inspired
      "CONSERVATORY background with ATMOSPHERIC DEPTH, suggestion of exotic plants and palms, PEACOCK BLUE silk curtain, Victorian botanical garden elegance, natural light filtering through",
      "ENGLISH GARDEN view through window suggestion, SOFT SAGE GREEN silk drapery framing scene, roses and hedges in soft focus, country estate elegance",
      "AUTUMNAL ESTATE background, warm golden light suggesting harvest season, BURNT SIENNA velvet drapery, falling leaves impression, seasonal warmth",
      // Dramatic and moody
      "DRAMATIC STORM CLOUDS background, atmospheric turbulence suggesting heroic portrait, ROYAL PURPLE velvet drapery, Romantic era drama, theatrical presence",
      "VENETIAN EVENING background, suggestion of canal and architecture through window, DEEP TEAL silk curtain, Italian Renaissance mystery, exotic locale",
      "MOONLIT CHAMBER background, silvery blue atmospheric light, MIDNIGHT BLUE velvet drapery, nocturnal elegance, romantic mystery",
      // Rich jewel-toned
      "LUXURIOUS CHAMBER with EMERALD GREEN damask wallpaper suggestion, GOLD silk drapery, jewel-box richness, saturated aristocratic splendor",
      "REGAL THRONE ROOM suggestion, ROYAL PURPLE and GOLD heraldic elements in background, crown and scepter suggestions, imperial grandeur",
      "SAPPHIRE DRAWING ROOM background, RICH BLUE silk walls suggested, CREAM and GOLD accents, cool elegant sophistication",
      // Light and airy
      "BRIGHT MORNING CHAMBER, soft diffused daylight, SOFT PINK silk drapery, fresh and luminous atmosphere, optimistic elegance",
      "SEASIDE VILLA suggestion, Mediterranean light filtering in, SOFT AQUA silk curtain, coastal aristocratic living, breezy sophistication",
      "SUNLIT ORANGERY background, warm golden afternoon light, SOFT CORAL drapery, citrus and sunshine warmth, garden party elegance",
      // Unique and artistic
      "ARTIST'S STUDIO suggestion, painterly chaos in soft focus behind, OCHRE velvet curtain, creative aristocracy, Bohemian elegance",
      "MUSIC ROOM background, grand piano edge visible in shadow, SOFT ROSE silk drapery, cultured refinement, melodic atmosphere",
      "WINTER PALACE suggestion, frost patterns and icy elegance, SILVER-WHITE silk drapery, cool sophisticated splendor, crystalline beauty",
      // Light and bright colored backgrounds
      "SOFT SKY BLUE background with gentle gradient, LIGHT POWDER BLUE silk drapery, airy celestial atmosphere, bright and uplifting elegant mood",
      "PALE MINT GREEN background with soft atmospheric depth, LIGHT SEAFOAM silk curtain, fresh spring garden elegance, bright cheerful aristocratic setting",
      "LIGHT LAVENDER background with soft dreamy quality, PALE LILAC velvet drapery, romantic whimsical atmosphere, bright feminine elegance",
      "SOFT CREAM background with warm ivory undertones, CHAMPAGNE silk drapery with gold accents, bright luminous chamber, light airy sophistication",
      "PALE PEACH background with warm sunset glow, SOFT CORAL silk curtain, bright Mediterranean warmth, cheerful aristocratic villa feel",
      "LIGHT DUSTY ROSE background with romantic softness, BLUSH PINK velvet drapery, bright feminine boudoir elegance, warm inviting atmosphere",
      // Rich jewel backgrounds (lighter versions)
      "BRIGHT EMERALD GREEN background with rich jewel-tone depth, LIGHT JADE silk drapery, vivid botanical garden elegance, saturated but bright",
      "BRIGHT SAPPHIRE BLUE background with royal depth, LIGHT CERULEAN accents, brilliant aristocratic splendor, jewel-toned brightness",
      "BRIGHT RUBY RED background with passionate warmth, LIGHT CORAL silk highlights, vibrant dramatic elegance, saturated royal chamber",
      "RICH AMBER GOLD background with warm luminosity, LIGHT HONEY silk drapery, bright sun-drenched palace, golden hour warmth",
      // Deep contrasting backgrounds
      "RICH BLACK background with velvety depth, dramatic CONTRAST against bright subject, elegant noir sophistication, theatrical presence",
      "DEEP CHARCOAL background fading to black edges, DRAMATIC contrast with bright fabrics, mysterious elegant atmosphere",
      "DARK FOREST GREEN background with emerald depth, CONTRAST with bright jewels and fabrics, sophisticated woodland nobility",
      "MIDNIGHT NAVY background with deep blue richness, DRAMATIC contrast highlighting bright elements, nocturnal regal elegance",
      // Soft neutral backgrounds
      "SOFT DOVE GRAY background with silvery undertones, LIGHT PEWTER silk drapery, elegant understated sophistication, refined neutral palette",
      "WARM TAUPE background with gentle depth, LIGHT CAMEL silk accents, sophisticated earth-toned elegance, timeless classic atmosphere",
      "PALE SILVER background with cool metallic sheen, PLATINUM silk drapery, bright moonlit elegance, ethereal sophisticated glow",
      // Gray and black backgrounds (more variety)
      "LIGHT GRAY background with soft gradient, SILVER silk drapery, clean sophisticated neutral, bright and elegant atmosphere",
      "MEDIUM GRAY background with subtle texture, PEWTER velvet curtain, understated refined elegance, neutral classic backdrop",
      "SOFT SLATE GRAY background with cool undertones, SILVER-GRAY silk drapery, sophisticated neutral palette, elegant and bright",
      "WARM GRAY background with gentle taupe undertones, LIGHT GRAY velvet drapery, refined neutral sophistication, timeless elegance",
      "COOL GRAY background with silvery sheen, ASH GRAY silk curtain, modern classic neutral, clean sophisticated atmosphere",
      "DEEP CHARCOAL GRAY background with rich depth, dramatic contrast with bright subject, elegant noir sophistication",
      "DEEP BLACK background with velvety richness, STRONG DRAMATIC CONTRAST with bright fabrics and subject, theatrical elegant noir",
      "JET BLACK background with absolute depth, MAXIMUM CONTRAST highlighting bright elements, dramatic sophisticated presence",
      "SOFT BLACK background with subtle gray gradients, elegant dark backdrop contrasting with bright subject, refined drama",
      "MUTED CHARCOAL background fading to black edges, sophisticated dark neutral, bright subject stands out dramatically"
    ];
    
    const lightingDirections = [
      // EXTREMELY BRIGHT and COLORFUL lighting - NOT dark, NOT gloomy
      "BRILLIANT BRIGHT KEY LIGHT flooding subject with WARM GOLDEN illumination, VIBRANT COLORFUL highlights, LUMINOUS RADIANT presence, CHEERFUL and UPLIFTING atmosphere, NO dark shadows, NOT gloomy",
      "EXTREMELY BRIGHT and CHEERFUL lighting, subject GLOWING with WARM LIGHT, VIVID COLORFUL jewel-tone reflections from gems and fabrics, BRIGHT HAPPY atmosphere, NOT dark or moody",
      "INTENSELY BRIGHT WARM lighting bathing subject in GOLDEN RADIANCE, COLORFUL VIBRANT highlights on gems and silver, LUMINOUS cheerful portrait, LIGHT AND AIRY feel",
      "BRILLIANT SUNLIT quality, subject FLOODED WITH BRIGHT WARM LIGHT, VIBRANT colors popping, SPARKLING highlights on silver clasp and jewelry, UPBEAT cheerful atmosphere",
      // Warm colorful bright
      "VERY BRIGHT WARM KEY LIGHT, RICH SATURATED COLORS throughout, GLEAMING silver catching light, VIBRANT jewel tones, RADIANT and CHEERFUL, NOT dark NOT gloomy",
      "EXTREMELY BRIGHT diffused warm light, VIVID COLORFUL palette, subject BATHED IN LUMINOUS GLOW, BRIGHT reflections on polished silver, HAPPY uplifting mood",
      "BRILLIANT GOLDEN HOUR warmth, SATURATED VIBRANT COLORS, SPARKLING highlights everywhere, CHEERFUL BRIGHT atmosphere, RADIANT elegant presence",
      // Bright with color emphasis
      "INTENSELY BRIGHT lighting with RICH COLOR SATURATION, VIVID reds blues greens golds, GLEAMING polished silver, LUMINOUS and VIBRANT, NOT muted NOT dark",
      "VERY BRIGHT COLORFUL illumination, SATURATED jewel tones POP, BRILLIANT white highlights, CHEERFUL RADIANT mood, subject GLOWING with WARM LIGHT",
      // Professional bright colorful
      "PROFESSIONAL BRIGHT LIGHTING with ENHANCED COLOR VIBRANCY, subject PERFECTLY ILLUMINATED, RICH SATURATED palette, SPARKLING silver accents, UPLIFTING atmosphere",
      "STUDIO BRIGHT with WARM FILL, VIVID COLORFUL rendering, NO DARK SHADOWS, BRILLIANT highlights on fur and fabrics, CHEERFUL NOT gloomy",
      // Specialty bright colorful
      "BRILLIANT HALO LIGHT with COLORFUL VIBRANCY, RADIANT glowing subject, SATURATED rich tones, GLEAMING silver catching every light, ETHEREAL and BRIGHT",
      "VERY BRIGHT GLAMOUR lighting, VIVID COLORFUL palette, subject GLOWING RADIANTLY, SPARKLING BRILLIANT highlights, CHEERFUL elegant atmosphere",
      // Golden warm bright
      "INTENSELY BRIGHT GOLDEN WARM light, RICH SATURATED COLORS, LUMINOUS RADIANT subject, VIBRANT jewel tones, GLEAMING polished silver, UPLIFTING mood",
      "BRILLIANT WARM SUNSHINE quality, VIVID COLORFUL atmosphere, BRIGHT and CHEERFUL, SPARKLING highlights throughout, NOT dark NOT moody NOT gloomy"
    ];

    // Pick random elements
    let cushion = cushions[Math.floor(Math.random() * cushions.length)];
    let robe = robes[Math.floor(Math.random() * robes.length)];
    let jewelryItem = jewelry[Math.floor(Math.random() * jewelry.length)];
    // Use white background from selected palette instead of random backgrounds array
    let background = selectedPalette.background;
    const lighting = lightingDirections[Math.floor(Math.random() * lightingDirections.length)];

    // Adjust for FEMALE pets - feminine aesthetic
    if (gender === "female") {
      // Lighter, softer cloak colors for female pets - EXPANDED variety
      const feminineRobes = [
        // Original options
        "DAINTY SOFT PINK velvet cloak with delicate gold thread embroidery, soft plush velvety texture, PURE WHITE ermine fur trim, dainty refined fabric - lighter softer feminine tones",
        "DAINTY LAVENDER velvet cloak with delicate gold patterns, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty luxurious fabric - soft feminine colors",
        "DAINTY SOFT ROSE velvet cloak with delicate ornate gold embroidery, soft plush velvety texture, PURE WHITE ermine fur trim, dainty refined fabric - lighter feminine tones",
        "DAINTY PEARL WHITE velvet cloak with delicate gold thread detailing, soft plush velvety texture, PURE BRIGHT WHITE ermine fur trim, dainty sumptuous fabric - soft luminous feminine",
        "DAINTY SOFT BLUE velvet cloak with delicate gold embroidery, soft plush velvety texture, PURE WHITE ermine fur trim, dainty luxurious fabric - lighter softer feminine colors",
        // Expanded pastels
        "DELICATE BLUSH PEACH velvet cloak with rose gold butterfly embroidery, soft ethereal texture, PURE WHITE swan feather trim, romantic feminine elegance",
        "SOFT MINT GREEN velvet cloak with silver botanical embroidery, fresh spring texture, PURE BRIGHT WHITE fur trim, garden fairy princess style",
        "ETHEREAL POWDER BLUE velvet cloak with silver snowflake patterns, dreamy winter texture, PURE WHITE Arctic fox trim, ice princess elegance",
        "GENTLE LILAC velvet cloak with gold wisteria embroidery, soft purple hues, PURE WHITE ermine trim, Victorian feminine grace",
        "WARM CHAMPAGNE velvet cloak with gold lace patterns, soft cream tones, PURE BRIGHT WHITE fur trim, bridal elegance",
        // Deeper feminine tones
        "RICH DUSTY MAUVE velvet cloak with antique rose gold embroidery, sophisticated feminine depth, PURE WHITE ermine trim, romantic vintage beauty",
        "SOFT CORAL PINK velvet cloak with gold seashell embroidery, warm sunset feminine tones, CREAM WHITE fur trim, mermaid princess elegance",
        "DELICATE PERIWINKLE velvet cloak with silver star embroidery, twilight feminine softness, PURE BRIGHT WHITE fur trim, celestial grace"
      ];
      robe = feminineRobes[Math.floor(Math.random() * feminineRobes.length)];
    } else if (gender === "male") {
      // REFINED MASCULINE robes - soft, elegant, NOT harsh or overly bold
      const refinedMasculineRobes = [
        // Soft blues and greens
        "ELEGANT DUSTY BLUE velvet cloak with subtle silver embroidery, soft refined texture, PURE WHITE ermine fur trim, gentleman's sophisticated grace",
        "REFINED SOFT SAGE velvet cloak with delicate gold botanical patterns, gentle green tones, CREAM WHITE fur trim, understated woodland elegance",
        "DISTINGUISHED POWDER BLUE velvet cloak with pearl button accents, soft airy texture, PURE BRIGHT WHITE fur trim, gentle aristocratic charm",
        // Warm neutrals
        "SOPHISTICATED WARM CREAM velvet cloak with gold filigree embroidery, soft ivory tones, PURE WHITE ermine fur trim, refined neutral elegance",
        "ELEGANT CHAMPAGNE velvet cloak with rose gold thread detailing, warm soft tones, CREAM WHITE fur trim, gentle golden sophistication",
        "REFINED SOFT TAUPE velvet cloak with silver embroidery accents, muted earth tones, PURE WHITE fur trim, understated nobility",
        // Soft burgundies and mauves
        "GENTLE DUSTY BURGUNDY velvet cloak with gold thread patterns, softened wine tones, PURE BRIGHT WHITE ermine fur trim, refined warmth",
        "ELEGANT SOFT MAUVE velvet cloak with silver botanical embroidery, muted purple-pink, CREAM WHITE fur trim, sophisticated softness",
        "REFINED DUSTY ROSE velvet cloak with gold accent embroidery, soft masculine pink, PURE WHITE fur trim, gentle modern elegance",
        // Soft navies and grays
        "DISTINGUISHED SOFT NAVY velvet cloak with pearl and gold accents, gentle deep blue, PURE WHITE ermine fur trim, refined nautical charm",
        "ELEGANT SILVER-GRAY velvet cloak with subtle gold embroidery, soft pewter tones, CREAM WHITE fur trim, sophisticated neutrality",
        "REFINED SLATE BLUE velvet cloak with delicate silver patterns, soft blue-gray, PURE BRIGHT WHITE fur trim, gentle distinguished look",
        // Light and elegant
        "SOFT PERIWINKLE velvet cloak with silver star embroidery, gentle purple-blue, PURE WHITE fur trim, dreamy refined elegance",
        "ELEGANT SOFT MINT velvet cloak with gold leaf patterns, fresh gentle green, CREAM WHITE fur trim, spring gentleman aesthetic",
        "REFINED PALE LAVENDER velvet cloak with silver filigree, soft purple tones, PURE WHITE ermine fur trim, gentle sophistication"
      ];
      robe = refinedMasculineRobes[Math.floor(Math.random() * refinedMasculineRobes.length)];
      
      // Refined masculine jewelry - elegant, NOT overly bold
      const refinedMasculineJewelry = [
        "elegant gold chain necklace with small pearl pendant and tiny sapphire accent, refined gentleman's accessory, sophisticated simplicity",
        "refined antique gold necklace with delicate emerald and pearl cluster, understated elegance, not overly bold",
        "distinguished gold chain with small medallion pendant featuring pearl center, gentle masculine refinement",
        "elegant layered gold chains with tiny gem accents (sapphire, pearl), sophisticated but soft presentation",
        "refined gold necklace with small cameo pendant and pearl drops, gentle Victorian masculine elegance",
        "delicate gold chain with small ruby and pearl cluster pendant, warm refined sophistication",
        "elegant silver and gold mixed chain necklace with small pearl accents, modern refined gentleman style",
        "distinguished gold necklace with small amethyst and pearl pendant, soft purple accents, gentle elegance",
        "refined antique gold chain with tiny diamond and pearl cluster, understated luxury, not flashy",
        "elegant gold necklace with small aquamarine and pearl pendant, soft blue tones, refined coastal charm"
      ];
      jewelryItem = refinedMasculineJewelry[Math.floor(Math.random() * refinedMasculineJewelry.length)];
    }
    
    if (gender === "female") {
      // Finer, more delicate jewelry for female pets - EXPANDED variety
      const feminineJewelry = [
        // Original options
        "extra delicate fine antique gold necklace with tiny gem clusters (small ruby, emerald, amethyst), intricate gold filigree, tiny pearls, very fine chains - FINER and more delicate",
        "dainty delicate antique gold necklace with small gem clusters, ornate fine filigree work, tiny pearl accents, multiple fine delicate chains - FINER jewelry",
        "delicate fine gold necklace with petite gem clusters, intricate delicate filigree, small pearls, fine delicate chains - FINER and more refined",
        // Pearl-focused feminine
        "elegant triple-strand SEED PEARL choker with tiny diamond accent, delicate cream lustre, feminine grace, princess worthy",
        "dainty single PEARL pendant on fine gold chain, simple elegant femininity, luminous cream drop, understated beauty",
        "delicate FRESHWATER PEARL necklace with tiny pink tourmaline accents, romantic soft pink tones, feminine sweetness",
        // Single gem feminine
        "delicate fine gold necklace with single teardrop ROSE QUARTZ pendant, soft pink love stone, feminine romantic energy",
        "elegant thin gold necklace with small PINK SAPPHIRE pendant surrounded by seed pearls, feminine luxury",
        "dainty gold chain with AQUAMARINE drop and tiny diamonds, icy feminine elegance, mermaid treasure",
        "refined fine silver necklace with MOONSTONE pendant, ethereal feminine shimmer, mystical beauty",
        // Floral and nature
        "delicate gold necklace with tiny FLOWER CLUSTER of mixed gems (pink sapphire, peridot, citrine), garden femininity",
        "dainty gold chain with BUTTERFLY pendant set with tiny diamonds and sapphires, whimsical feminine charm",
        "elegant gold necklace with HEART-SHAPED locket featuring tiny ruby, sentimental feminine keepsake"
      ];
      jewelryItem = feminineJewelry[Math.floor(Math.random() * feminineJewelry.length)];
    }

    // Analyze image darkness to detect black/dark pets (even if description doesn't explicitly say "black")
    const imageDarkness = await analyzeImageDarkness(buffer);
    const petDescLower = petDescription.toLowerCase();
    
    // Check if white cat - add angelic luminous treatment
    const isWhiteCat = species === "CAT" && (
      petDescLower.includes("white") || 
      petDescLower.includes("snow white") ||
      petDescLower.includes("pure white")
    );
    
    // Check if GREY cat - CRITICAL: Grey cats often get turned white/cream, prevent this
    const isGreyCat = species === "CAT" && (
      petDescLower.includes("grey") ||
      petDescLower.includes("gray") ||
      petDescLower.includes("russian blue") ||
      petDescLower.includes("chartreux") ||
      petDescLower.includes("british shorthair") ||
      petDescLower.includes("korat") ||
      petDescLower.includes("nebelung") ||
      petDescLower.includes("blue cat") ||
      petDescLower.includes("silver") ||
      petDescLower.includes("slate") ||
      petDescLower.includes("ash") ||
      petDescLower.includes("smoky") ||
      petDescLower.includes("blue-grey") ||
      petDescLower.includes("blue-gray")
    );
    
    // Check if black cat or dark-coated pet - preserve deep black color
    // Use BOTH description analysis AND image pixel analysis for robust detection
    const descriptionSaysBlack = (
      petDescLower.includes("black") ||
      petDescLower.includes("ebony") ||
      petDescLower.includes("jet black") ||
      petDescLower.includes("coal black") ||
      petDescLower.includes("charcoal") ||
      petDescLower.includes("dark brown")
    );
    
    // Force black cat detection if: (1) it's a cat AND (2) image is dark AND (3) description doesn't contradict
    const isBlackCat = species === "CAT" && (
      descriptionSaysBlack || 
      (imageDarkness.isDark && !petDescLower.includes("white") && !petDescLower.includes("light"))
    );
    
    // Check if dark-coated pet (any species) - use image analysis as backup
    const isDarkCoated = (
      descriptionSaysBlack ||
      (imageDarkness.isDark && !petDescLower.includes("white") && !petDescLower.includes("light"))
    ) && !petDescLower.includes("white");
    
    // Log detection results for debugging
    if (species === "CAT") {
      console.log(`🐱 Cat color detection:`, {
        descriptionSaysBlack,
        imageIsDark: imageDarkness.isDark,
        averageBrightness: imageDarkness.averageBrightness,
        isBlackCat,
        isDarkCoated,
        descriptionPreview: petDescription.substring(0, 100)
      });
      
      // If image is dark but description doesn't mention black, add it to description
      if (imageDarkness.isDark && !descriptionSaysBlack && !isWhiteCat) {
        console.log("⚠️ DARK CAT DETECTED: Image is dark but description doesn't mention black. Adding 'black' to description.");
        petDescription = `black ${petDescription}`;
      }
    }

    // Step 2: Generate late 18th-century aristocratic royal portrait - SPECIES AND PET ACCURACY ARE #1 PRIORITY
    const genderInfo = gender ? `\n=== GENDER ===\nThis is a ${gender === "male" ? "male" : "female"} ${species}.` : "";
    
    // Add feminine aesthetic instructions for female pets
    const feminineAesthetic = gender === "female" ? `
=== FEMININE AESTHETIC ===
This is a FEMALE ${species} - apply feminine aesthetic:
- LIGHTER, SOFTER cloak colors - pastel pinks, lavenders, soft blues, pearl whites
- DELICATE fabrics - fine, refined, gentle textures
- FINER jewelry - more delicate, smaller gems, intricate filigree
- GENTLER visual tone - softer lighting, more graceful composition
- Overall elegant feminine refinement` : "";
    
    // Add SOFTENED masculine aesthetic for male pets - refined elegance, NOT harsh or overly masculine
    const masculineAesthetic = gender === "male" ? `
=== REFINED MASCULINE AESTHETIC ===
This is a MALE ${species} - apply a SOFTENED, ELEGANT masculine aesthetic:
- SOFT yet distinguished cloak colors - dusty blues, soft sage, muted burgundy, warm cream, gentle navy
- AVOID harsh or overly bold colors - no bright reds, no stark blacks alone
- REFINED fabrics with SOFT textures - velvet with gentle sheen, NOT stiff or harsh
- ELEGANT jewelry with subtle sophistication - gold chains with pearls, refined gemstones
- Light FEMININE ACCENTS are welcome - soft pastels, delicate embroidery, pearl details
- GENTLE, WARM lighting - soft and inviting, NOT dramatic or harsh
- Overall look should be ELEGANT and REFINED, not rugged or overly masculine
- Think "gentle nobleman" NOT "warrior king"
- Soft, approachable, sophisticated appearance that appeals to modern aesthetic preferences` : "";

    // Add angelic luminous treatment for white cats
    const whiteCatTreatment = isWhiteCat ? `
=== WHITE CAT - ANGELIC LUMINOUS TREATMENT ===
This is a WHITE CAT - apply angelic luminous aesthetic:
- ANGELIC appearance - ethereal, heavenly, divine
- LUMINOUS glow that enhances white fur - soft radiant light
- SOFT GLOW around the entire cat - gentle radiance
- Enhanced presence - the white cat should GLOW with light
- More luminous than other pets - special angelic treatment` : "";

    // Add GREY cat color preservation treatment - CRITICAL to prevent grey becoming white
    // Also includes breed-specific facial structure for grey cat breeds
    const greyCatTreatment = isGreyCat ? `
=== GREY CAT - CRITICAL COLOR AND STRUCTURE PRESERVATION ===
This is a GREY/GRAY CAT - CRITICAL: Preserve the EXACT GREY fur color:
- The cat MUST remain GREY/GRAY - NEVER white, cream, beige, or golden
- Preserve the COOL GREY/BLUE-GREY fur tone exactly as in the reference
- This cat has GREY fur - NOT white, NOT cream, NOT golden, NOT warm-toned
- Maintain the distinctive COOL GREY/SILVER/SLATE tone throughout
- The grey color is ESSENTIAL to this cat's identity - preserve it exactly
- DO NOT warm up the colors - keep the COOL GREY tones
- DO NOT brighten to white or cream - maintain GREY
- Any highlights should be silvery-grey, NOT warm or golden
- The cat's fur should read as DEFINITIVELY GREY in the final image

*** GREY CAT BREED FACIAL STRUCTURE ***
Grey cats are often Chartreux, British Shorthair, Russian Blue, or Korat breeds. Pay attention to:
- CHARTREUX / BRITISH SHORTHAIR: FLAT, WIDE face. Very short muzzle (almost flat). FULL puffy cheeks. Broad skull. Wide-set eyes. Round head shape. "Smiling" expression from wide muzzle.
- RUSSIAN BLUE: More angular wedge-shaped head. Larger ears. Almond eyes. Less flat face than Chartreux.
- KORAT: Heart-shaped face. Large green eyes. Medium muzzle.
Identify which type this cat resembles and MATCH that facial structure exactly.` : "";
    
    // Add black cat color preservation treatment
    const blackCatTreatment = isBlackCat || isDarkCoated ? `
=== BLACK/DARK-COATED PET - CRITICAL COLOR PRESERVATION ===
This is a ${isBlackCat ? "BLACK CAT" : "DARK-COATED PET"} - CRITICAL: Preserve the DEEP BLACK/DARK color:
- The pet MUST remain DEEP BLACK or DARK BROWN - NEVER white, gray, or light colored
- Preserve RICH DEEP BLACK fur color throughout - maintain dark tones
- Use SUBTLE highlights ONLY - gentle rim lighting that doesn't wash out the black
- DEEP SHADOWS are correct - black pets have darker shadows naturally
- AVOID over-brightening - maintain the pet's natural dark coloration
- The black/dark color is ESSENTIAL to the pet's identity - preserve it exactly
- Use contrast with lighter backgrounds/cloaks to make the black fur stand out
- DO NOT lighten or brighten the fur color - keep it DEEP and RICH BLACK/DARK` : "";
    
    // Detect Maine Coon or similar large-eared cat breeds
    const isMoonCoonOrSimilar = species === "CAT" && (
      petDescription.toLowerCase().includes("maine coon") ||
      petDescription.toLowerCase().includes("maine-coon") ||
      petDescription.toLowerCase().includes("norwegian forest") ||
      petDescription.toLowerCase().includes("lynx tip") ||
      petDescription.toLowerCase().includes("tufted ear") ||
      petDescription.toLowerCase().includes("ear tuft") ||
      (petDescription.toLowerCase().includes("large ear") && petDescription.toLowerCase().includes("tall ear"))
    );
    
    // Maine Coon / Norwegian Forest Cat treatment - preserve distinctive features
    const maineCoonTreatment = isMoonCoonOrSimilar ? `
=== MAINE COON / NORWEGIAN FOREST CAT - CRITICAL BREED FEATURES ===
This appears to be a Maine Coon or similar large-eared breed - CRITICAL: Preserve these distinctive features:

*** EARS - THE MOST IMPORTANT FEATURE ***
- VERY TALL, LARGE ears - they should be PROMINENTLY TALL, roughly 40% of head height or more
- Ears set HIGH on the head
- LYNX TIPS (tufts at the ear tips) - these hair tufts at ear points are ESSENTIAL
- Ear furnishings - long hair growing from inside the ears
- Ears are POINTED, not rounded
- If this is a kitten, ears appear even LARGER relative to head

*** HEAD AND FACE ***
- Large, strong head with high cheekbones
- SQUARE MUZZLE - distinctive "box" shape when viewed from front
- NOT a pointed muzzle like Siamese
- Strong chin in line with nose
- "M" marking on forehead if tabby

*** COAT ***
- Long, flowing fur (medium-long to long)
- Distinctive "ruff" or mane around neck
- Fluffy chest
- Bushy tail

DO NOT generate a generic cat face. The TALL EARS with LYNX TIPS are what make Maine Coons instantly recognizable.` : "";
    
    // Age preservation instructions
    let agePreservationInstructions = "";
    if (ageStage === "PUPPY" || ageStage === "KITTEN") {
      agePreservationInstructions = `
=== CRITICAL: PRESERVE YOUTHFUL APPEARANCE ===
This is a ${ageStage} - preserve their youthful, baby features EXACTLY:
- Keep large eyes relative to face size (puppies/kittens have proportionally larger eyes)
- Maintain rounder, softer facial features (not mature/adult proportions)
- Preserve smaller body proportions and youthful appearance
- Keep the playful, innocent expression characteristic of young animals
- DO NOT age them up - maintain their exact puppy/kitten stage
- The portrait should reflect the animal exactly as it appears - a ${ageStage}, not an adult
- Preserve all youthful characteristics: rounder head, larger eyes, smaller muzzle, softer features
${isMoonCoonOrSimilar ? "- For Maine Coon kittens: Ears are EVEN LARGER relative to head - preserve this dramatic ear size" : ""}`;
    }
    
    // Build facial structure section if analysis was successful
    const facialStructureSection = facialStructureAnalysis ? `
=== DETAILED FACIAL STRUCTURE (CRITICAL FOR RECOGNITION) ===
The following facial structure analysis MUST be preserved exactly:
${facialStructureAnalysis}
` : "";

    // Determine if this is a large animal that needs different composition (full body, zoomed out)
    const largeAnimals = ["HORSE", "PONY", "DONKEY", "LLAMA", "ALPACA", "GOAT", "PIG"];
    const isLargeAnimal = largeAnimals.includes(species);
    
    // Check if this is a large dog breed that needs more headroom
    const isLargeDog = species === "DOG" && (isLargeBreed(detectedBreed, petDescription) || isVeryLargeAnimal(detectedBreed, petDescription));
    
    // Species-specific composition instructions
    const compositionInstructions = isLargeAnimal ? `
=== COMPOSITION FOR MAJESTIC ${species} (CRITICAL) ===
- FULL BODY VIEW - show the entire ${species} from head to hooves
- WIDE SHOT framing - capture the majestic proportions and powerful build
- ${species} STANDING PROUDLY or in natural majestic pose (not lying down)
- Show the elegant neck, strong body, and graceful legs
- Camera positioned at distance to capture full majesty
- Subject CENTERED in frame with room to show full stature
- Natural ${species} pose: standing noble, slight turn, head held high, or gentle movement
- Ornate royal draping/blanket over back instead of cloak
- Decorated bridle or halter with gold and jewels
- Rich background: stable interior, pastoral landscape, or grand estate grounds
- The ${species}'s full beautiful form should dominate the composition` : isLargeDog ? `
=== COMPOSITION FOR LARGE DOG BREED (CRITICAL - PREVENT EAR CROPPING) ===
*** THIS IS A LARGE DOG BREED - ZOOM OUT TO FIT ENTIRE HEAD ***
- ZOOM OUT significantly - show MORE of the dog, not just head/shoulders
- Subject positioned in LOWER PORTION of frame - NOT centered vertically
- CRITICAL: Leave GENEROUS empty space above the TOP OF EARS
- The COMPLETE head including FULL EAR TIPS must be visible - NEVER crop ears
- Show head, neck, chest, and upper body - wide framing
- At least 15-20% of frame height should be background ABOVE the ears
- Camera positioned FURTHER BACK than normal portrait distance
- Body ¾ VIEW, head forward or slightly angled
- FRONT PAWS VISIBLE and resting on cushion
- Cloak draped over body + cushion with realistic folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest
- ABSOLUTELY FORBIDDEN: cropping ANY part of the head or ears
- Think "full upper body portrait" not "head shot"` : `
=== COMPOSITION (CRITICAL - Follow Exactly) ===
*** ZOOMED OUT FRAMING - SHOW MORE OF THE PET ***
- PULL BACK from subject - pet should occupy only 65-75% of frame height
- ALWAYS leave GENEROUS HEADROOM above ears - at least 15% of frame height as background
- TOP OF EARS must NEVER touch or approach the top edge of frame
- Subject positioned in LOWER HALF of frame - NOT centered vertically
- FULL HEAD including COMPLETE EARS must be visible with AMPLE space above them
- Show HEAD, NECK, CHEST, and UPPER BODY - more of the pet visible
- Body ¾ VIEW, head forward or slightly angled - classical portrait posture
- FRONT PAWS VISIBLE and resting on cushion - signature trait
- Cloak draped over body + cushion - looks heavy, rests naturally with realistic folds
- BRIGHT POLISHED SILVER CLOAK CLASP at upper chest PROPERLY SECURING THE CLOAK - two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver finish, clasp HOLDS THE CLOAK TOGETHER at the chest
- WIDER FRAMING: Show from cushion to well above head - NOT a tight close-up
- Camera positioned FURTHER BACK than typical portrait distance
- Camera at pet's eye level or slightly above
- ABSOLUTELY FORBIDDEN: cropping ANY part of head/ears, letting ears touch top edge, framing too tight/close`;

    // Species-specific pose instructions
    const poseInstructions = isLargeAnimal ? `
=== POSE: MAJESTIC ${species} POSES ===
Choose ONE of these noble ${species} poses:
- PROUD STANCE: Standing tall with head held high, noble bearing, weight evenly distributed
- GENTLE TURN: Body slightly angled, head turned toward viewer, elegant and approachable
- REGAL PROFILE: Side view showing full noble profile, one ear forward, alert but calm
- GRACEFUL MOVEMENT: Captured mid-stride or pawing gently, showing natural grace
- PASTORAL REST: Standing peacefully in a scenic setting, relaxed but dignified

KEY ${species} QUALITIES:
- Show the powerful yet graceful build
- Mane flowing naturally, well-groomed appearance
- Eyes intelligent and gentle
- Muscular form visible under royal drapery
- Hooves visible and properly proportioned
- Tail natural and flowing` : `
=== POSE REINFORCEMENT - LYING DOWN FULL BODY ===
The pet MUST be LYING DOWN on the cushion - NOT sitting upright.
- FULL BODY must be visible including ALL FOUR LEGS
- Pet should be SPRAWLED, LOUNGING, or in SPHINX pose
- Show the pet from a DISTANCE - zoomed out wide shot
- Simple velvet cloak draped loosely with THIN SILVER CLASP only
- NO excessive jewelry, NO heavy robes, NO elaborate costume
- The pet's natural body should be mostly visible under the light cloak

❌ FORBIDDEN: Upright sitting, close-up shots, heavy clothing
✓ REQUIRED: Lying down, full body visible, simple cloak only`;

    // Add critical framing instruction at the very start for large dogs
    const largeDogFramingPrefix = isLargeDog ? `
*** CRITICAL FRAMING REQUIREMENT - READ FIRST ***
THIS IS A LARGE DOG BREED. You MUST zoom out and show a WIDE SHOT.
- Frame as a HALF-BODY PORTRAIT showing head, neck, chest, and front legs
- The dog should appear SMALL in the frame with lots of background visible
- Leave at least 20% EMPTY SPACE above the top of the ears
- DO NOT create a close-up head shot - show MORE of the body
- Think "sitting dog from 6 feet away" not "dog face close-up"
*** END FRAMING REQUIREMENT ***

` : "";

    // Note: selectedPose and selectedPalette are already initialized earlier (around line 3626)
    
    const generationPrompt = `${largeDogFramingPrefix}

POSE & COMPOSITION (MANDATORY)

- Pose: "${selectedPose.name}" – ${selectedPose.description}

- Body: ${selectedPose.bodyPosition}, head: ${selectedPose.headPosition}, paws: ${selectedPose.pawPosition}, expression: ${selectedPose.expression}

- Wide shot, full body visible on an ornate cushion. Show ALL four legs and paws.

- Pet fills about 50–60% of frame height with space around it; camera pulled back like viewing from across a room. No close-ups, no cropped body.

CLOTHING & JEWELRY

- Single ornate velvet cloak over shoulders/back, body mostly visible beneath.

- Cloak color: ${selectedPalette.cloakColor}, draped naturally, could slip off.

- Cloak held by one elegant SILVER clasp at the chest.

- ONE statement necklace only: extremely ornate, vibrant gems (rubies, emeralds, sapphires, purples) that shimmer and catch light. No other clothing, no extra necklaces.

COLOR PALETTE "${selectedPalette.name}"

- Background: ${selectedPalette.background}

- Cushion: ${selectedPalette.cushionColor}

- Lighting & mood: ${selectedPalette.lighting}, ${selectedPalette.mood}

- Overall colors: soft, muted, harmonious and refined. Jewelry gems may be highly vibrant; everything else is gentle, not harsh or neon.

BEAUTIFUL COMPOSITION (CRITICAL FOR STUNNING RESULT):

- CLASSICAL COMPOSITION: Apply golden ratio and rule of thirds principles. Pet positioned at a visually pleasing focal point.

- DRAMATIC LIGHTING: Use Rembrandt-style chiaroscuro lighting with beautiful interplay of light and shadow. Strong rim lighting on fur edges creating a luminous halo effect.

- DEPTH AND DIMENSION: Create atmospheric perspective - soft focus on background elements, sharp focus on pet. Multiple planes of depth (foreground cushion, mid-ground pet, background).

- COLOR HARMONY: Use sophisticated color relationships - complementary accents, analogous base colors, split-complementary highlights. Colors should sing together in harmony.

- ELEGANT NEGATIVE SPACE: Thoughtful use of empty space around the subject to create breathing room and draw focus to the pet.

- VISUAL FLOW: Guide the viewer's eye through the composition using diagonal lines of the cloak, curves of the cushion, and placement of jewelry.

- RICH TEXTURAL CONTRAST: Juxtapose textures beautifully - soft plush fur against smooth velvet, matte fabric against gleaming metallic jewelry, rough canvas texture against soft painted areas.

- PROFESSIONAL STUDIO LIGHTING: Main key light from upper left (classic portrait lighting), fill light from right to soften shadows, rim light from behind to separate subject from background.

- MUSEUM-QUALITY AESTHETIC: The composition should look like it belongs in the Louvre or National Gallery - refined, balanced, sophisticated, and timeless.

- ROMANTIC ATMOSPHERE: Soft, dreamy quality with gentle bokeh effect in background, warm golden tones, and an overall sense of elegance and beauty.

- ARTISTIC BALANCE: Perfect visual weight distribution - if the pet leans one direction, balance with jewelry, cloak drape, or cushion folds on the opposite side.

- PAINTERLY BEAUTY: Every element should contribute to an overall sense of sublime beauty - this is fine art, not just a pet photo.

BRIGHTNESS & LUMINOSITY (CRITICAL):

- Make the overall image BRIGHT and LUMINOUS - well-lit throughout, not dark or shadowy

- Increase overall brightness - the image should feel bright and airy, like viewing in a well-lit gallery

- Enhance luminosity - colors should glow and radiate light, especially highlights on fur, jewelry, and fabric

- Brighten shadows - shadows should be lighter and more visible, not deep dark areas

- Increase exposure - the image should feel like it's bathed in bright, warm light

- Luminous atmosphere - everything should feel bright and radiant, with soft glowing highlights throughout

- Avoid dark or dim areas - ensure even lighting across the entire composition

- Bright, cheerful, luminous overall feel - the portrait should feel like it's in bright daylight or well-lit studio

DO NOT:

- No upright human-like pose, no stiff statue pose.

- No close-up head shot, no cropped ears or body.

- No heavy layered costumes, no multiple necklaces.

- BACKGROUND MUST BE WHITE - pure white, bright white, ivory white, or very light white variations ONLY. NO colors, NO green, NO tan, NO brown.

- NO GREEN COLOR CASTS - absolutely avoid any green tinting or green color grading throughout the image.

- NO MUDDY COLORS - avoid any muddy, brown, tan, or earth-tone colors anywhere in the image.

- Increase color saturation and brightness throughout - make colors vibrant and luminous.

SPECIES (CRITICAL)

THIS IS A ${species}. Generate ONLY a ${species}. ${notSpecies}

STYLE – ANTIQUE OIL MASTERPIECE

- 18th-century European aristocratic oil portrait.

- Loose visible brushwork, rich oil texture, not smooth or digital.

- Thick impasto highlights, visible bristle marks, painterly not photographic.

- Strong aged look: craquelure (crack network), warm amber/yellowed varnish, subtle wear on edges, canvas texture slightly visible.

- Looks like a 200–300 year old painting found in a grand estate, not new.

EXTREMELY HEAVY PAINTERLY FACIAL TREATMENT (CRITICAL - MUST OBSCURE FACE):

- Apply EXTREMELY HEAVY painterly texture and VERY BOLD, THICK brushstrokes to the ENTIRE face and head area - SIGNIFICANTLY MORE than the rest of the image.

- HEAVILY OBSCURE all facial details with thick, visible brushstrokes - the face should look like an IMPRESSIONIST PAINTING, not a photograph. Think MONET, RENOIR, or VAN GOGH close-up.

- Use VERY LOOSE, EXPRESSIVE brushwork that BREAKS UP and FRAGMENTS facial features - individual brush strokes should be clearly visible and create texture that hides precise details.

- BLUR and SOFTEN all facial transitions - no sharp edges on eyes, nose, mouth, or facial markings. Everything blends together with soft, painterly strokes.

- Apply EXTREMELY THICK impasto texture - CHUNKY raised paint on nose, around eyes, on cheeks, muzzle, and forehead. The paint should look physically THICK and TEXTURED.

- Create a STRONG ARTISTIC ABSTRACTION - the face should feel like looking at an impressionist masterpiece up close where you see PAINT STROKES first, subject second.

- EVERY DETAIL should be SOFTENED and OBSCURED by visible brushwork - this is NOT a photograph, it's an ARTISTIC INTERPRETATION rendered in thick oil paint.

- Let brushstrokes CREATE THE FACE rather than trace it - the texture and color of the strokes suggest features without rendering them precisely.

- HEAVILY TEXTURED fur with visible directional brushstrokes that blend into the facial features, obscuring where one feature ends and another begins.

- The face should feel ALMOST ABSTRACT - you recognize it's the pet through overall shape, color, and essence, NOT through precise photographic detail.

- MAXIMUM PAINTERLY EFFECT on the face - if it looks too photographic or too clear, ADD MORE BRUSHSTROKES AND TEXTURE.

IDENTITY & LIKENESS (MOST IMPORTANT)

This must look like THIS specific ${species}, instantly recognizable to the owner.

- Match head and face proportions, muzzle length/shape, eye shape/size/spacing/color, ear size/shape/position, cheeks and jawline, body build (stocky vs slender, large vs tiny).

- Preserve ALL distinctive markings, patterns and asymmetries from the description: ${petDescription}

- Any unique feature mentioned (spots, patches, scars, tufts, ear tilt, color breaks, etc.) MUST be clearly visible in the correct location.

- Do NOT generate a generic breed face; capture this pet's individual quirks exactly.

FULLY ANIMAL ONLY

- 100% natural ${species} anatomy and posture.

- No human body, no bipedal stance, no human hands or hybrid features.

${compositionInstructions}

${poseInstructions}

${facialStructureSection}

Additional traits and special handling:

${genderInfo}${feminineAesthetic}${masculineAesthetic}${whiteCatTreatment}${greyCatTreatment}${blackCatTreatment}${maineCoonTreatment}${agePreservationInstructions}

FINAL FRAMING

BREATHTAKINGLY BEAUTIFUL full-body portrait of the ${species} naturally sitting or resting on ${cushion}, in a relaxed, elegant pose, with ${robe} draped gracefully over its back and a bright polished silver cloak clasp plus ${jewelryItem}. ${background}. ${lighting} with GORGEOUS Rembrandt-style dramatic lighting, soft rim lighting creating luminous fur edges, beautiful interplay of light and shadow. Entire head and ear tips fully visible with atmospheric background above; never cropped. STUNNING museum-quality composition with perfect visual balance and classical artistic principles.

RENDERING SUMMARY

STUNNINGLY BEAUTIFUL authentic antique oil painting masterpiece: GORGEOUS composition with classical golden ratio placement, ROMANTIC Rembrandt-style dramatic lighting, SUBLIME color harmony, EXQUISITE textural contrasts. Loose flowing brushstrokes, rich impasto, elegant craquelure, warm amber varnish glow. BREATHTAKINGLY BEAUTIFUL atmosphere with soft luminous highlights, professional studio lighting quality, museum-worthy elegance. Plush velvet cloak with luxurious drape, gleaming gold accents catching light beautifully, DAZZLING vibrant gems with inner fire. BRIGHT LUMINOUS COLORS, HIGH SATURATION, sophisticated visual balance. The portrait should be SO BEAUTIFUL it takes the viewer's breath away - fine art gallery masterpiece quality.

BRIGHTNESS & COLOR REQUIREMENTS (CRITICAL):

- BRIGHT overall composition - the image must be well-lit throughout, bright and luminous

- INCREASE COLOR SATURATION - make colors more vibrant, rich, and saturated throughout

- INCREASE BRIGHTNESS - make the entire image significantly brighter, like viewing in bright daylight or a well-lit gallery

- Enhanced luminosity - colors should glow and radiate light, especially highlights on fur, jewelry, and fabric

- VIBRANT COLORS - make all colors more intense and vivid (cloaks, cushions, jewelry, backgrounds)

- Brighten all areas - avoid dark or shadowy sections, ensure even bright lighting across the composition

- Luminous atmosphere - everything should feel bright, radiant, and cheerful

- Light, airy feel - the portrait should feel like it's bathed in bright, warm light

- Bright highlights - enhance highlights on fur, jewelry, and fabric to make them pop with brightness

- Lighter shadows - shadows should be lighter and more visible, not deep dark areas

- Overall bright, cheerful, luminous feel - the image should feel bright and inviting, not dark or moody

- BACKGROUND MUST BE WHITE - pure white, bright white, ivory white, or very light white variations ONLY

- NO GREEN BACKGROUNDS - absolutely never use green, olive, sage, or any green-tinted backgrounds

- NO TAN/BROWN BACKGROUNDS - absolutely never use tan, beige, brown, or earth-tone backgrounds

- NO COLORED BACKGROUNDS - backgrounds must be white or very light white only, no colors

- Background must be: pure white, bright white, ivory white, warm white, cool white, or very light grey-white - WHITE ONLY

`;

    // Determine which model to use for generation
    // Priority: OpenAI img2img (MAIN GENERATOR) > Style Transfer > IP-Adapter > GPT-Image-1
    // Note: Stable Diffusion and Composite are disabled for now (will come back later)
    // 
    // CRITICAL: All generation types (free, pack credit, secret credit) use the SAME model selection logic.
    // The only difference is watermarking - the actual generation is identical for all types.
    // useSecretCredit and usePackCredit do NOT affect model selection - only watermarking.
    
    // Stable Diffusion - DISABLED (removed for now, will come back later)
    const useStableDiffusion = false; // Always disabled
    
    // Leonardo AI - for dev testing only
    const useLeonardo = process.env.USE_LEONARDO === "true" && process.env.LEONARDO_API_KEY;
    
    // Composite system - DISABLED BY DEFAULT (use OpenAI img2img instead)
    const useComposite = false; // Disabled - use OpenAI img2img as main generator
    
    // OpenAI img2img - MAIN GENERATOR (default)
    const useOpenAIImg2Img = !useLeonardo && process.env.USE_OPENAI_IMG2IMG !== "false" && process.env.OPENAI_API_KEY;
    const useStyleTransfer = !useStableDiffusion && !useLeonardo && !useComposite && process.env.USE_STYLE_TRANSFER === "true" && process.env.REPLICATE_API_TOKEN;
    const useIPAdapter = !useStableDiffusion && !useLeonardo && !useComposite && !useStyleTransfer && process.env.USE_IP_ADAPTER === "true" && process.env.REPLICATE_API_TOKEN;
    
    console.log("=== IMAGE GENERATION ===");
    console.log("Environment check:");
    console.log("- Model: OpenAI img2img (MAIN GENERATOR)");
    console.log("- USE_LEONARDO:", process.env.USE_LEONARDO || "not set", useLeonardo ? "✅ ACTIVE" : "");
    console.log("- USE_OPENAI_IMG2IMG:", process.env.USE_OPENAI_IMG2IMG !== "false" ? "✅ enabled" : "disabled");
    console.log("- USE_COMPOSITE:", "disabled (using OpenAI img2img as main generator)");
    console.log("- OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ set" : "❌ not set");
    console.log("- IS_MULTI_PET:", isMultiPet ? "true" : "false");
    
    let firstGeneratedBuffer: Buffer;
    
    // === MULTI-PET GENERATION PATH (auto-detected 2-4 pets in single image) ===
    if (isMultiPet && petDescriptions.length >= 2) {
      const petCount = petDescriptions.length;
      const petCountWord = petCount === 2 ? "TWO" : petCount === 3 ? "THREE" : "FOUR";
      
      console.log(`🐾🐾 === MULTI-PET GENERATION MODE (${petCount} pets, img2img) ===`);
      petDescriptions.forEach((desc, i) => {
        console.log(`Pet ${i + 1} (${petSpecies[i]}): ${desc.substring(0, 100)}...`);
      });
      
      // Build species description
      const allSameSpecies = petSpecies.every(s => s === petSpecies[0]);
      const speciesDescription = allSameSpecies 
        ? `${petCountWord} ${petSpecies[0]}S` 
        : petSpecies.map((s, i) => i === petSpecies.length - 1 ? `and a ${s}` : `a ${s}`).join(', ').replace(/, and/, ' and');
      
      // Build pet descriptions list
      const petDescriptionsList = petDescriptions.map((desc, i) => 
        `- Pet ${i + 1} (${petSpecies[i]}): ${desc.substring(0, 200)}`
      ).join('\n');
      
      // Create a prompt for transforming the image with all pets into a royal portrait
      // Using img2img preserves all pets' identities from the original photo
      // IMPORTANT: This prompt mirrors the single-pet prompt structure for consistent style
      const multiPetImg2ImgPrompt = `=== TOP PRIORITY REQUIREMENTS (FOLLOW THESE FIRST) ===

BOTH pets must wear cloaks that ALWAYS include:
- A visible silver or gold connecting chain
- An ornate functional clasp (round, engraved, shiny)

Jewelry on BOTH pets must be extremely shiny, bright, gleaming, highly ornate.

Metals must be light gold or bright polished silver only.

Cloaks must ALWAYS be lighter-colored, luminous, elegant, Victorian-royal, not dark or muddy.

Cloaks must never look like draped blankets — they must have real construction, chains, clasps, folds, and fur trim.

Multi-pet composition must be balanced, harmonious, symmetric, elegant, and match the single-pet vibe.

=== CRITICAL SPECIES LOCK ===
This is a portrait of ${petCountWord} pets, each a real ${speciesDescription}. No human features, no hybrids, no upright poses, no anthropomorphism. Do NOT generate: ${notSpecies}. Each pet must retain its own realistic anatomy.

=== MASTER STYLE – VICTORIAN ROYAL OIL PORTRAIT (MULTI-PET) ===
Same vibe as the single-pet version. 18th-century aristocratic oil portrait with luminous lighting on both subjects. Background dark, rich, atmospheric (navy, burgundy, emerald, charcoal). Extremely ornate Victorian-royal aesthetic. Deeply textured, thick impasto paint. Composition must feel like a royal dual portrait commission.

=== THICK OIL PAINTING TECHNIQUE ===
Use extremely thick, dimensional oil paint: heavy impasto, raised strokes, sculptural pigment, palette-knife ridges, visible bristle texture.

=== ANTIQUE AGING ===
Soft craquelure, warm aged varnish, romantic old-master glow.

=== COLOR PALETTE ===
A unique palette each generation. Cloak colors between pets should complement each other but not match exactly. Pillows must remain vibrant, ornate, Victorian.

=== IDENTITY PRESERVATION (FOR BOTH PETS) ===
Each pet must be unmistakably that exact individual. Preserve all: markings, face shape, eye shape and color, snout/muzzle shape, ear position, asymmetry, coat patterns. Do NOT homogenize the pets.

=== ROYAL ENVIRONMENT & PILLOWS (TWO-PET VERSION) ===
Pillows beneath each pet should be different colors, brighter, ornate. Rich jewel tones: ruby, sapphire, emerald, amethyst, gold, teal, rose, turquoise. Must include Victorian brocade, damask, gold embroidery, baroque patterns. Textures must be velvet, silk, embroidered linen. Creates a richer, more grand setting than a single-pet portrait.

=== ROYAL WARDROBE – TWO-PET CLOAKS, CHAINS, GARMENTS, CLASPS ===

CLOAKS (BOTH PETS):
- MUST be lighter-colored, luminous, elegant, refined
- Approved palette: cream, ivory, pale gold, champagne, silver-blue, sky blue, soft rose, lavender
- Cloaks must have: flowing folds, natural sheen, Victorian embroidery or woven baroque patterns, detailed gold filigree where appropriate, ermine-style fur trim with black spots

CHAINS & CLASPS (MUST ALWAYS BE VISIBLE):
For both pets:
- A silver or gold connecting chain securing the cloak
- A round, ornate, engraved clasp placed at chest height
- Clasp metal must match jewelry metal
- Highly reflective, polished, ceremonial

=== JEWELRY REQUIREMENTS (FOR BOTH PETS) ===
Jewelry must be MORE ornate than the single-pet version. Must be extremely shiny, bright, glowing, reflective. Use only bright gold or bright polished silver. Layered gold chains encouraged. Central gemstone pendants must be large, luminous, high clarity. Designs must match the royal level of the reference image.

ENHANCED SHINE RULE FOR MULTI-PETS:
- Jewelry must visibly sparkle even from a distance
- Crisp bright highlights on metal
- Gemstones must show internal radiance

=== REFERENCE-MATCHING REQUIREMENTS ===
(Both pets must follow same ornate style as reference images)

JEWELRY STYLE: layered chains, ornate gemstone pendants, heavy royal handcrafted appearance
CLASP STYLE: round, engraved, polished metal, baroque-level detail, strong reflections
CLOAK CONSTRUCTION: heavy drape, noble fabric, fur trim, baroque patterns, cloak colors differ but share equal richness

=== COMPOSITION RULES FOR TWO PETS ===
The portrait must look like a formal dual royal commission:
- Pets posed close together in a harmonious arrangement
- Both clearly visible from chest or full-body range
- Cloaks spread elegantly around both subjects
- Chains and clasps visible on both
- Symphony of light across both faces
- Balanced, symmetric or near-symmetric staging
- Background softly gradients to emphasize both pets equally
- Must maintain the same vibe and elegance as single-pet portraits

VERY ZOOMED OUT FRAMING - show ALL ${petCount} pets' full bodies with space around them. Pet(s) should occupy only 60-70% of frame height. WIDE and CENTERED composition with all pets clearly visible. AMPLE HEADROOM above ALL pets - at least 15% of frame as background above tallest ears. Position pets CLOSE TOGETHER like companions - arranged naturally.

=== POSE REQUIREMENT ===
Both pets must appear in a serene, calm, Renaissance-inspired pose: relaxed posture, noble presence, elegant stillness, avoid stiff or awkward posing.

=== PET DESCRIPTIONS (FOR BOTH PETS) ===
${petDescriptionsList}
${multiPetCombinedDescription ? `Together: ${multiPetCombinedDescription}` : ""}

=== OVERALL GOAL ===
A dual royal Victorian antique oil portrait featuring ${petCountWord} pets, rendered with: thick dimensional oil paint, ornate cloaks, shining jewelry, visible connecting chains and clasps, rich pillows, luminous backgrounds, serene Renaissance-inspired dual posing. The final portrait must maintain the same vibe, richness, ornateness, and emotional power as the single-pet version but expanded to beautifully showcase both pets together.`;

      console.log("Multi-pet img2img prompt length:", multiPetImg2ImgPrompt.length);
      
      try {
        // Use OpenAI img2img (images.edit) to transform the photo while preserving both pets
        console.log("🎨 Using OpenAI img2img for multi-pet portrait...");
        
        // Process the original image buffer for OpenAI
        const processedForOpenAI = await sharp(buffer)
          .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
          .png()
          .toBuffer();
        
        // Convert buffer to File for OpenAI API
        const uint8Array = new Uint8Array(processedForOpenAI);
        const imageBlob = new Blob([uint8Array], { type: "image/png" });
        const imageFile2 = new File([imageBlob], "multi-pet-photo.png", { type: "image/png" });
        
        const multiPetResponse = await openai.images.edit({
          model: "gpt-image-1",
          image: imageFile2,
          prompt: multiPetImg2ImgPrompt,
          n: 1,
          size: "1024x1024",
        });
        
        const multiPetImageData = multiPetResponse.data?.[0];
        if (!multiPetImageData) {
          throw new Error("No image generated for multi-pet portrait");
        }
        
        if (multiPetImageData.b64_json) {
          firstGeneratedBuffer = Buffer.from(multiPetImageData.b64_json, "base64");
          console.log("✅ Multi-pet portrait generated (base64)");
        } else if (multiPetImageData.url) {
          console.log("Downloading multi-pet portrait from URL...");
          const downloadResponse = await fetch(multiPetImageData.url);
          if (!downloadResponse.ok) {
            throw new Error(`Failed to download multi-pet image: ${downloadResponse.status}`);
          }
          firstGeneratedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
          console.log("✅ Multi-pet portrait generated (URL download)");
        } else {
          throw new Error("No image data in multi-pet response");
        }
        
        console.log("✅ Multi-pet portrait generated successfully!");
        console.log("Buffer size:", firstGeneratedBuffer.length);
        
        // For multi-pet, use combined species for later processing
        species = `${species1} and ${species2}`;
        petDescription = `A duo portrait featuring: Pet 1 (${species1}): ${petDescription1}. Pet 2 (${species2}): ${petDescription2}.`;
        
      } catch (multiPetError) {
        console.error("❌ Multi-pet generation failed:", multiPetError);
        throw new Error(`Multi-pet portrait generation failed: ${multiPetError instanceof Error ? multiPetError.message : "Unknown error"}`);
      }
    } else {
      // === SINGLE PET GENERATION PATH (Original) ===
    
    const modelName = useLeonardo ? "🎨 Leonardo AI (Kino XL) - DEV TESTING"
      : useOpenAIImg2Img ? "OpenAI img2img (images.edit)"
      : useComposite ? "Composite (segment + scene + blend)"
      : useStyleTransfer ? "Style Transfer + GPT Refinement" 
      : useIPAdapter ? "IP-Adapter SDXL (identity preservation)" 
      : "GPT-Image-1 (OpenAI)";
    console.log("Model selected:", modelName);
    console.log("Selection reason:", useLeonardo ? "USE_LEONARDO=true (⚠️ DEV TESTING ONLY)"
      : useOpenAIImg2Img ? "USE_OPENAI_IMG2IMG=true (default - MAIN GENERATOR)"
      : useComposite ? "USE_COMPOSITE=true"
      : useStyleTransfer ? "USE_STYLE_TRANSFER=true"
      : useIPAdapter ? "USE_IP_ADAPTER=true"
      : "No model flags set, using default GPT-Image-1");
    console.log("Generation type:", useSecretCredit ? "SECRET CREDIT (un-watermarked)" : usePackCredit ? "PACK CREDIT (watermarked)" : "FREE (watermarked)");
    console.log("⚠️ IMPORTANT: All generation types (free, pack credit, secret credit) use the SAME model:", modelName);
    console.log("⚠️ The only difference is watermarking - generation model is identical for all types.");
    console.log("Detected species:", species);
    console.log("Species enforcement:", notSpecies);
    
    // ⚠️ STABLE DIFFUSION PATH - DISABLED FOR NOW ⚠️
    if (useStableDiffusion) {
      // This block will never execute since useStableDiffusion is always false
      // Keeping for future reference when SD is re-enabled
      const sdModel = process.env.SD_MODEL || "sdxl-ip-adapter-plus";
      console.log("⚠️⚠️⚠️ STABLE DIFFUSION MODE - LOCAL TESTING ONLY ⚠️⚠️⚠️");
      console.log(`📌 Using SD model: ${sdModel}`);
      console.log("📌 Available models: flux, flux-img2img, sd3, sdxl-img2img, sdxl-controlnet, ip-adapter-faceid");
      
      // Build a focused prompt for Stable Diffusion
      // CRITICAL: This is img2img - we need STRONG transformation emphasis
      const sdPrompt = `TRANSFORM INTO AUTHENTIC 18th-century European aristocratic OIL PAINTING PORTRAIT.

PAINTING STYLE (CRITICAL - MUST LOOK LIKE PAINTING):
- THICK IMPASTO oil paint with visible brushstrokes and texture
- Heavy sculptural paint texture, palette knife ridges, bristle marks
- Rich glazing layers like Gainsborough, Reynolds, or Vigée Le Brun masterwork
- Visible canvas weave texture throughout
- Antique craquelure, aged varnish patina, museum-quality masterpiece
- NOT a photo - must look like authentic 300-year-old oil painting
- Dramatic Rembrandt-style lighting with luminous glow

PET IDENTITY (PRESERVE EXACTLY):
${petDescription}
- Same fur color, markings, eye color, facial features
- Same distinctive characteristics and unique features

NEW POSE & LOCATION (TRANSFORM FROM ORIGINAL):
POSE: ${selectedPose.name}
${selectedPose.description}
- ${selectedPose.bodyPosition}
- ${selectedPose.headPosition}
- ${selectedPose.pawPosition}
- Expression: ${selectedPose.expression}
- COMPLETELY NEW pose and position - NOT the same as the original photo
- Pet in a DIFFERENT location and setting from the original

COMPOSITION:
- FULL BODY visible - zoomed out, showing from head to paws
- Pet occupies 50-60% of frame height
- Plenty of headroom above ears
- Natural relaxed pose, NOT sitting upright like a statue
- Pet lying down or resting comfortably on cushion
- Simple centered composition, pet is the focus
- COMPLETELY NEW background and setting

CLOTHING (MINIMAL):
- ONE simple velvet cloak draped loosely over back/shoulders only
- Thin silver clasp at chest securing the cloak
- NO hats, NO crowns, NO headwear of any kind
- NO floating objects, NO decorative items above head
- NO excessive jewelry, NO multiple necklaces
- NO heavy robes, NO elaborate costumes
- Pet's natural body and fur mostly visible under the simple cloak

BACKGROUND (NEW SETTING):
- ${selectedPalette.background}
- Simple, elegant background - NOT elaborate architecture
- NO columns, NO staircases, NO complex interior scenes
- Focus on the pet, background should be subtle
- COMPLETELY DIFFERENT from original photo background

CUSHION:
- ${selectedPalette.cushionColor}
- Simple velvet cushion beneath the pet
- Pet resting naturally on the cushion

COLOR PALETTE "${selectedPalette.name}":
- Cloak: ${selectedPalette.cloakColor}
- Lighting: ${selectedPalette.lighting}
- Mood: ${selectedPalette.mood}
- Soft, muted, harmonious colors (not oversaturated)

FORBIDDEN ELEMENTS:
- NO hats, crowns, or headwear
- NO floating objects or decorative items
- NO elaborate architecture in background
- NO excessive jewelry or accessories
- NO weird artifacts or strange objects
- NO human clothing elements
- NO standing upright poses
- NO photo-realistic rendering
- NO modern digital look

CRITICAL: This is a ${species}. Generate ONLY a ${species}. Transform the pet into a COMPLETELY NEW pose and location while preserving exact facial features, fur color, and markings. Must look like an authentic 18th-century oil painting, NOT a photo.`;

      console.log("SD prompt length:", sdPrompt.length);
      
      // Process image for SD
      const processedForSD = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      
      // Convert to data URL format for SD models
      const sdBase64 = processedForSD.toString("base64");
      const sdDataUrl = `data:image/png;base64,${sdBase64}`;
      
      console.log(`📤 Sending image to SD model ${sdModel} (${processedForSD.length} bytes)`);
      
      try {
        firstGeneratedBuffer = await generateWithStableDiffusion(
          sdDataUrl,
          sdPrompt,
          sdModel
        );
        console.log("✅ Stable Diffusion generation complete");
      } catch (sdError) {
        console.error("❌ Stable Diffusion generation failed:", sdError);
        const errorMessage = sdError instanceof Error ? sdError.message : String(sdError);
        throw new Error(`Stable Diffusion generation failed (${sdModel}): ${errorMessage}`);
      }
    } else if (useLeonardo) {
      // ⚠️ LEONARDO AI PATH - DEV TESTING ONLY ⚠️
      console.log("🎨🎨🎨 LEONARDO AI MODE - DEV TESTING ONLY 🎨🎨🎨");
      
      const useLeonardoImg2Img = process.env.LEONARDO_IMG2IMG !== "false"; // Default to img2img
      console.log(`📌 Mode: ${useLeonardoImg2Img ? "img2img (transform pet photo)" : "text-to-image"}`);
      console.log("📌 Using Leonardo Kino XL model");
      
      const { leonardoImg2Img, leonardoTextToImage, LEONARDO_MODELS } = await import("@/lib/leonardo");
      
      // Build Leonardo prompt - focused on TRANSFORMING to oil painting style
      // The img2img will preserve pet identity, prompt should focus on STYLE TRANSFORMATION
      const leonardoPrompt = `Transform this photo into a MASTERPIECE 18th-century Victorian royal oil painting portrait.

PAINTING TRANSFORMATION (CRITICAL):
- Convert to THICK IMPASTO oil paint with visible brushstrokes
- Heavy sculptural texture, palette knife ridges, bristle marks
- Rich glazing layers like Gainsborough or Reynolds masterwork
- Antique craquelure, aged varnish patina, museum quality
- NOT a photo - must look like 300-year-old oil painting

ROYAL STYLING TO ADD:
- Elegant cream/ivory/champagne velvet cloak draped over shoulders
- Ornate gold clasp with gemstones at chest
- Layered gold chains with ruby/emerald pendant
- Luxurious velvet cushion (ruby, emerald, or sapphire)
- Dark atmospheric background (deep navy, burgundy, forest green)

LIGHTING:
- Dramatic Rembrandt-style lighting
- Luminous glow on subject
- Rich shadows, golden highlights

This is a ${species}. Keep the exact face, markings, and features of this specific pet while transforming into an aristocratic royal oil painting.`;

      console.log("📝 Leonardo prompt:", leonardoPrompt.substring(0, 300) + "...");
      
      try {
        // Strength: Higher = more transformation, Lower = more photo preservation
        // Need HIGH strength (0.8+) to actually transform into painting style
        const leonardoStrength = parseFloat(process.env.LEONARDO_STRENGTH || "0.85");
        const leonardoGuidance = parseFloat(process.env.LEONARDO_GUIDANCE || "12");
        
        console.log(`⚙️ Leonardo settings: strength=${leonardoStrength}, guidance=${leonardoGuidance}`);
        
        if (useLeonardoImg2Img) {
          console.log("🖼️ Attempting img2img generation...");
          try {
            firstGeneratedBuffer = await leonardoImg2Img(buffer, leonardoPrompt, {
              strength: leonardoStrength,
              modelId: LEONARDO_MODELS.KINO_XL,
              guidanceScale: leonardoGuidance,
              negativePrompt: "photo, photograph, realistic, modern, digital, smooth, blurry, low quality, distorted, deformed, ugly, bad anatomy, wrong animal, human, anthropomorphic, cartoon, anime, 3d render",
            });
            console.log("✅ Leonardo img2img generation complete!");
          } catch (img2imgError) {
            console.warn("⚠️ Leonardo img2img failed, falling back to text-to-image:", img2imgError);
            console.log("🖼️ Falling back to text-to-image generation...");
            firstGeneratedBuffer = await leonardoTextToImage(leonardoPrompt, {
              modelId: LEONARDO_MODELS.KINO_XL,
              guidanceScale: leonardoGuidance,
            });
            console.log("✅ Leonardo text-to-image fallback complete!");
          }
        } else {
          console.log("🖼️ Using text-to-image generation (LEONARDO_IMG2IMG=false)...");
          firstGeneratedBuffer = await leonardoTextToImage(leonardoPrompt, {
            modelId: LEONARDO_MODELS.KINO_XL,
            guidanceScale: leonardoGuidance,
          });
          console.log("✅ Leonardo text-to-image generation complete!");
        }
      } catch (leonardoError) {
        console.error("❌ Leonardo generation failed:", leonardoError);
        const errorMessage = leonardoError instanceof Error ? leonardoError.message : String(leonardoError);
        throw new Error(`Leonardo generation failed: ${errorMessage}`);
      }
    } else if (useOpenAIImg2Img) {
      // Use OpenAI img2img for primary generation
      console.log("🎨 Using OpenAI img2img (images.edit) for primary generation...");
      console.log("📌 Pet identity will be preserved from original image");
      console.log("📌 Transforming pet photo directly into late 18th-century aristocratic portrait");
      
      // Create a focused prompt for OpenAI img2img
      // OpenAI's images.edit works best with SHORT, CLEAR instructions
      // Priority: preserve pet identity first, then add minimal styling
      // Extract key identifying features from description for better preservation
      const keyFeatures = petDescription.length > 200 
        ? petDescription.substring(0, 200) + "..."
        : petDescription;
      
      // CRITICAL: Explicitly state the species multiple times to prevent wrong animal generation
      const speciesEnforcement = species === "CAT" 
        ? "CRITICAL: This is a CAT. Generate ONLY a CAT. DO NOT generate a dog. This MUST be a CAT."
        : species === "DOG"
        ? "CRITICAL: This is a DOG. Generate ONLY a DOG. DO NOT generate a cat. This MUST be a DOG."
        : `CRITICAL: This is a ${species}. Generate ONLY a ${species}.`;
      
      // Use the same robust detection logic (petDescription already updated with "black" if needed)
      const petDescLowerForOpenAI = petDescription.toLowerCase();
      const isWhiteCatForOpenAI = species === "CAT" && (
        petDescLowerForOpenAI.includes("white") || 
        petDescLowerForOpenAI.includes("snow white") ||
        petDescLowerForOpenAI.includes("pure white")
      );
      
      // Check if GREY cat - CRITICAL: Grey cats often get turned white/cream
      const isGreyCatForOpenAI = species === "CAT" && (
        petDescLowerForOpenAI.includes("grey") ||
        petDescLowerForOpenAI.includes("gray") ||
        petDescLowerForOpenAI.includes("russian blue") ||
        petDescLowerForOpenAI.includes("chartreux") ||
        petDescLowerForOpenAI.includes("british shorthair") ||
        petDescLowerForOpenAI.includes("korat") ||
        petDescLowerForOpenAI.includes("nebelung") ||
        petDescLowerForOpenAI.includes("blue cat") ||
        petDescLowerForOpenAI.includes("silver") ||
        petDescLowerForOpenAI.includes("slate") ||
        petDescLowerForOpenAI.includes("ash") ||
        petDescLowerForOpenAI.includes("smoky") ||
        petDescLowerForOpenAI.includes("blue-grey") ||
        petDescLowerForOpenAI.includes("blue-gray")
      );
      
      // Check if black cat or dark-coated pet - use same logic as main detection
      const descSaysBlackForOpenAI = (
        petDescLowerForOpenAI.includes("black") ||
        petDescLowerForOpenAI.includes("ebony") ||
        petDescLowerForOpenAI.includes("jet black") ||
        petDescLowerForOpenAI.includes("coal black") ||
        petDescLowerForOpenAI.includes("charcoal") ||
        petDescLowerForOpenAI.includes("dark brown")
      );
      
      const isBlackCatForOpenAI = species === "CAT" && (
        descSaysBlackForOpenAI || 
        (imageDarkness.isDark && !petDescLowerForOpenAI.includes("white") && !petDescLowerForOpenAI.includes("light"))
      );
      
      const isDarkCoatedForOpenAI = (
        descSaysBlackForOpenAI ||
        (imageDarkness.isDark && !petDescLowerForOpenAI.includes("white") && !petDescLowerForOpenAI.includes("light"))
      ) && !petDescLowerForOpenAI.includes("white");
      
      const feminineAestheticForOpenAI = gender === "female" ? `
=== FEMININE AESTHETIC ===
This is a FEMALE ${species} - apply feminine aesthetic:
- LIGHTER, SOFTER cloak colors - pastel pinks, lavenders, soft blues, pearl whites
- DELICATE fabrics - fine, refined, gentle textures
- FINER jewelry - more delicate, smaller gems, intricate filigree
- GENTLER visual tone - softer lighting, more graceful composition
- Overall elegant feminine refinement
` : "";

      const masculineAestheticForOpenAI = gender === "male" ? `
=== REFINED MASCULINE AESTHETIC ===
This is a MALE ${species} - apply a SOFTENED, ELEGANT masculine aesthetic:
- SOFT yet distinguished cloak colors - dusty blues, soft sage, muted burgundy, warm cream, gentle navy
- AVOID harsh or overly bold colors - no bright reds, no stark blacks alone
- REFINED fabrics with SOFT textures - velvet with gentle sheen, NOT stiff or harsh
- ELEGANT jewelry with subtle sophistication - gold chains with pearls, refined gemstones
- Light FEMININE ACCENTS are welcome - soft pastels, delicate embroidery, pearl details
- GENTLE, WARM lighting - soft and inviting, NOT dramatic or harsh
- Overall look should be ELEGANT and REFINED, not rugged or overly masculine
- Think "gentle nobleman" NOT "warrior king"
` : "";

      const whiteCatTreatmentForOpenAI = isWhiteCatForOpenAI ? `
=== WHITE CAT - ANGELIC LUMINOUS TREATMENT ===
This is a WHITE CAT - apply angelic luminous aesthetic:
- ANGELIC appearance - ethereal, heavenly, divine
- LUMINOUS glow that enhances white fur - soft radiant light
- SOFT GLOW around the entire cat - gentle radiance
- Enhanced presence - the white cat should GLOW with light
- More luminous than other pets - special angelic treatment
` : "";

      const greyCatTreatmentForOpenAI = isGreyCatForOpenAI ? `
=== GREY CAT - CRITICAL COLOR PRESERVATION ===
This is a GREY/GRAY CAT - CRITICAL: Preserve the EXACT GREY fur color:
- The cat MUST remain GREY/GRAY - NEVER white, cream, beige, or golden
- Preserve the COOL GREY/BLUE-GREY fur tone exactly as in the reference
- This cat has GREY fur - NOT white, NOT cream, NOT golden
- Maintain the distinctive COOL GREY/SILVER/SLATE tone throughout
- DO NOT warm up the colors - keep the COOL GREY tones
- DO NOT brighten to white or cream - maintain GREY
- Any highlights should be silvery-grey, NOT warm or golden
` : "";
      
      const blackCatTreatmentForOpenAI = isBlackCatForOpenAI || isDarkCoatedForOpenAI ? `
=== BLACK/DARK-COATED PET - CRITICAL COLOR PRESERVATION ===
This is a ${isBlackCatForOpenAI ? "BLACK CAT" : "DARK-COATED PET"} - CRITICAL: Preserve the DEEP BLACK/DARK color:
- The pet MUST remain DEEP BLACK or DARK BROWN - NEVER white, gray, or light colored
- Preserve RICH DEEP BLACK fur color throughout - maintain dark tones
- Use SUBTLE highlights ONLY - gentle rim lighting that doesn't wash out the black
- DEEP SHADOWS are correct - black pets have darker shadows naturally
- AVOID over-brightening - maintain the pet's natural dark coloration
- The black/dark color is ESSENTIAL to the pet's identity - preserve it exactly
- Use contrast with lighter backgrounds/cloaks to make the black fur stand out
- DO NOT lighten or brighten the fur color - keep it DEEP and RICH BLACK/DARK
` : "";

      // RAINBOW BRIDGE MEMORIAL PORTRAIT PROMPT
      // Used when style === "rainbow-bridge" for memorial portraits of pets who have passed
      const rainbowBridgePrompt = isRainbowBridge ? `${speciesEnforcement} DO NOT change the ${species} at all - keep it exactly as shown in the original image. This is a ${species}, not any other animal.

RAINBOW BRIDGE MEMORIAL PORTRAIT - Heavenly, angelic tribute to a beloved pet who has crossed the Rainbow Bridge.

=== CRITICAL PET PRESERVATION ===
- Preserve the face structure, skull shape, snout proportions EXACTLY from the original
- Keep all markings, colors, fur patterns in their EXACT locations
- Maintain the exact eye color, shape, spacing, and expression
- Preserve ear shape, size, and position exactly
- The pet's unique identifying features must remain unchanged
- This is a memorial - accuracy is paramount

=== HEAVENLY/ANGELIC AESTHETIC ===
- ETHEREAL, peaceful, serene atmosphere
- SOFT GLOWING LIGHT surrounding the pet - gentle radiance
- ANGELIC appearance - divine, heavenly, peaceful
- SOFT WHITES and CREAMS dominate the palette
- Gentle pastel rainbow colors subtly present (soft pink, peach, lavender, mint, sky blue)
- LUMINOUS quality throughout - pet appears to glow with inner light
- Peaceful, content expression - at rest in a better place
- Soft, diffused lighting with no harsh shadows
- Dream-like, ethereal quality

=== BACKGROUND VARIATIONS ===
VARY THE COMPOSITION - Use different heavenly settings:
- OPTION 1: Pet sitting or resting on a SOFT CLOUD PILLOW - fluffy, ethereal clouds that look like a comfortable cushion
- OPTION 2: Pet surrounded by gentle HEAVENLY MIST with soft clouds drifting
- OPTION 3: Pet in a field of soft LUMINOUS FLOWERS or petals floating gently
- OPTION 4: Pet on a SOFT GOLDEN LIGHT PLATFORM with ethereal mist below
- SOFT, GLOWING background - creamy whites, pale golds, gentle pastels
- VERY SUBTLE rainbow arc or prismatic light in background (gentle, not overwhelming)
- Soft light rays filtering through clouds
- NO dark elements - all light and peaceful
- Ethereal, heavenly atmosphere

=== COMPOSITION (ZOOMED OUT, Natural Resting Pose) ===
- ZOOMED OUT FRAMING - show MORE of the pet's body, not just head/shoulders
- CENTERED portrait composition with space around the pet
- Pet appears peaceful and serene
- SITTING or RESTING NATURALLY on the cloud/surface - NEVER standing upright like a human
- Pet should be clearly seated or lying down comfortably on the cloud pillow
- Natural resting pose - sitting, curled up, or lying down peacefully
- Show from head to paws - wide framing, NOT a close-up
- SOFT GLOW around the pet like a halo or aura
- No royal elements (no thrones, cloaks, jewelry)
- Simple, elegant, heavenly setting
- Pet looks comfortable and at peace in their resting position

=== LIGHTING ===
- SOFT, DIFFUSED heavenly light
- Gentle glow emanating from and around the pet
- NO harsh shadows - soft and peaceful
- Warm, golden undertones
- Ethereal rim lighting creating angelic glow
- Pet appears to be bathed in soft light
- Light filtering through clouds creates soft dappled effect

=== SIGNATURE THICK OIL-PAINT TEXTURE (Heavenly Yet Tactile) ===
This must look like a HIGH-END PHYSICAL OIL PAINTING that was PROFESSIONALLY SCANNED:

THICK SCULPTURAL IMPASTO:
- HEAVY, RAISED paint peaks - thick 3D paint texture even in ethereal clouds
- SCULPTURAL paint application on fur highlights and cloud formations
- Visible PAINT RIDGES creating physical depth in heavenly light
- THICK BUTTERY strokes with paint that has BODY and WEIGHT
- Impasto highlights that CATCH THE LIGHT like real raised paint

VISIBLE BRUSH BRISTLE MARKS:
- Individual BRISTLE TRACKS embedded in paint - clouds, fur, light rays
- Directional brushwork following the form - soft and ethereal yet textured
- FEATHERY brush edges creating soft, dreamy transitions

PROFESSIONALLY SCANNED ARTWORK QUALITY:
- High-resolution detail capturing every paint texture
- Museum archival quality reproduction
- Soft, dreamy, ethereal feel WITH visible paint texture
- The tactile quality of a $50,000 original memorial painting
- Classical technique like Gainsborough or Reynolds but heavenly
- NOT hyper-realistic - soft, artistic, PAINTED with visible texture

CRITICAL: The ${species} must look EXACTLY like the original photo - this is a memorial portrait. Vary the composition (sometimes on cloud pillow, sometimes floating, sometimes in mist). Use visible brushstrokes and painterly technique throughout. The pet should appear peaceful, serene, and surrounded by heavenly light. Create a beautiful, varied, painterly tribute that brings comfort.` : null;

      // Add framing prefix for large dogs in OpenAI img2img
      const largeDogImg2ImgPrefix = isLargeDog ? `
*** MANDATORY FRAMING FOR LARGE DOG ***
This is a LARGE DOG breed. You MUST create a WIDE SHOT showing the dog from a distance.
- Show the FULL dog: head, ears, neck, chest, front legs, and cushion
- The dog should be SMALL in the frame - occupying only 60-70% of image height
- Leave LOTS of empty background space ABOVE the ears (at least 15-20% of image)
- Frame like a "full body sitting portrait" NOT a "head close-up"
- ABSOLUTELY DO NOT crop the top of the head or ears
*** END MANDATORY FRAMING ***

` : "";
      
      const openAIImg2ImgPrompt = isRainbowBridge ? rainbowBridgePrompt! : `${largeDogImg2ImgPrefix}
CRITICAL SPECIES LOCK
This is a ${species}. Generate ONLY a real ${species}. No human features, no hybrids, no upright poses, no anthropomorphism. Natural animal anatomy only. Do NOT generate: ${notSpecies}.

STUNNINGLY BEAUTIFUL COMPOSITION (CRITICAL FOR GORGEOUS RESULT)
Apply classical golden ratio and rule of thirds for visually pleasing placement. Use GORGEOUS Rembrandt-style chiaroscuro lighting with beautiful interplay of light and shadow. Strong luminous rim lighting on fur edges creating a halo effect. Create atmospheric depth with soft background and sharp subject focus. Sophisticated color harmony with complementary accents. Elegant negative space drawing focus to the pet. Rich textural contrasts - soft fur against smooth velvet, matte fabric against gleaming jewelry. Professional studio lighting quality. MUSEUM-QUALITY aesthetic that belongs in the Louvre or National Gallery. ROMANTIC atmosphere with dreamy quality and warm golden tones. Perfect visual balance throughout. Every element contributes to SUBLIME BEAUTY.

BRIGHTNESS & VICTORIAN ELEGANCE
The overall image must be BRIGHTER and more luminous than typical portraits. Increase light on the subject significantly. The aesthetic must be distinctly VICTORIAN—refined, romantic, elegant, with intricate details, delicate ornamentation, and graceful sophistication throughout.

MASTER STYLE
BREATHTAKINGLY BEAUTIFUL 18th-century European aristocratic oil portrait with bright, luminous lighting on the subject and a softer, elegant background. Maintain a regal, elegant, historically authentic Victorian atmosphere with GORGEOUS refined composition and classical staging.
Increase overall ornateness and incorporate stronger Victorian-royal influence throughout—the environment, fabrics, patterns, textures, and decorative elements should feel more lavish, detailed, and aristocratic. The composition should be SO BEAUTIFUL it takes the viewer's breath away.

PAINTING TECHNIQUE – EXTREMELY THICK, SCULPTURAL OIL
Use VERY THICK, HEAVILY TEXTURED oil paint with dramatic impasto buildup. Brush strokes must be BOLD, RAISED, and SCULPTURAL—visible ridges, thick paint peaks, heavy bristle marks, and palette-knife textures. The paint should look like it could be touched—physical, 3D, and deeply layered. Every stroke must be visibly hand-painted with thick, rich pigment.

EXTREMELY HEAVY PAINTERLY FACIAL TREATMENT (CRITICAL - MUST OBSCURE FACE):
Apply EXTREMELY HEAVY painterly texture and VERY BOLD, THICK brushstrokes to the ENTIRE face and head - SIGNIFICANTLY MORE than the rest of the image. HEAVILY OBSCURE all facial details with thick visible brushstrokes - the face should look like an IMPRESSIONIST PAINTING (MONET, RENOIR, VAN GOGH close-up), not a photograph. Use VERY LOOSE, EXPRESSIVE brushwork that BREAKS UP and FRAGMENTS facial features. BLUR and SOFTEN all facial transitions - no sharp edges. Apply EXTREMELY THICK impasto texture - CHUNKY raised paint on nose, eyes, cheeks, muzzle. Create a STRONG ARTISTIC ABSTRACTION - see PAINT STROKES first, subject second. EVERY DETAIL SOFTENED and OBSCURED by visible brushwork. Let brushstrokes CREATE THE FACE rather than trace it. HEAVILY TEXTURED fur with directional brushstrokes blending into facial features. The face should feel ALMOST ABSTRACT - recognizable through overall shape and color essence, NOT precise photographic detail. MAXIMUM PAINTERLY EFFECT - if it looks too photographic, ADD MORE BRUSHSTROKES AND TEXTURE.

ANTIQUE AGING
Soft craquelure, warm aged varnish glow, and light edge wear. Maintain elegance.

COLOR PALETTE
A unique palette each generation. Backgrounds remain darker. Cloaks and royal garments should use refined, luminous tones. Colors must enhance the pet and those garments.

IDENTITY PRESERVATION
The portrait must be unmistakably THIS exact pet. Preserve all facial structure, markings, eye shape, proportion, coloring, gradients, asymmetry, snout shape, and ear position. Do not alter markings or colors.

ENHANCED ROYAL ENVIRONMENT & PILLOW REQUIREMENTS:

Pillows must frequently appear in different colors, not repeating the same tones each generation.

Use brighter, richer, more vibrant colors for pillows (ruby, sapphire, emerald, amethyst, gold, teal, rose, turquoise).

Pillows should feature ornate Victorian royal patterns such as brocade, damask, embroidered gold thread, floral scrollwork, or regal geometric motifs.

Textures may include velvet, silk, embroidered linen, or other noble materials.

Pillow patterns and colors must elevate the royal atmosphere and amplify the Victorian opulence of the portrait.

ROYAL WARDROBE – CLOAK, GARMENTS, AND CLASP
The pet rests naturally on ${cushion}. A ${robe} is draped over its back as a true cloak.

ELEGANCE REQUIREMENT:
Clothing must be exceptionally elegant, royal, and luxurious, reflecting the highest aristocratic fashion of the 18th century.
The cloak and garments must feel crafted for nobility, using only rich, refined, elevated materials.
Increase overall Victorian-royal refinement: more ornate trims, subtle baroque motifs, elevated textile complexity when appropriate.

CLOAK REQUIREMENTS:

Cloak must be lighter-colored, luminous, elegant, and visually stunning

Colors may include: cream, ivory, pale gold, champagne, silver-blue, sky blue, soft rose, light lavender

Silky or satin-like with flowing, graceful folds and natural sheen

Embroidery, woven patterns, or subtle embellishments encouraged when appropriate

Cloak must elevate the portrait to a royal, high-status appearance

CLOAK FASTENING – THIN SILVER CHAIN:

The cloak MUST ALWAYS be held in place by a VERY THIN, DELICATE SILVER CHAIN

This chain must be fine, elegant, and beautiful—like Victorian jewelry chain

The chain connects across the upper chest, securing the cloak gracefully

Use polished 925 sterling silver with a bright, gleaming finish

The chain should be almost thread-like, never thick or heavy

Optional: a small ornate clasp or decorative element where the chain meets

JEWELRY REQUIREMENTS – DAINTY VICTORIAN ELEGANCE:

CRITICAL: Chains must be VERY THIN, FINE, and DELICATE—like real Victorian jewelry
NEVER use thick chains, chunky links, or heavy rope chains
Chains should be almost thread-like, elegant, barely-there fine metalwork

Beautiful gemstones: sapphires, rubies, emeralds, amethysts, pearls, and diamonds

Designs inspired by Victorian-era jewelry: cameos, lockets, delicate pendants, intricate metalwork

Use polished gold or 925 sterling silver with fine, graceful craftsmanship

JEWELRY BEAUTY & SHINE:
Jewelry must be exceptionally beautiful with a refined, feminine elegance

VERY FINE, THIN chains (like delicate thread) with brilliant gemstones

Intricate Victorian filigree, scrollwork, or floral metalwork patterns

Gemstones must sparkle with high brilliance and clarity

The overall feel should be precious, graceful, and romantically Victorian

JEWELRY STYLE:
The pet wears delicate Victorian-style jewelry:

ULTRA-FINE chain necklaces—thin, elegant, graceful (NEVER thick or chunky)

A beautiful pendant with gemstones in ornate Victorian settings

Optional: delicate pearl strands, cameo brooches, or filigree pieces

Jewelry rests naturally on the chest, complementing the cloak

Overall design feels refined, precious, and aristocratically handcrafted

CLOAK CLASP REQUIREMENT (MATCH REFERENCE):
The cloak clasp must closely match the style shown:

A round, ornate, polished metal clasp (gold or 925 silver)

Embossed/engraved aristocratic detailing

High-shine finish with strong reflections

Sits at the chest in the same placement/scale as in the reference

Must look luxurious, heavy, ceremonial, and regal

CLOAK STYLE REQUIREMENT (MATCH REFERENCE):
The cloak must follow the same construction style and silhouette as the reference while changing colors each generation:

Rich, noble fabric with deep folds, heavy drape, and elegant weight

Detailed gold filigree or baroque patterns similar to the example

Ermine-style fur trim with black spots, thick texture, and natural variation

Cloak must feel ceremonial, royal, Victorian/18th-century, and powerfully ornate

Cloak color should change frequently (deep blue, crimson, emerald, purple, gold, etc.)

Maintain a consistent luxury level matching the reference image

COMPOSITION – SUBJECT OFTEN FARTHER AWAY
The pet must not always be close-up. Frequently show:

The subject farther away

More body visible

More cloak, garments, clasp, ornate pillows, and decorative environment

Classical portrait composition with richer, elaborate staging

POSE REQUIREMENT – RELAXED, NATURAL, RENAISSANCE-LIKE
The pet should often appear in a serene, natural pose:

Relaxed posture

Calm, candid presence

Graceful, Renaissance-inspired positioning
Avoid stiff or rigid posing.

Use provided variables:
${compositionInstructions}
${poseInstructions}
${facialStructureSection}

PET DESCRIPTION
Follow all provided details exactly:
${petDescription}${genderInfo}${feminineAestheticForOpenAI}${masculineAestheticForOpenAI}${whiteCatTreatmentForOpenAI}${greyCatTreatmentForOpenAI}${blackCatTreatmentForOpenAI}${agePreservationInstructions}

OVERALL GOAL
A luminous, regal antique oil portrait with extremely thick, dimensional paint; darker backgrounds; ornate Victorian styling; extremely detailed jewelry and cloaks modeled after the reference; vibrant ornate pillows; a rich composition showing more of the figure; and a serene Renaissance-inspired natural pose.
The portrait must remain instantly recognizable as this specific pet.`;

      // Add custom prompt for studio mode
      const finalOpenAIPrompt = customPrompt 
        ? `${openAIImg2ImgPrompt}\n\n=== ADDITIONAL CUSTOM GUIDANCE ===\n${customPrompt}`
        : openAIImg2ImgPrompt;
      
      if (customPrompt) {
        console.log("🎨 Custom prompt added:", customPrompt);
      }
      
      // Process the original image buffer for OpenAI
      const processedForOpenAI = await sharp(buffer)
        .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
        .png()
        .toBuffer();
      
      firstGeneratedBuffer = await generateWithOpenAIImg2Img(
        processedForOpenAI,
        finalOpenAIPrompt,
        openai
      );
      
      console.log("✅ OpenAI img2img generation complete");
    } else if (useComposite) {
      // Use composite approach for maximum identity preservation
      // This system: segments pet → generates scene → composites → harmonizes
      console.log("🎨 Using Composite Approach (BEST for identity preservation)...");
      console.log("📌 Step 1: Segment pet from background (preserves exact pet)");
      console.log("📌 Step 2: Generate royal scene (with pose/palette context)");
      console.log("📌 Step 3: Composite pet onto scene");
      console.log("📌 Step 4: Harmonize with painterly effects");
      
      firstGeneratedBuffer = await generateCompositePortrait(
        base64Image,
        species,
        openai,
        selectedPose,
        selectedPalette
      );
      
      console.log("✅ Composite portrait complete");
    } else if (useStyleTransfer) {
      // Use style transfer - preserves 88%+ of pet identity
      console.log("🎨 Using Style Transfer (SDXL low-denoise)...");
      console.log("📌 Pet photo will be transformed to oil painting style");
      
      // Stage 1: Apply style transfer for identity preservation
      const styleTransferBuffer = await applyStyleTransfer(base64Image);
      console.log("✅ Style transfer complete (Stage 1)");
      
      // Stage 2: GPT Refinement for quality enhancement (if enabled)
      const enableGptRefinement = process.env.ENABLE_GPT_REFINEMENT !== "false"; // Default to true
      
      if (enableGptRefinement) {
        console.log("🎨 Applying GPT-Image-1 refinement (Stage 2)...");
        console.log("📌 Enhancing quality while preserving identity");
        
        // Create enhancement prompt - focus on quality, keep the subject unchanged
        const enhancementPrompt = `Transform this into a beautiful Victorian royal portrait of a ${species}.

BACKGROUND - MAKE IT BEAUTIFUL:
- Create a LIGHTER, more luminous background - soft creams, warm ivories, gentle golden tones
- NOT dark or gloomy - bright and elegant like a sunlit palace
- Add elegant royal elements: plush cushion, luxurious velvet robe draped nearby, ornate gold details
- Soft, diffused late 18th-century portrait lighting throughout
- Beautiful color palette: soft golds, warm creams, touches of deep red velvet and teal

ADD ROYAL ELEMENTS TO THE ${species.toUpperCase()}:
- Elegant pearl necklace with ruby or sapphire pendant around neck
- Perhaps a delicate gold chain or royal collar
- The ${species} should look regal and noble

PAINTING STYLE:
- Classical Flemish/Dutch Golden Age oil painting
- Rich brushstroke texture, visible impasto
- Museum masterpiece quality
- Warm, inviting, elegant atmosphere

CRITICAL - PRESERVE THE ${species.toUpperCase()}'S IDENTITY:
- Keep the ${species}'s exact face, markings, and colors
- The ${species} must be recognizable as the same animal
- Maintain the natural proportions

This is a ${detectedBreed || species}. Create a royal portrait with a LIGHT, BEAUTIFUL background.`;

        try {
          // Create a File object from the buffer for OpenAI API
          // Convert Buffer to Uint8Array for Blob compatibility
          const uint8Array = new Uint8Array(styleTransferBuffer);
          const imageBlob = new Blob([uint8Array], { type: "image/png" });
          const imageFile = new File([imageBlob], "style_transfer.png", { type: "image/png" });
          
          const refinementResponse = await openai.images.edit({
            model: "gpt-image-1",
            image: imageFile,
            prompt: enhancementPrompt,
            n: 1,
            size: "1024x1024",
          });
          
          const refinedData = refinementResponse.data?.[0];
          if (refinedData?.b64_json) {
            firstGeneratedBuffer = Buffer.from(refinedData.b64_json, "base64");
            console.log("✅ GPT refinement complete (Stage 2)");
          } else if (refinedData?.url) {
            const downloadResponse = await fetch(refinedData.url);
            if (!downloadResponse.ok) throw new Error(`Failed to download refined image: ${downloadResponse.status}`);
            firstGeneratedBuffer = Buffer.from(await downloadResponse.arrayBuffer());
            console.log("✅ GPT refinement complete (Stage 2)");
          } else {
            console.log("⚠️ GPT refinement returned no data, using style transfer result");
            firstGeneratedBuffer = styleTransferBuffer;
          }
        } catch (gptError) {
          console.error("⚠️ GPT refinement failed, using style transfer result:", gptError);
          firstGeneratedBuffer = styleTransferBuffer;
        }
      } else {
        console.log("📌 GPT refinement disabled, using style transfer result only");
        firstGeneratedBuffer = styleTransferBuffer;
      }
    } else if (useIPAdapter) {
      // Use IP-Adapter for identity preservation
      console.log("🎨 Using IP-Adapter SDXL for identity-preserving generation...");
      console.log("📌 Pet identity extracted from reference image");
      console.log("📌 No fallback - if Replicate fails, generation fails");
      
      // IP-Adapter prompt focuses ONLY on style/scene - identity comes from reference image
      const ipAdapterPrompt = `A majestic royal late 18th-century European aristocratic oil painting portrait of a ${species}. Georgian/Regency/Napoleonic era style (1770-1830).

PAINTING STYLE:
Classical oil painting with visible brushstrokes, rich impasto texture, luminous glazing.
Late 18th-century technique like Gainsborough, Reynolds, or Vigée Le Brun (1770-1830 Georgian/Regency/Napoleonic era).
Museum-quality fine art, dramatic lighting, rich colors.

COMPOSITION:
Seated NATURALLY like a real ${species} on ${cushion} - NOT human-like pose.
With ${robe} DRAPED over its back - NOT clothing, just draped fabric. NO human clothing elements.
BRIGHT POLISHED SILVER CLOAK CLASP at upper chest SECURING THE CLOAK CLOSED - two GLEAMING SHINY silver plates connected by BRIGHT silver chain, HIGHLY REFLECTIVE polished silver that catches the light.
Adorned with ${jewelryItem}.
${background}.
${lighting}.
Full body portrait, natural animal seated pose, all four paws visible.

The ${species} should match the reference image exactly - same face, markings, colors, and expression. CRITICAL: ${species} must sit NATURALLY like a real ${species} - NOT human-like pose. NO human clothing - ONLY a cloak draped over with decorative clasp.`;

      // No fallback - if IP-Adapter fails, we fail
      firstGeneratedBuffer = await generateWithIPAdapter(
        base64Image,
        ipAdapterPrompt
      );
      
      console.log("✅ IP-Adapter generation complete");
    } else {
      // Use GPT-Image-1 (original approach)
      console.log("🎨 Using GPT-Image-1 for generation...");
      
      // Add custom prompt for studio mode
      const finalGptPrompt = customPrompt 
        ? `${generationPrompt}\n\n=== ADDITIONAL CUSTOM GUIDANCE ===\n${customPrompt}`
        : generationPrompt;
      
      if (customPrompt) {
        console.log("🎨 Custom prompt added:", customPrompt);
      }
      
      const imageResponse = await openai.images.generate({
        model: "gpt-image-1",
        prompt: finalGptPrompt,
        n: 1,
        size: "1024x1024",
        quality: "high",
      });

      const imageData = imageResponse.data?.[0];

      if (!imageData) {
        throw new Error("No image generated");
      }

      // Handle both base64 (gpt-image-1) and URL (dall-e-3) responses
      if (imageData.b64_json) {
        console.log("Processing base64 image from gpt-image-1...");
        firstGeneratedBuffer = Buffer.from(imageData.b64_json, "base64");
      } else if (imageData.url) {
        console.log("Downloading image from URL...");
        const downloadResponse = await fetch(imageData.url);
        if (!downloadResponse.ok) {
          throw new Error(`Failed to download image: ${downloadResponse.status}`);
        }
        const arrayBuffer = await downloadResponse.arrayBuffer();
        firstGeneratedBuffer = Buffer.from(arrayBuffer);
      } else {
        throw new Error("No image data in response");
      }
    }
    } // Close the single-pet else block
    
    console.log("✅ Stage 1 complete: First portrait generated");
    
    // STAGE 2: Compare and refine (disabled by default for faster generations)
    // Set ENABLE_TWO_STAGE_GENERATION=true to enable refinement pass
    const enableTwoStage = process.env.ENABLE_TWO_STAGE_GENERATION === "true"; // Default: disabled for speed
    let finalGeneratedBuffer: Buffer = firstGeneratedBuffer; // Fallback to first if refinement fails
    let refinementUsed = false;
    
    if (enableTwoStage) {
      try {
        console.log("=== Starting Stage 2: Comparison and Refinement ===");
        const refinementPrompt = await compareAndRefine(
          openai,
          buffer, // Original pet photo
          firstGeneratedBuffer, // First generated portrait
          petDescription,
          species
        );
      
      if (refinementPrompt && refinementPrompt.length > 100) {
        console.log("Refinement prompt received, generating refined portrait...");
        
        // Create refined generation prompt combining original prompt with corrections
        // Truncate refinement prompt if too long (API limits)
        const maxRefinementLength = 2000;
        const truncatedRefinement = refinementPrompt.length > maxRefinementLength 
          ? refinementPrompt.substring(0, maxRefinementLength) + "..."
          : refinementPrompt;
        
        const refinedGenerationPrompt = `${generationPrompt}

=== REFINEMENT STAGE - CRITICAL CORRECTIONS FROM COMPARISON ===
This is a SECOND PASS refinement. The first generation was compared with the original pet photo, and these specific corrections were identified:

${truncatedRefinement}

CRITICAL: The refined portrait MUST address EVERY correction listed above. This is your opportunity to fix all discrepancies and create a portrait that matches the original pet photo EXACTLY. Pay special attention to:
- Markings and their exact locations
- Color accuracy
- Face proportions
- Expression and unique features

Generate a refined portrait that addresses ALL corrections and matches the original pet photo with exceptional accuracy.`;
        
        // Generate refined image
        const refinedImageResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: refinedGenerationPrompt,
          n: 1,
          size: "1024x1024",
          quality: "high",
        });
        
        const refinedImageData = refinedImageResponse.data?.[0];
        
        if (refinedImageData) {
          if (refinedImageData.b64_json) {
            finalGeneratedBuffer = Buffer.from(refinedImageData.b64_json, "base64");
            refinementUsed = true;
            console.log("✅ Stage 2 complete: Refined portrait generated");
          } else if (refinedImageData.url) {
            const downloadResponse = await fetch(refinedImageData.url);
            if (downloadResponse.ok) {
              const arrayBuffer = await downloadResponse.arrayBuffer();
              finalGeneratedBuffer = Buffer.from(arrayBuffer);
              refinementUsed = true;
              console.log("✅ Stage 2 complete: Refined portrait downloaded");
            }
          }
        }
        } else {
          console.log("⚠️ Refinement prompt too short or empty, using first generation");
        }
      } catch (refinementError) {
        console.error("⚠️ Refinement stage failed, using first generation:", refinementError);
        // Continue with first generation as fallback
      }
    } else {
      console.log("Two-stage generation disabled, using first generation only");
    }
    
    // Use the final buffer (refined if available, otherwise first)
    let generatedBuffer = finalGeneratedBuffer;
    console.log(`Using ${refinementUsed ? "refined" : "first"} generation for final output`);

    // Enhance image (brighten + sharpen) - disabled by default, enable with ENABLE_ENHANCE=true
    const enableEnhance = process.env.ENABLE_ENHANCE === "true"; // Default to false
    
    if (enableEnhance) {
      console.log("=== ENHANCEMENT ENABLED (via env) ===");
      try {
        generatedBuffer = await enhanceImage(generatedBuffer);
        console.log("✅ Image enhanced successfully (brighter + sharper)");
      } catch (enhanceError) {
        console.error("Enhancement failed, using original:", enhanceError);
      }
    } else {
      console.log("Enhancement disabled (default - enable with ENABLE_ENHANCE=true)");
    }

    // Upscale image for higher resolution - enabled by default, disable with ENABLE_UPSCALE=false
    const enableUpscale = process.env.ENABLE_UPSCALE !== "false"; // Default to true
    const upscaleScale = parseInt(process.env.UPSCALE_SCALE || "2"); // 2x or 4x
    
    if (enableUpscale) {
      console.log("=== UPSCALE ENABLED (default) ===");
      console.log(`Upscaling by ${upscaleScale}x...`);
      try {
        generatedBuffer = await upscaleImage(generatedBuffer, upscaleScale);
        console.log("✅ Image upscaled successfully");
      } catch (upscaleError) {
        console.error("Upscale failed, using original resolution:", upscaleError);
        // Continue with original buffer
      }
    } else {
      console.log("Upscale disabled (ENABLE_UPSCALE=false)");
    }

    // For Rainbow Bridge, select a quote (text overlay is rendered client-side for reliable font support)
    let selectedQuote: string | null = null;
    
    console.log(`🌈 Rainbow Bridge check: isRainbowBridge=${isRainbowBridge}, petName="${petName}", style="${style}"`);
    if (isRainbowBridge) {
      // Select a random quote to send to client for Canvas rendering
      selectedQuote = RAINBOW_BRIDGE_QUOTES[Math.floor(Math.random() * RAINBOW_BRIDGE_QUOTES.length)];
      console.log(`🌈 Rainbow Bridge portrait - quote selected: "${selectedQuote}"`);
      console.log(`   Pet name: "${petName}" (text overlay will be rendered by client and uploaded)`);
    }

    // Create preview (watermarked for free and pack credits, un-watermarked for secret credit or studio mode)
    // NOTE: The generation model used above is IDENTICAL for all types (free, pack credit, secret credit).
    // The $5 pack gives watermarked generations - only secret credit is un-watermarked (for testing).
    let previewBuffer: Buffer;
    if (useSecretCredit) {
      // Un-watermarked preview ONLY for secret credit (testing)
      previewBuffer = generatedBuffer;
      console.log("Using secret credit - generating un-watermarked image for testing");
    } else if (studioMode && !enableWatermark) {
      // Studio mode with watermarks disabled
      previewBuffer = generatedBuffer;
      console.log("🎨 Studio mode - generating un-watermarked image");
    } else if (studioMode && enableWatermark) {
      // Studio mode with watermarks enabled
      previewBuffer = await createWatermarkedImage(generatedBuffer);
      console.log("🎨 Studio mode - generating watermarked image");
    } else {
      // Watermarked preview for free generations AND pack credits ($5 pack = watermarked)
      previewBuffer = await createWatermarkedImage(generatedBuffer);
      if (usePackCredit) {
        console.log("Using pack credit ($5 pack) - creating watermarked preview");
      } else {
        console.log("Free generation - creating watermarked preview");
      }
    }

    // Upload HD image to Supabase Storage (always un-watermarked, without text)
    // Note: For Rainbow Bridge, the client will upload the text-overlay version separately
    console.log(`📤 Uploading HD image to pet-portraits bucket: ${imageId}-hd.png${isRainbowBridge ? ' (Rainbow Bridge)' : ''}`);
    let hdUrl: string;
    try {
      hdUrl = await uploadImage(
        generatedBuffer,
        `${imageId}-hd.png`,
        "image/png"
      );
      console.log(`✅ HD image uploaded successfully: ${hdUrl.substring(0, 80)}...`);
    } catch (uploadError) {
      console.error("❌ Failed to upload HD image:", uploadError);
      throw new Error(`Failed to upload HD image: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
    }

    // Upload preview to Supabase Storage (without text)
    console.log(`📤 Uploading preview image to pet-portraits bucket: ${imageId}-preview.png${isRainbowBridge ? ' (Rainbow Bridge)' : ''}`);
    let previewUrl: string;
    try {
      previewUrl = await uploadImage(
        previewBuffer,
        `${imageId}-preview.png`,
        "image/png"
      );
      console.log(`✅ Preview image uploaded successfully: ${previewUrl.substring(0, 80)}...`);
    } catch (uploadError) {
      console.error("❌ Failed to upload preview image:", uploadError);
      throw new Error(`Failed to upload preview image: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
    }

    // Create and upload side-by-side before/after image
    // Works for both regular and Studio mode generations
    try {
      if (buffer && generatedBuffer) {
        await createBeforeAfterImage(buffer, generatedBuffer, imageId, studioMode);
        if (studioMode) {
          console.log(`🎨 Studio mode - multiple before/after variations created for ${imageId}`);
        } else {
          console.log(`✅ Single before/after image created for ${imageId}`);
        }
      } else {
        console.warn("⚠️ Cannot create before/after image: missing buffer(s)");
      }
    } catch (beforeAfterError) {
      // Don't fail the generation if before/after creation fails
      console.error("⚠️ Before/after image creation failed (non-critical):", beforeAfterError);
      if (studioMode) {
        console.error(`🎨 Studio mode - before/after failed for ${imageId}:`, beforeAfterError);
      }
    }

    // Validate URLs before saving
    try {
      console.log("🔍 Validating URLs...");
      console.log("🔍 HD URL:", hdUrl.substring(0, 100));
      console.log("🔍 Preview URL:", previewUrl.substring(0, 100));
      new URL(hdUrl);
      new URL(previewUrl);
      console.log("✅ URLs are valid");
    } catch (urlError) {
      console.error("❌ Invalid URL format:");
      console.error("❌ HD URL:", hdUrl);
      console.error("❌ Preview URL:", previewUrl);
      console.error("❌ URL Error:", urlError);
      throw new Error(`Failed to generate valid image URLs. HD: ${hdUrl.substring(0, 50)}..., Preview: ${previewUrl.substring(0, 50)}...`);
    }

    // Validate imageId is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(imageId)) {
      throw new Error(`Invalid imageId format: ${imageId}`);
    }

    // Save metadata to Supabase database
    // Truncate pet_description if too long (some databases have length limits)
    const maxDescriptionLength = 2000; // Safe limit
    const truncatedDescription = petDescription.length > maxDescriptionLength 
      ? petDescription.substring(0, maxDescriptionLength) 
      : petDescription;
    
    // Additional sanitization: remove any remaining problematic characters
    const finalDescription = truncatedDescription
      .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '') // Keep Latin characters and common punctuation
      .replace(/['"]/g, "'") // Normalize quotes
      .trim();
    
    try {
      // Validate each field individually to identify which one fails
      console.log("Saving metadata with:", {
        imageId,
        imageIdValid: uuidRegex.test(imageId),
        descriptionLength: finalDescription.length,
        hdUrlLength: hdUrl.length,
        previewUrlLength: previewUrl.length,
        hdUrl: hdUrl.substring(0, 50) + "...",
        previewUrl: previewUrl.substring(0, 50) + "...",
        descriptionPreview: finalDescription.substring(0, 100),
      });
      
    // Build metadata object - only include generation_session_id if provided
    // Note: generation_session_id column may not exist in DB yet, so we handle it separately
    const metadata: Record<string, unknown> = {
      created_at: new Date().toISOString(),
      paid: useSecretCredit, // Mark as paid only if using secret credit (testing) - pack credits are watermarked
      pet_description: finalDescription,
      hd_url: hdUrl,
      preview_url: previewUrl,
      // Note: style, pet_name, and quote fields not in portraits table schema yet
      // Rainbow Bridge metadata: style="rainbow-bridge", pet_name, quote (stored in pet_description for now)
      // Note: pack_generation not tracked in DB - pack credits just give watermarked generations
      // Note: secret_generation not saved to DB (testing feature only)
    };
    
    // Try to save with generation_session_id first, fall back without it if column doesn't exist
    if (generationSessionId) {
      try {
        await saveMetadata(imageId, { ...metadata, generation_session_id: generationSessionId });
      } catch (sessionIdError) {
        // If it fails due to missing column, try without it
        console.warn("Failed to save with generation_session_id, trying without:", sessionIdError);
        await saveMetadata(imageId, metadata);
      }
    } else {
      await saveMetadata(imageId, metadata);
    }
    
    // Log Rainbow Bridge metadata (for development/debugging)
    if (isRainbowBridge) {
      console.log("🌈 Rainbow Bridge metadata:", {
        pet_name: petName || "N/A",
        quote: selectedQuote || "N/A",
        style: "rainbow-bridge"
      });
    }
      
      if (refinementUsed) {
        console.log("✅ Two-stage generation completed successfully - refined portrait used");
      } else if (enableTwoStage) {
        console.log("ℹ️ Two-stage generation attempted but refinement not used - first generation used");
      }
      console.log("Metadata saved successfully");
      
      // Increment global portrait counter
      const newCount = await incrementPortraitCount();
      console.log(`Portrait count incremented to: ${newCount}`);
    } catch (metadataError) {
      console.error("Metadata save error:", metadataError);
      const errorMsg = metadataError instanceof Error ? metadataError.message : String(metadataError);
      console.error("Full error:", errorMsg);
      console.error("Error details:", JSON.stringify(metadataError, null, 2));
      
      // Always throw pattern validation errors - don't silently continue
      if (errorMsg.includes("pattern") || errorMsg.includes("String did not match") || errorMsg.includes("validation")) {
        throw new Error(`Database validation failed. Please try with a different image or contact support if the issue persists. Error: ${errorMsg}`);
      }
      
      // For other errors, throw as well so user knows something went wrong
      throw new Error(`Failed to save portrait metadata: ${errorMsg}`);
    }

    // Return watermarked preview - HD version only available after purchase
    // For Rainbow Bridge, also return quote and petName (client renders text overlay and uploads to Supabase)
    // For Studio mode, also return HD URL for full resolution downloads
    return NextResponse.json({
      imageId,
      previewUrl: previewUrl, // Watermarked version for preview (without text)
      ...(studioMode ? { hdUrl: hdUrl } : {}), // Include HD URL for studio mode
      ...(isRainbowBridge ? { 
        quote: selectedQuote,
        petName: petName,
        isRainbowBridge: true,
      } : {}),
    });
  } catch (error) {
    console.error("Generation error:", error);

    // Get detailed error message
    let errorMessage = "Failed to generate portrait. Please try again.";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      console.error("Error details:", error.stack);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
