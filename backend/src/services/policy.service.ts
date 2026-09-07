import crypto from 'crypto';
import { PolicyAction, OtpStatus } from '@prisma/client';
import { policyRepository, PolicyRepository } from '../repositories/policy.repository';
import { emailService, EmailService } from './email.service';

export class PolicyService {
  private policyRepo: PolicyRepository;
  private emailSvc: EmailService;

  constructor(repo: PolicyRepository = policyRepository, email: EmailService = emailService) {
    this.policyRepo = repo;
    this.emailSvc = email;
  }

  async getPolicyAndPartner(userId: string) {
    let policy = await this.policyRepo.getPolicyByUserId(userId);
    if (!policy) {
      policy = await this.policyRepo.upsertDefaultPolicy(userId);
    }

    const partner = await this.policyRepo.getPartnerByUserId(userId);

    return {
      policy,
      partner: partner ? { email: partner.email, name: partner.name, status: partner.status } : null,
      requiresPartnerSetup: !partner,
    };
  }

  async setPartner(userId: string, email: string, name?: string) {
    if (!email || !email.includes('@')) {
      throw new Error('A valid partner email address is required.');
    }

    const partner = await this.policyRepo.upsertPartner(userId, email, name);
    return {
      message: 'Accountability partner registered successfully.',
      partner: {
        email: partner.email,
        name: partner.name,
        status: partner.status,
      },
    };
  }

  async requestPolicyChangeOtp(
    userId: string,
    userName: string,
    action: PolicyAction,
    targetState?: any
  ) {
    const partner = await this.policyRepo.getPartnerByUserId(userId);
    if (!partner) {
      throw new Error('Accountability partner is required before modifying policy settings.');
    }

    const { policy } = await this.getPolicyAndPartner(userId);
    if (action === PolicyAction.DISABLE_POLICY && !policy.isEnabled) {
      throw new Error('Policy is already disabled. No partner verification is required.');
    }

    // Check for rate limit cooldown (60 seconds)
    const existing = await this.policyRepo.findLatestPendingRequest(userId, action);
    if (existing) {
      const timeSinceLast = Date.now() - existing.createdAt.getTime();
      if (timeSinceLast < 60000) {
        const remainingSec = Math.ceil((60000 - timeSinceLast) / 1000);
        throw new Error(`Please wait ${remainingSec}s before requesting another verification code.`);
      }
    }

    // Generate secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const request = await this.policyRepo.createVerificationRequest(
      userId,
      partner.id,
      action,
      otpCode,
      targetState,
      expiresAt
    );

    // Dispatch OTP to partner
    await this.emailSvc.sendPartnerOtp(partner.email, userName, action, otpCode);

    return {
      message: `A 6-digit verification code has been sent to your partner (${partner.email}).`,
      requestId: request.id,
      action: request.action,
      expiresAt: request.expiresAt,
    };
  }

  async verifyPolicyChangeOtp(userId: string, action: PolicyAction, otpCode: string) {
    if (!otpCode || otpCode.trim().length !== 6) {
      throw new Error('Verification code must be a 6-digit numeric string.');
    }

    const pending = await this.policyRepo.findLatestPendingRequest(userId, action);
    if (!pending) {
      throw new Error('No pending verification request found for this action.');
    }

    if (pending.expiresAt < new Date()) {
      await this.policyRepo.updateRequestStatus(pending.id, OtpStatus.EXPIRED);
      throw new Error('Verification code has expired. Please request a new code.');
    }

    if (pending.attempts >= 3) {
      await this.policyRepo.updateRequestStatus(pending.id, OtpStatus.FAILED);
      throw new Error('Too many invalid attempts. This verification code has been invalidated.');
    }

    // Check code match
    if (pending.otpCode !== otpCode.trim()) {
      const updated = await this.policyRepo.incrementAttempts(pending.id);
      const remainingAttempts = 3 - updated.attempts;
      if (remainingAttempts <= 0) {
        await this.policyRepo.updateRequestStatus(pending.id, OtpStatus.FAILED);
        throw new Error('Invalid code. Maximum attempts exceeded; please request a new code.');
      }
      throw new Error(`Invalid verification code. ${remainingAttempts} attempt(s) remaining.`);
    }

    // Mark verified
    await this.policyRepo.updateRequestStatus(pending.id, OtpStatus.VERIFIED, new Date());

    // Apply the policy action
    let updatedPolicy;
    if (action === PolicyAction.DISABLE_POLICY) {
      updatedPolicy = await this.policyRepo.updatePolicy(userId, { isEnabled: false });
    } else if (action === PolicyAction.ENABLE_POLICY) {
      updatedPolicy = await this.policyRepo.updatePolicy(userId, { isEnabled: true });
    } else if (action === PolicyAction.UPDATE_EXTENSION_ID && pending.targetState) {
      const target = pending.targetState as any;
      updatedPolicy = await this.policyRepo.updatePolicy(userId, {
        extensionId: target.extensionId,
      });
    } else if (action === PolicyAction.UPDATE_RULES && pending.targetState) {
      const target = pending.targetState as any;
      updatedPolicy = await this.policyRepo.updatePolicy(userId, {
        blockedFeeds: target.blockedFeeds,
        blockedDomains: target.blockedDomains,
        allowlistDomains: target.allowlistDomains,
      });
    } else {
      updatedPolicy = await this.policyRepo.getPolicyByUserId(userId);
    }

    return {
      message: `Policy ${action.replace(/_/g, ' ').toLowerCase()} verified and applied successfully.`,
      policy: updatedPolicy,
    };
  }

  async getChromeEnterpriseJson(userId: string) {
    const { policy } = await this.getPolicyAndPartner(userId);
    const extId = policy.extensionId || 'hpgfdhmdhondhgcfapnfgeedflocaaia';

    return {
      ExtensionSettings: {
        [extId]: {
          installation_mode: policy.isEnabled ? 'force_installed' : 'normal_installed',
          update_url: 'https://clients2.google.com/service/update2/crx',
        },
      },
    };
  }

  async setExtensionIdInitial(userId: string, extensionId: string) {
    if (!extensionId || extensionId.trim().length !== 32) {
      throw new Error('Chrome extension ID must be a 32-character string.');
    }

    const partner = await this.policyRepo.getPartnerByUserId(userId);
    if (partner) {
      throw new Error(
        'Partner accountability is locked. To modify the Extension ID, request and verify an OTP with your partner.'
      );
    }

    const updated = await this.policyRepo.updatePolicy(userId, {
      extensionId: extensionId.trim().toLowerCase(),
    });

    return {
      message: 'Extension ID configured successfully.',
      policy: updated,
    };
  }

  async enablePolicy(userId: string) {
    const updated = await this.policyRepo.updatePolicy(userId, { isEnabled: true });
    return {
      message: 'Policy enabled successfully.',
      policy: updated,
    };
  }
}

export const policyService = new PolicyService();
