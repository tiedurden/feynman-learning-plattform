package com.feynman.backend.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "text_boxes")
public class TextBox {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "page_id", nullable = false)
    private Page page;

    @Column(nullable = false)
    private double x;

    @Column(nullable = false)
    private double y;

    /** Optional authored width in px (auto if null). */
    private Double width;

    @Column(columnDefinition = "TEXT")
    private String text;

    @OneToMany(mappedBy = "textBox", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TextReference> references = new ArrayList<>();

    protected TextBox() {
        // JPA
    }

    public TextBox(Page page, double x, double y, String text) {
        this.page = page;
        this.x = x;
        this.y = y;
        this.text = text;
    }

    public UUID getId() {
        return id;
    }

    public Page getPage() {
        return page;
    }

    public double getX() {
        return x;
    }

    public void setX(double x) {
        this.x = x;
    }

    public double getY() {
        return y;
    }

    public void setY(double y) {
        this.y = y;
    }

    public Double getWidth() {
        return width;
    }

    public void setWidth(Double width) {
        this.width = width;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public List<TextReference> getReferences() {
        return references;
    }
}
