/**
 * TypeScript type definitions for authentication
 * Matches backend API contracts from Spring Boot DTOs
 */

/**
 * User role enum matching backend Role enum
 */
export type Role = 'USER' | 'ADMIN' | 'MODERATOR';

/**
 * User data model matching UserResponseDto from backend
 */
export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  enabled: boolean;
  createdAt: string; // ISO 8601 format from LocalDateTime
}

/**
 * Login request payload matching LoginRequestDto
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Login response matching LoginResponseDto from backend
 */
export interface LoginResponse {
  token: string;
  type: string; // "Bearer"
  user: User;
}

/**
 * Registration request payload matching RegistrationRequestDto
 */
export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
}

/**
 * Error response matching ErrorResponseDto from backend
 */
export interface ErrorResponse {
  timestamp: string; // ISO 8601 format from LocalDateTime
  status: number;
  error: string;
  message: string;
  path: string;
}

/**
 * Authentication state for AuthContext
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  token: string | null;
}

/**
 * Decoded JWT token payload
 */
export interface DecodedToken {
  sub: string; // username
  exp: number; // expiration timestamp (seconds since epoch)
  iat: number; // issued at timestamp (seconds since epoch)
  // Additional claims may be present depending on backend JWT configuration
}
