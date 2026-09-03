package com.feynman.backend.repository;

import com.feynman.backend.entity.Notebook;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotebookRepository extends JpaRepository<Notebook, UUID> {

    List<Notebook> findByUserId(UUID userId);
}
