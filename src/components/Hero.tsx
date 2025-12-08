"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { captureEvent } from "@/lib/posthog";

interface HeroProps {
  onUploadClick: () => void;
}

interface HeroPortrait {
  id: string;
  title: string;
  image: string;
}

const heroPortraits: HeroPortrait[] = [
  { id: "ophelia", title: "Ophelia", image: "/samples/ophelia.png" },
  { id: "sebastian", title: "Sebastian", image: "/samples/cat1.png" },
  { id: "charley-lily", title: "Charley & Lily", image: "/samples/charley&Lily2.png" },
];

export default function Hero({ onUploadClick }: HeroProps) {
  const [portraitCount, setPortraitCount] = useState<number>(335);
  const [selectedPortrait, setSelectedPortrait] = useState<HeroPortrait | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Close lightbox
  const closeLightbox = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => setSelectedPortrait(null), 200);
  }, []);

  // Open lightbox with animation
  const openLightbox = useCallback((portrait: HeroPortrait) => {
    setSelectedPortrait(portrait);
    setTimeout(() => setIsAnimating(true), 10);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    if (selectedPortrait) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedPortrait, closeLightbox]);
  
  useEffect(() => {
    // Fetch current portrait count
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.portraitsCreated) {
          setPortraitCount(data.portraitsCreated);
        }
      })
      .catch(() => {
        // Keep default count on error
      });
  }, []);

  return (
    <section className="min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 pt-2 sm:pt-4 pb-6 sm:pb-10 relative overflow-hidden w-full">
      {/* Decorative elements */}
      <div 
        className="absolute top-20 left-10 w-32 h-32 rounded-full blur-3xl" 
        style={{ backgroundColor: 'rgba(197, 165, 114, 0.08)' }} 
      />
      <div 
        className="absolute bottom-20 right-10 w-48 h-48 rounded-full blur-3xl" 
        style={{ backgroundColor: 'rgba(139, 58, 66, 0.08)' }} 
      />

      <div className="w-full max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
        {/* Subtle vignette behind headline */}
        <div 
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(197, 165, 114, 0.08) 0%, rgba(197, 165, 114, 0.03) 40%, transparent 70%)',
            filter: 'blur(40px)',
            opacity: 0.6
          }}
        />

        {/* LumePet Logo */}
        <div className="mb-2 sm:mb-3 animate-fade-in-up">
          <div className="flex justify-center">
            <div 
              className="relative logo-sparkle-container"
              style={{
                animation: 'pulse-glow 3s ease-in-out infinite'
              }}
            >
              <Image
                src="/samples/LumePet2.png"
                alt="LumePet Logo"
                width={120}
                height={120}
                className="object-contain animate-float"
                style={{
                  filter: 'drop-shadow(0 0 12px rgba(255, 215, 100, 0.4)) drop-shadow(0 0 24px rgba(255, 200, 80, 0.25))'
                }}
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
          className="text-base sm:text-lg mb-2 animate-fade-in-up tracking-wide"
          style={{ color: '#C5A572', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
        >
          Your Cherished Pet in a Classic Masterpiece
        </p>

        {/* Main headline */}
        <h1 
          className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-6 sm:mb-8 animate-fade-in-up delay-100 text-center relative"
          style={{ 
            fontFamily: "'EB Garamond', 'Cormorant Garamond', Georgia, serif", 
            color: '#F0EDE8', 
            fontWeight: 400,
            letterSpacing: '0.02em',
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2)',
            lineHeight: '1.2'
          }}
        >
          <span className="block" style={{ letterSpacing: '0.03em', fontWeight: 250 }}>
            Create a{' '}
            <span 
              className="relative"
              style={{ 
                color: '#C5A572',
                fontWeight: 600,
                letterSpacing: '0.03em',
                fontStyle: 'italic',
                textShadow: `
                  0 0 8px rgba(197, 165, 114, 0.5),
                  0 0 16px rgba(197, 165, 114, 0.3),
                  0 0 24px rgba(197, 165, 114, 0.15),
                  0 2px 8px rgba(0, 0, 0, 0.4),
                  0 0 60px rgba(0, 0, 0, 0.3)
                `.trim().replace(/\s+/g, ' ')
              }}
            >
              breathtaking
            </span>
            {' '}custom pet portrait in minutes.
          </span>
        </h1>

        {/* Subheadline */}
        <p 
          className="text-base sm:text-lg mb-6 sm:mb-8 animate-fade-in-up delay-200 max-w-xl mx-auto"
          style={{ color: '#B8B2A8' }}
        >
          Upload a photo — we&apos;ll turn it into a luxurious, hand-painted work of art 
          you&apos;ll treasure for a lifetime.
        </p>

        {/* Portrait caption */}
        <p 
          className="text-xs sm:text-sm mb-4 animate-fade-in-up delay-250 tracking-wide"
          style={{ 
            color: '#7A756D',
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: 'italic'
          }}
        >
          Every portrait is crafted with real oil paint texture and museum-grade detail.
        </p>

        {/* Sample portraits */}
        <div className="flex justify-center items-end gap-3 sm:gap-6 mb-8 sm:mb-10 animate-fade-in-up delay-300">
          {/* First Portrait - Ophelia (Cat) */}
          <div className="flex flex-col items-center">
            <div 
              className="w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 transform -rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 relative flex-shrink-0 cursor-pointer group"
              style={{ padding: '2px' }}
              onClick={() => openLightbox(heroPortraits[0])}
            >
              {/* Soft outer glow/vignette */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(212, 184, 150, 0.3) 0%, rgba(197, 165, 114, 0.15) 50%, transparent 70%)',
                  filter: 'blur(20px)',
                  zIndex: 0,
                  transform: 'scale(1.1)'
                }}
              />
              
              {/* Outer frame layer - beveled edge */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #E8D4B0 0%, #D4B896 20%, #C5A572 40%, #D4B896 60%, #C5A572 80%, #E8D4B0 100%)',
                  padding: '1px',
                  boxShadow: `
                    0 8px 32px rgba(197, 165, 114, 0.4),
                    0 0 0 1px rgba(197, 165, 114, 0.6),
                    inset 0 2px 4px rgba(255, 255, 255, 0.4),
                    inset 0 -2px 4px rgba(166, 139, 91, 0.4)
                  `.trim().replace(/\s+/g, ' '),
                  zIndex: 1
                }}
              >
                {/* Middle frame layer - dimensional molding */}
                <div 
                  className="absolute inset-0.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, #D4B896 0%, #C5A572 30%, #D4B896 60%, #C5A572 100%)',
                    padding: '0.5px',
                    boxShadow: `
                      inset 0 1px 2px rgba(255, 255, 255, 0.35),
                      inset 0 -1px 2px rgba(166, 139, 91, 0.35)
                    `.trim().replace(/\s+/g, ' ')
                  }}
                >
                  {/* Inner frame layer */}
                  <div 
                    className="absolute inset-0.5 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, #E8D4B0 0%, #D4B896 25%, #C5A572 50%, #D4B896 75%, #E8D4B0 100%)',
                      padding: '0.5px',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    {/* Portrait container with inner shadow */}
                    <div 
                      className="relative w-full h-full rounded-md overflow-hidden"
                      style={{
                        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <img 
                        src="/samples/ophelia.png" 
                        alt="Ophelia - Royal Cat Portrait"
                        className="w-full h-full object-cover scale-125"
                        style={{ objectPosition: 'center 5%' }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Second Portrait - Sebastian (Cat) */}
          <div className="flex flex-col items-center">
            <div 
              className="w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 transform hover:scale-105 transition-all duration-300 relative flex-shrink-0 cursor-pointer group"
              style={{ padding: '2px' }}
              onClick={() => openLightbox(heroPortraits[1])}
            >
              {/* Soft outer glow/vignette */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(212, 184, 150, 0.3) 0%, rgba(197, 165, 114, 0.15) 50%, transparent 70%)',
                  filter: 'blur(20px)',
                  zIndex: 0,
                  transform: 'scale(1.1)'
                }}
              />
              
              {/* Outer frame layer - beveled edge */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #E8D4B0 0%, #D4B896 20%, #C5A572 40%, #D4B896 60%, #C5A572 80%, #E8D4B0 100%)',
                  padding: '1px',
                  boxShadow: `
                    0 8px 32px rgba(197, 165, 114, 0.4),
                    0 0 0 1px rgba(197, 165, 114, 0.6),
                    inset 0 2px 4px rgba(255, 255, 255, 0.4),
                    inset 0 -2px 4px rgba(166, 139, 91, 0.4)
                  `.trim().replace(/\s+/g, ' '),
                  zIndex: 1
                }}
              >
                {/* Middle frame layer - dimensional molding */}
                <div 
                  className="absolute inset-0.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, #D4B896 0%, #C5A572 30%, #D4B896 60%, #C5A572 100%)',
                    padding: '0.5px',
                    boxShadow: `
                      inset 0 1px 2px rgba(255, 255, 255, 0.35),
                      inset 0 -1px 2px rgba(166, 139, 91, 0.35)
                    `.trim().replace(/\s+/g, ' ')
                  }}
                >
                  {/* Inner frame layer */}
                  <div 
                    className="absolute inset-0.5 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, #E8D4B0 0%, #D4B896 25%, #C5A572 50%, #D4B896 75%, #E8D4B0 100%)',
                      padding: '0.5px',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    {/* Portrait container with inner shadow */}
                    <div 
                      className="relative w-full h-full rounded-md overflow-hidden"
                      style={{
                        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <img 
                        src="/samples/cat1.png" 
                        alt="Sebastian - Royal Cat Portrait"
                        className="w-full h-full object-cover scale-125"
                        style={{ objectPosition: 'center 5%' }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Pet Name */}
            <p 
              className="mt-3 text-sm sm:text-base font-medium"
              style={{ 
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: '#C5A572',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                letterSpacing: '0.05em'
              }}
            >
              Sebastian
            </p>
          </div>

          {/* Third Portrait - Charley & Lily (Two Dogs) */}
          <div className="flex flex-col items-center">
            <div 
              className="w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 transform rotate-3 hover:rotate-0 hover:scale-105 transition-all duration-300 relative flex-shrink-0 cursor-pointer group"
              style={{ padding: '2px' }}
              onClick={() => openLightbox(heroPortraits[2])}
            >
              {/* Soft outer glow/vignette */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'radial-gradient(ellipse at center, rgba(212, 184, 150, 0.3) 0%, rgba(197, 165, 114, 0.15) 50%, transparent 70%)',
                  filter: 'blur(20px)',
                  zIndex: 0,
                  transform: 'scale(1.1)'
                }}
              />
              
              {/* Outer frame layer - beveled edge */}
              <div 
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, #E8D4B0 0%, #D4B896 20%, #C5A572 40%, #D4B896 60%, #C5A572 80%, #E8D4B0 100%)',
                  padding: '1px',
                  boxShadow: `
                    0 8px 32px rgba(197, 165, 114, 0.4),
                    0 0 0 1px rgba(197, 165, 114, 0.6),
                    inset 0 2px 4px rgba(255, 255, 255, 0.4),
                    inset 0 -2px 4px rgba(166, 139, 91, 0.4)
                  `.trim().replace(/\s+/g, ' '),
                  zIndex: 1
                }}
              >
                {/* Middle frame layer - dimensional molding */}
                <div 
                  className="absolute inset-0.5 rounded-xl"
                  style={{
                    background: 'linear-gradient(135deg, #D4B896 0%, #C5A572 30%, #D4B896 60%, #C5A572 100%)',
                    padding: '0.5px',
                    boxShadow: `
                      inset 0 1px 2px rgba(255, 255, 255, 0.35),
                      inset 0 -1px 2px rgba(166, 139, 91, 0.35)
                    `.trim().replace(/\s+/g, ' ')
                  }}
                >
                  {/* Inner frame layer */}
                  <div 
                    className="absolute inset-0.5 rounded-lg"
                    style={{
                      background: 'linear-gradient(135deg, #E8D4B0 0%, #D4B896 25%, #C5A572 50%, #D4B896 75%, #E8D4B0 100%)',
                      padding: '0.5px',
                      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)'
                    }}
                  >
                    {/* Portrait container with inner shadow */}
                    <div 
                      className="relative w-full h-full rounded-md overflow-hidden"
                      style={{
                        boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <img 
                        src="/samples/charley&Lily2.png" 
                        alt="Charley & Lily - Royal Duo Portrait"
                        className="w-full h-full object-cover scale-125"
                        style={{ objectPosition: 'center 10%' }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <svg className="w-8 h-8 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Pet Names */}
            <p 
              className="mt-3 text-sm sm:text-base font-medium"
              style={{ 
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                color: '#C5A572',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                letterSpacing: '0.05em'
              }}
            >
              Charley & Lily
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="animate-fade-in-up delay-400">
          <button
            onClick={() => {
              captureEvent("upload_button_clicked", {
                source: "hero",
              });
              onUploadClick();
            }}
            className="btn-primary text-lg px-8 py-4 group"
          >
            <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload your pet photo
          </button>
          <p 
            className="text-sm mt-3 animate-fade-in-up delay-500"
            style={{ color: '#7A756D', fontStyle: 'italic' }}
          >
            No sign up required
          </p>
        </div>

        {/* Social Proof Counter */}
        <div className="mt-6 animate-fade-in-up delay-500">
          <p className="text-sm" style={{ color: '#7A756D' }}>
            <span style={{ color: '#C5A572', fontWeight: '500' }}>
              {portraitCount.toLocaleString()}+
            </span>
            {" "}portraits created
          </p>
        </div>

        {/* Trust Badges */}
        <div className="mt-6 flex flex-wrap justify-center gap-4 sm:gap-6 animate-fade-in-up delay-600">
          {/* Secure Checkout */}
          <div className="flex items-center gap-2" style={{ color: '#7A756D' }}>
            <svg className="w-4 h-4" style={{ color: '#4ADE80' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs sm:text-sm">Secure Checkout</span>
          </div>
          
          {/* Instant Delivery */}
          <div className="flex items-center gap-2" style={{ color: '#7A756D' }}>
            <svg className="w-4 h-4" style={{ color: '#60A5FA' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
            <span className="text-xs sm:text-sm">Instant Delivery</span>
          </div>
          
          {/* Satisfaction Guaranteed */}
          <div className="flex items-center gap-2" style={{ color: '#7A756D' }}>
            <svg className="w-4 h-4" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-xs sm:text-sm">Satisfaction Guaranteed</span>
          </div>
        </div>

      </div>

      {/* Magical Lightbox Modal */}
      {selectedPortrait && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.92)' }}
          onClick={closeLightbox}
        >
          {/* Magical sparkle particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full"
                style={{
                  backgroundColor: '#C5A572',
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  opacity: isAnimating ? 0.6 : 0,
                  transform: `scale(${isAnimating ? 1 : 0})`,
                  transition: `all ${0.3 + Math.random() * 0.5}s ease-out ${Math.random() * 0.2}s`,
                  boxShadow: '0 0 6px 2px rgba(197, 165, 114, 0.5)',
                }}
              />
            ))}
          </div>

          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded-full transition-all duration-200 hover:scale-110 hover:bg-white/10"
            style={{ color: '#F0EDE8' }}
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Portrait with magical reveal animation */}
          <div 
            className={`relative transition-all duration-500 ease-out ${isAnimating ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '85vh',
            }}
          >
            {/* Magical glow behind frame */}
            <div 
              className={`absolute inset-0 transition-all duration-700 ${isAnimating ? 'opacity-100 scale-110' : 'opacity-0 scale-100'}`}
              style={{
                background: 'radial-gradient(ellipse at center, rgba(197, 165, 114, 0.4) 0%, rgba(197, 165, 114, 0.1) 40%, transparent 70%)',
                filter: 'blur(40px)',
                transform: 'scale(1.3)',
              }}
            />
            
            {/* Gold frame */}
            <div 
              className="relative p-2 sm:p-3 rounded-xl"
              style={{ 
                background: 'linear-gradient(135deg, #E8D4B0 0%, #C5A572 30%, #E8D4B0 50%, #C5A572 70%, #E8D4B0 100%)',
                boxShadow: `
                  0 30px 100px rgba(0, 0, 0, 0.5),
                  0 0 60px rgba(197, 165, 114, 0.3),
                  inset 0 2px 4px rgba(255, 255, 255, 0.4),
                  inset 0 -2px 4px rgba(166, 139, 91, 0.4)
                `.trim().replace(/\s+/g, ' '),
              }}
            >
              <div className="relative rounded-lg overflow-hidden">
                <Image
                  src={selectedPortrait.image}
                  alt={selectedPortrait.title}
                  width={800}
                  height={800}
                  className="object-contain"
                  style={{
                    maxHeight: '75vh',
                    width: 'auto',
                  }}
                  priority
                />
              </div>
            </div>

            {/* Title below */}
            <div 
              className={`text-center mt-4 transition-all duration-500 delay-200 ${isAnimating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <h3 
                className="text-2xl sm:text-3xl"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                {selectedPortrait.title}
              </h3>
              <p className="text-sm mt-1" style={{ color: '#7A756D' }}>
                Click anywhere or press ESC to close
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
