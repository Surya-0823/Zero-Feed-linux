-- ==============================================================================
-- Migration: 007_create_extension_policies_table
-- Description: Stores Chrome extension focus rules and tamper-proof enforcement state.
-- Relationships:
--   - 1-to-1 with User (userId -> users.id). Cascades on user deletion.
-- Defaults:
--   - extensionId defaults to ZeroFeed extension: 'febihikohgfdplbpppapfgkfnpibelhk'
--   - blockedFeeds defaults to major social/video distraction feeds
-- ==============================================================================

CREATE TABLE "extension_policies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "extensionId" TEXT NOT NULL DEFAULT 'febihikohgfdplbpppapfgkfnpibelhk',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "blockedFeeds" TEXT[] DEFAULT ARRAY['YOUTUBE_HOMEPAGE', 'YOUTUBE_SHORTS', 'TWITTER_FEED', 'INSTAGRAM_EXPLORE', 'LINKEDIN_FEED']::TEXT[],
    "blockedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowlistDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strictMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "extension_policies_pkey" PRIMARY KEY ("id")
);

-- Unique index for 1:1 user policy mapping
CREATE UNIQUE INDEX "extension_policies_userId_key" ON "extension_policies"("userId");

-- Foreign key constraint with cascading deletion
ALTER TABLE "extension_policies" ADD CONSTRAINT "extension_policies_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
