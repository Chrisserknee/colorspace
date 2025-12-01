"use client";

import React from "react";

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * ProtectedImage Component
 * 
 * Wraps images with protection to prevent casual downloading:
 * - Uses CSS background-image instead of <img> tag (harder to inspect)
 * - Invisible overlay blocks pointer events
 * - Disables right-click context menu
 * - Prevents drag-and-drop
 * - Disables tap-and-hold on mobile
 * 
 * Note: This cannot prevent screenshots or determined users from finding
 * the image URL. The watermark remains the ultimate protection.
 */
export default function ProtectedImage({ 
  src, 
  alt, 
  className = ""
}: ProtectedImageProps) {
  // Prevent right-click and drag
  const preventInteraction = (e: React.MouseEvent | React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div 
      className={`protected-image-container relative ${className}`}
      style={{ 
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    >
      {/* Image rendered as background - harder to inspect than <img> */}
      <div
        className="protected-image"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          pointerEvents: "none",
        } as React.CSSProperties}
        role="img"
        aria-label={alt}
      />

      {/* Invisible overlay that captures interactions and prevents downloading */}
      <div
        className="protected-image-overlay"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 10,
          backgroundColor: "transparent",
          cursor: "default",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
        } as React.CSSProperties}
        onContextMenu={preventInteraction}
        onDragStart={preventInteraction}
        onMouseDown={preventInteraction}
      />
    </div>
  );
}

