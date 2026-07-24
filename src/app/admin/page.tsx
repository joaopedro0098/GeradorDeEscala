import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/modules/auth/session';

export default async function AdminHomePage() {
  const session = await getSessionFromCookies();
  redirect(session ? '/admin/escala' : '/admin/organizacoes');
}
