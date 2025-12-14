import { AppConfig } from './types';

export const lumepetConfig: AppConfig = {
  // Basic Identity
  id: 'lumepet',
  name: 'LumePet',
  tagline: 'Your Cherished Pet in a Classic Masterpiece',
  description: 'Transform your beloved pet into a stunning royal oil painting portrait.',
  
  // URLs & Branding
  slug: 'lumepet',
  externalUrl: 'https://lumepet.app', // Redirect to external LumePet site
  logo: '/samples/LumePet2.png',
  heroImages: ['/samples/hero1.png', '/samples/samuel2.png'],
  
  // Colors & Theming
  theme: {
    primaryColor: '#C5A572', // Gold
    secondaryColor: '#8B3A42', // Burgundy
    gradientFrom: '#8B3A42',
    gradientTo: '#722F37',
    buttonGradient: 'linear-gradient(135deg, #8B3A42 0%, #722F37 100%)',
    glowColor: 'rgba(197, 165, 114, 0.4)',
    fontFamily: "'Cormorant Garamond', Georgia, serif",
  },
  
  // Generation Settings
  generation: {
    type: 'pet-portrait',
    
    visionPrompt: `Analyze this pet photo and provide a detailed description including:
1. Type of pet (dog, cat, etc.) and breed if identifiable
2. Fur/coat color and pattern
3. Eye color
4. Distinctive features (markings, ear shape, etc.)
5. Expression and personality traits visible
6. Any accessories visible (collar, tags, etc.)

Format as a concise paragraph suitable for an image generation prompt.`,
    
    basePrompt: `A masterful Dutch Golden Age oil painting portrait of {petDescription}. 
The pet is posed regally {poseDescription}, wearing {cloakDescription}. 
Adorned with {jewelryDescription}, resting on {cushionDescription}.
Background: {backgroundDescription}. 
Lighting: {lightingDescription}.
Style: Authentic oil painting with visible brushstrokes, rich textures, and classical composition reminiscent of Rembrandt and Vermeer.`,
    
    stylePalettes: [
      {
        name: "PURE WHITE",
        background: "pure bright white, clean and luminous",
        mood: "clean, bright, elegant",
        primaryColor: "dusty rose velvet with subtle gold thread",
        accentColor: "soft pastel pink with delicate gold embroidery",
        lighting: "bright diffused natural light, clean and luminous"
      },
      {
        name: "WARM WHITE",
        background: "warm white with subtle cream undertones, bright and airy",
        mood: "warm, gentle, serene",
        primaryColor: "pale lilac velvet with silver accents",
        accentColor: "soft pastel lavender with pearl details",
        lighting: "warm bright daylight, gentle and inviting"
      },
      {
        name: "PEARL WHITE",
        background: "pearl white with subtle pink-grey undertones, luminous",
        mood: "classic, timeless, elegant",
        primaryColor: "rich burgundy velvet with gold details",
        accentColor: "soft pastel cream with gold tassels",
        lighting: "bright golden afternoon light"
      },
    ],
    
    poses: [
      {
        name: "PEACEFUL SPRAWL",
        description: "Pet lying flat on stomach, front legs extended forward",
        bodyPosition: "lying flat on stomach, FULL BODY visible sprawled on cushion",
        expression: "peaceful, content, relaxed"
      },
      {
        name: "SPHINX POSE",
        description: "Classic sphinx position - lying down with chest on cushion",
        bodyPosition: "lying in sphinx pose, chest down, FULL BODY visible on cushion",
        expression: "noble, calm, observant"
      },
      {
        name: "COZY CURL",
        description: "Pet curled into a comfortable ball shape",
        bodyPosition: "curled comfortably, FULL BODY in rounded shape on cushion",
        expression: "cozy, sleepy, utterly content"
      },
    ],
    
    negativePrompt: "cartoon, anime, 3d render, photograph, blurry, low quality, deformed, ugly, bad anatomy",
    
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
    productName: "LumePet Royal Portrait",
    productDescription: "Full-resolution, watermark-free royal portrait of your beloved pet as nobility",
  },
  
  // Content
  content: {
    heroTitle: "Create a breathtaking custom pet portrait in minutes.",
    heroSubtitle: "Upload a photo — we'll turn your pet into a luxurious, hand-painted work of art you'll treasure for a lifetime.",
    ctaText: "Upload your pet photo",
    
    howItWorks: [
      {
        step: 1,
        title: "Upload Your Photo",
        description: "Share a clear photo of your beloved pet. Any angle works!",
        icon: "camera"
      },
      {
        step: 2,
        title: "AI Creates Magic",
        description: "Our AI transforms your pet into a stunning royal portrait.",
        icon: "sparkles"
      },
      {
        step: 3,
        title: "Download & Share",
        description: "Get your masterpiece instantly. Print it, frame it, love it!",
        icon: "download"
      },
    ],
    
    faq: [
      {
        question: "How long does it take to generate a portrait?",
        answer: "Your portrait is created in about 30-60 seconds using advanced AI technology."
      },
      {
        question: "What kind of photos work best?",
        answer: "Clear, well-lit photos where your pet's face is visible work best. Any angle is fine!"
      },
      {
        question: "Can I get my portrait printed on canvas?",
        answer: "Yes! We offer premium museum-quality canvas prints in 12x12 and 16x16 sizes."
      },
    ],
    
    uploadTitle: "Upload Your Pet's Photo",
    uploadSubtitle: "We'll transform them into royalty",
    uploadTips: [
      "Clear, well-lit photo",
      "Pet's face clearly visible",
      "Any angle works great"
    ],
  },
  
  // Features
  features: {
    enableCanvas: true,
    enableEmailCapture: true,
    enableTestimonials: true,
    enableGallery: true,
    enableBlog: true,
    enableRainbowBridge: true,
  },
};

export default lumepetConfig;


