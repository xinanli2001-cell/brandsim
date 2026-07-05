CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Post_searchText_trgm_idx" ON "Post" USING GIN ("searchText" gin_trgm_ops);
