import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env';
import { authRepository, AuthRepository } from '../repositories/auth.repository';
import { GoogleProfile, AuthUserPayload } from '../types';

export class AuthService {
  private googleClient: OAuth2Client | null = null;
  private authRepo: AuthRepository;

  constructor(repo: AuthRepository = authRepository) {
    this.authRepo = repo;
    if (config.google.clientId) {
      this.googleClient = new OAuth2Client(config.google.clientId);
    }
  }

  async verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
    // Development Mock Bypass: allows local end-to-end testing without Google Cloud Console credentials
    if (config.nodeEnv !== 'production' && idToken.startsWith('dev-mock-')) {
      const email = idToken.replace('dev-mock-', '') || 'test@example.com';
      return {
        googleId: `mock-google-id-${Buffer.from(email).toString('hex').substring(0, 12)}`,
        email: email.toLowerCase(),
        name: 'ZeroFeed Test User',
        avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
      };
    }

    if (!config.google.clientId) {
      throw new Error(
        'GOOGLE_CLIENT_ID is not configured in backend environment. Set it in .env or use a dev-mock- token for local testing.'
      );
    }

    if (!this.googleClient) {
      this.googleClient = new OAuth2Client(config.google.clientId);
    }

    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      throw new Error('Invalid Google token payload: missing subject or email.');
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name,
      avatarUrl: payload.picture,
    };
  }

  generateAccessToken(payload: AuthUserPayload): string {
    return jwt.sign(payload, config.jwt.accessSecret, {
      expiresIn: '15m',
    });
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  async authenticateWithGoogle(idToken: string) {
    const profile = await this.verifyGoogleIdToken(idToken);

    // Check if user exists by Google ID or Email
    let user = await this.authRepo.findUserByGoogleId(profile.googleId);
    let isNewUser = false;

    if (!user) {
      user = await this.authRepo.findUserByEmail(profile.email);
    }

    if (!user) {
      // Create user with default INACTIVE subscription (AGENTS.md rule)
      user = await this.authRepo.createUserWithDefaultSubscription({
        email: profile.email,
        googleId: profile.googleId,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      });
      isNewUser = true;
    }

    // Issue tokens
    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      googleId: user.googleId,
    });

    const refreshTokenString = this.generateRefreshToken();
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + config.jwt.refreshExpiresInDays);

    await this.authRepo.saveRefreshToken(user.id, refreshTokenString, refreshExpiresAt);

    return {
      user: {
        id: user.id,
        email: user.email,
        googleId: user.googleId,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
      subscription: user.subscription,
      tokens: {
        accessToken,
        refreshToken: refreshTokenString,
        tokenType: 'Bearer',
        expiresIn: config.jwt.accessExpiresIn,
      },
      isNewUser,
    };
  }

  async refreshTokens(refreshToken: string) {
    const tokenRecord = await this.authRepo.findRefreshToken(refreshToken);

    if (!tokenRecord) {
      throw new Error('Invalid refresh token.');
    }

    if (tokenRecord.expiresAt < new Date()) {
      await this.authRepo.deleteRefreshToken(refreshToken);
      throw new Error('Refresh token has expired. Please sign in again.');
    }

    // Rotate refresh token
    await this.authRepo.deleteRefreshToken(refreshToken);

    const user = tokenRecord.user;
    const newAccessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      googleId: user.googleId,
    });

    const newRefreshTokenString = this.generateRefreshToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + config.jwt.refreshExpiresInDays);

    await this.authRepo.saveRefreshToken(user.id, newRefreshTokenString, newExpiresAt);

    return {
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshTokenString,
        tokenType: 'Bearer',
        expiresIn: config.jwt.accessExpiresIn,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    if (refreshToken) {
      await this.authRepo.deleteRefreshToken(refreshToken);
    }
  }
}

export const authService = new AuthService();
