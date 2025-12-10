"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";

// Password for access (you can change this)
const STUDIO_PASSWORD = "LumePetLover1325519*";

const MAX_QUEUE_SIZE = 10;
const MAX_IMAGE_SIZE = 3 * 1024 * 1024; // 3MB max to stay under Vercel limits
const MAX_DIMENSION = 2048; // Max width/height

// Compress and resize image before upload
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // If file is small enough and is JPEG, use as-is
    if (file.size < MAX_IMAGE_SIZE && file.type === "image/jpeg") {
      resolve(file);
      return;
    }

    const img = document.createElement("img");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      let { width, height } = img;

      // Scale down if too large
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Draw image (this also removes any black bars/letterboxing)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG with compression
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not compress image"));
            return;
          }
          
          const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
            type: "image/jpeg",
          });
          
          console.log(`📸 Compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB`);
          resolve(compressedFile);
        },
        "image/jpeg",
        0.85 // Quality
      );
    };

    img.onerror = () => reject(new Error("Could not load image"));
    img.src = URL.createObjectURL(file);
  });
}

interface QueuedPhoto {
  id: string;
  file: File;
  preview: string;
  petName: string;
  status: "pending" | "generating" | "completed" | "failed";
  error?: string;
}

interface GeneratedImage {
  id: string;
  url: string;
  hdUrl?: string;
  petName: string;
  timestamp: Date;
  hasWatermark: boolean;
  queueId: string;
}

export default function StudioPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Queue state
  const [photoQueue, setPhotoQueue] = useState<QueuedPhoto[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [currentlyProcessing, setCurrentlyProcessing] = useState<string | null>(null);
  
  // Generation settings
  const [enableWatermark, setEnableWatermark] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedGender, setSelectedGender] = useState<"male" | "female" | null>(null);
  
  // Results
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle password submission
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === STUDIO_PASSWORD) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect password");
    }
  };

  // Handle multiple image uploads
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await addFilesToQueue(files);
  }, []);

  // Add files to queue (with compression)
  const addFilesToQueue = async (files: File[]) => {
    const remainingSlots = MAX_QUEUE_SIZE - photoQueue.length;
    const filesToAdd = files.slice(0, remainingSlots);
    
    if (files.length > remainingSlots) {
      setError(`Only ${remainingSlots} slots available. Added first ${remainingSlots} photos.`);
    }
    
    // Compress all files in parallel
    const compressedFiles = await Promise.all(
      filesToAdd.map(async (file) => {
        try {
          return await compressImage(file);
        } catch (e) {
          console.error("Compression failed, using original:", e);
          return file; // Use original if compression fails
        }
      })
    );
    
    const newPhotos: QueuedPhoto[] = compressedFiles.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      petName: "",
      status: "pending" as const,
    }));
    
    setPhotoQueue(prev => [...prev, ...newPhotos]);
  };

  // Handle drag and drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    await addFilesToQueue(files);
  }, [photoQueue.length]);

  // Update pet name for queued photo
  const updatePetName = (id: string, name: string) => {
    setPhotoQueue(prev => prev.map(p => 
      p.id === id ? { ...p, petName: name } : p
    ));
  };

  // Remove photo from queue
  const removeFromQueue = (id: string) => {
    setPhotoQueue(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  // Clear completed from queue
  const clearCompleted = () => {
    setPhotoQueue(prev => {
      prev.filter(p => p.status === "completed" || p.status === "failed").forEach(p => {
        URL.revokeObjectURL(p.preview);
      });
      return prev.filter(p => p.status !== "completed" && p.status !== "failed");
    });
  };

  // Generate single portrait
  const generatePortrait = async (photo: QueuedPhoto): Promise<GeneratedImage | null> => {
    try {
      const formData = new FormData();
      formData.append("image", photo.file);
      formData.append("petName", photo.petName || "Pet");
      formData.append("petType", "dog"); // Auto-detect from vision
      formData.append("style", "royal");
      formData.append("studioMode", "true");
      formData.append("enableWatermark", enableWatermark.toString());
      if (selectedGender) {
        formData.append("gender", selectedGender);
      }
      if (customPrompt.trim()) {
        formData.append("customPrompt", customPrompt.trim());
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        // Handle non-JSON error responses (like Vercel's 403 Forbidden)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Generation failed");
        } else {
          const errorText = await response.text();
          if (response.status === 403) {
            throw new Error("Access blocked - please try refreshing the page and trying again. If this persists, the image may be too large.");
          }
          throw new Error(`Server error (${response.status}): ${errorText.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      
      return {
        id: data.imageId || Date.now().toString(),
        url: data.previewUrl,
        hdUrl: data.hdUrl,
        petName: photo.petName || "Pet",
        timestamp: new Date(),
        hasWatermark: enableWatermark,
        queueId: photo.id,
      };
    } catch (err) {
      console.error("Generation error:", err);
      throw err;
    }
  };

  // Process the entire queue
  const processQueue = async () => {
    const pendingPhotos = photoQueue.filter(p => p.status === "pending");
    if (pendingPhotos.length === 0) return;
    
    setIsProcessingQueue(true);
    setError("");
    
    for (const photo of pendingPhotos) {
      // Update status to generating
      setCurrentlyProcessing(photo.id);
      setPhotoQueue(prev => prev.map(p => 
        p.id === photo.id ? { ...p, status: "generating" } : p
      ));
      
      try {
        const result = await generatePortrait(photo);
        
        if (result) {
          // Add to generated images
          setGeneratedImages(prev => [result, ...prev]);
          
          // Update queue status
          setPhotoQueue(prev => prev.map(p => 
            p.id === photo.id ? { ...p, status: "completed" } : p
          ));
        }
      } catch (err) {
        // Update queue status to failed
        setPhotoQueue(prev => prev.map(p => 
          p.id === photo.id ? { 
            ...p, 
            status: "failed",
            error: err instanceof Error ? err.message : "Failed"
          } : p
        ));
      }
    }
    
    setCurrentlyProcessing(null);
    setIsProcessingQueue(false);
  };

  // Download image (use HD URL if available)
  const handleDownload = async (image: GeneratedImage) => {
    try {
      const downloadUrl = image.hdUrl || image.url;
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumepet-${image.petName || "portrait"}-${image.id.substring(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Download failed. Please try again.");
    }
  };

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      photoQueue.forEach(p => URL.revokeObjectURL(p.preview));
    };
  }, []);

  // Password screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 
              className="text-3xl mb-2"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#C5A572' }}
            >
              LumePet Studio
            </h1>
            <p style={{ color: '#7A756D' }}>Enter password to access</p>
          </div>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-lg bg-[#1A1A1A] border border-[#333] text-[#F0EDE8] placeholder-[#666] focus:outline-none focus:border-[#C5A572]"
              autoFocus
            />
            {authError && (
              <p className="text-red-400 text-sm">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 rounded-lg font-medium transition-all"
              style={{ 
                background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                color: '#0A0A0A'
              }}
            >
              Enter Studio
            </button>
          </form>
        </div>
      </div>
    );
  }

  const pendingCount = photoQueue.filter(p => p.status === "pending").length;
  const completedCount = photoQueue.filter(p => p.status === "completed").length;
  const failedCount = photoQueue.filter(p => p.status === "failed").length;

  // Main studio interface
  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 
              className="text-3xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#C5A572' }}
            >
              🎨 LumePet Studio
            </h1>
            <p style={{ color: '#7A756D' }}>Batch generate up to 10 portraits at once</p>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#7A756D', border: '1px solid #333' }}
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upload & Queue */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Area */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium" style={{ color: '#F0EDE8' }}>
                  📷 Upload Pet Photos ({photoQueue.length}/{MAX_QUEUE_SIZE})
                </h2>
                {photoQueue.length > 0 && (
                  <button
                    onClick={() => setPhotoQueue([])}
                    className="text-sm transition-colors hover:text-red-400"
                    style={{ color: '#7A756D' }}
                  >
                    Clear All
                  </button>
                )}
              </div>
              
              <div
                onClick={() => photoQueue.length < MAX_QUEUE_SIZE && fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  photoQueue.length >= MAX_QUEUE_SIZE 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'cursor-pointer hover:border-[#C5A572]'
                }`}
                style={{ borderColor: '#444' }}
              >
                <div className="text-4xl mb-3">📤</div>
                <p style={{ color: '#B8B2A8' }}>
                  {photoQueue.length >= MAX_QUEUE_SIZE 
                    ? "Queue is full (10 photos max)"
                    : "Drop images here or click to upload (up to 10)"}
                </p>
                <p className="text-sm mt-2" style={{ color: '#666' }}>
                  Select multiple files at once
                </p>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Photo Queue */}
            {photoQueue.length > 0 && (
              <div 
                className="rounded-xl p-6"
                style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium" style={{ color: '#F0EDE8' }}>
                    📋 Queue ({pendingCount} pending, {completedCount} done{failedCount > 0 ? `, ${failedCount} failed` : ''})
                  </h2>
                  {(completedCount > 0 || failedCount > 0) && (
                    <button
                      onClick={clearCompleted}
                      className="text-sm transition-colors hover:text-[#C5A572]"
                      style={{ color: '#7A756D' }}
                    >
                      Clear Completed
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {photoQueue.map((photo) => (
                    <div 
                      key={photo.id}
                      className={`relative rounded-lg overflow-hidden ${
                        photo.status === "generating" ? "ring-2 ring-[#C5A572] animate-pulse" : ""
                      }`}
                      style={{ 
                        backgroundColor: '#0A0A0A',
                        opacity: photo.status === "completed" ? 0.6 : 1
                      }}
                    >
                      {/* Photo Preview */}
                      <div className="relative aspect-square">
                        <Image
                          src={photo.preview}
                          alt={photo.petName || "Pet photo"}
                          fill
                          className="object-cover"
                        />
                        
                        {/* Status Overlay */}
                        {photo.status !== "pending" && (
                          <div className={`absolute inset-0 flex items-center justify-center ${
                            photo.status === "generating" ? "bg-black/40" :
                            photo.status === "completed" ? "bg-green-500/20" :
                            "bg-red-500/20"
                          }`}>
                            {photo.status === "generating" && (
                              <svg className="animate-spin h-8 w-8 text-[#C5A572]" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            )}
                            {photo.status === "completed" && (
                              <div className="text-3xl">✅</div>
                            )}
                            {photo.status === "failed" && (
                              <div className="text-3xl">❌</div>
                            )}
                          </div>
                        )}
                        
                        {/* Remove Button */}
                        {photo.status === "pending" && (
                          <button
                            onClick={() => removeFromQueue(photo.id)}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-red-500/80 transition-colors flex items-center justify-center"
                          >
                            <span className="text-white text-sm">×</span>
                          </button>
                        )}
                      </div>
                      
                      {/* Pet Name Input */}
                      {photo.status === "pending" && (
                        <input
                          type="text"
                          value={photo.petName}
                          onChange={(e) => updatePetName(photo.id, e.target.value)}
                          placeholder="Pet name"
                          className="w-full px-2 py-1 text-xs bg-[#0A0A0A] border-t border-[#333] text-[#F0EDE8] placeholder-[#666] focus:outline-none"
                        />
                      )}
                      
                      {/* Completed Name */}
                      {photo.status !== "pending" && photo.petName && (
                        <div className="px-2 py-1 text-xs border-t border-[#333] truncate" style={{ color: '#B8B2A8' }}>
                          {photo.petName}
                        </div>
                      )}
                      
                      {/* Error Message */}
                      {photo.status === "failed" && photo.error && (
                        <div className="px-2 py-1 text-xs border-t border-red-500/30 truncate text-red-400">
                          {photo.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Settings */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <h2 className="text-lg font-medium mb-4" style={{ color: '#F0EDE8' }}>
                ⚙️ Generation Settings
              </h2>
              
              <div className="space-y-4">
                {/* Custom Prompt */}
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#B8B2A8' }}>
                    Custom Guidance (applies to all)
                  </label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="e.g., 'wearing a crown', 'blue velvet cape', 'warm golden lighting'..."
                    rows={2}
                    className="w-full px-4 py-2 rounded-lg bg-[#0A0A0A] border border-[#333] text-[#F0EDE8] placeholder-[#666] focus:outline-none focus:border-[#C5A572] resize-none"
                  />
                </div>
                
                {/* Watermark Toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableWatermark}
                    onChange={(e) => setEnableWatermark(e.target.checked)}
                    className="w-5 h-5 rounded border-[#333] bg-[#0A0A0A] text-[#C5A572] focus:ring-[#C5A572]"
                  />
                  <span style={{ color: '#B8B2A8' }}>Add watermark to generated images</span>
                </label>
                
                {/* Gender Selection */}
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#B8B2A8' }}>
                    Pet Gender (optional - affects styling)
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedGender(selectedGender === "male" ? null : "male")}
                      className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex-1 ${
                        selectedGender === "male" ? "scale-105" : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: selectedGender === "male" ? '#C5A572' : 'rgba(197, 165, 114, 0.2)',
                        color: selectedGender === "male" ? '#0A0A0A' : '#C5A572',
                        border: `2px solid ${selectedGender === "male" ? '#C5A572' : 'rgba(197, 165, 114, 0.3)'}`,
                      }}
                    >
                      ♂ Male
                    </button>
                    <button
                      onClick={() => setSelectedGender(selectedGender === "female" ? null : "female")}
                      className={`px-4 py-2 rounded-lg font-medium transition-all text-sm flex-1 ${
                        selectedGender === "female" ? "scale-105" : "opacity-70 hover:opacity-100"
                      }`}
                      style={{
                        backgroundColor: selectedGender === "female" ? '#C5A572' : 'rgba(197, 165, 114, 0.2)',
                        color: selectedGender === "female" ? '#0A0A0A' : '#C5A572',
                        border: `2px solid ${selectedGender === "female" ? '#C5A572' : 'rgba(197, 165, 114, 0.3)'}`,
                      }}
                    >
                      ♀ Female
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#666' }}>
                    Male: refined masculine styling • Female: softer, more delicate jewelry
                  </p>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={processQueue}
              disabled={isProcessingQueue || pendingCount === 0}
              className="w-full py-4 rounded-xl font-medium text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                background: isProcessingQueue 
                  ? '#333' 
                  : 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                color: '#0A0A0A'
              }}
            >
              {isProcessingQueue ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating {completedCount + 1} of {pendingCount + completedCount}...
                </span>
              ) : pendingCount === 0 ? (
                "Add photos to queue first"
              ) : (
                `🎨 Generate ${pendingCount} Portrait${pendingCount > 1 ? 's' : ''}`
              )}
            </button>

            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Right Column - Generated Images */}
          <div>
            <div 
              className="rounded-xl p-6 sticky top-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <h2 className="text-lg font-medium mb-4" style={{ color: '#F0EDE8' }}>
                🖼️ Generated ({generatedImages.length})
              </h2>
              
              {generatedImages.length === 0 ? (
                <div className="text-center py-12" style={{ color: '#666' }}>
                  <div className="text-5xl mb-4">🎨</div>
                  <p>Generated portraits will appear here</p>
                  <p className="text-sm mt-2">Full resolution downloads available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto pr-2">
                  {generatedImages.map((image) => (
                    <div 
                      key={image.id}
                      className="relative group rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                    >
                      <div className="relative aspect-square">
                        <Image
                          src={image.url}
                          alt={`${image.petName} portrait`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      
                      {/* Overlay with actions */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(image);
                          }}
                          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          title="Download HD"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedImage(image);
                          }}
                          className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                          title="View full size"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                          </svg>
                        </button>
                      </div>
                      
                      {/* Pet name */}
                      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/60 text-xs truncate" style={{ color: '#F0EDE8' }}>
                        {image.petName}
                      </div>
                      
                      {/* HD indicator */}
                      {image.hdUrl && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs bg-[#C5A572] text-[#0A0A0A] font-medium">
                          HD
                        </div>
                      )}
                      
                      {/* Watermark indicator */}
                      {image.hasWatermark && (
                        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs bg-black/60 text-white">
                          WM
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full size image modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div 
            className="relative max-w-4xl max-h-[90vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selectedImage.hdUrl || selectedImage.url}
              alt={`${selectedImage.petName} portrait`}
              width={1024}
              height={1024}
              className="w-full h-auto rounded-lg"
              unoptimized
            />
            
            <div className="flex items-center justify-between mt-4">
              <div>
                <p className="text-lg font-medium" style={{ color: '#F0EDE8' }}>
                  {selectedImage.petName}
                </p>
                <p className="text-sm" style={{ color: '#7A756D' }}>
                  {selectedImage.hdUrl ? "Full HD Resolution" : "Preview"}
                </p>
              </div>
              <button
                onClick={() => handleDownload(selectedImage)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                style={{ 
                  background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                  color: '#0A0A0A'
                }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download HD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
