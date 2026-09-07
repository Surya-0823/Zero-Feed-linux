import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyService } from './policy.service';
import { PolicyRepository } from '../repositories/policy.repository';
import { EmailService } from './email.service';
import { PolicyAction, OtpStatus } from '@prisma/client';

describe('PolicyService (Accountability Partner & Policy OTP)', () => {
  it('should set accountability partner email', async () => {
    let savedPartner: any = null;

    const mockRepo: Partial<PolicyRepository> = {
      upsertPartner: async (userId, email, name) => {
        savedPartner = { id: 'p-1', userId, email, name, status: 'ACTIVE' };
        return savedPartner;
      },
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository);
    const res = await policyService.setPartner('user-1', 'accountability.buddy@example.com', 'Buddy');

    assert.equal(res.partner.email, 'accountability.buddy@example.com');
    assert.equal(savedPartner.email, 'accountability.buddy@example.com');
  });

  it('should fail requesting OTP if no partner is configured', async () => {
    const mockRepo: Partial<PolicyRepository> = {
      getPartnerByUserId: async () => null,
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository);
    await assert.rejects(
      () => policyService.requestPolicyChangeOtp('user-1', 'Popeye', PolicyAction.DISABLE_POLICY),
      /Accountability partner is required/
    );
  });

  it('should generate 6-digit OTP and send to partner email', async () => {
    let dispatchedOtp = '';
    let dispatchedEmail = '';

    const mockRepo: Partial<PolicyRepository> = {
      getPartnerByUserId: async () => ({
        id: 'p-1',
        userId: 'user-1',
        email: 'partner@example.com',
        name: 'Partner',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getPolicyByUserId: async () => ({
        id: 'pol-1',
        userId: 'user-1',
        extensionId: 'hpgfdhmdhondhgcfapnfgeedflocaaia',
        isEnabled: true,
        blockedFeeds: [],
        blockedDomains: [],
        allowlistDomains: [],
        strictMode: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      findLatestPendingRequest: async () => null,
      createVerificationRequest: async (userId, partnerId, action, otpCode, targetState, expiresAt) => ({
        id: 'req-1',
        userId,
        partnerId,
        action,
        otpCode,
        targetState: null,
        attempts: 0,
        expiresAt,
        verifiedAt: null,
        status: OtpStatus.PENDING,
        createdAt: new Date(),
      }),
    };

    const mockEmail: Partial<EmailService> = {
      sendPartnerOtp: async (partnerEmail, userName, action, otpCode) => {
        dispatchedEmail = partnerEmail;
        dispatchedOtp = otpCode;
      },
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository, mockEmail as EmailService);
    const res = await policyService.requestPolicyChangeOtp('user-1', 'Popeye', PolicyAction.DISABLE_POLICY);

    assert.equal(dispatchedEmail, 'partner@example.com');
    assert.equal(dispatchedOtp.length, 6, 'OTP must be 6 digits');
    assert.match(dispatchedOtp, /^\d{6}$/);
    assert.equal(res.action, PolicyAction.DISABLE_POLICY);
  });

  it('should reject invalid OTP and decrement remaining attempts', async () => {
    let attemptsCount = 0;

    const mockRepo: Partial<PolicyRepository> = {
      findLatestPendingRequest: async () => ({
        id: 'req-1',
        userId: 'user-1',
        partnerId: 'p-1',
        action: PolicyAction.DISABLE_POLICY,
        otpCode: '123456',
        status: OtpStatus.PENDING,
        targetState: null,
        attempts: attemptsCount,
        expiresAt: new Date(Date.now() + 15 * 60000),
        verifiedAt: null,
        createdAt: new Date(),
      }),
      incrementAttempts: async () => {
        attemptsCount++;
        return { attempts: attemptsCount } as any;
      },
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository);
    await assert.rejects(
      () => policyService.verifyPolicyChangeOtp('user-1', PolicyAction.DISABLE_POLICY, '000000'),
      /Invalid verification code/
    );
  });

  it('should verify valid 6-digit OTP and disable policy', async () => {
    let policyDisabled = false;

    const mockRepo: Partial<PolicyRepository> = {
      findLatestPendingRequest: async () => ({
        id: 'req-1',
        userId: 'user-1',
        partnerId: 'p-1',
        action: PolicyAction.DISABLE_POLICY,
        otpCode: '654321',
        status: OtpStatus.PENDING,
        targetState: null,
        attempts: 0,
        expiresAt: new Date(Date.now() + 15 * 60000),
        verifiedAt: null,
        createdAt: new Date(),
      }),
      updateRequestStatus: async () => ({} as any),
      updatePolicy: async (userId, data) => {
        if (data.isEnabled === false) policyDisabled = true;
        return { id: 'pol-1', userId, isEnabled: false } as any;
      },
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository);
    const res = await policyService.verifyPolicyChangeOtp('user-1', PolicyAction.DISABLE_POLICY, '654321');

    assert.equal(policyDisabled, true, 'Policy must be disabled upon valid partner OTP');
    assert.ok(res.policy);
    assert.equal(res.policy?.isEnabled, false);
  });

  it('should update extension ID upon valid partner OTP for UPDATE_EXTENSION_ID', async () => {
    let updatedExtId = '';

    const mockRepo: Partial<PolicyRepository> = {
      findLatestPendingRequest: async () => ({
        id: 'req-2',
        userId: 'user-1',
        partnerId: 'p-1',
        action: PolicyAction.UPDATE_EXTENSION_ID,
        otpCode: '999888',
        status: OtpStatus.PENDING,
        targetState: { extensionId: 'abcdefghijklmnopqrstuvwxyz123456' },
        attempts: 0,
        expiresAt: new Date(Date.now() + 15 * 60000),
        verifiedAt: null,
        createdAt: new Date(),
      }),
      updateRequestStatus: async () => ({} as any),
      updatePolicy: async (userId, data) => {
        if (data.extensionId) updatedExtId = data.extensionId;
        return { id: 'pol-1', userId, extensionId: data.extensionId } as any;
      },
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository);
    const res = await policyService.verifyPolicyChangeOtp('user-1', PolicyAction.UPDATE_EXTENSION_ID, '999888');

    assert.equal(updatedExtId, 'abcdefghijklmnopqrstuvwxyz123456');
    assert.ok(res.policy);
    assert.equal(res.policy?.extensionId, 'abcdefghijklmnopqrstuvwxyz123456');
  });

  it('should generate valid Chrome Enterprise ExtensionSettings JSON', async () => {
    const mockRepo: Partial<PolicyRepository> = {
      getPolicyByUserId: async () => ({
        id: 'pol-1',
        userId: 'user-1',
        extensionId: 'hpgfdhmdhondhgcfapnfgeedflocaaia',
        isEnabled: true,
        blockedFeeds: [],
        blockedDomains: [],
        allowlistDomains: [],
        strictMode: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      getPartnerByUserId: async () => null,
    };

    const policyService = new PolicyService(mockRepo as PolicyRepository);
    const json = await policyService.getChromeEnterpriseJson('user-1');

    assert.ok(json.ExtensionSettings['hpgfdhmdhondhgcfapnfgeedflocaaia']);
    assert.equal(json.ExtensionSettings['hpgfdhmdhondhgcfapnfgeedflocaaia'].installation_mode, 'force_installed');
    assert.equal(
      json.ExtensionSettings['hpgfdhmdhondhgcfapnfgeedflocaaia'].update_url,
      'https://clients2.google.com/service/update2/crx'
    );
  });
});
