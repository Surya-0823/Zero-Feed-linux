import { Request } from 'express';
import { SubscriptionStatus, PlanTier } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string;
  googleId: string;
}

export interface AuthenticatedUser extends AuthUserPayload {
  name?: string | null;
  avatarUrl?: string | null;
  subscription?: {
    status: SubscriptionStatus;
    plan: PlanTier;
    currentPeriodEnd: Date | null;
  } | null;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export interface GoogleProfile {
  googleId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}
