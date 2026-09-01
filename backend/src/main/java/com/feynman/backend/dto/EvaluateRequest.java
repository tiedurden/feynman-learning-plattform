package com.feynman.backend.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * Request payload for {@code POST /api/evaluate}.
 *
 * <p>The frontend sends its full set of notebooks and pages; the backend
 * returns an understanding score (0–100) for every page and an aggregate
 * score for every notebook. When {@code notebookId} is provided, only that
 * notebook (and its pages) is evaluated.</p>
 *
 * @param notebookId Optional filter — evaluate only this notebook when set.
 */
public record EvaluateRequest(
        @NotNull List<NotebookDto> notebooks,
        @NotNull List<PageDto> pages,
        String notebookId,
        String pageId
) {
}


