import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from './auth.service';
import { SubscriptionService } from './subscription.service';
import { AuthRepository } from '../repositories/auth.repository';
import { SubscriptionRepository } from '../repositories/subscription.repository';
import { SubscriptionStatus, PlanTier } from '@prisma/client';

describe('AuthService (Google-Only Auth)', () => {
  it('should authenticate a new user with dev-mock token and provision default inactive subscription', async () => {
    const mockUsers: any[] = [];
    const mockRefreshTokens: any[] = [];

    const mockRepo: Partial<AuthRepository> = {
      findUserByGoogleId: async () => null,
      findUserByEmail: async () => null,
      createUserWithDefaultSubscription: async (data) => {
        const newUser = {
          id: 'user-123',
          email: data.email,
          googleId: data.googleId,
          name: data.name || null,
          avatarUrl: data.avatarUrl || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          subscription: {
            status: SubscriptionStatus.INACTIVE,
            plan: PlanTier.FREE,
          },
        };
        mockUsers.push(newUser);
        return newUser;
      },
      saveRefreshToken: async (userId, token, expiresAt) => {
        const record = { id: 'rt-1', userId, token, expiresAt, createdAt: new Date() };
        mockRefreshTokens.push(record);
        return record;
      },
    };

    const authService = new AuthService(mockRepo as AuthRepository);
    const result = await authService.authenticateWithGoogle('dev-mock-popeye@example.com');

    assert.equal(result.isNewUser, true, 'Should flag isNewUser as true for first sign-in');
    assert.equal(result.user.email, 'popeye@example.com');
    assert.equal(result.subscription?.status, SubscriptionStatus.INACTIVE, 'Should have INACTIVE subscription initially');
    assert.ok(result.tokens.accessToken, 'Access token should be issued');
    assert.ok(result.tokens.refreshToken, 'Refresh token should be issued');
    assert.equal(mockUsers.length, 1);
  });

  it('should authenticate existing user and mark isNewUser as false', async () => {
    const existingUser = {
      id: 'existing-user-999',
      email: 'popeye@example.com',
      googleId: 'mock-google-id-existing',
      name: 'Existing Popeye',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        plan: PlanTier.PRO,
      },
    };

    const mockRepo: Partial<AuthRepository> = {
      findUserByGoogleId: async () => existingUser,
      saveRefreshToken: async (userId, token, expiresAt) => ({
        id: 'rt-2',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
      }),
    };

    const authService = new AuthService(mockRepo as AuthRepository);
    const result = await authService.authenticateWithGoogle('dev-mock-popeye@example.com');

    assert.equal(result.isNewUser, false, 'Should flag isNewUser as false for returning user');
    assert.equal(result.user.id, 'existing-user-999');
    assert.equal(result.subscription?.status, SubscriptionStatus.ACTIVE);
    assert.ok(result.tokens.accessToken);
  });
});

describe('SubscriptionService (Backend Authority)', () => {
  it('should return isAccessAllowed = false when subscription status is INACTIVE', async () => {
    const mockRepo: Partial<SubscriptionRepository> = {
      findByUserId: async () => ({
        id: 'sub-1',
        userId: 'user-123',
        status: SubscriptionStatus.INACTIVE,
        plan: PlanTier.FREE,
        provider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const subService = new SubscriptionService(mockRepo as SubscriptionRepository);
    const result = await subService.getSubscriptionStatus('user-123');

    assert.equal(result.status, SubscriptionStatus.INACTIVE);
    assert.equal(result.isAccessAllowed, false, 'Inactive subscription must not be allowed access');
  });

  it('should return isAccessAllowed = true when subscription status is ACTIVE', async () => {
    const mockRepo: Partial<SubscriptionRepository> = {
      findByUserId: async () => ({
        id: 'sub-2',
        userId: 'user-123',
        status: SubscriptionStatus.ACTIVE,
        plan: PlanTier.PRO,
        provider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    };

    const subService = new SubscriptionService(mockRepo as SubscriptionRepository);
    const result = await subService.getSubscriptionStatus('user-123');

    assert.equal(result.status, SubscriptionStatus.ACTIVE);
    assert.equal(result.isAccessAllowed, true, 'Active subscription must be allowed access');
  });
});
