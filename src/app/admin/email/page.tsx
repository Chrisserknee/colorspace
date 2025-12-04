"use client";

import { useState, useEffect } from "react";

interface SendResult {
  success: boolean;
  message?: string;
  sent?: number;
  failed?: number;
  total?: number;
  errors?: string[];
  error?: string;
  messageId?: string;
}

export default function AdminEmailPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [step, setStep] = useState<"test" | "send">("test");
  const [confirmSend, setConfirmSend] = useState(false);
  const [emailCount, setEmailCount] = useState<number | null>(null);

  // Check if already authenticated
  useEffect(() => {
    const stored = sessionStorage.getItem("lumepet_admin_auth");
    if (stored) {
      setIsAuthenticated(true);
      setAdminSecret(stored);
    }
  }, []);

  // Fetch email count when authenticated
  useEffect(() => {
    if (isAuthenticated && adminSecret) {
      fetchEmailCount();
    }
  }, [isAuthenticated, adminSecret]);

  const fetchEmailCount = async () => {
    try {
      const response = await fetch("/api/send-support-email/count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminSecret }),
      });
      const data = await response.json();
      if (data.count !== undefined) {
        setEmailCount(data.count);
      }
    } catch (error) {
      console.error("Failed to fetch count:", error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Store in session for this tab only
    sessionStorage.setItem("lumepet_admin_auth", password);
    setAdminSecret(password);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("lumepet_admin_auth");
    setIsAuthenticated(false);
    setAdminSecret("");
    setPassword("");
    setResult(null);
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      alert("Please enter a test email address");
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/send-support-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminSecret, testEmail }),
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setStep("send");
      }
    } catch (error) {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAll = async () => {
    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }

    setIsLoading(true);
    setResult(null);
    setConfirmSend(false);

    try {
      const response = await fetch("/api/send-support-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminSecret }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg, #0A0908 0%, #1A1816 100%)' }}
      >
        <div 
          className="w-full max-w-md rounded-2xl p-8"
          style={{ 
            background: 'linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Lock Icon */}
          <div className="flex justify-center mb-6">
            <div 
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.2) 0%, rgba(197, 165, 114, 0.1) 100%)',
              }}
            >
              <svg className="w-8 h-8" style={{ color: '#C5A572' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          <h1 
            className="text-2xl text-center mb-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#F0EDE8' }}
          >
            Admin Access
          </h1>
          <p className="text-center mb-6 text-sm" style={{ color: '#7A756D' }}>
            Enter your admin secret to continue
          </p>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin Secret"
              className="w-full px-4 py-3 rounded-xl mb-4 text-center"
              style={{
                background: 'rgba(197, 165, 114, 0.1)',
                border: '1px solid rgba(197, 165, 114, 0.3)',
                color: '#F0EDE8',
                outline: 'none',
              }}
              autoFocus
            />
            <button
              type="submit"
              className="w-full py-3 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                color: '#0A0A0A',
              }}
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main Admin Interface
  return (
    <div 
      className="min-h-screen p-4 sm:p-8"
      style={{ background: 'linear-gradient(135deg, #0A0908 0%, #1A1816 100%)' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 
              className="text-2xl sm:text-3xl"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#C5A572' }}
            >
              ✉️ Email Campaign
            </h1>
            <p className="text-sm mt-1" style={{ color: '#7A756D' }}>
              Send support appeal to all LumePet users
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#7A756D', border: '1px solid rgba(197, 165, 114, 0.2)' }}
          >
            Logout
          </button>
        </div>

        {/* Stats Card */}
        <div 
          className="rounded-xl p-6 mb-6"
          style={{ 
            background: 'linear-gradient(135deg, rgba(197, 165, 114, 0.1) 0%, rgba(197, 165, 114, 0.05) 100%)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
          }}
        >
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(197, 165, 114, 0.15)' }}
            >
              <svg className="w-7 h-7" style={{ color: '#C5A572' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm" style={{ color: '#7A756D' }}>Total Recipients</p>
              <p className="text-3xl font-light" style={{ color: '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                {emailCount !== null ? emailCount.toLocaleString() : '...'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div 
          className="rounded-2xl overflow-hidden"
          style={{ 
            background: 'linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)',
            border: '1px solid rgba(197, 165, 114, 0.2)',
            boxShadow: '0 25px 80px rgba(0, 0, 0, 0.3)',
          }}
        >
          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: 'rgba(197, 165, 114, 0.15)' }}>
            <button
              onClick={() => { setStep("test"); setResult(null); setConfirmSend(false); }}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${step === "test" ? "border-b-2" : ""}`}
              style={{ 
                color: step === "test" ? '#C5A572' : '#7A756D',
                borderColor: step === "test" ? '#C5A572' : 'transparent',
                background: step === "test" ? 'rgba(197, 165, 114, 0.05)' : 'transparent',
              }}
            >
              1. Test Email
            </button>
            <button
              onClick={() => { setStep("send"); setResult(null); setConfirmSend(false); }}
              className={`flex-1 py-4 text-sm font-medium transition-colors ${step === "send" ? "border-b-2" : ""}`}
              style={{ 
                color: step === "send" ? '#C5A572' : '#7A756D',
                borderColor: step === "send" ? '#C5A572' : 'transparent',
                background: step === "send" ? 'rgba(197, 165, 114, 0.05)' : 'transparent',
              }}
            >
              2. Send to All
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {step === "test" ? (
              <>
                <h2 className="text-lg mb-2" style={{ color: '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  Send Test Email First
                </h2>
                <p className="text-sm mb-6" style={{ color: '#7A756D' }}>
                  It's a good idea to test the email on yourself before sending to everyone.
                </p>

                <div className="mb-4">
                  <label className="block text-sm mb-2" style={{ color: '#B8B2A8' }}>
                    Your Email Address
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl"
                    style={{
                      background: 'rgba(197, 165, 114, 0.1)',
                      border: '1px solid rgba(197, 165, 114, 0.3)',
                      color: '#F0EDE8',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={handleSendTest}
                  disabled={isLoading || !testEmail}
                  className="w-full py-4 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                    color: '#0A0A0A',
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    "📧 Send Test Email"
                  )}
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg mb-2" style={{ color: '#F0EDE8', fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
                  Send to All Users
                </h2>
                <p className="text-sm mb-6" style={{ color: '#7A756D' }}>
                  This will send the support appeal email to all {emailCount?.toLocaleString() || '...'} users in your database.
                </p>

                {/* Warning Box */}
                <div 
                  className="rounded-xl p-4 mb-6"
                  style={{ 
                    background: 'rgba(255, 180, 0, 0.1)',
                    border: '1px solid rgba(255, 180, 0, 0.3)',
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">⚠️</span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#FFB400' }}>
                        This action cannot be undone
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'rgba(255, 180, 0, 0.7)' }}>
                        Make sure you've tested the email first. Each user will receive one email.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSendAll}
                  disabled={isLoading}
                  className={`w-full py-4 rounded-xl font-semibold transition-all duration-200 ${confirmSend ? 'hover:scale-[1.02]' : 'hover:scale-[1.02]'} disabled:opacity-50 disabled:hover:scale-100`}
                  style={{
                    background: confirmSend 
                      ? 'linear-gradient(135deg, #E74C3C 0%, #C0392B 100%)'
                      : 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)',
                    color: confirmSend ? '#FFFFFF' : '#0A0A0A',
                  }}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending to all users...
                    </span>
                  ) : confirmSend ? (
                    "🚀 Yes, Send to Everyone!"
                  ) : (
                    `📨 Send to ${emailCount?.toLocaleString() || '...'} Users`
                  )}
                </button>

                {confirmSend && !isLoading && (
                  <button
                    onClick={() => setConfirmSend(false)}
                    className="w-full mt-3 py-3 rounded-xl text-sm transition-colors"
                    style={{ color: '#7A756D' }}
                  >
                    Cancel
                  </button>
                )}
              </>
            )}

            {/* Result Display */}
            {result && (
              <div 
                className="mt-6 rounded-xl p-4"
                style={{ 
                  background: result.success 
                    ? 'rgba(39, 174, 96, 0.1)' 
                    : 'rgba(231, 76, 60, 0.1)',
                  border: `1px solid ${result.success ? 'rgba(39, 174, 96, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{result.success ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <p 
                      className="font-medium"
                      style={{ color: result.success ? '#27AE60' : '#E74C3C' }}
                    >
                      {result.success ? 'Success!' : 'Error'}
                    </p>
                    <p className="text-sm mt-1" style={{ color: '#B8B2A8' }}>
                      {result.message || result.error}
                    </p>
                    {result.sent !== undefined && (
                      <div className="flex gap-4 mt-3 text-sm">
                        <span style={{ color: '#27AE60' }}>✓ Sent: {result.sent}</span>
                        {result.failed !== undefined && result.failed > 0 && (
                          <span style={{ color: '#E74C3C' }}>✗ Failed: {result.failed}</span>
                        )}
                      </div>
                    )}
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-3 text-xs" style={{ color: '#7A756D' }}>
                        <p className="mb-1">First errors:</p>
                        {result.errors.slice(0, 3).map((err, i) => (
                          <p key={i}>• {err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Email Preview */}
        <div className="mt-8">
          <h3 
            className="text-lg mb-4 flex items-center gap-2"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#C5A572' }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Email Preview
          </h3>
          
          {/* Email Client Frame */}
          <div 
            className="rounded-2xl overflow-hidden"
            style={{ 
              background: 'linear-gradient(135deg, #1A1816 0%, #0F0E0D 100%)',
              border: '1px solid rgba(197, 165, 114, 0.2)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Email Header Bar */}
            <div 
              className="px-5 py-4 flex items-center justify-between"
              style={{ background: 'rgba(197, 165, 114, 0.08)', borderBottom: '1px solid rgba(197, 165, 114, 0.1)' }}
            >
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: '#FF5F57' }}></div>
                  <div className="w-3 h-3 rounded-full" style={{ background: '#FFBD2E' }}></div>
                  <div className="w-3 h-3 rounded-full" style={{ background: '#28C840' }}></div>
                </div>
                <div className="h-4 w-px" style={{ background: 'rgba(197, 165, 114, 0.2)' }}></div>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                    style={{ background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)', color: '#0A0A0A', fontWeight: 'bold' }}
                  >
                    L
                  </div>
                  <div>
                    <p className="text-xs font-medium" style={{ color: '#F0EDE8' }}>LumePet</p>
                    <p className="text-xs" style={{ color: '#5A5650' }}>noreply@lumepet.app</p>
                  </div>
                </div>
              </div>
              <p className="text-xs" style={{ color: '#5A5650' }}>Just now</p>
            </div>
            
            {/* Subject Line */}
            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(197, 165, 114, 0.08)' }}>
              <p className="text-sm font-medium" style={{ color: '#F0EDE8' }}>
                LumePet Needs Your Help 💛
              </p>
            </div>
            
            {/* Email Body */}
            <div className="p-5" style={{ background: '#0A0908' }}>
              {/* Logo Section */}
              <div className="text-center mb-4">
                <p className="text-4xl mb-3">💛</p>
                <h4 
                  className="text-xl mb-1 tracking-wider"
                  style={{ color: '#C5A572', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  LUMEPET
                </h4>
                <p className="text-xs tracking-widest uppercase" style={{ color: '#7A756D' }}>
                  A Personal Message From Chris
                </p>
              </div>
              
              {/* Divider */}
              <div 
                className="h-px w-2/3 mx-auto mb-4" 
                style={{ background: 'linear-gradient(90deg, transparent, rgba(197, 165, 114, 0.3), transparent)' }}
              />
              
              {/* Main Heading */}
              <h5 
                className="text-lg text-center mb-4"
                style={{ color: '#FFFFFF', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
              >
                LumePet Needs Your Help to Stay Online
              </h5>
              
              {/* Message Preview */}
              <div className="space-y-3 mb-5 px-2">
                <p className="text-sm leading-relaxed" style={{ color: '#D4D0C8' }}>
                  I'm Chris — I built LumePet to celebrate our pets as the royalty they truly are. But I need to be honest: <span style={{ color: '#FFFFFF' }}>I'm struggling to keep it running.</span>
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#D4D0C8' }}>
                  Every portrait costs real money. The AI is expensive, and <span style={{ color: '#FF6B6B' }}>the costs are more than I can afford alone.</span>
                </p>
                <p className="text-sm leading-relaxed" style={{ color: '#D4D0C8' }}>
                  If LumePet ever brought you joy — <span style={{ color: '#E8D5A3' }}>please consider helping.</span> Even $1 makes a difference.
                </p>
              </div>
              
              {/* CTA Button */}
              <div className="text-center mb-5">
                <div 
                  className="inline-block px-6 py-3 rounded-lg font-bold"
                  style={{ 
                    background: 'linear-gradient(135deg, #C5A572 0%, #A68B5B 100%)', 
                    color: '#0A0A0A',
                    boxShadow: '0 6px 20px rgba(197, 165, 114, 0.3)'
                  }}
                >
                  💛 Support LumePet
                </div>
                <p className="text-xs mt-2" style={{ color: '#5A5650' }}>
                  Secure via Stripe • Any amount helps
                </p>
              </div>
              
              {/* Signature */}
              <div 
                className="pt-4 text-center"
                style={{ borderTop: '1px solid rgba(197, 165, 114, 0.1)' }}
              >
                <p className="text-sm mb-2" style={{ color: '#D4D0C8' }}>Thank you from the bottom of my heart. 💛</p>
                <p 
                  className="text-base italic"
                  style={{ color: '#E8D5A3', fontFamily: "'Cormorant Garamond', Georgia, serif" }}
                >
                  Chris Cerney
                </p>
                <p className="text-xs mt-1" style={{ color: '#A8A49C' }}>Creator of LumePet 🐾</p>
              </div>
              
              {/* Paw Prints */}
              <div className="text-center mt-4 opacity-30">
                <span style={{ letterSpacing: '10px' }}>🐾 🐾 🐾</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

