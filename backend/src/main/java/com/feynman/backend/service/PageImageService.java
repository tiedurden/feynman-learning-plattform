package com.feynman.backend.service;

import com.feynman.backend.dto.PageImageResponse;
import com.feynman.backend.entity.Page;
import com.feynman.backend.entity.PageImage;
import com.feynman.backend.entity.PageImageContent;
import com.feynman.backend.exception.InvalidFileException;
import com.feynman.backend.exception.ResourceNotFoundException;
import com.feynman.backend.repository.PageImageContentRepository;
import com.feynman.backend.repository.PageImageRepository;
import com.feynman.backend.repository.PageRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

@Service
@Transactional
public class PageImageService {

    private static final Logger log = LoggerFactory.getLogger(PageImageService.class);
    private static final long MAX_IMAGE_BYTES = 10L * 1024 * 1024;

    private final PageService pageService;
    private final PageImageRepository imageRepository;
    private final PageImageContentRepository contentRepository;

    public PageImageService(
            PageService pageService,
            PageImageRepository imageRepository,
            PageImageContentRepository contentRepository) {
        this.pageService = pageService;
        this.imageRepository = imageRepository;
        this.contentRepository = contentRepository;
    }

    public PageImageResponse upload(UUID userId, UUID pageId, MultipartFile file, double x, double y) {
        Page page = pageService.getOwned(userId, pageId);
        if (!Double.isFinite(x) || !Double.isFinite(y) || x < 0 || y < 0) {
            throw new InvalidFileException("Image position must be a non-negative finite value.");
        }
        if (file == null || file.isEmpty()) {
            throw new InvalidFileException("No image was uploaded.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new InvalidFileException("Image exceeds the 10MB limit.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            log.warn("Failed to read uploaded image for page {}", pageId, e);
            throw new InvalidFileException("Could not read the uploaded image.");
        }

        String contentType = detectedContentType(bytes);
        if (contentType == null || !contentType.equals(file.getContentType())) {
            throw new InvalidFileException("Only valid PNG, JPEG, and WebP images are supported.");
        }

        String fileName = safeFileName(file.getOriginalFilename());
        PageImage image = imageRepository.saveAndFlush(new PageImage(
                page, fileName, contentType, bytes.length, x, y));
        contentRepository.save(new PageImageContent(image.getId(), bytes));
        return toResponse(image);
    }

    @Transactional(readOnly = true)
    public ImageDownload get(UUID userId, UUID imageId) {
        PageImage image = imageRepository.findById(imageId)
                .filter(candidate -> candidate.getPage().getNotebook().getUser().getId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException("Image not found"));
        byte[] content = contentRepository.findContentByImageId(imageId)
                .orElseThrow(() -> new ResourceNotFoundException("Image not found"));
        return new ImageDownload(image.getContentType(), image.getFileName(), content);
    }

    private String detectedContentType(byte[] bytes) {
        if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
            return "image/png";
        }
        if (startsWith(bytes, 0xff, 0xd8, 0xff)) {
            return "image/jpeg";
        }
        if (bytes.length >= 12
                && startsWith(bytes, 0x52, 0x49, 0x46, 0x46)
                && startsWithAt(bytes, 8, 0x57, 0x45, 0x42, 0x50)) {
            return "image/webp";
        }
        return null;
    }

    private boolean startsWith(byte[] bytes, int... prefix) {
        return startsWithAt(bytes, 0, prefix);
    }

    private boolean startsWithAt(byte[] bytes, int offset, int... prefix) {
        if (bytes.length < offset + prefix.length) {
            return false;
        }
        for (int i = 0; i < prefix.length; i++) {
            if ((bytes[offset + i] & 0xff) != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private String safeFileName(String originalName) {
        if (originalName == null || originalName.isBlank()) {
            return "image";
        }
        String normalized = originalName.replace('\\', '/');
        String name = normalized.substring(normalized.lastIndexOf('/') + 1).trim();
        if (name.isEmpty()) {
            return "image";
        }
        return name.substring(0, Math.min(name.length(), 255));
    }

    private PageImageResponse toResponse(PageImage image) {
        return new PageImageResponse(
                image.getId().toString(),
                image.getFileName(),
                image.getContentType(),
                image.getSize(),
                image.getX(),
                image.getY());
    }

    public record ImageDownload(String contentType, String fileName, byte[] content) {
    }
}
