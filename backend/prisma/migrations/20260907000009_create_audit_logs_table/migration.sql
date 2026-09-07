-- ==============================================================================
-- Migration: 009_create_audit_logs_table
-- Description: Tamper-evident append-only audit ledger with SHA-256 hash chaining.
-- Relationships:
--   - Optional reference to User (userId -> users.id). Set NULL on user deletion.
-- Indexes:
--   - PRIMARY KEY (id)
--   - INDEX on userId for user audit trail queries
--   - INDEX on eventType for security anomaly detection
--   - INDEX on createdAt for chronological log retrieval
-- ==============================================================================

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "prevHash" TEXT,
    "signature" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Performance & analytical indexes
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_eventType_idx" ON "audit_logs"("eventType");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- Foreign key constraint with SET NULL preservation for audit records
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
