package com.feynman.backend.controller;

import com.feynman.backend.dto.VoiceChatResponse;
import com.feynman.backend.service.VoiceChatService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @PostMapping(value = "/chat", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public VoiceChatResponse chat(
            @RequestPart("audio") MultipartFile audio,
            @RequestPart("noteText") String noteText) throws IOException {
        return voiceChatService.chat(audio.getBytes(), audio.getContentType(), noteText);
    }
}
