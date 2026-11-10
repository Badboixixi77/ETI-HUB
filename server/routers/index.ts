import { router } from '../_core/trpc';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { tasksRouter } from './tasks';
import { messagingRouter } from './messaging';
import { boardRouter } from './board';
import { documentsRouter } from './documents';
import { calendarRouter } from './calendar';
import { announcementsRouter } from './announcements';
import { notificationsRouter } from './notifications';
import { settingsRouter } from './settings';
import { dashboardRouter } from './dashboard';

export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  tasks: tasksRouter,
  messaging: messagingRouter,
  board: boardRouter,
  documents: documentsRouter,
  calendar: calendarRouter,
  announcements: announcementsRouter,
  notifications: notificationsRouter,
  settings: settingsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
