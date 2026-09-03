package com.feynman.backend.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        String email,
        String displayName
) {
}
