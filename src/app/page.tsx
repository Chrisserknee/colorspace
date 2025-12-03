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
import GenerationFlow from "@/components/GenerationFlow";
import ResumeButton from "@/components/ResumeButton";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [initialEmail, setInitialEmail] = useState<string | undefined>(undefined);
  const [showFlowFromEmail, setShowFlowFromEmail] = useState(false);

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
    // Also clear any pending image
    if (typeof window !== "undefined") {
      localStorage.removeItem("lumepet_pending_image");
    }
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <Hero onUploadClick={handleUploadClick} />

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

      {/* Generation Flow (shows after file selection or email session restore) */}
      {(selectedFile || showFlowFromEmail) && (
        <GenerationFlow 
          file={showFlowFromEmail ? null : selectedFile} 
          onReset={handleReset} 
          initialEmail={initialEmail}
        />
      )}

      {/* Resume Button - shows when not in flow */}
      {!selectedFile && !showFlowFromEmail && (
        <ResumeButton variant="lumepet" />
      )}
    </main>
  );
}
