export type SubmitConfirmationKind = 'normal' | 'below_minimum';

export type SubmitConfirmation = {
  kind: SubmitConfirmationKind;
  selectedDays: number;
  minimumDays: number;
  title: string;
  message: string;
};

/** Relative to the org minimum: below / exactly at / above. */
export type ParticipationStatus = 'below' | 'exact' | 'above';

export type MemberParticipationSummary = {
  membershipId: string;
  memberName: string;
  profilePhotoUrl: string | null;
  markedDays: number;
  minimumDays: number;
  status: ParticipationStatus;
};

export function evaluateParticipationStatus(
  markedDays: number,
  minimumDays: number,
): ParticipationStatus {
  if (markedDays < minimumDays) return 'below';
  if (markedDays > minimumDays) return 'above';
  return 'exact';
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
