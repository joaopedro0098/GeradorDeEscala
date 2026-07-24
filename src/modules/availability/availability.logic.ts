export type SubmitConfirmationKind = 'normal' | 'below_minimum';

export type SubmitConfirmation = {
  kind: SubmitConfirmationKind;
  selectedDays: number;
  minimumDays: number;
  title: string;
  message: string;
};

export type ParticipationStatus = 'none' | 'below_minimum' | 'meets_minimum';

export type MemberParticipationSummary = {
  membershipId: string;
  memberName: string;
  markedDays: number;
  minimumDays: number;
  status: ParticipationStatus;
};

export function evaluateParticipationStatus(
  markedDays: number,
  minimumDays: number,
): ParticipationStatus {
  if (markedDays === 0) return 'none';
  if (markedDays < minimumDays) return 'below_minimum';
  return 'meets_minimum';
}

export function isEligibleForScheduling(markedDays: number): boolean {
  return markedDays > 0;
}

export function buildSubmitConfirmation(
  selectedDays: number,
  minimumDays: number,
): SubmitConfirmation {
  if (selectedDays < minimumDays) {
    return {
      kind: 'below_minimum',
      selectedDays,
      minimumDays,
      title: 'Participação abaixo do mínimo',
      message: `Você selecionou ${selectedDays} dias, o número mínimo de participação são ${minimumDays} dias. Deseja enviar mesmo assim?`,
    };
  }

  return {
    kind: 'normal',
    selectedDays,
    minimumDays,
    title: 'Confirmar disponibilidade',
    message: `Você selecionou ${selectedDays} dias. Deseja enviar sua disponibilidade?`,
  };
}

export const PARTICIPATION_STATUS_LABELS: Record<ParticipationStatus, string> = {
  none: 'Sem marcação',
  below_minimum: 'Abaixo do mínimo',
  meets_minimum: 'Mínimo atingido',
};

export const PARTICIPATION_STATUS_STYLES: Record<ParticipationStatus, string> = {
  none: 'border-zinc-200 bg-zinc-50 text-zinc-700',
  below_minimum: 'border-amber-200 bg-amber-50 text-amber-900',
  meets_minimum: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};
