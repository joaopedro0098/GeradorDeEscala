/**
 * Fase 10 — smoke test do caminho crítico ponta a ponta.
 *
 * IMPORTANTE: este projeto não tem Playwright/Cypress nem um banco de dados
 * de teste dedicado (ver README — apenas Vitest + Testing Library, e um
 * único DATABASE_URL/DIRECT_URL configurados em `.env`, apontando para o
 * Postgres de desenvolvimento no Supabase). Por isso este não é um teste de
 * navegador: ele exercita a camada de serviço (a mesma usada pelas server
 * actions) direto contra esse banco real, cobrindo o fluxo completo:
 *
 *   cadastro (admin cria organização + membro se cadastra com invite code)
 *   → aprovação de membro
 *   → marcação de disponibilidade
 *   → configuração mínima (função, requisito do dia da semana, evento)
 *   → geração de escala
 *   → publicação
 *   → visualização pelo membro (slot source = working, live unificado)
 *   → edição manual de slot (isManual = true)
 *   → regeneração com keep_manual (slot manual preservado)
 *   → undo da última geração
 *   → leitura offline (cache local da última escala vista)
 *
 * Todos os dados são criados sob uma organização isolada com nome/e-mails
 * únicos por execução e removidos no `afterAll` (delete da Organization
 * cascade-deleta tudo abaixo dela; os dois Users são apagados à parte).
 * Se o banco não estiver acessível, os testes falham explicitamente (não
 * há fallback silencioso) — rode com uma `.env` válida, como o app real.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import {
  approveMembership,
  createOrganizationForAdmin,
  registerWithInviteCode,
} from '@/modules/auth/auth.service';
import { hashPassword } from '@/modules/auth/password';
import { toggleMemberAvailability } from '@/modules/availability/availability.service';
import {
  createRole,
  toggleEventDate,
  upsertDayRequirement,
} from '@/modules/scheduling/configuration.service';
import {
  generateSchedule,
  getScheduleOverviewForAdmin,
  getScheduleOverviewForMember,
  publishSchedule,
  setScheduleSlotAssignment,
  undoLastGeneration,
} from '@/modules/scheduling/schedule.service';
import { resolveOfflineScheduleView, saveLastScheduleView } from '@/lib/schedule-offline-cache';
import { getDayOfWeekFromDateKey } from '@/modules/scheduling/configuration.logic';

const RUN_ID = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Fixed future month so the test is stable regardless of when it runs.
const YEAR = 2027;
const MONTH = 3;
const EVENT_DATE_KEY = `${YEAR}-${String(MONTH).padStart(2, '0')}-07`; // 2027-03-07 is a Sunday
const EVENT_DAY_OF_WEEK = getDayOfWeekFromDateKey(EVENT_DATE_KEY);

type Ctx = {
  organizationId: string;
  inviteCode: string;
  adminUserId: string;
  memberUserId: string;
  memberMembershipId: string;
  secondMemberUserId: string;
  secondMemberMembershipId: string;
  roleId: string;
  eventId: string;
};

const ctx: Partial<Ctx> = {};

const STEP_TIMEOUT_MS = 20000;

describe('Fase 10 — smoke test do caminho crítico (cadastro → ... → offline)', () => {
  beforeAll(async () => {
    const dbReachable = await prisma.organization
      .count()
      .then(() => true)
      .catch(() => false);

    if (!dbReachable) {
      throw new Error(
        'Banco de dados indisponível para o smoke test. Configure DATABASE_URL/DIRECT_URL em .env (mesmo banco usado por `npm run dev`).',
      );
    }
  }, STEP_TIMEOUT_MS);

  afterAll(async () => {
    if (ctx.organizationId) {
      await prisma.organization.delete({ where: { id: ctx.organizationId } }).catch(() => {});
    }
    const userIds = [ctx.adminUserId, ctx.memberUserId, ctx.secondMemberUserId].filter(
      (id): id is string => Boolean(id),
    );
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  }, STEP_TIMEOUT_MS);

  it(
    '1. cadastro — admin cria a organização',
    async () => {
      const passwordHash = await hashPassword('senha-super-secreta-123');
      const admin = await prisma.user.create({
        data: {
          email: `${RUN_ID}-admin@example.com`,
          name: 'Admin Smoke',
          passwordHash,
        },
      });
      ctx.adminUserId = admin.id;

      const result = await createOrganizationForAdmin({
        userId: admin.id,
        organizationName: `Organização Smoke ${RUN_ID}`,
      });

      expect(result.type).toBe('session');
      if (result.type !== 'session') throw new Error('unreachable');
      ctx.organizationId = result.payload.organizationId;

      const organization = await prisma.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      ctx.inviteCode = organization.inviteCode;
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '2. cadastro — membro se registra com o código de convite',
    async () => {
      await registerWithInviteCode({
        name: 'Membro Smoke',
        email: `${RUN_ID}-membro@example.com`,
        password: 'senha-super-secreta-123',
        inviteCode: ctx.inviteCode!,
      });

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: `${RUN_ID}-membro@example.com` },
        include: { memberships: true },
      });
      ctx.memberUserId = user.id;
      ctx.memberMembershipId = user.memberships[0].id;

      expect(user.memberships[0].status).toBe('PENDING');
      expect(user.memberships[0].organizationId).toBe(ctx.organizationId);
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '3. aprovação de membro pelo admin',
    async () => {
      await approveMembership(ctx.memberMembershipId!, ctx.organizationId!);

      const membership = await prisma.membership.findUniqueOrThrow({
        where: { id: ctx.memberMembershipId },
      });
      expect(membership.status).toBe('ACTIVE');
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '4. configuração — função, requisito do dia da semana e evento do período',
    async () => {
      const role = await createRole(ctx.organizationId!, 'Vocal');
      ctx.roleId = role.id;

      await upsertDayRequirement({
        organizationId: ctx.organizationId!,
        dayOfWeek: EVENT_DAY_OF_WEEK,
        roleId: ctx.roleId,
        quantity: 1,
      });

      await toggleEventDate(ctx.organizationId!, EVENT_DATE_KEY);
      const event = await prisma.event.findFirstOrThrow({
        where: {
          organizationId: ctx.organizationId,
          date: new Date(`${EVENT_DATE_KEY}T00:00:00.000Z`),
        },
      });
      ctx.eventId = event.id;

      await prisma.membershipRolePreference.create({
        data: { membershipId: ctx.memberMembershipId!, roleId: ctx.roleId, sortOrder: 1 },
      });
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '5. marcação de disponibilidade pelo membro',
    async () => {
      const marked = await toggleMemberAvailability({
        membershipId: ctx.memberMembershipId!,
        organizationId: ctx.organizationId!,
        eventId: ctx.eventId!,
      });

      expect(marked).toBe(true);
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '6. geração de escala pelo admin',
    async () => {
      const result = await generateSchedule(ctx.organizationId!, YEAR, MONTH);

      expect(result.status).toBe('COMPLETE');
      expect(result.blankCount).toBe(0);

      const overview = await getScheduleOverviewForAdmin(ctx.organizationId!, YEAR, MONTH);
      expect(overview?.status).toBe('DRAFT');
      expect(overview?.events[0]?.slots[0]?.membershipId).toBe(ctx.memberMembershipId);
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '7. publicação da escala',
    async () => {
      await publishSchedule(ctx.organizationId!, YEAR, MONTH);

      const overview = await getScheduleOverviewForAdmin(ctx.organizationId!, YEAR, MONTH);
      expect(overview?.status).toBe('PUBLISHED');
      expect(overview?.hasPublishedGaps).toBe(false);
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '8. visualização pelo membro (live unificado, sem draft pendente)',
    async () => {
      const overview = await getScheduleOverviewForMember(ctx.organizationId!, YEAR, MONTH);

      expect(overview).not.toBeNull();
      expect(overview?.hasPendingDraft).toBe(false);
      expect(overview?.events[0]?.slots[0]?.memberName).toBe('Membro Smoke');
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '9. edição manual de slot pelo admin (isManual = true, live unificado)',
    async () => {
      const secondPasswordHash = await hashPassword('senha-super-secreta-123');
      const secondUser = await prisma.user.create({
        data: {
          email: `${RUN_ID}-membro2@example.com`,
          name: 'Membro Dois Smoke',
          passwordHash: secondPasswordHash,
        },
      });
      ctx.secondMemberUserId = secondUser.id;

      const secondMembership = await prisma.membership.create({
        data: { userId: secondUser.id, organizationId: ctx.organizationId!, status: 'ACTIVE' },
      });
      ctx.secondMemberMembershipId = secondMembership.id;

      await prisma.membershipRolePreference.create({
        data: { membershipId: secondMembership.id, roleId: ctx.roleId!, sortOrder: 1 },
      });
      await toggleMemberAvailability({
        membershipId: secondMembership.id,
        organizationId: ctx.organizationId!,
        eventId: ctx.eventId!,
      });

      const slot = await prisma.scheduleSlot.findFirstOrThrow({
        where: { schedule: { organizationId: ctx.organizationId, year: YEAR, month: MONTH } },
      });

      await setScheduleSlotAssignment(ctx.organizationId!, slot.id, ctx.secondMemberMembershipId);

      const updatedSlot = await prisma.scheduleSlot.findUniqueOrThrow({ where: { id: slot.id } });
      expect(updatedSlot.isManual).toBe(true);
      expect(updatedSlot.membershipId).toBe(ctx.secondMemberMembershipId);

      // Live unified: member overview reflects the manual edit immediately,
      // without any publish step (spec — edição manual imediata).
      const memberOverview = await getScheduleOverviewForMember(ctx.organizationId!, YEAR, MONTH);
      expect(memberOverview?.events[0]?.slots[0]?.memberName).toBe('Membro Dois Smoke');
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '10. regeneração com keep_manual preserva o slot manual',
    async () => {
      const result = await generateSchedule(ctx.organizationId!, YEAR, MONTH, { keepManual: true });
      expect(result.status).toBe('COMPLETE');

      const overview = await getScheduleOverviewForAdmin(ctx.organizationId!, YEAR, MONTH);
      // Regenerating a published-live schedule opens a pending draft (v3);
      // manual pin must survive untouched in the new working copy.
      expect(overview?.hasPendingDraft).toBe(true);
      expect(overview?.events[0]?.slots[0]?.membershipId).toBe(ctx.secondMemberMembershipId);
      expect(overview?.events[0]?.slots[0]?.isManual).toBe(true);
      expect(overview?.hasPreviousVersion).toBe(true);

      // Members still see the pre-regeneration published state (frozen snapshot).
      const memberOverview = await getScheduleOverviewForMember(ctx.organizationId!, YEAR, MONTH);
      expect(memberOverview?.events[0]?.slots[0]?.memberName).toBe('Membro Dois Smoke');
    },
    STEP_TIMEOUT_MS,
  );

  it(
    '11. undo da última geração restaura a versão anterior',
    async () => {
      await undoLastGeneration(ctx.organizationId!, YEAR, MONTH);

      const overview = await getScheduleOverviewForAdmin(ctx.organizationId!, YEAR, MONTH);
      expect(overview?.status).toBe('DRAFT');
      // Undo swaps back to the state saved right before the keep_manual
      // regenerate — i.e. the manually-edited, already-published slot.
      expect(overview?.events[0]?.slots[0]?.membershipId).toBe(ctx.secondMemberMembershipId);
      expect(overview?.hasPreviousVersion).toBe(true);
    },
    STEP_TIMEOUT_MS,
  );

  it('12. leitura offline — última escala vista fica acessível sem rede', () => {
    window.localStorage.clear();

    const onlineOverview = {
      scheduleId: 'sched-smoke',
      year: YEAR,
      month: MONTH,
      status: 'PUBLISHED' as const,
      generationStatus: 'COMPLETE' as const,
      hasPublishedGaps: false,
      publishedAt: new Date().toISOString(),
      hasPendingDraft: false,
      hasPreviousVersion: true,
      hasManualSlots: true,
      memberVisiblePublishedAt: new Date().toISOString(),
      events: [],
      memberCounts: [],
    };

    saveLastScheduleView('member', ctx.organizationId!, {
      year: YEAR,
      month: MONTH,
      overview: onlineOverview,
    });

    const offlineResolved = resolveOfflineScheduleView({
      audience: 'member',
      organizationId: ctx.organizationId!,
      year: YEAR,
      month: MONTH,
      serverOverview: null,
      isOnline: false,
    });

    expect(offlineResolved.mode).toBe('cached');
    expect(offlineResolved.overview?.scheduleId).toBe('sched-smoke');
    expect(offlineResolved.cachedAt).toBeTruthy();
  });
});
