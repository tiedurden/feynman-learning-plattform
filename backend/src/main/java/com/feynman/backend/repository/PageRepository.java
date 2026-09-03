package com.feynman.backend.repository;

import com.feynman.backend.entity.Page;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PageRepository extends JpaRepository<Page, UUID> {

    List<Page> findByNotebookId(UUID notebookId);

    List<Page> findByParentId(UUID parentId);
}
