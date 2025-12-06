"use client";

import { useState } from "react";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupportModal({ isOpen, onClose }: SupportModalProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(5);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCustom, setShowCustom] = useState(false);

  if (!isOpen) return null;

  const handleDonate = async () => {
    const amount = showCustom ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount < 1) {
      alert("Please enter a valid amount (minimum $1)");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create donation");
      }
    } catch (error) {
      console.error("Donation error:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 animate-fade-in-up"
        style={{ 
          background: 'linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)',
          border: '1px solid rgba(197, 165, 114, 0.2)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 40px rgba(197, 165, 114, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full transition-colors hover:bg-white/10"
          style={{ color: '#7A756D' }}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Heart icon */}
        <div className="flex justify-center mb-4">
          <div 
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ 
              background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.2) 0%, rgba(197, 165, 114, 0.1) 100%)',
              boxShadow: '0 0 30px rgba(197, 165, 114, 0.2)'
            }}
          >
            <svg className="w-8 h-8" style={{ color: '#C5A572' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 
          className="text-2xl sm:text-3xl text-center mb-2"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
        >
          Support LumePet
        </h2>

        {/* Personal message */}
        <div className="text-center mb-6" style={{ color: '#B8B2A8' }}>
          <p className="text-sm leading-relaxed mb-3">
            Hi, I&apos;m Chris — a fellow pet parent who built LumePet to celebrate the incredible bond we share with our furry family members.
          </p>
          <p className="text-sm leading-relaxed mb-3">
            Every portrait we create uses advanced technology that costs real money to run. Your support helps keep LumePet alive so more pet parents can treasure their companions forever.
          </p>
          <p className="text-xs italic" style={{ color: '#C5A572' }}>
            Even a small contribution makes a huge difference. Thank you from the bottom of my heart. 💛
          </p>
        </div>

        {/* Amount selection */}
        <div className="mb-6">
          <p className="text-sm mb-3 text-center" style={{ color: '#7A756D' }}>
            Choose an amount
          </p>
          
          {!showCustom ? (
            <div className="flex gap-3 justify-center mb-3">
              {[1, 5, 10].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSelectedAmount(amount)}
                  className={`px-5 py-3 rounded-xl font-medium transition-all duration-200 ${
                    selectedAmount === amount ? 'scale-105' : 'hover:scale-105'
                  }`}
                  style={{
                    background: selectedAmount === amount 
                      ? 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)'
                      : 'rgba(197, 165, 114, 0.1)',
                    border: `1px solid ${selectedAmount === amount ? '#C5A572' : 'rgba(197, 165, 114, 0.3)'}`,
                    color: selectedAmount === amount ? '#0A0A0A' : '#C5A572',
                    boxShadow: selectedAmount === amount ? '0 4px 20px rgba(197, 165, 114, 0.3)' : 'none',
                  }}
                >
                  ${amount}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex justify-center mb-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg" style={{ color: '#C5A572' }}>$</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-40 pl-8 pr-4 py-3 rounded-xl text-center text-lg font-medium"
                  style={{
                    background: 'rgba(197, 165, 114, 0.1)',
                    border: '1px solid rgba(197, 165, 114, 0.3)',
                    color: '#F0EDE8',
                    outline: 'none',
                  }}
                  autoFocus
                />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              setShowCustom(!showCustom);
              if (!showCustom) setSelectedAmount(null);
            }}
            className="block mx-auto text-sm transition-colors hover:underline"
            style={{ color: '#7A756D' }}
          >
            {showCustom ? '← Back to preset amounts' : 'Enter custom amount'}
          </button>
        </div>

        {/* Donate button */}
        <button
          onClick={handleDonate}
          disabled={isLoading || (showCustom && (!customAmount || parseFloat(customAmount) < 1))}
          className="w-full py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
            color: '#0A0A0A',
            boxShadow: '0 8px 30px rgba(197, 165, 114, 0.3)',
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              Support with ${showCustom ? (customAmount || '0') : selectedAmount}
            </span>
          )}
        </button>

        {/* Secure payment note */}
        <p className="text-xs text-center mt-4" style={{ color: '#5A5650' }}>
          🔒 Secure payment via Stripe • One-time contribution
        </p>
      </div>
    </div>
  );
}

