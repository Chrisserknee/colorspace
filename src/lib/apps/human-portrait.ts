import { AppConfig } from './types';

// Portrait locations for humans - elegant aristocratic settings
export const HUMAN_PORTRAIT_LOCATIONS = [
  {
    id: "palace_interior",
    name: "Palace Interior",
    description: "grand palace interior with ornate gold trim, marble floors, crystal chandeliers",
    lighting: "warm golden light streaming through tall windows",
    mood: "regal, majestic, opulent"
  },
  {
    id: "victorian_parlor",
    name: "Victorian Parlor",
    description: "elegant Victorian parlor with dark wood paneling, plush furniture, and oil paintings",
    lighting: "warm firelight glow mixed with soft daylight",
    mood: "refined, cozy, distinguished"
  },
  {
    id: "grand_library",
    name: "Grand Library",
    description: "magnificent library with floor-to-ceiling bookshelves, leather chairs, and antique globes",
    lighting: "warm lamplight and soft daylight through tall windows",
    mood: "scholarly, wise, sophisticated"
  },
  {
    id: "renaissance_studio",
    name: "Renaissance Studio",
    description: "artist's studio with rich velvet drapes, classical sculptures, and warm candlelight",
    lighting: "dramatic chiaroscuro with warm golden tones",
    mood: "artistic, romantic, timeless"
  },
  {
    id: "garden_terrace",
    name: "Garden Terrace",
    description: "elegant garden terrace with stone balustrades, climbing roses, and distant rolling hills",
    lighting: "soft golden hour light with gentle shadows",
    mood: "serene, aristocratic, romantic"
  },
  {
    id: "white_studio",
    name: "Classic White Studio",
    description: "pure bright white background, clean and luminous",
    lighting: "bright diffused natural light, clean and professional",
    mood: "clean, timeless, elegant"
  },
  {
    id: "baroque_hall",
    name: "Baroque Hall",
    description: "opulent baroque hall with gilded columns, frescoed ceilings, and crystal chandeliers",
    lighting: "dramatic golden light from multiple candelabras",
    mood: "grand, theatrical, magnificent"
  },
  {
    id: "romantic_countryside",
    name: "Romantic Countryside",
    description: "pastoral English countryside with soft rolling hills, ancient oaks, and misty horizon",
    lighting: "soft diffused daylight with gentle atmospheric haze",
    mood: "pastoral, dreamy, nostalgic"
  },
];

export const humanPortraitConfig: AppConfig = {
  // Basic Identity
  id: 'human-portrait',
  name: 'Portrait Studio',
  tagline: 'Become a Timeless Masterpiece',
  description: 'Transform yourself into a stunning aristocratic oil portrait, like a Renaissance master painted just for you.',
  
  // URLs & Branding
  slug: 'human-portrait',
  logo: undefined,
  heroImages: [],
  
  // Colors & Theming - Deep Renaissance Palette with warm jewel tones
  theme: {
    primaryColor: '#9B7B5C', // Warm bronze/antique gold
    secondaryColor: '#5E4B3B', // Deep walnut brown
    gradientFrom: '#6B5344',
    gradientTo: '#9B7B5C',
    buttonGradient: 'linear-gradient(135deg, #5E4B3B 0%, #9B7B5C 50%, #C4A574 100%)',
    glowColor: 'rgba(155, 123, 92, 0.4)',
    fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif",
  },
  
  // Generation Settings
  generation: {
    type: 'human-portrait',
    
    visionPrompt: `Analyze this person's photo with EXTREME PRECISION for portrait generation. The goal is to describe THIS EXACT person so specifically that they would be INSTANTLY RECOGNIZABLE.

1. FACE GEOMETRY (CRITICAL):
   - FACE SHAPE: Oval, round, square, heart, long, diamond?
   - FOREHEAD: High/low, wide/narrow, flat/rounded?
   - CHEEKBONES: High/low, prominent/subtle?
   - JAW: Square, rounded, pointed, wide/narrow?
   - CHIN: Prominent, recessed, pointed, cleft?

2. EYES (CRITICAL):
   - COLOR: Exact shade (light brown, deep blue, hazel with gold flecks, etc.)
   - SHAPE: Almond, round, hooded, downturned, upturned?
   - SIZE: Large, medium, small relative to face?
   - SPACING: Wide-set, close-set, average?
   - EXPRESSION: Alert, gentle, intense?

3. EYEBROWS:
   - Shape, thickness, arch height, color

4. NOSE:
   - Length, width, bridge shape, tip shape

5. MOUTH & LIPS:
   - Lip fullness, shape, natural expression

6. HAIR:
   - COLOR: Exact shade (not just "brown" - specify: warm chestnut, cool ash brown, etc.)
   - TEXTURE: Straight, wavy, curly, coily?
   - LENGTH & STYLE: How it frames the face
   - HAIRLINE: Shape, any distinctive features

7. SKIN:
   - Tone, undertone (warm/cool/neutral)
   - Any distinctive features (freckles, dimples, beauty marks, etc.)

8. UNIQUE IDENTIFIERS:
   - List 5-7 specific features that make THIS person unique
   - Asymmetries, distinctive features, individual quirks

Format your response as a detailed paragraph focusing on what makes THIS person unique and recognizable.`,
    
    basePrompt: `Classical aristocratic oil portrait of {personDescription}.

SETTING: {locationName}
{locationDescription}
Lighting: {lighting}

STYLE:
- 18th-century aristocratic oil portrait
- Visible brushstrokes, painterly texture
- Soft craquelure aging effect
- Museum masterpiece quality

WARDROBE:
- Elegant period-appropriate attire
- Rich velvet or silk fabrics in jewel tones
- Tasteful jewelry appropriate to the era

IDENTITY PRESERVATION (CRITICAL):
- Must look EXACTLY like this person: {personDescription}
- Preserve exact face shape, features, expression
- Maintain skin tone, hair color, eye color precisely
- Owner must INSTANTLY recognize themselves

OUTPUT: Beautiful antique oil portrait. Natural human pose. Stunning composition.`,
    
    stylePalettes: [
      {
        name: "ROYAL GOLD",
        background: "deep burgundy velvet backdrop with subtle gold accents",
        mood: "regal, majestic, commanding",
        primaryColor: "rich burgundy and gold",
        accentColor: "antique gold with ruby highlights",
        lighting: "warm golden candlelight from the side"
      },
      {
        name: "VENETIAN RENAISSANCE",
        background: "warm terracotta and cream tones, soft atmospheric perspective",
        mood: "romantic, painterly, timeless",
        primaryColor: "warm ivory and sienna",
        accentColor: "muted emerald and antique gold",
        lighting: "soft diffused daylight, Venetian master style"
      },
      {
        name: "DUTCH GOLDEN AGE",
        background: "deep brown with subtle warm undertones, Rembrandt style",
        mood: "intimate, dignified, psychological depth",
        primaryColor: "rich browns and warm blacks",
        accentColor: "creamy whites and golden highlights",
        lighting: "dramatic chiaroscuro, single light source"
      },
      {
        name: "ELEGANT IVORY",
        background: "pure ivory white with soft cream undertones",
        mood: "clean, sophisticated, timeless",
        primaryColor: "ivory and champagne",
        accentColor: "soft rose gold and pearl",
        lighting: "bright diffused natural light"
      },
      {
        name: "ARISTOCRATIC BLUE",
        background: "deep midnight blue with subtle gold accents",
        mood: "refined, distinguished, noble",
        primaryColor: "deep sapphire and navy",
        accentColor: "burnished gold and silver",
        lighting: "cool moonlight mixed with warm candlelight"
      },
      {
        name: "GARDEN ROMANTIC",
        background: "soft green gardens with distant pastoral landscape",
        mood: "romantic, pastoral, serene",
        primaryColor: "sage green and cream",
        accentColor: "dusty rose and antique gold",
        lighting: "soft golden hour sunlight"
      },
    ],
    
    poses: [
      {
        name: "CLASSICAL THREE-QUARTER",
        description: "Traditional three-quarter turn portrait",
        bodyPosition: "body turned slightly, face toward viewer",
        expression: "dignified, composed, confident"
      },
      {
        name: "REGAL PROFILE",
        description: "Elegant profile view",
        bodyPosition: "body in profile, elegant neck line visible",
        expression: "noble, contemplative, serene"
      },
      {
        name: "DIRECT GAZE",
        description: "Facing forward with engaging eye contact",
        bodyPosition: "straight-on, shoulders relaxed",
        expression: "warm, engaging, confident"
      },
      {
        name: "THOUGHTFUL LEAN",
        description: "Slight lean with hand gesture",
        bodyPosition: "slight forward lean, one hand visible",
        expression: "intelligent, thoughtful, approachable"
      },
    ],
    
    negativePrompt: "cartoon, anime, 3d render, photograph, blurry, low quality, deformed, ugly, bad anatomy, distorted face, unnatural proportions",
    
    outputWidth: 1024,
    outputHeight: 1024,
  },
  
  // Pricing
  pricing: {
    hdPrice: 1999,
    hdPriceDisplay: "$19.99",
    unlimitedPrice: 499,
    unlimitedPriceDisplay: "$4.99",
    unlimitedDuration: 2,
    canvasPricing: {
      small: { price: 6900, display: "$69", size: '12"x12"' },
      large: { price: 12900, display: "$129", size: '16"x16"' },
    },
    productName: "Portrait Studio Masterpiece",
    productDescription: "Full-resolution, watermark-free aristocratic portrait - a timeless masterpiece",
  },
  
  // Content
  content: {
    heroTitle: "Transform Yourself Into a Classical Masterpiece",
    heroSubtitle: "Upload a photo and watch as you're transformed into a stunning aristocratic portrait, as if painted by a Renaissance master.",
    ctaText: "Create Your Portrait",
    
    howItWorks: [
      {
        step: 1,
        title: "Upload Your Photo",
        description: "Share a clear, well-lit photo of yourself. Any angle works beautifully!",
        icon: "camera"
      },
      {
        step: 2,
        title: "The Magic Unfolds",
        description: "Our AI transforms you into a stunning classical oil portrait in seconds.",
        icon: "sparkles"
      },
      {
        step: 3,
        title: "A Masterpiece is Born",
        description: "Download your portrait instantly. Perfect for framing, gifting, or sharing!",
        icon: "download"
      },
    ],
    
    faq: [
      {
        question: "How long does it take to create my portrait?",
        answer: "Your masterpiece is created in about 30-60 seconds using advanced AI technology."
      },
      {
        question: "What kind of photos work best?",
        answer: "Clear, well-lit photos where your face is clearly visible work best. Front-facing or three-quarter angles create the most stunning results!"
      },
      {
        question: "Will I recognize myself in the portrait?",
        answer: "Absolutely! Our AI is specifically designed to preserve your unique features while transforming you into a classical masterpiece. You'll instantly recognize yourself."
      },
      {
        question: "Can I get my portrait printed on canvas?",
        answer: "Yes! We offer premium museum-quality canvas prints in 12x12 and 16x16 sizes - perfect for display in your home or as an unforgettable gift."
      },
      {
        question: "Is my photo safe and private?",
        answer: "Your privacy is our priority. Photos are encrypted during upload, used only to create your portrait, never shared or sold, and automatically deleted within 24 hours."
      },
    ],
    
    uploadTitle: "Upload Your Photo",
    uploadSubtitle: "We'll transform you into royalty",
    uploadTips: [
      "Clear, well-lit photo",
      "Face clearly visible",
      "Any angle works great",
      "Natural expression preferred"
    ],
  },
  
  // Features
  features: {
    enableCanvas: true,
    enableEmailCapture: true,
    enableTestimonials: true,
    enableGallery: false,
    enableBlog: false,
  },
};

// Export location selector
export function getRandomHumanPortraitLocation(): typeof HUMAN_PORTRAIT_LOCATIONS[0] {
  return HUMAN_PORTRAIT_LOCATIONS[Math.floor(Math.random() * HUMAN_PORTRAIT_LOCATIONS.length)];
}

export default humanPortraitConfig;

