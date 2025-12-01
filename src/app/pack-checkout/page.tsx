"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

type PackType = "1" | "5" | "10";

interface PackInfo {
  id: PackType;
  name: string;
  price: string;
  priceAmount: number;
  portraits: number;
  packType: string;
  badge?: string;
  badgeColor?: string;
  featured?: boolean;
}

const PACKS: PackInfo[] = [
  {
    id: "1",
    name: "Starter",
    price: "$1",
    priceAmount: 1,
    portraits: 1,
    packType: "1-pack",
  },
  {
    id: "5",
    name: "Popular",
    price: "$5",
    priceAmount: 5,
    portraits: 5,
    packType: "5-pack",
    badge: "BEST VALUE",
    badgeColor: "#4ADE80",
    featured: true,
  },
  {
    id: "10",
    name: "Pro",
    price: "$10",
    priceAmount: 10,
    portraits: 10,
    packType: "10-pack",
    badge: "MOST SAVINGS",
    badgeColor: "#60A5FA",
  },
];

function PackCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const packParam = searchParams.get("pack") as PackType | null;
  const emailParam = searchParams.get("email");
  
  const [selectedPack, setSelectedPack] = useState<PackType>(packParam || "5");
  const [email, setEmail] = useState(emailParam || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update selected pack and email when URL params change
  useEffect(() => {
    if (packParam && ["1", "5", "10"].includes(packParam)) {
      setSelectedPack(packParam);
    }
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [packParam, emailParam]);

  const currentPack = PACKS.find(p => p.id === selectedPack) || PACKS[1];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build cancel URL to return to this page with email pre-filled
      const cancelUrl = `/pack-checkout?pack=${selectedPack}&email=${encodeURIComponent(email)}`;
      
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          type: "pack",
          packType: currentPack.packType,
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
        className="w-full max-w-lg p-6 sm:p-8 rounded-2xl"
        style={{ 
          backgroundColor: '#1A1A1A',
          border: '1px solid rgba(197, 165, 114, 0.3)',
        }}
      >
        <div className="text-center mb-6">
          <h1 
            className="text-2xl sm:text-3xl font-semibold mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            ✨ Unlock More Portraits
          </h1>
          <p style={{ color: '#B8B2A8' }}>
            Choose a pack that works for you
          </p>
          <p className="text-xs mt-2 italic" style={{ color: '#C5A572' }}>
            95% of LumePet users unlock more portraits after their first 2.
          </p>
        </div>

        {/* Pack Selection */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => setSelectedPack(pack.id)}
              className={`relative p-4 rounded-xl text-center transition-all ${
                selectedPack === pack.id ? 'scale-105' : 'hover:scale-102'
              }`}
              style={{ 
                backgroundColor: selectedPack === pack.id 
                  ? (pack.featured ? '#C5A572' : 'rgba(197, 165, 114, 0.2)')
                  : 'rgba(197, 165, 114, 0.08)',
                border: selectedPack === pack.id 
                  ? `2px solid ${pack.featured ? '#D4B896' : '#C5A572'}`
                  : '1px solid rgba(197, 165, 114, 0.2)',
                boxShadow: selectedPack === pack.id && pack.featured
                  ? '0 4px 20px rgba(197, 165, 114, 0.4)'
                  : 'none',
              }}
            >
              {pack.badge && (
                <span 
                  className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap"
                  style={{ backgroundColor: pack.badgeColor, color: '#1A1A1A' }}
                >
                  {pack.badge}
                </span>
              )}
              <p 
                className="text-xs mb-1 font-medium"
                style={{ 
                  color: selectedPack === pack.id && pack.featured ? '#1A1A1A' : '#B8B2A8'
                }}
              >
                {pack.name}
              </p>
              <p 
                className="text-2xl sm:text-3xl font-bold"
                style={{ 
                  color: selectedPack === pack.id 
                    ? (pack.featured ? '#1A1A1A' : '#F0EDE8')
                    : '#C5A572'
                }}
              >
                {pack.price}
              </p>
              <p 
                className="text-sm mt-1"
                style={{ 
                  color: selectedPack === pack.id && pack.featured ? '#2D2A26' : '#7A756D'
                }}
              >
                {pack.portraits} portrait{pack.portraits > 1 ? 's' : ''}
              </p>
            </button>
          ))}
        </div>

        {/* Selected Pack Summary */}
        <div 
          className="p-4 rounded-xl mb-6 text-center"
          style={{ 
            backgroundColor: 'rgba(197, 165, 114, 0.1)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
          }}
        >
          <p className="text-sm mb-1" style={{ color: '#B8B2A8' }}>Selected:</p>
          <p className="text-xl font-bold" style={{ color: '#C5A572' }}>
            {currentPack.name} Pack - {currentPack.price}
          </p>
          <p className="text-sm" style={{ color: '#7A756D' }}>
            {currentPack.portraits} watermarked portrait{currentPack.portraits > 1 ? 's' : ''}
          </p>
          <p className="text-xs mt-1" style={{ color: '#5A5650' }}>
            HD versions available for $19.99 each
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block mb-2 text-sm" style={{ color: '#B8B2A8' }}>
            Enter your email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 rounded-xl text-lg mb-4 outline-none"
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '2px solid rgba(197, 165, 114, 0.3)',
              color: '#F0EDE8',
            }}
            required
          />

          {error && (
            <p className="text-center text-sm mb-4" style={{ color: '#F87171' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl font-semibold text-lg transition-all hover:scale-[1.02]"
            style={{ 
              backgroundColor: loading ? '#8B7355' : '#C5A572', 
              color: '#1A1A1A',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Processing..." : `Pay ${currentPack.price} with Stripe`}
          </button>
        </form>

        <div className="mt-6 text-center">
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

export default function PackCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F0F0F' }}>
        <div className="text-center" style={{ color: '#B8B2A8' }}>Loading...</div>
      </div>
    }>
      <PackCheckoutContent />
    </Suspense>
  );
}
