-- ==============================================================================
-- Migration: 008_create_policy_verification_requests_table
-- Description: Stores 6-digit OTP verification challenges for accountability partner sign-off.
-- Relationships:
--   - Belongs to User (userId -> users.id).
--   - Belongs to Partner (partnerId -> partners.id).
-- Indexes:
--   - PRIMARY KEY (id)
--   - COMPOSITE INDEX on (userId, status) for pending OTP validation
--   - COMPOSITE INDEX on (partnerId, status) for partner auditing
--   - INDEX on expiresAt for fast TTL expiration checks
-- ==============================================================================

CREATE TABLE "policy_verification_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "action" "PolicyAction" NOT NULL,
    "otpCode" TEXT NOT NULL,
    "status" "OtpStatus" NOT NULL DEFAULT 'PENDING',
    "targetState" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_verification_requests_pkey" PRIMARY KEY ("id")
);

-- Performance indexes for OTP verification lookups & expiration queries
CREATE INDEX "policy_verification_requests_userId_status_idx" ON "policy_verification_requests"("userId", "status");
CREATE INDEX "policy_verification_requests_partnerId_status_idx" ON "policy_verification_requests"("partnerId", "status");
CREATE INDEX "policy_verification_requests_expiresAt_idx" ON "policy_verification_requests"("expiresAt");

-- Foreign key constraints with cascading deletion
ALTER TABLE "policy_verification_requests" ADD CONSTRAINT "policy_verification_requests_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "policy_verification_requests" ADD CONSTRAINT "policy_verification_requests_partnerId_fkey" 
    FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
