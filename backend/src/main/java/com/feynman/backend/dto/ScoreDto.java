package com.feynman.backend.dto;

import java.util.List;

/**
 * A single understanding score for a notebook or page.
 *
 * @param score              Understanding percentage, 0–100.
 * @param understandingNotes Short one-line explanation of the score (badge tooltip).
 * @param feedback           Longer, actionable Feynman-style feedback paragraph
 *                           shown inside the evaluated notebook. May be empty.
 * @param todos              Short, actionable to-do items derived from the
 *                           feedback, which the UI can turn into tick boxes.
 *                           Never null; may be empty.
 */
public record ScoreDto(
        int score,
        String understandingNotes,
        String feedback,
        List<String> todos
) {
    /** Compact constructor guarantees {@code todos} is never null. */
    public ScoreDto {
        todos = todos == null ? List.of() : List.copyOf(todos);
    }
}



