"use client";

import { useState, useEffect } from "react";

interface SessionData {
  email: string;
  imageId: string;
  previewUrl: string;
  petName?: string;
  timestamp: number;
  type: 'lumepet' | 'rainbow-bridge';
}

interface ResumeButtonProps {
  variant?: 'lumepet' | 'rainbow-bridge';
  className?: string;
}

export default function ResumeButton({ variant = 'lumepet', className = '' }: ResumeButtonProps) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check if already dismissed this session
    const dismissed = sessionStorage.getItem('resume_dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    const stored = localStorage.getItem('lumepet_last_session');
    if (stored) {
      try {
        const data: SessionData = JSON.parse(stored);
        // Check if session is less than 24 hours old
        const ageHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);
        if (ageHours < 24 && data.email) {
          setSession(data);
          // Small delay for smooth entrance
          setTimeout(() => setIsVisible(true), 500);
        }
      } catch {
        // Invalid data, ignore
      }
    }
  }, []);

  const handleResume = () => {
    if (!session?.email) return;
    
    // Navigate to the appropriate page with email param
    const basePath = session.type === 'rainbow-bridge' ? '/rainbow-bridge' : '/';
    window.location.href = `${basePath}?email=${encodeURIComponent(session.email)}`;
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('resume_dismissed', 'true');
    setTimeout(() => setIsDismissed(true), 300);
  };

  if (!session || isDismissed) return null;

  const isRainbow = variant === 'rainbow-bridge';
  const goldColor = isRainbow ? '#D4AF37' : '#C5A572';
  const bgColor = isRainbow ? 'rgba(212, 175, 55, 0.08)' : 'rgba(197, 165, 114, 0.1)';
  const borderColor = isRainbow ? 'rgba(212, 175, 55, 0.2)' : 'rgba(197, 165, 114, 0.2)';

  return (
    <div 
      className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      } ${className}`}
    >
      <div 
        className="rounded-2xl p-4 shadow-2xl backdrop-blur-sm"
        style={{ 
          backgroundColor: isRainbow ? 'rgba(255, 255, 255, 0.95)' : 'rgba(20, 20, 20, 0.95)',
          border: `1px solid ${borderColor}`,
          boxShadow: `0 10px 40px rgba(0,0,0,0.2), 0 0 20px ${goldColor}20`,
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110"
          style={{ 
            backgroundColor: bgColor,
            color: isRainbow ? '#666' : '#888',
          }}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          {/* Preview thumbnail */}
          {session.previewUrl && (
            <div 
              className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: `2px solid ${borderColor}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={session.previewUrl}
                alt="Your portrait"
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <p 
              className="text-sm font-medium truncate"
              style={{ color: isRainbow ? '#333' : '#F0EDE8' }}
            >
              {session.petName ? `${session.petName}'s Portrait` : 'Your Portrait'}
            </p>
            <p 
              className="text-xs truncate"
              style={{ color: isRainbow ? '#666' : '#888' }}
            >
              Continue where you left off
            </p>
          </div>

          <button
            onClick={handleResume}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105 flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${goldColor} 0%, ${isRainbow ? '#C9A227' : '#A68B5B'} 100%)`,
              color: '#FFF',
              boxShadow: `0 4px 12px ${goldColor}40`,
            }}
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
}

