ALTER TABLE notebooks ADD COLUMN pdf_filename VARCHAR(255);
ALTER TABLE notebooks ADD COLUMN pdf_content BYTEA;
ALTER TABLE notebooks ADD COLUMN pdf_text TEXT;
ALTER TABLE notebooks ADD COLUMN pdf_uploaded_at TIMESTAMP;
