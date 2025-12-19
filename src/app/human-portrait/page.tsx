"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { humanPortraitConfig } from "@/lib/apps";
import { AppUploadModal } from "@/components/app";
import HumanPortraitGenerationFlow from "@/components/app/HumanPortraitGenerationFlow";
import ContactModal from "@/components/Contact";
import { captureUTMParams } from "@/lib/utm";
import { captureEvent } from "@/lib/posthog";

// Storage keys
const HUMAN_PORTRAIT_CREATIONS_KEY = "human_portrait_creations";

interface Creation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
}

const hasCreations = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(HUMAN_PORTRAIT_CREATIONS_KEY);
  if (!stored) return false;
  const creations: Creation[] = JSON.parse(stored);
  return creations.length > 0;
};

const getCreations = (): Creation[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(HUMAN_PORTRAIT_CREATIONS_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
};

// Creation card with image error handling
function CreationCard({ creation, appConfig }: { creation: Creation; appConfig: typeof humanPortraitConfig }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <a
      href={creation.previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative aspect-square rounded-xl overflow-hidden group transition-transform duration-300 hover:scale-105"
      style={{
        border: `2px solid ${appConfig.theme.primaryColor}30`,
        background: `${appConfig.theme.primaryColor}10`,
      }}
    >
      {!imageError ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${appConfig.theme.primaryColor}40`, borderTopColor: 'transparent' }}
              />
            </div>
          )}
          <Image
            src={creation.previewUrl}
            alt="Created portrait"
            fill
            className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            unoptimized
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <svg 
            className="w-12 h-12 mb-2" 
            style={{ color: appConfig.theme.primaryColor }} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs" style={{ color: '#7A756D' }}>Image expired</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </div>
    </a>
  );
}

export default function HumanPortraitPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCreationsModalOpen, setIsCreationsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasAnyCreations, setHasAnyCreations] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [creations, setCreations] = useState<Creation[]>([]);

  const appConfig = humanPortraitConfig;

  useEffect(() => {
    if (typeof window !== "undefined") {
      captureUTMParams();
      setHasAnyCreations(hasCreations());
      setCreations(getCreations());
    }
  }, []);

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setIsUploadModalOpen(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
    
    // Refresh creations
    const hasCreationsNow = hasCreations();
    setHasAnyCreations(hasCreationsNow);
    setCreations(getCreations());
    
    if (hasCreationsNow) {
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 12000);
    }
  };

  return (
    <main 
      className="min-h-screen overflow-x-hidden"
      style={{
        background: 'linear-gradient(180deg, #0D0B09 0%, #1A1612 15%, #1E1915 50%, #1A1612 85%, #0D0B09 100%)',
      }}
    >
      {/* Subtle Renaissance Frame Effect */}
      <div 
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 20%, rgba(155, 123, 92, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(94, 75, 59, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(196, 165, 116, 0.04) 0%, transparent 70%)
          `,
        }}
      />
      
      {/* Elegant Hero Section */}
      <section className="min-h-[90vh] flex flex-col items-center justify-center px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-10 relative overflow-hidden w-full z-10">
        {/* Back to Hub Link - Elegant Style */}
        <div className="absolute top-4 left-4 z-50">
          <Link 
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-all duration-300 hover:scale-105"
            style={{
              background: 'rgba(155, 123, 92, 0.1)',
              border: '1px solid rgba(155, 123, 92, 0.3)',
              color: '#9B7B5C',
              fontFamily: "'Playfair Display', Georgia, serif",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Apps
          </Link>
        </div>

        {/* Decorative Corner Ornaments */}
        <div 
          className="absolute top-8 right-8 text-4xl hidden sm:block" 
          style={{ 
            color: '#9B7B5C', 
            opacity: 0.3,
            fontFamily: "'Playfair Display', serif",
          }}
        >
          ❧
        </div>
        <div 
          className="absolute bottom-8 left-8 text-4xl hidden sm:block" 
          style={{ 
            color: '#9B7B5C', 
            opacity: 0.3, 
            transform: 'rotate(180deg)',
            fontFamily: "'Playfair Display', serif",
          }}
        >
          ❧
        </div>

        <div className="w-full max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
          {/* Renaissance Frame Logo */}
          <div 
            className="mb-8 p-1 rounded-full animate-fade-in-up"
            style={{
              background: 'linear-gradient(135deg, #C4A574 0%, #9B7B5C 50%, #6B5344 100%)',
              boxShadow: '0 0 40px rgba(155, 123, 92, 0.3), inset 0 0 20px rgba(0,0,0,0.2)',
            }}
          >
            <div 
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, #1A1612 0%, #0D0B09 100%)',
              }}
            >
              <span 
                className="text-4xl sm:text-5xl"
                style={{ 
                  fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
                  color: '#C4A574',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                PS
              </span>
            </div>
          </div>

          {/* Tagline */}
          <p 
            className="text-sm sm:text-base mb-4 tracking-[0.3em] uppercase animate-fade-in-up"
            style={{ 
              color: '#9B7B5C', 
              fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
              letterSpacing: '0.3em',
            }}
          >
            {appConfig.tagline}
          </p>

          {/* Decorative Line */}
          <div className="flex items-center justify-center gap-4 mb-6 w-full max-w-md animate-fade-in-up">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #9B7B5C, transparent)' }} />
            <div style={{ color: '#9B7B5C', fontSize: '12px' }}>✦</div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #9B7B5C, transparent)' }} />
          </div>

          {/* Main Title */}
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-6 animate-fade-in-up delay-100"
            style={{ 
              fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif", 
              color: '#F0EDE8', 
              fontWeight: 400,
              letterSpacing: '0.02em',
              lineHeight: '1.2',
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.5)',
            }}
          >
            Transform Yourself Into a{' '}
            <span 
              className="block sm:inline"
              style={{ 
                color: '#C4A574',
                fontStyle: 'italic',
                textShadow: '0 0 20px rgba(196, 165, 116, 0.3)',
              }}
            >
              Classical Masterpiece
            </span>
          </h1>

          {/* Subtitle */}
          <p 
            className="text-base sm:text-lg mb-10 animate-fade-in-up delay-200 max-w-2xl mx-auto"
            style={{ 
              color: '#A89F93',
              fontFamily: "'EB Garamond', Georgia, serif",
              fontStyle: 'italic',
              lineHeight: '1.8',
            }}
          >
            {appConfig.content.heroSubtitle}
          </p>

          {/* CTA Button - Elegant Renaissance Style */}
          <div className="animate-fade-in-up delay-300 mb-8">
            <button
              onClick={() => {
                captureEvent("upload_button_clicked", {
                  source: "hero",
                  app: appConfig.id,
                });
                handleUploadClick();
              }}
              className="text-lg px-10 py-4 group transition-all duration-300 hover:scale-105 flex items-center gap-3 rounded-full"
              style={{
                background: appConfig.theme.buttonGradient,
                color: '#F0EDE8',
                fontFamily: "'Playfair Display', Georgia, serif",
                boxShadow: '0 8px 32px rgba(155, 123, 92, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                border: '1px solid rgba(196, 165, 116, 0.3)',
                letterSpacing: '0.05em',
              }}
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {appConfig.content.ctaText}
            </button>
            <p 
              className="text-sm mt-4 animate-fade-in-up delay-400"
              style={{ 
                color: '#7A756D', 
                fontFamily: "'EB Garamond', Georgia, serif",
                fontStyle: 'italic' 
              }}
            >
              No sign up required • Instant results
            </p>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center gap-6 animate-fade-in-up delay-500">
            <div className="flex items-center gap-2" style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}>
              <svg className="w-4 h-4" style={{ color: '#4ADE80' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">100% Secure</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}>
              <svg className="w-4 h-4" style={{ color: '#60A5FA' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              <span className="text-sm">Instant Delivery</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}>
              <svg className="w-4 h-4" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm">Museum Quality</span>
            </div>
          </div>
        </div>
      </section>

      {/* My Creations Button */}
      {!selectedFile && hasAnyCreations && (
        <div className="flex flex-col items-center py-6 -mt-8 gap-2 relative z-10">
          {justGenerated && (
            <div 
              className="text-sm font-medium animate-bounce"
              style={{ 
                color: appConfig.theme.primaryColor,
                fontFamily: appConfig.theme.fontFamily,
              }}
            >
              ✨ Your masterpiece is saved! ✨
            </div>
          )}
          <button
            onClick={() => {
              setIsCreationsModalOpen(true);
              setJustGenerated(false);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
              justGenerated ? 'animate-pulse scale-105' : ''
            }`}
            style={{
              background: justGenerated 
                ? `linear-gradient(135deg, ${appConfig.theme.primaryColor}35 0%, ${appConfig.theme.primaryColor}20 100%)`
                : `linear-gradient(135deg, ${appConfig.theme.primaryColor}15 0%, ${appConfig.theme.primaryColor}08 100%)`,
              border: justGenerated 
                ? `2px solid ${appConfig.theme.primaryColor}60`
                : `1px solid ${appConfig.theme.primaryColor}30`,
              color: appConfig.theme.primaryColor,
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span style={{ fontFamily: appConfig.theme.fontFamily }}>My Masterpieces</span>
          </button>
        </div>
      )}

      {/* Decorative Separator */}
      <div className="flex items-center justify-center py-8 relative z-10">
        <div className="flex-1 max-w-xs h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(155, 123, 92, 0.3), transparent)' }} />
        <div className="px-4" style={{ color: '#9B7B5C', fontSize: '20px' }}>❦</div>
        <div className="flex-1 max-w-xs h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(155, 123, 92, 0.3), transparent)' }} />
      </div>
      
      {/* How It Works Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12 sm:mb-16">
            <p 
              className="text-sm tracking-[0.2em] uppercase mb-4"
              style={{ color: '#9B7B5C', fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              The Process
            </p>
            <h2 
              className="text-3xl sm:text-4xl mb-4"
              style={{ 
                fontFamily: "'Playfair Display', Georgia, serif",
                color: '#F0EDE8',
                fontWeight: 400,
              }}
            >
              How the Magic Unfolds
            </h2>
            <p style={{ color: '#A89F93', fontFamily: "'EB Garamond', Georgia, serif", fontSize: '18px' }}>
              Three simple steps to your timeless masterpiece
            </p>
          </div>

          {/* Steps Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {appConfig.content.howItWorks.map((step, index) => (
              <div 
                key={step.step}
                className="text-center p-6 sm:p-8 relative rounded-xl transition-all duration-300 hover:scale-105"
                style={{
                  background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.08) 0%, rgba(155, 123, 92, 0.02) 100%)',
                  border: '1px solid rgba(155, 123, 92, 0.2)',
                }}
              >
                {/* Step Number */}
                <div className="relative mb-6">
                  <div 
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(155, 123, 92, 0.2) 0%, rgba(155, 123, 92, 0.05) 100%)',
                      border: '2px solid rgba(196, 165, 116, 0.4)',
                      boxShadow: '0 4px 20px rgba(155, 123, 92, 0.2)',
                    }}
                  >
                    <span 
                      style={{ 
                        fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
                        fontSize: '24px',
                        color: '#C4A574',
                        fontStyle: 'italic',
                      }}
                    >
                      {step.step}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 
                  className="text-xl sm:text-2xl mb-3"
                  style={{ 
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: '#F0EDE8',
                    fontWeight: 400,
                  }}
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p 
                  className="text-sm sm:text-base"
                  style={{ 
                    color: '#A89F93',
                    fontFamily: "'EB Garamond', Georgia, serif",
                  }}
                >
                  {step.description}
                </p>

                {/* Arrow for desktop */}
                {index < appConfig.content.howItWorks.length - 1 && (
                  <div 
                    className="hidden md:block absolute -right-5 top-1/2 transform -translate-y-1/2 text-2xl" 
                    style={{ color: '#9B7B5C' }}
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p 
              className="text-lg sm:text-xl mb-2"
              style={{ 
                color: '#A89F93', 
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 500,
              }}
            >
              Join <strong style={{ color: '#C4A574' }}>thousands</strong> who have become timeless masterpieces
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div 
              className="p-6 rounded-lg text-center"
              style={{ 
                background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.1) 0%, rgba(155, 123, 92, 0.03) 100%)',
                border: '1px solid rgba(155, 123, 92, 0.2)',
              }}
            >
              <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
              <p 
                className="text-sm mb-4"
                style={{ 
                  color: '#A89F93', 
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                }}
              >
                "I look like I belong in a museum! The attention to detail is incredible - every feature is perfectly captured."
              </p>
              <p 
                className="text-sm font-medium"
                style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                — Michael R.
              </p>
            </div>

            {/* Testimonial 2 */}
            <div 
              className="p-6 rounded-lg text-center"
              style={{ 
                background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.1) 0%, rgba(155, 123, 92, 0.03) 100%)',
                border: '1px solid rgba(155, 123, 92, 0.2)',
              }}
            >
              <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
              <p 
                className="text-sm mb-4"
                style={{ 
                  color: '#A89F93', 
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                }}
              >
                "Made a portrait of my partner as an anniversary gift. They absolutely loved it - now it's hanging in our living room!"
              </p>
              <p 
                className="text-sm font-medium"
                style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                — Jennifer L.
              </p>
            </div>

            {/* Testimonial 3 */}
            <div 
              className="p-6 rounded-lg text-center"
              style={{ 
                background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.1) 0%, rgba(155, 123, 92, 0.03) 100%)',
                border: '1px solid rgba(155, 123, 92, 0.2)',
              }}
            >
              <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
              <p 
                className="text-sm mb-4"
                style={{ 
                  color: '#A89F93', 
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                }}
              >
                "The Renaissance style is so authentic! I feel like I stepped out of an old master painting. Truly stunning quality."
              </p>
              <p 
                className="text-sm font-medium"
                style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                — David K.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div 
            className="p-8 rounded-xl text-center"
            style={{ 
              background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.08) 0%, rgba(155, 123, 92, 0.02) 100%)',
              border: '2px solid rgba(155, 123, 92, 0.2)',
            }}
          >
            {/* Shield Icon */}
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ 
                background: appConfig.theme.buttonGradient,
              }}
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>

            <h3 
              className="text-2xl sm:text-3xl mb-4"
              style={{ 
                fontFamily: "'Playfair Display', Georgia, serif",
                color: '#F0EDE8',
                fontWeight: 400,
              }}
            >
              Your Privacy is Sacred
            </h3>

            <p 
              className="text-base sm:text-lg mb-6 max-w-2xl mx-auto"
              style={{ 
                color: '#A89F93', 
                fontFamily: "'EB Garamond', Georgia, serif",
                lineHeight: '1.7',
              }}
            >
              Your photos are encrypted during upload, used only to create your portrait, never shared or sold, and automatically deleted within 24 hours.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div 
                className="flex items-start gap-3 p-4 rounded-lg" 
                style={{ background: 'rgba(155, 123, 92, 0.1)' }}
              >
                <span className="text-xl">🔒</span>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#F0EDE8', fontFamily: "'EB Garamond', Georgia, serif" }}>
                    Bank-Level Encryption
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#A89F93' }}>
                    Your photos are protected
                  </p>
                </div>
              </div>

              <div 
                className="flex items-start gap-3 p-4 rounded-lg" 
                style={{ background: 'rgba(155, 123, 92, 0.1)' }}
              >
                <span className="text-xl">🎨</span>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#F0EDE8', fontFamily: "'EB Garamond', Georgia, serif" }}>
                    Used Only for Art
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#A89F93' }}>
                    Never shared or sold
                  </p>
                </div>
              </div>

              <div 
                className="flex items-start gap-3 p-4 rounded-lg" 
                style={{ background: 'rgba(155, 123, 92, 0.1)' }}
              >
                <span className="text-xl">🗑️</span>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#F0EDE8', fontFamily: "'EB Garamond', Georgia, serif" }}>
                    Auto-Deleted
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#A89F93' }}>
                    Permanently removed in 24h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <p 
              className="text-sm tracking-[0.2em] uppercase mb-4"
              style={{ color: '#9B7B5C', fontFamily: "'Cinzel', 'Playfair Display', serif" }}
            >
              Questions & Answers
            </p>
            <h2 
              className="text-3xl sm:text-4xl mb-4"
              style={{ 
                fontFamily: "'Playfair Display', Georgia, serif",
                color: '#F0EDE8',
                fontWeight: 400,
              }}
            >
              Frequently Asked Questions
            </h2>
          </div>

          <div 
            className="p-6 sm:p-8 rounded-xl"
            style={{
              background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.08) 0%, rgba(155, 123, 92, 0.02) 100%)',
              border: '1px solid rgba(155, 123, 92, 0.2)',
            }}
          >
            {appConfig.content.faq.map((item, index) => (
              <div 
                key={index}
                className="border-b py-5 last:border-b-0"
                style={{ borderColor: 'rgba(155, 123, 92, 0.2)' }}
              >
                <h3 
                  className="text-lg sm:text-xl mb-2"
                  style={{ 
                    fontFamily: "'Playfair Display', Georgia, serif",
                    color: '#F0EDE8',
                    fontWeight: 400,
                  }}
                >
                  {item.question}
                </h3>
                <p 
                  className="text-base"
                  style={{ 
                    color: '#A89F93',
                    fontFamily: "'EB Garamond', Georgia, serif",
                  }}
                >
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="py-12 px-4 sm:px-6 relative z-10"
        style={{ 
          borderTop: '1px solid rgba(155, 123, 92, 0.2)',
          background: 'linear-gradient(180deg, transparent 0%, rgba(155, 123, 92, 0.05) 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto text-center">
          {/* Fleuron */}
          <div className="mb-6" style={{ color: '#9B7B5C', fontSize: '24px' }}>❦</div>
          
          <p 
            className="text-lg mb-4"
            style={{ 
              fontFamily: "'Playfair Display', Georgia, serif",
              color: '#A89F93',
              fontStyle: 'italic',
            }}
          >
            {appConfig.tagline}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-6 mb-6">
            <a 
              href="/"
              className="text-sm transition-colors duration-200 hover:opacity-80"
              style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              All Apps
            </a>
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="text-sm transition-colors duration-200 hover:opacity-80"
              style={{ color: '#9B7B5C', fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Contact
            </button>
          </div>

          <p 
            className="text-sm"
            style={{ color: '#7A756D', fontFamily: "'EB Garamond', Georgia, serif" }}
          >
            © {new Date().getFullYear()} {appConfig.name}
          </p>
        </div>
      </footer>

      {/* Upload Modal */}
      <AppUploadModal
        config={appConfig}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelected={handleFileSelected}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Creations Modal */}
      {isCreationsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.9)" }}
          onClick={() => setIsCreationsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, #1A1612 0%, #0D0B09 100%)',
              border: `1px solid ${appConfig.theme.primaryColor}30`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCreationsModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full transition-all duration-200 hover:scale-110"
              style={{
                background: `${appConfig.theme.primaryColor}20`,
                color: appConfig.theme.primaryColor,
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2
              className="text-2xl mb-6"
              style={{
                fontFamily: appConfig.theme.fontFamily,
                color: '#F0EDE8',
              }}
            >
              My Masterpieces
            </h2>

            {creations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {creations.map((creation) => (
                  <CreationCard 
                    key={creation.imageId} 
                    creation={creation} 
                    appConfig={appConfig} 
                  />
                ))}
              </div>
            ) : (
              <p style={{ color: '#7A756D', textAlign: 'center', padding: '2rem' }}>
                No masterpieces yet. Upload a photo to create your first portrait!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Generation Flow */}
      {selectedFile && (
        <HumanPortraitGenerationFlow 
          file={selectedFile} 
          onReset={handleReset} 
        />
      )}
    </main>
  );
}

