"use client";

import { JSX } from "react";
import { AppConfig } from "@/lib/apps/types";

interface AppHowItWorksProps {
  config: AppConfig;
}

const iconMap: { [key: string]: JSX.Element } = {
  camera: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  download: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  heart: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  magic: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
};

export default function AppHowItWorks({ config }: AppHowItWorksProps) {
  return (
    <section className="py-16 sm:py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 
            className="text-3xl sm:text-4xl mb-4"
            style={{ 
              fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
              color: '#F0EDE8',
            }}
          >
            How It Works
          </h2>
          <p style={{ color: '#B8B2A8' }}>
            Three simple steps to your magical artwork
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-12">
          {config.content.howItWorks.map((step, index) => (
            <div 
              key={step.step}
              className="text-center group"
            >
              {/* Step Number & Icon */}
              <div className="relative mb-6 inline-block">
                {/* Glow effect */}
                <div 
                  className="absolute inset-0 rounded-full blur-xl opacity-50 group-hover:opacity-80 transition-opacity duration-300"
                  style={{ background: config.theme.buttonGradient }}
                />
                
                {/* Icon container */}
                <div 
                  className="relative w-20 h-20 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ 
                    background: config.theme.buttonGradient,
                    boxShadow: `0 10px 30px ${config.theme.primaryColor}40`,
                  }}
                >
                  <div style={{ color: 'white' }}>
                    {iconMap[step.icon] || iconMap.sparkles}
                  </div>
                </div>
                
                {/* Step number badge */}
                <div 
                  className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ 
                    background: '#0A0A0A',
                    border: `2px solid ${config.theme.primaryColor}`,
                    color: config.theme.primaryColor,
                  }}
                >
                  {step.step}
                </div>
              </div>

              {/* Title */}
              <h3 
                className="text-xl sm:text-2xl mb-3"
                style={{ 
                  fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
                  color: '#F0EDE8',
                }}
              >
                {step.title}
              </h3>

              {/* Description */}
              <p 
                className="text-sm sm:text-base max-w-xs mx-auto"
                style={{ color: '#B8B2A8' }}
              >
                {step.description}
              </p>

              {/* Connector line (not on last item) */}
              {index < config.content.howItWorks.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[calc(100%+1rem)] w-[calc(100%-2rem)]">
                  <div 
                    className="h-0.5 w-full opacity-30"
                    style={{ background: `linear-gradient(90deg, ${config.theme.primaryColor}, transparent)` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}


