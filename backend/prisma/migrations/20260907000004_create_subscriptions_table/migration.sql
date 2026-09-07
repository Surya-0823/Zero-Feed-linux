-- ==============================================================================
-- Migration: 004_create_subscriptions_table
-- Description: Authoritative source of truth for user plan & product access.
-- Relationships:
--   - 1-to-1 with User (userId -> users.id). Cascades on user deletion.
-- Indexes:
--   - PRIMARY KEY (id)
--   - UNIQUE INDEX on userId (one subscription record per user)
--   - COMPOSITE INDEX on (userId, status) for zero-latency access authorization
-- ==============================================================================

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
    "provider" "PaymentProvider",
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- Unique index for 1:1 user subscription mapping
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- Performance index: fast authorization queries (SubscriptionService.isAccessAllowed)
CREATE INDEX "subscriptions_userId_status_idx" ON "subscriptions"("userId", "status");

-- Foreign key constraint with cascading deletion
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
