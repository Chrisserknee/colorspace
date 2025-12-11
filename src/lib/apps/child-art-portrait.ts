import { AppConfig } from './types';

export const childArtPortraitConfig: AppConfig = {
  // Basic Identity
  id: 'child-art-portrait',
  name: 'Child Art Portrait',
  tagline: 'Turn Your Child Into a Storybook Character',
  description: 'Transform your child\'s photo into a magical, whimsical artwork that captures their unique spirit.',
  
  // URLs & Branding
  slug: 'child-art-portrait',
  logo: undefined, // We'll create one
  heroImages: [], // Will add sample images later
  
  // Colors & Theming
  theme: {
    primaryColor: '#F472B6', // Pink
    secondaryColor: '#A78BFA', // Purple
    gradientFrom: '#F472B6',
    gradientTo: '#A78BFA',
    buttonGradient: 'linear-gradient(135deg, #F472B6 0%, #A78BFA 100%)',
    glowColor: 'rgba(244, 114, 182, 0.4)',
    fontFamily: "'Lora', Georgia, serif",
  },
  
  // Generation Settings
  generation: {
    type: 'child-portrait',
    
    visionPrompt: `Analyze this photo of a child and provide a detailed description including:
1. Approximate age range (toddler, young child, pre-teen)
2. Hair color, style, and length
3. Eye color
4. Distinctive features (freckles, dimples, etc.)
5. Expression and personality traits visible (happy, curious, shy, playful)
6. What they're wearing (if relevant to the portrait style)
7. Any notable accessories (glasses, hair accessories, etc.)

Format as a concise paragraph suitable for an image generation prompt. Focus on capturing their unique personality and charm.`,
    
    basePrompt: `A beautiful, whimsical storybook-style illustration of {childDescription}.
The child is depicted in a {styleDescription} artistic style.
Setting: {backgroundDescription}.
The illustration has a {moodDescription} atmosphere.
Art style: {artStyleDescription}
The portrait captures their unique personality with warmth and charm.
High quality, detailed illustration suitable for framing.`,
    
    stylePalettes: [
      {
        name: "ENCHANTED GARDEN",
        background: "a magical garden with soft-focus flowers and butterflies, dreamy pastel colors",
        mood: "magical, whimsical, joyful",
        primaryColor: "soft pink and lavender hues",
        accentColor: "golden sparkles and soft mint accents",
        lighting: "warm golden hour sunlight filtering through"
      },
      {
        name: "STORYBOOK WONDER",
        background: "a cozy storybook setting with soft watercolor textures",
        mood: "warm, nostalgic, charming",
        primaryColor: "warm cream and soft coral",
        accentColor: "gentle sky blue and buttercup yellow",
        lighting: "soft diffused light, like illustration art"
      },
      {
        name: "FAIRY TALE DREAM",
        background: "a dreamy fairy tale landscape with soft clouds and gentle stars",
        mood: "magical, dreamy, ethereal",
        primaryColor: "soft lavender and powder blue",
        accentColor: "shimmering silver and soft rose",
        lighting: "magical twilight glow with soft sparkles"
      },
      {
        name: "ADVENTURE AWAITS",
        background: "an imaginative adventure scene with friendly elements",
        mood: "curious, adventurous, playful",
        primaryColor: "warm sunshine yellow and sky blue",
        accentColor: "bright coral and soft green",
        lighting: "bright, cheerful daylight"
      },
      {
        name: "COZY COMFORT",
        background: "a warm, cozy indoor scene with soft textures",
        mood: "cozy, warm, comforting",
        primaryColor: "warm cream and soft peach",
        accentColor: "dusty rose and sage green",
        lighting: "warm ambient light, like a cozy afternoon"
      },
      {
        name: "WOODLAND MAGIC",
        background: "a friendly forest with gentle woodland creatures in the distance",
        mood: "curious, natural, enchanting",
        primaryColor: "forest green and warm brown",
        accentColor: "soft mushroom caps and wildflowers",
        lighting: "dappled sunlight through leaves"
      },
    ],
    
    poses: [
      {
        name: "JOYFUL PORTRAIT",
        description: "A cheerful, forward-facing portrait capturing their smile",
        bodyPosition: "looking at viewer with a natural, happy expression",
        expression: "joyful, bright-eyed, genuine smile"
      },
      {
        name: "CURIOUS WONDER",
        description: "Child looking slightly to the side with wonder in their eyes",
        bodyPosition: "gentle three-quarter turn, eyes full of curiosity",
        expression: "curious, wonder-filled, thoughtful"
      },
      {
        name: "PLAYFUL SPIRIT",
        description: "Capturing their playful personality in motion",
        bodyPosition: "dynamic but gentle pose showing personality",
        expression: "playful, mischievous, full of energy"
      },
      {
        name: "DREAMER",
        description: "Soft, thoughtful portrait with a dreamy quality",
        bodyPosition: "gentle pose, perhaps looking slightly upward",
        expression: "dreamy, imaginative, peaceful"
      },
    ],
    
    promptModifiers: [
      "Pixar-inspired character design",
      "watercolor storybook illustration style",
      "classic children's book illustration",
      "whimsical fairy tale art style",
      "warm and inviting digital painting"
    ],
    
    negativePrompt: "scary, dark, horror, realistic photograph, uncanny valley, bad anatomy, distorted features, creepy, unsettling, adult themes",
    
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
    productName: "Child Art Portrait",
    productDescription: "Full-resolution magical storybook portrait of your child",
  },
  
  // Content
  content: {
    heroTitle: "Transform Your Child Into a Storybook Character",
    heroSubtitle: "Upload a photo and watch as your little one becomes the star of their own magical illustration.",
    ctaText: "Create Their Portrait",
    
    howItWorks: [
      {
        step: 1,
        title: "Upload Their Photo",
        description: "Share a clear photo of your child. Smiling photos work great!",
        icon: "camera"
      },
      {
        step: 2,
        title: "Magic Happens",
        description: "Our AI creates a stunning storybook-style portrait.",
        icon: "sparkles"
      },
      {
        step: 3,
        title: "Treasure Forever",
        description: "Download your artwork instantly. Frame it, gift it, love it!",
        icon: "heart"
      },
    ],
    
    faq: [
      {
        question: "How long does it take to create a portrait?",
        answer: "Your magical portrait is created in about 30-60 seconds using advanced AI technology."
      },
      {
        question: "What kind of photos work best?",
        answer: "Clear, well-lit photos where your child's face is clearly visible work best. Happy, natural expressions create the most charming results!"
      },
      {
        question: "Is this safe for my child's photo?",
        answer: "Absolutely! We take privacy seriously. Your photos are processed securely and not stored permanently. We never share or use your photos for anything other than creating your portrait."
      },
      {
        question: "Can I choose the art style?",
        answer: "Our AI automatically selects a beautiful style that complements your child's photo. Each portrait is unique and magical!"
      },
      {
        question: "Can I get it printed?",
        answer: "Yes! We offer premium museum-quality canvas prints in 12x12 and 16x16 sizes - perfect for their bedroom or as a gift!"
      },
    ],
    
    uploadTitle: "Upload Your Child's Photo",
    uploadSubtitle: "We'll create their magical portrait",
    uploadTips: [
      "Clear, well-lit photo",
      "Face clearly visible",
      "Natural expressions work best",
      "Any age works great!"
    ],
  },
  
  // Features
  features: {
    enableCanvas: true,
    enableEmailCapture: true,
    enableTestimonials: false, // Will enable once we have testimonials
    enableGallery: false, // Will enable once we have sample gallery
    enableBlog: false,
  },
};

export default childArtPortraitConfig;


