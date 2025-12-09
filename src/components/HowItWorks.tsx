"use client";

import { useEffect, useRef } from "react";

const steps = [
  {
    number: "01",
    title: "Upload",
    description: "Select your favorite photo of your beloved pet. Any clear image works beautifully.",
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "We Paint",
    description: "Our master painters transform your pet into a stunning royal oil painting masterpiece.",
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Download",
    description: "Purchase to unlock your 4K resolution, museum-quality portrait. Print and frame it!",
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

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
    <section ref={sectionRef} className="py-12 sm:py-16 px-6" id="how-it-works">
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-8 sm:mb-10 reveal">
          <span 
            className="uppercase tracking-[0.3em] text-xs sm:text-sm font-medium mb-2 block"
            style={{ color: '#C5A572' }}
          >
            Simple Process
          </span>
          <h2 
            className="text-2xl sm:text-3xl md:text-4xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            How it works
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 md:gap-8">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="reveal"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="card text-center group h-full p-3 sm:p-5">
                {/* Number */}
                <div 
                  className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 transition-colors"
                  style={{ 
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: 'rgba(197, 165, 114, 0.2)' 
                  }}
                >
                  {step.number}
                </div>
                
                {/* Icon */}
                <div 
                  className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                  style={{ 
                    backgroundColor: 'rgba(197, 165, 114, 0.1)',
                    color: '#C5A572',
                    border: '1px solid rgba(197, 165, 114, 0.2)'
                  }}
                >
                  {step.icon}
                </div>
                
                {/* Title */}
                <h3 
                  className="text-base sm:text-xl md:text-2xl font-semibold mb-1 sm:mb-2"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
                >
                  {step.title}
                </h3>
                
                {/* Description */}
                <p className="text-xs sm:text-sm hidden sm:block" style={{ color: '#B8B2A8', lineHeight: 1.6 }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
