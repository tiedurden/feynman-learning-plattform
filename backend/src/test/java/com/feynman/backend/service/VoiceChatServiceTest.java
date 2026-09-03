package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.VoiceChatResponse;
import com.feynman.backend.service.VoiceChatService.VoiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@SuppressWarnings({"unchecked", "rawtypes"})
@ExtendWith(MockitoExtension.class)
class VoiceChatServiceTest {

    @Mock private RestClient restClient;
    @Mock private RestClient.RequestBodyUriSpec postSpec;
    // RequestBodySpec extends RequestHeadersSpec<RequestBodySpec> — serves both roles
    @Mock private RestClient.RequestBodySpec bodySpec;
    @Mock private RestClient.ResponseSpec responseSpec;

    private VoiceChatService service;

    private static final OpenAiProperties PROPS = new OpenAiProperties(
            "sk-test", "gpt-audio", "gpt-audio", "gpt-4o-mini-transcribe", "https://api.openai.com/v1", false);

    private static final byte[] AUDIO = "fake-audio".getBytes(StandardCharsets.UTF_8);

    private static final String VALID_RESPONSE = """
            {
              "choices": [{
                "message": {
                  "audio": {
                    "transcript": "Great explanation of photosynthesis.",
                    "data": "dGVzdA=="
                  }
                }
              }]
            }
            """;

    private static final String TRANSCRIPTION_RESPONSE = """
            { "text": "Napoleon was the king." }
            """;

    @BeforeEach
    void setUp() {
        service = new VoiceChatService(restClient, PROPS);
        // lenient: unsupported-format tests throw before the chain is entered
        lenient().when(restClient.post()).thenReturn(postSpec);
        lenient().when(postSpec.uri(anyString())).thenReturn(bodySpec);
        lenient().when(bodySpec.contentType(any())).thenReturn(bodySpec);
        lenient().doReturn(bodySpec).when(bodySpec).body(any(Object.class));
        lenient().when(bodySpec.retrieve()).thenReturn(responseSpec);
    }

    // --- format validation --------------------------------------------------

    @ParameterizedTest
    @ValueSource(strings = {"audio/aiff", "audio/flac"})
    void unsupportedFormatThrowsBeforeHttpCall(String mimeType) {
        // exception thrown before any RestClient call — no stub needed
        assertThrows(VoiceException.class,
                () -> service.chat(AUDIO, mimeType, "some notes"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"audio/wav", "audio/mp3", "audio/mpeg", "audio/mp4", "audio/x-m4a"})
    void supportedFormatReachesOpenAi(String mimeType) {
        stubSuccess();
        assertDoesNotThrow(() -> service.chat(AUDIO, mimeType, "notes"));
    }

    // --- successful response ------------------------------------------------

    @Test
    void successfulResponseMapsTranscriptAndAudioData() {
        stubSuccess();
        VoiceChatResponse res = service.chat(AUDIO, "audio/wav", "notes about photosynthesis");
        assertEquals("Great explanation of photosynthesis.", res.transcript());
        assertEquals("dGVzdA==", res.audioData());
    }

    @Test
    void successfulResponseMapsUserTranscript() {
        // chat/completions and audio/transcriptions are called in that order
        when(responseSpec.body(String.class)).thenReturn(VALID_RESPONSE, TRANSCRIPTION_RESPONSE);
        VoiceChatResponse res = service.chat(AUDIO, "audio/wav", "notes");
        assertEquals("Napoleon was the king.", res.userTranscript());
    }

    @Test
    void nullMimeTypeFallsBackToWav() {
        stubSuccess();
        assertDoesNotThrow(() -> service.chat(AUDIO, null, "notes"));
    }

    // --- OpenAI error handling ----------------------------------------------

    @Test
    void openAi401WrappedInVoiceException() {
        stubHttpError(HttpStatus.UNAUTHORIZED, "{\"error\":{\"message\":\"invalid key\"}}");
        VoiceException ex = assertThrows(VoiceException.class,
                () -> service.chat(AUDIO, "audio/wav", "notes"));
        assertTrue(ex.getMessage().contains("401"));
    }

    @Test
    void openAi429WrappedInVoiceException() {
        stubHttpError(HttpStatus.TOO_MANY_REQUESTS, "{\"error\":{\"message\":\"rate limit\"}}");
        VoiceException ex = assertThrows(VoiceException.class,
                () -> service.chat(AUDIO, "audio/wav", "notes"));
        assertTrue(ex.getMessage().contains("429") || ex.getMessage().contains("rate limit"));
    }

    // --- helpers ------------------------------------------------------------

    private void stubSuccess() {
        when(responseSpec.body(String.class)).thenReturn(VALID_RESPONSE);
    }

    private void stubHttpError(HttpStatus status, String body) {
        when(responseSpec.body(String.class)).thenThrow(
                HttpClientErrorException.create(
                        status, status.getReasonPhrase(),
                        new HttpHeaders(), body.getBytes(StandardCharsets.UTF_8),
                        StandardCharsets.UTF_8));
    }
}
