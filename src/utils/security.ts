/**
 * Security utilities for input validation and sanitization
 */

// Input sanitization
export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
    .slice(0, 1000); // Limit length to prevent DoS
};

// Email validation with additional security checks
export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  const sanitized = sanitizeInput(email);
  
  // Basic format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(sanitized)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /<script/i,
    /eval\(/i
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(sanitized))) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  return { isValid: true };
};

// Password strength validation
export const validatePassword = (password: string): { isValid: boolean; error?: string } => {
  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters long' };
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { isValid: false, error: 'Password must contain at least one lowercase letter, one uppercase letter, and one number' };
  }
  
  return { isValid: true };
};

// Verification ID validation with enhanced security
export const validateVerificationId = (id: string): { isValid: boolean; error?: string } => {
  const sanitized = sanitizeInput(id);
  
  // Must match the expected format: VT-timestamp-randomstring
  const verificationIdRegex = /^VT-\d{13}-[a-z0-9]{8,12}$/i;
  if (!verificationIdRegex.test(sanitized)) {
    return { isValid: false, error: 'Verification ID must be in the format VT-XXXXXXXXX-XXXXXXX' };
  }
  
  // Extract and validate timestamp
  const timestampMatch = sanitized.match(/^VT-(\d{13})-/);
  if (timestampMatch) {
    const timestamp = parseInt(timestampMatch[1]);
    const now = Date.now();
    const fiveYearsAgo = now - (5 * 365 * 24 * 60 * 60 * 1000);
    
    // Timestamp should be within reasonable range (not too old, not in future)
    if (timestamp < fiveYearsAgo || timestamp > now + 60000) {
      return { isValid: false, error: 'Invalid verification ID timestamp' };
    }
  }
  
  return { isValid: true };
};

// Rate limiting helper
export class ClientRateLimit {
  private attempts: Map<string, { count: number; resetTime: number }> = new Map();
  
  checkLimit(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (record.count >= maxAttempts) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  getRemainingTime(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return 0;
    
    const remaining = record.resetTime - Date.now();
    return Math.max(0, remaining);
  }
}

// Security audit logging
export const logSecurityEvent = async (event: {
  action: string;
  details?: any;
  severity: 'low' | 'medium' | 'high';
}) => {
  try {
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[Security Event] ${event.action}:`, event.details);
    }
    
    // In production, this could be sent to a security monitoring service
    // For now, we'll just store it locally for potential debugging
    const securityLog = {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      ...event
    };
    
    // Store in sessionStorage for debugging purposes
    const existingLogs = JSON.parse(sessionStorage.getItem('securityLogs') || '[]');
    existingLogs.push(securityLog);
    
    // Keep only last 50 logs to prevent storage overflow
    if (existingLogs.length > 50) {
      existingLogs.splice(0, existingLogs.length - 50);
    }
    
    sessionStorage.setItem('securityLogs', JSON.stringify(existingLogs));
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
};
