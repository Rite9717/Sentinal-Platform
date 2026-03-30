package com.sentinal.registry.exception;

/**
 * Exception thrown when attempting to register a user with a username or email
 * that already exists in the system.
 * 
 * This exception is used to enforce unique constraints on username and email
 * during user registration (Requirements 1.2, 1.3, 10.4, 10.5).
 */
public class UserAlreadyExistsException extends RuntimeException {
    
    /**
     * Constructs a new UserAlreadyExistsException with the specified detail message.
     *
     * @param message the detail message explaining why the exception was thrown
     */
    public UserAlreadyExistsException(String message) {
        super(message);
    }
    
    /**
     * Constructs a new UserAlreadyExistsException with the specified detail message
     * and cause.
     *
     * @param message the detail message explaining why the exception was thrown
     * @param cause the cause of the exception
     */
    public UserAlreadyExistsException(String message, Throwable cause) {
        super(message, cause);
    }
}
