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

    const hasAccess = subscription.status === SubscriptionStatus.ACTIVE || subscription.status === SubscriptionStatus.TRIAL;

    let normalizedPlan: string = subscription.plan;
    let badgeStyle = {
      theme: 'free',
      label: 'FREE PASS',
    };

    if (subscription.plan === PlanTier.LIFETIME || (subscription.plan as any) === 'LIFETIME' || (subscription.plan as any) === 'ENTERPRISE') {
      normalizedPlan = 'LIFETIME';
      badgeStyle = {
        theme: 'dark-lifetime',
        label: '★ LIFETIME FOUNDER',
      };
    } else if (subscription.plan === PlanTier.YEARLY || (subscription.plan as any) === 'YEARLY' || (subscription.plan as any) === 'PRO') {
      normalizedPlan = 'YEARLY';
      badgeStyle = {
        theme: 'pro-yearly',
        label: 'YEARLY PASS',
      };
    }

    return {
      status: subscription.status,
      plan: normalizedPlan,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      provider: subscription.provider,
      hasAccess,
      isAccessAllowed: hasAccess,
      badgeStyle,
    };
  }
}

export const subscriptionService = new SubscriptionService();
