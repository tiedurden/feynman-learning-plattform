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

import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    public static class VoiceException extends RuntimeException {
        public VoiceException(String message, Throwable cause) {
            super(message, cause);
        }
        public VoiceException(String message) {
            super(message);
        }
    }
}
