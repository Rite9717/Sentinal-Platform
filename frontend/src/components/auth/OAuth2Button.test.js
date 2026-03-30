import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import OAuth2Button from './OAuth2Button';

describe('OAuth2Button', () => {
  // Store original window.location
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location
    delete window.location;
    window.location = { href: '' };
  });

  afterEach(() => {
    // Restore original window.location
    window.location = originalLocation;
  });

  test('renders "Sign in with Google" button', () => {
    render(<OAuth2Button />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Sign in with Google');
  });

  test('renders Google logo SVG', () => {
    const { container } = render(<OAuth2Button />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  test('redirects to OAuth2 endpoint on click', () => {
    render(<OAuth2Button />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    
    fireEvent.click(button);
    
    expect(window.location.href).toBe('http://localhost:8080/oauth2/authorization/google');
  });

  test('button is enabled by default', () => {
    render(<OAuth2Button />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).not.toBeDisabled();
  });

  test('button is disabled when disabled prop is true', () => {
    render(<OAuth2Button disabled={true} />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeDisabled();
  });

  test('does not redirect when disabled', () => {
    render(<OAuth2Button disabled={true} />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    
    fireEvent.click(button);
    
    // window.location.href should remain empty since button is disabled
    expect(window.location.href).toBe('');
  });

  test('button has correct styling when enabled', () => {
    render(<OAuth2Button />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toHaveClass('oauth2-button');
    expect(button).not.toBeDisabled();
  });

  test('button has correct styling when disabled', () => {
    render(<OAuth2Button disabled={true} />);
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toHaveClass('oauth2-button');
    expect(button).toBeDisabled();
  });

  test('button has accessible label', () => {
    render(<OAuth2Button />);
    const button = screen.getByLabelText('Sign in with Google');
    expect(button).toBeInTheDocument();
  });
});
