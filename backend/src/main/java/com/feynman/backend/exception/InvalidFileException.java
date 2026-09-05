package com.feynman.backend.exception;

/** Thrown when an uploaded file fails validation (wrong type, too large, unreadable). */
public class InvalidFileException extends RuntimeException {
    public InvalidFileException(String message) {
        super(message);
    }
}
