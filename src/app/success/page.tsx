"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { CONFIG } from "@/lib/config";

// Rainbow Bridge text overlay data from localStorage
interface RainbowBridgeData {
  imageId: string;
  petName: string;
  quote: string;
  timestamp: number;
}

// Grant purchase bonus generations or pack credits
const grantPurchaseBonus = (type?: string, packType?: string) => {
  if (typeof window === "undefined") return;
  
  const STORAGE_KEY = "lumepet_generation_limits";
  const stored = localStorage.getItem(STORAGE_KEY);
  
  let limits: { 
    freeGenerations: number; 
    freeRetriesUsed: number; 
    purchases: number;
    packPurchases?: number;
    packCredits?: number;
  };
  
  if (stored) {
    try {
      limits = JSON.parse(stored);
      // Ensure new fields exist
      limits.packPurchases = limits.packPurchases || 0;
      limits.packCredits = limits.packCredits || 0;
    } catch {
      limits = { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0 };
    }
  } else {
    limits = { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0 };
  }
  
  // Only increment if this purchase hasn't been counted yet
  // Check sessionStorage to prevent double-counting on page refresh
  const sessionKey = type === "pack" ? "last_pack_purchase_time" : "last_purchase_time";
  const lastPurchase = sessionStorage.getItem(sessionKey);
  const now = Date.now();
  
  // Only grant bonus if it's been more than 5 seconds since last grant (prevents refresh abuse)
  if (!lastPurchase || (now - parseInt(lastPurchase)) > 5000) {
    if (type === "pack") {
      limits.packPurchases = (limits.packPurchases || 0) + 1;
      
      // Grant credits based on pack type
      let creditsToAdd = 0;
      switch (packType) {
        case "1-pack":
          creditsToAdd = 1;
          break;
        case "5-pack":
          creditsToAdd = 5;
          break;
        case "10-pack":
          creditsToAdd = 10;
          break;
        case "2-pack":
          // Legacy support
          creditsToAdd = 2;
          break;
        default:
          console.warn("Unknown pack type:", packType);
          creditsToAdd = 1; // Fallback to 1
      }
      
      limits.packCredits = (limits.packCredits || 0) + creditsToAdd;
      sessionStorage.setItem("last_pack_purchase_time", now.toString());
      console.log(`Pack purchase granted: ${creditsToAdd} credits (${packType})`);
    } else {
      limits.purchases += 1;
      sessionStorage.setItem("last_purchase_time", now.toString());
      console.log(`🎁 Purchase bonus granted: 2 additional free generations! (Total purchases: ${limits.purchases})`);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  }
};

// Canvas size options for upsell
type CanvasSize = "12x12" | "16x16";

interface CanvasOption {
  size: CanvasSize;
  displaySize: string;
  price: string;
  priceAmount: number;
  label: string;
  description: string;
}

const CANVAS_OPTIONS: CanvasOption[] = [
  {
    size: "12x12",
    displaySize: '12" × 12"',
    price: CONFIG.CANVAS_12X12_PRICE_DISPLAY,
    priceAmount: CONFIG.CANVAS_12X12_PRICE_AMOUNT,
    label: "Gallery Canvas",
    description: "Perfect for desks & shelves",
  },
  {
    size: "16x16",
    displaySize: '16" × 16"',
    price: CONFIG.CANVAS_16X16_PRICE_DISPLAY,
    priceAmount: CONFIG.CANVAS_16X16_PRICE_AMOUNT,
    label: "Premium Canvas",
    description: "Statement piece for your wall",
  },
];

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const imageId = searchParams.get("imageId");
  const type = searchParams.get("type");
  const packType = searchParams.get("packType");
  
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [rainbowBridgeData, setRainbowBridgeData] = useState<RainbowBridgeData | null>(null);
  const [selectedCanvas, setSelectedCanvas] = useState<CanvasSize>("16x16");
  const [isOrderingCanvas, setIsOrderingCanvas] = useState(false);

  // Function to render text overlay on canvas
  const renderTextOverlay = useCallback(async (imageUrl: string, name: string, quote: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const width = canvas.width;
        const height = canvas.height;
        const padding = Math.floor(width * 0.04);
        const nameFontSize = Math.floor(width * 0.055);
        const quoteFontSize = Math.floor(width * 0.024);

        // Draw gradient overlay
        const gradientHeight = Math.floor(height * 0.25);
        const gradient = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - gradientHeight, width, gradientHeight);

        // Draw quote
        ctx.font = `italic ${quoteFontSize}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        const maxWidth = width - padding * 4;
        const words = `"${quote}"`.split(' ');
        const lines: string[] = [];
        let currentLine = '';
        
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);

        const lineHeight = quoteFontSize * 1.4;
        const nameY = height - padding;
        const quoteStartY = nameY - nameFontSize - padding - (lines.length - 1) * lineHeight;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        
        lines.forEach((line, i) => {
          ctx.fillText(line, width / 2, quoteStartY + i * lineHeight);
        });

        // Draw pet name
        ctx.font = `bold ${nameFontSize}px Georgia, "Times New Roman", serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        
        const goldGradient = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
        goldGradient.addColorStop(0, '#D4AF37');
        goldGradient.addColorStop(0.5, '#F5E6A3');
        goldGradient.addColorStop(1, '#D4AF37');
        ctx.fillStyle = goldGradient;
        
        ctx.fillText(name.toUpperCase(), width / 2, nameY);
        ctx.shadowColor = 'transparent';

        resolve(canvas.toDataURL('image/png', 1.0));
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageUrl;
    });
  }, []);

  // Check for Rainbow Bridge data
  useEffect(() => {
    if (imageId) {
      const stored = localStorage.getItem(`rainbow_bridge_${imageId}`);
      if (stored) {
        try {
          const data = JSON.parse(stored) as RainbowBridgeData;
          // Only use if less than 1 hour old
          if (Date.now() - data.timestamp < 3600000) {
            setRainbowBridgeData(data);
            console.log("Found Rainbow Bridge data:", data);
          }
        } catch (e) {
          console.error("Failed to parse Rainbow Bridge data:", e);
        }
      }
    }
  }, [imageId]);
  
  // Grant purchase bonus when page loads (after successful payment)
  useEffect(() => {
    grantPurchaseBonus(type || undefined, packType || undefined);
  }, [type, packType]);

  useEffect(() => {
    // For pack purchases, we don't need to validate an image
    if (type === "pack") {
      setIsValid(true);
      return;
    }
    
    if (imageId) {
      fetch(`/api/image-info?imageId=${imageId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.hdUrl) {
            setImageUrl(data.hdUrl);
            setIsValid(true);
            
            // If there's a text version URL available, store it for Rainbow Bridge portraits
            if (data.hdTextUrl) {
              console.log("Server has HD text version available:", data.hdTextUrl);
            }
          } else {
            setIsValid(false);
          }
        })
        .catch(() => {
          setIsValid(false);
        });
    } else {
      setIsValid(false);
    }
  }, [imageId, type]);

  // Apply Rainbow Bridge text overlay when image and data are ready
  // Always use client-side canvas rendering for reliable text overlay
  useEffect(() => {
    if (imageUrl && rainbowBridgeData) {
      console.log("Applying Rainbow Bridge text overlay to success page...");
      renderTextOverlay(imageUrl, rainbowBridgeData.petName, rainbowBridgeData.quote)
        .then(dataUrl => {
          setDisplayImageUrl(dataUrl);
          console.log("✅ Rainbow Bridge text overlay applied to success page");
        })
        .catch(err => {
          console.error("Failed to apply overlay:", err);
          setDisplayImageUrl(imageUrl);
        });
    } else if (imageUrl) {
      setDisplayImageUrl(imageUrl);
    }
  }, [imageUrl, rainbowBridgeData, renderTextOverlay]);

  const handleDownload = async () => {
    if (!imageId) return;
    
    setIsDownloading(true);
    
    try {
      // For Rainbow Bridge portraits, download the server-rendered version with text
      if (rainbowBridgeData) {
        console.log("Downloading Rainbow Bridge portrait with text overlay from server...");
        
        // Try to download server-rendered HD with text
        const response = await fetch(`/api/download?imageId=${imageId}&withText=true`);
        
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = url;
          link.download = `rainbow-bridge-${rainbowBridgeData.petName.replace(/[^a-zA-Z0-9]/g, '-')}-${imageId}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log("✅ Rainbow Bridge download complete (server-rendered with text)");
          return;
        }
        
        // Fallback: if server version not available, use client-rendered canvas image
        if (displayImageUrl && displayImageUrl.startsWith('data:')) {
          console.log("Server text version not available, using client-rendered version...");
          const canvasResponse = await fetch(displayImageUrl);
          const blob = await canvasResponse.blob();
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement("a");
          link.href = url;
          link.download = `rainbow-bridge-${rainbowBridgeData.petName.replace(/[^a-zA-Z0-9]/g, '-')}-${imageId}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          
          console.log("✅ Rainbow Bridge download complete (client-rendered with text)");
          return;
        }
      }
      
      // Regular download from server (without text)
      const response = await fetch(`/api/download?imageId=${imageId}`);
      
      if (!response.ok) {
        throw new Error("Download failed");
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `pet-portrait-${imageId}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle canvas order
  const handleCanvasOrder = async () => {
    if (!imageId) return;
    
    setIsOrderingCanvas(true);
    
    try {
      const response = await fetch("/api/canvas-checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageId,
          size: selectedCanvas,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout");
      }
      
      // Redirect to Stripe checkout
      if (data.url) {
        router.push(data.url);
      }
    } catch (error) {
      console.error("Canvas order error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsOrderingCanvas(false);
    }
  };

  // Loading state
  if (isValid === null) {
    return (
      <div className="min-h-screen bg-renaissance flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <div 
              className="w-16 h-16 rounded-full animate-spin"
              style={{ 
                borderWidth: '4px',
                borderStyle: 'solid',
                borderColor: 'rgba(197, 165, 114, 0.2)',
                borderTopColor: '#C5A572'
              }}
            />
          </div>
          <p style={{ color: '#B8B2A8' }}>Loading your masterpiece...</p>
        </div>
      </div>
    );
  }

  // Error state (skip for pack purchases which don't have an imageId)
  if (!isValid || (!imageId && type !== "pack")) {
    return (
      <div className="min-h-screen bg-renaissance flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div 
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
          >
            <svg className="w-10 h-10" style={{ color: '#F87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 
            className="text-3xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Something Went Wrong
          </h1>
          <p className="mb-8" style={{ color: '#B8B2A8' }}>
            We couldn&apos;t find your portrait. The link may be invalid or expired.
          </p>
          <Link href="/" className="btn-primary inline-flex">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  // Pack purchase success (no image to show)
  if (type === "pack") {
    // Check if there's a saved pet image to restore
    const savedPetImage = typeof window !== "undefined" ? localStorage.getItem("lumepet_pending_image") : null;
    
    return (
      <div className="min-h-screen bg-renaissance py-12 px-6">
        <div className="max-w-2xl mx-auto">
          {/* Success header */}
          <div className="text-center mb-10 animate-fade-in-up">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
            >
              <svg className="w-10 h-10" style={{ color: '#4ADE80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 
              className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Pack Purchased Successfully!
            </h1>
            
            {/* Credits badge */}
            <div 
              className="inline-flex items-center gap-3 px-6 py-3 rounded-full mb-6"
              style={{ 
                backgroundColor: 'rgba(197, 165, 114, 0.15)', 
                border: '2px solid rgba(197, 165, 114, 0.4)' 
              }}
            >
              <span className="text-2xl">🎨</span>
              <span className="text-lg font-semibold" style={{ color: '#C5A572' }}>
                +2 Generations Added!
              </span>
            </div>
            
            <p className="text-lg mb-8" style={{ color: '#B8B2A8' }}>
              {savedPetImage 
                ? "Your pet image is ready! Click below to continue generating."
                : "You now have 2 watermarked generations available. Start creating your masterpieces!"}
            </p>
            
            <Link 
              href="/?restored=true" 
              className="btn-primary inline-flex text-lg px-8 py-4"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              </svg>
              {savedPetImage ? "Continue with Your Pet" : "Start Creating"}
            </Link>
            
            <p className="text-sm mt-4" style={{ color: '#7A756D' }}>
              (does not include the full HD version)
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success state (individual image purchase)
  return (
    <div className="min-h-screen bg-renaissance py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Success header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div 
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)' }}
          >
            <svg className="w-10 h-10" style={{ color: '#4ADE80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            {rainbowBridgeData ? `${rainbowBridgeData.petName}'s Memorial Portrait is Ready` : "Your Royal Portrait is Ready"}
          </h1>
          <p className="text-lg mb-4" style={{ color: '#B8B2A8' }}>
            {rainbowBridgeData 
              ? `Thank you for your purchase. ${rainbowBridgeData.petName} will be remembered forever.`
              : "Thank you for your purchase! Your pet has been immortalized."}
          </p>
          
          {/* Bonus generations notice */}
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full"
            style={{ 
              backgroundColor: 'rgba(197, 165, 114, 0.1)', 
              border: '1px solid rgba(197, 165, 114, 0.3)' 
            }}
          >
            <span style={{ color: '#C5A572' }}>🎁</span>
            <span className="text-sm" style={{ color: '#C5A572' }}>
              You now have <strong>2 more generations</strong> available!
            </span>
          </div>
        </div>

        {/* Portrait display - NO WATERMARK */}
        <div className="animate-fade-in-up delay-200">
          <div className="ornate-frame max-w-lg mx-auto mb-8">
            <div className="relative aspect-square rounded overflow-hidden shadow-2xl">
              {displayImageUrl && (
                <Image
                  src={displayImageUrl}
                  alt={rainbowBridgeData ? `${rainbowBridgeData.petName}'s memorial portrait` : "Your royal pet portrait"}
                  fill
                  className="object-cover"
                  priority
                  unoptimized
                />
              )}
            </div>
          </div>
        </div>

        {/* Download button */}
        <div className="text-center animate-fade-in-up delay-300">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="btn-primary text-lg px-10 py-5 mb-6"
          >
            {isDownloading ? (
              <>
                <div 
                  className="w-5 h-5 rounded-full animate-spin"
                  style={{ 
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    borderTopColor: 'white'
                  }}
                />
                Preparing Download...
              </>
            ) : (
              <>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download HD Portrait
              </>
            )}
          </button>

          <p className="text-sm mb-8" style={{ color: '#7A756D' }}>
            High-resolution PNG • Watermark-free • Perfect for printing
          </p>
        </div>

        {/* Canvas Upsell Section */}
        <div 
          className="card animate-fade-in-up delay-350 mb-8"
          style={{ 
            background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.08) 0%, rgba(197, 165, 114, 0.02) 100%)',
            border: '2px solid rgba(197, 165, 114, 0.25)',
          }}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <div 
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
              style={{ 
                backgroundColor: 'rgba(197, 165, 114, 0.15)',
                border: '1px solid rgba(197, 165, 114, 0.3)',
              }}
            >
              <span className="text-sm font-medium" style={{ color: '#C5A572' }}>
                ✨ Special Offer
              </span>
            </div>
            <h3 
              className="text-2xl sm:text-3xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Bring Your Portrait to Life
            </h3>
            <p style={{ color: '#B8B2A8' }}>
              Museum-quality canvas prints, ready to hang
            </p>
          </div>

          {/* Canvas Preview Mockup - Room Scene */}
          {/* Portrait is rendered BEHIND the mockup - mockup has transparent canvas area */}
          <div className="relative mx-auto mb-6 rounded-lg overflow-hidden" style={{ maxWidth: '400px' }}>
            <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
              
              {/* Portrait layer - BEHIND the mockup (z-index: 1) */}
              {displayImageUrl && (
                <div 
                  className="absolute overflow-hidden"
                  style={{
                    zIndex: 1,
                    ...(selectedCanvas === "16x16" ? {
                      // 16x16: EXACT pixel coordinates from Photoshop
                      // Image: 1024x1024, Canvas: (281,184) to (792,689)
                      top: '18%',
                      left: '27.4%',
                      width: '50%',
                      height: '49.4%',
                    } : {
                      // 12x12: EXACT pixel coordinates from Photoshop
                      // Image: 1024x1024, Canvas: (262,272) to (745,755)
                      top: '26.6%',
                      left: '25.6%',
                      width: '47.2%',
                      height: '47.2%',
                    })
                  }}
                >
                  <Image
                    src={displayImageUrl}
                    alt="Your portrait on canvas"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  {/* Canvas texture overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{ 
                      background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.015) 2px, rgba(0,0,0,0.015) 4px)',
                      mixBlendMode: 'multiply',
                    }}
                  />
                </div>
              )}
              
              {/* Room mockup layer - ON TOP (z-index: 2) */}
              <Image
                src={selectedCanvas === "16x16" ? "/samples/16x16.png" : "/samples/12x12.png"}
                alt="Room mockup"
                fill
                className="object-cover"
                style={{ zIndex: 2 }}
                unoptimized
              />
            </div>
            
            {/* Caption */}
            <div 
              className="absolute bottom-0 left-0 right-0 py-2 px-3 text-center text-xs"
              style={{ 
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                color: '#B8B2A8',
                zIndex: 3,
              }}
            >
              {selectedCanvas === "16x16" ? "16×16 Premium Canvas" : "12×12 Gallery Canvas"}
            </div>
          </div>

          {/* Size Options */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {CANVAS_OPTIONS.map((option) => (
              <button
                key={option.size}
                onClick={() => setSelectedCanvas(option.size)}
                className="relative p-4 rounded-lg transition-all text-left"
                style={{
                  backgroundColor: selectedCanvas === option.size 
                    ? 'rgba(197, 165, 114, 0.15)' 
                    : 'rgba(255, 255, 255, 0.03)',
                  border: selectedCanvas === option.size 
                    ? '2px solid rgba(197, 165, 114, 0.5)' 
                    : '2px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                {/* Checkmark */}
                {selectedCanvas === option.size && (
                  <div 
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#C5A572' }}
                  >
                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                
                <div 
                  className="text-lg font-semibold mb-0.5"
                  style={{ 
                    fontFamily: "'Cormorant Garamond', Georgia, serif", 
                    color: selectedCanvas === option.size ? '#F0EDE8' : '#B8B2A8' 
                  }}
                >
                  {option.displaySize}
                </div>
                <div 
                  className="text-xs mb-2"
                  style={{ color: '#7A756D' }}
                >
                  {option.description}
                </div>
                <div 
                  className="text-xl font-bold"
                  style={{ color: '#C5A572' }}
                >
                  {option.price}
                </div>
              </button>
            ))}
          </div>

          {/* Order Button */}
          <button
            onClick={handleCanvasOrder}
            disabled={isOrderingCanvas}
            className="w-full py-4 px-6 rounded-full font-semibold text-lg transition-all"
            style={{
              background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
              color: '#0A0A0A',
              boxShadow: '0 4px 20px rgba(197, 165, 114, 0.3)',
            }}
          >
            {isOrderingCanvas ? (
              <span className="flex items-center justify-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full animate-spin"
                  style={{ 
                    borderWidth: '2px',
                    borderStyle: 'solid',
                    borderColor: 'rgba(0, 0, 0, 0.3)',
                    borderTopColor: '#0A0A0A'
                  }}
                />
                Creating Order...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                🖼️ Order Canvas Print - {CANVAS_OPTIONS.find(o => o.size === selectedCanvas)?.price}
              </span>
            )}
          </button>

          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs" style={{ color: '#7A756D' }}>
            <span className="flex items-center gap-1">
              <span>🚚</span> Free US Shipping
            </span>
            <span className="flex items-center gap-1">
              <span>✨</span> Gallery Quality
            </span>
            <span className="flex items-center gap-1">
              <span>🎁</span> Ready to Hang
            </span>
          </div>
        </div>

        {/* Tips section */}
        <div className="card animate-fade-in-up delay-400">
          <h3 
            className="text-xl mb-4 text-center"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            ✨ Ideas for Your Portrait
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm" style={{ color: '#B8B2A8' }}>
            <div className="flex items-start gap-3">
              <span className="text-lg">🖼️</span>
              <span>Print and frame it for an elegant wall display</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🎁</span>
              <span>Make it into a gift for fellow pet lovers</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">📱</span>
              <span>Use as a unique profile picture on social media</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">☕</span>
              <span>Print on canvas, mugs, or other merchandise</span>
            </div>
          </div>
        </div>

        {/* Back home link */}
        <div className="text-center mt-10 animate-fade-in-up delay-500">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 transition-colors hover:text-[#C5A572]"
            style={{ color: '#7A756D' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Create another masterpiece
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-renaissance flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <div 
              className="w-16 h-16 rounded-full animate-spin"
              style={{ 
                borderWidth: '4px',
                borderStyle: 'solid',
                borderColor: 'rgba(197, 165, 114, 0.2)',
                borderTopColor: '#C5A572'
              }}
            />
          </div>
          <p style={{ color: '#B8B2A8' }}>Loading your masterpiece...</p>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
