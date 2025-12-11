"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import ContactModal from "@/components/Contact";
import EmailCapture from "@/components/EmailCapture";
import Footer from "@/components/Footer";
import UploadModal from "@/components/UploadModal";
import GenerationFlow, { getLastCreation } from "@/components/GenerationFlow";
import ResumeButton from "@/components/ResumeButton";
import SupportModal from "@/components/SupportModal";
import CreationsModal, { hasCreations } from "@/components/CreationsModal";
import { captureUTMParams } from "@/lib/utm";
import { lumepetConfig } from "@/lib/apps";

// Helper to convert data URL to File
const dataURLtoFile = (dataurl: string, filename: string): File | null => {
  try {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
};

// Helper to create a placeholder file for session restore
const createPlaceholderFile = (): File => {
  // Create a 1x1 transparent PNG as placeholder
  const transparentPng = new Uint8Array([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
    0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  return new File([transparentPng], "session-restore.png", { type: "image/png" });
};

export default function LumePetPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isCreationsModalOpen, setIsCreationsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [initialEmail, setInitialEmail] = useState<string | undefined>(undefined);
  const [showFlowFromEmail, setShowFlowFromEmail] = useState(false);
  const [lastCreation, setLastCreation] = useState<{ imageId: string; previewUrl: string } | null>(null);
  const [viewingLastCreation, setViewingLastCreation] = useState(false);
  const [hasAnyCreations, setHasAnyCreations] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);

  const appConfig = lumepetConfig;

  // Check for email param (session restore) or pending image from pack purchase
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Capture UTM parameters for attribution tracking
      captureUTMParams();
      
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for email param for session restoration
      const emailParam = urlParams.get("email");
      if (emailParam) {
        console.log("📧 Email param detected, initiating session restore:", emailParam);
        setInitialEmail(emailParam);
        setShowFlowFromEmail(true);
        setSelectedFile(createPlaceholderFile());
        window.history.replaceState({}, "", window.location.pathname);
        return;
      }
      
      // Check for restored=true from pack purchase
      if (urlParams.get("restored") === "true") {
        const pendingImage = localStorage.getItem("lumepet_pending_image");
        if (pendingImage) {
          const file = dataURLtoFile(pendingImage, "restored-pet.png");
          if (file) {
            setSelectedFile(file);
          }
          localStorage.removeItem("lumepet_pending_image");
        }
      }
      
      // Check for last creation to show "View Last Creation" button
      const savedLastCreation = getLastCreation();
      if (savedLastCreation) {
        setLastCreation({
          imageId: savedLastCreation.imageId,
          previewUrl: savedLastCreation.previewUrl,
        });
      }
      
      // Check if there are any creations for "My Creations" button
      setHasAnyCreations(hasCreations());
      
      // Check for support=true param to auto-open support modal
      if (urlParams.get("support") === "true") {
        setIsSupportModalOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
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
    const hasCreationsNow = hasCreations();
    
    setSelectedFile(null);
    setViewingLastCreation(false);
    setShowFlowFromEmail(false);
    
    setHasAnyCreations(hasCreationsNow);
    
    if (hasCreationsNow) {
      setJustGenerated(true);
      setTimeout(() => setJustGenerated(false), 12000);
    }
    
    const savedLastCreation = getLastCreation();
    if (savedLastCreation) {
      setLastCreation({
        imageId: savedLastCreation.imageId,
        previewUrl: savedLastCreation.previewUrl,
      });
    }
    
    if (typeof window !== "undefined") {
      localStorage.removeItem("lumepet_pending_image");
    }
  };

  const handleViewLastCreation = () => {
    if (lastCreation) {
      setViewingLastCreation(true);
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden">
      {/* Back to Hub Link */}
      <div className="absolute top-4 left-4 z-50">
        <Link 
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-300 hover:scale-105"
          style={{
            background: 'rgba(197, 165, 114, 0.1)',
            border: '1px solid rgba(197, 165, 114, 0.3)',
            color: '#C5A572',
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Apps
        </Link>
      </div>

      {/* Hero Section */}
      <Hero onUploadClick={handleUploadClick} />

      {/* My Creations Button - static, centered above How It Works */}
      {!selectedFile && !showFlowFromEmail && !viewingLastCreation && hasAnyCreations && (
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
              boxShadow: justGenerated
                ? `0 4px 30px ${appConfig.theme.primaryColor}40, 0 0 25px ${appConfig.theme.primaryColor}30`
                : `0 4px 20px rgba(0, 0, 0, 0.2), 0 0 15px ${appConfig.theme.primaryColor}10`,
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
      <HowItWorks />

      {/* Sample Gallery Section */}
      <Gallery />

      {/* Testimonials Section */}
      <Testimonials />

      {/* FAQ Section */}
      <FAQ />

      {/* Email Capture Section */}
      <EmailCapture />

      {/* Footer */}
      <Footer onContactClick={() => setIsContactModalOpen(true)} />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelected={handleFileSelected}
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Support Modal */}
      <SupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />

      {/* Creations Modal */}
      <CreationsModal
        isOpen={isCreationsModalOpen}
        onClose={() => setIsCreationsModalOpen(false)}
      />

      {/* Generation Flow */}
      {(selectedFile || showFlowFromEmail || viewingLastCreation) && (
        <GenerationFlow 
          file={showFlowFromEmail ? null : selectedFile} 
          onReset={handleReset} 
          initialEmail={initialEmail}
          initialResult={viewingLastCreation ? lastCreation : null}
        />
      )}

      {/* Resume Button - shows when not in flow */}
      {!selectedFile && !showFlowFromEmail && !viewingLastCreation && (
        <ResumeButton variant="lumepet" />
      )}
    </main>
  );
}


