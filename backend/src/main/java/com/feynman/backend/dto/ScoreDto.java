package com.feynman.backend.dto;

/**
 * A single understanding score for a notebook or page.
 *
 * @param score              Understanding percentage, 0–100.
 * @param understandingNotes Short one-line explanation of the score (badge tooltip).
 * @param feedback           Longer, actionable Feynman-style feedback paragraph
 *                           shown inside the evaluated notebook. May be empty.
 */
public record ScoreDto(
        int score,
        String understandingNotes,
        String feedback
) {
}



