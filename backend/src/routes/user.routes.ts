import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.get('/me', requireAuth, (req, res) => userController.getProfile(req, res));
router.patch('/me', requireAuth, (req, res) => userController.updateProfile(req, res));

export default router;
