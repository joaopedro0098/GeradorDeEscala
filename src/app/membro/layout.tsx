import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { AdminPromotionModal } from '@/components/notifications/admin-promotion-modal';
import { getUnreadAdminPromotionNotification } from '@/modules/auth/actions';
import { getAppShellContext } from '@/lib/app-shell.server';

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const context = await getAppShellContext({ loginMode: 'user' });
  if (!context?.session) redirect('/admin/organizacoes');

  const promotionNotification = await getUnreadAdminPromotionNotification();

  return (
    <>
      <AppShell context={context}>{children}</AppShell>
      {promotionNotification ? (
        <AdminPromotionModal notificationId={promotionNotification.id} />
      ) : null}
    </>
  );
}
