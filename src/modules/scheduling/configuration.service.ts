import type { DayOfWeek, IntervalCountMode } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  buildIntervalScopeKey,
  normalizeRoleName,
  parseDateKey,
  reorderPriorityRoleIds,
  validateIntervalCount,
  validateMinimumDays,
  validateQuantity,
} from '@/modules/scheduling/configuration.logic';
import type { ScheduleConfigurationSnapshot } from '@/modules/scheduling/types';

export class ConfigurationServiceError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function getScheduleConfiguration(
  organizationId: string,
): Promise<ScheduleConfigurationSnapshot> {
  const [roles, events, dayRequirements, intervalRules, priorityRoles, participationConfig] =
    await Promise.all([
      prisma.role.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.event.findMany({
        where: { organizationId },
        orderBy: { date: 'asc' },
        select: { id: true, date: true },
      }),
      prisma.dayOfWeekRequirement.findMany({
        where: { organizationId },
        include: { role: { select: { name: true } } },
        orderBy: [{ dayOfWeek: 'asc' }, { role: { name: 'asc' } }],
      }),
      prisma.intervalRule.findMany({
        where: { organizationId },
        include: { role: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.priorityRole.findMany({
        where: { organizationId },
        include: { role: { select: { name: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.participationConfig.findUnique({
        where: { organizationId },
      }),
    ]);

  const generalIntervalRule = intervalRules.find((rule) => rule.scopeKey === 'GENERAL') ?? null;
  const roleIntervalRules = intervalRules.filter((rule) => rule.scopeKey !== 'GENERAL');

  return {
    roles,
    events: events.map((event) => ({
      id: event.id,
      date: event.date.toISOString().slice(0, 10),
    })),
    dayRequirements: dayRequirements.map((requirement) => ({
      dayOfWeek: requirement.dayOfWeek,
      roleId: requirement.roleId,
      roleName: requirement.role.name,
      quantity: requirement.quantity,
    })),
    generalIntervalRule: generalIntervalRule
      ? {
          scopeKey: generalIntervalRule.scopeKey,
          roleId: generalIntervalRule.roleId,
          roleName: generalIntervalRule.role?.name ?? null,
          intervalCount: generalIntervalRule.intervalCount,
          countMode: generalIntervalRule.countMode,
        }
      : null,
    roleIntervalRules: roleIntervalRules.map((rule) => ({
      scopeKey: rule.scopeKey,
      roleId: rule.roleId,
      roleName: rule.role?.name ?? null,
      intervalCount: rule.intervalCount,
      countMode: rule.countMode,
    })),
    priorityRoles: priorityRoles.map((priorityRole) => ({
      roleId: priorityRole.roleId,
      roleName: priorityRole.role.name,
      sortOrder: priorityRole.sortOrder,
    })),
    participationMinimumDays: participationConfig?.minimumDays ?? null,
  };
}

export async function toggleEventDate(organizationId: string, dateKey: string): Promise<void> {
  const date = parseDateKey(dateKey);
  const existing = await prisma.event.findUnique({
    where: {
      organizationId_date: {
        organizationId,
        date,
      },
    },
  });

  if (existing) {
    await prisma.event.delete({ where: { id: existing.id } });
    return;
  }

  await prisma.event.create({
    data: {
      organizationId,
      date,
    },
  });
}

export async function createRole(organizationId: string, name: string) {
  const normalizedName = normalizeRoleName(name);
  if (!normalizedName) {
    throw new ConfigurationServiceError('Informe o nome da função.');
  }

  const duplicate = await prisma.role.findUnique({
    where: {
      organizationId_name: {
        organizationId,
        name: normalizedName,
      },
    },
  });

  if (duplicate) {
    throw new ConfigurationServiceError('Esta função já existe.');
  }

  return prisma.role.create({
    data: {
      organizationId,
      name: normalizedName,
    },
  });
}

export async function deleteRole(organizationId: string, roleId: string): Promise<void> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId },
  });

  if (!role) {
    throw new ConfigurationServiceError('Função não encontrada.');
  }

  await prisma.role.delete({ where: { id: role.id } });
}

export async function upsertDayRequirement(input: {
  organizationId: string;
  dayOfWeek: DayOfWeek;
  roleId: string;
  quantity: number;
}): Promise<void> {
  if (!validateQuantity(input.quantity)) {
    throw new ConfigurationServiceError('Quantidade inválida.');
  }

  const role = await prisma.role.findFirst({
    where: { id: input.roleId, organizationId: input.organizationId },
  });

  if (!role) {
    throw new ConfigurationServiceError('Função não encontrada.');
  }

  if (input.quantity === 0) {
    await prisma.dayOfWeekRequirement.deleteMany({
      where: {
        organizationId: input.organizationId,
        dayOfWeek: input.dayOfWeek,
        roleId: input.roleId,
      },
    });
    return;
  }

  await prisma.dayOfWeekRequirement.upsert({
    where: {
      organizationId_dayOfWeek_roleId: {
        organizationId: input.organizationId,
        dayOfWeek: input.dayOfWeek,
        roleId: input.roleId,
      },
    },
    update: { quantity: input.quantity },
    create: {
      organizationId: input.organizationId,
      dayOfWeek: input.dayOfWeek,
      roleId: input.roleId,
      quantity: input.quantity,
    },
  });
}

export async function upsertIntervalRule(input: {
  organizationId: string;
  roleId?: string | null;
  intervalCount: number;
  countMode: IntervalCountMode;
}): Promise<void> {
  if (!validateIntervalCount(input.intervalCount)) {
    throw new ConfigurationServiceError('Intervalo inválido.');
  }

  const scopeKey = buildIntervalScopeKey(input.roleId);

  if (scopeKey !== 'GENERAL') {
    const role = await prisma.role.findFirst({
      where: { id: input.roleId!, organizationId: input.organizationId },
    });
    if (!role) {
      throw new ConfigurationServiceError('Função não encontrada.');
    }
  }

  await prisma.intervalRule.upsert({
    where: {
      organizationId_scopeKey: {
        organizationId: input.organizationId,
        scopeKey,
      },
    },
    update: {
      intervalCount: input.intervalCount,
      countMode: input.countMode,
      roleId: input.roleId ?? null,
    },
    create: {
      organizationId: input.organizationId,
      scopeKey,
      roleId: input.roleId ?? null,
      intervalCount: input.intervalCount,
      countMode: input.countMode,
    },
  });
}

export async function removeIntervalRule(input: {
  organizationId: string;
  roleId?: string | null;
}): Promise<void> {
  const scopeKey = buildIntervalScopeKey(input.roleId);
  await prisma.intervalRule.deleteMany({
    where: {
      organizationId: input.organizationId,
      scopeKey,
    },
  });
}

export async function setPriorityRoleOrder(
  organizationId: string,
  orderedRoleIds: string[],
): Promise<void> {
  const uniqueRoleIds = [...new Set(orderedRoleIds)];
  if (uniqueRoleIds.length !== orderedRoleIds.length) {
    throw new ConfigurationServiceError('Lista de prioridades inválida.');
  }

  await prisma.$transaction([
    prisma.priorityRole.deleteMany({ where: { organizationId } }),
    ...orderedRoleIds.map((roleId, index) =>
      prisma.priorityRole.create({
        data: {
          organizationId,
          roleId,
          sortOrder: index + 1,
        },
      }),
    ),
  ]);
}

export async function addPriorityRole(organizationId: string, roleId: string): Promise<void> {
  const role = await prisma.role.findFirst({
    where: { id: roleId, organizationId },
  });

  if (!role) {
    throw new ConfigurationServiceError('Função não encontrada.');
  }

  const existing = await prisma.priorityRole.findUnique({
    where: {
      organizationId_roleId: {
        organizationId,
        roleId,
      },
    },
  });

  if (existing) {
    throw new ConfigurationServiceError('Esta função já está na lista de prioridade.');
  }

  const last = await prisma.priorityRole.findFirst({
    where: { organizationId },
    orderBy: { sortOrder: 'desc' },
  });

  await prisma.priorityRole.create({
    data: {
      organizationId,
      roleId,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

export async function removePriorityRole(organizationId: string, roleId: string): Promise<void> {
  const priorities = await prisma.priorityRole.findMany({
    where: { organizationId },
    orderBy: { sortOrder: 'asc' },
  });

  const nextOrder = priorities.filter((item) => item.roleId !== roleId).map((item) => item.roleId);

  await setPriorityRoleOrder(organizationId, nextOrder);
}

export async function movePriorityRole(input: {
  organizationId: string;
  roleId: string;
  direction: 'up' | 'down';
}): Promise<void> {
  const priorities = await prisma.priorityRole.findMany({
    where: { organizationId: input.organizationId },
    orderBy: { sortOrder: 'asc' },
  });

  const currentRoleIds = priorities.map((item) => item.roleId);
  const nextRoleIds = reorderPriorityRoleIds(currentRoleIds, input.roleId, input.direction);

  if (nextRoleIds.join(',') === currentRoleIds.join(',')) {
    return;
  }

  await setPriorityRoleOrder(input.organizationId, nextRoleIds);
}

export async function setParticipationMinimum(input: {
  organizationId: string;
  minimumDays: number;
}): Promise<void> {
  if (!validateMinimumDays(input.minimumDays)) {
    throw new ConfigurationServiceError('Mínimo de participação inválido.');
  }

  await prisma.participationConfig.upsert({
    where: { organizationId: input.organizationId },
    update: { minimumDays: input.minimumDays },
    create: {
      organizationId: input.organizationId,
      minimumDays: input.minimumDays,
    },
  });
}
