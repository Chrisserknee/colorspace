"use client";

import { useRef, useState, useCallback } from "react";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
  theme?: "default" | "rainbow-bridge";
}

export default function UploadModal({ isOpen, onClose, onFileSelected, theme = "default" }: UploadModalProps) {
  const isRainbowBridge = theme === "rainbow-bridge";
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setError(null);
      setIsClosing(false);
      onClose();
    }, 350);
  };

  const validateFile = (file: File): boolean => {
    setError(null);
    
    // More lenient type checking for Android (sometimes MIME types can be inconsistent)
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    const validExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();
    
    // Check both MIME type and file extension for better Android compatibility
    const isValidType = validTypes.includes(fileType) || 
                       validExtensions.some(ext => fileName.endsWith(ext)) ||
                       fileType.startsWith("image/"); // Fallback: accept any image/* type
    
    if (!isValidType && file.size > 0) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return false;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10MB.");
      return false;
    }
    
    if (file.size === 0) {
      setError("File appears to be empty. Please try a different image.");
      return false;
    }
    
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if file was actually selected (not just dialog closed)
      if (file.size === 0 && file.name === '') {
        // User cancelled or permission denied
        return;
      }
      
      if (validateFile(file)) {
        onFileSelected(file);
      }
    }
    
    // Reset input to allow selecting same file again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && validateFile(file)) {
      onFileSelected(file);
    }
  }, [onFileSelected]);

  if (!isOpen) return null;

  // Theme colors
  const colors = isRainbowBridge ? {
    backdrop: 'rgba(255, 255, 255, 0.95)',
    modalBg: '#FFFFFF',
    border: 'rgba(212, 175, 55, 0.2)',
    shadow: '0 25px 50px rgba(0, 0, 0, 0.1), 0 0 100px rgba(212, 175, 55, 0.1)',
    closeBg: 'rgba(0, 0, 0, 0.05)',
    closeColor: '#6B6B6B',
    closeHoverBg: 'rgba(212, 175, 55, 0.15)',
    closeHoverColor: '#D4AF37',
    closeGlow: '0 0 15px rgba(212, 175, 55, 0.3)',
    iconBg: 'rgba(212, 175, 55, 0.1)',
    iconBorder: '1px solid rgba(212, 175, 55, 0.2)',
    iconColor: '#D4AF37',
    titleColor: '#4A4A4A',
    subtitleColor: '#6B6B6B',
    dropzoneActiveBorder: '#D4AF37',
    dropzoneBorder: 'rgba(212, 175, 55, 0.2)',
    dropzoneActiveBg: 'rgba(212, 175, 55, 0.05)',
    dropzoneBg: 'rgba(0, 0, 0, 0.02)',
    textPrimary: '#4A4A4A',
    textSecondary: '#9B8AA0',
    tipBg: 'rgba(212, 175, 55, 0.05)',
    tipBorder: '1px solid rgba(212, 175, 55, 0.1)',
    tipAccent: '#D4AF37',
  } : {
    backdrop: 'rgba(0, 0, 0, 0.8)',
    modalBg: '#1A1A1A',
    border: 'rgba(197, 165, 114, 0.2)',
    shadow: '0 25px 50px rgba(0, 0, 0, 0.5), 0 0 100px rgba(197, 165, 114, 0.1)',
    closeBg: 'rgba(255, 255, 255, 0.05)',
    closeColor: '#B8B2A8',
    closeHoverBg: 'rgba(197, 165, 114, 0.2)',
    closeHoverColor: '#C5A572',
    closeGlow: '0 0 15px rgba(197, 165, 114, 0.4)',
    iconBg: 'rgba(197, 165, 114, 0.1)',
    iconBorder: '1px solid rgba(197, 165, 114, 0.2)',
    iconColor: '#C5A572',
    titleColor: '#F0EDE8',
    subtitleColor: '#B8B2A8',
    dropzoneActiveBorder: '#C5A572',
    dropzoneBorder: 'rgba(197, 165, 114, 0.2)',
    dropzoneActiveBg: 'rgba(197, 165, 114, 0.05)',
    dropzoneBg: 'rgba(255, 255, 255, 0.02)',
    textPrimary: '#F0EDE8',
    textSecondary: '#7A756D',
    tipBg: 'rgba(197, 165, 114, 0.05)',
    tipBorder: '1px solid rgba(197, 165, 114, 0.1)',
    tipAccent: '#C5A572',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 backdrop-blur-sm ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        style={{ backgroundColor: colors.backdrop }}
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative w-full max-w-lg rounded-3xl shadow-2xl p-8 ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
        style={{ 
          backgroundColor: colors.modalBg,
          border: `1px solid ${colors.border}`,
          boxShadow: colors.shadow
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 hover:rotate-90 active:scale-95"
          style={{ 
            backgroundColor: colors.closeBg, 
            color: colors.closeColor,
            boxShadow: '0 0 0 0 transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.closeHoverBg;
            e.currentTarget.style.color = colors.closeHoverColor;
            e.currentTarget.style.boxShadow = colors.closeGlow;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.closeBg;
            e.currentTarget.style.color = colors.closeColor;
            e.currentTarget.style.boxShadow = '0 0 0 0 transparent';
          }}
        >
          <svg className="w-5 h-5 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div 
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: colors.iconBg, border: colors.iconBorder }}
          >
            <svg className="w-8 h-8" style={{ color: colors.iconColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 
            className="text-2xl font-semibold mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: colors.titleColor }}
          >
            {isRainbowBridge ? "Choose Your Pet's Photo" : "Choose Your Pet Photo"}
          </h3>
          <p style={{ color: colors.subtitleColor }}>
            {isRainbowBridge ? "Select a cherished photo of your beloved companion" : "Select a clear, well-lit photo of your pet (1 or 2 pets OK!)"}
          </p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer"
          style={{
            borderColor: isDragging ? colors.dropzoneActiveBorder : colors.dropzoneBorder,
            backgroundColor: isDragging ? colors.dropzoneActiveBg : colors.dropzoneBg
          }}
          onClick={() => {
            try {
              inputRef.current?.click();
            } catch (error) {
              console.error("File input error:", error);
              setError("Unable to access files. Please check your browser permissions or try a different browser.");
            }
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="flex flex-col items-center gap-4">
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ 
                backgroundColor: isDragging ? colors.dropzoneActiveBg : colors.iconBg,
                color: colors.iconColor
              }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            
            <div>
              <p className="font-medium" style={{ color: colors.textPrimary }}>
                {isDragging ? "Drop your photo here" : "Drag & drop your photo here"}
              </p>
              <p className="text-sm mt-1" style={{ color: colors.textSecondary }}>
                or click to browse
              </p>
            </div>
            
            <p className="text-xs" style={{ color: colors.textSecondary }}>
              JPEG, PNG, or WebP • Max 10MB
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div 
            className="mt-4 p-3 rounded-lg text-sm text-center"
            style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: isRainbowBridge ? '#DC2626' : '#F87171'
            }}
          >
            {error}
          </div>
        )}

        {/* Tips */}
        <div 
          className="mt-6 p-4 rounded-xl"
          style={{ backgroundColor: colors.tipBg, border: colors.tipBorder }}
        >
          <p className="text-sm" style={{ color: colors.subtitleColor }}>
            <span className="font-medium" style={{ color: colors.tipAccent }}>💡 Tip:</span>{" "}
            {isRainbowBridge 
              ? "Photos where you can clearly see their face create the most beautiful memorials."
              : "Photos with 1 or 2 pets work great! We'll auto-detect and create a portrait for all your furry friends."
            }
          </p>
        </div>
      </div>
    </div>
  );
}
