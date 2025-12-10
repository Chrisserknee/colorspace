"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { trackTikTokCompletePayment } from "@/lib/tiktok";
import { trackMetaPurchase } from "@/lib/meta-pixel";
import { CONFIG } from "@/lib/config";

function CanvasSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const imageId = searchParams.get("imageId");
  const size = searchParams.get("size");

  const sizeDisplay = size === "16x16" ? '16" × 16"' : '12" × 12"';
  
  // Track ref to prevent duplicate conversion events
  const conversionTrackedRef = useRef(false);
  
  // Track Canvas Purchase conversion for TikTok & Meta Pixel
  useEffect(() => {
    // Only track once per page load
    if (conversionTrackedRef.current) return;
    
    // Determine canvas purchase value
    const purchaseValue = size === "16x16" 
      ? CONFIG.CANVAS_16X16_PRICE_AMOUNT / 100 
      : CONFIG.CANVAS_12X12_PRICE_AMOUNT / 100;
    const contentName = `Canvas Print ${sizeDisplay}`;
    
    // TikTok Pixel: Track CompletePayment
    trackTikTokCompletePayment({
      content_id: imageId || "canvas",
      content_name: contentName,
      value: purchaseValue,
      quantity: 1,
    });
    
    // Meta Pixel: Track Purchase
    trackMetaPurchase({
      content_ids: imageId ? [imageId] : ["canvas"],
      content_name: contentName,
      value: purchaseValue,
      num_items: 1,
    });
    
    conversionTrackedRef.current = true;
    console.log(`📱 TikTok Pixel: CompletePayment tracked - $${purchaseValue} for ${contentName}`);
    console.log(`📘 Meta Pixel: Purchase tracked - $${purchaseValue} for ${contentName}`);
  }, [imageId, size, sizeDisplay]);

  return (
    <div className="min-h-screen bg-renaissance py-12 px-6">
      <div className="max-w-2xl mx-auto">
        {/* Success header */}
        <div className="text-center mb-10 animate-fade-in-up">
          <div 
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ 
              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
              border: '2px solid rgba(34, 197, 94, 0.3)' 
            }}
          >
            <span className="text-5xl">🖼️</span>
          </div>
          
          <h1 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Canvas Order Confirmed!
          </h1>
          
          <p className="text-lg mb-6" style={{ color: '#B8B2A8' }}>
            Your {sizeDisplay} museum-quality canvas is being prepared
          </p>

          {/* Order confirmation badge */}
          <div 
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full"
            style={{ 
              backgroundColor: 'rgba(34, 197, 94, 0.1)', 
              border: '1px solid rgba(34, 197, 94, 0.3)' 
            }}
          >
            <svg className="w-5 h-5" style={{ color: '#4ADE80' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span style={{ color: '#4ADE80' }}>Payment Successful</span>
          </div>
        </div>

        {/* What happens next */}
        <div className="card animate-fade-in-up delay-200 mb-8">
          <h3 
            className="text-xl mb-6 text-center"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            What Happens Next?
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)', border: '1px solid rgba(197, 165, 114, 0.3)' }}
              >
                <span className="text-lg">1</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1" style={{ color: '#F0EDE8' }}>Production Begins</h4>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Your portrait is being printed on premium canvas with archival-quality inks.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)', border: '1px solid rgba(197, 165, 114, 0.3)' }}
              >
                <span className="text-lg">2</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1" style={{ color: '#F0EDE8' }}>Quality Check</h4>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Each canvas is inspected for color accuracy and print quality.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'rgba(197, 165, 114, 0.15)', border: '1px solid rgba(197, 165, 114, 0.3)' }}
              >
                <span className="text-lg">3</span>
              </div>
              <div>
                <h4 className="font-semibold mb-1" style={{ color: '#F0EDE8' }}>Shipped to You</h4>
                <p className="text-sm" style={{ color: '#B8B2A8' }}>
                  Carefully packaged and shipped. You&apos;ll receive tracking info via email.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline estimate */}
        <div 
          className="card animate-fade-in-up delay-300 mb-8 text-center"
          style={{ 
            background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.08) 0%, rgba(197, 165, 114, 0.02) 100%)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
          }}
        >
          <div className="text-4xl mb-3">📦</div>
          <h4 
            className="text-lg mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Estimated Delivery
          </h4>
          <p className="text-2xl font-semibold mb-2" style={{ color: '#C5A572' }}>
            5-10 Business Days
          </p>
          <p className="text-sm" style={{ color: '#7A756D' }}>
            Production: 2-4 days • Shipping: 3-6 days
          </p>
        </div>

        {/* Confirmation details */}
        {sessionId && (
          <div className="text-center animate-fade-in-up delay-400 mb-8">
            <p className="text-sm" style={{ color: '#7A756D' }}>
              Order Reference: <span className="font-mono">{sessionId.substring(0, 16)}...</span>
            </p>
          </div>
        )}

        {/* Back home link */}
        <div className="text-center animate-fade-in-up delay-500">
          <Link 
            href="/" 
            className="btn-primary inline-flex text-lg px-8 py-4"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
            </svg>
            Create Another Portrait
          </Link>
          
          <p className="text-sm mt-4" style={{ color: '#7A756D' }}>
            Questions? Contact us at support@lumepet.app
          </p>
        </div>
      </div>
    </div>
  );
}

export default function CanvasSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-renaissance flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <div 
              className="w-16 h-16 rounded-full animate-spin"
              style={{ 
                borderWidth: '4px',
                borderStyle: 'solid',
                borderColor: 'rgba(197, 165, 114, 0.2)',
                borderTopColor: '#C5A572'
              }}
            />
          </div>
          <p style={{ color: '#B8B2A8' }}>Loading order details...</p>
        </div>
      </div>
    }>
      <CanvasSuccessContent />
    </Suspense>
  );
}

