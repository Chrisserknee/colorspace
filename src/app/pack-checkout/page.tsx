"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function UnlimitedCheckoutContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build cancel URL to return to this page
      const cancelUrl = `/pack-checkout`;
      
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "unlimited-session",
          cancelUrl,
        }),
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setError(data.error || "Failed to create checkout session");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0F0F0F' }}>
      <div 
        className="w-full max-w-md p-6 sm:p-8 rounded-2xl text-center"
        style={{ 
          backgroundColor: '#1A1A1A',
          border: '1px solid rgba(197, 165, 114, 0.3)',
        }}
      >
        {/* Logo */}
        <div className="mb-4">
          <Image
            src="/samples/LumePet2.png"
            alt="LumePet"
            width={80}
            height={80}
            className="mx-auto object-contain"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(255, 220, 100, 0.4))'
            }}
          />
        </div>

        {/* Title */}
        <h1 
          className="text-2xl sm:text-3xl font-semibold mb-2"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
        >
          ✨ Royal Unlimited Session
        </h1>
        
        {/* Price */}
        <div className="mb-4">
          <span 
            className="text-4xl sm:text-5xl font-bold"
            style={{ color: '#C5A572' }}
          >
            $4.99
          </span>
        </div>

        {/* Description */}
        <p className="text-base mb-6" style={{ color: '#B8B2A8' }}>
          Create <span style={{ color: '#C5A572', fontWeight: 600 }}>unlimited portraits</span> for the next 2 hours.
          <br />
          <span className="text-sm">Perfect for trying different photos and styles!</span>
        </p>

        {/* Features */}
        <div 
          className="p-4 rounded-xl mb-6 text-left"
          style={{ 
            backgroundColor: 'rgba(197, 165, 114, 0.08)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
          }}
        >
          <ul className="space-y-2 text-sm" style={{ color: '#B8B2A8' }}>
            <li className="flex items-center gap-2">
              <span style={{ color: '#4ADE80' }}>✓</span>
              Unlimited generations for 2 hours
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: '#4ADE80' }}>✓</span>
              Try different photos of your pets
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: '#4ADE80' }}>✓</span>
              Experiment with male & female styles
            </li>
            <li className="flex items-center gap-2">
              <span style={{ color: '#4ADE80' }}>✓</span>
              Keep your favorites, purchase later
            </li>
          </ul>
        </div>

        {/* Note about HD */}
        <p className="text-xs mb-6" style={{ color: '#7A756D' }}>
          All generated portraits are watermarked previews.
          <br />
          Unlock any portrait in full 4K resolution for $19.99.
        </p>

        {/* Error */}
        {error && (
          <p className="text-center text-sm mb-4" style={{ color: '#F87171' }}>
            {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02]"
          style={{ 
            backgroundColor: loading ? '#8B7355' : '#C5A572', 
            color: '#1A1A1A',
            opacity: loading ? 0.7 : 1,
            boxShadow: '0 4px 20px rgba(197, 165, 114, 0.4)',
          }}
        >
          {loading ? "Processing..." : "Start Unlimited Session — $4.99"}
        </button>

        {/* Back link */}
        <div className="mt-6">
          <button 
            onClick={() => router.back()}
            className="text-sm transition-colors hover:underline cursor-pointer bg-transparent border-none"
            style={{ color: '#7A756D' }}
          >
            ← Back to my portrait
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UnlimitedCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="text-center" style={{ color: '#B8B2A8' }}>Loading...</div>
      </div>
    }>
      <UnlimitedCheckoutContent />
    </Suspense>
  );
}
