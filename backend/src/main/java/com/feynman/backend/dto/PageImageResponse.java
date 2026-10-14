package com.feynman.backend.dto;

/** Metadata for an uploaded image; binary content is served by a separate endpoint. */
public record PageImageResponse(
        String id,
        String fileName,
        String contentType,
        long size,
        double x,
        double y
) {
}
