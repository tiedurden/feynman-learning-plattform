package com.feynman.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Entry point for the Feynman learning-platform backend.
 *
 * <p>The backend evaluates a user's notebooks/pages and scores how well the
 * topic appears to be understood, following the Feynman technique (if you can
 * explain it simply, you understand it). Scores replace the front-end's
 * hard-coded {@code progress.ts} placeholder values.</p>
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class FeynmanBackendApplication {

    public static void main(String[] args) {
        SpringApplication.run(FeynmanBackendApplication.class, args);
    }
}

