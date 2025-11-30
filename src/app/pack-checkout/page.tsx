"use client";

import { useState } from "react";
import Link from "next/link";

export default function PackCheckoutPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          type: "pack",
          packType: "2-pack",
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
        className="w-full max-w-md p-8 rounded-2xl"
        style={{ 
          backgroundColor: '#1A1A1A',
          border: '1px solid rgba(197, 165, 114, 0.3)',
        }}
      >
        <div className="text-center mb-8">
          <h1 
            className="text-3xl font-semibold mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            2-Pack Purchase
          </h1>
          <p style={{ color: '#B8B2A8' }}>
            Get 2 watermarked generations for just $5
          </p>
        </div>

        <div 
          className="p-4 rounded-xl mb-6 text-center"
          style={{ 
            backgroundColor: 'rgba(197, 165, 114, 0.1)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
          }}
        >
          <p className="text-2xl font-bold" style={{ color: '#C5A572' }}>$5.00</p>
          <p className="text-sm" style={{ color: '#7A756D' }}>2 watermarked generations</p>
          <p className="text-xs mt-1" style={{ color: '#7A756D' }}>(does not include HD version)</p>
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
            className="w-full py-4 rounded-xl font-semibold text-lg transition-all"
            style={{ 
              backgroundColor: loading ? '#8B7355' : '#C5A572', 
              color: '#1A1A1A',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Processing..." : "Pay $5 with Stripe"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link 
            href="/"
            className="text-sm transition-colors hover:underline"
            style={{ color: '#7A756D' }}
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

