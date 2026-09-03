package com.feynman.backend.repository;

import com.feynman.backend.entity.TextReference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TextReferenceRepository extends JpaRepository<TextReference, UUID> {

    List<TextReference> findByTextBoxId(UUID textBoxId);
}
