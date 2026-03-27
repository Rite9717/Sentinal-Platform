import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TokenManager } from './tokenManager';

describe('TokenManager', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('getToken', () => {
    it('should return null when no token is stored', () => {
      expect(TokenManager.getToken()).toBeNull();
    });

    it('should return the stored token', () => {
      localStorage.setItem('sentinal_jwt_token', 'test-token');
      expect(TokenManager.getToken()).toBe('test-token');
    });
  });

  describe('setToken', () => {
    it('should store the token in localStorage', () => {
      TokenManager.setToken('my-jwt-token');
      expect(localStorage.getItem('sentinal_jwt_token')).toBe('my-jwt-token');
    });

    it('should overwrite existing token', () => {
      TokenManager.setToken('old-token');
      TokenManager.setToken('new-token');
      expect(localStorage.getItem('sentinal_jwt_token')).toBe('new-token');
    });
  });

  describe('removeToken', () => {
    it('should remove the token from localStorage', () => {
      localStorage.setItem('sentinal_jwt_token', 'test-token');
      TokenManager.removeToken();
      expect(localStorage.getItem('sentinal_jwt_token')).toBeNull();
    });

    it('should not throw error when no token exists', () => {
      expect(() => TokenManager.removeToken()).not.toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid JWT token', () => {
      // Create a valid JWT token: header.payload.signature
      // Payload: {"sub":"testuser","exp":1234567890,"iat":1234567800}
      const payload = { sub: 'testuser', exp: 1234567890, iat: 1234567800 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      const decoded = TokenManager.decodeToken(token);
      expect(decoded).toEqual(payload);
    });

    it('should handle URL-safe base64 encoding', () => {
      // JWT tokens use URL-safe base64 (- instead of +, _ instead of /)
      const payload = { sub: 'user', exp: 9999999999, iat: 1234567800 };
      const encodedPayload = btoa(JSON.stringify(payload))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const token = `header.${encodedPayload}.signature`;

      const decoded = TokenManager.decodeToken(token);
      expect(decoded).toEqual(payload);
    });

    it('should return null for malformed token (not 3 parts)', () => {
      expect(TokenManager.decodeToken('invalid')).toBeNull();
      expect(TokenManager.decodeToken('only.two')).toBeNull();
      expect(TokenManager.decodeToken('too.many.parts.here')).toBeNull();
    });

    it('should return null for invalid base64', () => {
      const token = 'header.!!!invalid-base64!!!.signature';
      expect(TokenManager.decodeToken(token)).toBeNull();
    });

    it('should return null for invalid JSON in payload', () => {
      const invalidJson = btoa('not valid json');
      const token = `header.${invalidJson}.signature`;
      expect(TokenManager.decodeToken(token)).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for non-expired token', () => {
      // Create token that expires in the future
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const payload = { sub: 'user', exp: futureExp, iat: 1234567800 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(TokenManager.isTokenExpired(token)).toBe(false);
    });

    it('should return true for expired token', () => {
      // Create token that expired in the past
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const payload = { sub: 'user', exp: pastExp, iat: 1234567800 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(TokenManager.isTokenExpired(token)).toBe(true);
    });

    it('should return true for token without exp claim', () => {
      const payload = { sub: 'user', iat: 1234567800 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(TokenManager.isTokenExpired(token)).toBe(true);
    });

    it('should return true for malformed token', () => {
      expect(TokenManager.isTokenExpired('invalid-token')).toBe(true);
    });

    it('should return true for token at exact expiration time', () => {
      // Create token that expires at current time
      const currentTime = Math.floor(Date.now() / 1000);
      const payload = { sub: 'user', exp: currentTime, iat: 1234567800 };
      const encodedPayload = btoa(JSON.stringify(payload));
      const token = `header.${encodedPayload}.signature`;

      expect(TokenManager.isTokenExpired(token)).toBe(true);
    });
  });
});
