package com.feynman.backend.repository;

import com.feynman.backend.entity.PageImageContent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface PageImageContentRepository extends JpaRepository<PageImageContent, UUID> {

    @Query(value = "SELECT content FROM page_image_data WHERE image_id = :imageId", nativeQuery = true)
    Optional<byte[]> findContentByImageId(@Param("imageId") UUID imageId);
}
