package com.feynman.backend.dto;

/**
 * @param audioData base64-encoded WAV returned by OpenAI audio output
 */
public record VoiceChatResponse(String transcript, String audioData) {}
