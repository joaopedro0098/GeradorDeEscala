import { describe, expect, it } from 'vitest';
import { buildSubmitConfirmation } from '@/modules/availability/availability.logic';

describe('availability.logic', () => {
  describe('buildSubmitConfirmation', () => {
    it('shows below-minimum warning with exact spec wording', () => {
      const confirmation = buildSubmitConfirmation(2, 4);

      expect(confirmation.kind).toBe('below_minimum');
      expect(confirmation.message).toBe(
        'Você selecionou 2 dias, o número mínimo de participação são 4 dias. Deseja enviar mesmo assim?',
      );
    });

    it('shows normal confirmation when minimum is met', () => {
      const confirmation = buildSubmitConfirmation(4, 4);

      expect(confirmation.kind).toBe('normal');
      expect(confirmation.message).toBe(
        'Você selecionou 4 dias. Deseja enviar sua disponibilidade?',
      );
    });

    it('shows normal confirmation when minimum is zero', () => {
      const confirmation = buildSubmitConfirmation(0, 0);

      expect(confirmation.kind).toBe('normal');
      expect(confirmation.message).toBe(
        'Você selecionou 0 dias. Deseja enviar sua disponibilidade?',
      );
    });
  });
});
