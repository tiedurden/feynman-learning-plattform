package com.feynman.backend.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Strongly-typed binding for the {@code jwt.*} configuration block.
 *
 * @param secret                  HMAC signing secret; must be overridden via JWT_SECRET outside local dev.
 * @param accessTokenTtlMinutes   How long an access token stays valid.
 * @param refreshTokenTtlDays     How long a refresh token stays valid.
 */
@ConfigurationProperties(prefix = "jwt")
public record JwtProperties(
        String secret,
        long accessTokenTtlMinutes,
        long refreshTokenTtlDays
) {
}
