package com.feynman.backend.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * Create/update payload for a page. On update, {@code boxes} replaces the
 * page's entire box list (simplest correct semantics for autosave).
 */
public record PageRequest(
        String parentId,
        @NotBlank String title,
        String content,
        Integer order,
        List<TextBoxPayload> boxes
) {
}
