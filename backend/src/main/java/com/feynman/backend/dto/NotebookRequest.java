package com.feynman.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record NotebookRequest(
        @NotBlank String title,
        String color
) {
}
