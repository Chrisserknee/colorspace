"use client";

import Link from "next/link";
import { AppConfig } from "@/lib/apps/types";

interface AppFooterProps {
  config: AppConfig;
  onContactClick?: () => void;
}

export default function AppFooter({ config, onContactClick }: AppFooterProps) {
  return (
    <footer 
      className="py-12 px-4 sm:px-6"
      style={{ 
        borderTop: `1px solid ${config.theme.primaryColor}15`,
        background: 'linear-gradient(180deg, transparent 0%, rgba(26, 26, 26, 0.5) 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Name */}
          <div className="flex items-center gap-3">
            {config.logo ? (
              <img 
                src={config.logo} 
                alt={config.name} 
                className="w-10 h-10 object-contain"
                style={{ filter: `drop-shadow(0 0 10px ${config.theme.primaryColor}40)` }}
              />
            ) : (
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ 
                  background: config.theme.buttonGradient,
                }}
              >
                <span className="text-lg font-bold text-white">
                  {config.name.charAt(0)}
                </span>
              </div>
            )}
            <span 
              className="text-xl"
              style={{ 
                fontFamily: config.theme.fontFamily || "'Cormorant Garamond', Georgia, serif",
                color: '#F0EDE8',
              }}
            >
              {config.name}
            </span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link 
              href="/"
              className="text-sm transition-colors duration-200 hover:opacity-80"
              style={{ color: '#7A756D' }}
            >
              All Apps
            </Link>
            {onContactClick && (
              <button
                onClick={onContactClick}
                className="text-sm transition-colors duration-200 hover:opacity-80"
                style={{ color: '#7A756D' }}
              >
                Contact
              </button>
            )}
            <Link 
              href={`/${config.slug}/about`}
              className="text-sm transition-colors duration-200 hover:opacity-80"
              style={{ color: '#7A756D' }}
            >
              About
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-sm" style={{ color: '#7A756D' }}>
            © {new Date().getFullYear()} {config.name}
          </p>
        </div>

        {/* Tagline */}
        <p 
          className="text-center text-sm mt-6"
          style={{ color: config.theme.primaryColor, opacity: 0.6 }}
        >
          {config.tagline}
        </p>
      </div>
    </footer>
  );
}


