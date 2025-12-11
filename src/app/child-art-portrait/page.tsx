"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { childArtPortraitConfig } from "@/lib/apps";
import { AppHero, AppHowItWorks, AppFAQ, AppUploadModal, AppFooter } from "@/components/app";
import ChildArtGenerationFlow from "@/components/app/ChildArtGenerationFlow";
import ContactModal from "@/components/Contact";
import { captureUTMParams } from "@/lib/utm";

// Storage keys
const CHILD_ART_CREATIONS_KEY = "child_art_creations";

interface Creation {
  imageId: string;
  previewUrl: string;
  timestamp: number;
}

const hasCreations = (): boolean => {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(CHILD_ART_CREATIONS_KEY);
  if (!stored) return false;
  const creations: Creation[] = JSON.parse(stored);
  return creations.length > 0;
};

const getCreations = (): Creation[] => {
  if (typeof window === "undefined") return [];
  const stored = localStorage.getItem(CHILD_ART_CREATIONS_KEY);
  if (!stored) return [];
  return JSON.parse(stored);
};

// Creation card with image error handling
function CreationCard({ creation, appConfig }: { creation: Creation; appConfig: typeof childArtPortraitConfig }) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <a
      href={creation.previewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="relative aspect-square rounded-xl overflow-hidden group transition-transform duration-300 hover:scale-105"
      style={{
        border: `2px solid ${appConfig.theme.primaryColor}30`,
        background: `${appConfig.theme.primaryColor}10`,
      }}
    >
      {!imageError ? (
        <>
          {!imageLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: `${appConfig.theme.primaryColor}40`, borderTopColor: 'transparent' }}
              />
            </div>
          )}
          <Image
            src={creation.previewUrl}
            alt="Created portrait"
            fill
            className={`object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            unoptimized
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
          <svg 
            className="w-12 h-12 mb-2" 
            style={{ color: appConfig.theme.primaryColor }} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs" style={{ color: '#7A756D' }}>Image expired</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </div>
    </a>
  );
}

export default function ChildArtPortraitPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isCreationsModalOpen, setIsCreationsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [hasAnyCreations, setHasAnyCreations] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const [creations, setCreations] = useState<Creation[]>([]);

  const appConfig = childArtPortraitConfig;

  useEffect(() => {
    if (typeof window !== "undefined") {
      captureUTMParams();
      setHasAnyCreations(hasCreations());
      setCreations(getCreations());
    }
  }, []);

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setIsUploadModalOpen(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
    
    // Refresh creations
    const hasCreationsNow = hasCreations();
    setHasAnyCreations(hasCreationsNow);
    setCreations(getCreations());
    
    if (hasCreationsNow) {
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 12000);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <AppHero config={appConfig} onUploadClick={handleUploadClick} />

      {/* My Creations Button */}
      {!selectedFile && hasAnyCreations && (
        <div className="flex flex-col items-center py-6 -mt-8 gap-2">
          {justGenerated && (
            <div 
              className="text-sm font-medium animate-bounce"
              style={{ 
                color: appConfig.theme.primaryColor,
                fontFamily: appConfig.theme.fontFamily,
              }}
            >
              ✨ Your portrait is saved! ✨
            </div>
          )}
          <button
            onClick={() => {
              setIsCreationsModalOpen(true);
              setJustGenerated(false);
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 ${
              justGenerated ? 'animate-pulse scale-105' : ''
            }`}
            style={{
              background: justGenerated 
                ? `linear-gradient(135deg, ${appConfig.theme.primaryColor}35 0%, ${appConfig.theme.primaryColor}20 100%)`
                : `linear-gradient(135deg, ${appConfig.theme.primaryColor}15 0%, ${appConfig.theme.primaryColor}08 100%)`,
              border: justGenerated 
                ? `2px solid ${appConfig.theme.primaryColor}60`
                : `1px solid ${appConfig.theme.primaryColor}30`,
              color: appConfig.theme.primaryColor,
            }}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span style={{ fontFamily: appConfig.theme.fontFamily }}>My Creations</span>
          </button>
        </div>
      )}

      {/* How It Works Section */}
      <AppHowItWorks config={appConfig} />

      {/* FAQ Section */}
      <AppFAQ config={appConfig} />

      {/* Footer */}
      <AppFooter 
        config={appConfig} 
        onContactClick={() => setIsContactModalOpen(true)} 
      />

      {/* Upload Modal */}
      <AppUploadModal
        config={appConfig}
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelected={handleFileSelected}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Creations Modal */}
      {isCreationsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.9)" }}
          onClick={() => setIsCreationsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            style={{
              background: 'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%)',
              border: `1px solid ${appConfig.theme.primaryColor}30`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCreationsModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full transition-all duration-200 hover:scale-110"
              style={{
                background: `${appConfig.theme.primaryColor}20`,
                color: appConfig.theme.primaryColor,
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h2
              className="text-2xl mb-6"
              style={{
                fontFamily: appConfig.theme.fontFamily,
                color: '#F0EDE8',
              }}
            >
              My Creations
            </h2>

            {creations.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {creations.map((creation) => (
                  <CreationCard 
                    key={creation.imageId} 
                    creation={creation} 
                    appConfig={appConfig} 
                  />
                ))}
              </div>
            ) : (
              <p style={{ color: '#7A756D', textAlign: 'center', padding: '2rem' }}>
                No creations yet. Upload a photo to create your first portrait!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Generation Flow */}
      {selectedFile && (
        <ChildArtGenerationFlow 
          file={selectedFile} 
          onReset={handleReset} 
        />
      )}
    </main>
  );
}
