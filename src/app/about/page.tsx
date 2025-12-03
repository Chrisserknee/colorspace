import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About LumePet | AI Pet Portrait Artists Creating Royal Masterpieces",
  description: "LumePet transforms beloved pets into stunning royal oil painting portraits using advanced AI technology. Learn about our mission to celebrate the bond between pets and their owners through timeless art.",
  keywords: [
    "LumePet",
    "pet portrait",
    "AI pet art",
    "royal pet painting",
    "custom pet portrait",
    "pet oil painting",
    "digital pet art",
    "pet memorial portrait",
    "dog portrait",
    "cat portrait",
    "pet painting online",
    "personalized pet art",
    "pet portrait from photo",
    "renaissance pet art",
    "regal pet portrait",
  ],
  openGraph: {
    title: "About LumePet | AI Pet Portrait Artists",
    description: "Transform your beloved pet into a stunning royal oil painting portrait. Discover how LumePet celebrates the bond between pets and their owners.",
    type: "website",
    url: "https://lumepet.app/about",
    siteName: "LumePet",
    images: [
      {
        url: "/samples/hero-portrait.png",
        width: 1200,
        height: 630,
        alt: "LumePet - Royal Pet Portraits",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About LumePet | AI Pet Portrait Artists",
    description: "Transform your beloved pet into a stunning royal oil painting portrait.",
  },
  alternates: {
    canonical: "https://lumepet.app/about",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "LumePet",
  url: "https://lumepet.app",
  logo: "https://lumepet.app/samples/LumePet2.png",
  description: "LumePet transforms beloved pets into stunning royal oil painting portraits using advanced AI technology.",
  foundingDate: "2024",
  sameAs: [],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "support@lumepet.app",
  },
  offers: {
    "@type": "Offer",
    name: "Custom Pet Portrait",
    description: "Transform your pet photo into a royal oil painting masterpiece",
    price: "19.99",
    priceCurrency: "USD",
  },
};

export default function AboutPage() {
  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <main className="min-h-screen bg-[#0A0A0A]">
        {/* Hero Section */}
        <section className="relative py-20 px-6 overflow-hidden">
          {/* Background gradient */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: 'radial-gradient(ellipse at 30% 20%, rgba(197, 165, 114, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(197, 165, 114, 0.1) 0%, transparent 50%)',
            }}
          />
          
          <div className="max-w-4xl mx-auto relative z-10">
            {/* Navigation */}
            <nav className="flex items-center justify-between mb-16">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <div
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(255, 220, 100, 0.5)) drop-shadow(0 0 12px rgba(255, 215, 80, 0.4))'
                  }}
                >
                  <Image
                    src="/samples/LumePet2.png"
                    alt="LumePet Logo"
                    width={48}
                    height={48}
                    className="object-contain"
                  />
                </div>
                <span 
                  className="text-xl font-semibold"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
                >
                  LumePet
                </span>
              </Link>
              <Link 
                href="/"
                className="px-5 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.15)',
                  border: '1px solid rgba(197, 165, 114, 0.3)',
                  color: '#C5A572',
                }}
              >
                Create Portrait
              </Link>
            </nav>

            {/* Main Heading */}
            <div className="text-center mb-12">
              <h1 
                className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight"
                style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  color: '#F0EDE8',
                }}
              >
                About <span style={{ color: '#C5A572' }}>LumePet</span>
              </h1>
              <p 
                className="text-xl max-w-2xl mx-auto leading-relaxed"
                style={{ color: '#B8B2A8' }}
              >
                Transforming beloved pets into timeless royal masterpieces through the magic of AI artistry
              </p>
            </div>
          </div>
        </section>

        {/* Our Story Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 
                  className="text-3xl font-semibold mb-6"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
                >
                  Our Story
                </h2>
                <div className="space-y-4" style={{ color: '#B8B2A8' }}>
                  <p>
                    LumePet was born from a simple yet powerful idea: every pet deserves to be celebrated as the royalty they truly are in our hearts. Our founders, lifelong pet lovers themselves, recognized that the bond between humans and their animal companions is one of the most profound connections we experience.
                  </p>
                  <p>
                    We set out to create a way to immortalize this bond through art—not just any art, but the kind of regal, oil-painting-style portraits that were once reserved for kings, queens, and nobility throughout history.
                  </p>
                  <p>
                    Using cutting-edge AI technology combined with artistic vision, we&apos;ve made it possible for anyone to transform a simple photo of their beloved pet into a stunning masterpiece worthy of hanging in any royal gallery.
                  </p>
                </div>
              </div>
              <div 
                className="relative rounded-2xl overflow-hidden"
                style={{ 
                  border: '2px solid rgba(197, 165, 114, 0.3)',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(197, 165, 114, 0.1)',
                }}
              >
                <Image
                  src="/samples/hero-portrait.png"
                  alt="Example LumePet royal pet portrait"
                  width={500}
                  height={600}
                  className="w-full h-auto"
                />
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section 
          className="py-16 px-6"
          style={{ backgroundColor: 'rgba(197, 165, 114, 0.03)' }}
        >
          <div className="max-w-4xl mx-auto">
            <h2 
              className="text-3xl font-semibold mb-12 text-center"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              How LumePet Creates Your Masterpiece
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)' }}
                >
                  <span className="text-2xl">📸</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#F0EDE8' }}>
                  1. Upload Your Photo
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Simply upload a clear photo of your pet. Our AI works best with well-lit images where your pet&apos;s face is clearly visible.
                </p>
              </div>
              
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)' }}
                >
                  <span className="text-2xl">🎨</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#F0EDE8' }}>
                  2. AI Creates Art
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Our advanced AI analyzes your pet&apos;s unique features and transforms them into a stunning royal portrait with exquisite detail.
                </p>
              </div>
              
              <div className="text-center">
                <div 
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)' }}
                >
                  <span className="text-2xl">👑</span>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#F0EDE8' }}>
                  3. Download & Cherish
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Receive your high-resolution masterpiece ready for printing, framing, or sharing with fellow pet lovers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Our Technology Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 
              className="text-3xl font-semibold mb-8 text-center"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              The Art & Science Behind LumePet
            </h2>
            
            <div 
              className="p-8 rounded-2xl"
              style={{ 
                backgroundColor: 'rgba(197, 165, 114, 0.05)',
                border: '1px solid rgba(197, 165, 114, 0.15)',
              }}
            >
              <div className="space-y-6" style={{ color: '#B8B2A8' }}>
                <p>
                  LumePet leverages state-of-the-art artificial intelligence and machine learning models specifically trained on classical oil painting techniques, Renaissance portraiture, and royal art styles from across centuries. Our proprietary AI has studied thousands of masterpieces to understand the subtle brushstrokes, lighting, and compositional techniques that make traditional oil portraits so captivating.
                </p>
                <p>
                  When you upload your pet&apos;s photo, our AI doesn&apos;t simply apply a filter—it reimagines your beloved companion as a subject of classical portraiture. The system analyzes your pet&apos;s unique features, expressions, and character, then reconstructs the image using techniques inspired by masters like Rembrandt, Velázquez, and Van Dyck.
                </p>
                <p>
                  The result is a one-of-a-kind digital artwork that captures your pet&apos;s personality while placing them in the context of royal portraiture tradition. Each portrait features rich, varied backgrounds, realistic fur textures, and the kind of dignified presence that would make any pet owner proud.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Rainbow Bridge Section */}
        <section 
          className="py-16 px-6"
          style={{ 
            background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.05) 0%, transparent 100%)',
          }}
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 
              className="text-3xl font-semibold mb-6"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Rainbow Bridge Memorial Portraits
            </h2>
            <p className="text-lg mb-8 max-w-2xl mx-auto" style={{ color: '#B8B2A8' }}>
              For those who have lost a beloved companion, LumePet offers special memorial portraits through our Rainbow Bridge service. These ethereal, angelic portraits honor the memory of pets who have crossed the rainbow bridge, providing comfort and a beautiful way to remember them forever.
            </p>
            <Link 
              href="/rainbow-bridge"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-medium transition-all hover:scale-105"
              style={{ 
                background: 'linear-gradient(135deg, #E6C866 0%, #D4AF37 50%, #C9A227 100%)',
                color: '#FFF',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.3)',
              }}
            >
              🌈 Learn About Rainbow Bridge
            </Link>
          </div>
        </section>

        {/* Our Commitment Section */}
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 
              className="text-3xl font-semibold mb-8 text-center"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Our Commitment to You
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-6">
              <div 
                className="p-6 rounded-xl"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.05)',
                  border: '1px solid rgba(197, 165, 114, 0.15)',
                }}
              >
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#C5A572' }}>
                  🎨 Quality First
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  We deliver high-resolution, print-ready portraits that look stunning whether displayed digitally or printed on canvas. Our AI continuously improves to deliver the best possible results.
                </p>
              </div>
              
              <div 
                className="p-6 rounded-xl"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.05)',
                  border: '1px solid rgba(197, 165, 114, 0.15)',
                }}
              >
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#C5A572' }}>
                  ⚡ Fast Delivery
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Your portrait is ready in about 60 seconds. No waiting days or weeks—instant gratification for you and your royal pet.
                </p>
              </div>
              
              <div 
                className="p-6 rounded-xl"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.05)',
                  border: '1px solid rgba(197, 165, 114, 0.15)',
                }}
              >
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#C5A572' }}>
                  🔒 Privacy Protected
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Your photos are processed securely and never shared. We respect your privacy and your pet&apos;s dignity as much as you do.
                </p>
              </div>
              
              <div 
                className="p-6 rounded-xl"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.05)',
                  border: '1px solid rgba(197, 165, 114, 0.15)',
                }}
              >
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#C5A572' }}>
                  💖 Pet Lovers at Heart
                </h3>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  We&apos;re pet parents ourselves. LumePet was built with genuine love for animals and understanding of the special bond you share.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <h2 
              className="text-3xl sm:text-4xl font-semibold mb-6"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Ready to Crown Your Pet?
            </h2>
            <p className="text-lg mb-8" style={{ color: '#B8B2A8' }}>
              Transform your beloved companion into royalty in under 60 seconds. Try it free—no credit card required.
            </p>
            <Link 
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-lg font-bold transition-all hover:scale-105"
              style={{ 
                background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                color: '#FFF',
                boxShadow: '0 10px 30px rgba(197, 165, 114, 0.4)',
              }}
            >
              Create Your Pet&apos;s Portrait
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer 
          className="py-12 px-6"
          style={{ borderTop: '1px solid rgba(197, 165, 114, 0.1)' }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                <Image
                  src="/samples/LumePet2.png"
                  alt="LumePet Logo"
                  width={40}
                  height={40}
                  className="object-contain"
                />
                <span 
                  className="text-lg font-semibold"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
                >
                  LumePet
                </span>
              </Link>
              
              <nav className="flex items-center gap-6 text-sm" style={{ color: '#7A756D' }}>
                <Link href="/" className="hover:text-[#C5A572] transition-colors">
                  Home
                </Link>
                <Link href="/rainbow-bridge" className="hover:text-[#C5A572] transition-colors">
                  Rainbow Bridge
                </Link>
                <Link href="/about" className="hover:text-[#C5A572] transition-colors text-[#C5A572]">
                  About
                </Link>
              </nav>
              
              <p className="text-sm" style={{ color: '#7A756D' }}>
                © {new Date().getFullYear()} LumePet
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

