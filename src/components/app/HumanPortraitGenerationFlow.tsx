"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { humanPortraitConfig } from "@/lib/apps";
import { captureEvent } from "@/lib/posthog";

type Stage = "preview" | "generating" | "result";

interface HumanPortraitGenerationFlowProps {
  file: File | null;
  onReset: () => void;
}

// Format time remaining
const formatTimeRemaining = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Elegant phrases for generation animation
const MAGIC_PHRASES = [
  "The master painter is studying your features...",
  "Mixing the perfect colors for your portrait...",
  "Adding brushstrokes of elegance...",
  "Capturing your essence in oil...",
  "Applying the finishing touches...",
  "Your masterpiece is nearly complete...",
  "Adding the final details...",
  "Almost there...",
];

// Storage key for creations
const HUMAN_PORTRAIT_CREATIONS_KEY = "human_portrait_creations";

interface Creation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
}

const saveCreation = (imageId: string, previewUrl: string) => {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(HUMAN_PORTRAIT_CREATIONS_KEY);
  let creations: Creation[] = stored ? JSON.parse(stored) : [];
  creations = [{ imageId, previewUrl, timestamp: Date.now() }, ...creations].slice(0, 20);
  localStorage.setItem(HUMAN_PORTRAIT_CREATIONS_KEY, JSON.stringify(creations));
};

export default function HumanPortraitGenerationFlow({ file, onReset }: HumanPortraitGenerationFlowProps) {
  const [stage, setStage] = useState<Stage>("preview");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [hdImageUrl, setHdImageUrl] = useState<string | null>(null);
  const [imageId, setImageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const retryCountRef = useRef(0);
  const proxyTriedRef = useRef(false);
  const errorHandlingRef = useRef(false);
  
  const config = humanPortraitConfig;
  const hasGeneratedRef = useRef(false);

  // Helper to try proxy fallback
  const tryProxyFallback = useCallback((imgElement: HTMLImageElement) => {
    if (proxyTriedRef.current || !generatedImageUrl) {
      errorHandlingRef.current = false;
      return;
    }
    
    proxyTriedRef.current = true;
    console.log('All retries failed, trying proxy...');
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(generatedImageUrl)}`;
    
    fetch(proxyUrl)
      .then(res => {
        if (res.ok) {
          return res.blob();
        }
        throw new Error(`Proxy fetch failed: ${res.status}`);
      })
      .then(blob => {
        const proxyObjectUrl = URL.createObjectURL(blob);
        imgElement.src = proxyObjectUrl;
        console.log('✅ Loaded image via proxy');
        errorHandlingRef.current = false;
        setImageError(false);
        setImageLoaded(true);
      })
      .catch(proxyErr => {
        console.error('❌ Proxy also failed:', proxyErr);
        errorHandlingRef.current = false;
        setImageError(true);
        setImageLoaded(false);
      });
  }, [generatedImageUrl]);

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
  const generatePortrait = useCallback(async () => {
    if (!file || hasGeneratedRef.current) return;
    hasGeneratedRef.current = true;
    
    setStage("generating");
    setError(null);
    
    captureEvent("human_portrait_generation_started", { app: config.id });
    
    try {
      const formData = new FormData();
      formData.append("image", file);
      
      const response = await fetch("/api/generate-human-portrait", {
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
        setImageLoaded(false);
        setImageError(false);
        retryCountRef.current = 0;
        proxyTriedRef.current = false;
        errorHandlingRef.current = false;
        setStage("result");
        
        // Save creation
        saveCreation(data.imageId, data.previewUrl);
        
        captureEvent("human_portrait_generation_complete", {
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
      captureEvent("human_portrait_generation_error", {
        app: config.id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }, [file, config.id]);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onReset();
    }, 300);
  };

  // Handle retry
  const handleRetry = () => {
    hasGeneratedRef.current = false;
    setError(null);
    setStage("preview");
  };

  // Handle download preview (watermarked)
  const handleDownloadPreview = async () => {
    if (!generatedImageUrl) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portrait-preview-${imageId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      captureEvent("preview_downloaded", { app: config.id, imageId });
    } catch (err) {
      console.error("Download failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle purchase HD
  const handlePurchaseHD = async () => {
    if (!imageId) return;
    
    setIsPurchasing(true);
    captureEvent("checkout_started", { app: config.id, imageId });
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId,
          app: config.id,
          priceId: "hd_download",
        }),
      });
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      console.error("Checkout failed:", err);
      setError("Unable to start checkout. Please try again.");
    } finally {
      setIsPurchasing(false);
    }
  };

  // Theme colors
  const colors = {
    primary: config.theme.primaryColor,
    secondary: config.theme.secondaryColor,
    gradient: config.theme.buttonGradient,
    bg: '#0D0B09',
    bgCard: 'rgba(26, 22, 18, 0.95)',
    text: '#F0EDE8',
    textMuted: '#A89F93',
    border: `${config.theme.primaryColor}30`,
  };

  if (!file) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
      style={{ backgroundColor: "rgba(13, 11, 9, 0.95)" }}
    >
      <div 
        className={`relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
        style={{
          background: 'linear-gradient(180deg, #1A1612 0%, #0D0B09 100%)',
          border: `1px solid ${colors.border}`,
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px ${config.theme.primaryColor}15`,
        }}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full transition-all duration-200 hover:scale-110"
          style={{
            background: `${colors.primary}20`,
            color: colors.primary,
          }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Preview Stage */}
        {stage === "preview" && previewUrl && (
          <div className="p-6 sm:p-8">
            <div className="text-center mb-6">
              <h2 
                className="text-2xl sm:text-3xl mb-2"
                style={{ fontFamily: config.theme.fontFamily, color: colors.text }}
              >
                Ready to Create Your Portrait?
              </h2>
              <p style={{ color: colors.textMuted }}>
                We&apos;ll transform you into a classical masterpiece
              </p>
            </div>

            <div className="flex flex-col items-center">
              {/* Preview Image */}
              <div 
                className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-xl overflow-hidden mb-6"
                style={{
                  border: `2px solid ${colors.border}`,
                  boxShadow: `0 10px 30px rgba(0, 0, 0, 0.3)`,
                }}
              >
                <Image
                  src={previewUrl}
                  alt="Your photo"
                  fill
                  className="object-cover"
                />
              </div>

              {/* Create Portrait Button */}
              <button
                onClick={() => generatePortrait()}
                className="px-8 py-3 rounded-full text-white font-medium transition-all duration-300 hover:scale-105"
                style={{
                  background: colors.gradient,
                  boxShadow: `0 8px 30px ${colors.primary}40`,
                }}
              >
                Create My Portrait
              </button>
            </div>
          </div>
        )}

        {/* Generating Stage */}
        {stage === "generating" && (
          <div className="p-6 sm:p-8 min-h-[400px] flex flex-col items-center justify-center">
            <div className="text-center">
              {/* Animated Brush Icon */}
              <div className="relative mb-8">
                <div 
                  className="w-24 h-24 rounded-full flex items-center justify-center animate-pulse"
                  style={{
                    background: colors.gradient,
                    boxShadow: `0 0 40px ${colors.primary}60`,
                  }}
                >
                  <span className="text-4xl">🎨</span>
                </div>
                
                {/* Animated rings */}
                <div 
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{
                    border: `2px solid ${colors.primary}40`,
                    animationDuration: '2s',
                  }}
                />
              </div>

              <h2 
                className="text-2xl sm:text-3xl mb-4"
                style={{ fontFamily: config.theme.fontFamily, color: colors.text }}
              >
                Creating Your Masterpiece
              </h2>
              
              <p 
                className="text-lg mb-6 transition-all duration-500"
                style={{ color: colors.primary, fontStyle: 'italic' }}
              >
                {MAGIC_PHRASES[currentPhrase]}
              </p>

              {/* Progress dots */}
              <div className="flex justify-center gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{
                      background: colors.primary,
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>

              <p className="text-sm mt-6" style={{ color: colors.textMuted }}>
                This usually takes 30-60 seconds
              </p>
            </div>
          </div>
        )}

        {/* Result Stage */}
        {stage === "result" && (
          <div className="p-6 sm:p-8">
            {/* Error Display */}
            {error && (
              <div className="text-center mb-6">
                <div 
                  className="p-4 rounded-xl"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={handleRetry}
                    className="px-6 py-2 rounded-full text-white"
                    style={{ background: colors.gradient }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {!error && generatedImageUrl && (
              <>
                <div className="text-center mb-6">
                  <h2 
                    className="text-2xl sm:text-3xl mb-2"
                    style={{ fontFamily: config.theme.fontFamily, color: colors.text }}
                  >
                    Your Masterpiece is Ready!
                  </h2>
                  <p style={{ color: colors.textMuted }}>
                    A timeless portrait worthy of any gallery
                  </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
                  {/* Generated Image */}
                  <div className="flex-1 flex justify-center">
                    <div 
                      className="relative rounded-xl overflow-hidden"
                      style={{
                        border: `4px solid ${colors.primary}40`,
                        boxShadow: `0 20px 40px rgba(0, 0, 0, 0.4), 0 0 60px ${colors.primary}20`,
                        maxWidth: '400px',
                      }}
                    >
                      {!imageLoaded && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <div 
                            className="w-12 h-12 border-3 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: colors.primary, borderTopColor: 'transparent' }}
                          />
                        </div>
                      )}
                      
                      {imageError ? (
                        <div className="w-80 h-80 flex items-center justify-center" style={{ background: colors.bgCard }}>
                          <p style={{ color: colors.textMuted }}>Failed to load image</p>
                        </div>
                      ) : (
                        <img
                          src={generatedImageUrl}
                          alt="Your portrait"
                          className={`w-full h-auto transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                          onLoad={() => setImageLoaded(true)}
                          onError={(e) => {
                            if (errorHandlingRef.current) return;
                            errorHandlingRef.current = true;
                            
                            if (retryCountRef.current < 3) {
                              retryCountRef.current++;
                              console.log(`Retrying image load (${retryCountRef.current}/3)...`);
                              setTimeout(() => {
                                const img = e.target as HTMLImageElement;
                                img.src = `${generatedImageUrl}?retry=${retryCountRef.current}`;
                                errorHandlingRef.current = false;
                              }, 1000);
                            } else {
                              tryProxyFallback(e.target as HTMLImageElement);
                            }
                          }}
                        />
                      )}
                      
                      {/* Watermark notice */}
                      <div 
                        className="absolute bottom-0 left-0 right-0 py-2 px-4 text-center text-xs"
                        style={{ 
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
                          color: colors.textMuted,
                        }}
                      >
                        Preview with watermark
                      </div>
                    </div>
                  </div>

                  {/* Purchase Options */}
                  <div className="flex-1 max-w-sm">
                    {/* Timer urgency */}
                    <div 
                      className="text-center mb-6 p-3 rounded-xl"
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                      }}
                    >
                      <p className="text-sm" style={{ color: '#F87171' }}>
                        ⏰ Image expires in {formatTimeRemaining(timeRemaining)}
                      </p>
                    </div>

                    {/* HD Download Option */}
                    <div 
                      className="p-6 rounded-xl mb-4"
                      style={{
                        background: 'linear-gradient(180deg, rgba(155, 123, 92, 0.15) 0%, rgba(155, 123, 92, 0.05) 100%)',
                        border: `2px solid ${colors.primary}50`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h3 
                          className="text-xl font-medium"
                          style={{ color: colors.text, fontFamily: config.theme.fontFamily }}
                        >
                          HD Download
                        </h3>
                        <span 
                          className="text-2xl font-bold"
                          style={{ color: colors.primary }}
                        >
                          {config.pricing.hdPriceDisplay}
                        </span>
                      </div>
                      
                      <ul className="space-y-2 mb-4">
                        <li className="flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
                          <span style={{ color: '#4ADE80' }}>✓</span>
                          Full resolution (2048x2048)
                        </li>
                        <li className="flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
                          <span style={{ color: '#4ADE80' }}>✓</span>
                          No watermark
                        </li>
                        <li className="flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
                          <span style={{ color: '#4ADE80' }}>✓</span>
                          Print-ready quality
                        </li>
                        <li className="flex items-center gap-2 text-sm" style={{ color: colors.textMuted }}>
                          <span style={{ color: '#4ADE80' }}>✓</span>
                          Instant download
                        </li>
                      </ul>

                      <button
                        onClick={handlePurchaseHD}
                        disabled={isPurchasing}
                        className="w-full py-3 rounded-full text-white font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50"
                        style={{
                          background: colors.gradient,
                          boxShadow: `0 8px 30px ${colors.primary}40`,
                        }}
                      >
                        {isPurchasing ? "Processing..." : "Get HD Download"}
                      </button>
                    </div>

                    {/* Preview Download */}
                    <button
                      onClick={handleDownloadPreview}
                      disabled={isDownloading}
                      className="w-full py-3 rounded-full font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50"
                      style={{
                        background: 'transparent',
                        border: `1px solid ${colors.primary}50`,
                        color: colors.primary,
                      }}
                    >
                      {isDownloading ? "Downloading..." : "Download Preview (with watermark)"}
                    </button>

                    {/* Create Another */}
                    <button
                      onClick={handleClose}
                      className="w-full py-3 mt-4 text-sm"
                      style={{ color: colors.textMuted }}
                    >
                      Create Another Portrait
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

