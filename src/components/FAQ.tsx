"use client";

import { useState, useEffect, useRef } from "react";

const faqs = [
  {
    question: "Is my photo safe?",
    answer: "Absolutely. Your photos are processed securely and are automatically deleted from our servers after 24 hours. We never share or use your images for any purpose other than creating your portrait.",
  },
  {
    question: "How long does it take?",
    answer: "The transformation typically takes about 30-60 seconds. You'll see a progress indicator while your pet is being immortalized in the classical style.",
  },
  {
    question: "What do I get after purchase?",
    answer: "You receive a high-resolution, watermark-free digital image (2048x2048 pixels) perfect for printing. Frame it, share it, or use it as a stunning profile picture!",
  },
  {
    question: "What kind of photos work best?",
    answer: "Clear, well-lit photos where your pet's face is visible work best. We can work with almost any pet photo, but front-facing shots with good lighting produce the most majestic results.",
  },
  {
    question: "Can I get a refund?",
    answer: "Since this is a digital product created specifically for you, we cannot offer refunds. However, if you're not satisfied with your portrait, contact us and we'll work with you to create something you'll love.",
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
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
    <section ref={sectionRef} className="py-24 px-6" id="faq">
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-16 reveal">
          <span 
            className="uppercase tracking-[0.3em] text-sm font-medium mb-4 block"
            style={{ color: '#C5A572' }}
          >
            Questions & Answers
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Frequently Asked
          </h2>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="reveal"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="card !p-0 overflow-hidden">
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 transition-colors"
                  style={{ backgroundColor: openIndex === index ? 'rgba(197, 165, 114, 0.05)' : 'transparent' }}
                >
                  <span 
                    className="text-lg font-medium"
                    style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
                  >
                    {faq.question}
                  </span>
                  <span 
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${openIndex === index ? 'rotate-180' : ''}`}
                    style={{ backgroundColor: 'rgba(197, 165, 114, 0.1)' }}
                  >
                    <svg className="w-4 h-4" style={{ color: '#C5A572' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </button>
                
                <div className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-96' : 'max-h-0'}`}>
                  <div 
                    className="px-6 pb-5 leading-relaxed pt-4"
                    style={{ 
                      color: '#B8B2A8',
                      borderTop: '1px solid rgba(197, 165, 114, 0.1)'
                    }}
                  >
                    {faq.answer}
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
