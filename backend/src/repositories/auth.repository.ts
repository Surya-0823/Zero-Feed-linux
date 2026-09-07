import { prisma } from '../db/prisma';
import { User, RefreshToken, SubscriptionStatus, PlanTier } from '@prisma/client';

export class AuthRepository {
  async findUserByGoogleId(googleId: string): Promise<(User & { subscription: { status: SubscriptionStatus; plan: PlanTier } | null }) | null> {
    return prisma.user.findUnique({
      where: { googleId },
      include: {
        subscription: {
          select: { status: true, plan: true },
        },
      },
    });
  }

  async findUserByEmail(email: string): Promise<(User & { subscription: { status: SubscriptionStatus; plan: PlanTier } | null }) | null> {
    return prisma.user.findUnique({
      where: { email },
      include: {
        subscription: {
          select: { status: true, plan: true },
        },
      },
    });
  }

  async findUserById(id: string): Promise<(User & { subscription: { status: SubscriptionStatus; plan: PlanTier } | null }) | null> {
    return prisma.user.findUnique({
      where: { id },
      include: {
        subscription: {
          select: { status: true, plan: true },
        },
      },
    });
  }

  async createUserWithDefaultSubscription(data: {
    email: string;
    googleId: string;
    name?: string;
    avatarUrl?: string;
  }): Promise<User & { subscription: { status: SubscriptionStatus; plan: PlanTier } | null }> {
    return prisma.user.create({
      data: {
        email: data.email,
        googleId: data.googleId,
        name: data.name,
        avatarUrl: data.avatarUrl,
        subscription: {
          create: {
            status: SubscriptionStatus.INACTIVE,
            plan: PlanTier.FREE,
          },
        },
      },
      include: {
        subscription: {
          select: { status: true, plan: true },
        },
      },
    });
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<RefreshToken> {
    return prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });
  }

  async findRefreshToken(token: string): Promise<(RefreshToken & { user: User }) | null> {
    return prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { token },
    });
  }

  async deleteRefreshTokensForUser(userId: string): Promise<void> {
    await prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }
}

export const authRepository = new AuthRepository();
