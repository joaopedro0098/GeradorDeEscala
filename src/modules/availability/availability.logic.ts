export type SubmitConfirmationKind = 'normal' | 'below_minimum';

export type SubmitConfirmation = {
  kind: SubmitConfirmationKind;
  selectedDays: number;
  minimumDays: number;
  title: string;
  message: string;
};

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
