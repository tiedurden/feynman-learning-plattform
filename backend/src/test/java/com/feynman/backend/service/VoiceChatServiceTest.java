package com.feynman.backend.service;

import com.feynman.backend.config.OpenAiProperties;
import com.feynman.backend.dto.VoiceChatResponse;
import com.feynman.backend.service.VoiceChatService.VoiceException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;

@SuppressWarnings("unchecked")
@ExtendWith(MockitoExtension.class)
class VoiceChatServiceTest {

    private static final String CHAT_URI = "/chat/completions";
    private static final String TRANSCRIBE_URI = "/audio/transcriptions";

    @Mock private RestClient restClient;
    @Mock private RestClient.RequestBodyUriSpec postSpec;
    // RequestBodySpec extends RequestHeadersSpec<RequestBodySpec> — serves both roles.
    // The two endpoints get their own spec chains so stubbing does not depend on call
    // order: the completion and the transcription are issued concurrently.
    @Mock private RestClient.RequestBodySpec chatBodySpec;
    @Mock private RestClient.RequestBodySpec transcribeBodySpec;
    @Mock private RestClient.ResponseSpec chatResponseSpec;
    @Mock private RestClient.ResponseSpec transcribeResponseSpec;

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
        lenient().when(postSpec.uri(CHAT_URI)).thenReturn(chatBodySpec);
        lenient().when(postSpec.uri(TRANSCRIBE_URI)).thenReturn(transcribeBodySpec);

        lenient().when(chatBodySpec.contentType(any())).thenReturn(chatBodySpec);
        lenient().doReturn(chatBodySpec).when(chatBodySpec).body(any(Object.class));
        lenient().when(chatBodySpec.retrieve()).thenReturn(chatResponseSpec);
        lenient().when(chatResponseSpec.body(String.class)).thenReturn(VALID_RESPONSE);

        lenient().when(transcribeBodySpec.contentType(any())).thenReturn(transcribeBodySpec);
        lenient().doReturn(transcribeBodySpec).when(transcribeBodySpec).body(any(Object.class));
        lenient().when(transcribeBodySpec.retrieve()).thenReturn(transcribeResponseSpec);
        lenient().when(transcribeResponseSpec.body(String.class)).thenReturn(TRANSCRIPTION_RESPONSE);
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
        assertDoesNotThrow(() -> service.chat(AUDIO, mimeType, "notes"));
    }

    // --- successful response ------------------------------------------------

    @Test
    void successfulResponseMapsTranscriptAndAudioData() {
        VoiceChatResponse res = service.chat(AUDIO, "audio/wav", "notes about photosynthesis");
        assertEquals("Great explanation of photosynthesis.", res.transcript());
        assertEquals("dGVzdA==", res.audioData());
    }

    @Test
    void successfulResponseMapsUserTranscript() {
        VoiceChatResponse res = service.chat(AUDIO, "audio/wav", "notes");
        assertEquals("Napoleon was the king.", res.userTranscript());
    }

    @Test
    void nullMimeTypeFallsBackToWav() {
        assertDoesNotThrow(() -> service.chat(AUDIO, null, "notes"));
    }

    /** The learner transcript is a nice-to-have; losing it must not waste the completion. */
    @Test
    void transcriptionFailureDegradesToEmptyTranscriptWithoutFailingRequest() {
        lenient().when(transcribeResponseSpec.body(String.class))
                .thenThrow(HttpClientErrorException.create(
                        HttpStatus.SERVICE_UNAVAILABLE, "unavailable",
                        new HttpHeaders(), new byte[0], StandardCharsets.UTF_8));

        VoiceChatResponse res = service.chat(AUDIO, "audio/wav", "notes");

        assertEquals("", res.userTranscript());
        assertEquals("Great explanation of photosynthesis.", res.transcript());
    }

    // --- conversation history -----------------------------------------------

    @Test
    void historyIsReplayedBetweenSystemPromptAndCurrentAudio() {
        String history = """
                [{"role":"user","text":"Photosynthesis makes sugar."},
                 {"role":"assistant","text":"Good. What supplies the energy?"}]
                """;

        service.chat(AUDIO, "audio/wav", "notes", history);

        List<Map<String, Object>> messages = capturedMessages();
        assertEquals(4, messages.size());
        assertEquals("system", messages.get(0).get("role"));
        assertEquals("user", messages.get(1).get("role"));
        assertEquals("Photosynthesis makes sugar.", messages.get(1).get("content"));
        assertEquals("assistant", messages.get(2).get("role"));
        assertEquals("Good. What supplies the energy?", messages.get(2).get("content"));
        // the freshly recorded audio is always last
        assertEquals("user", messages.get(3).get("role"));
        assertInstanceOf(List.class, messages.get(3).get("content"));
    }

    @Test
    void nullHistorySendsOnlySystemAndAudioMessages() {
        service.chat(AUDIO, "audio/wav", "notes", null);
        assertEquals(2, capturedMessages().size());
    }

    @Test
    void malformedHistoryIsIgnoredRatherThanFailing() {
        assertDoesNotThrow(() -> service.chat(AUDIO, "audio/wav", "notes", "not-json"));
        assertEquals(2, capturedMessages().size());
    }

    @Test
    void historyEntriesWithUnknownRolesOrBlankTextAreSkipped() {
        String history = """
                [{"role":"system","text":"ignore me"},
                 {"role":"user","text":""},
                 {"role":"assistant","text":"kept"}]
                """;

        service.chat(AUDIO, "audio/wav", "notes", history);

        List<Map<String, Object>> messages = capturedMessages();
        assertEquals(3, messages.size());
        assertEquals("kept", messages.get(1).get("content"));
    }

    /** Prompts must stay bounded even if a client ignores its own retention cap. */
    @Test
    void historyIsTruncatedToTheMostRecentMessages() {
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < 40; i++) {
            if (i > 0) json.append(',');
            json.append("{\"role\":\"user\",\"text\":\"turn-").append(i).append("\"}");
        }
        json.append(']');

        service.chat(AUDIO, "audio/wav", "notes", json.toString());

        List<Map<String, Object>> messages = capturedMessages();
        // system + 20 retained history messages + current audio
        assertEquals(22, messages.size());
        assertEquals("turn-20", messages.get(1).get("content"));
        assertEquals("turn-39", messages.get(20).get("content"));
    }

    // --- OpenAI error handling ----------------------------------------------

    @Test
    void openAi401WrappedInVoiceException() {
        stubChatHttpError(HttpStatus.UNAUTHORIZED, "{\"error\":{\"message\":\"invalid key\"}}");
        VoiceException ex = assertThrows(VoiceException.class,
                () -> service.chat(AUDIO, "audio/wav", "notes"));
        assertTrue(ex.getMessage().contains("401"));
    }

    @Test
    void openAi429WrappedInVoiceException() {
        stubChatHttpError(HttpStatus.TOO_MANY_REQUESTS, "{\"error\":{\"message\":\"rate limit\"}}");
        VoiceException ex = assertThrows(VoiceException.class,
                () -> service.chat(AUDIO, "audio/wav", "notes"));
        assertTrue(ex.getMessage().contains("429") || ex.getMessage().contains("rate limit"));
    }

    // --- helpers ------------------------------------------------------------

    /** Pulls the "messages" array out of the JSON body sent to /chat/completions. */
    private List<Map<String, Object>> capturedMessages() {
        ArgumentCaptor<Object> captor = ArgumentCaptor.forClass(Object.class);
        verify(chatBodySpec).body(captor.capture());
        Map<String, Object> body = (Map<String, Object>) captor.getValue();
        return (List<Map<String, Object>>) body.get("messages");
    }

    private void stubChatHttpError(HttpStatus status, String body) {
        lenient().when(chatResponseSpec.body(String.class)).thenThrow(
                HttpClientErrorException.create(
                        status, status.getReasonPhrase(),
                        new HttpHeaders(), body.getBytes(StandardCharsets.UTF_8),
                        StandardCharsets.UTF_8));
    }
}
