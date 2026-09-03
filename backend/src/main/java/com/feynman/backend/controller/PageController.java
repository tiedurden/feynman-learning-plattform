package com.feynman.backend.controller;

import com.feynman.backend.dto.PageRequest;
import com.feynman.backend.dto.PageResponse;
import com.feynman.backend.security.UserPrincipal;
import com.feynman.backend.service.PageService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PageController {

    private final PageService pageService;

    public PageController(PageService pageService) {
        this.pageService = pageService;
    }

    @GetMapping("/pages")
    public List<PageResponse> listAll(@AuthenticationPrincipal UserPrincipal principal) {
        return pageService.listAllForUser(principal.getId());
    }

    @GetMapping("/notebooks/{notebookId}/pages")
    public List<PageResponse> list(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID notebookId) {
        return pageService.listForNotebook(principal.getId(), notebookId);
    }

    @PostMapping("/notebooks/{notebookId}/pages")
    public PageResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID notebookId,
            @Valid @RequestBody PageRequest request) {
        return pageService.create(principal.getId(), notebookId, request);
    }

    @PutMapping("/pages/{id}")
    public PageResponse update(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody PageRequest request) {
        return pageService.update(principal.getId(), id, request);
    }

    @DeleteMapping("/pages/{id}")
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable UUID id) {
        pageService.delete(principal.getId(), id);
    }
}
