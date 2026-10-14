package com.feynman.backend.dto;

/** Position of an uploaded image element on a page's canvas. */
public record PageImagePayload(String id, double x, double y) {
}
