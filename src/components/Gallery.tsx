"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";

interface Sample {
  id: number;
  title: string;
  pet: string;
  image: string;
}

const samples: Sample[] = [
  // New gallery images first
  {
    id: 101,
    title: "Noble Portrait",
    pet: "Royal Companion",
    image: "/samples/gallery0.png",
  },
  {
    id: 102,
    title: "Aristocratic Grace",
    pet: "Distinguished Pet",
    image: "/samples/gallery001.png",
  },
  {
    id: 103,
    title: "Regal Majesty",
    pet: "Noble Spirit",
    image: "/samples/gallery1.png",
  },
  {
    id: 104,
    title: "Royal Elegance",
    pet: "Cherished Friend",
    image: "/samples/gallery 2.png",
  },
  {
    id: 105,
    title: "Majestic Beauty",
    pet: "Beloved Companion",
    image: "/samples/gallery3.png",
  },
  {
    id: 106,
    title: "Imperial Charm",
    pet: "Treasured Pet",
    image: "/samples/gallery4.png",
  },
  // Original gallery images
  {
    id: 1,
    title: "Her Majesty Beatrix",
    pet: "Tabby Cat",
    image: "/samples/Gracie.png",
  },
  {
    id: 2,
    title: "Charley & Lily",
    pet: "Royal Duo",
    image: "/samples/charley&Lily2.png",
  },
  {
    id: 3,
    title: "Sir Duke",
    pet: "Distinguished Gentleman",
    image: "/samples/Duke.png",
  },
  {
    id: 4,
    title: "Lady Bella",
    pet: "Elegant Beauty",
    image: "/samples/Bella.png",
  },
  {
    id: 5,
    title: "Lord Bailey",
    pet: "Noble Companion",
    image: "/samples/Bailey.png",
  },
];

export default function Gallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const [selectedImage, setSelectedImage] = useState<Sample | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setSelectedImage(null);
    setIsZoomed(false);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeLightbox();
      }
    };

    if (selectedImage) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden"; // Prevent background scroll
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = ""; // Restore scroll
    };
  }, [selectedImage, closeLightbox]);

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

  return (
    <section 
      ref={sectionRef} 
      className="py-24 px-6" 
      id="gallery"
      style={{ backgroundColor: 'rgba(20, 20, 20, 0.5)' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 reveal">
          <span 
            className="uppercase tracking-[0.3em] text-sm font-medium mb-4 block"
            style={{ color: '#C5A572' }}
          >
            The Gallery
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Royal Pet Portraits
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: '#B8B2A8' }}>
            Behold the noble creatures who have been immortalized in the classical tradition. 
            Your pet could be next.
          </p>
        </div>

        {/* Gallery Grid - 2 columns on mobile, 3 on tablet, 4 on desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {samples.map((sample, index) => (
            <div
              key={sample.id}
              className="reveal"
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div 
                className="group cursor-pointer"
                onClick={() => setSelectedImage(sample)}
              >
                {/* Image with glow effect */}
                <div 
                  className="relative aspect-[3/4] overflow-hidden rounded-lg transition-all duration-300 group-hover:scale-[1.02]"
                  style={{ 
                    backgroundColor: '#1A1A1A',
                    boxShadow: '0 0 20px rgba(197, 165, 114, 0.3), 0 0 40px rgba(197, 165, 114, 0.15)',
                  }}
                >
                    {/* Actual Image */}
                    <Image
                      src={sample.image}
                      alt={`${sample.title} - ${sample.pet}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                    
                    {/* Hover overlay */}
                    <div 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
                    >
                      <div className="text-center text-white p-4">
                        <svg 
                          className="w-10 h-10 mx-auto mb-2 opacity-80"
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                        <p 
                          className="text-xl mb-1"
                          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                        >
                          {sample.title}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                          Click to view
                        </p>
                      </div>
                    </div>
                  </div>

                {/* Caption */}
                <div className="mt-2 sm:mt-4 text-center">
                  <h3 
                    className="text-sm sm:text-lg lg:text-xl group-hover:text-[#C5A572] transition-colors"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
                  >
                    {sample.title}
                  </h3>
                  <p className="text-xs sm:text-sm hidden sm:block" style={{ color: '#7A756D' }}>{sample.pet}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.95)' }}
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 p-2 rounded-full transition-all hover:scale-110"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: '#F0EDE8'
            }}
            aria-label="Close"
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Zoom toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
            className="absolute top-4 left-4 sm:top-6 sm:left-6 z-10 p-2 rounded-full transition-all hover:scale-110"
            style={{ 
              backgroundColor: isZoomed ? 'rgba(197, 165, 114, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              color: '#F0EDE8'
            }}
            aria-label={isZoomed ? "Zoom out" : "Zoom in"}
          >
            {isZoomed ? (
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
              </svg>
            ) : (
              <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            )}
          </button>

          {/* Image container */}
          <div 
            className={`relative transition-all duration-300 ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
            style={{
              maxWidth: isZoomed ? '100%' : '90vh',
              maxHeight: isZoomed ? '100%' : '85vh',
              width: isZoomed ? '100vw' : 'auto',
              height: isZoomed ? '100vh' : 'auto',
              overflow: isZoomed ? 'auto' : 'visible'
            }}
          >
            {/* Gold frame effect */}
            <div 
              className={`relative ${isZoomed ? '' : 'p-1 sm:p-2'}`}
              style={{ 
                background: isZoomed ? 'transparent' : 'linear-gradient(135deg, #E8D4B0 0%, #C5A572 50%, #E8D4B0 100%)',
                borderRadius: isZoomed ? '0' : '8px',
                boxShadow: isZoomed ? 'none' : '0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(197, 165, 114, 0.2)'
              }}
            >
              <div className={`relative ${isZoomed ? '' : 'rounded-md overflow-hidden'}`}>
                <Image
                  src={selectedImage.image}
                  alt={`${selectedImage.title} - ${selectedImage.pet}`}
                  width={isZoomed ? 2000 : 1000}
                  height={isZoomed ? 2000 : 1000}
                  className="object-contain"
                  style={{
                    maxHeight: isZoomed ? 'none' : '80vh',
                    width: isZoomed ? '100vw' : 'auto',
                    height: isZoomed ? 'auto' : 'auto'
                  }}
                  priority
                />
              </div>
            </div>
          </div>

          {/* Image info */}
          {!isZoomed && (
            <div 
              className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 
                className="text-2xl sm:text-3xl mb-1"
                style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
              >
                {selectedImage.title}
              </h3>
              <p className="text-sm" style={{ color: '#C5A572' }}>{selectedImage.pet}</p>
              <p className="text-xs mt-2" style={{ color: '#7A756D' }}>
                Click image to zoom • Press ESC to close
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
