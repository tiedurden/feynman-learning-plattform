package com.feynman.backend.service;

import com.feynman.backend.dto.NotebookRequest;
import com.feynman.backend.dto.NotebookResponse;
import com.feynman.backend.entity.Notebook;
import com.feynman.backend.entity.User;
import com.feynman.backend.exception.InvalidFileException;
import com.feynman.backend.exception.ResourceNotFoundException;
import com.feynman.backend.repository.NotebookRepository;
import com.feynman.backend.repository.UserRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class NotebookService {

    private static final Logger log = LoggerFactory.getLogger(NotebookService.class);

    /** Extracted PDF text is capped to bound OpenAI prompt size/cost. */
    private static final int MAX_PDF_TEXT_CHARS = 20_000;
    private static final long MAX_PDF_BYTES = 10L * 1024 * 1024;

    private final NotebookRepository notebookRepository;
    private final UserRepository userRepository;

    public NotebookService(NotebookRepository notebookRepository, UserRepository userRepository) {
        this.notebookRepository = notebookRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<NotebookResponse> list(UUID userId) {
        return notebookRepository.findByUserId(userId).stream().map(this::toResponse).toList();
    }

    public NotebookResponse create(UUID userId, NotebookRequest request) {
        User user = userRepository.getReferenceById(userId);
        Notebook notebook = new Notebook(user, request.title(), request.color());
        return toResponse(notebookRepository.save(notebook));
    }

    public NotebookResponse update(UUID userId, UUID notebookId, NotebookRequest request) {
        Notebook notebook = getOwned(userId, notebookId);
        notebook.setTitle(request.title());
        notebook.setColor(request.color());
        return toResponse(notebook);
    }

    public void delete(UUID userId, UUID notebookId) {
        Notebook notebook = getOwned(userId, notebookId);
        notebookRepository.delete(notebook);
    }

    /** Extracts text from the PDF and stores it alongside the raw bytes for this notebook. */
    public NotebookResponse uploadPdf(UUID userId, UUID notebookId, MultipartFile file) {
        Notebook notebook = getOwned(userId, notebookId);

        if (file == null || file.isEmpty()) {
            throw new InvalidFileException("No file was uploaded.");
        }
        if (file.getSize() > MAX_PDF_BYTES) {
            throw new InvalidFileException("PDF exceeds the 10MB limit.");
        }
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        boolean looksLikePdf = "application/pdf".equals(contentType)
                || (filename != null && filename.toLowerCase(Locale.ROOT).endsWith(".pdf"));
        if (!looksLikePdf) {
            throw new InvalidFileException("Only PDF files are supported.");
        }

        byte[] bytes;
        String text;
        try {
            bytes = file.getBytes();
            try (PDDocument document = Loader.loadPDF(bytes)) {
                text = new PDFTextStripper().getText(document).trim();
            }
        } catch (IOException e) {
            log.warn("Failed to read uploaded PDF for notebook {}", notebookId, e);
            throw new InvalidFileException("Could not read the PDF; it may be corrupted or password-protected.");
        }

        if (text.length() > MAX_PDF_TEXT_CHARS) {
            text = text.substring(0, MAX_PDF_TEXT_CHARS) + "\n[...truncated...]";
        }

        notebook.setPdfFilename(filename);
        notebook.setPdfContent(bytes);
        notebook.setPdfText(text);
        notebook.setPdfUploadedAt(Instant.now());
        return toResponse(notebook);
    }

    /** Removes any PDF previously uploaded for this notebook. */
    public NotebookResponse removePdf(UUID userId, UUID notebookId) {
        Notebook notebook = getOwned(userId, notebookId);
        notebook.clearPdf();
        return toResponse(notebook);
    }

    /** Fetches a notebook, scoped to its owner — 404s rather than 403s to avoid leaking existence to other users. */
    Notebook getOwned(UUID userId, UUID notebookId) {
        Notebook notebook = notebookRepository.findById(notebookId)
                .orElseThrow(() -> new ResourceNotFoundException("Notebook not found"));
        if (!notebook.getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Notebook not found");
        }
        return notebook;
    }

    private NotebookResponse toResponse(Notebook notebook) {
        return new NotebookResponse(
                notebook.getId().toString(),
                notebook.getTitle(),
                notebook.getColor(),
                notebook.hasPdf(),
                notebook.getPdfFilename());
    }
}
