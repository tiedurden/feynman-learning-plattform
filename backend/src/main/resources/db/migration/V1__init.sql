CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMP NOT NULL,
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE notebooks (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    color VARCHAR(32),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_notebooks_user_id ON notebooks (user_id);

CREATE TABLE pages (
    id UUID PRIMARY KEY,
    notebook_id UUID NOT NULL REFERENCES notebooks (id) ON DELETE CASCADE,
    parent_id UUID REFERENCES pages (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_pages_notebook_id ON pages (notebook_id);
CREATE INDEX idx_pages_parent_id ON pages (parent_id);

CREATE TABLE text_boxes (
    id UUID PRIMARY KEY,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    width INTEGER,
    text TEXT
);
CREATE INDEX idx_text_boxes_page_id ON text_boxes (page_id);

CREATE TABLE text_references (
    id UUID PRIMARY KEY,
    text_box_id UUID NOT NULL REFERENCES text_boxes (id) ON DELETE CASCADE,
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    target_page_id UUID REFERENCES pages (id) ON DELETE SET NULL
);
CREATE INDEX idx_text_references_text_box_id ON text_references (text_box_id);
CREATE INDEX idx_text_references_target_page_id ON text_references (target_page_id);
