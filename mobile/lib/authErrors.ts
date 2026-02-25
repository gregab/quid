/** Map raw Supabase auth error messages to user-friendly strings. */

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Incorrect email or password. Please try again.",
  "Email not confirmed": "Please check your email and confirm your account before logging in.",
  "User already registered": "An account with this email already exists. Try logging in instead.",
  "Signup requires a valid password": "Please enter a valid password.",
  "Password should be at least 6 characters": "Password must be at least 6 characters.",
  "Email rate limit exceeded": "Too many attempts. Please wait a moment and try again.",
  "For security purposes, you can only request this after": "Too many attempts. Please wait a moment and try again.",
};

const GENERIC_ERROR = "Something went wrong. Please try again.";

export function friendlyAuthError(rawMessage: string): string {
  // Check exact matches first
  if (AUTH_ERROR_MAP[rawMessage]) {
    return AUTH_ERROR_MAP[rawMessage];
  }

  // Check partial matches for messages that vary
  for (const [key, friendly] of Object.entries(AUTH_ERROR_MAP)) {
    if (rawMessage.includes(key)) {
      return friendly;
    }
  }

  return GENERIC_ERROR;
}
