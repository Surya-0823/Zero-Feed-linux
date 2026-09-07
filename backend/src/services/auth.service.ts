import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/env';
import { authRepository, AuthRepository } from '../repositories/auth.repository';
import { GoogleProfile, AuthUserPayload } from '../types';

export class AuthService {
  private googleClient: OAuth2Client | null = null;
  private authRepo: AuthRepository;

  constructor(repo: AuthRepository = authRepository, googleClient?: OAuth2Client) {
    this.authRepo = repo;
    if (googleClient) {
      this.googleClient = googleClient;
    } else if (config.google.clientId) {
      this.googleClient = new OAuth2Client(config.google.clientId);
    }
  }

  async verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
    if (!config.google.clientId) {
      throw new Error(
        'GOOGLE_CLIENT_ID is not configured in backend environment. Set it in .env.'
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

  async authenticateWithGoogle(idToken: string, options?: { generateDesktopCode?: boolean; state?: string }) {
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

    let desktopAuthCode: string | undefined;
    if (options?.generateDesktopCode) {
      desktopAuthCode = this.createDesktopAuthCode(user.id, options.state);
    }

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
      desktopAuthCode,
      isNewUser,
    };
  }

  private desktopAuthCodes: Map<string, { code: string; userId: string; state?: string; expiresAt: Date }> = new Map();

  createDesktopAuthCode(userId: string, state?: string): string {
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds
    this.desktopAuthCodes.set(code, { code, userId, state, expiresAt });
    return code;
  }

  async exchangeDesktopAuthCode(code: string, state?: string) {
    const record = this.desktopAuthCodes.get(code);
    if (!record) {
      throw new Error('Invalid authorization code.');
    }

    // Single-use guarantee: burn code immediately
    this.desktopAuthCodes.delete(code);

    if (record.expiresAt < new Date()) {
      throw new Error('Authorization code has expired.');
    }

    if (state && record.state && record.state !== state) {
      throw new Error('State parameter mismatch in authorization exchange.');
    }

    const user = await this.authRepo.findUserById(record.userId);
    if (!user) {
      throw new Error('User account not found.');
    }

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
