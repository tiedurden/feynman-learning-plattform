package com.feynman.backend.repository;

import com.feynman.backend.entity.TextBox;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TextBoxRepository extends JpaRepository<TextBox, UUID> {

    List<TextBox> findByPageId(UUID pageId);
}
