package com.feynman.backend.dto;

/**
 * Mirrors the frontend {@code TextBox} type: a free-floating text box on the
 * page canvas. Only {@code text} matters for evaluation.
 */
public record TextBoxDto(
        String id,
        Double x,
        Double y,
        String text,
        Double width
) {
}
