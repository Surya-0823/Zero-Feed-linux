import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../db/prisma';
import { AuthenticatedRequest, AuthUserPayload } from '../types';

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header. Expected Bearer token.',
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as AuthUserPayload;

    // Load user and current subscription state from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { subscription: true },
    });

    if (!user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User no longer exists or session is invalid.',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      googleId: user.googleId,
      name: user.name,
      avatarUrl: user.avatarUrl,
      subscription: user.subscription
        ? {
            status: user.subscription.status,
            plan: user.subscription.plan,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
          }
        : null,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired access token.',
    });
  }
};

export const requireActiveSubscription = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required before checking subscription access.',
    });
    return;
  }

  if (req.user.subscription?.status !== 'ACTIVE') {
    res.status(403).json({
      error: 'SubscriptionRequired',
      message: 'Active subscription required to access this resource.',
      currentStatus: req.user.subscription?.status || 'INACTIVE',
    });
    return;
  }

  next();
};
