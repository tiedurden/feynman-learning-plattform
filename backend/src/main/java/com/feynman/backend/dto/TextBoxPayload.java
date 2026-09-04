package com.feynman.backend.dto;

import java.util.List;

/** A free-floating text box on a page's canvas. */
public record TextBoxPayload(
        String id,
        double x,
        double y,
        Double width,
        String text,
        List<TextReferencePayload> references
) {
}
