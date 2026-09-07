import { Router } from 'express';
import { checkoutController } from '../controllers/checkout.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/create-order', requireAuth, (req, res) => checkoutController.createOrder(req, res));
router.post('/webhook', (req, res) => checkoutController.handleWebhook(req, res));

export default router;
