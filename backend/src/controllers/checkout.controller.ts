import { Response } from 'express';
import { paymentService, PaymentService } from '../services/payment.service';
import { AuthenticatedRequest } from '../types';
import { PaymentProvider } from '@prisma/client';

export class CheckoutController {
  private paymentService: PaymentService;

  constructor(service: PaymentService = paymentService) {
    this.paymentService = service;
  }

  async createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required to create a checkout order.',
      });
      return;
    }

    const { plan } = req.body;
    if (!plan || (plan !== 'YEARLY' && plan !== 'LIFETIME')) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'A valid plan tier is required: YEARLY or LIFETIME.',
      });
      return;
    }

    try {
      const order = await this.paymentService.createOrder(req.user.id, plan);
      res.status(201).json(order);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'Failed to create payment order.',
      });
    }
  }

  async handleWebhook(req: any, res: Response): Promise<void> {
    const signature = (req.headers['x-signature'] as string) || '';
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const isValid = this.paymentService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      res.status(401).json({
        error: 'InvalidSignature',
        message: 'Webhook cryptographic signature validation failed.',
      });
      return;
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    try {
      if (payload.event === 'payment.succeeded' && payload.metadata?.userId) {
        const plan = payload.metadata.plan === 'LIFETIME' ? 'LIFETIME' : 'YEARLY';
        await this.paymentService.processPaymentSuccessTransaction({
          userId: payload.metadata.userId,
          amount: payload.amount || (plan === 'LIFETIME' ? 3900 : 2400),
          currency: payload.currency || 'USD',
          provider: PaymentProvider.MOCK_PROVIDER,
          providerOrderId: payload.orderId || 'ord_webhook',
          providerPaymentId: payload.paymentId || `pay_${Date.now()}`,
          plan,
        });
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'Failed to process webhook transaction.',
      });
    }
  }
}

export const checkoutController = new CheckoutController();
