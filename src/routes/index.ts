import { Router } from 'express';
import { authRoutes } from '../modules/auth/auth.routes';
import { householdRoutes } from '../modules/household/household.routes';
import { memberRoutes } from '../modules/member/member.routes';
import { duesRoutes } from '../modules/dues/dues.routes';
import { paymentRoutes } from '../modules/payment/payment.routes';
import { donationRoutes } from '../modules/donation/donation.routes';
import { aidRoutes } from '../modules/aid/aid.routes';
import { eventRoutes } from '../modules/event/event.routes';
import { announcementRoutes } from '../modules/announcement/announcement.routes';
import { documentRoutes } from '../modules/document/document.routes';
import { notificationRoutes } from '../modules/notification/notification.routes';

export const apiRoutes = Router();

apiRoutes.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'vang-clan-management',
    // Render injects RENDER_GIT_COMMIT into the running service. CI polls this
    // after triggering a deploy to confirm the new build is actually live,
    // rather than the previous instance still answering.
    commit: process.env.RENDER_GIT_COMMIT ?? 'local',
    time: new Date().toISOString(),
  });
});

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/households', householdRoutes);
apiRoutes.use('/members', memberRoutes);
apiRoutes.use('/dues', duesRoutes);
apiRoutes.use('/payments', paymentRoutes);
apiRoutes.use('/donations', donationRoutes);
apiRoutes.use('/aid-cases', aidRoutes);
apiRoutes.use('/events', eventRoutes);
apiRoutes.use('/announcements', announcementRoutes);
apiRoutes.use('/documents', documentRoutes);
apiRoutes.use('/notifications', notificationRoutes);
