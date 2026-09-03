package com.feynman.backend.dto;

import java.util.List;

/** A free-floating text box on a page's canvas. */
public record TextBoxPayload(
        String id,
        int x,
        int y,
        Integer width,
        String text,
        List<TextReferencePayload> references
) {
}
