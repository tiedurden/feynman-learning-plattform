package com.feynman.backend.controller;

import com.feynman.backend.dto.NotebookRequest;
import com.feynman.backend.dto.NotebookResponse;
import com.feynman.backend.security.UserPrincipal;
import com.feynman.backend.service.NotebookService;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/notebooks")
public class NotebookController {

    private final NotebookService notebookService;

    public NotebookController(NotebookService notebookService) {
        this.notebookService = notebookService;
    }

    @GetMapping
    public List<NotebookResponse> list(@AuthenticationPrincipal UserPrincipal principal) {
        return notebookService.list(principal.getId());
    }

    @PostMapping
    public NotebookResponse create(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody NotebookRequest request) {
        return notebookService.create(principal.getId(), request);
    }

    @PutMapping("/{id}")
    public NotebookResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody NotebookRequest request) {
        return notebookService.update(principal.getId(), id, request);
    }

    @DeleteMapping("/{id}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        notebookService.delete(principal.getId(), id);
    }

    @PostMapping(value = "/{id}/pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public NotebookResponse uploadPdf(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @RequestPart("file") MultipartFile file) {
        return notebookService.uploadPdf(principal.getId(), id, file);
    }

    @DeleteMapping("/{id}/pdf")
    public NotebookResponse removePdf(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        return notebookService.removePdf(principal.getId(), id);
    }
}
