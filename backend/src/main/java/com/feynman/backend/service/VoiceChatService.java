package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.VoiceChatResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

@Service
public class VoiceChatService {

    private static final Logger log = LoggerFactory.getLogger(VoiceChatService.class);

    private final RestClient openAiRestClient;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** Runs the learner-transcription call alongside the tutor completion. */
    private final ExecutorService executor =
            Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "voice-transcribe");
                t.setDaemon(true);
                return t;
            });

    public VoiceChatService(RestClient openAiRestClient, OpenAiProperties properties) {
        this.openAiRestClient = openAiRestClient;
        this.properties = properties;
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    // gpt-audio only accepts wav and mp3 as input formats
    private static final java.util.Set<String> SUPPORTED_FORMATS = java.util.Set.of("wav", "mp3");

    /** Upper bound on replayed turns, mirroring the client cap, to keep prompts bounded. */
    private static final int MAX_HISTORY_MESSAGES = 20;

    public VoiceChatResponse chat(byte[] audioBytes, String mimeType, String noteText) {
        return chat(audioBytes, mimeType, noteText, null);
    }

    public VoiceChatResponse chat(byte[] audioBytes, String mimeType, String noteText,
                                  String historyJson) {
        String rawFormat = mimeType != null && mimeType.contains("/")
                ? mimeType.substring(mimeType.indexOf('/') + 1).split(";")[0]
                : "wav";
        // m4a arrives as "x-m4a" or "mp4" — treat as mp3-compatible
        String audioFormat = switch (rawFormat) {
            case "mpeg", "x-mpeg", "mp4", "x-m4a", "m4a" -> "mp3";
            default -> rawFormat;
        };

        // gpt-audio rejects ogg/webm outright (browser MediaRecorder output), so transcode via ffmpeg first
        if ("ogg".equals(audioFormat) || "webm".equals(audioFormat)) {
            audioBytes = convertToWav(audioBytes, audioFormat);
            audioFormat = "wav";
        }

        if (!SUPPORTED_FORMATS.contains(audioFormat)) {
            throw new VoiceException(
                    "Unsupported audio format '" + audioFormat + "'. Send wav or mp3.");
        }

        String base64Audio = Base64.getEncoder().encodeToString(audioBytes);

        String systemPrompt = """
                You are a supportive Feynman-technique tutor. The learner will send you a voice \
                explanation of a topic. You have their reference notes below.
                Compare what they said to those notes: praise what they explained correctly, \
                point out any gaps or misconceptions, then ask ONE focused reflection question \
                to deepen their understanding. Keep your response concise and encouraging.
                If earlier turns of this conversation are present, build on them: acknowledge \
                progress since the last turn and avoid repeating feedback you already gave."""
                + "\n\nReference notes:\n" + noteText;

        Map<String, Object> inputAudio = new LinkedHashMap<>();
        inputAudio.put("type", "input_audio");
        inputAudio.put("input_audio", Map.of("data", base64Audio, "format", audioFormat));

        List<Map<String, Object>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", systemPrompt));
        messages.addAll(parseHistory(historyJson));
        messages.add(Map.of("role", "user", "content", List.of(inputAudio)));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", properties.audioModel());
        body.put("modalities", List.of("text", "audio"));
        body.put("audio", Map.of("voice", "alloy", "format", "wav"));
        body.put("messages", messages);

        try {
            long started = System.nanoTime();

            // The learner's transcript is independent of the tutor's reply, so run both
            // OpenAI calls concurrently instead of paying for two sequential round-trips.
            final byte[] audioForTranscript = audioBytes;
            CompletableFuture<String> transcriptFuture =
                    CompletableFuture.supplyAsync(() -> transcribeAudio(audioForTranscript), executor);

            String responseJson = openAiRestClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            long chatMs = (System.nanoTime() - started) / 1_000_000;

            JsonNode audio = objectMapper.readTree(responseJson)
                    .path("choices").path(0).path("message").path("audio");

            String userTranscript = transcriptFuture.join();
            log.info("Voice chat timings — completion {}ms, total {}ms",
                    chatMs, (System.nanoTime() - started) / 1_000_000);

            String transcript = audio.path("transcript").asText("");
            String audioData  = audio.path("data").asText("");
            return new VoiceChatResponse(userTranscript, transcript, audioData);

        } catch (RestClientResponseException e) {
            String detail = OpenAiEvaluationService.openAiErrorDetail(
                    e.getStatusCode().value(), e.getResponseBodyAsString(), properties.audioModel());
            log.error("Voice chat failed — {} Body: {}", detail, e.getResponseBodyAsString());
            throw new VoiceException(detail, e);
        } catch (Exception e) {
            log.error("Voice chat failed. Cause: {}", e.getMessage());
            throw new VoiceException(
                    "Voice chat failed. Check OPENAI_API_KEY, audio-model, and network configuration.", e);
        }
    }

    /**
     * Separately transcribes the learner's own audio via OpenAI's speech-to-text endpoint.
     * Runs in parallel with the tutor completion; failures degrade to an empty transcript
     * rather than failing the whole request.
     */
    private String transcribeAudio(byte[] wavBytes) {
        try {
            MultipartBodyBuilder builder = new MultipartBodyBuilder();
            builder.part("file", new ByteArrayResource(wavBytes) {
                @Override
                public String getFilename() {
                    return "audio.wav";
                }
            });
            builder.part("model", properties.transcriptionModel());

            String responseJson = openAiRestClient.post()
                    .uri("/audio/transcriptions")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(builder.build())
                    .retrieve()
                    .body(String.class);

            return objectMapper.readTree(responseJson).path("text").asText("");
        } catch (Exception e) {
            log.warn("Transcription of learner audio failed: {}", e.getMessage());
            return "";
        }
    }

    /**
     * Parses the client's prior turns into plain text chat messages. Past turns are replayed as
     * text (not audio) to keep the request small — the model only needs what was said, not how.
     * Malformed history is ignored rather than failing the request.
     */
    private List<Map<String, Object>> parseHistory(String historyJson) {
        if (historyJson == null || historyJson.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(historyJson);
            if (!root.isArray()) {
                return List.of();
            }
            List<Map<String, Object>> messages = new ArrayList<>();
            for (JsonNode node : root) {
                String role = node.path("role").asText("");
                String text = node.path("text").asText("");
                if (text.isBlank() || !("user".equals(role) || "assistant".equals(role))) {
                    continue;
                }
                messages.add(Map.of("role", role, "content", text));
            }
            // Keep only the most recent exchanges if the client sent more than expected.
            if (messages.size() > MAX_HISTORY_MESSAGES) {
                messages = new ArrayList<>(
                        messages.subList(messages.size() - MAX_HISTORY_MESSAGES, messages.size()));
            }
            return messages;
        } catch (Exception e) {
            log.warn("Ignoring malformed voice chat history: {}", e.getMessage());
            return List.of();
        }
    }

    /** Shells out to the system {@code ffmpeg} binary to transcode ogg/webm audio to PCM WAV. */
    private byte[] convertToWav(byte[] inputBytes, String sourceFormat) {
        Path inputFile = null;
        Path wavFile = null;
        try {
            inputFile = Files.createTempFile("voice-", "." + sourceFormat);
            wavFile = Files.createTempFile("voice-", ".wav");
            Files.write(inputFile, inputBytes);

            Process process = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", inputFile.toString(),
                    "-ar", "24000", "-ac", "1", wavFile.toString())
                    .redirectErrorStream(true)
                    .start();

            if (!process.waitFor(30, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new VoiceException("Audio conversion timed out.");
            }
            if (process.exitValue() != 0) {
                throw new VoiceException("Audio conversion failed (ffmpeg exit code "
                        + process.exitValue() + ").");
            }
            return Files.readAllBytes(wavFile);
        } catch (IOException e) {
            throw new VoiceException(
                    "Could not convert " + sourceFormat + " audio to wav. Is ffmpeg installed and on PATH?", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new VoiceException("Audio conversion was interrupted.", e);
        } finally {
            deleteQuietly(inputFile);
            deleteQuietly(wavFile);
        }
    }

    private void deleteQuietly(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException e) {
            log.warn("Could not delete temp file {}", path, e);
        }
    }

    public static class VoiceException extends RuntimeException {
        public VoiceException(String message, Throwable cause) {
            super(message, cause);
        }
        public VoiceException(String message) {
            super(message);
        }
    }
}
