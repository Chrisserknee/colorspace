"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Handle mouse/touch movement
  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percentage);
    setHasInteracted(true);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleMove(e.clientX);
  }, [handleMove]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Global mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Intersection observer for reveal animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );

    const elements = sectionRef.current?.querySelectorAll(".reveal");
    elements?.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Auto-animate slider on first view
  useEffect(() => {
    if (hasInteracted) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasInteracted) {
            // Animate from 50 to 25 to 75 to 50
            const animate = async () => {
              await new Promise(r => setTimeout(r, 500));
              if (hasInteracted) return;
              
              // Smooth animation
              let pos = 50;
              const animateTo = (target: number, duration: number) => {
                return new Promise<void>((resolve) => {
                  const start = pos;
                  const startTime = Date.now();
                  const tick = () => {
                    const elapsed = Date.now() - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    // Ease out cubic
                    const eased = 1 - Math.pow(1 - progress, 3);
                    pos = start + (target - start) * eased;
                    setSliderPosition(pos);
                    if (progress < 1 && !hasInteracted) {
                      requestAnimationFrame(tick);
                    } else {
                      resolve();
                    }
                  };
                  tick();
                });
              };
              
              await animateTo(20, 800);
              await new Promise(r => setTimeout(r, 300));
              await animateTo(80, 1200);
              await new Promise(r => setTimeout(r, 300));
              await animateTo(50, 600);
            };
            
            animate();
          }
        });
      },
      { threshold: 0.5 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [hasInteracted]);

  return (
    <section ref={sectionRef} className="py-12 sm:py-20 px-6" id="how-it-works">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8 sm:mb-12 reveal">
          <span 
            className="uppercase tracking-[0.3em] text-xs sm:text-sm font-medium mb-3 block"
            style={{ color: '#C5A572' }}
          >
            The Transformation
          </span>
          <h2 
            className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-3"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            From Photo to Masterpiece
          </h2>
          <p className="text-sm sm:text-base max-w-md mx-auto" style={{ color: '#B8B2A8' }}>
            Drag the slider to see the royal transformation
          </p>
        </div>

        {/* Before/After Slider */}
        <div className="reveal" style={{ transitionDelay: '150ms' }}>
          <div 
            ref={containerRef}
            className="relative w-full aspect-[4/5] sm:aspect-[3/4] max-w-lg mx-auto rounded-2xl overflow-hidden shadow-2xl cursor-ew-resize select-none"
            style={{ 
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(197, 165, 114, 0.15)',
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* After Image (Full width, underneath) */}
            <div className="absolute inset-0">
              <Image
                src="/samples/after.png"
                alt="Royal pet portrait"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 512px"
                quality={95}
                priority
                draggable={false}
              />
              {/* After Label */}
              <div 
                className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider backdrop-blur-sm"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.9)',
                  color: '#1A1815',
                }}
              >
                After
              </div>
            </div>

            {/* Before Image (Clipped) */}
            <div 
              className="absolute inset-0 overflow-hidden"
              style={{ 
                clipPath: `inset(0 ${100 - sliderPosition}% 0 0)`,
              }}
            >
              <Image
                src="/samples/before.png"
                alt="Original pet photo"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 512px"
                quality={95}
                priority
                draggable={false}
              />
              {/* Before Label */}
              <div 
                className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider backdrop-blur-sm"
                style={{ 
                  backgroundColor: 'rgba(240, 237, 232, 0.9)',
                  color: '#1A1815',
                }}
              >
                Before
              </div>
            </div>

            {/* Slider Handle */}
            <div 
              className="absolute top-0 bottom-0 w-1 -translate-x-1/2 z-10"
              style={{ 
                left: `${sliderPosition}%`,
                backgroundColor: '#C5A572',
                boxShadow: '0 0 20px rgba(197, 165, 114, 0.5)',
              }}
            >
              {/* Handle Circle */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-transform duration-150"
                style={{ 
                  backgroundColor: '#C5A572',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  transform: `translate(-50%, -50%) scale(${isDragging ? 1.1 : 1})`,
                }}
              >
                {/* Arrows */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#1A1815]">
                  <path d="M8 12L4 12M4 12L6.5 9.5M4 12L6.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 12L20 12M20 12L17.5 9.5M20 12L17.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>

            {/* Decorative Frame Corners */}
            <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 rounded-tl-lg pointer-events-none" style={{ borderColor: 'rgba(197, 165, 114, 0.4)' }} />
            <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 rounded-tr-lg pointer-events-none" style={{ borderColor: 'rgba(197, 165, 114, 0.4)' }} />
            <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 rounded-bl-lg pointer-events-none" style={{ borderColor: 'rgba(197, 165, 114, 0.4)' }} />
            <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 rounded-br-lg pointer-events-none" style={{ borderColor: 'rgba(197, 165, 114, 0.4)' }} />
          </div>

          {/* Instructions */}
          <p 
            className="text-center mt-6 text-xs sm:text-sm flex items-center justify-center gap-2"
            style={{ color: '#8A857D' }}
          >
            <span className="inline-block animate-pulse">👆</span>
            Drag to compare • Upload your pet to see the magic
          </p>
        </div>

        {/* Quick Steps Below */}
        <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 reveal" style={{ transitionDelay: '300ms' }}>
          {[
            { step: "1", title: "Upload", desc: "Any clear photo" },
            { step: "2", title: "Transform", desc: "AI royal portrait" },
            { step: "3", title: "Download", desc: "4K masterpiece" },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-base sm:text-lg font-semibold"
                style={{ 
                  backgroundColor: 'rgba(197, 165, 114, 0.1)',
                  color: '#C5A572',
                  border: '1px solid rgba(197, 165, 114, 0.2)',
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                }}
              >
                {item.step}
              </div>
              <h3 
                className="text-sm sm:text-base font-medium mb-0.5"
                style={{ color: '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                {item.title}
              </h3>
              <p className="text-xs" style={{ color: '#8A857D' }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
