import { AppConfig } from './types';

export const childArtPortraitConfig: AppConfig = {
  // Basic Identity
  id: 'child-art-portrait',
  name: 'Child Art Portrait',
  tagline: 'Turn Your Child Into a Vintage Storybook Illustration',
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
    
    visionPrompt: `Analyze this photo of a child and provide a detailed description including:
1. Approximate age range (toddler, young child, pre-teen)
2. Hair color, style, and length
3. Eye color
4. Distinctive features (freckles, dimples, etc.)
5. Expression and personality traits visible (happy, curious, shy, playful)
6. What they're wearing (if relevant to the portrait style)
7. Any notable accessories (glasses, hair accessories, etc.)

Format as a concise paragraph suitable for an image generation prompt. Focus on capturing their unique personality and charm.`,
    
    basePrompt: `A beautiful vintage children's book illustration of {childDescription}.
The child is depicted in a {styleDescription} artistic style, reminiscent of classic illustrated storybooks from the early 1900s.
Setting: {backgroundDescription}.
The illustration has a {moodDescription} atmosphere with aged paper texture and soft, muted colors.
Art style: {artStyleDescription}
The portrait has the charm of vintage botanical illustrations and classic fairy tale art.
Warm sepia undertones, delicate linework, aged paper aesthetic, suitable for framing as fine art.`,
    
    stylePalettes: [
      {
        name: "VINTAGE GARDEN",
        background: "a classic English garden with delicate roses and climbing vines, like a Beatrix Potter illustration",
        mood: "nostalgic, gentle, timeless",
        primaryColor: "aged cream and soft sepia tones",
        accentColor: "faded rose pink and sage green",
        lighting: "soft diffused light with warm golden undertones, like an aged photograph"
      },
      {
        name: "STORYBOOK CLASSIC",
        background: "an antique nursery setting with vintage toys and old books",
        mood: "warm, nostalgic, cozy",
        primaryColor: "warm ivory and burnt sienna",
        accentColor: "dusty blue and antique gold",
        lighting: "soft candlelit warmth, like an old master painting"
      },
      {
        name: "FAIRY TALE VINTAGE",
        background: "an enchanted forest from a classic Brothers Grimm illustration",
        mood: "magical, mysterious, enchanting",
        primaryColor: "deep forest green and warm brown",
        accentColor: "golden amber and soft mushroom colors",
        lighting: "dappled sunlight through ancient trees, vintage hand-colored plate aesthetic"
      },
      {
        name: "VICTORIAN PORTRAIT",
        background: "an elegant parlor setting with rich textures and vintage decor",
        mood: "refined, elegant, timeless",
        primaryColor: "rich burgundy and aged gold",
        accentColor: "cream and antique bronze",
        lighting: "studio portrait lighting with soft vignette edges"
      },
      {
        name: "NURSERY RHYME",
        background: "a whimsical scene inspired by classic nursery rhyme illustrations",
        mood: "playful, innocent, charming",
        primaryColor: "soft butter yellow and powder blue",
        accentColor: "faded coral and mint",
        lighting: "bright but soft, like a watercolor wash"
      },
      {
        name: "WOODLAND TALE",
        background: "a cozy woodland setting with friendly forest creatures, like Arthur Rackham's illustrations",
        mood: "curious, adventurous, magical",
        primaryColor: "earth brown and moss green",
        accentColor: "autumn orange and cream",
        lighting: "warm autumn light filtering through leaves"
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
      "vintage children's book illustration style like Beatrix Potter",
      "classic early 1900s storybook art with hand-painted quality",
      "Arthur Rackham inspired fairy tale illustration",
      "antique botanical illustration style with soft watercolors",
      "golden age of illustration aesthetic with aged paper texture"
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
    heroTitle: "Turn Your Child Into a Vintage Illustration",
    heroSubtitle: "Like something from a treasured storybook — transform your little one into a timeless piece of art.",
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


