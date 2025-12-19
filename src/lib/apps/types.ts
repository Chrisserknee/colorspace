// App Module Type Definitions
export interface AppConfig {
  // Basic Identity
  id: string;
  name: string;
  tagline: string;
  description: string;
  
  // URLs & Branding
  slug: string; // URL path e.g. "lumepet", "child-art-portrait"
  externalUrl?: string; // External URL if app is hosted elsewhere (e.g. "https://lumepet.app")
  logo?: string; // Path to logo image
  heroImages: string[]; // Sample hero images
  
  // Colors & Theming
  theme: AppTheme;
  
  // Generation Settings
  generation: GenerationConfig;
  
  // Pricing
  pricing: PricingConfig;
  
  // Content
  content: ContentConfig;
  
  // Features
  features: FeatureFlags;
}

export interface AppTheme {
  primaryColor: string; // Main accent color (hex)
  secondaryColor: string; // Secondary accent (hex)
  gradientFrom: string;
  gradientTo: string;
  buttonGradient: string;
  glowColor: string;
  fontFamily?: string;
}

export interface GenerationConfig {
  // Type of generation
  type: 'pet-portrait' | 'child-portrait' | 'human-portrait' | 'custom';
  
  // OpenAI Vision prompt for analyzing uploaded image
  visionPrompt: string;
  
  // Base prompt template for image generation
  basePrompt: string;
  
  // Style palettes (randomized for variety)
  stylePalettes: StylePalette[];
  
  // Poses (if applicable)
  poses?: PoseConfig[];
  
  // Additional prompt modifiers
  promptModifiers?: string[];
  
  // Negative prompt elements
  negativePrompt?: string;
  
  // Image dimensions
  outputWidth: number;
  outputHeight: number;
}

export interface StylePalette {
  name: string;
  background: string;
  mood: string;
  primaryColor: string;
  accentColor: string;
  lighting: string;
}

export interface PoseConfig {
  name: string;
  description: string;
  bodyPosition: string;
  expression: string;
}

export interface PricingConfig {
  // HD Download
  hdPrice: number; // In cents
  hdPriceDisplay: string;
  
  // Unlimited Session
  unlimitedPrice: number;
  unlimitedPriceDisplay: string;
  unlimitedDuration: number; // Hours
  
  // Canvas prints (optional)
  canvasPricing?: {
    small: { price: number; display: string; size: string };
    large: { price: number; display: string; size: string };
  };
  
  // Product names
  productName: string;
  productDescription: string;
}

export interface ContentConfig {
  // Hero section
  heroTitle: string;
  heroSubtitle: string;
  ctaText: string;
  
  // How it works steps
  howItWorks: {
    step: number;
    title: string;
    description: string;
    icon: string;
  }[];
  
  // FAQ items
  faq: {
    question: string;
    answer: string;
  }[];
  
  // Testimonials
  testimonials?: {
    name: string;
    text: string;
    image?: string;
  }[];
  
  // Gallery images
  galleryImages?: string[];
  
  // Upload instructions
  uploadTitle: string;
  uploadSubtitle: string;
  uploadTips: string[];
}

export interface FeatureFlags {
  enableCanvas: boolean;
  enableEmailCapture: boolean;
  enableTestimonials: boolean;
  enableGallery: boolean;
  enableBlog: boolean;
  enableRainbowBridge?: boolean; // LumePet specific
}

// App registry - all available apps
export interface AppRegistry {
  [key: string]: AppConfig;
}


