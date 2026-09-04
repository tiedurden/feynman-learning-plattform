package com.feynman.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

/** Points a character range of a {@link TextBox}'s text at another page. */
@Entity
@Table(name = "text_references")
public class TextReference {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "text_box_id", nullable = false)
    private TextBox textBox;

    @Column(name = "start_offset", nullable = false)
    private int startOffset;

    @Column(name = "end_offset", nullable = false)
    private int endOffset;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_page_id")
    private Page targetPage;

    protected TextReference() {
        // JPA
    }

    public TextReference(TextBox textBox, int startOffset, int endOffset, Page targetPage) {
        this.textBox = textBox;
        this.startOffset = startOffset;
        this.endOffset = endOffset;
        this.targetPage = targetPage;
    }

    public UUID getId() {
        return id;
    }

    public TextBox getTextBox() {
        return textBox;
    }

    public int getStartOffset() {
        return startOffset;
    }

    public void setStartOffset(int startOffset) {
        this.startOffset = startOffset;
    }

    public int getEndOffset() {
        return endOffset;
    }

    public void setEndOffset(int endOffset) {
        this.endOffset = endOffset;
    }

    public Page getTargetPage() {
        return targetPage;
    }

    public void setTargetPage(Page targetPage) {
        this.targetPage = targetPage;
    }
}
