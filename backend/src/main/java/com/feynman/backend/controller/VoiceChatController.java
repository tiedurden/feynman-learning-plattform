package com.feynman.backend.controller;

import com.feynman.backend.dto.VoiceChatResponse;
import com.feynman.backend.service.VoiceChatService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequestMapping("/api/voice")
public class VoiceChatController {

    private final VoiceChatService voiceChatService;

    public VoiceChatController(VoiceChatService voiceChatService) {
        this.voiceChatService = voiceChatService;
    }

    /**
     * {@code noteText} and {@code history} are bound with {@link RequestParam} on purpose:
     * browsers send plain {@code FormData} fields without a {@code Content-Type}, which Spring
     * treats as {@code application/octet-stream} and cannot convert to a String via
     * {@code @RequestPart}.
     *
     * @param history optional JSON array of prior turns ({@code [{"role":"user","text":"..."}]})
     *                so the tutor can follow up instead of restarting the conversation.
     */
    @PostMapping(value = "/chat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public VoiceChatResponse chat(
            @RequestPart("audio") MultipartFile audio,
            @RequestParam(value = "noteText", required = false, defaultValue = "") String noteText,
            @RequestParam(value = "history", required = false) String history)
            throws IOException {
        if (audio.isEmpty()) {
            throw new IllegalArgumentException("No audio was received. Please record again.");
        }
        return voiceChatService.chat(audio.getBytes(), audio.getContentType(), noteText, history);
    }
}
