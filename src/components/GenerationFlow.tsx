"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { CONFIG } from "@/lib/config";
import { captureEvent, identifyUser } from "@/lib/posthog";
import { getUTMForAPI } from "@/lib/utm";

type Stage = "preview" | "email-capture" | "generating" | "result" | "checkout" | "email" | "expired" | "restoring";
type Gender = "male" | "female" | null;

interface GenerationFlowProps {
  file: File | null;
  onReset: () => void;
  initialEmail?: string; // Email from URL param for session restore
  initialResult?: GeneratedResult | null; // For viewing last creation
}

interface GeneratedResult {
  imageId: string;
  previewUrl: string;
}

// Victorian-era elegant phrases for generation animation
const VICTORIAN_PHRASES = [
  "Preparing the canvas...",
  "Selecting the finest oils...",
  "The master begins their work...",
  "Capturing noble elegance...",
  "Adding regal flourishes...",
  "Perfecting each brushstroke...",
  "Bestowing royal grandeur...",
  "A masterpiece takes form...",
];

// Retry limit management using localStorage
const STORAGE_KEY = "lumepet_generation_limits";

interface GenerationLimits {
  freeGenerations: number; // Total free generations used (starts at 0)
  freeRetriesUsed: number; // Free retries used (max 1)
  purchases: number; // Number of individual image purchases made
  packPurchases: number; // Number of pack purchases made
  packCredits: number; // Remaining pack generation credits (watermarked)
  bonusGranted: number; // Total bonus generations granted via secret feature (max 13)
  lastReset?: string; // Date of last reset (optional for daily limits)
}

const getLimits = (): GenerationLimits => {
  if (typeof window === "undefined") {
    return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0, bonusGranted: 0 };
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Ensure new fields exist for backward compatibility
      return {
        freeGenerations: parsed.freeGenerations || 0,
        freeRetriesUsed: parsed.freeRetriesUsed || 0,
        purchases: parsed.purchases || 0,
        packPurchases: parsed.packPurchases || 0,
        packCredits: parsed.packCredits || 0,
        bonusGranted: parsed.bonusGranted || 0, // Track total bonus granted
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
  
  // Check if user has pack credits (watermarked generations from $5 pack)
  if (limits.packCredits > 0) {
    return { allowed: true, hasPackCredits: true };
  }
  
  if (totalUsed >= totalAllowed) {
    return {
      allowed: false,
      reason: `You've reached your free generation limit (${freeLimit} free generations). Purchase a pack to unlock more generations!`,
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

const addPurchase = () => {
  const limits = getLimits();
  limits.purchases += 1;
  saveLimits(limits);
  return limits;
};

const addPackPurchase = (credits: number) => {
  const limits = getLimits();
  limits.packPurchases += 1;
  limits.packCredits += credits;
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

// Save pet image to localStorage before checkout (so it can be restored after pack purchase)
const savePendingImage = (imageDataUrl: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("lumepet_pending_image", imageDataUrl);
  }
};

// Get and clear pending image from localStorage
const getPendingImage = (): string | null => {
  if (typeof window === "undefined") return null;
  const image = localStorage.getItem("lumepet_pending_image");
  return image;
};

// Last creation storage key
const LAST_CREATION_KEY = "lumepet_last_creation";

// Import from CreationsModal for saving creations
import { saveCreation } from "./CreationsModal";

interface LastCreation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
}

// Save the last successful creation to localStorage (and also to creations list)
export const saveLastCreation = (imageId: string, previewUrl: string) => {
  if (typeof window !== "undefined") {
    const lastCreation: LastCreation = {
      imageId,
      previewUrl,
      timestamp: Date.now(),
    };
    localStorage.setItem(LAST_CREATION_KEY, JSON.stringify(lastCreation));
    // Also save to the creations list
    saveCreation(imageId, previewUrl);
  }
};

// Get the last creation from localStorage
export const getLastCreation = (): LastCreation | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(LAST_CREATION_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as LastCreation;
      // Only return if less than 24 hours old (image URLs expire)
      const hoursSinceCreation = (Date.now() - parsed.timestamp) / (1000 * 60 * 60);
      if (hoursSinceCreation < 24) {
        return parsed;
      }
      // Clear expired creation
      localStorage.removeItem(LAST_CREATION_KEY);
    }
  } catch {
    return null;
  }
  return null;
};

// Check if there's a viewable last creation
export const hasLastCreation = (): boolean => {
  return getLastCreation() !== null;
};

const clearPendingImage = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("lumepet_pending_image");
  }
};

export default function GenerationFlow({ file, onReset, initialEmail, initialResult }: GenerationFlowProps) {
  const [stage, setStage] = useState<Stage>(initialResult ? "result" : "preview");
  const [result, setResult] = useState<GeneratedResult | null>(initialResult || null);
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
  const [generationLimits, setGenerationLimits] = useState<GenerationLimits>(getLimits());
  const [limitCheck, setLimitCheck] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [secretActivated, setSecretActivated] = useState(false);
  const [useSecretCredit, setUseSecretCredit] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStartTime, setGenerationStartTime] = useState<number | null>(null);
  const [showPackPurchaseSuccess, setShowPackPurchaseSuccess] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null); // Supabase URL for session
  const [sessionRestored, setSessionRestored] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // For closing animation
  const [shareConsent, setShareConsent] = useState<"yes" | "no" | null>(null); // Social media sharing consent
  const shareConsentRef = useRef<"yes" | "no" | null>(null); // Ref to track current consent value
  const [isFullscreen, setIsFullscreen] = useState(false); // Fullscreen portrait view
  const [shareBoxDissolving, setShareBoxDissolving] = useState(false); // Dissolve animation state
  const [shareBoxHidden, setShareBoxHidden] = useState(false); // Hide after animation
  const [showRevealAnimation, setShowRevealAnimation] = useState(false); // Portrait reveal animation
  const [detectedPetCount, setDetectedPetCount] = useState<number>(1); // Backend will tell us if 2 pets detected

  // Session restoration - check for email in URL and restore previous session
  useEffect(() => {
    if (initialEmail && !sessionRestored) {
      setStage("restoring");
      
      fetch(`/api/lume-leads/session?email=${encodeURIComponent(initialEmail)}`)
        .then(res => res.json())
        .then(data => {
          if (data.hasSession && data.session) {
            const session = data.session;
            console.log("🔄 Restoring session for:", initialEmail, session);
            
            // Restore email - already have it from email link
            setEmail(initialEmail);
            
            // Restore gender
            if (session.gender) {
              setGender(session.gender as Gender);
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
              });
              // Set expiration for 15 minutes from now
              setExpirationTime(Date.now() + 15 * 60 * 1000);
              setStage("result");
              
              captureEvent("session_restored_with_result", {
                email: initialEmail,
                has_preview: true,
              });
            } else if (session.uploadedImageUrl) {
              // Just has uploaded image, go to preview stage
              setStage("preview");
              
              captureEvent("session_restored_preview_only", {
                email: initialEmail,
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

  // Handle initialResult - set result, stage, and expiration time when viewing last creation
  useEffect(() => {
    if (initialResult) {
      // Set the result and stage when initialResult is provided
      setResult(initialResult);
      setStage("result");
      
      // Set expiration for 15 minutes from now when viewing last creation
      if (!expirationTime) {
        setExpirationTime(Date.now() + 15 * 60 * 1000);
        captureEvent("viewed_last_creation", {
          image_id: initialResult.imageId,
        });
      }
    }
  }, [initialResult, expirationTime]);

  // Set preview URL when file is provided - use base64 data URL for PostHog capture
  useEffect(() => {
    if (file && !previewUrl) {
      // Convert file to base64 data URL for PostHog session replay capture
      // Blob URLs don't persist in session replays
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Url = reader.result as string;
        setPreviewUrl(base64Url);
        
        // Capture image upload event with thumbnail for PostHog
        captureEvent("image_uploaded_for_generation", {
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        });
      };
      reader.onerror = () => {
        // Fallback to blob URL if base64 conversion fails
        console.warn("Base64 conversion failed, using blob URL");
        setPreviewUrl(URL.createObjectURL(file));
      };
      reader.readAsDataURL(file);
      
      // Upload pet photo to Supabase immediately and track URL for session
      const uploadFormData = new FormData();
      uploadFormData.append("image", file);
      uploadFormData.append("source", "lumepet");
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

  // Check generation limits on mount and when file changes
  useEffect(() => {
    const limits = getLimits();
    setGenerationLimits(limits);
    const check = canGenerate(limits);
    setLimitCheck(check);
    
    // Check if user has used their free retry
    setRetryUsed(limits.freeRetriesUsed >= 1);
  }, [file]);

  // Check if returning from pack purchase (restored=true in URL)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("restored") === "true") {
        // Show success message
        setShowPackPurchaseSuccess(true);
        // Clean up URL
        window.history.replaceState({}, "", window.location.pathname);
        // Hide success message after 5 seconds
        setTimeout(() => setShowPackPurchaseSuccess(false), 5000);
        // Refresh limits to show new credits
        const limits = getLimits();
        setGenerationLimits(limits);
        setLimitCheck(canGenerate(limits));
      }
    }
  }, []);

  // Phrase cycling animation during generation - slow and elegant
  useEffect(() => {
    if (stage !== "generating") return;

    const cycleInterval = setInterval(() => {
      setPhraseVisible(false);
      // Longer fade out, then switch phrase, then fade in
      setTimeout(() => {
        setCurrentPhrase((prev) => (prev + 1) % VICTORIAN_PHRASES.length);
        setPhraseVisible(true);
      }, 1000); // 1 second to fade out before switching
    }, 5000); // 5 seconds per phrase

    return () => clearInterval(cycleInterval);
  }, [stage]);

  // Progress bar tracking - based on actual elapsed time (assumes ~50 second average)
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

  // Compress image before upload to avoid Vercel 413 errors
  const compressImage = async (file: File, maxSizeMB: number = 3.5): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions (max 2000px on longest side)
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
          
          // Convert to blob with compression
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file); // Fallback to original
              }
            },
            'image/jpeg',
            0.85 // 85% quality
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
        style: "royal",
        gender: gender,
        uploadedImageUrl: uploadedImageUrl,
        source: "pre-generate",
      };
      
      console.log("💾 Saving lead before generation:", { email, context: sessionContext });
      
      await fetch("/api/lume-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: sessionContext }),
      });
      
      // Identify user in PostHog for tracking
      identifyUser(email, { email });
      
      captureEvent("email_captured_pre_generate", {
        gender: gender || "not_selected",
      });
    } catch (err) {
      console.warn("Failed to save lead (non-critical):", err);
    }
    
    // Now proceed with actual generation
    doGenerate(false);
  };

  const handleGenerate = async (isRetry: boolean = false) => {
    if (!file) return;
    
    // Check limits before generating
    const limits = getLimits();
    const check = canGenerate(limits);
    if (!check.allowed) {
      setError(check.reason || "Generation limit reached. Please purchase an image to unlock more generations.");
      setStage("preview");
      return;
    }
    
    // Proceed directly to generation (email captured during purchase flow, not before)
    doGenerate(isRetry);
  };

  const doGenerate = async (isRetry: boolean = false) => {
    if (!file) return;
    
    // Get limits at the start for tracking
    const currentLimitsForTracking = getLimits();
    
    setStage("generating");
    setError(null);
    setCurrentPhrase(0);
    setPhraseVisible(true);
    setGenerationProgress(0);
    setGenerationStartTime(Date.now());

    // Track generation started
    captureEvent("generation_started", {
      is_retry: isRetry,
      has_pack_credits: currentLimitsForTracking.packCredits > 0,
      gender: gender || "not_selected",
    });

    try {
      // Compress image if it's too large (over 3.5MB)
      let fileToUpload = file;
      if (file.size > 3.5 * 1024 * 1024) {
        console.log(`Compressing image from ${(file.size / 1024 / 1024).toFixed(2)}MB...`);
        fileToUpload = await compressImage(file, 3.5);
        console.log(`Compressed to ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
      }
      
      const formData = new FormData();
      formData.append("image", fileToUpload);
      if (gender) {
        formData.append("gender", gender);
      }
      
      // Check if user has pack credits (watermarked generation from $5 pack)
      const limits = getLimits();
      if (limits.packCredits > 0) {
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

      // Handle 413 Payload Too Large error specifically
      if (response.status === 413) {
        throw new Error("Image file is too large. Please use an image smaller than 4MB, or try compressing it first.");
      }

      const data = await response.json();

      if (!response.ok) {
        // Log detailed error for debugging
        console.error("Generation API error:", {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          fullData: data,
        });
        throw new Error(data.error || `Failed to generate portrait (${response.status})`);
      }

      setResult(data);
      
      // Save as last creation for "View Last Creation" button
      if (data.imageId && data.previewUrl) {
        saveLastCreation(data.imageId, data.previewUrl);
      }
      
      // Handle pack credit usage or increment generation count
      const currentLimits = getLimits();
      const usedPackCredit = currentLimits.packCredits > 0;
      const usedSecretCredit = useSecretCredit;
      
      if (usedPackCredit) {
        // Use pack credit (watermarked from $5 pack)
        const updatedLimits = usePackCredit();
        setGenerationLimits(updatedLimits);
      } else if (usedSecretCredit) {
        // Secret credit used - increment generation count but don't use pack credit
        const updatedLimits = incrementGeneration(isRetry);
        setGenerationLimits(updatedLimits);
        setUseSecretCredit(false); // Reset secret credit flag after use
      } else {
        // Increment generation count (mark as retry if applicable)
        const updatedLimits = incrementGeneration(isRetry);
        setGenerationLimits(updatedLimits);
      }
      const newCheck = canGenerate(getLimits());
      setLimitCheck(newCheck);
      
      // Track generation completed
      captureEvent("generation_completed", {
        image_id: data.imageId,
        is_retry: isRetry,
        used_pack_credit: usedPackCredit,
        used_secret_credit: usedSecretCredit,
        gender: gender || "not_selected",
      });
      
      // Update session with generated result (for email follow-ups)
      if (email) {
        try {
          const updatedContext = {
            style: "royal",
            gender: gender,
            uploadedImageUrl: uploadedImageUrl,
            imageId: data.imageId,
            previewUrl: data.previewUrl,
            source: "generated",
          };
          
          await fetch("/api/lume-leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, context: updatedContext }),
          });
          console.log("💾 Updated session with generated result");
        } catch (err) {
          console.warn("Failed to update session with result (non-critical):", err);
        }
      }
      
      // Set 15-minute expiration timer
      setExpirationTime(Date.now() + 15 * 60 * 1000);
      setGenerationProgress(100); // Complete the progress bar
      
      // Update share consent on the image (user may have clicked during generation)
      // Use ref to get the CURRENT value since state may be stale in this closure
      try {
        const consentValue = shareConsentRef.current; // Use ref for current value
        console.log(`📸 Share consent check: ${consentValue || "not answered"}`);
        
        await fetch("/api/generate/share-consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            imageId: data.imageId, 
            consent: consentValue 
          }),
        });
        console.log(`📸 Share consent API called for ${data.imageId}`);
      } catch (err) {
        console.warn("Failed to update share consent (non-critical):", err);
      }
      
      // Reset secret credit after use - user must click 6 times again to enable
      if (useSecretCredit) {
        setUseSecretCredit(false);
        console.log("🔒 Secret credit used and reset. Must click 6 times again to activate.");
      }
      
      // Save session to localStorage for "Resume" feature
      const sessionData = {
        email: email,
        imageId: data.imageId,
        previewUrl: data.previewUrl,
        timestamp: Date.now(),
        type: 'lumepet',
      };
      localStorage.setItem('lumepet_last_session', JSON.stringify(sessionData));
      console.log("💾 Session saved for resume feature");
      
      setStage("result");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      console.error("Generation error:", err);
      console.error("Error message:", errorMessage);
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
    
    // Check overall generation limit (user gets 3 free generations total)
    const check = canGenerate(limits);
    if (!check.allowed) {
      setError(check.reason || "Generation limit reached.");
      return;
    }
    
    // Check if user still has free generations remaining
    if (limits.freeGenerations >= 3) {
      setError("You've used your 3 free generations. Purchase a pack to unlock more!");
      return;
    }
    
    setResult(null);
    setExpirationTime(null);
    setError(null);
    
    // Call handleGenerate with isRetry flag
    handleGenerate(true);
  };

  const handlePurchaseClick = async () => {
    // Track purchase button clicked
    captureEvent("purchase_button_clicked", {
      image_id: result?.imageId,
      stage: "result",
      has_email: !!email,
    });
    
    if (!result) {
      setError("Something went wrong. Please try again.");
      return;
    }
    
    // Go directly to Stripe checkout - email will be collected by Stripe
    setStage("checkout");
    
    try {
      // Cancel URL returns user to result page
      const cancelUrl = `/`;
      
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: result.imageId,
          email: email || null, // Pass email if we have it, otherwise Stripe collects it
          type: "image",
          cancelUrl,
          utmData: getUTMForAPI(), // Include UTM attribution data
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
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleEmailSubmit = async () => {
    console.log("handleEmailSubmit called, email:", email, "result:", result);
    
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (!result) {
      console.error("No result set - cannot proceed to checkout");
      setEmailError("Something went wrong. Please try again.");
      return;
    }
    
    // Track email submitted
    const isPackPurchase = result.imageId === "pack";
    console.log("isPackPurchase:", isPackPurchase);
    
    captureEvent("email_submitted", {
      is_pack_purchase: isPackPurchase,
      pack_type: isPackPurchase ? "2-pack" : null,
      image_id: isPackPurchase ? null : result.imageId,
    });
    
    // Save session to lume_leads for email sequence and session restore
    try {
      const sessionContext = {
        style: "royal",
        gender: gender,
        uploadedImageUrl: uploadedImageUrl,
        imageId: isPackPurchase ? null : result.imageId,
        previewUrl: isPackPurchase ? null : result.previewUrl,
        source: "checkout",
      };
      
      console.log("💾 Saving session to lume_leads:", { email, context: sessionContext });
      
      await fetch("/api/lume-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: sessionContext }),
      });
    } catch (err) {
      console.warn("Failed to save session (non-critical):", err);
    }
    
    setStage("checkout");

    try {
      // Cancel URL returns user to their portrait via session restore
      const cancelUrl = `/?email=${encodeURIComponent(email)}`;
      
      const requestBody = { 
        imageId: isPackPurchase ? null : result.imageId, 
        email,
        type: isPackPurchase ? "pack" : "image",
        packType: isPackPurchase ? "2-pack" : undefined,
        cancelUrl,
        utmData: getUTMForAPI(), // Include UTM attribution data
      };
      console.log("Calling checkout API with:", requestBody);
      
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log("Checkout API response:", data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      console.log("Redirecting to:", data.checkoutUrl);
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Checkout error:", err);
      setError(err instanceof Error ? err.message : "Failed to redirect to checkout. Please try again.");
      setStage("result");
    }
  };

  const handleReset = () => {
    // Trigger closing animation first
    setIsClosing(true);
    
    setTimeout(() => {
      // If user came from email link, redirect to home page instead of resetting
      if (initialEmail) {
        window.location.href = '/';
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
      setIsClosing(false);
      
      // Refresh limits check (don't reset limits - they persist)
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

  return (
    <div className={`fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto overscroll-contain ${isClosing ? 'pointer-events-none' : ''}`}>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'animate-fade-out' : ''}`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
        onClick={handleReset}
      />
      
      {/* Content - no overflow here, let outer container handle scrolling */}
      <div 
        className={`relative w-full max-w-md sm:max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl my-2 sm:my-4 flex flex-col ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
        style={{ 
          backgroundColor: '#1A1A1A',
          border: '1px solid rgba(197, 165, 114, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(197, 165, 114, 0.1)'
        }}
      >
        {/* Close button */}
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 hover:rotate-90 active:scale-95"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.1)', 
            color: '#B8B2A8',
            boxShadow: '0 0 0 0 rgba(197, 165, 114, 0)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(197, 165, 114, 0.2)';
            e.currentTarget.style.color = '#C5A572';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(197, 165, 114, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#B8B2A8';
            e.currentTarget.style.boxShadow = '0 0 0 0 rgba(197, 165, 114, 0)';
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
              backgroundColor: 'rgba(26, 26, 26, 0.9)',
              border: '1px solid rgba(197, 165, 114, 0.4)',
              color: '#C5A572',
              boxShadow: '0 0 15px rgba(197, 165, 114, 0.2), inset 0 0 10px rgba(197, 165, 114, 0.05)'
            }}
          >
            {/* Gold Glowing Paintbrush Icon */}
            <svg 
              className="w-4 h-4" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              style={{ 
                filter: 'drop-shadow(0 0 3px rgba(197, 165, 114, 0.8))',
                color: '#D4B896'
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
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                Your Royal Subject
              </h3>
              <p className="text-sm" style={{ color: '#B8B2A8' }}>
                Ready to transform your pet into a masterpiece?
              </p>
            </div>

            <div 
              className="relative aspect-square max-w-[200px] sm:max-w-xs mx-auto rounded-xl overflow-hidden shadow-lg mb-4 cursor-pointer"
              style={{ border: '2px solid rgba(197, 165, 114, 0.3)' }}
              onClick={() => {
                const newCount = secretClickCount + 1;
                setSecretClickCount(newCount);
                
                if (newCount >= 6) {
                  // Grant 6 extra free generations (can stack up to 12 TOTAL bonus)
                  const limits = getLimits();
                  const maxBonusTotal = 12; // Maximum TOTAL bonus that can ever be granted
                  const currentBonusGranted = limits.bonusGranted || 0;
                  
                  // Check if user has already received max bonus
                  if (currentBonusGranted >= maxBonusTotal) {
                    console.log("❌ Maximum bonus already granted (12 total). No more bonus available.");
                    setSecretClickCount(0);
                    return;
                  }
                  
                  // Calculate how much bonus we can still grant (up to 6, but limited by remaining capacity)
                  const remainingBonusCapacity = maxBonusTotal - currentBonusGranted;
                  const bonusToGrant = Math.min(6, remainingBonusCapacity);
                  
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
                  const newRemainingCapacity = maxBonusTotal - (limits.bonusGranted || 0);
                  
                  // Show subtle feedback
                  console.log(`🎉 Secret activated! +${bonusToGrant} generations granted. Total bonus used: ${limits.bonusGranted || 0}/${maxBonusTotal}. Remaining capacity: ${newRemainingCapacity}`);
                  
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
                  alt="Your pet"
                  fill
                  className="object-cover"
                  unoptimized
                  data-posthog-unmask="true"
                  style={{ position: 'absolute', top: 0, left: 0 }}
                />
              )}
              {/* Secret click indicator (very subtle) */}
              {secretClickCount > 0 && secretClickCount < 6 && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(197, 165, 114, 0.3)' }}></div>
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
                  color: '#F87171'
                }}
              >
                <p className="font-medium mb-1">Oops!</p>
                <p className="text-sm break-words">{error}</p>
                {/* Debug: Show full error details on mobile */}
                <details className="mt-2 text-left">
                  <summary className="text-xs cursor-pointer opacity-70">Debug Details</summary>
                  <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-auto max-h-40">
                    {JSON.stringify({ error, timestamp: new Date().toISOString() }, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {/* Generation Limit Display */}
            {limitCheck && (
              <div className="mb-3 p-2 rounded-xl text-center text-sm" style={{ 
                backgroundColor: limitCheck.allowed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${limitCheck.allowed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: limitCheck.allowed ? '#4ADE80' : '#F87171'
              }}>
                {limitCheck.allowed ? (
                  <p>
                    {generationLimits.packCredits > 0 ? (
                      `✨ ${generationLimits.packCredits} watermarked generation${generationLimits.packCredits !== 1 ? 's' : ''} remaining`
                    ) : generationLimits.purchases > 0 ? (
                      `✨ ${3 + (generationLimits.purchases * 2) - generationLimits.freeGenerations} generations remaining`
                    ) : (
                      `✨ ${3 - generationLimits.freeGenerations} free generation${3 - generationLimits.freeGenerations !== 1 ? 's' : ''} remaining`
                    )}
                  </p>
                ) : (
                  <div className="text-center">
                    <p className="mb-4">{limitCheck.reason}</p>
                    <a
                      href="/pack-checkout"
                      className="inline-block px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                      style={{ 
                        backgroundColor: '#C5A572',
                        color: '#1A1A1A',
                        textDecoration: 'none',
                        boxShadow: '0 4px 15px rgba(197, 165, 114, 0.4)',
                      }}
                    >
                      ✨ Unlock More Portraits
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Pack purchase success message */}
            {showPackPurchaseSuccess && (
              <div 
                className="mb-6 p-4 rounded-xl text-center animate-fade-in-up"
                style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                  border: '1px solid rgba(34, 197, 94, 0.3)' 
                }}
              >
                <p className="font-semibold" style={{ color: '#4ADE80' }}>
                  🎉 +2 Generations Added!
                </p>
                <p className="text-sm mt-1" style={{ color: '#B8B2A8' }}>
                  Your pack purchase was successful. You can now generate!
                </p>
              </div>
            )}

            {/* Gender Selection (optional - backend detects if 2 pets and skips gender) */}
            <div className="mb-4">
              <p className="text-center mb-2 text-xs sm:text-sm" style={{ color: '#B8B2A8' }}>
                Select your pet&apos;s gender (optional):
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setGender("male")}
                  disabled={limitCheck ? !limitCheck.allowed : false}
                  className={`px-4 sm:px-5 py-2 rounded-lg font-semibold transition-all text-sm ${
                    gender === "male"
                      ? "scale-105 shadow-lg"
                      : "opacity-70 hover:opacity-100"
                  } ${limitCheck && !limitCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: gender === "male" ? '#C5A572' : 'rgba(197, 165, 114, 0.2)',
                    color: gender === "male" ? '#1A1A1A' : '#C5A572',
                    border: `2px solid ${gender === "male" ? '#C5A572' : 'rgba(197, 165, 114, 0.3)'}`,
                  }}
                >
                  ♂ Male
                </button>
                <button
                  onClick={() => setGender("female")}
                  disabled={limitCheck ? !limitCheck.allowed : false}
                  className={`px-4 sm:px-5 py-2 rounded-lg font-semibold transition-all text-sm ${
                    gender === "female"
                      ? "scale-105 shadow-lg"
                      : "opacity-70 hover:opacity-100"
                  } ${limitCheck && !limitCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    backgroundColor: gender === "female" ? '#C5A572' : 'rgba(197, 165, 114, 0.2)',
                    color: gender === "female" ? '#1A1A1A' : '#C5A572',
                    border: `2px solid ${gender === "female" ? '#C5A572' : 'rgba(197, 165, 114, 0.3)'}`,
                  }}
                >
                  ♀ Female
                </button>
              </div>
            </div>

            {/* Pricing Info */}
            <div className="text-center mb-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(197, 165, 114, 0.1)', border: '1px solid rgba(197, 165, 114, 0.2)' }}>
              <p className="text-sm" style={{ color: '#C5A572', fontWeight: '500' }}>
                Final 4K portrait: $19.99
              </p>
              <p className="text-xs mt-1" style={{ color: '#7A756D' }}>
                Watermarked version – free
              </p>
            </div>

            <div className="text-center">
              <button 
                onClick={() => handleGenerate(false)} 
                disabled={limitCheck ? !limitCheck.allowed : false}
                className={`btn-primary text-lg px-8 py-4 ${limitCheck && !limitCheck.allowed ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                Generate Royal Portrait
              </button>
            </div>
          </div>
        )}

        {/* Email Capture Stage (Before Generation) */}
        {stage === "email-capture" && (
          <div className="p-4 sm:p-6 pb-6 pt-10 sm:pt-12">
            <div className="text-center mb-6">
              <h3 
                className="text-2xl font-semibold mb-3"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                Where Should We Send Your Portrait?
              </h3>
              <p className="text-base" style={{ color: '#B8B2A8' }}>
                Enter your email so we can deliver your masterpiece
              </p>
            </div>

            {/* Preview of uploaded image */}
            {previewUrl && (
              <div 
                className="relative aspect-square max-w-[150px] mx-auto rounded-xl overflow-hidden shadow-lg mb-6"
                style={{ border: '2px solid rgba(197, 165, 114, 0.3)' }}
              >
                <Image
                  src={previewUrl}
                  alt="Your pet"
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
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: emailError ? '2px solid #F87171' : '2px solid rgba(197, 165, 114, 0.3)',
                  color: '#F0EDE8'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handlePreGenerateEmailSubmit()}
                autoFocus
              />
              
              {emailError && (
                <p className="text-center text-sm mb-4" style={{ color: '#F87171' }}>
                  {emailError}
                </p>
              )}

              <button 
                type="button"
                onClick={handlePreGenerateEmailSubmit}
                className="w-full py-4 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                style={{ 
                  backgroundColor: '#C5A572', 
                  color: '#1A1A1A',
                  touchAction: 'manipulation',
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                Generate My Portrait
              </button>

              <button 
                type="button"
                onClick={() => {
                  setStage("preview");
                  setEmailError(null);
                }}
                className="w-full text-center text-sm py-3 mt-3 transition-colors hover:text-[#C5A572]"
                style={{ color: '#7A756D' }}
              >
                ← Go back
              </button>

              <p className="text-center text-xs mt-4" style={{ color: '#5A5650' }}>
                Your portrait will be delivered to this email address
              </p>
            </div>
          </div>
        )}

        {/* Generating Stage - Elegant Loading */}
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
                  filter: 'drop-shadow(0 0 20px rgba(197, 165, 114, 0.5)) drop-shadow(0 0 40px rgba(197, 165, 114, 0.3))'
                }}
                priority
              />
            </div>
            
            {/* Creating your masterpiece title */}
            <h3 
              className="text-xl sm:text-2xl font-semibold mb-3 text-center"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Creating Your Masterpiece
            </h3>
            
            {/* Fading phrase */}
            <div className="h-12 flex items-center justify-center mb-6">
              <p 
                className={`text-base sm:text-lg italic text-center transition-all duration-1000 ease-in-out px-4 ${phraseVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  color: '#C5A572',
                  letterSpacing: '0.05em',
                }}
              >
                {VICTORIAN_PHRASES[currentPhrase]}
              </p>
            </div>

            {/* Progress bar with percentage */}
            <div className="w-full max-w-xs mb-3 px-4">
              <div 
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)' }}
              >
                <div 
                  className="h-full rounded-full transition-all duration-300 ease-out"
                  style={{ 
                    backgroundColor: '#C5A572',
                    width: `${generationProgress}%`,
                    boxShadow: '0 0 10px rgba(197, 165, 114, 0.5)',
                  }}
                />
              </div>
            </div>
            
            {/* Progress percentage */}
            <p className="text-sm font-medium" style={{ color: '#C5A572' }}>
              {Math.round(generationProgress)}%
            </p>
            
            {/* Time estimate */}
            <p className="text-xs mt-4" style={{ color: '#5A5650' }}>
              This could take up to 60 seconds
            </p>
            <p className="text-xs mt-1" style={{ color: '#5A5650' }}>
              Please keep this screen open
            </p>
          </div>
        )}

        {/* Result Stage - Premium Purchase Experience */}
        {stage === "result" && result && (
          <div className="p-4 sm:p-6 pb-6">
            {/* Price Badge - Top */}
            <div className="text-center mb-3 pt-2">
              <span 
                className="inline-block px-4 py-1.5 rounded-full text-lg font-bold"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.15)',
                  border: '1px solid rgba(197, 165, 114, 0.4)',
                  color: '#C5A572',
                }}
              >
                $19.99
              </span>
            </div>

            {/* Celebratory Header - with staggered reveal */}
            <div className="text-center mb-4">
              <p 
                className="text-sm mb-1" 
                style={{ 
                  color: '#C5A572',
                  animation: showRevealAnimation ? 'masterpiece-text-reveal 1.5s ease-out forwards' : 'none',
                  animationDelay: '0.3s',
                  opacity: showRevealAnimation ? 0 : 1,
                }}
              >
                ✨ It&apos;s ready! ✨
              </p>
              <h3 
                className="text-2xl sm:text-3xl font-semibold"
                style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  color: '#F0EDE8',
                  animation: showRevealAnimation ? 'masterpiece-title-reveal 2s ease-out forwards' : 'none',
                  animationDelay: '0.6s',
                  opacity: showRevealAnimation ? 0 : 1,
                  textShadow: showRevealAnimation ? '0 0 30px rgba(197, 165, 114, 0.5)' : 'none',
                }}
              >
                Your Royal Masterpiece
              </h3>
            </div>

            {/* Preview Image - Display Only */}
            <div className="relative max-w-[240px] sm:max-w-[300px] mx-auto mb-4">
              {/* Optimized glow effect - single layer with CSS only */}
              {showRevealAnimation && (
                <div 
                  className="absolute -inset-8 rounded-3xl pointer-events-none gpu-accelerated"
                  style={{
                    background: 'radial-gradient(circle, rgba(197, 165, 114, 0.35) 0%, rgba(197, 165, 114, 0.1) 50%, transparent 70%)',
                    animation: 'smooth-glow 3s ease-in-out infinite',
                    willChange: 'opacity, transform',
                  }}
                />
              )}
              
              {/* Optimized sparkles - fewer particles, GPU accelerated */}
              {showRevealAnimation && (
                <div className="absolute -inset-10 pointer-events-none overflow-visible">
                  {/* Golden sparkles - only 8 */}
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                      key={`sparkle-${i}`}
                      className="absolute rounded-full gpu-accelerated"
                      style={{
                        left: `${10 + (i * 12) % 80}%`,
                        top: `${5 + (i * 17) % 90}%`,
                        width: '4px',
                        height: '4px',
                        backgroundColor: '#C5A572',
                        boxShadow: '0 0 6px 3px rgba(197, 165, 114, 0.8)',
                        animation: `smooth-sparkle 2.5s ease-in-out infinite`,
                        animationDelay: `${i * 0.3}s`,
                        willChange: 'opacity, transform',
                      }}
                    />
                  ))}
                  {/* White accent sparkles - only 4 */}
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={`accent-${i}`}
                      className="absolute rounded-full gpu-accelerated"
                      style={{
                        left: `${20 + (i * 22)}%`,
                        top: `${15 + (i * 25) % 70}%`,
                        width: '3px',
                        height: '3px',
                        backgroundColor: '#FFF8E8',
                        boxShadow: '0 0 8px 4px rgba(255, 248, 232, 0.9)',
                        animation: `smooth-sparkle 3s ease-in-out infinite`,
                        animationDelay: `${0.5 + i * 0.4}s`,
                        willChange: 'opacity, transform',
                      }}
                    />
                  ))}
                </div>
              )}
              
              {/* Corner stars - only 4, one per corner */}
              {showRevealAnimation && (
                <div className="absolute -inset-6 pointer-events-none">
                  {[
                    { left: '-3%', top: '-3%' },
                    { left: '97%', top: '-3%' },
                    { left: '-3%', top: '97%' },
                    { left: '97%', top: '97%' },
                  ].map((pos, i) => (
                    <svg 
                      key={`star-${i}`}
                      className="absolute gpu-accelerated"
                      width="12" 
                      height="12" 
                      viewBox="0 0 24 24"
                      style={{
                        ...pos,
                        animation: `smooth-star 2.5s ease-in-out infinite`,
                        animationDelay: `${i * 0.5}s`,
                        willChange: 'opacity, transform',
                      }}
                    >
                      <path 
                        d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" 
                        fill="#C5A572"
                      />
                    </svg>
                  ))}
                </div>
              )}
              
              {/* Corner sparkle bursts - enhanced */}
              {showRevealAnimation && (
                <>
                  <div className="absolute -top-3 -left-3 w-6 h-6">
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite' }} />
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.5s' }} />
                    <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#C5A572', boxShadow: '0 0 15px 6px rgba(197, 165, 114, 0.9)' }} />
                  </div>
                  <div className="absolute -top-3 -right-3 w-6 h-6">
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.3s' }} />
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.8s' }} />
                    <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#C5A572', boxShadow: '0 0 15px 6px rgba(197, 165, 114, 0.9)' }} />
                  </div>
                  <div className="absolute -bottom-3 -left-3 w-6 h-6">
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.6s' }} />
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '1.1s' }} />
                    <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#C5A572', boxShadow: '0 0 15px 6px rgba(197, 165, 114, 0.9)' }} />
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-6 h-6">
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.6)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '0.9s' }} />
                    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: 'rgba(197, 165, 114, 0.4)', animation: 'masterpiece-corner-ping 2s ease-out infinite', animationDelay: '1.4s' }} />
                    <div className="absolute inset-1.5 rounded-full" style={{ backgroundColor: '#C5A572', boxShadow: '0 0 15px 6px rgba(197, 165, 114, 0.9)' }} />
                  </div>
                </>
              )}
              
              <div 
                className="relative rounded-2xl overflow-hidden shadow-2xl cursor-pointer group"
                style={{ 
                  border: '3px solid rgba(197, 165, 114, 0.5)',
                  boxShadow: showRevealAnimation 
                    ? '0 25px 50px rgba(0,0,0,0.5), 0 0 100px rgba(197, 165, 114, 0.5), 0 0 150px rgba(197, 165, 114, 0.25)'
                    : '0 20px 40px rgba(0,0,0,0.4), 0 0 60px rgba(197, 165, 114, 0.15)',
                  animation: showRevealAnimation ? 'masterpiece-container-reveal 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : 'none',
                  transition: 'box-shadow 1.5s ease-out',
                }}
                onClick={() => setIsFullscreen(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.previewUrl}
                  alt="Your royal portrait masterpiece"
                  className="w-full h-auto block"
                  style={{
                    animation: showRevealAnimation ? 'masterpiece-image-fade-in 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards' : 'none',
                    opacity: showRevealAnimation ? 0 : 1,
                  }}
                />
                
                {/* Initial reveal veil - golden gradient unveil */}
                {showRevealAnimation && (
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(180deg, rgba(197, 165, 114, 0.4) 0%, transparent 50%, rgba(197, 165, 114, 0.3) 100%)',
                      animation: 'masterpiece-veil-fade 2.5s ease-out forwards',
                    }}
                  />
                )}
                
                {/* Single optimized shimmer sweep */}
                {showRevealAnimation && (
                  <div 
                    className="absolute inset-0 pointer-events-none gpu-accelerated"
                    style={{
                      background: 'linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.15) 48%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.15) 52%, transparent 70%)',
                      animation: 'smooth-shimmer 4s ease-in-out infinite',
                      willChange: 'transform',
                    }}
                  />
                )}
                
                {/* Simplified sparkle overlay - only 6 sparkles */}
                {showRevealAnimation && (
                  <div className="absolute inset-0 pointer-events-none">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={`inner-sparkle-${i}`}
                        className="absolute rounded-full gpu-accelerated"
                        style={{
                          width: '3px',
                          height: '3px',
                          backgroundColor: '#FFF',
                          left: `${15 + (i * 15)}%`,
                          top: `${20 + (i * 12) % 60}%`,
                          boxShadow: '0 0 4px 2px rgba(255, 255, 255, 0.7)',
                          animation: 'smooth-sparkle 2.5s ease-in-out infinite',
                          animationDelay: `${i * 0.4}s`,
                          willChange: 'opacity, transform',
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* Fullscreen button overlay */}
                <div 
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
                >
                  <div 
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)', border: '1px solid rgba(197, 165, 114, 0.3)' }}
                  >
                    <svg className="w-5 h-5" style={{ color: '#C5A572' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                    </svg>
                    <span className="text-sm font-medium" style={{ color: '#F0EDE8' }}>Tap to zoom</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Urgency Timer */}
            <div 
              className="flex items-center justify-center gap-2 mb-5 py-2 px-4 rounded-full mx-auto w-fit"
              style={{ backgroundColor: 'rgba(197, 165, 114, 0.1)', border: '1px solid rgba(197, 165, 114, 0.2)' }}
            >
              <span className="text-xs" style={{ color: '#C5A572' }}>Expires in</span>
              <span className="font-mono font-bold text-sm" style={{ color: '#C5A572' }}>{timeRemaining}</span>
            </div>

            {/* Large Emotional CTA */}
            <button 
              onClick={handlePurchaseClick}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all hover:scale-[1.02] shadow-xl mb-3"
              style={{ 
                background: 'linear-gradient(135deg, #D4B896 0%, #C5A572 50%, #B8956A 100%)',
                color: '#1A1A1A',
                boxShadow: '0 8px 24px rgba(197, 165, 114, 0.4)',
              }}
            >
              Download Now
            </button>

            {/* Money-Back Guarantee Badge */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <svg className="w-4 h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs" style={{ color: '#7A756D' }}>30-Day Money-Back Guarantee • Secure Checkout</span>
            </div>

            {/* Testimonials - Fully Visible */}
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
                  <p className="text-xs" style={{ color: '#B8B2A8' }}><span className="italic">&ldquo;Looks just like him!&rdquo;</span> <span style={{ color: '#5A5650' }}>— Sarah M.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#B8B2A8' }}><span className="italic">&ldquo;My mom cried happy tears!&rdquo;</span> <span style={{ color: '#5A5650' }}>— Jake T.</span></p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(i => (
                      <svg key={i} className="w-3 h-3" style={{ color: '#FBBF24' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: '#B8B2A8' }}><span className="italic">&ldquo;Printed and framed it!&rdquo;</span> <span style={{ color: '#5A5650' }}>— Emily R.</span></p>
                </div>
              </div>
            </div>

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

            {/* Retry/More Options Section */}
            <div className="pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {(() => {
                const limits = getLimits();
                const check = canGenerate(limits);
                const hasRemainingFreeGens = limits.freeGenerations < 3;
                const canRetry = check.allowed && hasRemainingFreeGens;
                
                if (canRetry) {
                  const remaining = 3 - limits.freeGenerations;
                  return (
                    <button 
                      onClick={handleRetry}
                      className="w-full text-center text-sm py-2 transition-colors hover:text-[#C5A572]"
                      style={{ color: '#7A756D' }}
                    >
                      🔄 Not quite right? Try again ({remaining} free remaining)
                    </button>
                  );
                } else {
                  return (
                    <div className="text-center">
                      <p className="text-xs mb-3" style={{ color: '#5A5650' }}>
                        Want to create more portraits?
                      </p>
                      <a
                        href="/pack-checkout"
                        className="inline-block px-4 py-2 rounded-lg font-medium text-xs transition-all hover:scale-105"
                        style={{ 
                          backgroundColor: 'rgba(197, 165, 114, 0.15)',
                          color: '#C5A572',
                          textDecoration: 'none',
                          border: '1px solid rgba(197, 165, 114, 0.3)',
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
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                {result?.imageId === "pack" ? "Get Your 2-Pack!" : "Almost There!"}
              </h3>
              <p style={{ color: '#B8B2A8' }}>
                {result?.imageId === "pack" 
                  ? "Enter your email to complete your $5 pack purchase"
                  : "Enter your email to receive your masterpiece"}
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
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: emailError ? '2px solid #F87171' : '2px solid rgba(197, 165, 114, 0.3)',
                  color: '#F0EDE8'
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
              />
              
              {emailError && (
                <p className="text-center text-sm mb-4" style={{ color: '#F87171' }}>
                  {emailError}
                </p>
              )}

              <button 
                type="button"
                onClick={handleEmailSubmit}
                className="w-full py-4 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02]"
                style={{ 
                  backgroundColor: '#C5A572', 
                  color: '#1A1A1A',
                  touchAction: 'manipulation',
                }}
              >
                {result?.imageId === "pack" ? "Pay $5 - Get 2 Generations" : "Download My Portrait"}
              </button>

              <button 
                type="button"
                onClick={() => {
                  // Go back to appropriate stage
                  if (result?.imageId === "pack") {
                    setStage("preview");
                    setResult(null);
                  } else {
                    setStage("result");
                  }
                }}
                className="w-full text-center text-sm py-3 mt-3 transition-colors hover:text-[#C5A572]"
                style={{ color: '#7A756D' }}
              >
                ← Go back
              </button>
            </div>

            {/* Preview of Generated Portrait */}
            {result?.previewUrl && result?.imageId !== "pack" && (
              <div className="mt-6 pt-6" style={{ borderTop: '1px solid rgba(197, 165, 114, 0.15)' }}>
                <p className="text-center text-sm mb-3" style={{ color: '#7A756D' }}>
                  Your royal portrait awaits
                </p>
                <div className="relative mx-auto" style={{ maxWidth: '280px' }}>
                  {/* Gold frame effect */}
                  <div 
                    className="absolute inset-0 rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, #D4B896 0%, #C5A572 50%, #A68B5B 100%)',
                      padding: '3px',
                      boxShadow: '0 8px 32px rgba(197, 165, 114, 0.3), 0 0 20px rgba(197, 165, 114, 0.15)',
                    }}
                  />
                  <div 
                    className="relative rounded-xl overflow-hidden"
                    style={{ 
                      border: '3px solid transparent',
                      background: 'linear-gradient(#1A1816, #1A1816) padding-box, linear-gradient(135deg, #D4B896, #C5A572, #A68B5B) border-box',
                    }}
                  >
                    <img 
                      src={result.previewUrl} 
                      alt="Your royal pet portrait"
                      className="w-full h-auto"
                      style={{ 
                        filter: 'blur(3px)',
                        opacity: 0.85,
                      }}
                    />
                    {/* Watermark overlay */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.2)' }}
                    >
                      <div className="text-center">
                        <svg className="w-8 h-8 mx-auto mb-1" style={{ color: '#C5A572' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-xs font-medium" style={{ color: '#C5A572' }}>
                          Unlock 4K Version
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-center text-xs mt-3" style={{ color: '#5A5650' }}>
                  Purchase to receive your unwatermarked 4K portrait
                </p>
              </div>
            )}
          </div>
        )}

        {/* Expired Stage */}
        {stage === "expired" && (
          <div className="p-4 sm:p-6 text-center pb-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <svg className="w-8 h-8" style={{ color: '#F87171' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h3 
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Offer Expired
            </h3>
            <p className="mb-6" style={{ color: '#B8B2A8' }}>
              This masterpiece has expired. Generate a new portrait to continue.
            </p>

            <button 
              onClick={handleReset}
              className="btn-primary text-lg px-8 py-4"
            >
              Generate New Portrait
            </button>
          </div>
        )}

        {/* Checkout Stage */}
        {stage === "checkout" && (
          <div className="p-4 sm:p-6 text-center pb-6">
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(197, 165, 114, 0.1)' }}
            >
              <div 
                className="w-8 h-8 rounded-full animate-spin"
                style={{ 
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(197, 165, 114, 0.2)',
                  borderTopColor: '#C5A572'
                }}
              />
            </div>
            <h3 
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Redirecting to Checkout...
            </h3>
            <p style={{ color: '#B8B2A8' }}>
              Taking you to our secure payment page.
            </p>
          </div>
        )}

        {/* Restoring Session Stage */}
        {stage === "restoring" && (
          <div className="p-4 sm:p-6 text-center pb-6">
            <div 
              className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(197, 165, 114, 0.1)' }}
            >
              <div 
                className="w-8 h-8 rounded-full animate-spin"
                style={{ 
                  borderWidth: '3px',
                  borderStyle: 'solid',
                  borderColor: 'rgba(197, 165, 114, 0.2)',
                  borderTopColor: '#C5A572'
                }}
              />
            </div>
            <h3 
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              Welcome Back!
            </h3>
            <p style={{ color: '#B8B2A8' }}>
              Restoring your portrait session...
            </p>
          </div>
        )}
      </div>

      {/* Fullscreen Portrait Overlay */}
      {isFullscreen && result && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          onClick={() => setIsFullscreen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 z-10 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.1)', 
              color: '#F0EDE8',
            }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Back button */}
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 left-4 z-10 flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 hover:scale-105"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.1)', 
              color: '#F0EDE8',
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Fullscreen Image */}
          <div 
            className="relative max-w-[90vw] max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={result.previewUrl}
              alt="Your royal portrait masterpiece - fullscreen"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              style={{ 
                border: '2px solid rgba(197, 165, 114, 0.3)',
              }}
            />
          </div>

          {/* Hint text */}
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs" style={{ color: '#7A756D' }}>
            Tap anywhere or press Back to close
          </p>
        </div>
      )}
    </div>
  );
}

