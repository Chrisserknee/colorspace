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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const retryCountRef = useRef(0);
  
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
        setImageLoaded(false);
        setImageError(false);
        retryCountRef.current = 0; // Reset retry count
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

  // Debug: Log when image URL changes and verify it's accessible
  useEffect(() => {
    if (generatedImageUrl) {
      console.log('Generated image URL set:', generatedImageUrl);
      console.log('Image URL is valid:', generatedImageUrl.startsWith('http'));
      
      // Try to verify the image exists
      fetch(generatedImageUrl, { method: 'HEAD', mode: 'no-cors' })
        .then(() => {
          console.log('Image URL appears accessible (HEAD check)');
        })
        .catch((err) => {
          console.warn('Image URL HEAD check failed (may be CORS):', err);
        });
    }
  }, [generatedImageUrl]);

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
      style={{ 
        backgroundColor: "rgba(62, 54, 46, 0.95)",
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
      }}
    >
      {/* Close button - Vintage Style */}
      <button
        onClick={handleClose}
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded transition-all duration-200 hover:scale-110"
        style={{
          background: 'rgba(245, 240, 230, 0.9)',
          border: '1px solid #C4A574',
          color: '#8B7355',
        }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className={`relative w-full max-w-2xl ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}>
        {/* Gender Selection Stage - Vintage Style */}
        {stage === "select-gender" && (
          <div 
            className="text-center p-6 sm:p-8 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #F5F0E6 0%, #EDE4D3 100%)',
              border: '3px solid #8B7355',
              boxShadow: 'inset 0 2px 8px rgba(139, 115, 85, 0.1), 0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Decorative element */}
            <div className="mb-4">
              <span style={{ color: '#C4A574', fontSize: '24px' }}>❧</span>
            </div>

            {/* Preview image in vintage frame */}
            <div className="relative mb-6 inline-block">
              <div
                className="absolute inset-0 rounded-lg blur-xl opacity-30"
                style={{ background: '#C4A574' }}
              />
              {previewUrl && (
                <div 
                  className="relative p-2 rounded-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #C4A574 0%, #8B7355 100%)',
                  }}
                >
                  <div className="relative w-40 h-40 sm:w-52 sm:h-52 rounded overflow-hidden">
                    <Image
                      src={previewUrl}
                      alt="Uploaded photo"
                      fill
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Selection prompt - Vintage Typography */}
            <h2
              className="text-2xl sm:text-3xl mb-2"
              style={{
                fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif",
                color: "#3A3025",
                fontWeight: 500,
              }}
            >
              One quick question...
            </h2>
            <p className="mb-6" style={{ color: "#6B5F55", fontFamily: "'EB Garamond', Georgia, serif" }}>
              This helps us create the perfect vintage portrait!
            </p>

            {/* Gender buttons - Vintage Style */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => handleGenderSelect("boy")}
                className="group px-8 py-4 rounded font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
                style={{
                  background: "linear-gradient(180deg, #5B7A9D 0%, #4A6580 100%)",
                  color: "#F5F0E6",
                  border: "2px solid #3D5266",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2)",
                  fontFamily: "'EB Garamond', Georgia, serif",
                }}
              >
                <span className="text-2xl">👦</span>
                <span className="text-lg">Boy</span>
              </button>

              <button
                onClick={() => handleGenderSelect("girl")}
                className="group px-8 py-4 rounded font-semibold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
                style={{
                  background: "linear-gradient(180deg, #C08090 0%, #A06575 100%)",
                  color: "#F5F0E6",
                  border: "2px solid #8A5565",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2)",
                  fontFamily: "'EB Garamond', Georgia, serif",
                }}
              >
                <span className="text-2xl">👧</span>
                <span className="text-lg">Girl</span>
              </button>
            </div>

            {/* Privacy note */}
            <p className="mt-6 text-xs" style={{ color: "#8B7355", fontFamily: "'EB Garamond', Georgia, serif" }}>
              🔒 Your photo is 100% secure and will be deleted after use
            </p>
          </div>
        )}

        {/* Generating Stage - Vintage Style */}
        {stage === "generating" && (
          <div 
            className="text-center p-6 sm:p-8 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, #F5F0E6 0%, #EDE4D3 100%)',
              border: '3px solid #8B7355',
              boxShadow: 'inset 0 2px 8px rgba(139, 115, 85, 0.1), 0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Decorative element */}
            <div className="mb-4">
              <span style={{ color: '#C4A574', fontSize: '24px' }}>❧</span>
            </div>

            {/* Preview image with vintage glow */}
            <div className="relative mb-6 inline-block">
              <div
                className="absolute inset-0 rounded-lg blur-xl opacity-40 animate-pulse"
                style={{ background: '#C4A574' }}
              />
              {previewUrl && (
                <div 
                  className="relative p-3 rounded-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #C4A574 0%, #8B7355 100%)',
                  }}
                >
                  <div className="relative w-56 h-56 sm:w-72 sm:h-72 rounded overflow-hidden">
                    <Image
                      src={previewUrl}
                      alt="Uploaded photo"
                      fill
                      className="object-cover"
                      style={{ filter: "sepia(0.2) brightness(0.9)" }}
                    />
                    {/* Vintage overlay */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(139, 115, 85, 0.3) 0%, rgba(196, 165, 116, 0.3) 100%)',
                        animation: "shimmer 2s infinite",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Loading spinner - Vintage Style */}
            <div className="mb-4">
              <div
                className="w-10 h-10 mx-auto rounded-full border-3 border-t-transparent animate-spin"
                style={{ borderColor: '#C4A574', borderTopColor: '#8B7355', borderWidth: '3px' }}
              />
            </div>

            {/* Magic phrase - Vintage Typography */}
            <p
              className="text-lg sm:text-xl mb-2 transition-all duration-500"
              style={{
                fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif",
                color: '#3A3025',
                fontStyle: 'italic',
              }}
            >
              {MAGIC_PHRASES[currentPhrase]}
            </p>
            <p style={{ color: "#8B7355", fontFamily: "'EB Garamond', Georgia, serif", fontSize: '14px' }}>
              Crafting your vintage storybook illustration...
            </p>

            {/* Decorative element */}
            <div className="mt-4">
              <span style={{ color: '#C4A574', fontSize: '24px' }}>❧</span>
            </div>
          </div>
        )}

        {/* Result Stage - Vintage Premium Purchase Experience */}
        {stage === "result" && generatedImageUrl && (
          <div 
            className="rounded-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto"
            style={{ 
              background: 'linear-gradient(135deg, #F5F0E6 0%, #EDE4D3 100%)',
              border: '3px solid #8B7355',
              boxShadow: 'inset 0 2px 8px rgba(139, 115, 85, 0.1), 0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            {/* Vintage Header Decoration */}
            <div className="text-center mb-2">
              <span style={{ color: '#C4A574', fontSize: '20px' }}>❧</span>
            </div>

            {/* Price Badge - Vintage Style */}
            <div className="text-center mb-3">
              <span 
                className="inline-block px-5 py-2 text-lg font-bold"
                style={{ 
                  backgroundColor: '#8B7355',
                  color: '#F5F0E6',
                  fontFamily: "'EB Garamond', Georgia, serif",
                  borderRadius: '4px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                $19.99
              </span>
            </div>

            {/* Celebratory Header - Vintage Style */}
            <div className="text-center mb-4">
              <p className="text-sm mb-1" style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}>
                ✨ Your masterpiece is ready! ✨
              </p>
              <h3 
                className="text-2xl sm:text-3xl"
                style={{ fontFamily: "'Playfair Display', 'EB Garamond', Georgia, serif", color: '#3A3025', fontWeight: 500 }}
              >
                Your Child&apos;s Vintage Portrait
              </h3>
            </div>

            {/* Preview Image - Vintage Frame Style */}
            <div className="relative max-w-[280px] sm:max-w-[320px] mx-auto mb-4">
              {/* Aged paper shadow effect */}
              <div 
                className="absolute -inset-3 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(139, 115, 85, 0.2) 0%, rgba(196, 165, 116, 0.1) 100%)',
                  borderRadius: '8px',
                  filter: 'blur(8px)',
                }}
              />
              {/* Vintage ornate frame */}
              <div 
                className="relative p-3 rounded-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #C4A574 0%, #8B7355 100%)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
                }}
              >
                <div 
                  className="relative rounded overflow-hidden"
                  style={{ 
                    border: '2px solid rgba(255,255,255,0.3)',
                    boxShadow: 'inset 0 0 20px rgba(0,0,0,0.1)',
                    minHeight: '320px',
                    backgroundColor: '#8B7355',
                  }}
                >
                  {!imageLoaded && !imageError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full border-3 border-t-transparent animate-spin" style={{ borderColor: '#C4A574', borderTopColor: '#F5F0E6', borderWidth: '3px' }} />
                        <p style={{ color: '#F5F0E6', fontFamily: "'EB Garamond', Georgia, serif", fontSize: '14px' }}>Loading portrait...</p>
                      </div>
                    </div>
                  )}
                  {imageError && (
                    <div className="absolute inset-0 flex items-center justify-center p-4">
                      <div className="text-center">
                        <p style={{ color: '#F5F0E6', fontFamily: "'EB Garamond', Georgia, serif" }}>Failed to load image</p>
                        <button
                          onClick={() => {
                            setImageError(false);
                            setImageLoaded(false);
                          }}
                          className="mt-2 px-4 py-2 rounded text-sm"
                          style={{ backgroundColor: '#C4A574', color: '#3A3025', fontFamily: "'EB Garamond', Georgia, serif" }}
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                  {generatedImageUrl && (
                    <img
                      key={`${generatedImageUrl}-${retryCountRef.current}`}
                      src={generatedImageUrl}
                      alt="Your child's vintage portrait"
                      className="w-full h-auto block"
                      style={{ 
                        display: imageLoaded ? 'block' : 'none',
                        maxWidth: '100%', 
                        height: 'auto',
                        minHeight: '320px',
                        objectFit: 'contain',
                        backgroundColor: 'transparent',
                        opacity: imageLoaded ? 1 : 0,
                        transition: 'opacity 0.3s ease-in-out',
                      }}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const imgElement = e.target as HTMLImageElement;
                        retryCountRef.current += 1;
                        
                        console.error(`Image failed to load (attempt ${retryCountRef.current}):`, generatedImageUrl);
                        
                        // Retry up to 3 times with increasing delays
                        if (retryCountRef.current <= 3) {
                          const delay = retryCountRef.current * 1000; // 1s, 2s, 3s
                          console.log(`Retrying image load in ${delay}ms...`);
                          
                          setTimeout(() => {
                            // Force reload by adding timestamp to URL
                            const retryUrl = `${generatedImageUrl}${generatedImageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
                            imgElement.src = retryUrl;
                          }, delay);
                          return;
                        }
                        
                        // After retries, try proxy as fallback
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
                            setImageError(false);
                          })
                          .catch(proxyErr => {
                            console.error('❌ Proxy also failed:', proxyErr);
                            setImageError(true);
                            setImageLoaded(false);
                          });
                      }}
                      onLoad={(e) => {
                        console.log('Image loaded successfully:', generatedImageUrl);
                        console.log('Image dimensions:', (e.target as HTMLImageElement).naturalWidth, 'x', (e.target as HTMLImageElement).naturalHeight);
                        setImageLoaded(true);
                        setImageError(false);
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Urgency Timer - Vintage Style */}
            <div 
              className="flex items-center justify-center gap-2 mb-4 py-2 px-4 rounded mx-auto w-fit"
              style={{ backgroundColor: 'rgba(139, 115, 85, 0.1)', border: '1px solid #C4A574' }}
            >
              <span className="text-xs" style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}>Expires in</span>
              <span className="font-mono font-bold text-sm" style={{ color: '#8B7355' }}>
                {formatTimeRemaining(timeRemaining)}
              </span>
            </div>

            {/* Large Download CTA - Vintage Button */}
            <button 
              onClick={handlePurchase}
              disabled={isPurchasing}
              className="w-full py-4 rounded font-bold text-lg transition-all hover:scale-[1.02] mb-3 disabled:opacity-50"
              style={{ 
                background: 'linear-gradient(180deg, #8B7355 0%, #6B5645 100%)',
                color: '#F5F0E6',
                border: '2px solid #5A4535',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.3)',
                fontFamily: "'EB Garamond', Georgia, serif",
                letterSpacing: '0.05em',
              }}
            >
              {isPurchasing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : (
                "Download Your Portrait — $19.99"
              )}
            </button>

            {/* Money-Back Guarantee Badge - Vintage Style */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-4 h-4" style={{ color: '#6B8E23' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs" style={{ color: '#6B5F55', fontFamily: "'EB Garamond', Georgia, serif" }}>30-Day Money-Back Guarantee • Secure Checkout</span>
            </div>

            {/* What You Get - Vintage Card */}
            <div 
              className="p-3 rounded mb-4"
              style={{ backgroundColor: 'rgba(139, 115, 85, 0.08)', border: '1px solid #C4A574' }}
            >
              <p className="text-xs font-medium mb-2" style={{ color: '#5A4F45', fontFamily: "'EB Garamond', Georgia, serif" }}>What you&apos;ll receive:</p>
              <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: '#6B5F55', fontFamily: "'EB Garamond', Georgia, serif" }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: '#8B7355' }}>✓</span>
                  <span>4K High Resolution</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: '#8B7355' }}>✓</span>
                  <span>No Watermark</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: '#8B7355' }}>✓</span>
                  <span>Print-Ready Quality</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: '#8B7355' }}>✓</span>
                  <span>Instant Download</span>
                </div>
              </div>
            </div>

            {/* Testimonials - Vintage Style */}
            <div 
              className="p-3 rounded mb-4"
              style={{ backgroundColor: 'rgba(139, 115, 85, 0.08)', border: '1px solid #C4A574' }}
            >
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ color: '#C4A574', fontSize: '10px' }}>★</span>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#5A4F45', fontFamily: "'EB Garamond', Georgia, serif" }}><span className="italic">&ldquo;My daughter loves it!&rdquo;</span> <span style={{ color: '#8B7355' }}>— Jessica M.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ color: '#C4A574', fontSize: '10px' }}>★</span>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#5A4F45', fontFamily: "'EB Garamond', Georgia, serif" }}><span className="italic">&ldquo;Printed and framed for his room!&rdquo;</span> <span style={{ color: '#8B7355' }}>— Mark T.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <span key={i} style={{ color: '#C4A574', fontSize: '10px' }}>★</span>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#5A4F45', fontFamily: "'EB Garamond', Georgia, serif" }}><span className="italic">&ldquo;Grandma cried happy tears!&rdquo;</span> <span style={{ color: '#8B7355' }}>— Sarah L.</span></p>
                </div>
              </div>
            </div>

            {/* Privacy Assurance */}
            <div 
              className="flex items-center justify-center gap-2 mb-4 py-2 px-3 rounded mx-auto"
              style={{ backgroundColor: 'rgba(107, 142, 35, 0.1)', border: '1px solid rgba(107, 142, 35, 0.3)' }}
            >
              <span>🔒</span>
              <span className="text-xs" style={{ color: '#6B5F55', fontFamily: "'EB Garamond', Georgia, serif" }}>
                Your photo was used only for this portrait and has been deleted
              </span>
            </div>

            {/* Error display */}
            {error && (
              <div 
                className="mb-4 p-3 rounded text-center text-sm"
                style={{ 
                  backgroundColor: 'rgba(139, 69, 69, 0.1)',
                  border: '1px solid rgba(139, 69, 69, 0.3)',
                  color: '#8B4545'
                }}
              >
                {error}
              </div>
            )}

            {/* Create Another Option - Vintage Style */}
            <div className="pt-3 border-t" style={{ borderColor: '#C4A574' }}>
              <button 
                onClick={handleClose}
                className="w-full text-center text-sm py-2 transition-colors hover:opacity-80"
                style={{ color: '#8B7355', fontFamily: "'EB Garamond', Georgia, serif" }}
              >
                ✨ Create Another Portrait
              </button>
            </div>

            {/* Bottom Decoration */}
            <div className="text-center mt-2">
              <span style={{ color: '#C4A574', fontSize: '20px' }}>❧</span>
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


