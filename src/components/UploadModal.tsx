"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelected: (file: File) => void;
  onFilesSelected?: (files: File[]) => void; // New: for multi-pet support
  theme?: "default" | "rainbow-bridge";
  allowMultiple?: boolean; // New: enable 2-pet mode
}

export default function UploadModal({ isOpen, onClose, onFileSelected, onFilesSelected, theme = "default", allowMultiple = false }: UploadModalProps) {
  const isRainbowBridge = theme === "rainbow-bridge";
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  // Multi-pet state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      // Clean up preview URLs on close
      previewUrls.forEach(url => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviewUrls([]);
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    if (allowMultiple) {
      // Multi-pet mode: add file to selection (max 2)
      const file = files[0];
      if (file.size === 0 && file.name === '') return;
      
      if (validateFile(file)) {
        if (selectedFiles.length < 2) {
          const newFiles = [...selectedFiles, file];
          setSelectedFiles(newFiles);
          
          // Create preview URL
          const url = URL.createObjectURL(file);
          setPreviewUrls(prev => [...prev, url]);
        } else {
          setError("Maximum 2 pets allowed. Remove one to add another.");
        }
      }
    } else {
      // Single pet mode (original behavior)
      const file = files[0];
      if (file) {
        if (file.size === 0 && file.name === '') return;
        if (validateFile(file)) {
          onFileSelected(file);
        }
      }
    }
    
    // Reset input to allow selecting same file again
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };
  
  // Remove a pet from multi-pet selection
  const handleRemovePet = (index: number) => {
    // Revoke the preview URL
    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setError(null);
  };
  
  // Confirm multi-pet selection and proceed
  const handleConfirmMultiPet = () => {
    if (selectedFiles.length === 0) {
      setError("Please add at least one pet photo.");
      return;
    }
    
    if (selectedFiles.length === 1) {
      // Single pet - use original callback
      onFileSelected(selectedFiles[0]);
    } else if (selectedFiles.length === 2 && onFilesSelected) {
      // Two pets - use new multi-pet callback
      onFilesSelected(selectedFiles);
    }
    
    // Clean up preview URLs
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviewUrls([]);
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
    if (!file) return;
    
    if (allowMultiple) {
      // Multi-pet mode
      if (validateFile(file)) {
        if (selectedFiles.length < 2) {
          setSelectedFiles(prev => [...prev, file]);
          const url = URL.createObjectURL(file);
          setPreviewUrls(prev => [...prev, url]);
        } else {
          setError("Maximum 2 pets allowed. Remove one to add another.");
        }
      }
    } else {
      // Single pet mode
      if (validateFile(file)) {
        onFileSelected(file);
      }
    }
  }, [onFileSelected, allowMultiple, selectedFiles.length]);

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
            {isRainbowBridge ? "Choose Your Pet's Photo" : allowMultiple ? "Add Your Pets (Up to 2)" : "Choose Your Pet Photo"}
          </h3>
          <p style={{ color: colors.subtitleColor }}>
            {isRainbowBridge 
              ? "Select a cherished photo of your beloved companion" 
              : allowMultiple 
                ? "Add 1-2 pets to create a portrait together!" 
                : "Select a clear, well-lit photo of your pet"
            }
          </p>
        </div>
        
        {/* Multi-pet preview - shown when allowMultiple is true and files are selected */}
        {allowMultiple && selectedFiles.length > 0 && (
          <div className="mb-6">
            <p className="text-sm text-center mb-3" style={{ color: colors.subtitleColor }}>
              {selectedFiles.length === 1 ? "1 pet added" : "2 pets added"} • {selectedFiles.length < 2 ? "Add another or continue" : "Ready to generate!"}
            </p>
            <div className="flex justify-center gap-4">
              {selectedFiles.map((file, index) => (
                <div key={index} className="relative">
                  <div 
                    className="w-24 h-24 rounded-xl overflow-hidden shadow-lg"
                    style={{ border: `2px solid ${colors.iconColor}` }}
                  >
                    <Image
                      src={previewUrls[index]}
                      alt={`Pet ${index + 1}`}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => handleRemovePet(index)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
                    style={{ 
                      backgroundColor: '#EF4444', 
                      color: 'white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <p className="text-xs text-center mt-1" style={{ color: colors.subtitleColor }}>
                    Pet {index + 1}
                  </p>
                </div>
              ))}
              
              {/* Add another pet slot */}
              {selectedFiles.length < 2 && (
                <div 
                  className="w-24 h-24 rounded-xl border-2 border-dashed flex items-center justify-center cursor-pointer transition-all hover:scale-105"
                  style={{ borderColor: colors.dropzoneBorder }}
                  onClick={() => inputRef.current?.click()}
                >
                  <div className="text-center">
                    <svg className="w-6 h-6 mx-auto mb-1" style={{ color: colors.iconColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <p className="text-xs" style={{ color: colors.subtitleColor }}>Add Pet</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Continue button for multi-pet */}
            <div className="mt-4 text-center">
              <button
                onClick={handleConfirmMultiPet}
                className="px-8 py-3 rounded-xl font-semibold transition-all hover:scale-105"
                style={{ 
                  backgroundColor: colors.iconColor, 
                  color: isRainbowBridge ? '#FFFFFF' : '#1A1A1A',
                  boxShadow: `0 4px 15px ${isRainbowBridge ? 'rgba(212, 175, 55, 0.4)' : 'rgba(197, 165, 114, 0.4)'}`
                }}
              >
                {selectedFiles.length === 2 ? "✨ Generate Duo Portrait" : "Continue with 1 Pet"}
              </button>
            </div>
          </div>
        )}

        {/* Drop zone - hide if multi-pet mode and 2 pets selected */}
        {(!allowMultiple || selectedFiles.length < 2) && (
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
                  {isDragging ? "Drop your photo here" : allowMultiple && selectedFiles.length === 1 ? "Add your second pet" : "Drag & drop your photo here"}
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
        )}

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
              : allowMultiple 
                ? "For duo portraits, use clear photos where each pet's face is visible. They'll be painted together!"
                : "Front-facing photos with good lighting produce the most majestic royal portraits!"
            }
          </p>
        </div>
      </div>
    </div>
  );
}
