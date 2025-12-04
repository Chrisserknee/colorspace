"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { CONFIG } from "@/lib/config";
import { captureEvent } from "@/lib/posthog";

type Stage = "preview" | "email-capture" | "generating" | "result" | "checkout" | "email" | "expired" | "restoring";
type Gender = "male" | "female" | null;

interface RainbowBridgeFlowProps {
  file: File | null;
  onReset: () => void;
  initialEmail?: string; // Email from URL param for session restore
}

interface GeneratedResult {
  imageId: string;
  previewUrl: string;
  quote?: string;
  petName?: string;
  isRainbowBridge?: boolean;
  previewTextUrl?: string;  // Server-rendered preview with text overlay
  hdTextUrl?: string;       // Server-rendered HD with text overlay
}

// Heavenly phrases for generation animation
const HEAVENLY_PHRASES = [
  "Preparing their heavenly portrait...",
  "Surrounding them with angelic light...",
  "Adding soft ethereal glow...",
  "Creating their peaceful resting place...",
  "Painting wings of light...",
  "Capturing their eternal spirit...",
  "Adding rainbow bridge colors...",
  "A beautiful tribute takes form...",
];

// Retry limit management using localStorage
const STORAGE_KEY = "lumepet_generation_limits";

interface GenerationLimits {
  freeGenerations: number;
  freeRetriesUsed: number;
  purchases: number;
  packPurchases: number;
  packCredits: number;
  bonusGranted: number; // Track total bonus generations granted via secret feature (max 13)
  lastReset?: string;
}

const getLimits = (): GenerationLimits => {
  if (typeof window === "undefined") {
    return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0, bonusGranted: 0 };
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        freeGenerations: parsed.freeGenerations || 0,
        freeRetriesUsed: parsed.freeRetriesUsed || 0,
        purchases: parsed.purchases || 0,
        packPurchases: parsed.packPurchases || 0,
        packCredits: parsed.packCredits || 0,
        bonusGranted: parsed.bonusGranted || 0,
        lastReset: parsed.lastReset,
      };
    } catch {
      return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0, bonusGranted: 0 };
    }
  }
  return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0, bonusGranted: 0 };
};

const saveLimits = (limits: GenerationLimits) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  }
};

const canGenerate = (limits: GenerationLimits): { allowed: boolean; reason?: string; hasPackCredits?: boolean } => {
  // Free tier: 3 total free generations
  const freeLimit = 3;
  const freeUsed = limits.freeGenerations;
  // Each purchase grants 2 additional watermarked generations
  const purchaseBonus = limits.purchases * 2;
  const totalAllowed = freeLimit + purchaseBonus;
  const totalUsed = freeUsed;
  
  if (limits.packCredits > 0) {
    return { allowed: true, hasPackCredits: true };
  }
  
  if (totalUsed >= totalAllowed) {
    return {
      allowed: false,
      reason: `You've reached your free generation limit. Purchase a pack to create more memorial portraits.`,
      hasPackCredits: false,
    };
  }
  
  return { allowed: true, hasPackCredits: false };
};

const incrementGeneration = (isRetry: boolean = false) => {
  const limits = getLimits();
  limits.freeGenerations += 1;
  if (isRetry) {
    limits.freeRetriesUsed = 1;
  }
  saveLimits(limits);
  return limits;
};

const usePackCredit = () => {
  const limits = getLimits();
  if (limits.packCredits > 0) {
    limits.packCredits -= 1;
    saveLimits(limits);
  }
  return limits;
};

export default function RainbowBridgeFlow({ file, onReset, initialEmail }: RainbowBridgeFlowProps) {
  const [stage, setStage] = useState<Stage>("preview");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [retryUsed, setRetryUsed] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const [expirationTime, setExpirationTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("15:00");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender>(null);
  const [petName, setPetName] = useState("");
  const [generationLimits, setGenerationLimits] = useState<GenerationLimits>(getLimits());
  const [limitCheck, setLimitCheck] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [secretActivated, setSecretActivated] = useState(false);
  const [useSecretCredit, setUseSecretCredit] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [canvasImageUrl, setCanvasImageUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null); // Supabase URL for session
  const [sessionRestored, setSessionRestored] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // For closing animation
  const [showRevealAnimation, setShowRevealAnimation] = useState(false); // Portrait reveal animation

  // Function to render text overlay on canvas and return data URL
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

        // Set canvas size to match image
        canvas.width = img.width;
        canvas.height = img.height;

        // Draw the original image
        ctx.drawImage(img, 0, 0);

        const width = canvas.width;
        const height = canvas.height;
        const padding = Math.floor(width * 0.04);

        // Calculate text sizes
        const nameFontSize = Math.floor(width * 0.055);
        const quoteFontSize = Math.floor(width * 0.024);

        // Draw gradient overlay at bottom for text readability
        const gradientHeight = Math.floor(height * 0.25);
        const gradient = ctx.createLinearGradient(0, height - gradientHeight, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - gradientHeight, width, gradientHeight);

        // Draw quote text (white, italic)
        ctx.font = `italic ${quoteFontSize}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        // Word wrap the quote
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

        // Position quote above name
        const lineHeight = quoteFontSize * 1.4;
        const nameY = height - padding;
        const quoteStartY = nameY - nameFontSize - padding - (lines.length - 1) * lineHeight;

        // Draw quote with shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        
        lines.forEach((line, i) => {
          ctx.fillText(line, width / 2, quoteStartY + i * lineHeight);
        });

        // Draw pet name (gold, bold)
        ctx.font = `bold ${nameFontSize}px Georgia, "Times New Roman", serif`;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 3;
        
        // Create gold gradient for name
        const goldGradient = ctx.createLinearGradient(width * 0.3, 0, width * 0.7, 0);
        goldGradient.addColorStop(0, '#D4AF37');
        goldGradient.addColorStop(0.5, '#F5E6A3');
        goldGradient.addColorStop(1, '#D4AF37');
        ctx.fillStyle = goldGradient;
        
        ctx.fillText(name.toUpperCase(), width / 2, nameY);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        resolve(canvas.toDataURL('image/png', 1.0));
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      img.src = imageUrl;
    });
  }, []);

  // Upload canvas-rendered text overlay to Supabase (for HD download with text)
  const uploadTextOverlay = useCallback(async (imageId: string, imageDataUrl: string, type: 'hd-text' | 'preview-text') => {
    try {
      const response = await fetch('/api/upload-text-overlay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageId, imageDataUrl, type }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Uploaded ${type} to Supabase:`, data.fileName);
        return data.url;
      } else {
        console.warn(`Failed to upload ${type}:`, await response.text());
        return null;
      }
    } catch (err) {
      console.warn(`Error uploading ${type}:`, err);
      return null;
    }
  }, []);

  // Generate canvas image when result is available
  // Always use client-side canvas rendering for reliable text overlay display
  // Then upload the rendered images to Supabase for HD download
  useEffect(() => {
    if (result?.previewUrl && result?.imageId && petName) {
      const quote = result.quote || "Until we meet again at the Bridge, run free, sweet soul.";
      
      // Render preview with text for display
      renderTextOverlay(result.previewUrl, petName, quote)
        .then(async (dataUrl) => {
          setCanvasImageUrl(dataUrl);
          console.log("✅ Canvas text overlay rendered successfully");
          
          // Upload preview-text version to Supabase (non-blocking)
          uploadTextOverlay(result.imageId, dataUrl, 'preview-text');
          
          // Also render and upload the HD version with text
          // The HD URL follows the pattern: replace -preview.png with -hd.png
          const hdUrl = result.previewUrl.replace('-preview.png', '-hd.png');
          try {
            const hdTextDataUrl = await renderTextOverlay(hdUrl, petName, quote);
            console.log("✅ HD text overlay rendered successfully");
            // Upload HD-text version to Supabase (non-blocking)
            uploadTextOverlay(result.imageId, hdTextDataUrl, 'hd-text');
          } catch (hdErr) {
            console.warn("Could not render HD text overlay:", hdErr);
          }
        })
        .catch(err => {
          console.error("Failed to render canvas overlay:", err);
          setCanvasImageUrl(result.previewUrl); // Fallback to original without text
        });
    }
  }, [result, petName, renderTextOverlay, uploadTextOverlay]);

  // Session restoration - check for email in URL and restore previous session
  useEffect(() => {
    if (initialEmail && !sessionRestored) {
      setStage("restoring");
      
      fetch(`/api/lume-leads/session?email=${encodeURIComponent(initialEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.hasSession && data.session) {
            const session = data.session;
            console.log("🔄 Restoring Rainbow Bridge session for:", initialEmail, session);
            
            // Restore email - already have it from email link
            setEmail(initialEmail);
            
            // Restore gender
            if (session.gender) {
              setGender(session.gender as Gender);
            }
            
            // Restore pet name
            if (session.petName) {
              setPetName(session.petName);
            }
            
            // Restore uploaded image
            if (session.uploadedImageUrl) {
              setPreviewUrl(session.uploadedImageUrl);
              setUploadedImageUrl(session.uploadedImageUrl);
            }
            
            // Restore generated result if available - show result page
            if (session.imageId && session.previewUrl) {
              setResult({
                imageId: session.imageId,
                previewUrl: session.previewUrl,
                quote: session.quote,
                petName: session.petName,
                isRainbowBridge: true,
              });
              // Set expiration for 15 minutes from now
              setExpirationTime(Date.now() + 15 * 60 * 1000);
              setStage("result");
              
              // Store Rainbow Bridge data for success page
              const rainbowBridgeData = {
                imageId: session.imageId,
                petName: session.petName,
                quote: session.quote || "Until we meet again at the Bridge, run free, sweet soul.",
                timestamp: Date.now()
              };
              localStorage.setItem(`rainbow_bridge_${session.imageId}`, JSON.stringify(rainbowBridgeData));
              
              captureEvent("rb_session_restored_with_result", {
                email: initialEmail,
                has_preview: true,
                pet_name: session.petName,
              });
            } else if (session.uploadedImageUrl) {
              // Just has uploaded image, go to preview stage
              setStage("preview");
              
              captureEvent("rb_session_restored_preview_only", {
                email: initialEmail,
                pet_name: session.petName,
              });
            } else {
              setStage("preview");
            }
          } else {
            console.log("No session found for:", initialEmail);
            setStage("preview");
          }
          setSessionRestored(true);
        })
        .catch(err => {
          console.warn("Session restore failed:", err);
          setStage("preview");
          setSessionRestored(true);
        });
    }
  }, [initialEmail, sessionRestored]);

  // Set preview URL when file is provided
  useEffect(() => {
    if (file && !previewUrl) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        setPreviewUrl(base64Url);
        captureEvent("rainbow_bridge_image_uploaded", {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        });
      };
      reader.onerror = () => {
        console.warn("Base64 conversion failed, using blob URL");
        setPreviewUrl(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
      
      // Upload pet photo to Supabase immediately and track URL for session
      const uploadFormData = new FormData();
      uploadFormData.append("image", file);
      uploadFormData.append("source", "rainbow-bridge");
      fetch("/api/upload-pet", {
        method: "POST",
        body: uploadFormData,
      })
        .then(res => res.json())
        .then(data => {
          if (data.url) {
            setUploadedImageUrl(data.url);
            console.log("📷 Pet photo uploaded, URL saved for session:", data.url);
          }
        })
        .catch(err => console.warn("Pet photo upload failed (non-critical):", err));
      
      // Reset secret click counter for new file
      setSecretClickCount(0);
      setSecretActivated(false);
      setUseSecretCredit(false);
    }
  }, [file, previewUrl]);

  // Check generation limits on mount
  useEffect(() => {
    const limits = getLimits();
    setGenerationLimits(limits);
    const check = canGenerate(limits);
    setLimitCheck(check);
    setRetryUsed(limits.freeRetriesUsed >= 1);
  }, [file]);

  // Phrase cycling animation
  useEffect(() => {
    if (stage !== "generating") return;

    const cycleInterval = setInterval(() => {
      setPhraseVisible(false);
      setTimeout(() => {
        setCurrentPhrase((prev) => (prev + 1) % HEAVENLY_PHRASES.length);
        setPhraseVisible(true);
      }, 1000);
    }, 5000);

    return () => clearInterval(cycleInterval);
  }, [stage]);

  // Progress bar tracking - multi-phase for accurate feel
  useEffect(() => {
    if (stage !== "generating" || !generationStartTime) return;

    // Multi-phase progress for more accurate feel
    // Phase 1 (0-20%): Upload & queue - fast (0-5 seconds)
    // Phase 2 (20-70%): Main generation - moderate (5-40 seconds)
    // Phase 3 (70-90%): Finishing & watermarking - slower (40-55 seconds)
    // Phase 4 (90-95%): Buffer zone - very slow (55-70 seconds)
    const updateInterval = setInterval(() => {
      const elapsed = Date.now() - generationStartTime;
      
      let progress: number;
      if (elapsed < 5000) {
        // Phase 1: Quick start (0-20% in 5 seconds)
        progress = (elapsed / 5000) * 20;
      } else if (elapsed < 40000) {
        // Phase 2: Main generation (20-70% over 35 seconds)
        progress = 20 + ((elapsed - 5000) / 35000) * 50;
      } else if (elapsed < 55000) {
        // Phase 3: Finishing up (70-90% over 15 seconds)
        progress = 70 + ((elapsed - 40000) / 15000) * 20;
      } else if (elapsed < 75000) {
        // Phase 4: Buffer zone with very slow progress (90-95% over 20 seconds)
        progress = 90 + ((elapsed - 55000) / 20000) * 5;
      } else {
        // Cap at 95% - waiting for actual completion
        progress = 95;
      }
      
      setGenerationProgress(Math.min(95, progress));
    }, 100);

    return () => clearInterval(updateInterval);
  }, [stage, generationStartTime]);

  // Countdown timer
  useEffect(() => {
    if (!expirationTime || stage === "expired") return;

    const timerInterval = setInterval(() => {
      const now = Date.now();
      const remaining = expirationTime - now;

      if (remaining <= 0) {
        setStage("expired");
        setTimeRemaining("00:00");
        clearInterval(timerInterval);
        return;
      }

      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeRemaining(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [expirationTime, stage]);

  // Trigger reveal animation when entering result stage
  useEffect(() => {
    if (stage === "result") {
      setShowRevealAnimation(true);
      // Keep animation visible for a while, then fade out sparkles
      const timer = setTimeout(() => {
        setShowRevealAnimation(false);
      }, 6000); // Animation lasts 6 seconds for dramatic effect
      return () => clearTimeout(timer);
    }
  }, [stage]);

  // Compress image before upload
  const compressImage = async (file: File, maxSizeMB: number = 3.5): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const maxDimension = 2000;
          if (width > height && width > maxDimension) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else if (height > maxDimension) {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // New handler for pre-generation email capture
  const handlePreGenerateEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    // Save to lume_leads (triggers Email #1 if conditions met)
    try {
      const sessionContext = {
        style: "rainbow-bridge",
        gender: gender,
        petName: petName,
        uploadedImageUrl: uploadedImageUrl,
        source: "pre-generate",
      };
      
      console.log("💾 Saving Rainbow Bridge lead before generation:", { email, context: sessionContext });
      
      await fetch("/api/lume-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: sessionContext }),
      });
      
      captureEvent("rb_email_captured_pre_generate", {
        gender: gender || "not_selected",
        pet_name: petName,
      });
    } catch (err) {
      console.warn("Failed to save lead (non-critical):", err);
    }
    
    // Now proceed with actual generation
    doGenerate(false);
  };

  const handleGenerate = async (isRetry: boolean = false) => {
    if (!file || !petName.trim()) return;
    
    const limits = getLimits();
    // Allow generation if secret credit is activated, even if limits are reached
    const check = canGenerate(limits);
    if (!check.allowed && !useSecretCredit) {
      setError(check.reason || "Generation limit reached.");
      setStage("preview");
      return;
    }
    
    // Proceed directly to generation (email captured during purchase flow, not before)
    doGenerate(isRetry);
  };

  const doGenerate = async (isRetry: boolean = false) => {
    if (!file || !petName.trim()) return;
    
    // Get limits at the start for tracking
    const currentLimitsForTracking = getLimits();
    
    setStage("generating");
    setError(null);
    setCurrentPhrase(0);
    setPhraseVisible(true);
    setGenerationProgress(0);
    setGenerationStartTime(Date.now());

    captureEvent("rainbow_bridge_generation_started", {
      is_retry: isRetry,
      has_pack_credits: currentLimitsForTracking.packCredits > 0,
      gender: gender || "not_selected",
      pet_name: petName,
    });

    try {
      let fileToUpload = file;
      if (file.size > 3.5 * 1024 * 1024) {
        fileToUpload = await compressImage(file, 3.5);
      }
      
      const formData = new FormData();
      formData.append("image", fileToUpload);
      formData.append("style", "rainbow-bridge");
      formData.append("petName", petName.trim());
      console.log("🌈 Sending Rainbow Bridge generation request with petName:", petName.trim());
      if (gender) {
        formData.append("gender", gender);
      }
      
      const currentLimits = getLimits();
      if (currentLimits.packCredits > 0) {
        formData.append("usePackCredit", "true");
      }
      
      // Check if secret credit is activated (un-watermarked generation for testing)
      if (useSecretCredit) {
        formData.append("useSecretCredit", "true");
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (response.status === 413) {
        throw new Error("Image file is too large. Please use an image smaller than 4MB.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate portrait (${response.status})`);
      }

      setResult(data);
      
      const usedPackCredit = currentLimits.packCredits > 0;
      const usedSecretCredit = useSecretCredit;
      
      if (usedPackCredit) {
        const updatedLimits = usePackCredit();
        setGenerationLimits(updatedLimits);
      } else if (usedSecretCredit) {
        // Secret credit used - increment generation count (uses up the free slot granted by secret)
        const updatedLimits = incrementGeneration(isRetry);
        setGenerationLimits(updatedLimits);
        setUseSecretCredit(false); // Reset secret credit flag after use
      } else {
        const updatedLimits = incrementGeneration(isRetry);
        setGenerationLimits(updatedLimits);
      }
      const newCheck = canGenerate(getLimits());
      setLimitCheck(newCheck);
      
      captureEvent("rainbow_bridge_generation_completed", {
        image_id: data.imageId,
        is_retry: isRetry,
        used_pack_credit: usedPackCredit,
        used_secret_credit: usedSecretCredit,
        gender: gender || "not_selected",
        pet_name: petName,
      });
      
      // Update session with generated result (for email follow-ups)
      if (email) {
        try {
          const updatedContext = {
            style: "rainbow-bridge",
            gender: gender,
            petName: petName,
            quote: data.quote || "Until we meet again at the Bridge, run free, sweet soul.",
            uploadedImageUrl: uploadedImageUrl,
            imageId: data.imageId,
            previewUrl: data.previewUrl,
            source: "rainbow-bridge-generated",
          };
          
          await fetch("/api/lume-leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, context: updatedContext }),
          });
          console.log("💾 Updated Rainbow Bridge session with generated result");
        } catch (err) {
          console.warn("Failed to update session with result (non-critical):", err);
        }
      }
      
      setExpirationTime(Date.now() + 15 * 60 * 1000);
      setGenerationProgress(100); // Complete the progress bar
      
      // Reset secret credit after use - user must click 6 times again to activate
      if (useSecretCredit) {
        setUseSecretCredit(false);
        console.log("🔒 Secret credit used and reset. Must click 6 times again to activate.");
      }
      
      // Save session to localStorage for "Resume" feature
      const sessionData = {
        email: email,
        imageId: result?.imageId || '',
        previewUrl: result?.previewUrl || '',
        petName: petName,
        timestamp: Date.now(),
        type: 'rainbow-bridge',
      };
      localStorage.setItem('lumepet_last_session', JSON.stringify(sessionData));
      console.log("💾 Rainbow Bridge session saved for resume feature");
      
      setStage("result");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errorMessage);
      setStage("preview");
      
      // Also reset secret credit on error to prevent issues
      if (useSecretCredit) {
        setUseSecretCredit(false);
      }
    }
  };

  const handleRetry = () => {
    const limits = getLimits();
    
    if (limits.freeRetriesUsed >= 1) {
      setError("You've already used your free retry.");
      return;
    }
    
    const check = canGenerate(limits);
    if (!check.allowed) {
      setError(check.reason || "Generation limit reached.");
      return;
    }
    
    setRetryUsed(true);
    setResult(null);
    setExpirationTime(null);
    setError(null);
    handleGenerate(true);
  };

  const handlePurchaseClick = async () => {
    captureEvent("rainbow_bridge_purchase_clicked", {
      image_id: result?.imageId,
      has_email: !!email,
    });
    
    // If email is already set (from session restore), skip to checkout directly
    if (email && validateEmail(email) && result && result.imageId !== "pack") {
      console.log("📧 Email already set from session, going directly to checkout");
      setStage("checkout");
      
      try {
        // Cancel URL returns user to their portrait via session restore
        const cancelUrl = `/rainbow-bridge?email=${encodeURIComponent(email)}`;
        
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: result.imageId,
            email: email,
            type: "image",
            cancelUrl,
          }),
        });
        
        const data = await response.json();
        
        if (response.ok && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          setError(data.error || "Failed to create checkout session");
          setStage("result");
        }
      } catch (err) {
        console.error("Checkout error:", err);
        setError("Failed to redirect to checkout. Please try again.");
        setStage("result");
      }
      return;
    }
    
    // Otherwise, go to email entry stage
    setStage("email");
    setEmailError(null);
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleEmailSubmit = async () => {
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (!result) {
      console.error("No result found when trying to checkout");
      setError("Please generate a portrait first.");
      return;
    }
    
    // Track email submitted
    const isPackPurchase = result.imageId === "pack";
    captureEvent("rainbow_bridge_email_submitted", {
      is_pack_purchase: isPackPurchase,
      pack_type: isPackPurchase ? "2-pack" : null,
      image_id: isPackPurchase ? null : result.imageId,
    });
    
    // Save session to lume_leads for email sequence and session restore
    try {
      const sessionContext = {
        style: "rainbow-bridge",
        gender: gender,
        petName: petName,
        quote: result.quote || "Until we meet again at the Bridge, run free, sweet soul.",
        uploadedImageUrl: uploadedImageUrl,
        imageId: isPackPurchase ? null : result.imageId,
        previewUrl: isPackPurchase ? null : result.previewUrl,
        source: "rainbow-bridge-checkout",
      };
      
      console.log("💾 Saving Rainbow Bridge session to lume_leads:", { email, context: sessionContext });
      
      await fetch("/api/lume-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: sessionContext }),
      });
    } catch (err) {
      console.warn("Failed to save session (non-critical):", err);
    }
    
    setStage("checkout");
    setError(null); // Clear any previous errors

    try {
      const isPackPurchase = result.imageId === "pack";
      
      // Store Rainbow Bridge data in localStorage for success page
      if (!isPackPurchase && result.imageId) {
        const rainbowBridgeData = {
          imageId: result.imageId,
          petName: petName,
          quote: result.quote || "Until we meet again at the Bridge, run free, sweet soul.",
          timestamp: Date.now()
        };
        localStorage.setItem(`rainbow_bridge_${result.imageId}`, JSON.stringify(rainbowBridgeData));
        console.log("Saved Rainbow Bridge data for success page:", rainbowBridgeData);
      }
      
      // Cancel URL returns user to their portrait via session restore
      const cancelUrl = `/rainbow-bridge?email=${encodeURIComponent(email)}`;
      
      console.log("Creating checkout session:", {
        imageId: isPackPurchase ? null : result.imageId,
        email,
        type: isPackPurchase ? "pack" : "image",
        packType: isPackPurchase ? "2-pack" : undefined,
        hasCanvasImage: !!canvasImageUrl,
      });
      
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          imageId: isPackPurchase ? null : result.imageId, 
          email,
          type: isPackPurchase ? "pack" : "image",
          packType: isPackPurchase ? "2-pack" : undefined,
          // Include the canvas-rendered image for Stripe to display
          canvasImageDataUrl: canvasImageUrl || undefined,
          cancelUrl,
        }),
      });

      const data = await response.json();
      console.log("Checkout API response:", data);

      if (!response.ok) {
        console.error("Checkout API error:", data);
        throw new Error(data.error || "Failed to create checkout session");
      }

      if (!data.checkoutUrl) {
        console.error("No checkout URL in response:", data);
        throw new Error("No checkout URL received from server");
      }

      console.log("Redirecting to:", data.checkoutUrl);
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Checkout error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to redirect to checkout.";
      setError(errorMessage);
      setStage("email"); // Go back to email stage so user can see the error
    }
  };

  const handleReset = () => {
    // Trigger closing animation first
    setIsClosing(true);
    
    setTimeout(() => {
      // If user came from email link, redirect to rainbow bridge page instead of resetting
      if (initialEmail) {
        window.location.href = '/rainbow-bridge';
        return;
      }
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      setResult(null);
      setStage("preview");
      setError(null);
      setExpirationTime(null);
      setEmail("");
      setGender(null);
      setPetName("");
      setSecretClickCount(0);
      setSecretActivated(false);
      setUseSecretCredit(false);
      setCanvasImageUrl(null);
      setIsClosing(false);
      
      const limits = getLimits();
      setGenerationLimits(limits);
      const check = canGenerate(limits);
      setLimitCheck(check);
      setRetryUsed(limits.freeRetriesUsed >= 1);
      
      onReset();
    }, 350); // Match animation duration for premium feel
  };

  // Show nothing if no file AND no session restore in progress
  if (!file && !initialEmail) return null;

  const canSubmit = gender && petName.trim().length > 0 && (limitCheck?.allowed ?? false);

  return (
    <div className={`fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain ${isClosing ? 'pointer-events-none' : ''}`}>
      {/* Backdrop - Soft heavenly gradient */}
      <div 
        className={`fixed inset-0 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'animate-fade-out' : ''}`}
        style={{ 
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 246, 243, 0.98) 50%, rgba(245, 240, 235, 0.95) 100%)'
        }}
        onClick={handleReset}
      />
      
      {/* Content - no overflow here, let outer container handle scrolling */}
      <div 
        className={`relative w-full max-w-md sm:max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl my-2 sm:my-4 flex flex-col ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
        style={{ 
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.1), 0 0 100px rgba(212, 175, 55, 0.1)'
        }}
      >
        {/* Close button */}
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 hover:rotate-90 active:scale-95"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.05)', 
            color: '#6B6B6B',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.15)';
            e.currentTarget.style.color = '#D4AF37';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(212, 175, 55, 0.3), 0 2px 8px rgba(0, 0, 0, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
            e.currentTarget.style.color = '#6B6B6B';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.1)';
          }}
        >
          <svg className="w-5 h-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Portrait Counter - Top left - Hidden on result, checkout, and restoring stages */}
        {stage !== "checkout" && stage !== "restoring" && stage !== "result" && (
          <div 
            className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 z-10"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(212, 175, 55, 0.4)',
              color: '#B8960C',
              boxShadow: '0 0 15px rgba(212, 175, 55, 0.25), 0 2px 8px rgba(0, 0, 0, 0.1)'
            }}
          >
            {/* Gold Glowing Paintbrush Icon */}
            <svg 
              className="w-4 h-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ 
                filter: 'drop-shadow(0 0 3px rgba(212, 175, 55, 0.8))',
                color: '#D4AF37'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            <span>
              {generationLimits.packCredits > 0 
                ? `${generationLimits.packCredits} portrait${generationLimits.packCredits !== 1 ? 's' : ''}`
                : `${Math.max(0, 3 - generationLimits.freeGenerations)} free`
              }
            </span>
          </div>
        )}

        {/* Preview Stage */}
        {stage === "preview" && (
          <div className="p-3 sm:p-5 pb-8">
            <div className="text-center mb-4">
              <h3 
                className="text-xl sm:text-2xl font-semibold mb-1"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
              >
                Create a Memorial Portrait
              </h3>
              <p className="text-sm" style={{ color: '#6B6B6B' }}>
                Honor your companion with a heavenly tribute
              </p>
            </div>

            <div 
              className="relative aspect-square max-w-[200px] sm:max-w-xs mx-auto rounded-xl overflow-hidden shadow-lg mb-4 cursor-pointer"
              style={{ border: '2px solid rgba(212, 175, 55, 0.3)' }}
              onClick={() => {
                const newCount = secretClickCount + 1;
                setSecretClickCount(newCount);
                
                if (newCount >= 6) {
                  // Grant 8 extra free generations (can stack up to 13 TOTAL bonus)
                  const limits = getLimits();
                  const maxBonusTotal = 13; // Maximum TOTAL bonus that can ever be granted
                  const currentBonusGranted = limits.bonusGranted || 0;
                  
                  // Check if user has already received max bonus
                  if (currentBonusGranted >= maxBonusTotal) {
                    console.log("❌ Maximum bonus already granted (13 total). No more bonus available.");
                    setSecretClickCount(0);
                    return;
                  }
                  
                  // Calculate how much bonus we can still grant (up to 8, but limited by remaining capacity)
                  const remainingBonusCapacity = maxBonusTotal - currentBonusGranted;
                  const bonusToGrant = Math.min(8, remainingBonusCapacity);
                  
                  if (bonusToGrant <= 0) {
                    console.log("❌ No bonus capacity remaining.");
                    setSecretClickCount(0);
                    return;
                  }
                  
                  // Grant bonus by reducing freeGenerations (can go negative = bonus credits)
                  limits.freeGenerations = limits.freeGenerations - bonusToGrant;
                  limits.bonusGranted = currentBonusGranted + bonusToGrant; // Track total bonus granted
                  
                  saveLimits(limits);
                  setGenerationLimits(limits);
                  const newCheck = canGenerate(limits);
                  setLimitCheck(newCheck);
                  setSecretActivated(true);
                  setUseSecretCredit(true); // Enable un-watermarked generation for testing
                  
                  // Reset click count
                  setSecretClickCount(0);
                  
                  // Calculate remaining bonus capacity
                  const newRemainingCapacity = maxBonusTotal - limits.bonusGranted;
                  
                  // Show subtle feedback
                  console.log(`🎉 Secret activated! +${bonusToGrant} generations granted. Total bonus used: ${limits.bonusGranted}/${maxBonusTotal}. Remaining capacity: ${newRemainingCapacity}`);
                  console.log("Can generate:", newCheck.allowed);
                  
                  // Reset activated display after short delay
                  setTimeout(() => {
                    setSecretActivated(false);
                  }, 2000);
                }
              }}
            >
              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Your beloved pet"
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              {/* Secret click indicator (very subtle) */}
              {secretClickCount > 0 && secretClickCount < 6 && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(212, 175, 55, 0.3)' }}></div>
              )}
              {secretActivated && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)', color: '#4ADE80' }}>
                    ✨ Bonus granted!
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div 
                className="mb-6 p-4 rounded-xl text-center"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#DC2626'
                }}
              >
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Pet Name Input */}
            <div className="mb-6">
              <label className="block text-center mb-2 text-sm" style={{ color: '#6B6B6B' }}>
                What was your pet&apos;s name?
              </label>
              <input
                type="text"
                value={petName}
                onChange={(e) => setPetName(e.target.value)}
                placeholder="Enter their name"
                maxLength={30}
                className="w-full max-w-xs mx-auto block px-4 py-3 rounded-xl text-center text-lg outline-none transition-all"
                style={{ 
                  backgroundColor: 'rgba(212, 175, 55, 0.05)',
                  border: '2px solid rgba(212, 175, 55, 0.3)',
                  color: '#4A4A4A',
                  fontFamily: "'Cormorant Garamond', Georgia, serif"
                }}
              />
            </div>

            {/* Gender Selection */}
            <div className="mb-6">
              <p className="text-center mb-3 text-sm" style={{ color: '#6B6B6B' }}>
                Select your pet&apos;s gender:
              </p>
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => setGender("male")}
                  disabled={limitCheck ? !limitCheck.allowed : false}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    gender === "male"
                      ? "scale-105 shadow-lg"
                      : "opacity-70 hover:opacity-100"
                  } ${limitCheck && !limitCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: gender === "male" ? '#D4AF37' : 'rgba(212, 175, 55, 0.1)',
                    color: gender === "male" ? '#FFFFFF' : '#D4AF37',
                    border: `2px solid ${gender === "male" ? '#D4AF37' : 'rgba(212, 175, 55, 0.3)'}`,
                  }}
                >
                  ♂ Boy
                </button>
                <button
                  onClick={() => setGender("female")}
                  disabled={limitCheck ? !limitCheck.allowed : false}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                    gender === "female"
                      ? "scale-105 shadow-lg"
                      : "opacity-70 hover:opacity-100"
                  } ${limitCheck && !limitCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: gender === "female" ? '#D4AF37' : 'rgba(212, 175, 55, 0.1)',
                    color: gender === "female" ? '#FFFFFF' : '#D4AF37',
                    border: `2px solid ${gender === "female" ? '#D4AF37' : 'rgba(212, 175, 55, 0.3)'}`,
                  }}
                >
                  ♀ Girl
                </button>
              </div>
            </div>

            {/* Generation Limit Display */}
            {limitCheck && !limitCheck.allowed && (
              <div className="mb-4 p-4 rounded-xl text-center text-sm" style={{ 
                backgroundColor: 'rgba(212, 175, 55, 0.05)',
                border: '1px solid rgba(212, 175, 55, 0.2)',
              }}>
                <p className="mb-4" style={{ color: '#DC2626' }}>{limitCheck.reason}</p>
                <a
                  href="/pack-checkout"
                  className="inline-block px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                  style={{ 
                    backgroundColor: '#D4AF37',
                    color: '#FFFFFF',
                    textDecoration: 'none',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.4)',
                  }}
                >
                  ✨ Unlock More Portraits
                </a>
              </div>
            )}

            {/* Pricing Info */}
            <div className="text-center mb-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(212, 175, 55, 0.08)', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
              <p className="text-sm" style={{ color: '#D4AF37', fontWeight: '500' }}>
                Final 4K portrait: $19.99
              </p>
              <p className="text-xs mt-1" style={{ color: '#8B8B8B' }}>
                Watermarked version – free
              </p>
            </div>

            <div className="text-center">
              <button 
                onClick={() => handleGenerate(false)} 
                disabled={!canSubmit}
                className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105 ${!canSubmit ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ 
                  background: canSubmit ? 'linear-gradient(135deg, #D4AF37 0%, #E6C866 50%, #D4AF37 100%)' : 'rgba(212, 175, 55, 0.3)',
                  color: '#FFFFFF',
                  boxShadow: canSubmit ? '0 4px 20px rgba(212, 175, 55, 0.3)' : 'none',
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                }}
              >
                <span className="flex items-center gap-3">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                  </svg>
                  Create Memorial Portrait
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Email Capture Stage (Before Generation) */}
        {stage === "email-capture" && (
          <div className="p-4 sm:p-6 pb-6 pt-10 sm:pt-12">
            <div className="text-center mb-4 sm:mb-6">
              <h3 
                className="text-2xl font-semibold mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
              >
                Where Should We Send {petName}&apos;s Portrait?
              </h3>
              <p className="text-base" style={{ color: '#6B6B6B' }}>
                Enter your email so we can deliver your memorial masterpiece
              </p>
            </div>

            {/* Preview of uploaded image */}
            {previewUrl && (
              <div 
                className="relative aspect-square max-w-[150px] mx-auto rounded-xl overflow-hidden shadow-lg mb-6"
                style={{ border: '2px solid rgba(212, 175, 55, 0.3)' }}
              >
                <Image
                  src={previewUrl}
                  alt="Your beloved pet"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}

            <div className="max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-center text-lg mb-4 outline-none transition-all"
                style={{ 
                  backgroundColor: 'rgba(212, 175, 55, 0.05)',
                  border: emailError ? '2px solid #DC2626' : '2px solid rgba(212, 175, 55, 0.3)',
                  color: '#4A4A4A'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePreGenerateEmailSubmit()}
                autoFocus
              />
              
              {emailError && (
                <p className="text-center text-sm mb-4" style={{ color: '#DC2626' }}>
                  {emailError}
                </p>
              )}

              <button 
                type="button"
                onClick={handlePreGenerateEmailSubmit}
                className="w-full py-4 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #E6C866 50%, #D4AF37 100%)',
                  color: '#FFFFFF',
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                Create Memorial Portrait
              </button>

              <button 
                type="button"
                onClick={() => {
                  setStage("preview");
                  setEmailError(null);
                }}
                className="w-full text-center text-sm py-3 mt-3 transition-colors hover:opacity-80"
                style={{ color: '#9B8AA0' }}
              >
                ← Go back
              </button>

              <p className="text-center text-xs mt-4" style={{ color: '#8B8B8B' }}>
                {petName}&apos;s portrait will be delivered to this email address
              </p>
            </div>
          </div>
        )}

        {/* Generating Stage - Heavenly Loading */}
        {stage === "generating" && (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[400px]">
            {/* Floating LumePet Logo with enhanced glow */}
            <div 
              className="mb-8 relative"
              style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}
            >
              <Image
                src="/samples/LumePet2.png"
                alt="LumePet"
                width={120}
                height={120}
                className="object-contain animate-float"
                style={{
                  filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.5)) drop-shadow(0 0 40px rgba(212, 175, 55, 0.3))'
                }}
                priority
              />
            </div>
            
            {/* Creating memorial title */}
            <h3 
              className="text-xl sm:text-2xl font-semibold mb-3 text-center"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
            >
              Creating {petName}&apos;s Memorial
            </h3>
            
            {/* Fading phrase */}
            <div className="h-12 flex items-center justify-center mb-6">
              <p 
                className={`text-base sm:text-lg italic text-center transition-all duration-1000 ease-in-out px-4 ${phraseVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  color: '#9B8AA0',
                  letterSpacing: '0.05em',
                }}
              >
                {HEAVENLY_PHRASES[currentPhrase]}
              </p>
            </div>

            {/* Progress bar with percentage */}
            <div className="w-full max-w-xs mb-3 px-4">
              <div 
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)' }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{ 
                    backgroundColor: '#D4AF37',
                    width: `${generationProgress}%`,
                    boxShadow: '0 0 10px rgba(212, 175, 55, 0.5)',
                  }}
                />
              </div>
            </div>
            
            {/* Progress percentage */}
            <p className="text-sm font-medium mb-2" style={{ color: '#D4AF37' }}>
              {Math.round(generationProgress)}%
            </p>

            <p className="text-xs text-center" style={{ color: '#9B8AA0' }}>
              Our artists are hand-painting {petName}&apos;s portrait...
            </p>
          </div>
        )}

        {/* Result Stage - Premium Memorial Purchase Experience */}
        {stage === "result" && result && result.imageId !== "pack" && (
          <div className="p-4 sm:p-6 pb-6">
            {/* Celebratory Header - with staggered reveal */}
            <div className="text-center mb-4">
              <p 
                className="text-sm mb-1" 
                style={{ 
                  color: '#D4AF37',
                  animation: showRevealAnimation ? 'masterpiece-text-reveal 1.5s ease-out forwards' : 'none',
                  animationDelay: '0.3s',
                  opacity: showRevealAnimation ? 0 : 1,
                }}
              >
                🌈 It&apos;s ready! 🌈
              </p>
              <h3 
                className="text-2xl sm:text-3xl font-semibold"
                style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  color: '#4A4A4A',
                  animation: showRevealAnimation ? 'masterpiece-title-reveal 2s ease-out forwards' : 'none',
                  animationDelay: '0.6s',
                  opacity: showRevealAnimation ? 0 : 1,
                  textShadow: showRevealAnimation ? '0 0 30px rgba(212, 175, 55, 0.4)' : 'none',
                }}
              >
                {petName}&apos;s Memorial Portrait
              </h3>
            </div>

            {/* Preview Image - Display Only with reveal animation */}
            {(canvasImageUrl || result.previewUrl) && (
              <div className="relative max-w-[240px] sm:max-w-[300px] mx-auto mb-4">
                {/* Outermost ethereal glow - pulsing slowly */}
                {showRevealAnimation && (
                  <div 
                    className="absolute -inset-12 rounded-full pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(212, 175, 55, 0.25) 0%, rgba(212, 175, 55, 0.08) 40%, transparent 70%)',
                      filter: 'blur(20px)',
                      animation: 'masterpiece-outer-glow 4s ease-in-out infinite',
                    }}
                  />
                )}
                
                {/* Inner intense glow */}
                {showRevealAnimation && (
                  <div 
                    className="absolute -inset-6 rounded-3xl pointer-events-none"
                    style={{
                      background: 'radial-gradient(circle, rgba(212, 175, 55, 0.5) 0%, rgba(212, 175, 55, 0.2) 40%, transparent 70%)',
                      filter: 'blur(12px)',
                      animation: 'masterpiece-inner-glow 3s ease-in-out infinite',
                      animationDelay: '0.5s',
                    }}
                  />
                )}
                
                {/* Floating sparkle particles - Layer 1: Tiny distant stars */}
                {showRevealAnimation && (
                  <div className="absolute -inset-16 pointer-events-none overflow-visible">
                    {[...Array(40)].map((_, i) => (
                      <div
                        key={`tiny-${i}`}
                        className="absolute"
                        style={{
                          left: `${-10 + Math.random() * 120}%`,
                          top: `${-10 + Math.random() * 120}%`,
                          animation: `masterpiece-sparkle-float ${4 + Math.random() * 3}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 4}s`,
                        }}
                      >
                        <div 
                          className="rounded-full"
                          style={{
                            width: '2px',
                            height: '2px',
                            backgroundColor: '#F5E6C8',
                            boxShadow: '0 0 4px 2px rgba(212, 175, 55, 0.8)',
                            animation: `masterpiece-twinkle ${1.5 + Math.random()}s ease-in-out infinite`,
                            animationDelay: `${Math.random()}s`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Floating sparkle particles - Layer 2: Medium golden orbs */}
                {showRevealAnimation && (
                  <div className="absolute -inset-12 pointer-events-none overflow-visible">
                    {[...Array(25)].map((_, i) => (
                      <div
                        key={`medium-${i}`}
                        className="absolute"
                        style={{
                          left: `${-5 + Math.random() * 110}%`,
                          top: `${-5 + Math.random() * 110}%`,
                          animation: `masterpiece-sparkle-float ${5 + Math.random() * 3}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 3}s`,
                        }}
                      >
                        <div 
                          className="rounded-full"
                          style={{
                            width: '4px',
                            height: '4px',
                            backgroundColor: '#D4AF37',
                            boxShadow: '0 0 8px 4px rgba(212, 175, 55, 0.9), 0 0 20px 8px rgba(212, 175, 55, 0.4)',
                            animation: `masterpiece-twinkle ${2 + Math.random() * 1.5}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 1.5}s`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Floating sparkle particles - Layer 3: Large brilliant stars */}
                {showRevealAnimation && (
                  <div className="absolute -inset-10 pointer-events-none overflow-visible">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={`large-${i}`}
                        className="absolute"
                        style={{
                          left: `${5 + Math.random() * 90}%`,
                          top: `${5 + Math.random() * 90}%`,
                          animation: `masterpiece-sparkle-drift ${6 + Math.random() * 4}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 4}s`,
                        }}
                      >
                        <div 
                          className="rounded-full"
                          style={{
                            width: '6px',
                            height: '6px',
                            backgroundColor: '#FFF8E8',
                            boxShadow: '0 0 12px 6px rgba(255, 248, 232, 1), 0 0 30px 12px rgba(212, 175, 55, 0.6)',
                            animation: `masterpiece-twinkle-bright ${2.5 + Math.random()}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 2}s`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {/* 4-pointed twinkling stars - gentle sway */}
                {showRevealAnimation && (
                  <div className="absolute -inset-14 pointer-events-none overflow-visible">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={`star-${i}`}
                        className="absolute"
                        style={{
                          left: `${Math.random() * 100}%`,
                          top: `${Math.random() * 100}%`,
                          animation: `masterpiece-star-sway ${6 + Math.random() * 4}s ease-in-out infinite`,
                          animationDelay: `${Math.random() * 3}s`,
                        }}
                      >
                        <svg 
                          width="14" 
                          height="14" 
                          viewBox="0 0 24 24" 
                          fill="none"
                          style={{
                            filter: 'drop-shadow(0 0 6px rgba(212, 175, 55, 0.9))',
                            animation: `masterpiece-twinkle ${4 + Math.random() * 3}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 2}s`,
                          }}
                        >
                          <path 
                            d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" 
                            fill="#D4AF37"
                          />
                        </svg>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Corner sparkle bursts - enhanced */}
                {showRevealAnimation && (
                  <>
                    <div className="absolute -top-3 -left-3 w-6 h-6">
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite' }} />
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.5s' }} />
                      <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#D4AF37', boxShadow: '0 0 15px 6px rgba(212, 175, 55, 0.9)' }} />
                    </div>
                    <div className="absolute -top-3 -right-3 w-6 h-6">
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.3s' }} />
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.8s' }} />
                      <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#D4AF37', boxShadow: '0 0 15px 6px rgba(212, 175, 55, 0.9)' }} />
                    </div>
                    <div className="absolute -bottom-3 -left-3 w-6 h-6">
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.6s' }} />
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '1.1s' }} />
                      <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#D4AF37', boxShadow: '0 0 15px 6px rgba(212, 175, 55, 0.9)' }} />
                    </div>
                    <div className="absolute -bottom-3 -right-3 w-6 h-6">
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.9s' }} />
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(212, 175, 55, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '1.4s' }} />
                      <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#D4AF37', boxShadow: '0 0 15px 6px rgba(212, 175, 55, 0.9)' }} />
                    </div>
                  </>
                )}
                
                <div 
                  className="relative rounded-2xl overflow-hidden shadow-2xl"
                  style={{ 
                    border: '3px solid rgba(212, 175, 55, 0.5)',
                    boxShadow: showRevealAnimation 
                      ? '0 25px 50px rgba(0,0,0,0.2), 0 0 100px rgba(212, 175, 55, 0.4), 0 0 150px rgba(212, 175, 55, 0.2)'
                      : '0 20px 40px rgba(0,0,0,0.15), 0 0 60px rgba(212, 175, 55, 0.1)',
                    animation: showRevealAnimation ? 'masterpiece-container-reveal 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : 'none',
                    transition: 'box-shadow 1.5s ease-out',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={canvasImageUrl || result.previewUrl}
                    alt={`${petName}'s memorial portrait`}
                    className="w-full h-auto block"
                    style={{
                      animation: showRevealAnimation ? 'masterpiece-image-fade-in 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : 'none',
                      opacity: showRevealAnimation ? 0 : 1,
                    }}
                  />
                  
                  {/* Golden veil fade */}
                  {showRevealAnimation && (
                    <div 
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'linear-gradient(180deg, rgba(212, 175, 55, 0.3) 0%, transparent 50%, rgba(212, 175, 55, 0.2) 100%)',
                        animation: 'masterpiece-veil-fade 2.5s ease-out forwards',
                      }}
                    />
                  )}
                  
                  {/* Shimmer sweeps */}
                  {showRevealAnimation && (
                    <>
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.2) 48%, rgba(255, 255, 255, 0.3) 50%, rgba(255, 255, 255, 0.2) 52%, transparent 70%)',
                          animation: 'masterpiece-shimmer 4s ease-in-out infinite',
                        }}
                      />
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: 'linear-gradient(75deg, transparent 35%, rgba(212, 175, 55, 0.12) 50%, transparent 65%)',
                          animation: 'masterpiece-shimmer 5s ease-in-out infinite',
                          animationDelay: '2s',
                        }}
                      />
                    </>
                  )}
                  
                  {/* Sparkle overlay inside image */}
                  {showRevealAnimation && (
                    <div className="absolute inset-0 pointer-events-none">
                      {[...Array(15)].map((_, i) => (
                        <div
                          key={`inner-sparkle-${i}`}
                          className="absolute rounded-full"
                          style={{
                            width: '3px',
                            height: '3px',
                            backgroundColor: '#FFF',
                            left: `${10 + Math.random() * 80}%`,
                            top: `${10 + Math.random() * 80}%`,
                            boxShadow: '0 0 6px 3px rgba(255, 255, 255, 0.8)',
                            animation: `masterpiece-inner-sparkle ${2 + Math.random() * 2}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 3}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Hidden canvas for rendering */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Urgency Timer */}
            <div 
              className="flex items-center justify-center gap-2 mb-5 py-2 px-4 rounded-full mx-auto w-fit"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}
            >
              <span className="text-xs" style={{ color: '#DC2626' }}>⏰ Special price expires in</span>
              <span className="font-mono font-bold text-sm" style={{ color: '#DC2626' }}>{timeRemaining}</span>
            </div>

            {/* Feature List - Clear & Premium */}
            <div 
              className="grid grid-cols-3 gap-2 mb-5 p-3 rounded-xl"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.06)', border: '1px solid rgba(212, 175, 55, 0.12)' }}
            >
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-xs font-medium" style={{ color: '#4A4A4A' }}>4K Quality</p>
                <p className="text-[10px]" style={{ color: '#9B8AA0' }}>Print-ready</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-medium" style={{ color: '#4A4A4A' }}>No Watermark</p>
                <p className="text-[10px]" style={{ color: '#9B8AA0' }}>Clean image</p>
              </div>
              <div className="text-center">
                <div className="w-8 h-8 mx-auto mb-1 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                  <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <p className="text-xs font-medium" style={{ color: '#4A4A4A' }}>Instant Download</p>
                <p className="text-[10px]" style={{ color: '#9B8AA0' }}>Delivered now</p>
              </div>
            </div>

            {/* Large Emotional CTA */}
            <button 
              onClick={handlePurchaseClick}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.02] shadow-xl mb-3"
              style={{ 
                background: 'linear-gradient(135deg, #E6C866 0%, #D4AF37 50%, #C9A227 100%)',
                color: '#FFFFFF',
                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.35)',
              }}
            >
              Keep {petName}&apos;s Memory — $19.99
            </button>

            {/* Money-Back Guarantee Badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs" style={{ color: '#9B8AA0' }}>30-Day Money-Back Guarantee • Secure Checkout</span>
            </div>

            {/* Testimonials - Fully Visible */}
            <div 
              className="p-3 rounded-xl mb-4"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.03)', border: '1px solid rgba(212, 175, 55, 0.08)' }}
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
                  <p className="text-xs" style={{ color: '#6B6B6B' }}><span className="italic">&ldquo;A beautiful tribute&rdquo;</span> <span style={{ color: '#9B8AA0' }}>— Michelle K.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#6B6B6B' }}><span className="italic">&ldquo;Brought tears to my eyes&rdquo;</span> <span style={{ color: '#9B8AA0' }}>— David R.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#6B6B6B' }}><span className="italic">&ldquo;Forever in our hearts&rdquo;</span> <span style={{ color: '#9B8AA0' }}>— Lisa M.</span></p>
                </div>
              </div>
            </div>

            {error && (
              <div 
                className="mb-4 p-3 rounded-xl text-center text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#DC2626'
                }}
              >
                {error}
              </div>
            )}

            {/* Retry/More Options Section */}
            <div className="pt-4 border-t" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
              {(() => {
                const limits = getLimits();
                const check = canGenerate(limits);
                const hasFreeRetry = limits.freeRetriesUsed < 1;
                const canRetry = check.allowed && hasFreeRetry;
                
                if (canRetry) {
                  return (
                    <button 
                      onClick={handleRetry}
                      className="w-full text-center text-sm py-2 transition-colors hover:opacity-80"
                      style={{ color: '#9B8AA0' }}
                    >
                      🔄 Not quite right? Try again (1 free retry)
                    </button>
                  );
                } else {
                  return (
                    <div className="text-center">
                      <p className="text-xs mb-3" style={{ color: '#9B8AA0' }}>
                        Want to create more memorial portraits?
                      </p>
                      <a
                        href="/pack-checkout"
                        className="inline-block px-4 py-2 rounded-lg font-medium text-xs transition-all hover:scale-105"
                        style={{ 
                          backgroundColor: 'rgba(212, 175, 55, 0.1)',
                          color: '#D4AF37',
                          textDecoration: 'none',
                          border: '1px solid rgba(212, 175, 55, 0.2)',
                        }}
                      >
                        ✨ Get More Portraits
                      </a>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {/* Email Capture Stage */}
        {stage === "email" && (
          <div className="p-4 sm:p-6 pb-6">
            <div className="text-center mb-4 sm:mb-6">
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
              >
                Almost There
              </h3>
              <p style={{ color: '#6B6B6B' }}>
                {result?.imageId === "pack" 
                  ? "Enter your email to complete your pack purchase"
                  : `Enter your email to receive ${petName}'s memorial`}
              </p>
            </div>

            <div className="max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="your@email.com"
                className="w-full px-4 py-3 rounded-xl text-center text-lg mb-4 outline-none transition-all"
                style={{ 
                  backgroundColor: 'rgba(212, 175, 55, 0.05)',
                  border: emailError ? '2px solid #DC2626' : '2px solid rgba(212, 175, 55, 0.3)',
                  color: '#4A4A4A'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
              />
              
              {emailError && (
                <p className="text-center text-sm mb-4" style={{ color: '#DC2626' }}>
                  {emailError}
                </p>
              )}

              {error && (
                <div 
                  className="mb-4 p-3 rounded-xl text-center text-sm"
                  style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#DC2626'
                  }}
                >
                  {error}
                </div>
              )}

              <button 
                onClick={handleEmailSubmit}
                className="w-full py-4 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02]"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #E6C866 50%, #D4AF37 100%)',
                  color: '#FFFFFF',
                }}
              >
                Continue to Payment
              </button>

              <button 
                onClick={() => setStage("result")}
                className="w-full text-center text-sm py-3 mt-3 transition-colors hover:opacity-80"
                style={{ color: '#9B8AA0' }}
              >
                ← Go back
              </button>
            </div>
          </div>
        )}

        {/* Expired Stage */}
        {stage === "expired" && (
          <div className="p-4 sm:p-6 text-center pb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#DC2626' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h3 
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
            >
              Session Expired
            </h3>
            <p className="mb-6" style={{ color: '#6B6B6B' }}>
              This session has expired. Create a new memorial portrait for {petName}.
            </p>

            <button 
              onClick={handleReset}
              className="px-8 py-4 rounded-xl font-semibold text-lg transition-all hover:scale-105"
              style={{ 
                background: 'linear-gradient(135deg, #D4AF37 0%, #E6C866 50%, #D4AF37 100%)',
                color: '#FFFFFF',
              }}
            >
              Create New Memorial
            </button>
          </div>
        )}

        {/* Checkout Stage */}
        {stage === "checkout" && (
          <div className="p-4 sm:p-6 text-center pb-6">
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)' }}
            >
              <div 
                className="w-8 h-8 rounded-full animate-spin"
                style={{ 
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(212, 175, 55, 0.2)',
                  borderTopColor: '#D4AF37'
                }}
              />
            </div>
            <h3 
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
            >
              Redirecting to Checkout...
            </h3>
            <p style={{ color: '#6B6B6B' }}>
              Taking you to our secure payment page.
            </p>
          </div>
        )}

        {/* Restoring Session Stage */}
        {stage === "restoring" && (
          <div className="p-4 sm:p-6 text-center pb-6">
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)' }}
            >
              <div 
                className="w-8 h-8 rounded-full animate-spin"
                style={{ 
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(212, 175, 55, 0.2)',
                  borderTopColor: '#D4AF37'
                }}
              />
            </div>
            <h3 
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#4A4A4A' }}
            >
              Welcome Back 🌈
            </h3>
            <p style={{ color: '#6B6B6B' }}>
              Restoring your memorial portrait session...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}




