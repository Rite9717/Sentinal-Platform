import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  test('renders error message when message prop is provided', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  test('does not render when message is null', () => {
    const onDismiss = jest.fn();
    
    const { container } = render(<ErrorMessage message={null} onDismiss={onDismiss} />);
    
    expect(container.firstChild).toBeNull();
  });

  test('does not render when message is undefined', () => {
    const onDismiss = jest.fn();
    
    const { container } = render(<ErrorMessage message={undefined} onDismiss={onDismiss} />);
    
    expect(container.firstChild).toBeNull();
  });

  test('does not render when message is empty string', () => {
    const onDismiss = jest.fn();
    
    const { container } = render(<ErrorMessage message="" onDismiss={onDismiss} />);
    
    expect(container.firstChild).toBeNull();
  });

  test('renders dismiss button', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissButton).toBeInTheDocument();
  });

  test('calls onDismiss when dismiss button is clicked', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('calls onDismiss only once per click', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    fireEvent.click(dismissButton);
    fireEvent.click(dismissButton);
    fireEvent.click(dismissButton);
    
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });

  test('renders long error messages', () => {
    const longMessage = 'This is a very long error message that should still be displayed correctly in the error message component without breaking the layout or causing any visual issues.';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={longMessage} onDismiss={onDismiss} />);
    
    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  test('renders error messages with special characters', () => {
    const message = 'Error: Invalid input! Please try again. (Code: 400)';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    expect(screen.getByText(message)).toBeInTheDocument();
  });

  test('has proper styling for error container', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    const { container } = render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const errorContainer = container.firstChild;
    expect(errorContainer).toHaveClass('error-message');
  });

  test('dismiss button has proper styling', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissButton).toHaveClass('error-message__dismiss');
  });

  test('renders with different error messages', () => {
    const onDismiss = jest.fn();
    
    const { rerender } = render(<ErrorMessage message="First error" onDismiss={onDismiss} />);
    expect(screen.getByText('First error')).toBeInTheDocument();
    
    rerender(<ErrorMessage message="Second error" onDismiss={onDismiss} />);
    expect(screen.getByText('Second error')).toBeInTheDocument();
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });

  test('can be hidden by changing message to null', () => {
    const onDismiss = jest.fn();
    
    const { container, rerender } = render(<ErrorMessage message="Error message" onDismiss={onDismiss} />);
    expect(screen.getByText('Error message')).toBeInTheDocument();
    
    rerender(<ErrorMessage message={null} onDismiss={onDismiss} />);
    expect(container.firstChild).toBeNull();
  });

  // Accessibility tests
  test('error message has role alert', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toBeInTheDocument();
    expect(errorElement).toHaveTextContent(message);
  });

  test('error message has aria-live polite', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveAttribute('aria-live', 'polite');
  });

  test('error message has id for aria-describedby', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const errorElement = screen.getByRole('alert');
    expect(errorElement).toHaveAttribute('id', 'login-error');
  });

  test('dismiss button has type button', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissButton).toHaveAttribute('type', 'button');
  });

  test('dismiss button has aria-label', () => {
    const message = 'An error occurred';
    const onDismiss = jest.fn();
    
    render(<ErrorMessage message={message} onDismiss={onDismiss} />);
    
    const dismissButton = screen.getByRole('button', { name: /dismiss error/i });
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss error');
  });
});
