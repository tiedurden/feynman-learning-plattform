package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.EvaluateRequest;
import com.feynman.backend.dto.EvaluationResponse;
import com.feynman.backend.dto.NotebookDto;
import com.feynman.backend.dto.PageDto;
import com.feynman.backend.dto.ScoreDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Evaluates a user's notebooks/pages and scores how well each topic seems to
 * be understood, following the Feynman technique: clear, simple, structured
 * explanations score higher; sparse notes or unexplained jargon score lower.
 *
 * <p>When {@code openai.mock=true}, a deterministic heuristic is used so the
 * app runs fully offline. With mock scoring disabled, a missing key or failed
 * OpenAI request is reported instead of silently returning a mock score.</p>
 */
@Service
public class OpenAiEvaluationService {

    private static final Logger log = LoggerFactory.getLogger(OpenAiEvaluationService.class);

    private final RestClient openAiRestClient;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenAiEvaluationService(RestClient openAiRestClient, OpenAiProperties properties) {
        this.openAiRestClient = openAiRestClient;
        this.properties = properties;
        // Startup diagnostic: confirms what Spring actually bound WITHOUT leaking
        // the secret. If keyPresent=false here, the env var never reached this
        // JVM process (wrong run config, not restarted, or set in another shell).
        String key = properties.apiKey();
        String masked = (key == null || key.isBlank())
                ? "<none>"
                : "set (len=" + key.trim().length() + ", ..." 
                    + key.substring(Math.max(0, key.length() - 4)) + ")";
        log.debug("OpenAI config → mock={}, keyPresent={}, key={}, model={}",
                properties.mock(), properties.hasApiKey(), masked, properties.model());
    }

    /**
     * Score every page, then aggregate page scores into a notebook score.
     * When {@code request.notebookId()} is set, only that notebook and its
     * pages are evaluated.
     */
    public EvaluationResponse evaluate(EvaluateRequest request) {
        String filterId = request.notebookId();

        List<NotebookDto> notebooks = (request.notebooks() == null ? List.<NotebookDto>of() : request.notebooks())
                .stream()
                .filter(nb -> filterId == null || filterId.equals(nb.id()))
                .toList();

        List<PageDto> pages = (request.pages() == null ? List.<PageDto>of() : request.pages())
                .stream()
                .filter(p -> filterId == null || filterId.equals(p.notebookId()))
                .toList();

        if (!properties.useMock() && !properties.hasApiKey() && !pages.isEmpty()) {
            throw new EvaluationException(
                    "OPENAI_API_KEY is missing. Set it or enable openai.mock=true for offline scoring.");
        }

        Map<String, ScoreDto> pageScores = new LinkedHashMap<>();

        // --- Per-page scoring ---------------------------------------------------
        Map<String, Integer> pageScoresById = new LinkedHashMap<>();
        for (PageDto page : pages) {
            ScoreDto score = properties.useMock() ? mockScore(page) : llmScore(page);
            pageScores.put(page.id(), score);
            pageScoresById.put(page.id(), score.score());
        }

        // --- Notebook aggregation (average of its pages) ------------------------
        Map<String, ScoreDto> notebookScores = new LinkedHashMap<>();
        for (NotebookDto notebook : notebooks) {
            List<Integer> scores = new ArrayList<>();
            for (PageDto page : pages) {
                if (notebook.id().equals(page.notebookId())) {
                    scores.add(pageScoresById.getOrDefault(page.id(), 0));
                }
            }
            int avg = scores.isEmpty()
                    ? 0
                    : (int) Math.round(scores.stream().mapToInt(Integer::intValue).average().orElse(0));
            String notes = scores.isEmpty()
                    ? "No pages to evaluate yet."
                    : "Average understanding across " + scores.size() + " page(s).";
            notebookScores.put(notebook.id(), new ScoreDto(avg, notes));
        }

        return new EvaluationResponse(pageScores, notebookScores);
    }

    // ---------------------------------------------------------------------------
    // OpenAI-backed scoring
    // ---------------------------------------------------------------------------

    private ScoreDto llmScore(PageDto page) {
        String text = page.combinedText();
        if (text.isBlank()) {
            return new ScoreDto(0, "Page is empty.");
        }

        String systemPrompt = """
                You are an expert tutor grading a learner's notes using the Feynman technique:
                if someone can explain a topic simply, clearly and completely, they understand it well.
                Grade how well the learner appears to UNDERSTAND the topic based only on their notes.
                Reward: clear plain-language explanations, correct structure, worked examples,
                cause/effect reasoning, and coverage. Penalise: sparse notes, unexplained jargon,
                copy-paste lists without explanation, and contradictions.
                Respond ONLY with strict JSON of the form:
                {"score": <integer 0-100>, "understandingNotes": "<one short sentence>"}""";

        String userPrompt = "Title: " + safe(page.title()) + "\n\nNotes:\n" + text;

        try {
            Map<String, Object> body = Map.of(
                    "model", properties.model(),
                    "temperature", 0,
                    "response_format", Map.of("type", "json_object"),
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );

            String responseJson = openAiRestClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(responseJson);
            String content = root.path("choices").path(0).path("message").path("content").asText();
            JsonNode parsed = objectMapper.readTree(content);

            int score = clamp(parsed.path("score").asInt(0));
            String notes = parsed.path("understandingNotes").asText("");
            return new ScoreDto(score, notes);
        } catch (RestClientResponseException e) {
            // OpenAI returned an HTTP error — translate common cases into clear,
            // actionable messages instead of a generic failure.
            String detail = openAiErrorDetail(
                    e.getStatusCode().value(), e.getResponseBodyAsString(), properties.model());
            log.error("LLM scoring failed for page {} — {} Body: {}",
                    page.id(), detail, e.getResponseBodyAsString());
            throw new EvaluationException(detail, e);
        } catch (Exception e) {
            log.error("LLM scoring failed for page {}. Cause: {}", page.id(), e.getMessage());
            throw new EvaluationException(
                    "OpenAI evaluation failed. Check OPENAI_API_KEY, model, and network configuration.", e);
        }
    }

    /**
     * Map an OpenAI HTTP error status (and body) into a clear, actionable
     * message. Package-private and static so it can be unit-tested directly.
     */
    static String openAiErrorDetail(int status, String responseBody, String model) {
        String body = responseBody == null ? "" : responseBody;
        return switch (status) {
            case 401 -> "OpenAI rejected the API key (401). Check OPENAI_API_KEY is valid and not revoked.";
            case 403 -> "OpenAI denied access (403). The key may lack permission for model '"
                    + model + "'.";
            case 404 -> "OpenAI model '" + model
                    + "' not found (404). Set OPENAI_MODEL to a model your account can use.";
            case 429 -> body.contains("insufficient_quota")
                    ? "OpenAI account has no credits. Add billing credits at "
                        + "platform.openai.com/settings/organization/billing."
                    : "OpenAI rate limit hit (429). Wait a moment and try again.";
            default -> "OpenAI request failed (HTTP " + status + ").";
        };
    }

    // ---------------------------------------------------------------------------
    // Deterministic offline heuristic
    // ---------------------------------------------------------------------------

    /**
     * Deterministic offline score used when mock scoring is enabled.
     * Length alone is not understanding, so uncertainty and missing
     * explanations lower the result.
     */
    ScoreDto mockScore(PageDto page) {
        String text = page.combinedText();
        if (text.isBlank()) {
            return new ScoreDto(0, "Page is empty.");
        }

        String normalized = text.toLowerCase(Locale.ROOT);
        int words = text.split("\\s+").length;
        // Notes receive limited credit for effort, but not mastery from length.
        int effort = Math.min(70, words * 70 / 120);

        int evidence = 0;
        if (normalized.contains("because") || normalized.contains("therefore")
                || normalized.contains("which means") || normalized.contains("as a result")) {
            evidence += 10;
        }
        if (normalized.contains("for example") || normalized.contains("example:")) {
            evidence += 8;
        }
        if (normalized.contains("why") || normalized.contains("how")) {
            evidence += 5;
        }
        if (normalized.contains("=")) {
            evidence += 3;
        }

        int uncertainty = countOccurrences(normalized,
                "not sure", "no idea", "fuzzy", "unclear", "maybe", "i think",
                "unsure", "wrong answer", "need to review", "not totally clear");
        int penalty = Math.min(30, uncertainty * 3);
        // Strong admissions of missing understanding should weigh more than
        // ordinary hedging, without penalising merely incomplete notes equally.
        int severeUncertainty = countOccurrences(normalized,
                "no idea", "never understood", "completely confused", "don't understand");
        int severePenalty = Math.min(20, severeUncertainty * 9);
        int score = clamp(effort + evidence - penalty - severePenalty);
        return new ScoreDto(score,
                "Heuristic score from " + words
                        + " word(s), with explanation evidence and uncertainty markers considered (offline mock).");
    }

    private static int countOccurrences(String text, String... terms) {
        int count = 0;
        for (String term : terms) {
            int from = 0;
            while ((from = text.indexOf(term, from)) >= 0) {
                count++;
                from += term.length();
            }
        }
        return count;
    }

    private static int clamp(int v) {
        return Math.max(0, Math.min(100, v));
    }

    private static String safe(String s) {
        return s == null ? "" : s;
    }

    /**
     * Thrown when evaluation cannot be completed.
     */
    public static class EvaluationException extends RuntimeException {
        public EvaluationException(String message) {
            super(message);
        }

        public EvaluationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}





