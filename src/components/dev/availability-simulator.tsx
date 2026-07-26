'use client';

import { useEffect, useState } from 'react';
import {
  saveGeneralSimulatedAvailabilityAction,
  saveIndividualSimulatedAvailabilityAction,
  type DevActionState,
} from '@/modules/dev/actions';
import type { DevActiveMember, DevAssignmentMatrix } from '@/modules/dev/simulate-availability.service';
import { Alert, PrimaryButton } from '@/components/auth/auth-ui';
import { useToastActionState } from '@/components/ui/success-toast';
import type { YearMonth } from '@/modules/scheduling/working-month.logic';

type Mode = 'general' | 'individual';

export function AvailabilitySimulator({
  workingMonth,
  cultEventCount,
  members,
  matrix,
}: {
  workingMonth: YearMonth;
  cultEventCount: number;
  members: DevActiveMember[];
  matrix: DevAssignmentMatrix;
}) {
  const [mode, setMode] = useState<Mode>('general');
  const [generalDays, setGeneralDays] = useState('0');
  const [individualDays, setIndividualDays] = useState<Record<string, string>>(() =>
    Object.fromEntries(members.map((member) => [member.membershipId, '0'])),
  );

  const [generalState, generalAction] = useToastActionState<DevActionState>(
    saveGeneralSimulatedAvailabilityAction,
    {},
  );
  const [individualState, individualAction] = useToastActionState<DevActionState>(
    saveIndividualSimulatedAvailabilityAction,
    {},
  );

  useEffect(() => {
    setIndividualDays((current) => {
      const next: Record<string, string> = {};
      for (const member of members) {
        next[member.membershipId] = current[member.membershipId] ?? '0';
      }
      return next;
    });
  }, [members]);

  function activateGeneral() {
    setMode('general');
    setIndividualDays(Object.fromEntries(members.map((member) => [member.membershipId, '0'])));
  }

  function activateIndividual() {
    setMode('individual');
    setGeneralDays('0');
  }

  const monthLabel = `${String(workingMonth.month).padStart(2, '0')}/${workingMonth.year}`;
  const isGeneral = mode === 'general';

  return (
    <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Simulação de disponibilidade</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Ferramenta só do desenvolvedor. Grava disponibilidade real no mês de trabalho{' '}
          <span className="font-medium text-zinc-900">{monthLabel}</span> ({cultEventCount} dia(s) de
          culto no calendário). Sobrescreve só este mês — histórico de escalas anteriores permanece
          para equidade.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-zinc-800">Modo geral</span>
        <button
          type="button"
          role="switch"
          aria-checked={isGeneral}
          onClick={() => (isGeneral ? activateIndividual() : activateGeneral())}
          className={`relative h-7 w-12 rounded-full transition ${
            isGeneral ? 'bg-zinc-900' : 'bg-zinc-300'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              isGeneral ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
        <span className="text-sm text-zinc-700">
          {isGeneral
            ? 'Ativo — campo geral editável; individuais zerados e bloqueados'
            : 'Desativado — campo geral zerado/bloqueado; só individuais valem'}
        </span>
      </div>

      <form action={generalAction} className="space-y-4 rounded-xl border border-zinc-100 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Campo geral</h3>
        <label className="block max-w-xs text-sm font-medium text-zinc-800">
          Dias disponíveis para cada membro
          <input
            name="dayCount"
            type="number"
            min={0}
            step={1}
            value={generalDays}
            disabled={!isGeneral}
            onChange={(event) => setGeneralDays(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
          />
        </label>
        {generalState.error ? <Alert message={generalState.error} tone="error" /> : null}
        {isGeneral ? <PrimaryButton label="Salvar" fullWidth={false} /> : null}
      </form>

      <form action={individualAction} className="space-y-4 rounded-xl border border-zinc-100 p-4">
        <h3 className="text-sm font-semibold text-zinc-900">Campos individuais</h3>
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 font-medium">Membro</th>
                <th className="px-3 py-2 font-medium">Dias disponíveis</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.membershipId} className="border-t border-zinc-100">
                  <td className="px-3 py-2 text-zinc-900">{member.name}</td>
                  <td className="px-3 py-2">
                    <input
                      name={`days_${member.membershipId}`}
                      type="number"
                      min={0}
                      step={1}
                      value={individualDays[member.membershipId] ?? '0'}
                      disabled={isGeneral}
                      onChange={(event) =>
                        setIndividualDays((current) => ({
                          ...current,
                          [member.membershipId]: event.target.value,
                        }))
                      }
                      className="w-24 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {individualState.error ? <Alert message={individualState.error} tone="error" /> : null}
        {!isGeneral ? <PrimaryButton label="Salvar" fullWidth={false} /> : null}
      </form>

      <AssignmentMatrixTable matrix={matrix} />
    </section>
  );
}

function AssignmentMatrixTable({ matrix }: { matrix: DevAssignmentMatrix }) {
  const monthLabel = `${String(matrix.month).padStart(2, '0')}/${matrix.year}`;

  return (
    <div className="space-y-3 border-t border-zinc-100 pt-6">
      <div>
        <h3 className="text-base font-semibold text-zinc-900">
          Escalações geradas ({monthLabel})
        </h3>
        <p className="mt-1 text-sm text-zinc-600">
          Somente leitura: quantas vezes cada membro foi efetivamente escalado em cada função neste
          mês (resultado da geração, não a disponibilidade marcada).
        </p>
      </div>

      {!matrix.hasSchedule ? (
        <p className="text-sm text-zinc-500">
          Ainda não há escala gerada para este mês. Gere em Admin → Escala para ver a matriz.
        </p>
      ) : matrix.roles.length === 0 || matrix.members.length === 0 ? (
        <p className="text-sm text-zinc-500">Sem funções ou membros para montar a tabela.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 font-medium">Membro</th>
                {matrix.roles.map((role) => (
                  <th key={role.id} className="whitespace-nowrap px-3 py-2 font-medium">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.members.map((member) => (
                <tr key={member.membershipId} className="border-t border-zinc-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-zinc-900">
                    {member.name}
                  </td>
                  {matrix.roles.map((role) => (
                    <td key={role.id} className="px-3 py-2 tabular-nums text-zinc-700">
                      {matrix.counts[member.membershipId]?.[role.id] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
