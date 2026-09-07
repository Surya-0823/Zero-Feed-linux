import { prisma } from '../db/prisma';
import { Subscription, SubscriptionStatus, PlanTier, PaymentProvider } from '@prisma/client';

export class SubscriptionRepository {
  async findByUserId(userId: string): Promise<Subscription | null> {
    return prisma.subscription.findUnique({
      where: { userId },
    });
  }

  async updateByUserId(
    userId: string,
    data: {
      status?: SubscriptionStatus;
      plan?: PlanTier;
      provider?: PaymentProvider;
      providerCustomerId?: string;
      providerSubscriptionId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
      cancelAtPeriodEnd?: boolean;
    }
  ): Promise<Subscription> {
    return prisma.subscription.update({
      where: { userId },
      data,
    });
  }

  async upsertSubscription(
    userId: string,
    data: {
      status: SubscriptionStatus;
      plan: PlanTier;
      provider?: PaymentProvider;
      providerCustomerId?: string;
      providerSubscriptionId?: string;
      currentPeriodStart?: Date;
      currentPeriodEnd?: Date;
    }
  ): Promise<Subscription> {
    return prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
      },
      update: data,
    });
  }
}

export const subscriptionRepository = new SubscriptionRepository();
