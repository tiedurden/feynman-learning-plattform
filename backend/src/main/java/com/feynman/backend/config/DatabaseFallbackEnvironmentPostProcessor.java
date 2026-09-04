package com.feynman.backend.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Makes PostgreSQL (and therefore Docker) optional for local development.
 *
 * <p>Before the context starts, this probes the configured PostgreSQL host/port.
 * If nothing is listening, the datasource is transparently switched to an
 * in-memory H2 database (Flyway off, schema generated from the JPA entities) so
 * the application still boots instead of failing with
 * {@code Connection to localhost:5432 refused}.</p>
 *
 * <p>The fallback is deliberately conservative and never applies when:</p>
 * <ul>
 *   <li>{@code app.datasource.fallback-to-h2} is {@code false},</li>
 *   <li>a non-PostgreSQL JDBC URL is configured (e.g. the {@code h2} profile
 *       already selected H2), or</li>
 *   <li>the {@code prod} profile is active — production must fail loudly rather
 *       than silently run on a throwaway database.</li>
 * </ul>
 */
public class DatabaseFallbackEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "feynmanH2Fallback";
    private static final String URL_PROPERTY = "spring.datasource.url";
    private static final int PROBE_TIMEOUT_MS = 1000;

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        if (!environment.getProperty("app.datasource.fallback-to-h2", Boolean.class, Boolean.TRUE)) {
            return;
        }
        if (environment.matchesProfiles("prod")) {
            return;
        }

        String url = environment.getProperty(URL_PROPERTY);
        if (url == null || !url.startsWith("jdbc:postgresql://")) {
            return; // Not PostgreSQL (or already H2) — nothing to fall back from.
        }
        if (isReachable(url)) {
            return;
        }

        // System.out is used on purpose: logging is not initialised this early.
        System.out.println("""

                ============================================================
                 PostgreSQL is not reachable at %s
                 Falling back to an IN-MEMORY H2 database so the app can start.
                 Data will NOT be persisted between restarts.

                 For a real database run 'docker compose up -d' (or install
                 PostgreSQL). To disable this fallback and fail fast instead,
                 set app.datasource.fallback-to-h2=false.
                ============================================================
                """.formatted(url));

        Map<String, Object> overrides = new LinkedHashMap<>();
        overrides.put(URL_PROPERTY,
                "jdbc:h2:mem:feynman;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1");
        overrides.put("spring.datasource.username", "sa");
        overrides.put("spring.datasource.password", "");
        overrides.put("spring.datasource.driver-class-name", "org.h2.Driver");
        // The Flyway migrations are PostgreSQL-specific, so let Hibernate build
        // the schema from the entities instead.
        overrides.put("spring.flyway.enabled", "false");
        overrides.put("spring.jpa.hibernate.ddl-auto", "update");
        overrides.put("spring.jpa.database-platform", "org.hibernate.dialect.H2Dialect");

        environment.getPropertySources()
                .addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, overrides));
    }

    /**
     * Plain TCP probe — cheap, and avoids loading the JDBC driver or waiting for
     * Hikari's much longer connection timeout just to discover the DB is down.
     */
    private static boolean isReachable(String jdbcUrl) {
        try {
            // "jdbc:postgresql://host:port/db" -> parse the part after "jdbc:".
            URI uri = URI.create(jdbcUrl.substring("jdbc:".length()));
            String host = uri.getHost() == null ? "localhost" : uri.getHost();
            int port = uri.getPort() == -1 ? 5432 : uri.getPort();
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), PROBE_TIMEOUT_MS);
                return true;
            }
        } catch (Exception e) {
            return false;
        }
    }
}

