"use client";

import { useEffect, useRef, useCallback } from "react";
import Image from "next/image";

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const hasInteractedRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isHorizontalDragRef = useRef(false);

  // Direct DOM update for smooth performance
  const updateSliderPosition = useCallback((percentage: number) => {
    if (sliderRef.current) {
      sliderRef.current.style.left = `${percentage}%`;
    }
    if (beforeRef.current) {
      beforeRef.current.style.width = `${percentage}%`;
    }
  }, []);

  // Handle mouse/touch movement
  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    updateSliderPosition(percentage);
  }, [updateSliderPosition]);

  const handleStart = useCallback((clientX: number) => {
    // Immediately stop any running animation
    hasInteractedRef.current = true;
    isDraggingRef.current = true;
    if (handleRef.current) {
      handleRef.current.style.transform = 'translate(-50%, -50%) scale(1.1)';
    }
    handleMove(clientX);
  }, [handleMove]);

  const handleEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (handleRef.current) {
      handleRef.current.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  }, []);

  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      handleStart(e.clientX);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      handleMove(e.clientX);
    };

    const onMouseUp = () => {
      handleEnd();
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      isHorizontalDragRef.current = false;
      // Don't prevent default yet - wait to see if it's horizontal or vertical
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;
      
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
      
      // Determine if this is a horizontal drag (slider) or vertical scroll
      if (!isHorizontalDragRef.current && deltaX > 10) {
        // If horizontal movement is significant, treat as slider drag
        if (deltaX > deltaY * 1.5) {
          isHorizontalDragRef.current = true;
          isDraggingRef.current = true;
          hasInteractedRef.current = true;
          if (handleRef.current) {
            handleRef.current.style.transform = 'translate(-50%, -50%) scale(1.1)';
          }
          e.preventDefault();
          handleMove(touch.clientX);
          return;
        }
      }
      
      // If we've determined it's a horizontal drag, continue with slider
      if (isHorizontalDragRef.current && isDraggingRef.current) {
        e.preventDefault();
        handleMove(touch.clientX);
      }
      // Otherwise, let the browser handle scrolling (don't prevent default)
    };

    const onTouchEnd = () => {
      handleEnd();
      touchStartRef.current = null;
      isHorizontalDragRef.current = false;
    };

    // Container events
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    // Window events for mouse
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleStart, handleMove, handleEnd]);

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
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasInteractedRef.current) {
            const animate = async () => {
              await new Promise(r => setTimeout(r, 500));
              if (hasInteractedRef.current) return;
              
              let pos = 50;
              const animateTo = (target: number, duration: number) => {
                return new Promise<void>((resolve) => {
                  // Exit immediately if user has interacted
                  if (hasInteractedRef.current) {
                    resolve();
                    return;
                  }
                  
                  const start = pos;
                  const startTime = performance.now();
                  const tick = (now: number) => {
                    // Check at start of every frame - exit immediately if user interacted
                    if (hasInteractedRef.current) {
                      resolve();
                      return;
                    }
                    
                    const elapsed = now - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const eased = 1 - Math.pow(1 - progress, 3);
                    pos = start + (target - start) * eased;
                    updateSliderPosition(pos);
                    
                    if (progress < 1) {
                      requestAnimationFrame(tick);
                    } else {
                      resolve();
                    }
                  };
                  requestAnimationFrame(tick);
                });
              };
              
              await animateTo(20, 800);
              if (hasInteractedRef.current) return;
              await new Promise(r => setTimeout(r, 300));
              if (hasInteractedRef.current) return;
              await animateTo(80, 1200);
              if (hasInteractedRef.current) return;
              await new Promise(r => setTimeout(r, 300));
              if (hasInteractedRef.current) return;
              await animateTo(50, 600);
            };
            
            animate();
          }
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [updateSliderPosition]);

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
              touchAction: 'pan-y',
            }}
          >
            {/* After Image (Full width, underneath) */}
            <div className="absolute inset-0">
              <Image
                src="/samples/after.png"
                alt="Royal pet portrait"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 800px"
                unoptimized
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

            {/* Before Image Container - uses width instead of clip-path */}
            <div 
              ref={beforeRef}
              className="absolute top-0 left-0 bottom-0 overflow-hidden"
              style={{ 
                width: '50%',
                willChange: 'width',
              }}
            >
              {/* Before Image - fixed to container width */}
              <div className="absolute inset-0" style={{ width: containerRef.current?.offsetWidth || '100vw' }}>
                <Image
                  src="/samples/before.png"
                  alt="Original pet photo"
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 800px"
                  unoptimized
                  priority
                  draggable={false}
                  style={{ maxWidth: 'none', width: '100%' }}
                />
              </div>
              {/* Before Label */}
              <div 
                className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider backdrop-blur-sm z-10"
                style={{ 
                  backgroundColor: 'rgba(240, 237, 232, 0.9)',
                  color: '#1A1815',
                }}
              >
                Before
              </div>
            </div>

            {/* Slider Handle - hidden on mobile for smoother feel */}
            <div 
              ref={sliderRef}
              className="hidden sm:block absolute top-0 bottom-0 w-1 z-10 pointer-events-none -translate-x-1/2"
              style={{ 
                left: '50%',
                backgroundColor: '#C5A572',
                boxShadow: '0 0 20px rgba(197, 165, 114, 0.5)',
                willChange: 'left',
              }}
            >
              {/* Handle Circle */}
              <div 
                ref={handleRef}
                className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full flex items-center justify-center"
                style={{ 
                  backgroundColor: '#C5A572',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                  transform: 'translate(-50%, -50%) scale(1)',
                  transition: 'transform 0.15s ease-out',
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
