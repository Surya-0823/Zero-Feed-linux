import { Response } from 'express';
import { userService, UserService } from '../services/user.service';
import { AuthenticatedRequest } from '../types';

export class UserController {
  private userService: UserService;

  constructor(service: UserService = userService) {
    this.userService = service;
  }

  async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
      return;
    }

    try {
      const profile = await this.userService.getProfile(req.user.id);
      res.status(200).json({ user: profile });
    } catch (error: any) {
      res.status(404).json({
        error: 'NotFound',
        message: error.message || 'User not found.',
      });
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      });
      return;
    }

    const { name, avatarUrl } = req.body;

    try {
      const updated = await this.userService.updateProfile(req.user.id, { name, avatarUrl });
      res.status(200).json({
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          avatarUrl: updated.avatarUrl,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'UpdateFailed',
        message: error.message || 'Failed to update user profile.',
      });
    }
  }
}

export const userController = new UserController();
