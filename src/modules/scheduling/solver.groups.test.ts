import { describe, expect, it } from 'vitest';
import { resolveGroupPlacements } from './solver.groups';
import type {
  SolverEventInput,
  SolverGroupInput,
  SolverIntervalRuleInput,
  SolverMemberInput,
  SolverRequirementInput,
} from './solver.types';

function event(id: string, date: string): SolverEventInput {
  return { id, date, dayOfWeek: 'SUNDAY' };
}

function member(membershipId: string, roleIds: string[], availableEventIds: string[]): SolverMemberInput {
  return {
    membershipId,
    availableEventIds,
    rolePreferences: roleIds.map((roleId, index) => ({ roleId, sortOrder: index + 1 })),
  };
}

function group(groupId: string, membershipIds: string[]): SolverGroupInput {
  return { groupId, mode: 'STRICT', membershipIds };
}

describe('resolveGroupPlacements', () => {
  it('returns no pins or exclusions when there are no groups', () => {
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 1 }],
      members: [member('a', ['vocal'], ['e1'])],
      intervalRules: [],
      groups: [],
    });

    expect(result.pins).toHaveLength(0);
    expect(result.excludedMembershipIdsByEvent.size).toBe(0);
  });

  it('ignores FLEXIBLE groups entirely (no pins, no exclusions)', () => {
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['drums'], ['e1']), member('b', ['vocal'], ['e1'])],
      intervalRules: [],
      groups: [{ groupId: 'g1', mode: 'FLEXIBLE', membershipIds: ['a', 'b'] }],
    });

    expect(result.pins).toHaveLength(0);
    expect(result.excludedMembershipIdsByEvent.size).toBe(0);
  });

  it('pins a whole STRICT group together when a feasible matching exists', () => {
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['drums'], ['e1']), member('b', ['vocal'], ['e1'])],
      intervalRules: [],
      groups: [group('g1', ['a', 'b'])],
    });

    expect(result.pins).toHaveLength(2);
    const drumsPin = result.pins.find((p) => p.roleId === 'drums');
    const vocalPin = result.pins.find((p) => p.roleId === 'vocal');
    expect(drumsPin?.membershipId).toBe('a');
    expect(vocalPin?.membershipId).toBe('b');
    expect(drumsPin?.filledByGroupPin).toBe(true);
    expect(result.excludedMembershipIdsByEvent.size).toBe(0);
  });

  it('excludes the whole group from an event when one member is unavailable, without partial pinning', () => {
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['drums'], ['e1']), member('b', ['vocal'], [])],
      intervalRules: [],
      groups: [group('g1', ['a', 'b'])],
    });

    expect(result.pins).toHaveLength(0);
    expect(result.excludedMembershipIdsByEvent.get('e1')).toEqual(new Set(['a', 'b']));
  });

  it('excludes the whole group from an event when no feasible role matching exists', () => {
    // Both members only play drums, but only one drums slot is open.
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 1 }],
      members: [member('a', ['drums'], ['e1']), member('b', ['drums'], ['e1'])],
      intervalRules: [],
      groups: [group('g1', ['a', 'b'])],
    });

    expect(result.pins).toHaveLength(0);
    expect(result.excludedMembershipIdsByEvent.get('e1')).toEqual(new Set(['a', 'b']));
  });

  it('never splits the group: a matching that covers only some members is rejected entirely', () => {
    // "a" can fill drums, but "b" has no matching role available at all.
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'drums', quantity: 1 }],
      members: [member('a', ['drums'], ['e1']), member('b', ['vocal'], ['e1'])],
      intervalRules: [],
      groups: [group('g1', ['a', 'b'])],
    });

    expect(result.pins).toHaveLength(0);
    expect(result.excludedMembershipIdsByEvent.get('e1')).toEqual(new Set(['a', 'b']));
  });

  it('respects the interval rule when matching a STRICT group across events (no relaxation)', () => {
    const rule: SolverIntervalRuleInput = { roleId: null, intervalCount: 1, countMode: 'BY_EVENT' };
    const requirements: SolverRequirementInput[] = [
      { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      { eventId: 'e2', roleId: 'vocal', quantity: 1 },
    ];
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02'), event('e2', '2026-08-05')],
      requirements,
      members: [member('a', ['vocal'], ['e1', 'e2'])],
      intervalRules: [rule],
      groups: [group('g1', ['a'])],
    });

    // "a" is pinned at e1, but the interval rule blocks e2 — the group (of one)
    // is excluded from e2 rather than relaxing the interval to force it.
    expect(result.pins).toHaveLength(1);
    expect(result.pins[0].eventId).toBe('e1');
    expect(result.excludedMembershipIdsByEvent.get('e2')).toEqual(new Set(['a']));
  });

  it('does not stack two roles onto one group member even when they mark the pair as compatible', () => {
    // Only one open slot pair (drums, vocal) and a single group member who
    // could otherwise stack both — STRICT group matching never stacks.
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [
        { eventId: 'e1', roleId: 'drums', quantity: 1 },
        { eventId: 'e1', roleId: 'vocal', quantity: 1 },
      ],
      members: [member('a', ['drums', 'vocal'], ['e1']), member('b', ['drums', 'vocal'], ['e1'])],
      intervalRules: [],
      groups: [group('g1', ['a', 'b'])],
    });

    // A valid 1:1 matching exists (a->drums, b->vocal or vice-versa), so it succeeds
    // without needing to stack.
    expect(result.pins).toHaveLength(2);
    const membershipIds = result.pins.map((p) => p.membershipId).sort();
    expect(membershipIds).toEqual(['a', 'b']);
  });

  it('reserves slots consumed by an earlier group so a later group cannot reuse them at the same event', () => {
    const result = resolveGroupPlacements({
      events: [event('e1', '2026-08-02')],
      requirements: [{ eventId: 'e1', roleId: 'vocal', quantity: 2 }],
      members: [
        member('a', ['vocal'], ['e1']),
        member('b', ['vocal'], ['e1']),
        member('c', ['vocal'], ['e1']),
        member('d', ['vocal'], ['e1']),
      ],
      intervalRules: [],
      groups: [group('g1', ['a', 'b']), group('g2', ['c', 'd'])],
    });

    // Only 2 vocal slots exist; g1 claims both, leaving none for g2.
    expect(result.pins).toHaveLength(2);
    expect(result.excludedMembershipIdsByEvent.get('e1')).toEqual(new Set(['c', 'd']));
  });
});
