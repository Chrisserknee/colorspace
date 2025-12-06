import posthog from "posthog-js";

// Helper function to safely capture events
export const captureEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.capture(eventName, {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
    });
  }
};

// Helper function to identify users
export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.identify(userId, properties);
  }
};

// Helper function to set user properties
export const setUserProperties = (properties: Record<string, unknown>) => {
  if (typeof window !== "undefined" && posthog.__loaded) {
    posthog.setPersonProperties(properties);
  }
};

// Helper to get PostHog instance (for advanced usage)
export const getPostHog = () => {
  if (typeof window !== "undefined" && posthog.__loaded) {
    return posthog;
  }
  return null;
};

// ============================================
// ERROR TRACKING
// ============================================

export const captureError = (
  errorType: string, 
  error: Error | string | unknown, 
  context?: Record<string, unknown>
) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  captureEvent(`error_${errorType}`, {
    error_message: errorMessage,
    error_stack: errorStack?.substring(0, 1000), // Limit stack trace length
    error_type: errorType,
    ...context,
  });
  
  // Also log to console for debugging
  console.error(`[PostHog Error] ${errorType}:`, error, context);
};

// ============================================
// API TRACKING
// ============================================

export const trackApiCall = (
  endpoint: string,
  method: string,
  startTime: number,
  response?: { ok: boolean; status: number },
  error?: Error | string
) => {
  const duration = Date.now() - startTime;
  
  if (error) {
    captureEvent("api_error", {
      endpoint,
      method,
      duration_ms: duration,
      error_message: error instanceof Error ? error.message : String(error),
    });
  } else if (response) {
    captureEvent("api_response", {
      endpoint,
      method,
      duration_ms: duration,
      status_code: response.status,
      success: response.ok,
    });
  }
};

// ============================================
// PERFORMANCE TRACKING
// ============================================

export const trackPerformance = (metric: string, value: number, context?: Record<string, unknown>) => {
  captureEvent("performance_metric", {
    metric_name: metric,
    metric_value: value,
    ...context,
  });
};

// ============================================
// USER FLOW TRACKING
// ============================================

export const trackFlowStep = (
  flowName: string, 
  stepName: string, 
  stepNumber: number,
  context?: Record<string, unknown>
) => {
  captureEvent(`${flowName}_step`, {
    flow_name: flowName,
    step_name: stepName,
    step_number: stepNumber,
    ...context,
  });
};

// ============================================
// UI INTERACTION TRACKING
// ============================================

export const trackClick = (elementName: string, context?: Record<string, unknown>) => {
  captureEvent("ui_click", {
    element: elementName,
    ...context,
  });
};

export const trackModalOpen = (modalName: string, context?: Record<string, unknown>) => {
  captureEvent("modal_opened", {
    modal_name: modalName,
    ...context,
  });
};

export const trackModalClose = (modalName: string, context?: Record<string, unknown>) => {
  captureEvent("modal_closed", {
    modal_name: modalName,
    ...context,
  });
};

// ============================================
// SESSION TRACKING
// ============================================

export const trackSessionStart = (context?: Record<string, unknown>) => {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  captureEvent("session_started", {
    session_id: sessionId,
    referrer: document.referrer || "direct",
    user_agent: navigator.userAgent,
    language: navigator.language,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    device_pixel_ratio: window.devicePixelRatio,
    is_mobile: /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
    is_touch: 'ontouchstart' in window,
    ...context,
  });
  
  return sessionId;
};

export const trackVisibilityChange = (isVisible: boolean, context?: Record<string, unknown>) => {
  captureEvent("visibility_changed", {
    is_visible: isVisible,
    hidden_duration_ms: context?.hiddenDuration,
    ...context,
  });
};

// ============================================
// GENERATION TRACKING
// ============================================

export const trackGenerationStart = (context?: Record<string, unknown>) => {
  captureEvent("generation_flow_started", {
    has_file: !!context?.hasFile,
    file_size_kb: context?.fileSize ? Math.round(Number(context.fileSize) / 1024) : undefined,
    file_type: context?.fileType,
    ...context,
  });
};

export const trackGenerationProgress = (progress: number, elapsed: number, context?: Record<string, unknown>) => {
  // Only track at key milestones to avoid spam
  if (progress === 25 || progress === 50 || progress === 75 || progress === 100) {
    captureEvent("generation_progress", {
      progress_percent: progress,
      elapsed_seconds: Math.round(elapsed / 1000),
      ...context,
    });
  }
};

export const trackGenerationComplete = (
  imageId: string, 
  duration: number, 
  context?: Record<string, unknown>
) => {
  captureEvent("generation_completed", {
    image_id: imageId,
    duration_seconds: Math.round(duration / 1000),
    ...context,
  });
};

export const trackGenerationError = (error: string, duration: number, context?: Record<string, unknown>) => {
  captureEvent("generation_failed", {
    error_message: error,
    duration_seconds: Math.round(duration / 1000),
    ...context,
  });
};

// ============================================
// CHECKOUT TRACKING
// ============================================

export const trackCheckoutStart = (imageId: string, context?: Record<string, unknown>) => {
  captureEvent("checkout_started", {
    image_id: imageId,
    ...context,
  });
};

export const trackCheckoutSuccess = (imageId: string, duration: number, context?: Record<string, unknown>) => {
  captureEvent("checkout_redirect_success", {
    image_id: imageId,
    duration_ms: duration,
    ...context,
  });
};

export const trackCheckoutError = (error: string, duration: number, context?: Record<string, unknown>) => {
  captureEvent("checkout_failed", {
    error_message: error,
    duration_ms: duration,
    ...context,
  });
};


















