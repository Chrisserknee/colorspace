"use client";

import { useState, useEffect } from "react";
import RainbowBridgeHero from "@/components/RainbowBridgeHero";
import RainbowBridgeTestimonials from "@/components/RainbowBridgeTestimonials";
import RainbowBridgeFooter from "@/components/RainbowBridgeFooter";
import UploadModal from "@/components/UploadModal";
import RainbowBridgeFlow from "@/components/RainbowBridgeFlow";
import ContactModal from "@/components/Contact";

export default function RainbowBridge() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [initialEmail, setInitialEmail] = useState<string | undefined>(undefined);
  const [showFlowFromEmail, setShowFlowFromEmail] = useState(false);

  // Check for email param (session restore)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for email param for session restoration
      const emailParam = urlParams.get("email");
      if (emailParam) {
        console.log("📧 Email param detected, initiating Rainbow Bridge session restore:", emailParam);
        setInitialEmail(emailParam);
        setShowFlowFromEmail(true);
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
    setShowFlowFromEmail(false);
    setInitialEmail(undefined);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#FEFEFE] via-[#F8F6F3] to-[#F5F0EB]">
      {/* Hero Section */}
      <RainbowBridgeHero onUploadClick={handleUploadClick} />

      {/* Testimonials Section */}
      <RainbowBridgeTestimonials />

      {/* Footer */}
      <RainbowBridgeFooter onContactClick={() => setIsContactModalOpen(true)} />

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileSelected={handleFileSelected}
        theme="rainbow-bridge"
      />

      {/* Contact Modal */}
      <ContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
      />

      {/* Generation Flow (shows after file selection or email session restore) */}
      {(selectedFile || showFlowFromEmail) && (
        <RainbowBridgeFlow 
          file={showFlowFromEmail ? null : selectedFile} 
          onReset={handleReset}
          initialEmail={initialEmail}
        />
      )}
    </main>
  );
}




