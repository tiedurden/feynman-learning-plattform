package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.EvaluateRequest;
import com.feynman.backend.dto.EvaluationResponse;
import com.feynman.backend.dto.NotebookDto;
import com.feynman.backend.dto.PageDto;
import com.feynman.backend.dto.ScoreDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for the deterministic (mock) scoring path — no API key required.
 */
class OpenAiEvaluationServiceTest {

    private OpenAiEvaluationService newMockService() {
        OpenAiProperties props = new OpenAiProperties("", "gpt-4o-mini",
                "https://api.openai.com/v1", true);
        return new OpenAiEvaluationService(null, props);
    }

    @Test
    void scoresAreDeterministicAndBounded() {
        OpenAiEvaluationService service = newMockService();
        PageDto page = new PageDto("pg-feynman", "nb-study", null,
                "Feynman Technique",
                "Pick a concept, teach it simply, identify gaps, review and simplify.",
                List.of(), 0);

        EvaluateRequest request = new EvaluateRequest(
                List.of(new NotebookDto("nb-study", "Study", "#c94f0c")),
                List.of(page), null);

        EvaluationResponse first = service.evaluate(request);
        EvaluationResponse second = service.evaluate(request);

        ScoreDto pageScore = first.pageScores().get("pg-feynman");
        assertEquals(pageScore.score(), second.pageScores().get("pg-feynman").score(),
                "Mock scoring must be deterministic");
        assertTrue(pageScore.score() >= 0 && pageScore.score() <= 100,
                "Score must be within 0–100");
    }

    @Test
    void notebookScoreAggregatesPages() {
        OpenAiEvaluationService service = newMockService();
        PageDto p1 = new PageDto("pg-1", "nb-1", null, "A", "one two three", List.of(), 0);
        PageDto p2 = new PageDto("pg-2", "nb-1", null, "B", "four five six seven", List.of(), 1);

        EvaluationResponse res = service.evaluate(new EvaluateRequest(
                List.of(new NotebookDto("nb-1", "N", "#000")),
                List.of(p1, p2), null));

        int expected = Math.round(
                (res.pageScores().get("pg-1").score() + res.pageScores().get("pg-2").score()) / 2f);
        assertEquals(expected, res.notebookScores().get("nb-1").score());
    }

    @Test
    void emptyPageScoresZero() {
        OpenAiEvaluationService service = newMockService();
        PageDto empty = new PageDto("pg-empty", "nb-1", null, "Empty", "   ", List.of(), 0);
        EvaluationResponse res = service.evaluate(
                new EvaluateRequest(List.of(), List.of(empty), null));
        assertEquals(0, res.pageScores().get("pg-empty").score());
    }

    @Test
    void notebookIdFilterLimitsScope() {
        OpenAiEvaluationService service = newMockService();
        PageDto a = new PageDto("pg-a", "nb-1", null, "A", "alpha beta gamma", List.of(), 0);
        PageDto b = new PageDto("pg-b", "nb-2", null, "B", "delta epsilon", List.of(), 0);

        EvaluationResponse res = service.evaluate(new EvaluateRequest(
                List.of(new NotebookDto("nb-1", "One", "#000"),
                        new NotebookDto("nb-2", "Two", "#111")),
                List.of(a, b), "nb-1"));

        assertTrue(res.pageScores().containsKey("pg-a"));
        assertTrue(!res.pageScores().containsKey("pg-b"), "Filtered notebook page must be excluded");
        assertTrue(res.notebookScores().containsKey("nb-1"));
        assertTrue(!res.notebookScores().containsKey("nb-2"));
    }

    // --- Mock scoring bands -----------------------------------------------------

    @Test
    void uncertainNotesScoreLow() {
        OpenAiEvaluationService service = newMockService();
        PageDto pythagoras = new PageDto("pg-pythagoras", "nb-math", null,
                "Pythagorean Theorem",
                "Formula is a2 + b2 = c2 or was it a + b = c2? Not sure which side is which. "
                        + "Maybe only right-angled ones?? No idea why it is true. Never understood the proof.",
                List.of(), 0);

        int score = service.mockScore(pythagoras).score();
        assertTrue(score <= 45, "Uncertain notes should score low, was " + score);
    }

    @Test
    void detailedConfidentNotesScoreHigh() {
        OpenAiEvaluationService service = newMockService();
        // Genuinely detailed notes (>120 words) with explanations and no
        // uncertainty — the effort term saturates and evidence bonuses apply.
        String detailed = "Photosynthesis converts light energy into chemical energy because "
                + "chlorophyll in the thylakoid membranes absorbs photons and excites electrons. "
                + "For example, water is split during photolysis which means oxygen is released as a "
                + "by-product while protons build a gradient. That gradient drives ATP synthase, "
                + "therefore ATP and NADPH are produced in the light-dependent reactions. In the "
                + "Calvin cycle the enzyme RuBisCO fixes carbon dioxide onto RuBP, and because the "
                + "ATP and NADPH from the light stage are spent, glucose is gradually assembled. "
                + "This explains how the two stages are coupled and why neither can run alone. "
                + "The overall balance 6 CO2 + 6 H2O = C6H12O6 + 6 O2 summarises the process, and "
                + "this is why photosynthesis underpins food chains and the carbon cycle as a result.";

        int score = service.mockScore(page(detailed)).score();
        assertTrue(score >= 70, "Detailed, confident notes should score high, was " + score);
    }

    private static PageDto page(String content) {
        return new PageDto("pg-detail", "nb-bio", null, "Photosynthesis", content, List.of(), 0);
    }

    @Test
    void uncertainScoresBelowConfident() {
        OpenAiEvaluationService service = newMockService();
        PageDto weak = new PageDto("pg-weak", "n", null, "Weak",
                "not sure, no idea, never understood this at all maybe", List.of(), 0);
        PageDto strong = new PageDto("pg-strong", "n", null, "Strong",
                "This works because the parts connect, for example therefore it follows clearly = yes",
                List.of(), 0);

        assertTrue(service.mockScore(weak).score() < service.mockScore(strong).score(),
                "Uncertain notes must score below confident, explained notes");
    }

    // --- OpenAI error mapping ---------------------------------------------------

    @Test
    void errorMappingProducesActionableMessages() {
        assertTrue(OpenAiEvaluationService.openAiErrorDetail(401, "", "gpt-4o-mini")
                .contains("API key"), "401 should mention the API key");
        assertTrue(OpenAiEvaluationService.openAiErrorDetail(404, "", "gpt-4o-mini")
                .contains("gpt-4o-mini"), "404 should name the model");
        assertTrue(OpenAiEvaluationService.openAiErrorDetail(
                        429, "{\"error\":{\"code\":\"insufficient_quota\"}}", "gpt-4o-mini")
                .toLowerCase().contains("credits"), "429 quota should mention credits");
        assertTrue(OpenAiEvaluationService.openAiErrorDetail(429, "slow down", "gpt-4o-mini")
                .toLowerCase().contains("rate limit"), "429 non-quota should mention rate limit");
        assertTrue(OpenAiEvaluationService.openAiErrorDetail(500, "", "gpt-4o-mini")
                .contains("500"), "Unknown status should include the code");
    }
}


