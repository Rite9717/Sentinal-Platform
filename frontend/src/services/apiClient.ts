import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { TokenManager } from '../utils/tokenManager';

/**
 * APIClient service for handling HTTP communication with the backend
 * Configured with automatic token injection and 401 error handling
 */
class APIClient {
  private client: AxiosInstance;

  constructor() {
    // Configure axios instance with base URL and default headers
    this.client = axios.create({
      baseURL: 'http://localhost:8080',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: inject Authorization header when token exists
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = TokenManager.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: handle 401 errors
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        if (error.response && error.response.status === 401) {
          // Clear token from storage
          TokenManager.removeToken();
          
          // Redirect to login page
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Performs a POST request to the specified URL
   * @param url - The endpoint URL (relative to base URL)
   * @param data - The request payload
   * @returns Promise resolving to the response data
   */
  async post<T>(url: string, data: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  /**
   * Performs a GET request to the specified URL
   * @param url - The endpoint URL (relative to base URL)
   * @returns Promise resolving to the response data
   */
  async get<T>(url: string): Promise<T> {
    const response = await this.client.get<T>(url);
    return response.data;
  }
}

// Export a singleton instance
export const apiClient = new APIClient();
