CREATE TABLE page_images (
    id UUID PRIMARY KEY,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    content_type VARCHAR(64) NOT NULL,
    size BIGINT NOT NULL,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL
);
CREATE INDEX idx_page_images_page_id ON page_images (page_id);

CREATE TABLE page_image_data (
    image_id UUID PRIMARY KEY REFERENCES page_images (id) ON DELETE CASCADE,
    content BYTEA NOT NULL
);
