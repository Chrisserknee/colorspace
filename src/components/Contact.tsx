"use client";

import { useState, useEffect } from "react";
import { captureEvent } from "@/lib/posthog";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  // Handle close with animation
  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 350);
  };

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({ name: "", email: "", message: "" });
      setSubmitStatus("idle");
      setErrorMessage("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (submitStatus === "error") {
      setSubmitStatus("idle");
      setErrorMessage("");
    }
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name.trim()) {
      setErrorMessage("Please enter your name");
      setSubmitStatus("error");
      return;
    }
    
    if (!formData.email.trim() || !validateEmail(formData.email)) {
      setErrorMessage("Please enter a valid email address");
      setSubmitStatus("error");
      return;
    }
    
    if (!formData.message.trim() || formData.message.trim().length < 10) {
      setErrorMessage("Please enter a message (at least 10 characters)");
      setSubmitStatus("error");
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorMessage("");

    try {
      captureEvent("contact_form_submitted", {
        has_name: !!formData.name,
        has_message: !!formData.message,
      });

      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send message");
      }

      setSubmitStatus("success");
      setFormData({ name: "", email: "", message: "" });
      
      // Close modal after 3 seconds on success
      setTimeout(() => {
        setSubmitStatus("idle");
        handleClose();
      }, 3000);
    } catch (err) {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isClosing) {
        handleClose();
      }
    };
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [isOpen, isClosing]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isClosing ? 'pointer-events-none' : ''}`}
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      />
      
      <div 
        className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl ${isClosing ? 'animate-fade-out-down' : 'animate-fade-in-up'}`}
        style={{ 
          backgroundColor: 'rgba(20, 20, 20, 0.95)',
          border: '1px solid rgba(197, 165, 114, 0.2)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full transition-all duration-200 hover:scale-110 hover:rotate-90 active:scale-95"
          style={{ 
            color: '#B8B2A8',
            backgroundColor: 'rgba(197, 165, 114, 0.1)',
            boxShadow: '0 0 0 0 rgba(197, 165, 114, 0)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(197, 165, 114, 0.2)';
            e.currentTarget.style.color = '#C5A572';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(197, 165, 114, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(197, 165, 114, 0.1)';
            e.currentTarget.style.color = '#B8B2A8';
            e.currentTarget.style.boxShadow = '0 0 0 0 rgba(197, 165, 114, 0)';
          }}
          aria-label="Close"
        >
          <svg className="w-6 h-6 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8 sm:p-10">
        {/* Section Header */}
        <div className="text-center mb-12">
          <span 
            className="uppercase tracking-[0.3em] text-sm font-medium mb-4 block"
            style={{ color: '#C5A572' }}
          >
            Get in Touch
          </span>
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl font-semibold mb-4"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Contact Us
          </h2>
          <p className="max-w-xl mx-auto" style={{ color: '#B8B2A8' }}>
            Have a question or feedback? We&apos;d love to hear from you.
          </p>
        </div>

        {/* Contact Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Field */}
          <div>
            <label 
              htmlFor="name"
              className="block text-sm font-medium mb-2"
              style={{ color: '#F0EDE8' }}
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="contact-input w-full px-4 py-3 rounded-lg"
              placeholder="Your name"
            />
          </div>

          {/* Email Field */}
          <div>
            <label 
              htmlFor="email"
              className="block text-sm font-medium mb-2"
              style={{ color: '#F0EDE8' }}
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="contact-input w-full px-4 py-3 rounded-lg"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Message Field */}
          <div>
            <label 
              htmlFor="message"
              className="block text-sm font-medium mb-2"
              style={{ color: '#F0EDE8' }}
            >
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              required
              rows={6}
              className="contact-input w-full px-4 py-3 rounded-lg resize-none"
              placeholder="Tell us what's on your mind..."
            />
          </div>

          {/* Error Message */}
          {submitStatus === "error" && errorMessage && (
            <div 
              className="p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#F87171'
              }}
            >
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Success Message */}
          {submitStatus === "success" && (
            <div 
              className="p-4 rounded-lg"
              style={{
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ADE80'
              }}
            >
              <p className="text-sm">
                Thank you! Your message has been sent. We&apos;ll get back to you soon.
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full text-lg py-4 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending...
              </span>
            ) : (
              "Send Message"
            )}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

