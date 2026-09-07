import { Router } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', requireAuth, (req, res) => subscriptionController.getSubscription(req, res));

export default router;
