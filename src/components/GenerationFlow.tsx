"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { CONFIG } from "@/lib/config";
import { captureEvent } from "@/lib/posthog";

type Stage = "preview" | "email-capture" | "generating" | "result" | "checkout" | "email" | "expired" | "restoring";
type Gender = "male" | "female" | null;

interface GenerationFlowProps {
  file: File | null;
  onReset: () => void;
  initialEmail?: string; // Email from URL param for session restore
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
  lastReset?: string; // Date of last reset (optional for daily limits)
}

const getLimits = (): GenerationLimits => {
  if (typeof window === "undefined") {
    return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0 };
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
        lastReset: parsed.lastReset,
      };
    } catch {
      return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0 };
    }
  }
  return { freeGenerations: 0, freeRetriesUsed: 0, purchases: 0, packPurchases: 0, packCredits: 0 };
};

const saveLimits = (limits: GenerationLimits) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  }
};

const canGenerate = (limits: GenerationLimits): { allowed: boolean; reason?: string; hasPackCredits?: boolean } => {
  // Free tier: 1 initial generation + 1 free retry = 2 total free
  const freeLimit = 2;
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

const clearPendingImage = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("lumepet_pending_image");
  }
};

export default function GenerationFlow({ file, onReset, initialEmail }: GenerationFlowProps) {
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
  const [generationLimits, setGenerationLimits] = useState<GenerationLimits>(getLimits());
  const [limitCheck, setLimitCheck] = useState<{ allowed: boolean; reason?: string } | null>(null);
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [secretActivated, setSecretActivated] = useState(false);
  const [useSecretCredit, setUseSecretCredit] = useState(false);
  const [showPackPurchaseSuccess, setShowPackPurchaseSuccess] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null); // Supabase URL for session
  const [sessionRestored, setSessionRestored] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // For closing animation

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
    
    // If email not captured yet, go to email capture stage first (skip for retries)
    if (!email && !isRetry) {
      setStage("email-capture");
      setEmailError(null);
      return;
    }
    
    // Proceed with generation
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
      setStage("result");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      console.error("Generation error:", err);
      console.error("Error message:", errorMessage);
      setError(errorMessage);
      setStage("preview");
    }
  };

  const handleRetry = () => {
    const limits = getLimits();
    
    // Check overall generation limit (user gets 2 free generations total)
    const check = canGenerate(limits);
    if (!check.allowed) {
      setError(check.reason || "Generation limit reached.");
      return;
    }
    
    // Check if user still has free generations remaining
    if (limits.freeGenerations >= 2) {
      setError("You've used your 2 free generations. Purchase a pack to unlock more!");
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
    
    // If email is already set (from session restore), skip to checkout directly
    if (email && validateEmail(email) && result) {
      console.log("📧 Email already set from session, going directly to checkout");
      setStage("checkout");
      
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: result.imageId,
            email: email,
            type: "image",
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
      const requestBody = { 
        imageId: isPackPurchase ? null : result.imageId, 
        email,
        type: isPackPurchase ? "pack" : "image",
        packType: isPackPurchase ? "2-pack" : undefined,
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
    <div className={`fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto ${isClosing ? 'pointer-events-none' : ''}`}>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'animate-fade-out' : ''}`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      />
      
      {/* Content */}
      <div 
        className={`relative w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl my-2 sm:my-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
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

        {/* Portrait Counter - Top left - Always visible */}
        {stage !== "checkout" && stage !== "restoring" && (
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
                : `${Math.max(0, 2 - generationLimits.freeGenerations)} free`
              }
            </span>
          </div>
        )}

        {/* Preview Stage */}
        {stage === "preview" && (
          <div className="p-4 sm:p-6 pb-12">
            <div className="text-center mb-6">
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                Your Royal Subject
              </h3>
              <p style={{ color: '#B8B2A8' }}>
                Ready to transform your pet into a royal masterpiece?
              </p>
            </div>

            <div 
              className="relative aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden shadow-lg mb-6 cursor-pointer"
              style={{ border: '2px solid rgba(197, 165, 114, 0.3)' }}
              onClick={() => {
                if (secretActivated) return; // Already activated
                const newCount = secretClickCount + 1;
                setSecretClickCount(newCount);
                
                if (newCount >= 6) {
                  // Grant extra free generation
                  const limits = getLimits();
                  limits.freeGenerations = Math.max(0, limits.freeGenerations - 1); // Reduce used count by 1
                  saveLimits(limits);
                  setGenerationLimits(limits);
                  const newCheck = canGenerate(limits);
                  setLimitCheck(newCheck);
                  setSecretActivated(true);
                  setUseSecretCredit(true); // Enable un-watermarked generation for testing
                  
                  // Show subtle feedback
                  console.log("🎉 Secret activated! Extra free generation granted (un-watermarked).");
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
              <div className="mb-4 p-3 rounded-xl text-center text-sm" style={{ 
                backgroundColor: limitCheck.allowed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${limitCheck.allowed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: limitCheck.allowed ? '#4ADE80' : '#F87171'
              }}>
                {limitCheck.allowed ? (
                  <p>
                    {generationLimits.packCredits > 0 ? (
                      `✨ ${generationLimits.packCredits} watermarked generation${generationLimits.packCredits !== 1 ? 's' : ''} remaining`
                    ) : generationLimits.purchases > 0 ? (
                      `✨ ${2 + (generationLimits.purchases * 2) - generationLimits.freeGenerations} generations remaining`
                    ) : (
                      `✨ ${2 - generationLimits.freeGenerations} free generation${2 - generationLimits.freeGenerations !== 1 ? 's' : ''} remaining`
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

            {/* Gender Selection */}
            <div className="mb-6">
              <p className="text-center mb-3 text-sm" style={{ color: '#B8B2A8' }}>
                Select your pet&apos;s gender for more accurate results:
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
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${
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
                Final HD portrait: $19.99
              </p>
              <p className="text-xs mt-1" style={{ color: '#7A756D' }}>
                Watermarked version – free
              </p>
            </div>

            <div className="text-center">
              <button 
                onClick={() => handleGenerate(false)} 
                disabled={!gender || (limitCheck ? !limitCheck.allowed : false)}
                className={`btn-primary text-lg px-8 py-4 ${!gender || (limitCheck && !limitCheck.allowed) ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          <div className="p-4 sm:p-6 pb-6">
            <div className="text-center mb-6">
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                One Quick Step
              </h3>
              <p style={{ color: '#B8B2A8' }}>
                Enter your email to create your royal portrait
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
                We&apos;ll save your portrait so you can access it anytime
              </p>
            </div>
          </div>
        )}

        {/* Generating Stage - Elegant Victorian Animation */}
        {stage === "generating" && (
          <div className="p-6 sm:p-8 flex flex-col items-center justify-center min-h-[320px]">
            {/* Floating LumePet Logo */}
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
            
            {/* Fading phrase */}
            <div className="h-16 flex items-center justify-center mb-6">
              <p 
                className={`text-lg sm:text-xl italic text-center transition-all duration-1000 ease-in-out px-4 ${phraseVisible ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  fontFamily: "'Cormorant Garamond', Georgia, serif", 
                  color: '#C5A572',
                  letterSpacing: '0.05em',
                }}
              >
                {VICTORIAN_PHRASES[currentPhrase]}
              </p>
            </div>

            {/* Minimal progress bar */}
            <div className="w-48 mb-4">
              <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)' }}>
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    backgroundColor: '#C5A572',
                    width: '60%',
                    animation: 'shimmer 2s ease-in-out infinite',
                  }}
                />
              </div>
            </div>

            <p className="text-xs" style={{ color: '#7A756D' }}>
              This may take up to 60 seconds
            </p>
          </div>
        )}

        {/* Result Stage - Purchase Modal */}
        {stage === "result" && result && (
          <div className="p-4 sm:p-6 pb-12">
            {/* Title with reveal animation */}
            <h3 
              className="text-2xl sm:text-3xl md:text-4xl font-semibold text-center mb-3 sm:mb-4 opacity-0 animate-text-reveal"
              style={{ 
                fontFamily: "'Cormorant Garamond', Georgia, serif", 
                color: '#F0EDE8', 
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                animationDelay: '0.3s',
                animationFillMode: 'forwards'
              }}
            >
              ✨ Your Masterpiece
            </h3>

            {/* Preview Image - Beautiful reveal animation */}
            <div 
              className="relative max-w-[220px] sm:max-w-sm mx-auto mb-5 sm:mb-6 rounded-2xl overflow-hidden opacity-0 animate-portrait-reveal animate-portrait-glow"
              style={{ 
                animationDelay: '0s',
                animationFillMode: 'forwards'
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.previewUrl}
                alt="Royal portrait preview"
                className="w-full h-auto block"
                style={{
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  pointerEvents: 'none',
                }}
                draggable={false}
              />
            </div>

            {/* Price with staggered reveal */}
            <div 
              className="text-center mb-2 opacity-0 animate-text-reveal"
              style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
            >
              <span className="text-3xl sm:text-4xl font-bold" style={{ color: '#F0EDE8' }}>$19.99</span>
            </div>

            {/* Expiration Timer */}
            <div 
              className="text-center mb-4 sm:mb-5 opacity-0 animate-text-reveal"
              style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
            >
              <span className="text-sm sm:text-base" style={{ color: '#B8B2A8' }}>Expires in </span>
              <span className="font-mono font-bold text-sm sm:text-base" style={{ color: '#F0EDE8' }}>{timeRemaining}</span>
            </div>

            {/* Features list with staggered animation */}
            <div 
              className="flex justify-center gap-4 sm:gap-6 mb-5 sm:mb-6 text-xs sm:text-sm opacity-0 animate-text-reveal"
              style={{ animationDelay: '0.8s', animationFillMode: 'forwards', color: '#B8B2A8' }}
            >
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                No Watermark
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#10B981' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                HD Quality
              </span>
            </div>

            {/* Download button with reveal animation */}
            <button 
              onClick={handlePurchaseClick}
              className="w-full py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all hover:scale-[1.02] shadow-lg opacity-0 animate-button-reveal"
              style={{ 
                backgroundColor: '#C5A572', 
                color: '#1A1A1A',
                animationDelay: '1s',
                animationFillMode: 'forwards'
              }}
            >
              Download Now — $19.99
            </button>

            {error && (
              <div 
                className="mt-4 p-3 rounded-xl text-center text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171'
                }}
              >
                {error}
              </div>
            )}

            {/* Retry button */}
            <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
              {(() => {
                const limits = getLimits();
                const check = canGenerate(limits);
                // User can retry if they still have free generations remaining (less than 2 used)
                const hasRemainingFreeGens = limits.freeGenerations < 2;
                const canRetry = check.allowed && hasRemainingFreeGens;
                
                if (canRetry) {
                  const remaining = 2 - limits.freeGenerations;
                  return (
                    <button 
                      onClick={handleRetry}
                      className="w-full text-center text-sm py-2 transition-colors hover:text-[#C5A572]"
                      style={{ color: '#7A756D' }}
                    >
                      🔄 Try Again ({remaining} free generation{remaining !== 1 ? 's' : ''} remaining)
                    </button>
                  );
                } else {
                  return (
                    <div className="text-center">
                      <p className="text-sm mb-4" style={{ color: '#7A756D' }}>
                        Want to generate more portraits?
                      </p>
                      <a
                        href="/pack-checkout"
                        className="inline-block px-5 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105"
                        style={{ 
                          backgroundColor: '#C5A572',
                          color: '#1A1A1A',
                          textDecoration: 'none',
                        }}
                      >
                        ✨ Unlock More Portraits
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
                {result?.imageId === "pack" ? "Pay $5 - Get 2 Generations" : "Continue to Payment"}
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
    </div>
  );
}

