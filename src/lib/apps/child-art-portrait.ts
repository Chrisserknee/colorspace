import { AppConfig } from './types';

export const childArtPortraitConfig: AppConfig = {
  // Basic Identity
  id: 'child-art-portrait',
  name: 'Child Art Portrait',
  tagline: 'Every Child Deserves a Story',
  description: 'Transform your child\'s photo into a magical vintage illustration, like something from a treasured storybook.',
  
  // URLs & Branding
  slug: 'child-art-portrait',
  logo: undefined, // We'll create one
  heroImages: [], // Will add sample images later
  
  // Colors & Theming - Vintage Storybook Palette
  theme: {
    primaryColor: '#8B7355', // Warm sepia brown
    secondaryColor: '#C4A574', // Aged gold/tan
    gradientFrom: '#A08060',
    gradientTo: '#C4A574',
    buttonGradient: 'linear-gradient(135deg, #8B7355 0%, #A08060 50%, #C4A574 100%)',
    glowColor: 'rgba(139, 115, 85, 0.4)',
    fontFamily: "'EB Garamond', 'Cormorant Garamond', Georgia, serif",
  },
  
  // Generation Settings
  generation: {
    type: 'child-portrait',
    
    visionPrompt: `Describe this child photo concisely:
1. Age range (toddler/young child/pre-teen)
2. Hair: color, style, length, texture
3. Eyes: color and shape
4. Distinctive features: freckles, dimples, rosy cheeks, etc.
5. Expression: happy/curious/shy/playful
6. Clothing: colors, patterns, textures
7. Accessories: glasses, hair accessories, etc.

Format as one concise paragraph for image generation. Focus on personality and cute features.`,
    
    basePrompt: `Vintage children's book illustration of {childDescription}, {styleDescription} style, early 1900s storybook aesthetic.
Setting: {backgroundDescription}. Mood: {moodDescription}. Art style: {artStyleDescription}
Organic, asymmetrical composition with natural imperfections. Hand-drawn quality with slight roughness and irregular linework.
Aged paper texture, subtle creases, vintage patina. Rich vibrant colors with warm sepia undertones.
Visible brushstrokes, watercolor bleed, hand-painted feel. Not perfectly symmetrical or polished.`,
    
    stylePalettes: [
      {
        name: "VINTAGE GARDEN",
        background: "classic English garden, roses and vines, Beatrix Potter style",
        mood: "nostalgic, gentle, timeless",
        primaryColor: "cream and sepia tones",
        accentColor: "rose pink and sage green",
        lighting: "soft diffused golden light"
      },
      {
        name: "STORYBOOK CLASSIC",
        background: "antique nursery, vintage toys and books",
        mood: "warm, nostalgic, cozy",
        primaryColor: "ivory and burnt sienna",
        accentColor: "dusty blue and antique gold",
        lighting: "soft candlelit warmth"
      },
      {
        name: "FAIRY TALE VINTAGE",
        background: "enchanted forest, Brothers Grimm illustration style",
        mood: "magical, mysterious, enchanting",
        primaryColor: "forest green and warm brown",
        accentColor: "golden amber and mushroom tones",
        lighting: "dappled sunlight through trees"
      },
      {
        name: "VICTORIAN PORTRAIT",
        background: "elegant parlor, vintage decor",
        mood: "refined, elegant, timeless",
        primaryColor: "burgundy and aged gold",
        accentColor: "ivory and antique bronze",
        lighting: "studio portrait with soft vignette"
      },
      {
        name: "NURSERY RHYME",
        background: "whimsical nursery rhyme scene",
        mood: "playful, innocent, charming",
        primaryColor: "butter yellow and powder blue",
        accentColor: "coral and mint green",
        lighting: "bright soft watercolor wash"
      },
      {
        name: "WOODLAND TALE",
        background: "cozy woodland, forest creatures, Arthur Rackham style",
        mood: "curious, adventurous, magical",
        primaryColor: "earth brown and moss green",
        accentColor: "autumn orange and cream",
        lighting: "warm autumn light through leaves"
      },
    ],
    
    poses: [
      {
        name: "JOYFUL PORTRAIT",
        description: "Cheerful forward-facing portrait",
        bodyPosition: "natural pose, slight asymmetry, looking at viewer",
        expression: "joyful smile, bright eyes, rosy cheeks"
      },
      {
        name: "CURIOUS WONDER",
        description: "Child looking to the side with wonder",
        bodyPosition: "three-quarter turn, organic pose, not perfectly centered",
        expression: "curious, thoughtful, expressive eyes"
      },
      {
        name: "PLAYFUL SPIRIT",
        description: "Playful personality in motion",
        bodyPosition: "dynamic pose, natural movement, asymmetrical",
        expression: "playful, mischievous, energetic"
      },
      {
        name: "DREAMER",
        description: "Soft thoughtful portrait",
        bodyPosition: "gentle pose, looking slightly up, natural asymmetry",
        expression: "dreamy, imaginative, peaceful"
      },
    ],
    
    promptModifiers: [
      "vintage children's book illustration, Beatrix Potter style, hand-drawn",
      "early 1900s storybook art, aged paper texture, organic composition",
      "Arthur Rackham inspired, asymmetrical, vintage patina",
      "antique botanical illustration, watercolor bleed, rough edges",
      "golden age illustration, aged paper feel, hand-painted roughness",
      "cute child portrait, expressive features, natural imperfections",
      "vibrant colors, warm sepia tones, vintage charm",
      "visible brushstrokes, irregular linework, not perfectly symmetrical"
    ],
    
    negativePrompt: "scary, dark, horror, realistic photograph, uncanny valley, bad anatomy, distorted features, creepy, unsettling, adult themes, perfectly symmetrical, polished, digital, smooth, flawless, modern, clean",
    
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
    heroTitle: "Turn Your Child Into a Vintage Storybook Illustration",
    heroSubtitle: "Transform your little one into a beautiful vintage illustration, like something from a treasured storybook.",
    ctaText: "Create Their Portrait",
    
    howItWorks: [
      {
        step: 1,
        title: "Upload Their Photo",
        description: "Share a cherished photo of your child. Clear, happy expressions work wonderfully!",
        icon: "camera"
      },
      {
        step: 2,
        title: "The Magic Unfolds",
        description: "Watch as your photo transforms into a vintage storybook illustration.",
        icon: "sparkles"
      },
      {
        step: 3,
        title: "A Keepsake Forever",
        description: "Download your artwork instantly. Perfect for framing or gifting!",
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
        question: "Is my child's photo 100% safe and private?",
        answer: "Absolutely! Your child's privacy is our top priority. Photos are encrypted during upload, used ONLY to create your portrait, never shared or sold to anyone, and automatically deleted within 24 hours. We never use photos for AI training or any other purpose. Over 5,000 parents trust us with their family photos."
      },
      {
        question: "Can I choose the art style?",
        answer: "Our AI automatically selects a beautiful vintage storybook style that complements your child's photo. Each portrait is unique and captures the charm of classic children's book illustrations."
      },
      {
        question: "Can I get it printed?",
        answer: "Yes! We offer premium museum-quality canvas prints in 12x12 and 16x16 sizes - perfect for their bedroom or as a gift for grandparents!"
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


