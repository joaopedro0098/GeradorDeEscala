import type { DayOfWeek } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import {
  normalizeRoleName,
  parseDateKey,
  reorderPriorityRoleIds,
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
  await ensureAllRolesInPriority(organizationId);

  const [roles, events, dayRequirements, priorityRoles, participationConfig] = await Promise.all([
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
    prisma.priorityRole.findMany({
      where: { organizationId },
      include: { role: { select: { name: true } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.participationConfig.findUnique({
      where: { organizationId },
    }),
  ]);

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
    priorityRoles: priorityRoles.map((priorityRole) => ({
      roleId: priorityRole.roleId,
      roleName: priorityRole.role.name,
      sortOrder: priorityRole.sortOrder,
    })),
    participationMinimumDays: participationConfig?.minimumDays ?? null,
  };
}

/** Every role belongs in the priority ranking; missing ones are appended at the end. */
async function ensureAllRolesInPriority(organizationId: string): Promise<void> {
  const [roles, priorities] = await Promise.all([
    prisma.role.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }),
    prisma.priorityRole.findMany({
      where: { organizationId },
      orderBy: { sortOrder: 'asc' },
      select: { roleId: true, sortOrder: true },
    }),
  ]);

  const ranked = new Set(priorities.map((item) => item.roleId));
  const missing = roles.filter((role) => !ranked.has(role.id));
  if (missing.length === 0) return;

  let nextOrder = (priorities[priorities.length - 1]?.sortOrder ?? 0) + 1;
  await prisma.priorityRole.createMany({
    data: missing.map((role) => {
      const sortOrder = nextOrder;
      nextOrder += 1;
      return { organizationId, roleId: role.id, sortOrder };
    }),
  });
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

  const role = await prisma.role.create({
    data: {
      organizationId,
      name: normalizedName,
    },
  });

  await addPriorityRole(organizationId, role.id);
  return role;
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

export async function upsertDayRequirementsForDay(input: {
  organizationId: string;
  dayOfWeek: DayOfWeek;
  requirements: Array<{ roleId: string; quantity: number }>;
}): Promise<void> {
  for (const requirement of input.requirements) {
    await upsertDayRequirement({
      organizationId: input.organizationId,
      dayOfWeek: input.dayOfWeek,
      roleId: requirement.roleId,
      quantity: requirement.quantity,
    });
  }
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
