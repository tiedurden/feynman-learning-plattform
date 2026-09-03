package com.feynman.backend.dto;

import java.util.List;

/** A saved page. {@code parentId} is null for a top-level page directly under the notebook. */
public record PageResponse(
        String id,
        String notebookId,
        String parentId,
        String title,
        String content,
        int order,
        List<TextBoxPayload> boxes
) {
}
