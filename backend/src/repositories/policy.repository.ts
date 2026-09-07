import { prisma } from '../db/prisma';
import { ExtensionPolicy, Partner, PolicyVerificationRequest, PolicyAction, OtpStatus } from '@prisma/client';

export class PolicyRepository {
  async getPolicyByUserId(userId: string): Promise<ExtensionPolicy | null> {
    return prisma.extensionPolicy.findUnique({
      where: { userId },
    });
  }

  async upsertDefaultPolicy(userId: string): Promise<ExtensionPolicy> {
    return prisma.extensionPolicy.upsert({
      where: { userId },
      create: {
        userId,
        extensionId: 'hpgfdhmdhondhgcfapnfgeedflocaaia',
        isEnabled: true,
        strictMode: true,
        blockedFeeds: ['YOUTUBE_HOMEPAGE', 'YOUTUBE_SHORTS', 'TWITTER_FEED', 'INSTAGRAM_EXPLORE', 'LINKEDIN_FEED'],
        blockedDomains: [],
        allowlistDomains: [],
      },
      update: {},
    });
  }

  async updatePolicy(
    userId: string,
    data: {
      extensionId?: string;
      isEnabled?: boolean;
      blockedFeeds?: string[];
      blockedDomains?: string[];
      allowlistDomains?: string[];
      strictMode?: boolean;
    }
  ): Promise<ExtensionPolicy> {
    return prisma.extensionPolicy.update({
      where: { userId },
      data,
    });
  }

  async getPartnerByUserId(userId: string): Promise<Partner | null> {
    return prisma.partner.findUnique({
      where: { userId },
    });
  }

  async upsertPartner(userId: string, email: string, name?: string): Promise<Partner> {
    return prisma.partner.upsert({
      where: { userId },
      create: {
        userId,
        email: email.toLowerCase().trim(),
        name: name?.trim(),
      },
      update: {
        email: email.toLowerCase().trim(),
        name: name?.trim(),
      },
    });
  }

  async createVerificationRequest(
    userId: string,
    partnerId: string,
    action: PolicyAction,
    otpCode: string,
    targetState: any,
    expiresAt: Date
  ): Promise<PolicyVerificationRequest> {
    return prisma.policyVerificationRequest.create({
      data: {
        userId,
        partnerId,
        action,
        otpCode,
        targetState: targetState || undefined,
        expiresAt,
        status: OtpStatus.PENDING,
      },
    });
  }

  async findLatestPendingRequest(
    userId: string,
    action: PolicyAction
  ): Promise<PolicyVerificationRequest | null> {
    return prisma.policyVerificationRequest.findFirst({
      where: {
        userId,
        action,
        status: OtpStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async incrementAttempts(id: string): Promise<PolicyVerificationRequest> {
    return prisma.policyVerificationRequest.update({
      where: { id },
      data: { attempts: { increment: 1 } },
    });
  }

  async updateRequestStatus(
    id: string,
    status: OtpStatus,
    verifiedAt?: Date
  ): Promise<PolicyVerificationRequest> {
    return prisma.policyVerificationRequest.update({
      where: { id },
      data: { status, verifiedAt },
    });
  }
}

export const policyRepository = new PolicyRepository();
