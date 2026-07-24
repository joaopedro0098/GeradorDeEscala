import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AdminPromotionModal } from '@/components/notifications/admin-promotion-modal';
import { getUnreadAdminPromotionNotification } from '@/modules/auth/actions';
import { requireSession } from '@/lib/auth.server';

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const session = await requireSession({ loginMode: 'user' });
  const promotionNotification = await getUnreadAdminPromotionNotification();

  return (
    <>
      <AppShell session={session} title="Minha área">
        {children}
      </AppShell>
      {promotionNotification ? (
        <AdminPromotionModal notificationId={promotionNotification.id} />
      ) : null}
    </>
  );
}
