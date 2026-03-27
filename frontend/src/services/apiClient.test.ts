import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { TokenManager } from '../utils/tokenManager';

// Mock axios
vi.mock('axios');

// Mock TokenManager
vi.mock('../utils/tokenManager');

describe('APIClient', () => {
  let mockAxiosInstance: any;
  let requestInterceptorFulfilled: any;
  let responseInterceptorRejected: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Setup mock axios instance
    mockAxiosInstance = {
      post: vi.fn(),
      get: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn((fulfilled, rejected) => {
            requestInterceptorFulfilled = fulfilled;
            return 0;
          }),
        },
        response: {
          use: vi.fn((fulfilled, rejected) => {
            responseInterceptorRejected = rejected;
            return 0;
          }),
        },
      },
    };

    (axios.create as any).mockReturnValue(mockAxiosInstance);

    // Mock window.location
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  describe('Configuration', () => {
    it('should configure base URL and headers correctly', async () => {
      // Import after mocks are set up
      await import('./apiClient');

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8080',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  });

  describe('Request Interceptor', () => {
    it('should inject Authorization header when token exists', async () => {
      (TokenManager.getToken as any).mockReturnValue('test-token');
      
      // Re-import to get fresh instance
      vi.resetModules();
      await import('./apiClient');

      const config = { headers: {} } as any;
      const result = requestInterceptorFulfilled(config);

      expect(result.headers.Authorization).toBe('Bearer test-token');
    });

    it('should not inject Authorization header when token does not exist', async () => {
      (TokenManager.getToken as any).mockReturnValue(null);
      
      vi.resetModules();
      await import('./apiClient');

      const config = { headers: {} } as any;
      const result = requestInterceptorFulfilled(config);

      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should handle 401 errors by clearing token and redirecting', async () => {
      vi.resetModules();
      await import('./apiClient');

      const error = {
        response: {
          status: 401,
        },
      };

      try {
        await responseInterceptorRejected(error);
      } catch (e) {
        expect(TokenManager.removeToken).toHaveBeenCalled();
        expect(window.location.href).toBe('/login');
      }
    });

    it('should not clear token for non-401 errors', async () => {
      vi.resetModules();
      await import('./apiClient');

      const error = {
        response: {
          status: 500,
        },
      };

      try {
        await responseInterceptorRejected(error);
      } catch (e) {
        expect(TokenManager.removeToken).not.toHaveBeenCalled();
      }
    });
  });

  describe('HTTP Methods', () => {
    it('should make POST requests correctly', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { success: true } });
      
      vi.resetModules();
      const { apiClient } = await import('./apiClient');

      const result = await apiClient.post('/test', { data: 'test' });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', { data: 'test' });
      expect(result).toEqual({ success: true });
    });

    it('should make GET requests correctly', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { id: 1 } });
      
      vi.resetModules();
      const { apiClient } = await import('./apiClient');

      const result = await apiClient.get('/test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test');
      expect(result).toEqual({ id: 1 });
    });
  });
});
