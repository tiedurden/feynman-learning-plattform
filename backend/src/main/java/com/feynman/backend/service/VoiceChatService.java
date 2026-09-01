package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.VoiceChatResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class VoiceChatService {

    private static final Logger log = LoggerFactory.getLogger(VoiceChatService.class);

    private final RestClient openAiRestClient;
    private final OpenAiProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public VoiceChatService(RestClient openAiRestClient, OpenAiProperties properties) {
        this.openAiRestClient = openAiRestClient;
        this.properties = properties;
    }

    // gpt-audio only accepts wav and mp3 as input formats
    private static final java.util.Set<String> SUPPORTED_FORMATS = java.util.Set.of("wav", "mp3");

    public VoiceChatResponse chat(byte[] audioBytes, String mimeType, String noteText) {
        String rawFormat = mimeType != null && mimeType.contains("/")
                ? mimeType.substring(mimeType.indexOf('/') + 1).split(";")[0]
                : "wav";
        // m4a arrives as "x-m4a" or "mp4" — treat as mp3-compatible
        String audioFormat = switch (rawFormat) {
            case "mpeg", "x-mpeg", "mp4", "x-m4a", "m4a" -> "mp3";
            default -> rawFormat;
        };

        // gpt-audio rejects ogg outright, so transcode it to wav via ffmpeg first
        if ("ogg".equals(audioFormat)) {
            audioBytes = convertOggToWav(audioBytes);
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
                to deepen their understanding. Keep your response concise and encouraging."""
                + "\n\nReference notes:\n" + noteText;

        Map<String, Object> inputAudio = new LinkedHashMap<>();
        inputAudio.put("type", "input_audio");
        inputAudio.put("input_audio", Map.of("data", base64Audio, "format", audioFormat));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", properties.audioModel());
        body.put("modalities", List.of("text", "audio"));
        body.put("audio", Map.of("voice", "alloy", "format", "wav"));
        body.put("messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", List.of(inputAudio))
        ));

        try {
            String responseJson = openAiRestClient.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode audio = objectMapper.readTree(responseJson)
                    .path("choices").path(0).path("message").path("audio");

            String transcript = audio.path("transcript").asText("");
            String audioData  = audio.path("data").asText("");
            return new VoiceChatResponse(transcript, audioData);

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

    /** Shells out to the system {@code ffmpeg} binary to transcode Ogg/Vorbis audio to PCM WAV. */
    private byte[] convertOggToWav(byte[] oggBytes) {
        Path oggFile = null;
        Path wavFile = null;
        try {
            oggFile = Files.createTempFile("voice-", ".ogg");
            wavFile = Files.createTempFile("voice-", ".wav");
            Files.write(oggFile, oggBytes);

            Process process = new ProcessBuilder(
                    "ffmpeg", "-y", "-i", oggFile.toString(),
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
                    "Could not convert ogg audio to wav. Is ffmpeg installed and on PATH?", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new VoiceException("Audio conversion was interrupted.", e);
        } finally {
            deleteQuietly(oggFile);
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
