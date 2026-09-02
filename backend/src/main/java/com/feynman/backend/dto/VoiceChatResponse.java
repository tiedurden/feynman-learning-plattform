package com.feynman.backend.dto;

/**
 * @param userTranscript transcript of what the learner said, from a separate Whisper-style call
 * @param transcript tutor's spoken reply transcript
 * @param audioData base64-encoded WAV returned by OpenAI audio output
 */
public record VoiceChatResponse(String userTranscript, String transcript, String audioData) {}
