package com.feynman.backend.dto;

import java.util.List;

/**
 * Mirrors the frontend {@code Page} type. Represents a single page whose
 * understanding we want to score.
 */
public record PageDto(
        String id,
        String notebookId,
        String parentId,
        String title,
        String content,
        List<TextBoxDto> boxes,
        Integer order
) {
    /** Combined free text of the page (content + all text boxes). */
    public String combinedText() {
        StringBuilder sb = new StringBuilder();
        if (content != null) {
            sb.append(content);
        }
        if (boxes != null) {
            for (TextBoxDto box : boxes) {
                if (box != null && box.text() != null && !box.text().isBlank()) {
                    sb.append("\n").append(box.text());
                }
            }
        }
        return sb.toString().trim();
    }
}
