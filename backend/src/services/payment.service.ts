import crypto from 'crypto';
import { PrismaClient, PlanTier, SubscriptionStatus, PaymentStatus, PaymentProvider } from '@prisma/client';
import { prisma } from '../db/prisma';

export interface PaymentOrderParams {
  userId: string;
  plan: 'YEARLY' | 'LIFETIME';
  amount: number;
  currency: string;
  metadata?: Record<string, any>;
}

export interface PaymentOrderResult {
  orderId: string;
  receiptId: string;
  amount: number;
  currency: string;
  plan: 'YEARLY' | 'LIFETIME';
  checkoutUrl: string;
}

export interface PaymentProviderAdapter {
  createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
}

export class MockPaymentAdapter implements PaymentProviderAdapter {
  async createOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    const orderId = `ord_mock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const receiptId = `rec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      orderId,
      receiptId,
      amount: params.amount,
      currency: params.currency,
      plan: params.plan,
      checkoutUrl: `http://localhost:3001/#checkout?orderId=${orderId}&plan=${params.plan}`,
    };
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

export class PaymentService {
  private adapter: PaymentProviderAdapter;
  private db: PrismaClient;
  private webhookSecret: string;

  constructor(adapter?: PaymentProviderAdapter, dbClient: any = prisma) {
    this.adapter = adapter || new MockPaymentAdapter();
    this.db = dbClient;
    this.webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'dev_payment_webhook_secret_key_123';
  }

  async createOrder(userId: string, plan: 'YEARLY' | 'LIFETIME'): Promise<PaymentOrderResult> {
    const amount = plan === 'LIFETIME' ? 3900 : 2400; // in cents
    const currency = 'USD';

    const orderResult = await this.adapter.createOrder({
      userId,
      plan,
      amount,
      currency,
      metadata: { userId, plan },
    });

    // Save initial PENDING payment record
    if (this.db?.payment?.create) {
      await this.db.payment.create({
        data: {
          userId,
          amount,
          currency,
          status: PaymentStatus.PENDING,
          provider: PaymentProvider.MOCK_PROVIDER,
          providerOrderId: orderResult.orderId,
          metadata: {
            plan,
            receiptId: orderResult.receiptId,
          },
        },
      });
    }

    return orderResult;
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    // In dev mode allow bypass if dev-signature provided
    if (process.env.NODE_ENV !== 'production' && signature === 'dev_valid_signature') {
      return true;
    }
    return this.adapter.verifyWebhookSignature(rawBody, signature, this.webhookSecret);
  }

  async processPaymentSuccessTransaction(params: {
    userId: string;
    amount: number;
    currency: string;
    provider: PaymentProvider;
    providerOrderId: string;
    providerPaymentId: string;
    plan: 'YEARLY' | 'LIFETIME';
    receiptUrl?: string;
  }) {
    return await (this.db as any).$transaction(async (tx: any) => {
      // 1. Idempotency Check: Prevent double-crediting
      const existingPayment = await tx.payment.findFirst({
        where: { providerPaymentId: params.providerPaymentId },
      });

      if (existingPayment && existingPayment.status === PaymentStatus.COMPLETED) {
        return { duplicate: true, paymentId: existingPayment.id };
      }

      // 2. Create Payment Receipt Record
      const payment = await tx.payment.create({
        data: {
          userId: params.userId,
          amount: params.amount,
          currency: params.currency,
          status: PaymentStatus.COMPLETED,
          provider: params.provider,
          providerOrderId: params.providerOrderId,
          providerPaymentId: params.providerPaymentId,
          receiptUrl: params.receiptUrl || null,
          metadata: {
            plan: params.plan,
            processedAt: new Date().toISOString(),
            receiptUrl: params.receiptUrl || null,
          },
        },
      });

      // 3. Compute Period Boundaries based on Plan Tier (Preserving PlanTier mappings)
      const now = new Date();
      let currentPeriodEnd: Date | null = null;
      let planTier: PlanTier = PlanTier.FREE;

      if (params.plan === 'YEARLY') {
        planTier = PlanTier.YEARLY || (PlanTier as any).PRO;
        currentPeriodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 365 days
      } else if (params.plan === 'LIFETIME') {
        planTier = PlanTier.LIFETIME || (PlanTier as any).ENTERPRISE;
        currentPeriodEnd = null; // No expiration
      }

      // 4. Upsert Authoritative Subscription Record
      const subscription = await tx.subscription.upsert({
        where: { userId: params.userId },
        create: {
          userId: params.userId,
          status: SubscriptionStatus.ACTIVE,
          plan: planTier,
          provider: params.provider,
          providerSubscriptionId: params.plan === 'LIFETIME' ? null : params.providerOrderId,
          currentPeriodStart: now,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
        update: {
          status: SubscriptionStatus.ACTIVE,
          plan: planTier,
          provider: params.provider,
          providerSubscriptionId: params.plan === 'LIFETIME' ? null : params.providerOrderId,
          currentPeriodStart: now,
          currentPeriodEnd: currentPeriodEnd,
          cancelAtPeriodEnd: false,
        },
      });

      // 5. Immutable Audit Log Entry
      await tx.auditLog.create({
        data: {
          userId: params.userId,
          action: 'SUBSCRIPTION_ACTIVATED',
          eventType: 'SUBSCRIPTION_PAYMENT_SUCCESS',
          payloadHash: crypto.createHash('sha256').update(JSON.stringify(payment)).digest('hex'),
        },
      });

      return { duplicate: false, payment, subscription };
    });
  }
}

export const paymentService = new PaymentService();
