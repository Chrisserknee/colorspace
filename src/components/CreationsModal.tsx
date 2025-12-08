"use client";

import { useState, useEffect } from "react";
import { captureEvent } from "@/lib/posthog";
import { getUTMForAPI } from "@/lib/utm";

interface Creation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
  purchased?: boolean;
}

const CREATIONS_KEY = "lumepet_creations";

// Get all creations from localStorage
export const getCreations = (): Creation[] => {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CREATIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Creation[];
      // Filter out creations older than 24 hours
      const validCreations = parsed.filter((c) => {
        const hoursSinceCreation = (Date.now() - c.timestamp) / (1000 * 60 * 60);
        return hoursSinceCreation < 24;
      });
      // Save back filtered list
      if (validCreations.length !== parsed.length) {
        localStorage.setItem(CREATIONS_KEY, JSON.stringify(validCreations));
      }
      return validCreations;
    }
  } catch {
    return [];
  }
  return [];
};

// Save a new creation to localStorage
export const saveCreation = (imageId: string, previewUrl: string) => {
  if (typeof window === "undefined") return;
  const creations = getCreations();
  // Check if this creation already exists
  const existingIndex = creations.findIndex((c) => c.imageId === imageId);
  if (existingIndex >= 0) {
    // Update existing
    creations[existingIndex] = {
      ...creations[existingIndex],
      previewUrl,
      timestamp: Date.now(),
    };
  } else {
    // Add new
    creations.unshift({
      imageId,
      previewUrl,
      timestamp: Date.now(),
      purchased: false,
    });
  }
  // Keep only last 10 creations
  const trimmed = creations.slice(0, 10);
  localStorage.setItem(CREATIONS_KEY, JSON.stringify(trimmed));
};

// Mark a creation as purchased
export const markCreationPurchased = (imageId: string) => {
  if (typeof window === "undefined") return;
  const creations = getCreations();
  const index = creations.findIndex((c) => c.imageId === imageId);
  if (index >= 0) {
    creations[index].purchased = true;
    localStorage.setItem(CREATIONS_KEY, JSON.stringify(creations));
  }
};

// Check if there are any creations
export const hasCreations = (): boolean => {
  return getCreations().length > 0;
};

interface CreationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreationsModal({ isOpen, onClose }: CreationsModalProps) {
  const [creations, setCreations] = useState<Creation[]>([]);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCreations(getCreations());
      captureEvent("viewed_creations_modal", { count: getCreations().length });
    }
  }, [isOpen]);

  const handlePurchase = async (creation: Creation) => {
    if (creation.purchased) return;
    
    setPurchasingId(creation.imageId);
    
    captureEvent("purchase_from_creations", { image_id: creation.imageId });
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: creation.imageId,
          type: "image",
          cancelUrl: "/",
          utmData: getUTMForAPI(), // Include UTM attribution data
        }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        alert(data.error || "Failed to create checkout session");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      alert("Failed to redirect to checkout. Please try again.");
    } finally {
      setPurchasingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl"
        style={{ 
          background: 'linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)',
          border: '1px solid rgba(197, 165, 114, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(197, 165, 114, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="p-5 flex items-center justify-between"
          style={{ borderBottom: '1px solid rgba(197, 165, 114, 0.15)' }}
        >
          <div>
            <h2 
              className="text-2xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
            >
              My Creations
            </h2>
            <p className="text-sm mt-1" style={{ color: '#7A756D' }}>
              Your portraits from this session
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-white/10"
            style={{ color: '#7A756D' }}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Creations Grid */}
        <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 100px)' }}>
          {creations.length === 0 ? (
            <div className="text-center py-12">
              <div 
                className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(197, 165, 114, 0.1)' }}
              >
                <svg className="w-8 h-8" style={{ color: '#7A756D' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p style={{ color: '#7A756D' }}>No creations yet</p>
              <p className="text-sm mt-1" style={{ color: '#5A5650' }}>
                Upload a pet photo to create your first portrait!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {creations.map((creation) => (
                <div 
                  key={creation.imageId}
                  className="relative rounded-xl overflow-hidden group"
                  style={{ 
                    background: 'rgba(197, 165, 114, 0.05)',
                    border: '1px solid rgba(197, 165, 114, 0.15)',
                  }}
                >
                  {/* Image */}
                  <div className="relative aspect-square">
                    <img 
                      src={creation.previewUrl} 
                      alt="Pet portrait"
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Purchased Badge */}
                    {creation.purchased && (
                      <div 
                        className="absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"
                        style={{ 
                          background: 'rgba(16, 185, 129, 0.9)',
                          color: '#FFFFFF',
                        }}
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Purchased
                      </div>
                    )}
                    
                    {/* Hover Overlay for unpurchased */}
                    {!creation.purchased && (
                      <div 
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        style={{ background: 'rgba(0, 0, 0, 0.6)' }}
                      >
                        <button
                          onClick={() => handlePurchase(creation)}
                          disabled={purchasingId === creation.imageId}
                          className="px-4 py-2 rounded-lg font-semibold text-sm transition-all hover:scale-105 disabled:opacity-50"
                          style={{ 
                            background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                            color: '#0A0A0A',
                          }}
                        >
                          {purchasingId === creation.imageId ? (
                            <span className="flex items-center gap-2">
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Loading...
                            </span>
                          ) : (
                            "Get 4K Version - $29.99"
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs" style={{ color: '#7A756D' }}>
                      {new Date(creation.timestamp).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                    {!creation.purchased && (
                      <button
                        onClick={() => handlePurchase(creation)}
                        disabled={purchasingId === creation.imageId}
                        className="w-full mt-2 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                        style={{ 
                          background: 'rgba(197, 165, 114, 0.15)',
                          border: '1px solid rgba(197, 165, 114, 0.3)',
                          color: '#C5A572',
                        }}
                      >
                        {purchasingId === creation.imageId ? "Loading..." : "Download 4K"}
                      </button>
                    )}
                    {creation.purchased && (
                      <p className="text-xs text-center mt-2" style={{ color: '#10B981' }}>
                        ✓ Check your email for download
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer */}
        {creations.length > 0 && (
          <div 
            className="p-4 text-center"
            style={{ borderTop: '1px solid rgba(197, 165, 114, 0.1)' }}
          >
            <p className="text-xs" style={{ color: '#5A5650' }}>
              Portraits expire after 24 hours • Purchase to keep forever
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

