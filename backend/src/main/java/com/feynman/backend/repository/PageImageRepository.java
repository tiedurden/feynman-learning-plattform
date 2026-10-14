package com.feynman.backend.repository;

import com.feynman.backend.entity.PageImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PageImageRepository extends JpaRepository<PageImage, UUID> {
}
