import authService from './authService';
import apiClient from './apiClient';

// Mock apiClient
jest.mock('./apiClient');

describe('authService', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should send POST request to /api/auth/register with registration data', async () => {
      const registrationData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User'
      };

      const mockResponse = {
        data: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          fullName: 'Test User',
          role: 'USER',
          enabled: true,
          createdAt: '2024-01-01T12:00:00'
        }
      };

      apiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.register(registrationData);

      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/register', registrationData);
      expect(result).toEqual(mockResponse.data);
    });

    it('should transform error when registration fails', async () => {
      const registrationData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        fullName: 'Test User'
      };

      const mockError = {
        response: {
          status: 409,
          data: { message: 'Username already exists' }
        }
      };

      apiClient.post.mockRejectedValue(mockError);

      await expect(authService.register(registrationData)).rejects.toBe('Username already exists.');
    });
  });

  describe('login', () => {
    it('should send POST request to /api/auth/login and store token', async () => {
      const credentials = {
        username: 'testuser',
        password: 'password123'
      };

      const mockResponse = {
        data: {
          token: 'mock-jwt-token',
          type: 'Bearer',
          user: {
            id: 1,
            username: 'testuser',
            email: 'test@example.com',
            fullName: 'Test User',
            role: 'USER',
            enabled: true,
            createdAt: '2024-01-01T12:00:00'
          }
        }
      };

      apiClient.post.mockResolvedValue(mockResponse);

      const result = await authService.login(credentials);

      expect(apiClient.post).toHaveBeenCalledWith('/api/auth/login', credentials);
      expect(result).toEqual({ token: 'mock-jwt-token', user: mockResponse.data.user });
      expect(localStorage.getItem('jwt_token')).toBe('mock-jwt-token');
    });

    it('should transform 401 error to user-friendly message', async () => {
      const credentials = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const mockError = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        }
      };

      apiClient.post.mockRejectedValue(mockError);

      await expect(authService.login(credentials)).rejects.toBe('Invalid username or password.');
    });
  });

  describe('logout', () => {
    it('should remove token from localStorage', () => {
      localStorage.setItem('jwt_token', 'mock-token');
      
      authService.logout();
      
      expect(localStorage.getItem('jwt_token')).toBeNull();
    });
  });

  describe('getStoredToken', () => {
    it('should return token from localStorage', () => {
      localStorage.setItem('jwt_token', 'mock-token');
      
      const token = authService.getStoredToken();
      
      expect(token).toBe('mock-token');
    });

    it('should return null when no token exists', () => {
      const token = authService.getStoredToken();
      
      expect(token).toBeNull();
    });
  });

  describe('storeToken', () => {
    it('should store token in localStorage', () => {
      authService.storeToken('new-token');
      
      expect(localStorage.getItem('jwt_token')).toBe('new-token');
    });
  });

  describe('clearToken', () => {
    it('should remove token from localStorage', () => {
      localStorage.setItem('jwt_token', 'mock-token');
      
      authService.clearToken();
      
      expect(localStorage.getItem('jwt_token')).toBeNull();
    });
  });

  describe('transformError', () => {
    it('should transform network error to connection message', () => {
      const error = {
        code: 'ECONNREFUSED'
      };

      const message = authService.transformError(error);

      expect(message).toBe('Unable to connect to server. Please check your connection and try again.');
    });

    it('should transform timeout error to connection message', () => {
      const error = {
        code: 'ETIMEDOUT'
      };

      const message = authService.transformError(error);

      expect(message).toBe('Unable to connect to server. Please check your connection and try again.');
    });

    it('should transform generic network error', () => {
      const error = {};

      const message = authService.transformError(error);

      expect(message).toBe('Network error. Please check your connection and try again.');
    });

    it('should transform 401 error to invalid credentials message', () => {
      const error = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('Invalid username or password.');
    });

    it('should transform 409 error with username to username exists message', () => {
      const error = {
        response: {
          status: 409,
          data: { message: 'Username already exists' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('Username already exists.');
    });

    it('should transform 409 error with email to email exists message', () => {
      const error = {
        response: {
          status: 409,
          data: { message: 'Email already exists' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('Email already exists.');
    });

    it('should transform 409 error without specific message to generic exists message', () => {
      const error = {
        response: {
          status: 409,
          data: { message: 'Conflict' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('User already exists.');
    });

    it('should transform 400 error with backend message', () => {
      const error = {
        response: {
          status: 400,
          data: { message: 'Username must be between 3 and 50 characters' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('Username must be between 3 and 50 characters');
    });

    it('should transform 400 error without message to generic validation message', () => {
      const error = {
        response: {
          status: 400,
          data: {}
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('Invalid input. Please check your data and try again.');
    });

    it('should transform 500 error to server error message', () => {
      const error = {
        response: {
          status: 500,
          data: { message: 'Internal server error' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('Server error. Please try again later.');
    });

    it('should transform unknown error to generic message', () => {
      const error = {
        response: {
          status: 418,
          data: {}
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should use backend message for unknown status codes', () => {
      const error = {
        response: {
          status: 418,
          data: { message: 'I am a teapot' }
        }
      };

      const message = authService.transformError(error);

      expect(message).toBe('I am a teapot');
    });
  });
});
