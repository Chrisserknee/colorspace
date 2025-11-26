"use client";

import Image from "next/image";

interface HeroProps {
  onUploadClick: () => void;
}

export default function Hero({ onUploadClick }: HeroProps) {
  return (
    <section className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-8 sm:py-12 relative overflow-hidden">
      {/* Decorative elements */}
      <div 
        className="absolute top-20 left-10 w-32 h-32 rounded-full blur-3xl" 
        style={{ backgroundColor: 'rgba(197, 165, 114, 0.08)' }} 
      />
      <div 
        className="absolute bottom-20 right-10 w-48 h-48 rounded-full blur-3xl" 
        style={{ backgroundColor: 'rgba(139, 58, 66, 0.08)' }} 
      />
      
      {/* Ornate corner decorations */}
      <div 
        className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 rounded-tl-lg" 
        style={{ borderColor: 'rgba(197, 165, 114, 0.3)' }} 
      />
      <div 
        className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 rounded-tr-lg" 
        style={{ borderColor: 'rgba(197, 165, 114, 0.3)' }} 
      />
      <div 
        className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 rounded-bl-lg" 
        style={{ borderColor: 'rgba(197, 165, 114, 0.3)' }} 
      />
      <div 
        className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 rounded-br-lg" 
        style={{ borderColor: 'rgba(197, 165, 114, 0.3)' }} 
      />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        {/* LumePet Logo */}
        <div className="mb-3 sm:mb-4 animate-fade-in-up">
          <div className="flex justify-center">
            <div 
              className="relative logo-sparkle-container"
              style={{
                animation: 'pulse-glow 3s ease-in-out infinite'
              }}
            >
              <Image
                src="/samples/lumepet.png"
                alt="LumePet Logo"
                width={80}
                height={80}
                className="object-contain animate-float"
                priority
              />
              {/* Sparkle particles */}
              <span className="sparkle sparkle-1"></span>
              <span className="sparkle sparkle-2"></span>
              <span className="sparkle sparkle-3"></span>
              <span className="sparkle sparkle-4"></span>
              <span className="sparkle sparkle-5"></span>
              <span className="sparkle sparkle-6"></span>
              <span className="sparkle sparkle-7"></span>
              <span className="sparkle sparkle-8"></span>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p 
          className="text-sm sm:text-base mb-2 animate-fade-in-up tracking-wide"
          style={{ color: '#C5A572', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Your Cherished Pet in a Classic Masterpiece
        </p>

        {/* Main headline */}
        <h1 
          className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3 sm:mb-4 animate-fade-in-up delay-100 leading-tight"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
        >
          Turn your pet into a{" "}
          <span className="relative" style={{ color: '#C5A572' }}>
            Renaissance
            <svg 
              className="absolute -bottom-1 left-0 w-full h-2" 
              style={{ color: 'rgba(139, 58, 66, 0.6)' }} 
              viewBox="0 0 200 12" 
              preserveAspectRatio="none"
            >
              <path d="M0 6 Q50 0, 100 6 T200 6" stroke="currentColor" strokeWidth="3" fill="none"/>
            </svg>
          </span>{" "}
          masterpiece.
        </h1>

        {/* Subheadline */}
        <p 
          className="text-sm sm:text-base mb-6 animate-fade-in-up delay-200 max-w-xl mx-auto"
          style={{ color: '#B8B2A8' }}
        >
          Upload a photo. We&apos;ll paint them like a royal oil portrait — 
          worthy of hanging in the finest galleries of Europe.
        </p>

        {/* CTA Button */}
        <div className="animate-fade-in-up delay-400">
          <button
            onClick={onUploadClick}
            className="btn-primary text-lg px-8 py-4 group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload your pet photo
          </button>
        </div>
      </div>
    </section>
  );
}
