"use client";

import { useState } from "react";
import Image from "next/image";

type Stage = "preview" | "generating" | "result" | "checkout";

interface GenerationFlowProps {
  file: File | null;
  onReset: () => void;
}

interface GeneratedResult {
  imageId: string;
  previewUrl: string;
}

export default function GenerationFlow({ file, onReset }: GenerationFlowProps) {
  const [stage, setStage] = useState<Stage>("preview");
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (file && !previewUrl) {
    setPreviewUrl(URL.createObjectURL(file));
  }

  const handleGenerate = async () => {
    if (!file) return;
    
    setStage("generating");
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate portrait");
      }

      setResult(data);
      setStage("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStage("preview");
    }
  };

  const handleCheckout = async () => {
    if (!result) return;
    
    setStage("checkout");

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageId: result.imageId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to redirect to checkout. Please try again.");
      setStage("result");
    }
  };

  const handleReset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setResult(null);
    setStage("preview");
    setError(null);
    onReset();
  };

  if (!file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 backdrop-blur-sm" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      />
      
      {/* Content */}
      <div 
        className="relative w-full max-w-2xl rounded-3xl shadow-2xl animate-fade-in-up my-8"
        style={{ 
          backgroundColor: '#1A1A1A',
          border: '1px solid rgba(197, 165, 114, 0.2)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(197, 165, 114, 0.1)'
        }}
      >
        {/* Close button */}
        <button
          onClick={handleReset}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#B8B2A8' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Preview Stage */}
        {stage === "preview" && (
          <div className="p-8">
            <div className="text-center mb-6">
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                Your Royal Subject
              </h3>
              <p style={{ color: '#B8B2A8' }}>
                Ready to transform your pet into a Renaissance masterpiece?
              </p>
            </div>

            <div 
              className="relative aspect-square max-w-sm mx-auto rounded-2xl overflow-hidden shadow-lg mb-6"
              style={{ border: '2px solid rgba(197, 165, 114, 0.3)' }}
            >
              {previewUrl && (
                <Image
                  src={previewUrl}
                  alt="Your pet"
                  fill
                  className="object-cover"
                />
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
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="text-center">
              <button onClick={handleGenerate} className="btn-primary text-lg px-8 py-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                </svg>
                Generate Renaissance Portrait
              </button>
            </div>
          </div>
        )}

        {/* Generating Stage */}
        {stage === "generating" && (
          <div className="p-8 text-center">
            <div className="mb-8">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg 
                    className="w-12 h-12 animate-pulse" 
                    style={{ color: '#C5A572' }} 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"/>
                  </svg>
                </div>
                <div 
                  className="absolute inset-0 border-4 rounded-full" 
                  style={{ borderColor: 'rgba(197, 165, 114, 0.2)' }} 
                />
                <div 
                  className="absolute inset-0 border-4 border-transparent rounded-full animate-spin-slow" 
                  style={{ borderTopColor: '#C5A572' }} 
                />
              </div>
              
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                Painting Your Pet...
              </h3>
              <p style={{ color: '#B8B2A8' }}>
                Our master painters are carefully crafting your Renaissance masterpiece.
              </p>
            </div>

            <div className="space-y-2 text-sm" style={{ color: '#7A756D' }}>
              <p className="animate-fade-in">🎨 Mixing oil paints...</p>
              <p className="animate-fade-in delay-200">🖼️ Preparing the canvas...</p>
              <p className="animate-fade-in delay-400">👑 Adding royal details...</p>
            </div>
          </div>
        )}

        {/* Result Stage */}
        {stage === "result" && result && (
          <div className="p-8">
            <div className="text-center mb-6">
              <h3 
                className="text-2xl font-semibold mb-2"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                Your Masterpiece Awaits
              </h3>
              <p style={{ color: '#B8B2A8' }}>
                Behold! Your pet has been immortalized in the classical tradition.
              </p>
            </div>

            <div className="ornate-frame max-w-md mx-auto mb-6">
              <div className="relative aspect-square rounded overflow-hidden">
                <Image
                  src={result.previewUrl}
                  alt="Renaissance portrait preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <div className="watermark-overlay">
                  <div className="watermark-text">PET RENAISSANCE • PREVIEW ONLY</div>
                </div>
              </div>
            </div>

            <div className="text-center mb-6">
              <p className="mb-4" style={{ color: '#B8B2A8' }}>
                Love it? Unlock the full-resolution, watermark-free version.
              </p>
              <button onClick={handleCheckout} className="btn-secondary text-lg px-8 py-4">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Buy HD Portrait – $9
              </button>
            </div>

            {error && (
              <div 
                className="mb-4 p-4 rounded-xl text-center text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#F87171'
                }}
              >
                {error}
              </div>
            )}

            <div className="text-center">
              <button 
                onClick={handleReset}
                className="text-sm transition-colors hover:text-[#C5A572]"
                style={{ color: '#7A756D' }}
              >
                ← Try a different photo
              </button>
            </div>
          </div>
        )}

        {/* Checkout Stage */}
        {stage === "checkout" && (
          <div className="p-8 text-center">
            <div 
              className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center"
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
      </div>
    </div>
  );
}
