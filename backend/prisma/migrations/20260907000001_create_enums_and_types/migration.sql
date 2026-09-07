-- ==============================================================================
-- Migration: 001_create_enums_and_types
-- Description: Creates PostgreSQL ENUM types for application domains:
--   - SubscriptionStatus: Lifecycle of paid/free accounts
--   - PlanTier: Subscription levels (FREE, PRO, ENTERPRISE)
--   - PaymentStatus: Transaction processing states
--   - PaymentProvider: External gateway providers (STRIPE, RAZORPAY)
--   - PartnerStatus: Accountability partner state
--   - PolicyAction: Protected operations requiring partner verification OTP
--   - OtpStatus: Verification code lifecycle
-- ==============================================================================

-- CreateEnum: SubscriptionStatus
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIAL', 'CANCELLED', 'PAST_DUE');

-- CreateEnum: PlanTier
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'ENTERPRISE');

-- CreateEnum: PaymentStatus
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum: PaymentProvider
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'RAZORPAY');

-- CreateEnum: PartnerStatus
CREATE TYPE "PartnerStatus" AS ENUM ('ACTIVE', 'PENDING_REPLACEMENT', 'REVOKED');

-- CreateEnum: PolicyAction
CREATE TYPE "PolicyAction" AS ENUM ('DISABLE_POLICY', 'ENABLE_POLICY', 'UPDATE_RULES', 'UPDATE_EXTENSION_ID', 'CHANGE_PARTNER');

-- CreateEnum: OtpStatus
CREATE TYPE "OtpStatus" AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'FAILED');
