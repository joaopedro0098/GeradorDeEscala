import { describe, expect, it } from 'vitest';
import {
  buildSubmitConfirmation,
  evaluateParticipationStatus,
  isEligibleForScheduling,
} from '@/modules/availability/availability.logic';

describe('availability.logic', () => {
  describe('evaluateParticipationStatus', () => {
    it('returns none when no days are marked', () => {
      expect(evaluateParticipationStatus(0, 4)).toBe('none');
    });

    it('returns below_minimum when marked days are below the minimum', () => {
      expect(evaluateParticipationStatus(2, 4)).toBe('below_minimum');
    });

    it('returns meets_minimum when marked days reach the minimum', () => {
      expect(evaluateParticipationStatus(4, 4)).toBe('meets_minimum');
    });

    it('returns meets_minimum when marked days exceed the minimum', () => {
      expect(evaluateParticipationStatus(6, 4)).toBe('meets_minimum');
    });
  });

  describe('isEligibleForScheduling', () => {
    it('excludes members with no marked days', () => {
      expect(isEligibleForScheduling(0)).toBe(false);
    });

    it('includes members with at least one marked day', () => {
      expect(isEligibleForScheduling(1)).toBe(true);
    });
  });

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
