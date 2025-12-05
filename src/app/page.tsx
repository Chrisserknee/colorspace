"use client";

import { useState, useEffect } from "react";
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

export default function Home() {
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

  // Check for email param (session restore) or pending image from pack purchase
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for email param for session restoration
      const emailParam = urlParams.get("email");
      if (emailParam) {
        console.log("📧 Email param detected, initiating session restore:", emailParam);
        setInitialEmail(emailParam);
        setShowFlowFromEmail(true);
        // Create a placeholder file to trigger the flow
        setSelectedFile(createPlaceholderFile());
        // Clean URL
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
          // Clear the pending image after restoring
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
        // Clean URL
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
    setSelectedFile(null);
    setViewingLastCreation(false);
    setShowFlowFromEmail(false);
    // Also clear any pending image
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
    <main className="min-h-screen">
      {/* Support LumePet Button - Top Left (Vertical Layout) */}
      <button
        onClick={() => setIsSupportModalOpen(true)}
        className="fixed top-3 left-3 z-40 flex flex-col items-center px-3 py-2 rounded-xl transition-all duration-300 hover:scale-105 group"
        style={{
          background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.25) 0%, rgba(197, 165, 114, 0.12) 100%)',
          border: '1.5px solid rgba(197, 165, 114, 0.4)',
          color: '#C5A572',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(197, 165, 114, 0.15)',
        }}
      >
        <svg className="w-4 h-4 mb-0.5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span className="text-xs font-medium" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.05em' }}>Support</span>
        <span className="text-xs font-medium" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.05em' }}>LumePet</span>
      </button>

      {/* Hero Section */}
      <Hero onUploadClick={handleUploadClick} />

      {/* My Creations Button - static, centered above How It Works */}
      {!selectedFile && !showFlowFromEmail && !viewingLastCreation && hasAnyCreations && (
        <div className="flex justify-center py-6 -mt-8">
          <button
            onClick={() => setIsCreationsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.15) 0%, rgba(197, 165, 114, 0.08) 100%)',
              border: '1px solid rgba(197, 165, 114, 0.3)',
              color: '#C5A572',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2), 0 0 15px rgba(197, 165, 114, 0.1)',
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
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>My Creations</span>
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

      {/* Generation Flow (shows after file selection, email session restore, or viewing last creation) */}
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
