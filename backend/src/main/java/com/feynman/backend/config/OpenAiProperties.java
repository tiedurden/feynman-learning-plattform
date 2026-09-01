package com.feynman.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Strongly-typed binding for the {@code openai.*} configuration block.
 *
 * @param apiKey  OpenAI API key; required when mock scoring is disabled.
 * @param model   Chat model name (e.g. {@code gpt-5.5}).
 * @param baseUrl Base URL of the OpenAI-compatible API.
 * @param mock    Force deterministic mock scoring.
 */
@ConfigurationProperties(prefix = "openai")
public record OpenAiProperties(
        String apiKey,
        String model,
        String audioModel,
        String baseUrl,
        boolean mock
) {
    /** True only when deterministic mock scoring was explicitly enabled. */
    public boolean useMock() {
        return mock;
    }

    /** Whether an API key is available for real evaluation. */
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }
}


