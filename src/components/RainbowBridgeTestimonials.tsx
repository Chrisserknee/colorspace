"use client";

import { useEffect, useRef } from "react";

const testimonials = [
  {
    id: 1,
    quote: "When I lost my sweet Max, I didn't know how to honor his memory. This portrait captures his gentle spirit perfectly. It brings me comfort every time I look at it, knowing he's at peace.",
    author: "Sarah M.",
    pet: "Max",
  },
  {
    id: 2,
    quote: "The quote they chose was exactly what I needed to hear. Seeing my Bella surrounded by light and love helps me remember she's waiting for me at the Rainbow Bridge. Truly beautiful.",
    author: "Michael T.",
    pet: "Bella",
  },
  {
    id: 3,
    quote: "I've been struggling with grief since my cat passed. This memorial portrait gave me a way to celebrate her life. It's displayed in our home and brings tears of both sadness and joy.",
    author: "Emily K.",
    pet: "Luna",
  },
];

export default function RainbowBridgeTestimonials() {
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
    <section
      ref={sectionRef}
      className="py-20 sm:py-24 px-6"
      id="testimonials"
      style={{
        background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.5), rgba(248, 246, 243, 0.8))',
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16 reveal">
          <h2
            className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: '#4A4A4A',
            }}
          >
            Comforting Memories
          </h2>
          <p
            className="text-sm sm:text-base tracking-wide"
            style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: '#6B6B6B',
              fontStyle: 'italic',
            }}
          >
            Stories from families who found peace through memorial portraits
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8 sm:gap-10">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className="reveal"
              style={{ transitionDelay: `${index * 150}ms` }}
            >
              <div
                className="h-full p-6 sm:p-8 rounded-2xl relative shadow-lg"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  border: '1px solid rgba(212, 175, 55, 0.2)',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                }}
              >
                {/* Quote mark */}
                <div
                  className="absolute -top-3 left-6"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: '4rem',
                    lineHeight: 1,
                    color: 'rgba(212, 175, 55, 0.25)',
                  }}
                >
                  "
                </div>

                {/* Quote text */}
                <blockquote
                  className="text-sm sm:text-base leading-relaxed mb-6 pt-4"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    color: '#4A4A4A',
                    fontStyle: 'italic',
                  }}
                >
                  "{testimonial.quote}"
                </blockquote>

                {/* Author */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-1 h-8 rounded-full"
                    style={{ backgroundColor: '#D4AF37' }}
                  />
                  <div>
                    <p
                      className="text-sm font-semibold"
                      style={{ color: '#4A4A4A' }}
                    >
                      {testimonial.author}
                    </p>
                    <p
                      className="text-xs"
                      style={{ color: '#6B6B6B' }}
                    >
                      Remembering {testimonial.pet}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

