import { Request, Response } from 'express';
import { authService, AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  private authService: AuthService;

  constructor(service: AuthService = authService) {
    this.authService = service;
  }

  async googleAuth(req: Request, res: Response): Promise<void> {
    const { idToken, generateDesktopCode, state } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      res.status(400).json({
        error: 'BadRequest',
        message: 'idToken is required and must be a valid string.',
      });
      return;
    }

    try {
      const result = await this.authService.authenticateWithGoogle(idToken.trim(), {
        generateDesktopCode: Boolean(generateDesktopCode),
        state: typeof state === 'string' ? state.trim() : undefined,
      });
      const statusCode = result.isNewUser ? 201 : 200;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(401).json({
        error: 'AuthenticationFailed',
        message: error.message || 'Failed to authenticate with Google.',
      });
    }
  }

  async exchangeCode(req: Request, res: Response): Promise<void> {
    const { code, state } = req.body;

    if (!code || typeof code !== 'string') {
      res.status(400).json({
        error: 'BadRequest',
        message: 'code is required and must be a valid string.',
      });
      return;
    }

    try {
      const result = await this.authService.exchangeDesktopAuthCode(
        code.trim(),
        typeof state === 'string' ? state.trim() : undefined
      );
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({
        error: 'InvalidOrExpiredCode',
        message: error.message || 'Failed to exchange authorization code.',
      });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    if (!refreshToken || typeof refreshToken !== 'string') {
      res.status(400).json({
        error: 'BadRequest',
        message: 'refreshToken is required.',
      });
      return;
    }

    try {
      const result = await this.authService.refreshTokens(refreshToken.trim());
      res.status(200).json(result);
    } catch (error: any) {
      res.status(401).json({
        error: 'TokenRefreshFailed',
        message: error.message || 'Failed to refresh token.',
      });
    }
  }

  async logout(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;

    try {
      if (refreshToken && typeof refreshToken === 'string') {
        await this.authService.logout(refreshToken.trim());
      }
      res.status(200).json({
        message: 'Successfully logged out.',
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'LogoutFailed',
        message: 'An error occurred during logout.',
      });
    }
  }

  async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'User session not found.',
      });
      return;
    }

    res.status(200).json({
      user: req.user,
    });
  }
}

export const authController = new AuthController();
