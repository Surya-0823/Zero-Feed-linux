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

    const mockGoogleClient: any = {
      verifyIdToken: async () => ({
        getPayload: () => ({
          sub: 'google-sub-popeye-123',
          email: 'popeye@example.com',
          name: 'Popeye The Sailor',
          picture: 'https://lh3.googleusercontent.com/a/popeye',
        }),
      }),
    };

    const authService = new AuthService(mockRepo as AuthRepository, mockGoogleClient);
    const result = await authService.authenticateWithGoogle('real-google-id-token-xyz');

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
      googleId: 'google-sub-popeye-123',
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

    const mockGoogleClient: any = {
      verifyIdToken: async () => ({
        getPayload: () => ({
          sub: 'google-sub-popeye-123',
          email: 'popeye@example.com',
          name: 'Existing Popeye',
          picture: null,
        }),
      }),
    };

    const authService = new AuthService(mockRepo as AuthRepository, mockGoogleClient);
    const result = await authService.authenticateWithGoogle('real-google-id-token-xyz');

    assert.equal(result.isNewUser, false, 'Should flag isNewUser as false for returning user');
    assert.equal(result.user.id, 'existing-user-999');
    assert.equal(result.subscription?.status, SubscriptionStatus.ACTIVE);
    assert.ok(result.tokens.accessToken);
  });

  it('should issue a one-time desktop authorization code and exchange it for session tokens', async () => {
    const existingUser = {
      id: 'desktop-user-456',
      email: 'desktop@example.com',
      googleId: 'mock-google-id-desktop',
      name: 'Desktop User',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      subscription: {
        status: SubscriptionStatus.ACTIVE,
        plan: PlanTier.PRO,
      },
    };

    const mockRepo: Partial<AuthRepository> = {
      findUserById: async (id: string) => (id === 'desktop-user-456' ? existingUser : null),
      saveRefreshToken: async (userId, token, expiresAt) => ({
        id: 'rt-desktop',
        userId,
        token,
        expiresAt,
        createdAt: new Date(),
      }),
    };

    const authService = new AuthService(mockRepo as AuthRepository);
    const code = authService.createDesktopAuthCode('desktop-user-456', 'test-state-123');
    assert.ok(code, 'Code should be generated');

    // Exchange with correct code and state
    const exchangeResult = await authService.exchangeDesktopAuthCode(code, 'test-state-123');
    assert.equal(exchangeResult.user.id, 'desktop-user-456');
    assert.equal(exchangeResult.user.email, 'desktop@example.com');
    assert.equal(exchangeResult.subscription?.status, SubscriptionStatus.ACTIVE);
    assert.ok(exchangeResult.tokens.accessToken);
    assert.ok(exchangeResult.tokens.refreshToken);

    // Verify single-use guarantee: burning the code on subsequent attempts
    await assert.rejects(
      async () => authService.exchangeDesktopAuthCode(code, 'test-state-123'),
      /Invalid authorization code/,
      'Single-use code must be burned immediately'
    );
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
