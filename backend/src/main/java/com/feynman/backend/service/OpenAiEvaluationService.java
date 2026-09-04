package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.EvaluateRequest;
import com.feynman.backend.dto.EvaluationResponse;
import com.feynman.backend.dto.NotebookDto;
import com.feynman.backend.dto.PageDto;
import com.feynman.backend.dto.ScoreDto;
import com.feynman.backend.entity.Notebook;
import com.feynman.backend.repository.NotebookRepository;
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
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

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
    private final NotebookRepository notebookRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenAiEvaluationService(
            RestClient openAiRestClient, OpenAiProperties properties, NotebookRepository notebookRepository) {
        this.openAiRestClient = openAiRestClient;
        this.properties = properties;
        this.notebookRepository = notebookRepository;
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
     * pages are evaluated. When {@code request.pageId()} is set, only that
     * single page is scored and notebook aggregation is skipped — this keeps
     * the request cheap for notebooks with many pages/subpages.
     *
     * @param userId the authenticated caller — PDF context is only attached
     *               for notebooks this user actually owns, so one user can
     *               never pull another user's uploaded PDF into their prompt.
     */
    public EvaluationResponse evaluate(UUID userId, EvaluateRequest request) {
        String filterId = request.notebookId();
        String pageId = request.pageId();
        boolean singlePage = pageId != null && !pageId.isBlank();

        // A single-page request scores only that page; a notebook request scores
        // every page in the notebook; otherwise the whole dataset is scored.
        List<PageDto> pages = (request.pages() == null ? List.<PageDto>of() : request.pages())
                .stream()
                .filter(p -> singlePage
                        ? pageId.equals(p.id())
                        : (filterId == null || filterId.equals(p.notebookId())))
                .toList();

        // Notebook aggregation is meaningless for a single page, so skip it: a
        // one-page average would otherwise clobber the notebook's real score.
        List<NotebookDto> notebooks = singlePage
                ? List.of()
                : (request.notebooks() == null ? List.<NotebookDto>of() : request.notebooks())
                        .stream()
                        .filter(nb -> filterId == null || filterId.equals(nb.id()))
                        .toList();

        if (!properties.useMock() && !properties.hasApiKey() && !pages.isEmpty()) {
            throw new EvaluationException(
                    "OPENAI_API_KEY is missing. Set it or enable openai.mock=true for offline scoring.");
        }

        // Mock scoring is a fully offline heuristic — never touches the DB, so
        // this stays empty (and safe) in that mode and in tests.
        Map<String, String> pdfTextByNotebookId = properties.useMock()
                ? Map.of()
                : loadPdfTextByNotebookId(userId, pages);

        Map<String, ScoreDto> pageScores = new LinkedHashMap<>();

        // --- Per-page scoring ---------------------------------------------------
        Map<String, Integer> pageScoresById = new LinkedHashMap<>();
        for (PageDto page : pages) {
            ScoreDto score = properties.useMock()
                    ? mockScore(page)
                    : llmScore(page, pdfTextByNotebookId.get(page.notebookId()));
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
            String notebookFeedback = scores.isEmpty()
                    ? "Add and evaluate some pages to get feedback for this notebook."
                    : "Overall this notebook averages " + avg + "% understanding across "
                        + scores.size() + " page(s). Open individual pages to see targeted feedback "
                        + "on what to explain more simply or in more depth.";
            notebookScores.put(notebook.id(), new ScoreDto(avg, notes, notebookFeedback, List.of()));
        }

        return new EvaluationResponse(pageScores, notebookScores);
    }

    // ---------------------------------------------------------------------------
    // Model discovery
    // ---------------------------------------------------------------------------

    /**
     * List the model IDs the configured API key is allowed to use by calling
     * {@code GET /v1/models}. Useful to discover which models can replace the
     * default {@code openai.model}.
     *
     * @return sorted, distinct list of model IDs returned by the provider.
     */
    public List<String> listModels() {
        try {
            String responseJson = openAiRestClient.get()
                    .uri("/models")
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(String.class);

            JsonNode data = objectMapper.readTree(responseJson).path("data");
            List<String> models = new ArrayList<>();
            for (JsonNode node : data) {
                String id = node.path("id").asText("");
                if (!id.isBlank()) {
                    models.add(id);
                }
            }
            models.sort(String::compareTo);
            return models;
        } catch (RestClientResponseException e) {
            String detail = openAiErrorDetail(
                    e.getStatusCode().value(), e.getResponseBodyAsString(), properties.model());
            log.error("Listing models failed — {} Body: {}", detail, e.getResponseBodyAsString());
            throw new EvaluationException(detail, e);
        } catch (Exception e) {
            log.error("Listing models failed. Cause: {}", e.getMessage());
            throw new EvaluationException(
                    "Could not list OpenAI models. Check OPENAI_API_KEY, base URL, and network configuration.", e);
        }
    }

    // ---------------------------------------------------------------------------
    // OpenAI-backed scoring
    // ---------------------------------------------------------------------------

    /**
     * Looks up each distinct notebook referenced by {@code pages} exactly once
     * and returns its cached PDF text, keyed by notebook id. Notebooks that
     * don't belong to {@code userId}, don't exist, or have no PDF are simply
     * absent from the result — this is the ownership boundary that stops one
     * user's uploaded PDF from ever being injected into another user's prompt.
     */
    private Map<String, String> loadPdfTextByNotebookId(UUID userId, List<PageDto> pages) {
        Set<String> notebookIds = new LinkedHashSet<>();
        for (PageDto page : pages) {
            if (page.notebookId() != null) {
                notebookIds.add(page.notebookId());
            }
        }

        Map<String, String> result = new LinkedHashMap<>();
        for (String notebookId : notebookIds) {
            UUID id;
            try {
                id = UUID.fromString(notebookId);
            } catch (IllegalArgumentException e) {
                continue;
            }
            notebookRepository.findByIdAndUserId(id, userId)
                    .filter(Notebook::hasPdf)
                    .ifPresent(nb -> result.put(notebookId, nb.getPdfText()));
        }
        return result;
    }

    private ScoreDto llmScore(PageDto page, String pdfText) {
        String text = page.combinedText();
        if (text.isBlank()) {
            return new ScoreDto(0, "Page is empty.",
                    "There are no notes on this page yet to give feedback on.", List.of());
        }

        String systemPrompt = """
                You are an expert tutor grading a learner's notes using the Feynman technique:
                if someone can explain a topic simply, clearly and completely, they understand it well.
                Grade how well the learner appears to UNDERSTAND the topic based only on their notes.
                Reward: clear plain-language explanations, correct structure, worked examples,
                cause/effect reasoning, and coverage. Penalise: sparse notes, unexplained jargon,
                copy-paste lists without explanation, and contradictions.
                Respond ONLY with strict JSON of the form:
                {"score": <integer 0-100>, "understandingNotes": "<one short sentence>", \
                "feedback": "<2-4 sentences of specific, encouraging, actionable feedback: \
                what is explained well and what to clarify or expand to understand it better>", \
                "todos": ["<short imperative action the learner should do next, max ~12 words>", \
                "<another action>"]}
                Provide 2-5 todos. Each todo must be a concrete, self-contained action \
                (e.g. "Add a worked example for Bayes' theorem"). Return an empty array if \
                the notes are already excellent.""";

        String userPrompt = "Title: " + safe(page.title()) + "\n\nNotes:\n" + text;
        if (pdfText != null && !pdfText.isBlank()) {
            userPrompt += "\n\nReference material from the notebook's uploaded PDF "
                    + "(use as additional context/ground truth, but still score based on the "
                    + "learner's own explanation):\n" + pdfText;
        }

        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", properties.model());
            // Newer models (gpt-5.x family and the o-series reasoning models) only
            // accept the default temperature and reject an explicit value with a
            // 400. Send temperature=0 for determinism only where it's supported.
            if (supportsCustomTemperature(properties.model())) {
                body.put("temperature", 0);
            }
            body.put("response_format", Map.of("type", "json_object"));
            body.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            ));

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
            String feedback = parsed.path("feedback").asText("");
            List<String> todos = new ArrayList<>();
            for (JsonNode item : parsed.path("todos")) {
                String todo = item.asText("").trim();
                if (!todo.isBlank()) {
                    todos.add(todo);
                }
            }
            return new ScoreDto(score, notes, feedback, todos);
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
            return new ScoreDto(0, "Page is empty.",
                    "There are no notes on this page yet to give feedback on.", List.of());
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
                        + " word(s), with explanation evidence and uncertainty markers considered (offline mock).",
                mockFeedback(score, words, evidence, penalty + severePenalty),
                mockTodos(words, evidence, penalty + severePenalty));
    }

    /**
     * Deterministic offline to-do items that mirror what the heuristic flagged,
     * so mock mode can populate tick-box to-dos without an API call.
     */
    private static List<String> mockTodos(int words, int evidence, int uncertaintyPenalty) {
        List<String> todos = new ArrayList<>();
        if (evidence == 0) {
            todos.add("Explain WHY the key idea is true (use \"because\"/\"therefore\").");
            todos.add("Add a concrete worked example.");
        }
        if (uncertaintyPenalty > 0) {
            todos.add("Rewrite uncertain phrases as confident explanations.");
        }
        if (words < 40) {
            todos.add("Expand the notes with more detail and coverage.");
        }
        if (todos.isEmpty()) {
            todos.add("Teach the topic aloud from memory to confirm understanding.");
        }
        return todos;
    }

    /**
     * Deterministic offline feedback that mirrors what the heuristic rewarded or
     * penalised, so mock mode still shows useful, distinguishable guidance.
     */
    private static String mockFeedback(int score, int words, int evidence, int uncertaintyPenalty) {
        StringBuilder sb = new StringBuilder();
        if (score >= 75) {
            sb.append("Strong understanding: your notes explain the topic clearly and in your own words. ");
        } else if (score >= 33) {
            sb.append("Developing understanding: the core idea is there but parts could be explained more simply. ");
        } else {
            sb.append("Early understanding: the notes are sparse or uncertain, so keep building them up. ");
        }
        if (evidence > 0) {
            sb.append("Good use of reasoning and examples (\"because\", \"for example\", etc.). ");
        } else {
            sb.append("Try adding cause/effect reasoning (\"because\", \"therefore\") and a worked example. ");
        }
        if (uncertaintyPenalty > 0) {
            sb.append("Some phrases signal uncertainty — revisit those and rewrite them as confident explanations. ");
        }
        if (words < 40) {
            sb.append("Expanding the notes with more detail would demonstrate deeper understanding.");
        }
        return sb.toString().trim() + " (offline mock feedback)";
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

    /**
     * Whether a model accepts an explicit {@code temperature} value. The
     * gpt-5.x family and the o-series reasoning models (o1/o3/o4) only support
     * the default temperature and return HTTP 400 for any explicit value.
     */
    static boolean supportsCustomTemperature(String model) {
        if (model == null) {
            return true;
        }
        String m = model.toLowerCase(Locale.ROOT);
        boolean fixedTemperature = m.startsWith("gpt-5")
                || m.startsWith("o1")
                || m.startsWith("o3")
                || m.startsWith("o4");
        return !fixedTemperature;
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





