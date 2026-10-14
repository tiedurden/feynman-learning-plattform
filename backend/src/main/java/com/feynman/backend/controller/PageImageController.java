package com.feynman.backend.controller;

import com.feynman.backend.dto.PageImageResponse;
import com.feynman.backend.security.UserPrincipal;
import com.feynman.backend.service.PageImageService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class PageImageController {

    private final PageImageService pageImageService;

    public PageImageController(PageImageService pageImageService) {
        this.pageImageService = pageImageService;
    }

    @PostMapping(value = "/pages/{pageId}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PageImageResponse upload(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID pageId,
            @RequestPart("file") MultipartFile file,
            @RequestParam double x,
            @RequestParam double y) {
        return pageImageService.upload(principal.getId(), pageId, file, x, y);
    }

    @GetMapping("/images/{imageId}")
    public ResponseEntity<byte[]> get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable UUID imageId) {
        PageImageService.ImageDownload image = pageImageService.get(principal.getId(), imageId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename(image.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(image.content());
    }
}
