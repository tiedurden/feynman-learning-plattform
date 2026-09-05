package com.feynman.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notebooks")
public class Notebook {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false)
    private String title;

    private String color;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "pdf_filename")
    private String pdfFilename;

    // VARBINARY forces Hibernate 6 to map this as bytea, not a Postgres large object (oid).
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "pdf_content")
    private byte[] pdfContent;

    // LONGVARCHAR forces Hibernate 6 to map this as text, not a Postgres large object (oid).
    @JdbcTypeCode(SqlTypes.LONGVARCHAR)
    @Column(name = "pdf_text")
    private String pdfText;

    @Column(name = "pdf_uploaded_at")
    private Instant pdfUploadedAt;

    protected Notebook() {
        // JPA
    }

    public Notebook(User user, String title, String color) {
        this.user = user;
        this.title = title;
        this.color = color;
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public String getPdfFilename() {
        return pdfFilename;
    }

    public void setPdfFilename(String pdfFilename) {
        this.pdfFilename = pdfFilename;
    }

    public byte[] getPdfContent() {
        return pdfContent;
    }

    public void setPdfContent(byte[] pdfContent) {
        this.pdfContent = pdfContent;
    }

    public String getPdfText() {
        return pdfText;
    }

    public void setPdfText(String pdfText) {
        this.pdfText = pdfText;
    }

    public Instant getPdfUploadedAt() {
        return pdfUploadedAt;
    }

    public void setPdfUploadedAt(Instant pdfUploadedAt) {
        this.pdfUploadedAt = pdfUploadedAt;
    }

    public boolean hasPdf() {
        return pdfContent != null;
    }

    /** Clears all uploaded-PDF state (used when removing or replacing the file). */
    public void clearPdf() {
        pdfFilename = null;
        pdfContent = null;
        pdfText = null;
        pdfUploadedAt = null;
    }
}
