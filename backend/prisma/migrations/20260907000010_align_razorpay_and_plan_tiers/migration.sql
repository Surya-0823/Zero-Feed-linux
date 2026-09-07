-- ==============================================================================
-- Migration: 20260907000010_align_razorpay_and_plan_tiers
-- Description: Aligns database enums and payments table with current Prisma schema:
--   1. Adds 'EXPIRED' to SubscriptionStatus enum
--   2. Adds 'YEARLY' and 'LIFETIME' to PlanTier enum
--   3. Adds 'MOCK_PROVIDER' to PaymentProvider enum
--   4. Adds 'receiptUrl' and 'metadata' columns to payments table
-- ==============================================================================

-- Step 1: Update SubscriptionStatus Enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Step 2: Update PlanTier Enum to support YEARLY and LIFETIME
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'YEARLY';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'LIFETIME';

-- Step 3: Update PaymentProvider Enum to support MOCK_PROVIDER
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'MOCK_PROVIDER';

-- Step 4: Add Missing Columns to payments Table
ALTER TABLE "payments" 
    ADD COLUMN IF NOT EXISTS "receiptUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Step 5: Create Index on Metadata (Optional Optimization for JSON Queries)
CREATE INDEX IF NOT EXISTS "payments_metadata_idx" ON "payments" USING GIN ("metadata");
