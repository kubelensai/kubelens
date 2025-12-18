/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth2
 * 
 * PKCE is a security extension that prevents authorization code interception attacks.
 * It's especially important for public clients (like SPAs) that can't securely store secrets.
 * 
 * Flow:
 * 1. Generate a random code_verifier
 * 2. Hash it to create code_challenge
 * 3. Send code_challenge to authorization endpoint
 * 4. After getting the code, send code_verifier to token endpoint
 * 5. Server verifies that SHA256(code_verifier) == code_challenge
 */

/**
 * Generates a cryptographically random code verifier
 * Code verifier is a high-entropy cryptographic random string using
 * the unreserved characters [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 * with a minimum length of 43 characters and a maximum length of 128 characters.
 * 
 * @returns A random string of 43 characters (256 bits of entropy)
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32); // 256 bits
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generates a code challenge from a code verifier using S256 method
 * code_challenge = BASE64URL(SHA256(code_verifier))
 * 
 * @param verifier - The code verifier to hash
 * @returns A promise that resolves to the base64url-encoded SHA-256 hash
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

/**
 * Generates a random state parameter for CSRF protection
 * The state parameter is used to prevent CSRF attacks.
 * It's a random string that the client generates and sends to the server.
 * The server returns it unchanged, and the client verifies it matches.
 * 
 * @returns A random string of 22 characters (128 bits of entropy)
 */
export function generateState(): string {
  const array = new Uint8Array(16); // 128 bits
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Base64 URL encode a Uint8Array
 * This encoding is safe for use in URLs without additional encoding.
 * It replaces + with -, / with _, and removes padding (=)
 * 
 * @param buffer - The buffer to encode
 * @returns The base64url-encoded string
 */
function base64UrlEncode(buffer: Uint8Array): string {
  // Convert Uint8Array to string
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  
  // Base64 encode and make URL-safe
  return btoa(binary)
    .replace(/\+/g, '-')   // Replace + with -
    .replace(/\//g, '_')   // Replace / with _
    .replace(/=+$/, '');   // Remove padding
}

/**
 * Storage keys for PKCE state
 */
export const PKCE_STORAGE_KEYS = {
  CODE_VERIFIER: 'oauth_code_verifier',
  STATE: 'oauth_state',
} as const;

/**
 * Stores PKCE parameters in session storage
 * Session storage is used because the values should only persist for the current session
 * and should be automatically cleared when the browser tab is closed.
 * 
 * @param codeVerifier - The code verifier to store
 * @param state - The state parameter to store
 */
export function storePKCEParams(codeVerifier: string, state: string): void {
  sessionStorage.setItem(PKCE_STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
  sessionStorage.setItem(PKCE_STORAGE_KEYS.STATE, state);
}

/**
 * Retrieves PKCE parameters from session storage
 * 
 * @returns Object containing code verifier and state, or null values if not found
 */
export function getPKCEParams(): { codeVerifier: string | null; state: string | null } {
  return {
    codeVerifier: sessionStorage.getItem(PKCE_STORAGE_KEYS.CODE_VERIFIER),
    state: sessionStorage.getItem(PKCE_STORAGE_KEYS.STATE),
  };
}

/**
 * Clears PKCE parameters from session storage
 * Should be called after the authorization code has been exchanged
 */
export function clearPKCEParams(): void {
  sessionStorage.removeItem(PKCE_STORAGE_KEYS.CODE_VERIFIER);
  sessionStorage.removeItem(PKCE_STORAGE_KEYS.STATE);
}

/**
 * Validates that the state parameter matches the stored value
 * 
 * @param receivedState - The state received from the authorization server
 * @returns true if the state matches, false otherwise
 */
export function validateState(receivedState: string | null): boolean {
  const storedState = sessionStorage.getItem(PKCE_STORAGE_KEYS.STATE);
  return storedState !== null && receivedState === storedState;
}
