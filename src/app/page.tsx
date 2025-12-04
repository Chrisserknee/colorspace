"use client";

import { useState, useEffect } from "react";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Gallery from "@/components/Gallery";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import ContactModal from "@/components/Contact";
import Footer from "@/components/Footer";
import UploadModal from "@/components/UploadModal";
import GenerationFlow, { getLastCreation } from "@/components/GenerationFlow";
import ResumeButton from "@/components/ResumeButton";
import SupportModal from "@/components/SupportModal";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [initialEmail, setInitialEmail] = useState<string | undefined>(undefined);
  const [showFlowFromEmail, setShowFlowFromEmail] = useState(false);
  const [lastCreation, setLastCreation] = useState<{ imageId: string; previewUrl: string } | null>(null);
  const [viewingLastCreation, setViewingLastCreation] = useState(false);

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
      {/* Support LumePet Button - Top Left */}
      <button
        onClick={() => setIsSupportModalOpen(true)}
        className="fixed top-4 left-4 z-40 flex items-center gap-2 px-5 py-3 rounded-xl text-base font-semibold transition-all duration-300 hover:scale-105 group"
        style={{
          background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.25) 0%, rgba(197, 165, 114, 0.12) 100%)',
          border: '1.5px solid rgba(197, 165, 114, 0.4)',
          color: '#C5A572',
          backdropFilter: 'blur(12px)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 20px rgba(197, 165, 114, 0.15)',
        }}
      >
        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", letterSpacing: '0.03em' }}>Support LumePet</span>
      </button>

      {/* Hero Section */}
      <Hero onUploadClick={handleUploadClick} />

      {/* View Last Creation Button - static, centered above How It Works */}
      {!selectedFile && !showFlowFromEmail && !viewingLastCreation && lastCreation && (
        <div className="flex justify-center py-6 -mt-8">
          <button
            onClick={handleViewLastCreation}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}>View Last Creation</span>
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
