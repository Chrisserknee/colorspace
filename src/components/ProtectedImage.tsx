"use client";

import { useState, useEffect, useCallback } from "react";

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
  blurOnFocusLoss?: boolean;
}

/**
 * ProtectedImage Component
 * 
 * Wraps images with multiple layers of protection to prevent casual downloading:
 * - Uses CSS background-image instead of <img> tag (harder to inspect)
 * - Invisible overlay blocks all pointer events
 * - Disables right-click context menu
 * - Prevents drag-and-drop
 * - Disables tap-and-hold on mobile
 * - Blurs image when window loses focus (deters screen sharing)
 * 
 * Note: This cannot prevent screenshots or determined users from finding
 * the image URL. The watermark remains the ultimate protection.
 */
export default function ProtectedImage({ 
  src, 
  alt, 
  className = "",
  blurOnFocusLoss = true 
}: ProtectedImageProps) {
  const [isBlurred, setIsBlurred] = useState(false);

  // Handle window focus/blur for screen share deterrence
  const handleFocus = useCallback(() => {
    setIsBlurred(false);
  }, []);

  const handleBlur = useCallback(() => {
    if (blurOnFocusLoss) {
      setIsBlurred(true);
    }
  }, [blurOnFocusLoss]);

  const handleVisibilityChange = useCallback(() => {
    if (blurOnFocusLoss) {
      setIsBlurred(document.hidden);
    }
  }, [blurOnFocusLoss]);

  useEffect(() => {
    if (!blurOnFocusLoss) return;

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [blurOnFocusLoss, handleFocus, handleBlur, handleVisibilityChange]);

  // Prevent all default interactions
  const preventInteraction = (e: React.MouseEvent | React.TouchEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div 
      className={`protected-image-container relative ${className}`}
      style={{ overflow: "hidden" }}
    >
      {/* Image rendered as background - harder to inspect than <img> */}
      <div
        className="protected-image absolute inset-0"
        style={{
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          filter: isBlurred ? "blur(20px)" : "none",
          transition: "filter 0.3s ease",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          pointerEvents: "none",
        } as React.CSSProperties}
        role="img"
        aria-label={alt}
      />

      {/* Blur overlay message when focus is lost */}
      {isBlurred && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
        >
          <p 
            className="text-white text-center text-sm px-4"
            style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
          >
            Return to this tab to view your portrait
          </p>
        </div>
      )}

      {/* Invisible overlay that captures all interactions */}
      <div
        className="protected-image-overlay absolute inset-0 z-20"
        style={{
          backgroundColor: "transparent",
          cursor: "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as React.CSSProperties}
        onContextMenu={preventInteraction}
        onDragStart={preventInteraction}
        onMouseDown={preventInteraction}
        onTouchStart={(e) => {
          // Allow single taps but prevent long press
          // Long press typically triggers after ~500ms
        }}
        onTouchEnd={preventInteraction}
      />
    </div>
  );
}

