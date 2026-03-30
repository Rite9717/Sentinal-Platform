import React from 'react';

const Navigate = ({ to, replace }) => (
  <div data-testid="navigate">Redirecting to {to}</div>
);

const MemoryRouter = ({ children }) => <div>{children}</div>;
const BrowserRouter = ({ children }) => <div>{children}</div>;
const Routes = ({ children }) => <div>{children}</div>;
const Route = ({ element }) => <div>{element}</div>;
const Link = ({ to, children }) => <a href={to}>{children}</a>;

// Create a persistent mock for useNavigate
const mockNavigate = jest.fn();
const useNavigate = () => mockNavigate;
const useLocation = () => ({ pathname: '/' });

// Create a mock for useSearchParams
const mockSearchParams = new URLSearchParams();
const mockSetSearchParams = jest.fn();
const useSearchParams = () => [mockSearchParams, mockSetSearchParams];

module.exports = {
  Navigate,
  MemoryRouter,
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
  useSearchParams,
  mockNavigate, // Export for test access
  mockSearchParams, // Export for test access
  mockSetSearchParams // Export for test access
};

