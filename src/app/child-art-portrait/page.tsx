"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { childArtPortraitConfig } from "@/lib/apps";
import { AppUploadModal } from "@/components/app";
import ChildArtGenerationFlow from "@/components/app/ChildArtGenerationFlow";
import ContactModal from "@/components/Contact";
import { captureUTMParams } from "@/lib/utm";
import { captureEvent } from "@/lib/posthog";

// Storage keys
const CHILD_ART_CREATIONS_KEY = "child_art_creations";

interface Creation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
}

const hasCreations = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(CHILD_ART_CREATIONS_KEY);
  if (!stored) return false;
  const creations: Creation[] = JSON.parse(stored);
  return creations.length > 0;
};

const getCreations = (): Creation[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(CHILD_ART_CREATIONS_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
};

// Creation card with image error handling
function CreationCard({ creation, appConfig }: { creation: Creation; appConfig: typeof childArtPortraitConfig }) {
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

export default function ChildArtPortraitPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCreationsModalOpen, setIsCreationsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasAnyCreations, setHasAnyCreations] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [creations, setCreations] = useState<Creation[]>([]);

  const appConfig = childArtPortraitConfig;

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
        background: 'linear-gradient(180deg, #F5F0E6 0%, #EDE4D3 15%, #E8DEC8 50%, #DFD4C0 85%, #D4C9B5 100%)',
      }}
    >
      {/* Decorative book spine on left */}
      <div 
        className="fixed left-0 top-0 bottom-0 w-2 z-10 hidden md:block"
        style={{
          background: 'linear-gradient(180deg, #6B5645, #8B7355, #6B5645)',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.15)',
        }}
      />
      
      {/* Vintage Hero Section */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-10 relative overflow-hidden w-full z-10">
        {/* Back to Hub Link - Vintage Style */}
        <div className="absolute top-4 left-4 z-50">
          <Link 
            href="/"
            className="flex items-center gap-2 px-4 py-2 rounded text-sm transition-all duration-300 hover:scale-105"
            style={{
              background: 'rgba(245, 240, 230, 0.9)',
              border: '1px solid #C4A574',
              color: '#8B7355',
              fontFamily: "'EB Garamond', Georgia, serif",
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Apps
          </Link>
        </div>

        {/* Decorative Corner Ornaments */}
        <div className="absolute top-8 right-8 text-3xl hidden sm:block" style={{ color: '#C4A574', opacity: 0.6 }}>❧</div>
        <div className="absolute bottom-8 left-8 text-3xl hidden sm:block" style={{ color: '#C4A574', opacity: 0.6, transform: 'rotate(180deg)' }}>❧</div>

        <div className="w-full max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
          {/* Vintage Book Title Card */}
          <div 
            className="px-8 py-6 sm:px-12 sm:py-8 mb-8 rounded-lg"
            style={{ 
              maxWidth: '600px',
              background: 'linear-gradient(135deg, #F5F0E6 0%, #EDE4D3 100%)',
              border: '3px solid #8B7355',
              boxShadow: 'inset 0 2px 8px rgba(139, 115, 85, 0.1), 0 8px 32px rgba(139, 115, 85, 0.15)',
            }}
          >
            {/* Vintage Subtitle */}
            <p 
              className="text-sm sm:text-base mb-3 tracking-widest uppercase"
              style={{ 
                color: '#8B7355', 
                fontFamily: "'EB Garamond', Georgia, serif",
                letterSpacing: '0.2em',
              }}
            >
              {appConfig.tagline}
            </p>

            {/* Decorative Line */}
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #C4A574, transparent)' }} />
            </div>

            {/* Main Title */}
            <h1 
              className="text-3xl sm:text-4xl md:text-5xl mb-4"
              style={{ 
                fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif", 
                color: '#3A3025', 
                fontWeight: 500,
                letterSpacing: '0.02em',
                lineHeight: '1.2'
              }}
            >
              {appConfig.content.heroTitle}
            </h1>

            {/* Decorative Line */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, #C4A574, transparent)' }} />
            </div>
          </div>

          {/* Subtitle */}
          <p 
            className="text-base sm:text-lg mb-8 sm:mb-10 animate-fade-in-up delay-200 max-w-xl mx-auto"
            style={{ 
              color: '#5A4F45',
              fontFamily: "'EB Garamond', Georgia, serif",
              fontStyle: 'italic',
              lineHeight: '1.7',
            }}
          >
            {appConfig.content.heroSubtitle}
          </p>

          {/* CTA Button - Vintage Style */}
          <div className="animate-fade-in-up delay-300">
            <button
              onClick={() => {
                captureEvent("upload_button_clicked", {
                  source: "hero",
                  app: appConfig.id,
                });
                handleUploadClick();
              }}
              className="text-lg px-8 py-4 group transition-all duration-300 hover:scale-105 flex items-center gap-3 vintage-btn"
              style={{
                fontSize: '18px',
                padding: '16px 32px',
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
                color: '#8B7355', 
                fontFamily: "'EB Garamond', Georgia, serif",
                fontStyle: 'italic' 
              }}
            >
              No sign up required
            </p>
          </div>

          {/* Trusted By Badge */}
          <div 
            className="mt-8 mb-4 px-6 py-3 rounded-full"
            style={{ 
              background: 'rgba(139, 115, 85, 0.1)',
              border: '1px solid rgba(196, 165, 116, 0.3)',
            }}
          >
            <p 
              className="text-base sm:text-lg"
              style={{ 
                color: '#5A4F45', 
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 500,
              }}
            >
              ⭐ Trusted by over <strong style={{ color: '#8B7355' }}>5,000+ parents</strong>
            </p>
          </div>

          {/* Vintage Trust Badges */}
          <div className="mt-4 flex flex-wrap justify-center gap-6">
            <div className="flex items-center gap-2" style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}>
              <span style={{ fontSize: '18px' }}>🔒</span>
              <span className="text-sm">100% Secure</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}>
              <span style={{ fontSize: '18px' }}>⚡</span>
              <span className="text-sm">Instant Delivery</span>
            </div>
            <div className="flex items-center gap-2" style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}>
              <span style={{ fontSize: '18px' }}>🗑️</span>
              <span className="text-sm">Photos Auto-Deleted</span>
            </div>
          </div>
        </div>
      </section>

      {/* My Creations Button */}
      {!selectedFile && hasAnyCreations && (
        <div className="flex flex-col items-center py-6 -mt-8 gap-2">
          {justGenerated && (
            <div 
              className="text-sm font-medium animate-bounce"
              style={{ 
                color: appConfig.theme.primaryColor,
                fontFamily: appConfig.theme.fontFamily,
              }}
            >
              ✨ Your portrait is saved! ✨
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
            <span style={{ fontFamily: appConfig.theme.fontFamily }}>My Creations</span>
          </button>
        </div>
      )}

      {/* Vintage Decorative Separator */}
      <div className="vintage-separator" />
      
      {/* How It Works Section */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Vintage Section Header */}
          <div className="text-center mb-12 sm:mb-16">
            <div className="vintage-divider mb-6">
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '14px', letterSpacing: '0.2em', color: '#8B7355', textTransform: 'uppercase' }}>
                The Process
              </span>
            </div>
            <h2 
              className="text-3xl sm:text-4xl mb-4 vintage-heading"
              style={{ color: '#4A3F35' }}
            >
              How the Magic Unfolds
            </h2>
            <p style={{ color: '#6B5F55', fontFamily: "'EB Garamond', Georgia, serif", fontSize: '18px' }}>
              Three simple steps to your vintage masterpiece
            </p>
          </div>

          {/* Vintage Steps Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
            {appConfig.content.howItWorks.map((step, index) => (
              <div 
                key={step.step}
                className="text-center aged-paper-card p-6 sm:p-8 relative"
              >
                {/* Step Number with Vintage Ornament */}
                <div className="relative mb-6">
                  <div 
                    className="inline-flex items-center justify-center w-16 h-16 rounded-full"
                    style={{ 
                      background: 'linear-gradient(135deg, #F5F0E6 0%, #EDE4D3 100%)',
                      border: '2px solid #C4A574',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05), 0 2px 8px rgba(139, 115, 85, 0.2)',
                    }}
                  >
                    <span 
                      style={{ 
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: '24px',
                        color: '#8B7355',
                        fontStyle: 'italic',
                      }}
                    >
                      {step.step}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <h3 
                  className="text-xl sm:text-2xl mb-3 vintage-heading"
                  style={{ color: '#4A3F35' }}
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p 
                  className="text-sm sm:text-base vintage-text"
                  style={{ color: '#6B5F55' }}
                >
                  {step.description}
                </p>

                {/* Vintage decorative flourish */}
                {index < appConfig.content.howItWorks.length - 1 && (
                  <div className="hidden md:block absolute -right-5 top-1/2 transform -translate-y-1/2 text-2xl" style={{ color: '#C4A574' }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-10">
            <p 
              className="text-lg sm:text-xl mb-2"
              style={{ 
                color: '#5A4F45', 
                fontFamily: "'EB Garamond', Georgia, serif",
                fontWeight: 500,
              }}
            >
              Join <strong style={{ color: '#8B7355' }}>5,000+ happy parents</strong> who have transformed their children into storybook characters
            </p>
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div 
              className="p-6 rounded-lg text-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(245, 240, 230, 0.8) 0%, rgba(237, 228, 211, 0.8) 100%)',
                border: '1px solid #C4A574',
              }}
            >
              <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
              <p 
                className="text-sm mb-4"
                style={{ 
                  color: '#5A4F45', 
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                }}
              >
                "My daughter looks like she stepped right out of a fairy tale book! We framed it for her bedroom and she absolutely loves it."
              </p>
              <p 
                className="text-sm font-medium"
                style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                — Sarah M., Mother of 2
              </p>
            </div>

            {/* Testimonial 2 */}
            <div 
              className="p-6 rounded-lg text-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(245, 240, 230, 0.8) 0%, rgba(237, 228, 211, 0.8) 100%)',
                border: '1px solid #C4A574',
              }}
            >
              <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
              <p 
                className="text-sm mb-4"
                style={{ 
                  color: '#5A4F45', 
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                }}
              >
                "The vintage style is so charming! It captured my son's personality perfectly. Grandma cried happy tears when she saw it."
              </p>
              <p 
                className="text-sm font-medium"
                style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                — Jennifer L., Mother of 3
              </p>
            </div>

            {/* Testimonial 3 */}
            <div 
              className="p-6 rounded-lg text-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(245, 240, 230, 0.8) 0%, rgba(237, 228, 211, 0.8) 100%)',
                border: '1px solid #C4A574',
              }}
            >
              <div className="text-2xl mb-3">⭐⭐⭐⭐⭐</div>
              <p 
                className="text-sm mb-4"
                style={{ 
                  color: '#5A4F45', 
                  fontFamily: "'EB Garamond', Georgia, serif",
                  fontStyle: 'italic',
                  lineHeight: '1.6',
                }}
              >
                "Amazing quality and so fast! I was worried about privacy but my photo was only used for the portrait and nothing else."
              </p>
              <p 
                className="text-sm font-medium"
                style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                — Amanda K., Mother of 1
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy & Safety Assurance Section */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          <div 
            className="p-8 rounded-lg text-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(139, 115, 85, 0.08) 0%, rgba(196, 165, 116, 0.08) 100%)',
              border: '2px solid #C4A574',
            }}
          >
            {/* Shield Icon */}
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ 
                background: 'linear-gradient(135deg, #8B7355 0%, #C4A574 100%)',
              }}
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>

            <h3 
              className="text-2xl sm:text-3xl mb-4"
              style={{ 
                fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif",
                color: '#3A3025',
                fontWeight: 500,
              }}
            >
              Your Child's Privacy is Our Priority
            </h3>

            <p 
              className="text-base sm:text-lg mb-6 max-w-2xl mx-auto"
              style={{ 
                color: '#5A4F45', 
                fontFamily: "'EB Garamond', Georgia, serif",
                lineHeight: '1.7',
              }}
            >
              We understand how precious your family photos are. That's why we've built our system with your privacy at the core.
            </p>

            {/* Privacy Points */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <span className="text-xl">🔒</span>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#3A3025', fontFamily: "'EB Garamond', Georgia, serif" }}>
                    100% Secure Upload
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6B5F55' }}>
                    Bank-level encryption protects your photos
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <span className="text-xl">🎨</span>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#3A3025', fontFamily: "'EB Garamond', Georgia, serif" }}>
                    Used Only for Your Art
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6B5F55' }}>
                    Photos are never shared, sold, or used for training
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-lg" style={{ background: 'rgba(255,255,255,0.5)' }}>
                <span className="text-xl">🗑️</span>
                <div>
                  <p className="font-medium text-sm" style={{ color: '#3A3025', fontFamily: "'EB Garamond', Georgia, serif" }}>
                    Auto-Deleted After Use
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#6B5F55' }}>
                    Your original photo is permanently deleted within 24 hours
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vintage Decorative Separator */}
      <div className="vintage-separator" />

      {/* FAQ Section with Vintage Styling */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 relative z-10">
        <div className="max-w-3xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="vintage-divider mb-6">
              <span style={{ fontFamily: "'EB Garamond', Georgia, serif", fontSize: '14px', letterSpacing: '0.2em', color: '#8B7355', textTransform: 'uppercase' }}>
                Questions & Answers
              </span>
            </div>
            <h2 
              className="text-3xl sm:text-4xl mb-4 vintage-heading"
              style={{ color: '#4A3F35' }}
            >
              Frequently Asked Questions
            </h2>
          </div>

          {/* FAQ Items with Vintage Card Style */}
          <div className="storybook-frame p-6 sm:p-8">
            {appConfig.content.faq.map((item, index) => (
              <div 
                key={index}
                className="border-b py-5 last:border-b-0"
                style={{ borderColor: 'rgba(196, 165, 116, 0.3)' }}
              >
                <h3 
                  className="text-lg sm:text-xl mb-2"
                  style={{ 
                    fontFamily: "'EB Garamond', Georgia, serif",
                    color: '#4A3F35',
                    fontWeight: 500,
                  }}
                >
                  {item.question}
                </h3>
                <p 
                  className="text-base vintage-text"
                  style={{ color: '#6B5F55' }}
                >
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Vintage Footer */}
      <footer 
        className="py-12 px-4 sm:px-6 relative z-10"
        style={{ 
          borderTop: '2px solid #C4A574',
          background: 'linear-gradient(180deg, transparent 0%, rgba(196, 165, 116, 0.1) 100%)',
        }}
      >
        <div className="max-w-6xl mx-auto text-center">
          {/* Vintage Fleuron */}
          <div className="mb-6" style={{ color: '#C4A574', fontSize: '24px' }}>❦</div>
          
          <p 
            className="text-lg mb-4"
            style={{ 
              fontFamily: "'EB Garamond', Georgia, serif",
              color: '#4A3F35',
              fontStyle: 'italic',
            }}
          >
            {appConfig.tagline}
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-6 mb-6">
            <a 
              href="/"
              className="text-sm transition-colors duration-200 hover:opacity-80"
              style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              All Apps
            </a>
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="text-sm transition-colors duration-200 hover:opacity-80"
              style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
            >
              Contact
            </button>
          </div>

          <p 
            className="text-sm"
            style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
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
              background: 'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%)',
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
              My Creations
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
                No creations yet. Upload a photo to create your first portrait!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Generation Flow */}
      {selectedFile && (
        <ChildArtGenerationFlow 
          file={selectedFile} 
          onReset={handleReset} 
        />
      )}
    </main>
  );
}
