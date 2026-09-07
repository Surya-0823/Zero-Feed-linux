import { Response } from 'express';
import { subscriptionService, SubscriptionService } from '../services/subscription.service';
import { AuthenticatedRequest } from '../types';

export class SubscriptionController {
  private subscriptionService: SubscriptionService;

  constructor(service: SubscriptionService = subscriptionService) {
    this.subscriptionService = service;
  }

  async getSubscription(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to check subscription.',
      });
      return;
    }

    try {
      const subscription = await this.subscriptionService.getSubscriptionStatus(req.user.id);
      res.status(200).json({
        subscription,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'Failed to retrieve subscription status.',
      });
    }
  }
}

export const subscriptionController = new SubscriptionController();
