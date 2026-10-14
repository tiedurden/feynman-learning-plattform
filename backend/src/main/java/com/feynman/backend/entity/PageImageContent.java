package com.feynman.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "page_image_data")
public class PageImageContent {

    @Id
    @Column(name = "image_id")
    private UUID imageId;

    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(nullable = false)
    private byte[] content;

    protected PageImageContent() {
        // JPA
    }

    public PageImageContent(UUID imageId, byte[] content) {
        this.imageId = imageId;
        this.content = content;
    }
}
