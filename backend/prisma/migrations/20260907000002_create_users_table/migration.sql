-- ==============================================================================
-- Migration: 002_create_users_table
-- Description: Creates the core 'users' table.
-- Relationships:
--   - Root entity for all user data (Google Authentication).
-- Indexes:
--   - PRIMARY KEY (id)
--   - UNIQUE INDEX on email (fast user lookup by email)
--   - UNIQUE INDEX on googleId (Google OAuth identity provider mapping)
-- ==============================================================================

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "googleId" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Fast lookup & unique constraints
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
