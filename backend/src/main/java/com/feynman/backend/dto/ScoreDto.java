package com.feynman.backend.dto;

/**
 * A single understanding score for a notebook or page.
 *
 * @param score              Understanding percentage, 0–100.
 * @param understandingNotes Short human-readable explanation of the score.
 */
public record ScoreDto(
        int score,
        String understandingNotes
) {
}

