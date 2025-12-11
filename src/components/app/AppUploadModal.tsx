"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AppConfig } from "@/lib/apps/types";
import { captureEvent } from "@/lib/posthog";
import { CONFIG } from "@/lib/config";

interface AppUploadModalProps {
  config: AppConfig;
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
}

export default function AppUploadModal({ config, isOpen, onClose, onFileSelected }: AppUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
      setError(null);
    }, 300);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, handleClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!CONFIG.ACCEPTED_TYPES.includes(file.type)) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return false;
    }
    
    // Check file size
    if (file.size > CONFIG.MAX_FILE_SIZE) {
      setError("Image is too large. Please use an image under 4MB.");
      return false;
    }
    
    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      captureEvent("photo_uploaded", {
        source: "upload_modal",
        app: config.id,
        file_size: file.size,
        file_type: file.type,
      });
      onFileSelected(file);
      handleClose();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.85)" }}
    >
      <div 
        className={`relative w-full max-w-lg rounded-2xl overflow-hidden ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
        style={{
          background: 'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%)',
          border: `1px solid ${config.theme.primaryColor}30`,
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 60px ${config.theme.primaryColor}15`,
        }}
      >
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-center">
          <div>
            <h2 
              className="text-2xl"
              style={{ 
                fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
                color: '#F0EDE8',
              }}
            >
              {config.content.uploadTitle}
            </h2>
            <p className="text-sm mt-1" style={{ color: config.theme.primaryColor }}>
              {config.content.uploadSubtitle}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-full transition-all duration-200 hover:scale-110"
            style={{ 
              background: `${config.theme.primaryColor}20`,
              color: config.theme.primaryColor,
            }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upload Area */}
        <div className="px-6 pb-6">
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
              isDragging ? 'scale-[1.02]' : ''
            }`}
            style={{
              border: `2px dashed ${isDragging ? config.theme.primaryColor : `${config.theme.primaryColor}40`}`,
              background: isDragging ? `${config.theme.primaryColor}10` : 'rgba(26, 26, 26, 0.5)',
            }}
          >
            {/* Upload Icon */}
            <div 
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ 
                background: config.theme.buttonGradient,
                boxShadow: `0 10px 30px ${config.theme.primaryColor}40`,
              }}
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <p 
              className="text-lg mb-2"
              style={{ 
                fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
                color: '#F0EDE8',
              }}
            >
              {isDragging ? "Drop your photo here" : "Drag & drop your photo here"}
            </p>
            <p className="text-sm mb-4" style={{ color: '#7A756D' }}>
              or click to browse
            </p>

            {/* Upload Tips */}
            <div className="flex flex-wrap justify-center gap-2">
              {config.content.uploadTips.map((tip, index) => (
                <span 
                  key={index}
                  className="px-3 py-1 rounded-full text-xs"
                  style={{
                    background: `${config.theme.primaryColor}15`,
                    color: config.theme.primaryColor,
                  }}
                >
                  ✓ {tip}
                </span>
              ))}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div 
              className="mt-4 p-3 rounded-lg text-center text-sm"
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
              }}
            >
              {error}
            </div>
          )}

          {/* File Requirements */}
          <p className="text-xs text-center mt-4" style={{ color: '#7A756D' }}>
            Supported formats: JPEG, PNG, WebP • Max size: 4MB
          </p>
        </div>
      </div>
    </div>
  );
}


