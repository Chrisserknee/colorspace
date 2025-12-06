"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";

// Password for access (you can change this)
const STUDIO_PASSWORD = "LumePetLover1325519*";

interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: Date;
  hasWatermark: boolean;
}

export default function StudioPage() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Generation state
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [petName, setPetName] = useState("");
  const [petType, setPetType] = useState("dog");
  const [customPrompt, setCustomPrompt] = useState("");
  const [enableWatermark, setEnableWatermark] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  
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

  // Handle image upload
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Generate image
  const handleGenerate = async () => {
    if (!uploadedFile) {
      setError("Please upload an image first");
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("image", uploadedFile);
      formData.append("petName", petName || "Pet");
      formData.append("petType", petType);
      formData.append("style", "royal");
      formData.append("studioMode", "true");
      formData.append("enableWatermark", enableWatermark.toString());
      if (customPrompt.trim()) {
        formData.append("customPrompt", customPrompt.trim());
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      
      const newImage: GeneratedImage = {
        id: data.id || Date.now().toString(),
        url: data.url,
        prompt: customPrompt || "(default prompt)",
        timestamp: new Date(),
        hasWatermark: enableWatermark,
      };

      setGeneratedImages(prev => [newImage, ...prev]);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  // Download image
  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumepet-studio-${image.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

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
            <p style={{ color: '#7A756D' }}>Unlimited generations for social media content</p>
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#7A756D', border: '1px solid #333' }}
          >
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Controls */}
          <div className="space-y-6">
            {/* Image Upload */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <h2 className="text-lg font-medium mb-4" style={{ color: '#F0EDE8' }}>
                📷 Upload Pet Photo
              </h2>
              
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all hover:border-[#C5A572]"
                style={{ borderColor: uploadedImage ? '#C5A572' : '#444' }}
              >
                {uploadedImage ? (
                  <div className="relative w-48 h-48 mx-auto rounded-lg overflow-hidden">
                    <Image
                      src={uploadedImage}
                      alt="Uploaded pet"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div>
                    <div className="text-4xl mb-3">📤</div>
                    <p style={{ color: '#B8B2A8' }}>Drop image here or click to upload</p>
                  </div>
                )}
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              
              {uploadedImage && (
                <button
                  onClick={() => {
                    setUploadedImage(null);
                    setUploadedFile(null);
                  }}
                  className="mt-3 text-sm transition-colors hover:text-[#C5A572]"
                  style={{ color: '#7A756D' }}
                >
                  Remove image
                </button>
              )}
            </div>

            {/* Pet Details */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <h2 className="text-lg font-medium mb-4" style={{ color: '#F0EDE8' }}>
                🐾 Pet Details
              </h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#B8B2A8' }}>Pet Name</label>
                  <input
                    type="text"
                    value={petName}
                    onChange={(e) => setPetName(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-2 rounded-lg bg-[#0A0A0A] border border-[#333] text-[#F0EDE8] placeholder-[#666] focus:outline-none focus:border-[#C5A572]"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: '#B8B2A8' }}>Pet Type</label>
                  <select
                    value={petType}
                    onChange={(e) => setPetType(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-[#0A0A0A] border border-[#333] text-[#F0EDE8] focus:outline-none focus:border-[#C5A572]"
                  >
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="hamster">Hamster</option>
                    <option value="horse">Horse</option>
                    <option value="reptile">Reptile</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Custom Prompt */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <h2 className="text-lg font-medium mb-2" style={{ color: '#F0EDE8' }}>
                ✨ Custom Guidance (Optional)
              </h2>
              <p className="text-sm mb-4" style={{ color: '#7A756D' }}>
                Add natural language to guide the AI. This will be added to the main prompt.
              </p>
              
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="e.g., 'wearing a crown with red gems', 'blue velvet cape', 'sitting on a throne', 'warm golden lighting'..."
                rows={4}
                className="w-full px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#333] text-[#F0EDE8] placeholder-[#666] focus:outline-none focus:border-[#C5A572] resize-none"
              />
            </div>

            {/* Options */}
            <div 
              className="rounded-xl p-6"
              style={{ backgroundColor: '#1A1A1A', border: '1px solid #333' }}
            >
              <h2 className="text-lg font-medium mb-4" style={{ color: '#F0EDE8' }}>
                ⚙️ Options
              </h2>
              
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableWatermark}
                  onChange={(e) => setEnableWatermark(e.target.checked)}
                  className="w-5 h-5 rounded border-[#333] bg-[#0A0A0A] text-[#C5A572] focus:ring-[#C5A572]"
                />
                <span style={{ color: '#B8B2A8' }}>Add watermark</span>
              </label>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !uploadedImage}
              className="w-full py-4 rounded-xl font-medium text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                background: isGenerating 
                  ? '#333' 
                  : 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                color: '#0A0A0A'
              }}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-3">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Generating...
                </span>
              ) : (
                "🎨 Generate Portrait"
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
                🖼️ Generated Images ({generatedImages.length})
              </h2>
              
              {generatedImages.length === 0 ? (
                <div className="text-center py-12" style={{ color: '#666' }}>
                  <div className="text-5xl mb-4">🎨</div>
                  <p>Generated images will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-2">
                  {generatedImages.map((image) => (
                    <div 
                      key={image.id}
                      className="relative group rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setSelectedImage(image)}
                    >
                      <div className="relative aspect-square">
                        <Image
                          src={image.url}
                          alt="Generated portrait"
                          fill
                          className="object-cover"
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
                          title="Download"
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
                      
                      {/* Watermark indicator */}
                      {image.hasWatermark && (
                        <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs bg-black/60 text-white">
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
              src={selectedImage.url}
              alt="Generated portrait"
              width={1024}
              height={1024}
              className="w-full h-auto rounded-lg"
            />
            
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm" style={{ color: '#7A756D' }}>
                {selectedImage.prompt !== "(default prompt)" && `"${selectedImage.prompt}"`}
              </p>
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
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

