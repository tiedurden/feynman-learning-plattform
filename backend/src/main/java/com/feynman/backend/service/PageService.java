package com.feynman.backend.service;

import com.feynman.backend.dto.PageRequest;
import com.feynman.backend.dto.PageResponse;
import com.feynman.backend.dto.TextBoxPayload;
import com.feynman.backend.dto.TextReferencePayload;
import com.feynman.backend.entity.Notebook;
import com.feynman.backend.entity.Page;
import com.feynman.backend.entity.TextBox;
import com.feynman.backend.entity.TextReference;
import com.feynman.backend.exception.ResourceNotFoundException;
import com.feynman.backend.repository.PageRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class PageService {

    private final PageRepository pageRepository;
    private final NotebookService notebookService;

    public PageService(PageRepository pageRepository, NotebookService notebookService) {
        this.pageRepository = pageRepository;
        this.notebookService = notebookService;
    }

    @Transactional(readOnly = true)
    public List<PageResponse> listForNotebook(UUID userId, UUID notebookId) {
        Notebook notebook = notebookService.getOwned(userId, notebookId);
        return pageRepository.findByNotebookId(notebook.getId()).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<PageResponse> listAllForUser(UUID userId) {
        return pageRepository.findAll().stream()
                .filter(p -> p.getNotebook().getUser().getId().equals(userId))
                .map(this::toResponse)
                .toList();
    }

    public PageResponse create(UUID userId, UUID notebookId, PageRequest request) {
        Notebook notebook = notebookService.getOwned(userId, notebookId);
        Page parent = resolveParent(notebook, request.parentId());
        int order = request.order() != null ? request.order() : pageRepository.findByNotebookId(notebook.getId()).size();

        Page page = new Page(notebook, parent, request.title(), order);
        page.setContent(request.content());
        applyBoxes(page, userId, request.boxes());
        return toResponse(pageRepository.save(page));
    }

    public PageResponse update(UUID userId, UUID pageId, PageRequest request) {
        Page page = getOwned(userId, pageId);
        Page newParent = resolveParent(page.getNotebook(), request.parentId());
        if (newParent != null) {
            assertNoCycle(page, newParent);
        }
        page.setParent(newParent);
        page.setTitle(request.title());
        page.setContent(request.content());
        if (request.order() != null) {
            page.setOrderIndex(request.order());
        }
        applyBoxes(page, userId, request.boxes());
        return toResponse(page);
    }

    public void delete(UUID userId, UUID pageId) {
        Page page = getOwned(userId, pageId);
        pageRepository.delete(page);
    }

    /** Fetches a page, scoped to its owning notebook's user — 404s rather than 403s to avoid leaking existence. */
    Page getOwned(UUID userId, UUID pageId) {
        Page page = pageRepository.findById(pageId)
                .orElseThrow(() -> new ResourceNotFoundException("Page not found"));
        if (!page.getNotebook().getUser().getId().equals(userId)) {
            throw new ResourceNotFoundException("Page not found");
        }
        return page;
    }

    private Page resolveParent(Notebook notebook, String parentId) {
        if (parentId == null || parentId.isBlank()) {
            return null;
        }
        Page parent = pageRepository.findById(UUID.fromString(parentId))
                .orElseThrow(() -> new ResourceNotFoundException("Parent page not found"));
        if (!parent.getNotebook().getId().equals(notebook.getId())) {
            throw new ResourceNotFoundException("Parent page not found");
        }
        return parent;
    }

    private void assertNoCycle(Page page, Page candidateParent) {
        for (Page current = candidateParent; current != null; current = current.getParent()) {
            if (current.getId().equals(page.getId())) {
                throw new IllegalArgumentException("A page cannot be moved under itself or one of its own subpages");
            }
        }
    }

    private void applyBoxes(Page page, UUID userId, List<TextBoxPayload> boxPayloads) {
        if (boxPayloads == null) {
            boxPayloads = List.of();
        }
        var incomingIds = boxPayloads.stream()
                .map(TextBoxPayload::id)
                .filter(id -> id != null && !id.isBlank())
                .map(UUID::fromString)
                .collect(java.util.stream.Collectors.toSet());
        page.getBoxes().removeIf(box -> !incomingIds.contains(box.getId()));
        var existingMap = page.getBoxes().stream()
                .collect(java.util.stream.Collectors.toMap(TextBox::getId, b -> b));
        for (TextBoxPayload boxPayload : boxPayloads) {
            TextBox box;
            if (boxPayload.id() != null && !boxPayload.id().isBlank()) {
                UUID boxId = UUID.fromString(boxPayload.id());
                box = existingMap.getOrDefault(boxId, new TextBox(page, boxPayload.x(), boxPayload.y(), boxPayload.text()));
                box.setX(boxPayload.x());
                box.setY(boxPayload.y());
                box.setText(boxPayload.text());
            } else {
                box = new TextBox(page, boxPayload.x(), boxPayload.y(), boxPayload.text());
            }
            box.setWidth(boxPayload.width());
            applyReferences(box, userId, TextReferencePayload.emptyIfNull(boxPayload.references()));
            if (!page.getBoxes().contains(box)) {
                page.getBoxes().add(box);
            }
        }
    }

    private void applyReferences(TextBox box, UUID userId, List<TextReferencePayload> refPayloads) {
        var incomingIds = refPayloads.stream()
                .map(TextReferencePayload::id)
                .filter(id -> id != null && !id.isBlank())
                .map(UUID::fromString)
                .collect(java.util.stream.Collectors.toSet());
        box.getReferences().removeIf(ref -> !incomingIds.contains(ref.getId()));
        var existingMap = box.getReferences().stream()
                .collect(java.util.stream.Collectors.toMap(TextReference::getId, r -> r));
        for (TextReferencePayload refPayload : refPayloads) {
            Page targetPage = getOwned(userId, UUID.fromString(refPayload.targetPageId()));
            TextReference ref;
            if (refPayload.id() != null && !refPayload.id().isBlank()) {
                UUID refId = UUID.fromString(refPayload.id());
                ref = existingMap.getOrDefault(refId, new TextReference(box, refPayload.start(), refPayload.end(), targetPage));
                ref.setStartOffset(refPayload.start());
                ref.setEndOffset(refPayload.end());
                ref.setTargetPage(targetPage);
            } else {
                ref = new TextReference(box, refPayload.start(), refPayload.end(), targetPage);
            }
            if (!box.getReferences().contains(ref)) {
                box.getReferences().add(ref);
            }
        }
    }

    private PageResponse toResponse(Page page) {
        List<TextBoxPayload> boxes = new ArrayList<>();
        for (TextBox box : page.getBoxes()) {
            List<TextReferencePayload> refs = box.getReferences().stream()
                    .map(r -> new TextReferencePayload(
                            r.getId().toString(), r.getStartOffset(), r.getEndOffset(), r.getTargetPage().getId().toString()))
                    .toList();
            boxes.add(new TextBoxPayload(box.getId().toString(), box.getX(), box.getY(), box.getWidth(), box.getText(), refs));
        }
        return new PageResponse(
                page.getId().toString(),
                page.getNotebook().getId().toString(),
                page.getParent() != null ? page.getParent().getId().toString() : null,
                page.getTitle(),
                page.getContent(),
                page.getOrderIndex(),
                boxes);
    }
}
