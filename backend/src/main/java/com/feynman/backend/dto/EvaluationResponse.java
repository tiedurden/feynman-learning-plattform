package com.feynman.backend.dto;

import java.util.Map;

/**
 * Response payload for {@code POST /api/evaluate}.
 *
 * <p>Scores are split so the frontend can merge page- and notebook-level
 * results independently, matching the shape consumed by {@code setLiveScores}.
 * Each map is keyed by the entity id (matching the frontend seed ids).</p>
 */
public record EvaluationResponse(
        Map<String, ScoreDto> pageScores,
        Map<String, ScoreDto> notebookScores
) {
}


