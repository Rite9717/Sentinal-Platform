import apiClient from './apiClient';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.location
delete window.location;
window.location = { href: '' };

describe('apiClient', () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.href = '';
  });

  describe('Configuration', () => {
    it('should have baseURL configured to http://localhost:8080', () => {
      expect(apiClient.defaults.baseURL).toBe('http://localhost:8080');
    });

    it('should have Content-Type header set to application/json', () => {
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header when token exists in localStorage', async () => {
      const token = 'test-jwt-token';
      localStorage.setItem('jwt_token', token);

      const config = { headers: {} };
      const interceptor = apiClient.interceptors.request.handlers[0];
      const result = await interceptor.fulfilled(config);

      expect(result.headers.Authorization).toBe(`Bearer ${token}`);
    });

    it('should not add Authorization header when token does not exist', async () => {
      const config = { headers: {} };
      const interceptor = apiClient.interceptors.request.handlers[0];
      const result = await interceptor.fulfilled(config);

      expect(result.headers.Authorization).toBeUndefined();
    });

    it('should pass through config when token is null', async () => {
      localStorage.removeItem('jwt_token');

      const config = { headers: {}, url: '/test' };
      const interceptor = apiClient.interceptors.request.handlers[0];
      const result = await interceptor.fulfilled(config);

      expect(result.url).toBe('/test');
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should pass through successful responses', async () => {
      const response = { status: 200, data: { message: 'success' } };
      const interceptor = apiClient.interceptors.response.handlers[0];
      const result = await interceptor.fulfilled(response);

      expect(result).toEqual(response);
    });

    it('should clear token and redirect on 401 error', async () => {
      const token = 'test-jwt-token';
      localStorage.setItem('jwt_token', token);

      const error = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' }
        }
      };

      const interceptor = apiClient.interceptors.response.handlers[0];

      try {
        await interceptor.rejected(error);
      } catch (e) {
        expect(localStorage.getItem('jwt_token')).toBeNull();
        expect(window.location.href).toBe('/login');
        expect(e).toEqual(error);
      }
    });

    it('should not clear token on non-401 errors', async () => {
      const token = 'test-jwt-token';
      localStorage.setItem('jwt_token', token);

      const error = {
        response: {
          status: 500,
          data: { message: 'Server Error' }
        }
      };

      const interceptor = apiClient.interceptors.response.handlers[0];

      try {
        await interceptor.rejected(error);
      } catch (e) {
        expect(localStorage.getItem('jwt_token')).toBe(token);
        expect(window.location.href).toBe('');
        expect(e).toEqual(error);
      }
    });

    it('should handle errors without response object', async () => {
      const token = 'test-jwt-token';
      localStorage.setItem('jwt_token', token);

      const error = {
        message: 'Network Error'
      };

      const interceptor = apiClient.interceptors.response.handlers[0];

      try {
        await interceptor.rejected(error);
      } catch (e) {
        expect(localStorage.getItem('jwt_token')).toBe(token);
        expect(window.location.href).toBe('');
        expect(e).toEqual(error);
      }
    });
  });
});
