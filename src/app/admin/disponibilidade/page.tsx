import { redirect } from 'next/navigation';

/** Old admin availability overview was removed; send bookmarks to Escala. */
export default function AdminDisponibilidadeRemovedPage() {
  redirect('/admin/escala');
}
