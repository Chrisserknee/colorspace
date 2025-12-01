"use client";

import React from "react";
/* eslint-disable @next/next/no-img-element */

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * ProtectedImage Component
 * 
 * Wraps images with basic protection to prevent casual downloading:
 * - Disables right-click context menu
 * - Prevents drag-and-drop
 * - Disables tap-and-hold on mobile via CSS
 * 
 * Note: This cannot prevent screenshots or determined users.
 * The watermark remains the ultimate protection.
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
      {/* Actual image with protection styles */}
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        style={{
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          pointerEvents: "none",
          WebkitUserDrag: "none",
        } as React.CSSProperties}
        draggable={false}
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

