-- ==============================================================================
-- Migration: 005_create_payments_table
-- Description: Records financial transactions (Stripe / Razorpay).
-- Relationships:
--   - Belongs to User (userId -> users.id). Cascades on user deletion.
-- Indexes:
--   - PRIMARY KEY (id)
--   - COMPOSITE INDEX on (userId, status) for billing history lookups
--   - INDEX on providerOrderId for idempotent webhook processing
-- ==============================================================================

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "PaymentProvider" NOT NULL,
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Performance index: user payment history & pending reconciliation
CREATE INDEX "payments_userId_status_idx" ON "payments"("userId", "status");

-- Webhook reconciliation index
CREATE INDEX "payments_providerOrderId_idx" ON "payments"("providerOrderId");

-- Foreign key constraint with cascading deletion
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
