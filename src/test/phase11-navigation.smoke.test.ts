/**
 * Fase 11 — smoke do fluxo de navegação multi-organização.
 *
 * Cobre a cadeia de serviço por trás de /organizacoes e do botão
 * "Ir para Admin agora" (sem Playwright):
 *
 *   cadastro sem organização
 *   → resolveDefaultContext = no_active_organization
 *   → criar primeira organização (com plano) + sessão admin
 *   → criar organização adicional SEM trocar contexto
 *   → trocar manualmente para a segunda org (estilo Instagram)
 *   → promover membro a admin
 *   → buildSessionForMembership(admin) = "Ir para Admin agora" sem relogin
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { resolveDefaultContext } from '@/modules/auth/auth-logic';
import {
  approveMembership,
  buildSessionForMembership,
  createOrganizationForAdmin,
  joinOrganizationWithInviteCode,
  listMembershipsForUser,
  promoteMemberToAdmin,
  registerUser,
} from '@/modules/auth/auth.service';

const RUN_ID = `nav-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const STEP_TIMEOUT_MS = 20000;

type Ctx = {
  userId: string;
  memberUserId: string;
  firstOrgId: string;
  firstMembershipId: string;
  secondOrgId: string;
  secondMembershipId: string;
  memberMembershipId: string;
};

const ctx: Partial<Ctx> = {};

describe('Fase 11 — smoke navegação multi-org / troca sem logout', () => {
  beforeAll(async () => {
    const ok = await prisma.organization
      .count()
      .then(() => true)
      .catch(() => false);
    if (!ok) {
      throw new Error('Banco indisponível para o smoke de navegação.');
    }
  }, STEP_TIMEOUT_MS);

  afterAll(async () => {
    for (const orgId of [ctx.firstOrgId, ctx.secondOrgId]) {
      if (orgId) {
        await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
      }
    }
    const userIds = [ctx.userId, ctx.memberUserId].filter((id): id is string => Boolean(id));
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  }, STEP_TIMEOUT_MS);

  it(
    '1. cadastro sem organização → no_active_organization',
    async () => {
      await registerUser({
        name: 'Nav User',
        email: `${RUN_ID}@example.com`,
        password: 'senha-super-secreta-123',
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: `${RUN_ID}@example.com` },
      });
      ctx.userId = user.id;

      const memberships = await listMembershipsForUser(user.id);
      expect(memberships).toHaveLength(0);
      expect(resolveDefaultContext(user.id, memberships)).toEqual({
        type: 'no_active_organization',
      });
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '2. criar primeira organização com plano → sessão admin',
    async () => {
      const created = await createOrganizationForAdmin({
        userId: ctx.userId!,
        organizationName: `Nav Org A ${RUN_ID}`,
        planTier: 'BASIC',
      });

      ctx.firstOrgId = created.organizationId;
      ctx.firstMembershipId = created.membershipId;

      const org = await prisma.organization.findUniqueOrThrow({
        where: { id: created.organizationId },
      });
      expect(org.planTier).toBe('BASIC');
      expect(org.subscriptionStatus).toBe('TRIAL');
      expect(org.trialStartedAt).toBeInstanceOf(Date);

      const session = await buildSessionForMembership({
        userId: ctx.userId!,
        membershipId: created.membershipId,
        loginMode: 'admin',
      });

      expect(session).toMatchObject({
        organizationId: created.organizationId,
        organizationName: created.organizationName,
        loginMode: 'admin',
        isAdmin: true,
        isPrimaryAdmin: true,
      });
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '3. criar organização adicional NÃO troca o contexto atual',
    async () => {
      const created = await createOrganizationForAdmin({
        userId: ctx.userId!,
        organizationName: `Nav Org B ${RUN_ID}`,
        planTier: 'PRO',
      });

      ctx.secondOrgId = created.organizationId;
      ctx.secondMembershipId = created.membershipId;

      const memberships = await listMembershipsForUser(ctx.userId!);
      expect(memberships.filter((m) => m.status === 'ACTIVE')).toHaveLength(2);

      // Simula "permanecer na org atual": a sessão que o usuário já tinha
      // continua válida apontando para a primeira org.
      const stillOnFirst = await buildSessionForMembership({
        userId: ctx.userId!,
        membershipId: ctx.firstMembershipId!,
        loginMode: 'admin',
      });
      expect(stillOnFirst.organizationId).toBe(ctx.firstOrgId);

      const secondOrg = await prisma.organization.findUniqueOrThrow({
        where: { id: created.organizationId },
      });
      expect(secondOrg.planTier).toBe('PRO');
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '4. trocar manualmente para a segunda organização (estilo Instagram)',
    async () => {
      const switched = await buildSessionForMembership({
        userId: ctx.userId!,
        membershipId: ctx.secondMembershipId!,
        loginMode: 'admin',
      });

      expect(switched.organizationId).toBe(ctx.secondOrgId);
      expect(switched.organizationName).toContain('Nav Org B');
      expect(switched.loginMode).toBe('admin');
      expect(switched.isPrimaryAdmin).toBe(true);
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '5. promover membro a admin e "Ir para Admin agora" sem relogin',
    async () => {
      await registerUser({
        name: 'Nav Member',
        email: `${RUN_ID}-member@example.com`,
        password: 'senha-super-secreta-123',
      });
      const member = await prisma.user.findUniqueOrThrow({
        where: { email: `${RUN_ID}-member@example.com` },
      });
      ctx.memberUserId = member.id;

      const firstOrg = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.firstOrgId },
      });

      await joinOrganizationWithInviteCode({
        userId: member.id,
        inviteCode: firstOrg.inviteCode,
      });

      const pending = await prisma.membership.findFirstOrThrow({
        where: { userId: member.id, organizationId: ctx.firstOrgId },
      });
      ctx.memberMembershipId = pending.id;
      expect(pending.status).toBe('PENDING');

      await approveMembership(pending.id, ctx.firstOrgId!);

      await promoteMemberToAdmin({
        organizationId: ctx.firstOrgId!,
        membershipId: pending.id,
      });

      const promoted = await prisma.membership.findUniqueOrThrow({
        where: { id: pending.id },
      });
      expect(promoted.isAdmin).toBe(true);
      expect(promoted.isPrimaryAdmin).toBe(false);

      const notification = await prisma.notification.findFirstOrThrow({
        where: { membershipId: pending.id, type: 'ADMIN_PROMOTED' },
      });
      expect(notification.message).toMatch(/Ver como Admin/i);

      // Membro estava em loginMode user; "Ir para Admin agora" só reescreve o cookie.
      const asMember = await buildSessionForMembership({
        userId: member.id,
        membershipId: pending.id,
        loginMode: 'user',
      });
      expect(asMember.loginMode).toBe('user');
      expect(asMember.isAdmin).toBe(true);

      const asAdmin = await buildSessionForMembership({
        userId: member.id,
        membershipId: pending.id,
        loginMode: 'admin',
      });
      expect(asAdmin.loginMode).toBe('admin');
      expect(asAdmin.organizationId).toBe(ctx.firstOrgId);
      expect(asAdmin.isPrimaryAdmin).toBe(false);
    },
    STEP_TIMEOUT_MS,
  );
});
