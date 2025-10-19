// API Configuration for Heroku Backend
export const API_BASE_URL = "https://splitton-ef215d77f9d0.herokuapp.com";

// Session storage keys
const SESSION_KEY = "splitton_session";

interface SessionData {
  userId: string;
  email: string;
  telegramId?: number;
  timestamp: number;
}

// Save session to localStorage
export function saveSession(userId: string, email: string, telegramId?: number) {
  const session: SessionData = {
    userId,
    email,
    telegramId,
    timestamp: Date.now(),
  };
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  
  // Also set on window for backwards compatibility
  (window as any).userId = userId;
  (window as any).userEmail = email;
  
  console.log("✅ Session saved:", { userId, email, telegramId });
}

// Load session from localStorage
export function loadSession(): SessionData | null {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    
    const session: SessionData = JSON.parse(stored);
    
    // Check if session is less than 30 days old
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - session.timestamp > thirtyDays) {
      console.log("⚠️ Session expired, clearing...");
      clearSession();
      return null;
    }
    
    // Restore to window
    (window as any).userId = session.userId;
    (window as any).userEmail = session.email;
    
    console.log("✅ Session loaded:", { userId: session.userId, email: session.email });
    return session;
  } catch (error) {
    console.error("❌ Failed to load session:", error);
    return null;
  }
}

// Clear session
export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  delete (window as any).userId;
  delete (window as any).userEmail;
  console.log("✅ Session cleared");
}

// Validate session against backend
export async function validateSession(): Promise<boolean> {
  const session = loadSession();
  if (!session) return false;
  
  try {
    // Try to fetch user's friends as a validation check
    // (any endpoint that requires valid user_id will work)
    const response = await apiRequest("GET", `/friends/${session.userId}`);
    
    // If we get a response without error, session is valid
    return true;
  } catch (error) {
    // If request fails, session is invalid (user doesn't exist)
    console.log("⚠️ Session validation failed, clearing session...");
    clearSession();
    return false;
  }
}

// Check if user is authenticated (local check only)
export function isAuthenticated(): boolean {
  const session = loadSession();
  return session !== null;
}

// Helper function to make API requests
export async function apiRequest<T = any>(
  method: string,
  endpoint: string,
  body?: any
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle 204 No Content and other empty responses
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return {} as T;
  }

  return response.json();
}

// Get current user ID from window or localStorage
export function getCurrentUserId(): string | null {
  // Try window first (for backwards compatibility)
  if ((window as any).userId) {
    return (window as any).userId;
  }
  
  // Try loading from localStorage
  const session = loadSession();
  return session?.userId || null;
}

// Get current user email from window or localStorage
export function getCurrentUserEmail(): string | null {
  // Try window first (for backwards compatibility)
  if ((window as any).userEmail) {
    return (window as any).userEmail;
  }
  
  // Try loading from localStorage
  const session = loadSession();
  return session?.email || null;
}
