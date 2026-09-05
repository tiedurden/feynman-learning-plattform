package com.feynman.backend.dto;

/** A saved notebook belonging to the authenticated user. */
public record NotebookResponse(
        String id,
        String title,
        String color,
        boolean hasPdf,
        String pdfFileName
) {
}
