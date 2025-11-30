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

export default function Home() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Check for pending image from pack purchase return
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
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

      {/* Generation Flow (shows after file selection) */}
      {selectedFile && (
        <GenerationFlow file={selectedFile} onReset={handleReset} />
      )}
    </main>
  );
}
