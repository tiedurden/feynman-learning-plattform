package com.feynman.backend.exception;

/** Thrown when a requested resource doesn't exist, or doesn't belong to the current user. */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}
