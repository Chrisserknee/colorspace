"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { childArtPortraitConfig } from "@/lib/apps";
import { captureEvent } from "@/lib/posthog";

type Stage = "preview" | "select-gender" | "generating" | "result";
type Gender = "boy" | "girl";

interface ChildArtGenerationFlowProps {
  file: File | null;
  onReset: () => void;
}

// Format time remaining
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Adventure phrases for generation animation
const MAGIC_PHRASES = [
  "Your child is going on a magical adventure...",
  "Exploring enchanted lands...",
  "Discovering hidden treasures...",
  "Meeting magical friends along the way...",
  "Becoming the hero of the story...",
  "The adventure is unfolding...",
  "Creating their storybook moment...",
  "Almost there...",
];

// Storage key for creations
const CHILD_ART_CREATIONS_KEY = "child_art_creations";

interface Creation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
}

const saveCreation = (imageId: string, previewUrl: string) => {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(CHILD_ART_CREATIONS_KEY);
  let creations: Creation[] = stored ? JSON.parse(stored) : [];
  creations = [{ imageId, previewUrl, timestamp: Date.now() }, ...creations].slice(0, 20);
  localStorage.setItem(CHILD_ART_CREATIONS_KEY, JSON.stringify(creations));
};

export default function ChildArtGenerationFlow({ file, onReset }: ChildArtGenerationFlowProps) {
  const [stage, setStage] = useState<Stage>("preview");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [hdImageUrl, setHdImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes
  
  const config = childArtPortraitConfig;
  const hasGeneratedRef = useRef(false);

  // Countdown timer for urgency
  useEffect(() => {
    if (stage === "result") {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [stage]);

  // Create preview URL
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  // Cycle through phrases during generation
  useEffect(() => {
    if (stage === "generating") {
      const interval = setInterval(() => {
        setCurrentPhrase((prev) => (prev + 1) % MAGIC_PHRASES.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [stage]);

  // Generate the portrait
  const generatePortrait = useCallback(async (selectedGender: Gender) => {
    if (!file || hasGeneratedRef.current) return;
    hasGeneratedRef.current = true;
    
    setStage("generating");
    setError(null);
    
    captureEvent("child_art_generation_started", { app: config.id, gender: selectedGender });
    
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("gender", selectedGender);
      
      const response = await fetch("/api/generate-child-art", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Generation failed");
      }
      
      const data = await response.json();
      
      if (data.success && data.previewUrl) {
        setGeneratedImageUrl(data.previewUrl);
        setHdImageUrl(data.hdUrl || data.previewUrl);
        setImageId(data.imageId);
        setStage("result");
        
        // Save creation
        saveCreation(data.imageId, data.previewUrl);
        
        captureEvent("child_art_generation_complete", {
          app: config.id,
          imageId: data.imageId,
        });
      } else {
        throw new Error("No image generated");
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      hasGeneratedRef.current = false;
      captureEvent("child_art_generation_error", {
        app: config.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [file, config.id]);

  // Handle gender selection
  const handleGenderSelect = (selectedGender: Gender) => {
    setGender(selectedGender);
    generatePortrait(selectedGender);
  };

  // Handle purchase - redirect to Stripe checkout
  const handlePurchase = async () => {
    if (!imageId || isPurchasing) return;
    
    setIsPurchasing(true);
    captureEvent("child_art_purchase_clicked", { imageId });
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId,
          type: "child-art",
          cancelUrl: "/child-art-portrait",
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || "Failed to create checkout session");
        setIsPurchasing(false);
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Failed to redirect to checkout. Please try again.");
      setIsPurchasing(false);
    }
  };

  // Handle download - fetch image and trigger download (for preview/watermarked version)
  const handleDownload = async () => {
    if (!hdImageUrl || isDownloading) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(hdImageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `child-art-portrait-${imageId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback: open in new tab
      window.open(hdImageUrl, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onReset();
    }, 300);
  };

  // Move to gender selection after showing preview
  useEffect(() => {
    if (stage === "preview" && file && !hasGeneratedRef.current) {
      // Small delay to show preview, then move to gender selection
      const timer = setTimeout(() => {
        setStage("select-gender");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stage, file]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.95)" }}
    >
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded-full transition-all duration-200 hover:scale-110"
        style={{
          background: `${config.theme.primaryColor}20`,
          color: config.theme.primaryColor,
        }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className={`relative w-full max-w-2xl ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}>
        {/* Gender Selection Stage */}
        {stage === "select-gender" && (
          <div className="text-center">
            {/* Preview image */}
            <div className="relative mb-8 inline-block">
              <div
                className="absolute inset-0 rounded-2xl blur-2xl opacity-40"
                style={{ background: config.theme.buttonGradient }}
              />
              {previewUrl && (
                <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-2xl overflow-hidden">
                  <Image
                    src={previewUrl}
                    alt="Uploaded photo"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {/* Selection prompt */}
            <h2
              className="text-2xl sm:text-3xl mb-2"
              style={{
                fontFamily: config.theme.fontFamily,
                color: "#F0EDE8",
              }}
            >
              One quick question...
            </h2>
            <p className="mb-8" style={{ color: "#B8B2A8" }}>
              This helps us create the perfect adventure portrait!
            </p>

            {/* Gender buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => handleGenderSelect("boy")}
                className="group px-10 py-5 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
                style={{
                  background: "linear-gradient(135deg, #4A90D9 0%, #357ABD 100%)",
                  color: "white",
                  boxShadow: "0 10px 30px rgba(74, 144, 217, 0.4)",
                }}
              >
                <span className="text-3xl">👦</span>
                <span className="text-xl">Boy</span>
              </button>

              <button
                onClick={() => handleGenderSelect("girl")}
                className="group px-10 py-5 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
                style={{
                  background: "linear-gradient(135deg, #E875A0 0%, #D65D8C 100%)",
                  color: "white",
                  boxShadow: "0 10px 30px rgba(232, 117, 160, 0.4)",
                }}
              >
                <span className="text-3xl">👧</span>
                <span className="text-xl">Girl</span>
              </button>
            </div>
          </div>
        )}

        {/* Generating Stage */}
        {stage === "generating" && (
          <div className="text-center">
            {/* Preview image with glow */}
            <div className="relative mb-8 inline-block">
              <div
                className="absolute inset-0 rounded-2xl blur-2xl opacity-50 animate-pulse"
                style={{ background: config.theme.buttonGradient }}
              />
              {previewUrl && (
                <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-2xl overflow-hidden">
                  <Image
                    src={previewUrl}
                    alt="Uploaded photo"
                    fill
                    className="object-cover"
                    style={{ filter: "brightness(0.8)" }}
                  />
                  {/* Magical overlay */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(135deg, ${config.theme.primaryColor}40 0%, ${config.theme.secondaryColor}40 100%)`,
                      animation: "shimmer 2s infinite",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Loading spinner */}
            <div className="mb-6">
              <div
                className="w-12 h-12 mx-auto rounded-full border-4 border-t-transparent animate-spin"
                style={{ borderColor: `${config.theme.primaryColor}30`, borderTopColor: config.theme.primaryColor }}
              />
            </div>

            {/* Magic phrase */}
            <p
              className="text-xl sm:text-2xl mb-2 transition-all duration-500"
              style={{
                fontFamily: config.theme.fontFamily,
                color: config.theme.primaryColor,
              }}
            >
              {MAGIC_PHRASES[currentPhrase]}
            </p>
            <p style={{ color: "#7A756D" }}>Crafting their vintage book cover...</p>
          </div>
        )}

        {/* Result Stage - Premium Purchase Experience */}
        {stage === "result" && generatedImageUrl && (
          <div 
            className="rounded-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            style={{ 
              background: 'linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)',
              border: `1px solid ${config.theme.primaryColor}30`,
            }}
          >
            {/* Price Badge - Top */}
            <div className="text-center mb-3">
              <span 
                className="inline-block px-4 py-1.5 rounded-full text-lg font-bold"
                style={{ 
                  backgroundColor: `${config.theme.primaryColor}20`,
                  border: `1px solid ${config.theme.primaryColor}60`,
                  color: config.theme.primaryColor,
                }}
              >
                $19.99
              </span>
            </div>

            {/* Celebratory Header */}
            <div className="text-center mb-4">
              <p className="text-sm mb-1" style={{ color: config.theme.primaryColor }}>
                ✨ It&apos;s ready! ✨
              </p>
              <h3 
                className="text-2xl sm:text-3xl font-semibold"
                style={{ fontFamily: config.theme.fontFamily, color: '#F0EDE8' }}
              >
                Your Child&apos;s Storybook Portrait
              </h3>
            </div>

            {/* Preview Image */}
            <div className="relative max-w-[280px] sm:max-w-[320px] mx-auto mb-4">
              <div 
                className="absolute -inset-4 rounded-3xl pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${config.theme.primaryColor}30 0%, transparent 70%)`,
                }}
              />
              <div 
                className="relative rounded-2xl overflow-hidden shadow-2xl"
                style={{ 
                  border: `3px solid ${config.theme.primaryColor}50`,
                  boxShadow: `0 25px 50px rgba(0,0,0,0.5), 0 0 60px ${config.theme.primaryColor}30`,
                }}
              >
                <Image
                  src={generatedImageUrl}
                  alt="Your child's magical portrait"
                  width={320}
                  height={320}
                  className="w-full h-auto block"
                  unoptimized
                />
              </div>
            </div>

            {/* Urgency Timer */}
            <div 
              className="flex items-center justify-center gap-2 mb-4 py-2 px-4 rounded-full mx-auto w-fit"
              style={{ backgroundColor: `${config.theme.primaryColor}15`, border: `1px solid ${config.theme.primaryColor}30` }}
            >
              <span className="text-xs" style={{ color: config.theme.primaryColor }}>Expires in</span>
              <span className="font-mono font-bold text-sm" style={{ color: config.theme.primaryColor }}>
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>

            {/* Large Download CTA */}
            <button 
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.02] shadow-xl mb-3 disabled:opacity-50"
              style={{ 
                background: config.theme.buttonGradient,
                color: '#FFFFFF',
                boxShadow: `0 8px 24px ${config.theme.primaryColor}40`,
              }}
            >
              {isPurchasing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : (
                "Download Now - $19.99"
              )}
            </button>

            {/* Money-Back Guarantee Badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs" style={{ color: '#7A756D' }}>30-Day Money-Back Guarantee • Secure Checkout</span>
            </div>

            {/* What You Get */}
            <div 
              className="p-3 rounded-xl mb-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: '#B8B2A8' }}>What you&apos;ll receive:</p>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: '#7A756D' }}>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" style={{ color: config.theme.primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>4K High Resolution</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" style={{ color: config.theme.primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>No Watermark</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" style={{ color: config.theme.primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Print-Ready Quality</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" style={{ color: config.theme.primaryColor }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Instant Download</span>
                </div>
              </div>
            </div>

            {/* Testimonials */}
            <div 
              className="p-3 rounded-xl mb-4"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#B8B2A8' }}><span className="italic">&ldquo;My daughter loves it!&rdquo;</span> <span style={{ color: '#5A5650' }}>— Jessica M.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#B8B2A8' }}><span className="italic">&ldquo;Printed and framed for his room!&rdquo;</span> <span style={{ color: '#5A5650' }}>— Mark T.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#B8B2A8' }}><span className="italic">&ldquo;Grandma cried happy tears!&rdquo;</span> <span style={{ color: '#5A5650' }}>— Sarah L.</span></p>
                </div>
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div 
                className="mb-4 p-3 rounded-xl text-center text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171'
                }}
              >
                {error}
              </div>
            )}

            {/* Create Another Option */}
            <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              <button 
                onClick={handleClose}
                className="w-full text-center text-sm py-2 transition-colors"
                style={{ color: '#7A756D' }}
              >
                🎨 Create Another Portrait
              </button>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ background: "rgba(239, 68, 68, 0.2)" }}
            >
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl mb-2" style={{ color: "#F0EDE8" }}>
              Oops! Something went wrong
            </h2>
            <p className="mb-6" style={{ color: "#B8B2A8" }}>
              {error}
            </p>
            <button
              onClick={() => {
                hasGeneratedRef.current = false;
                setError(null);
                setStage("select-gender");
              }}
              className="px-8 py-3 rounded-full font-semibold transition-all duration-300 hover:scale-105"
              style={{
                background: config.theme.buttonGradient,
                color: "white",
              }}
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


