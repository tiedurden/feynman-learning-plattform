package com.feynman.backend.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.net.http.HttpClient;
import java.security.KeyStore;
import java.time.Duration;

/**
 * Builds the {@link RestClient} used to talk to the OpenAI chat completions
 * API. Kept in its own config so it can be mocked in tests.
 *
 * <p>On corporate networks an intercepting proxy often re-signs TLS with a
 * private root CA that the JDK's own {@code cacerts} does not trust (causing
 * "PKIX path building failed"). Windows already trusts that CA, so we point the
 * HTTP client at the {@code Windows-ROOT} certificate store. This is enabled
 * automatically on Windows and can be overridden via
 * {@code openai.trust-store-type} (empty = JDK default).</p>
 */
@Configuration
public class OpenAiClientConfig {

    private static final Logger log = LoggerFactory.getLogger(OpenAiClientConfig.class);

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration READ_TIMEOUT = Duration.ofSeconds(60);

    @Bean
    public RestClient openAiRestClient(
            OpenAiProperties properties,
            @Value("${openai.trust-store-type:}") String trustStoreType) {

        RestClient.Builder builder = RestClient.builder()
                .baseUrl(properties.baseUrl());
        if (properties.apiKey() != null && !properties.apiKey().isBlank()) {
            builder.defaultHeader("Authorization", "Bearer " + properties.apiKey());
        }

        // Resolve which OS truststore to use. Default to Windows-ROOT on Windows
        // so corporate TLS interception certificates are trusted transparently.
        String type = trustStoreType;
        if ((type == null || type.isBlank())
                && System.getProperty("os.name", "").toLowerCase().contains("win")) {
            type = "Windows-ROOT";
        }

        SSLContext sslContext = null;
        if (type != null && !type.isBlank()) {
            try {
                KeyStore keyStore = KeyStore.getInstance(type);
                keyStore.load(null, null); // OS-backed store loads itself
                TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                        TrustManagerFactory.getDefaultAlgorithm());
                tmf.init(keyStore);
                sslContext = SSLContext.getInstance("TLS");
                sslContext.init(null, tmf.getTrustManagers(), null);
                log.info("OpenAI HTTP client trusting certificates from '{}' store.", type);
            } catch (Exception e) {
                log.warn("Could not initialise trust store '{}'; falling back to JDK default "
                        + "cacerts. TLS to api.openai.com may fail behind a proxy. Cause: {}",
                        type, e.getMessage());
            }
        }

        // Explicit timeouts: without them a stalled OpenAI call blocks the request thread
        // indefinitely, which surfaces to the user as a request that "never returns".
        HttpClient.Builder httpClientBuilder = HttpClient.newBuilder()
                .connectTimeout(CONNECT_TIMEOUT);
        if (sslContext != null) {
            httpClientBuilder.sslContext(sslContext);
        }
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(httpClientBuilder.build());
        requestFactory.setReadTimeout(READ_TIMEOUT);
        builder.requestFactory(requestFactory);

        return builder.build();
    }
}


