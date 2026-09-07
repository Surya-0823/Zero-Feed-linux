-- ==============================================================================
-- Migration: 003_create_refresh_tokens_table
-- Description: Stores 30-day cryptographically secure refresh tokens.
-- Relationships:
--   - Belongs to User (userId -> users.id). Cascades on user deletion.
-- Indexes:
--   - PRIMARY KEY (id)
--   - UNIQUE INDEX on token (exact token lookup on refresh)
--   - COMPOSITE INDEX on (userId, expiresAt) for fast expiration checks
-- ==============================================================================

CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- Unique index for token lookup
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- Composite index for user token validation & cleanup queries
CREATE INDEX "refresh_tokens_userId_expiresAt_idx" ON "refresh_tokens"("userId", "expiresAt");

-- Foreign key constraint with cascading deletion
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
