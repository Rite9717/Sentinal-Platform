import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import PublicRoute from './components/common/PublicRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import OAuth2CallbackPage from './pages/OAuth2CallbackPage';
import './App.css';

/**
 * App component
 * Root component that sets up routing and authentication context
 * Wraps application with AuthProvider and configures all routes
 */
function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes - redirect to dashboard if authenticated */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } 
        />

        {/* OAuth2 callback route */}
        <Route 
          path="/oauth2/callback" 
          element={<OAuth2CallbackPage />} 
        />

        {/* Protected routes - require authentication */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />

        {/* Default redirect from root to dashboard */}
        <Route 
          path="/" 
          element={<Navigate to="/dashboard" replace />} 
        />

        {/* Catch-all redirect to dashboard */}
        <Route 
          path="*" 
          element={<Navigate to="/dashboard" replace />} 
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
