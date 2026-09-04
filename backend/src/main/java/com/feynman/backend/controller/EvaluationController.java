package com.feynman.backend.controller;

import com.feynman.backend.dto.EvaluateRequest;
import com.feynman.backend.dto.EvaluationResponse;
import com.feynman.backend.security.UserPrincipal;
import com.feynman.backend.service.OpenAiEvaluationService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST entry point for notebook/page understanding evaluation.
 *
 * <p>{@code POST /api/evaluate} accepts the frontend's notebooks + pages and
 * returns an understanding score (0–100) per notebook and per page.</p>
 */
@RestController
@RequestMapping("/api")
public class EvaluationController {

    private final OpenAiEvaluationService evaluationService;

    public EvaluationController(OpenAiEvaluationService evaluationService) {
        this.evaluationService = evaluationService;
    }

    @PostMapping("/evaluate")
    public EvaluationResponse evaluate(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody EvaluateRequest request) {
        return evaluationService.evaluate(principal.getId(), request);
    }
}

