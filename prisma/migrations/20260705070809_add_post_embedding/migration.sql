CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "embedding" vector(1536);
