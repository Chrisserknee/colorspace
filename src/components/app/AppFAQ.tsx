"use client";

import { useState } from "react";
import { AppConfig } from "@/lib/apps/types";

interface AppFAQProps {
  config: AppConfig;
}

function FAQItem({ 
  question, 
  answer, 
  isOpen, 
  onToggle,
  config,
}: { 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onToggle: () => void;
  config: AppConfig;
}) {
  return (
    <div 
      className="border-b transition-colors duration-300"
      style={{ borderColor: `${config.theme.primaryColor}20` }}
    >
      <button
        onClick={onToggle}
        className="w-full py-5 flex items-center justify-between text-left group"
      >
        <h3 
          className="text-lg sm:text-xl pr-4 transition-colors duration-300"
          style={{ 
            fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
            color: isOpen ? config.theme.primaryColor : '#F0EDE8',
          }}
        >
          {question}
        </h3>
        <div 
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isOpen ? 'rotate-45' : ''}`}
          style={{ 
            background: isOpen ? config.theme.buttonGradient : `${config.theme.primaryColor}20`,
            color: isOpen ? 'white' : config.theme.primaryColor,
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
      </button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? 'max-h-96 opacity-100 pb-5' : 'max-h-0 opacity-0'}`}
      >
        <p 
          className="text-base"
          style={{ color: '#B8B2A8' }}
        >
          {answer}
        </p>
      </div>
    </div>
  );
}

export default function AppFAQ({ config }: AppFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 
            className="text-3xl sm:text-4xl mb-4"
            style={{ 
              fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
              color: '#F0EDE8',
            }}
          >
            Frequently Asked Questions
          </h2>
          <p style={{ color: '#B8B2A8' }}>
            Everything you need to know about {config.name}
          </p>
        </div>

        {/* FAQ Items */}
        <div 
          className="rounded-2xl p-6 sm:p-8"
          style={{ 
            background: 'rgba(26, 26, 26, 0.5)',
            border: `1px solid ${config.theme.primaryColor}15`,
          }}
        >
          {config.content.faq.map((item, index) => (
            <FAQItem
              key={index}
              question={item.question}
              answer={item.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              config={config}
            />
          ))}
        </div>
      </div>
    </section>
  );
}


