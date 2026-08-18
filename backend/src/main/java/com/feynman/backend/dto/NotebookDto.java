package com.feynman.backend.dto;

/**
 * Mirrors the frontend {@code Notebook} type.
 */
public record NotebookDto(
        String id,
        String title,
        String color
) {
}
