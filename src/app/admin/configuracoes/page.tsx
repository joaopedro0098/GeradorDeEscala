import { redirect } from 'next/navigation';
import { ConfigurationTabs } from '@/components/scheduling/configuration-tabs';
import { getConfigurationPageData } from '@/modules/scheduling/actions';

export default async function AdminConfigurationPage() {
  const data = await getConfigurationPageData();
  if (!data) redirect('/login');

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-900">Configuração da escala</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Calendário de eventos, formação semanal, intervalo, prioridade e mínimo de participação.
        </p>
      </div>

      <ConfigurationTabs
        configuration={data.configuration}
        workingMonth={data.workingMonth}
        earliestMonth={data.earliestMonth}
      />
    </div>
  );
}
