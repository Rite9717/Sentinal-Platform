import { DecodedToken } from '../types/auth.types';

const TOKEN_KEY = 'sentinal_jwt_token';

/**
 * TokenManager utility for managing JWT token persistence and validation
 */
export const TokenManager = {
  /**
   * Retrieves the JWT token from localStorage
   * @returns The stored token or null if not found
   */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Stores the JWT token in localStorage
   * @param token - The JWT token to store
   */
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  /**
   * Removes the JWT token from localStorage
   */
  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Decodes a JWT token to extract the payload
   * @param token - The JWT token to decode
   * @returns The decoded token payload or null if invalid
   */
  decodeToken(token: string): DecodedToken | null {
    try {
      // JWT format: header.payload.signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode the payload (second part)
      const payload = parts[1];
      
      // Base64 URL decode: replace URL-safe chars and pad if needed
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
      
      // Decode base64 and parse JSON
      const decodedString = atob(paddedBase64);
      const decodedPayload = JSON.parse(decodedString);

      return decodedPayload as DecodedToken;
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  },

  /**
   * Checks if a JWT token is expired
   * @param token - The JWT token to check
   * @returns True if the token is expired, false otherwise
   */
  isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }

    // exp is in seconds, Date.now() is in milliseconds
    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp <= currentTime;
  }
};
