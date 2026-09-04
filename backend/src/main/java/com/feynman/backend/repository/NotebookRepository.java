package com.feynman.backend.repository;

import com.feynman.backend.entity.Notebook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotebookRepository extends JpaRepository<Notebook, UUID> {

    List<Notebook> findByUserId(UUID userId);

    /** Ownership-scoped lookup — never returns another user's notebook. */
    Optional<Notebook> findByIdAndUserId(UUID id, UUID userId);
}
