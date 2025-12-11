"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAllApps, hubConfig, AppConfig } from "@/lib/apps";

// App Card Component
function AppCard({ app, index }: { app: AppConfig; index: number }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <Link 
      href={`/${app.slug}`}
      className="group block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="relative rounded-2xl overflow-hidden transition-all duration-500 transform hover:scale-[1.02] hover:-translate-y-2"
        style={{
          background: `linear-gradient(135deg, ${app.theme.gradientFrom}15 0%, ${app.theme.gradientTo}10 100%)`,
          border: `1px solid ${app.theme.primaryColor}30`,
          boxShadow: isHovered 
            ? `0 25px 50px -12px ${app.theme.primaryColor}40, 0 0 60px ${app.theme.glowColor}`
            : `0 10px 40px -15px ${app.theme.primaryColor}20`,
          animationDelay: `${index * 100}ms`,
        }}
      >
        {/* Glow effect on hover */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, ${app.theme.primaryColor}15 0%, transparent 70%)`,
          }}
        />
        
        {/* Card Content */}
        <div className="relative p-6 sm:p-8">
          {/* App Logo/Icon */}
          <div className="mb-6 flex justify-center">
            {app.logo ? (
              <div 
                className="relative w-24 h-24 sm:w-28 sm:h-28 transition-transform duration-500 group-hover:scale-110"
                style={{
                  filter: `drop-shadow(0 0 20px ${app.theme.primaryColor}60)`,
                }}
              >
                <Image
                  src={app.logo}
                  alt={`${app.name} logo`}
                  fill
                  className="object-contain"
                />
              </div>
            ) : (
              <div 
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110"
                style={{
                  background: app.theme.buttonGradient,
                  boxShadow: `0 10px 40px ${app.theme.primaryColor}40`,
                }}
              >
                <span 
                  className="text-4xl sm:text-5xl font-bold text-white"
                  style={{ fontFamily: app.theme.fontFamily }}
                >
                  {app.name.charAt(0)}
                </span>
              </div>
            )}
          </div>
          
          {/* App Name */}
          <h2 
            className="text-2xl sm:text-3xl font-semibold text-center mb-2 transition-colors duration-300"
            style={{ 
              fontFamily: app.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
              color: isHovered ? app.theme.primaryColor : '#F0EDE8',
            }}
          >
            {app.name}
          </h2>
          
          {/* Tagline */}
          <p 
            className="text-sm sm:text-base text-center mb-4"
            style={{ color: app.theme.primaryColor }}
          >
            {app.tagline}
          </p>
          
          {/* Description */}
          <p 
            className="text-sm text-center mb-6"
            style={{ color: '#B8B2A8' }}
          >
            {app.description}
          </p>
          
          {/* Sample Images (if available) */}
          {app.heroImages.length > 0 && (
            <div className="flex justify-center gap-3 mb-6">
              {app.heroImages.slice(0, 2).map((img, i) => (
                <div 
                  key={i}
                  className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{
                    boxShadow: `0 8px 25px ${app.theme.primaryColor}30`,
                    border: `2px solid ${app.theme.primaryColor}40`,
                  }}
                >
                  <Image
                    src={img}
                    alt={`${app.name} sample`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* CTA Button */}
          <div className="flex justify-center">
            <div 
              className="px-6 py-3 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 group-hover:scale-105"
              style={{
                background: app.theme.buttonGradient,
                color: 'white',
                boxShadow: isHovered 
                  ? `0 10px 30px ${app.theme.primaryColor}50`
                  : `0 5px 20px ${app.theme.primaryColor}30`,
              }}
            >
              {app.content.ctaText} →
            </div>
          </div>
        </div>
        
        {/* Bottom accent line */}
        <div 
          className="h-1 w-full transition-all duration-500"
          style={{
            background: app.theme.buttonGradient,
            opacity: isHovered ? 1 : 0.5,
          }}
        />
      </div>
    </Link>
  );
}

export default function HubPage() {
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    setApps(getAllApps());
    setIsLoaded(true);
  }, []);

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-[50vh] flex flex-col items-center justify-center px-4 sm:px-6 pt-12 pb-8 overflow-hidden">
        {/* Background decorations */}
        <div 
          className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-30" 
          style={{ background: 'linear-gradient(135deg, #C5A572 0%, #F472B6 100%)' }} 
        />
        <div 
          className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl opacity-20" 
          style={{ background: 'linear-gradient(135deg, #A78BFA 0%, #8B3A42 100%)' }} 
        />
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-10" 
          style={{ background: 'radial-gradient(circle, #C5A572 0%, transparent 70%)' }} 
        />
        
        {/* Content */}
        <div className={`relative z-10 text-center max-w-4xl mx-auto transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Logo */}
          <div className="mb-6 flex justify-center">
            {hubConfig.logo ? (
              <div 
                className="relative w-20 h-20 sm:w-24 sm:h-24"
                style={{
                  animation: 'float 3s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 20px rgba(197, 165, 114, 0.5))',
                }}
              >
                <Image
                  src={hubConfig.logo}
                  alt="Color"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
            ) : (
              <div 
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center"
                style={{
                  animation: 'float 3s ease-in-out infinite',
                  background: 'linear-gradient(135deg, #F472B6 0%, #C5A572 50%, #A78BFA 100%)',
                  boxShadow: '0 10px 40px rgba(197, 165, 114, 0.4)',
                }}
              >
                <span 
                  className="text-4xl font-bold text-white"
                  style={{ fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  C
                </span>
              </div>
            )}
          </div>
          
          {/* Title */}
          <h1 
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-light mb-4"
            style={{ 
              fontFamily: "'EB Garamond', 'Cormorant Garamond', Georgia, serif",
              color: '#F0EDE8',
              letterSpacing: '0.02em',
              textShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            {hubConfig.name}
          </h1>
          
          {/* Tagline */}
          <p 
            className="text-lg sm:text-xl md:text-2xl mb-3"
            style={{ 
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: '#C5A572',
              letterSpacing: '0.05em',
            }}
          >
            {hubConfig.tagline}
          </p>
          
          {/* Description */}
          <p 
            className="text-base sm:text-lg max-w-2xl mx-auto"
            style={{ color: '#B8B2A8' }}
          >
            {hubConfig.description}
          </p>
        </div>
      </section>
      
      {/* Apps Grid */}
      <section className="px-4 sm:px-6 py-12 max-w-7xl mx-auto">
        <div className={`text-center mb-12 transition-all duration-1000 delay-300 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h2 
            className="text-2xl sm:text-3xl font-light mb-2"
            style={{ 
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              color: '#F0EDE8',
            }}
          >
            Choose Your Creative Experience
          </h2>
          <p style={{ color: '#7A756D' }}>
            Select an app to start creating
          </p>
        </div>
        
        {/* Apps Grid */}
        <div 
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          {apps.map((app, index) => (
            <AppCard key={app.id} app={app} index={index} />
          ))}
        </div>
      </section>
      
      {/* Coming Soon Section */}
      <section className="px-4 sm:px-6 py-16 text-center">
        <div 
          className={`transition-all duration-1000 delay-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}
        >
          <p 
            className="text-sm uppercase tracking-widest mb-2"
            style={{ color: '#7A756D' }}
          >
            More Apps Coming Soon
          </p>
          <p 
            className="text-base"
            style={{ color: '#B8B2A8' }}
          >
            We&apos;re constantly creating new AI-powered art experiences
          </p>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4 text-center">
        <p style={{ color: '#7A756D', fontSize: '0.875rem' }}>
          © {new Date().getFullYear()} Color. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
