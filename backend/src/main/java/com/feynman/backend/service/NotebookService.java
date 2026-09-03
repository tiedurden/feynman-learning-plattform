package com.feynman.backend.service;

import com.feynman.backend.dto.NotebookRequest;
import com.feynman.backend.dto.NotebookResponse;
import com.feynman.backend.entity.Notebook;
import com.feynman.backend.entity.User;
import com.feynman.backend.exception.ResourceNotFoundException;
import com.feynman.backend.repository.NotebookRepository;
import com.feynman.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class NotebookService {

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
        return new NotebookResponse(notebook.getId().toString(), notebook.getTitle(), notebook.getColor());
    }
}
