import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PaymentService, MockPaymentAdapter } from './payment.service';

describe('PaymentService (Abstract Adapter & Order Lifecycle)', () => {
  const mockDb = {
    payment: {
      create: async (data: any) => ({ id: 'pay_mock_1', ...data.data }),
    },
    $transaction: async (fn: any) => {
      const txMock = {
        payment: {
          findFirst: async () => null,
          create: async (data: any) => ({ id: 'pay_tx_1', ...data.data }),
        },
        subscription: {
          upsert: async (data: any) => ({ id: 'sub_tx_1', ...data.update }),
        },
        auditLog: {
          create: async (data: any) => ({ id: 'audit_1', ...data.data }),
        },
      };
      return await fn(txMock);
    },
  };

  const paymentService = new PaymentService(new MockPaymentAdapter(), mockDb as any);

  it('should create order with correct amount for YEARLY plan', async () => {
    const order = await paymentService.createOrder('usr_test_1', 'YEARLY');
    assert.equal(order.plan, 'YEARLY');
    assert.equal(order.amount, 2400);
    assert.equal(order.currency, 'USD');
    assert.ok(order.orderId.startsWith('ord_mock_'));
    assert.ok(order.checkoutUrl.includes('YEARLY'));
  });

  it('should create order with correct amount for LIFETIME plan', async () => {
    const order = await paymentService.createOrder('usr_test_2', 'LIFETIME');
    assert.equal(order.plan, 'LIFETIME');
    assert.equal(order.amount, 3900);
    assert.equal(order.currency, 'USD');
    assert.ok(order.orderId.startsWith('ord_mock_'));
    assert.ok(order.checkoutUrl.includes('LIFETIME'));
  });

  it('should verify valid dev webhook signature', () => {
    const isValid = paymentService.verifyWebhookSignature('{"test":true}', 'dev_valid_signature');
    assert.equal(isValid, true);
  });

  it('should process payment success transaction atomically for LIFETIME', async () => {
    const result = await paymentService.processPaymentSuccessTransaction({
      userId: 'desktop-user-id',
      amount: 3900,
      currency: 'USD',
      provider: 'MOCK_PROVIDER' as any,
      providerOrderId: 'ord_123',
      providerPaymentId: 'pay_123',
      plan: 'LIFETIME',
    });

    assert.equal(result.duplicate, false);
    assert.equal(result.payment.status, 'COMPLETED');
    assert.equal(result.subscription.plan, 'LIFETIME');
    assert.equal(result.subscription.status, 'ACTIVE');
  });
});
