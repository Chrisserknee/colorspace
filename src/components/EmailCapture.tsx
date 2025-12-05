"use client";

import { useState } from "react";

export default function EmailCapture() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/lume-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          context: {
            source: "royal-club-signup",
            signupLocation: "homepage-footer",
          },
          source: "royal-club",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to subscribe");
      }

      setIsSuccess(true);
      setEmail("");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      className="py-16 sm:py-20 px-6"
      style={{
        background: `
          linear-gradient(180deg, 
            rgba(253, 251, 247, 0.03) 0%, 
            rgba(253, 251, 247, 0.08) 30%,
            rgba(253, 251, 247, 0.08) 70%,
            rgba(253, 251, 247, 0.03) 100%
          )
        `,
        borderTop: '1px solid rgba(197, 165, 114, 0.15)',
        borderBottom: '1px solid rgba(197, 165, 114, 0.15)',
      }}
    >
      <div className="max-w-xl mx-auto text-center">
        {/* Crown Icon */}
        <div 
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
          style={{
            background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.2) 0%, rgba(197, 165, 114, 0.1) 100%)',
            border: '1px solid rgba(197, 165, 114, 0.3)',
          }}
        >
          <svg 
            className="w-8 h-8" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            style={{ color: '#C5A572' }}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M12 3l2.5 5.5L20 10l-4 4.5L17 21l-5-3-5 3 1-6.5L4 10l5.5-1.5L12 3z" 
            />
          </svg>
        </div>

        {/* Headline */}
        <h2 
          className="text-3xl sm:text-4xl font-semibold mb-4"
          style={{ 
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            color: '#F0EDE8',
            letterSpacing: '-0.01em',
          }}
        >
          Join The LumePet Royal Club
        </h2>

        {/* Subtext */}
        <p 
          className="text-base sm:text-lg mb-8 leading-relaxed max-w-md mx-auto"
          style={{ color: '#B8B2A8' }}
        >
          Get early access to new portrait styles, exclusive discounts, and be entered in our monthly giveaway for free custom pet portraits.
        </p>

        {/* Success State */}
        {isSuccess ? (
          <div 
            className="py-6 px-8 rounded-2xl inline-flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.08) 100%)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-green-400 font-medium">
              Welcome to the Royal Club! Check your inbox soon.
            </span>
          </div>
        ) : (
          <>
            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto mb-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 px-5 py-4 rounded-xl text-base outline-none transition-all duration-200"
                style={{
                  background: 'rgba(26, 26, 26, 0.6)',
                  border: '1px solid rgba(197, 165, 114, 0.25)',
                  color: '#F0EDE8',
                  fontSize: '16px', // Prevents iOS zoom
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'rgba(197, 165, 114, 0.5)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(197, 165, 114, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(197, 165, 114, 0.25)';
                  e.target.style.boxShadow = 'none';
                }}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative px-8 py-4 rounded-xl font-bold text-sm sm:text-base whitespace-nowrap transition-all duration-300 hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, #C5A572 0%, #B8956A 50%, #A68B5B 100%)',
                  color: '#0A0A0A',
                  boxShadow: '0 4px 25px rgba(197, 165, 114, 0.4), 0 0 40px rgba(197, 165, 114, 0.15)',
                }}
              >
                {/* Shimmer effect */}
                <span 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                    transform: 'translateX(-100%)',
                    animation: 'shimmer 2s infinite',
                  }}
                />
                {isSubmitting ? (
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Joining...
                  </span>
                ) : (
                  <span className="relative flex items-center justify-center gap-2">
                    {/* Desktop: short text, Mobile: full text */}
                    <span className="hidden sm:inline">Join & Win 🎁</span>
                    <span className="sm:hidden">Join for a Chance to Win! 🎁</span>
                  </span>
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}
          </>
        )}

        {/* Trust Line */}
        <p 
          className="text-sm mt-6 flex items-center justify-center gap-2"
          style={{ color: '#7A756D' }}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#C5A572' }}>
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
          </svg>
          No spam. Only the cutest updates.
        </p>
      </div>
    </section>
  );
}

