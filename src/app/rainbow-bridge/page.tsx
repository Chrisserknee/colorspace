"use client";

import { useState } from "react";
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

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    setIsUploadModalOpen(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
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

      {/* Generation Flow (shows after file selection) */}
      {selectedFile && (
        <RainbowBridgeFlow file={selectedFile} onReset={handleReset} />
      )}
    </main>
  );
}




