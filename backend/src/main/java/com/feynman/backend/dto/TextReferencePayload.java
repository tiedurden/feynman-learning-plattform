package com.feynman.backend.dto;

import java.util.List;

/** An inline reference: a character range of a {@link TextBoxPayload}'s text linking to another page. */
public record TextReferencePayload(
        String id,
        int start,
        int end,
        String targetPageId
) {
    public static List<TextReferencePayload> emptyIfNull(List<TextReferencePayload> refs) {
        return refs == null ? List.of() : refs;
    }
}
