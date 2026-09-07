import { Response } from 'express';
import { PolicyAction } from '@prisma/client';
import { policyService, PolicyService } from '../services/policy.service';
import { AuthenticatedRequest } from '../types';

export class PolicyController {
  private policyService: PolicyService;

  constructor(service: PolicyService = policyService) {
    this.policyService = service;
  }

  async getPolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const data = await this.policyService.getPolicyAndPartner(req.user.id);
      res.status(200).json(data);
    } catch (error: any) {
      res.status(500).json({
        error: 'InternalServerError',
        message: error.message || 'Failed to retrieve policy.',
      });
    }
  }

  async setPartner(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email, name } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'BadRequest', message: 'Valid partner email is required.' });
      return;
    }

    // Do not allow user to set their own email as their accountability partner
    if (email.toLowerCase().trim() === req.user.email.toLowerCase().trim()) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'You cannot set your own email as your accountability partner.',
      });
      return;
    }

    try {
      const result = await this.policyService.setPartner(req.user.id, email, name);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }

  async requestOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { action, targetState } = req.body;
    if (!action || !Object.values(PolicyAction).includes(action)) {
      res.status(400).json({
        error: 'BadRequest',
        message: `Valid action required. Allowed: ${Object.values(PolicyAction).join(', ')}`,
      });
      return;
    }

    try {
      const result = await this.policyService.requestPolicyChangeOtp(
        req.user.id,
        req.user.name || req.user.email,
        action as PolicyAction,
        targetState
      );
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }

  async verifyOtp(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { action, otpCode } = req.body;
    if (!action || !otpCode) {
      res.status(400).json({
        error: 'BadRequest',
        message: 'Both action and 6-digit otpCode are required.',
      });
      return;
    }

    try {
      const result = await this.policyService.verifyPolicyChangeOtp(
        req.user.id,
        action as PolicyAction,
        otpCode
      );
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: 'VerificationFailed', message: error.message });
    }
  }

  async getChromeJson(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const chromeJson = await this.policyService.getChromeEnterpriseJson(req.user.id);
      res.status(200).json(chromeJson);
    } catch (error: any) {
      res.status(500).json({ error: 'InternalServerError', message: error.message });
    }
  }

  async setExtensionIdInitial(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { extensionId } = req.body;
    try {
      const result = await this.policyService.setExtensionIdInitial(req.user.id, extensionId);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }

  async enablePolicy(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const result = await this.policyService.enablePolicy(req.user.id);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(400).json({ error: 'BadRequest', message: error.message });
    }
  }
}

export const policyController = new PolicyController();
