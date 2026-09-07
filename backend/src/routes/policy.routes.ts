import { Router } from 'express';
import { policyController } from '../controllers/policy.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// All policy and partner routes require authenticated user
router.use(requireAuth);

router.get('/', (req, res) => policyController.getPolicy(req, res));
router.get('/chrome-json', (req, res) => policyController.getChromeJson(req, res));
router.post('/extension-id', (req, res) => policyController.setExtensionIdInitial(req, res));
router.post('/enable', (req, res) => policyController.enablePolicy(req, res));
router.post('/partner', (req, res) => policyController.setPartner(req, res));
router.post('/request-otp', (req, res) => policyController.requestOtp(req, res));
router.post('/verify-otp', (req, res) => policyController.verifyOtp(req, res));

export default router;
