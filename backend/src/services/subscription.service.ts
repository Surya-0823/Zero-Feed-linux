import { SubscriptionStatus, PlanTier } from '@prisma/client';
import { subscriptionRepository, SubscriptionRepository } from '../repositories/subscription.repository';

export class SubscriptionService {
  private subscriptionRepo: SubscriptionRepository;

  constructor(repo: SubscriptionRepository = subscriptionRepository) {
    this.subscriptionRepo = repo;
  }

  async getSubscriptionStatus(userId: string) {
    let subscription = await this.subscriptionRepo.findByUserId(userId);

    if (!subscription) {
      subscription = await this.subscriptionRepo.upsertSubscription(userId, {
        status: SubscriptionStatus.INACTIVE,
        plan: PlanTier.FREE,
      });
    }

    const isAccessAllowed = subscription.status === SubscriptionStatus.ACTIVE;

    return {
      status: subscription.status,
      plan: subscription.plan,
      isAccessAllowed,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      provider: subscription.provider,
    };
  }
}

export const subscriptionService = new SubscriptionService();
