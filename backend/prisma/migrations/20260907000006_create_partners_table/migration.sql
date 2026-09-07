-- ==============================================================================
-- Migration: 006_create_partners_table
-- Description: Stores accountability partner details for student focus commitments.
-- Relationships:
--   - 1-to-1 with User (userId -> users.id). Cascades on user deletion.
-- Indexes:
--   - PRIMARY KEY (id)
--   - UNIQUE INDEX on userId (one locked partner per user)
--   - INDEX on status for active partner verification queries
-- ==============================================================================

CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "PartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- Unique index for 1:1 user partner lock
CREATE UNIQUE INDEX "partners_userId_key" ON "partners"("userId");

-- Status index for active partner filtering
CREATE INDEX "partners_status_idx" ON "partners"("status");

-- Foreign key constraint with cascading deletion
ALTER TABLE "partners" ADD CONSTRAINT "partners_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
