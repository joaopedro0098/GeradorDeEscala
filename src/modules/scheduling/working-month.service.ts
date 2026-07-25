import { prisma } from '@/lib/prisma';
import { formatDateKey, parseDateKey } from '@/modules/scheduling/configuration.logic';
import { ConfigurationServiceError } from '@/modules/scheduling/configuration.service';
import {
  compareYearMonth,
  currentYearMonth,
  inheritEventDateKeys,
  isValidYearMonth,
  resolveWorkingMonth,
  shiftYearMonth,
  type YearMonth,
} from '@/modules/scheduling/working-month.logic';

function monthRange({ year, month }: YearMonth): { gte: Date; lt: Date } {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1)),
    lt: new Date(Date.UTC(year, month, 1)),
  };
}

async function listEventDateKeys(organizationId: string, target: YearMonth): Promise<string[]> {
  const events = await prisma.event.findMany({
    where: { organizationId, date: monthRange(target) },
    orderBy: { date: 'asc' },
    select: { date: true },
  });
  return events.map((event) => formatDateKey(event.date));
}

/** Working month as stored (or as it must be read today), without any writes. */
export async function getWorkingMonth(organizationId: string): Promise<YearMonth> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { workingYear: true, workingMonth: true },
  });

  return resolveWorkingMonth(
    { year: organization.workingYear, month: organization.workingMonth },
    new Date(),
  );
}

/**
 * Copies the previous month's recurring event days into the target month, but
 * only while the target has no events at all. Called when the working month
 * changes, never on plain reads — an admin who cleared every day on purpose
 * would otherwise get them back on the next page load.
 */
async function inheritEventDatesFromPreviousMonth(
  organizationId: string,
  target: YearMonth,
): Promise<void> {
  const existing = await prisma.event.count({
    where: { organizationId, date: monthRange(target) },
  });
  if (existing > 0) return;

  const source = shiftYearMonth(target, -1);
  const sourceDateKeys = await listEventDateKeys(organizationId, source);
  if (sourceDateKeys.length === 0) return;

  const inherited = inheritEventDateKeys({ source, sourceDateKeys, target });
  if (inherited.length === 0) return;

  await prisma.event.createMany({
    data: inherited.map((dateKey) => ({ organizationId, date: parseDateKey(dateKey) })),
    skipDuplicates: true,
  });
}

async function moveWorkingMonth(organizationId: string, target: YearMonth): Promise<void> {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { workingYear: target.year, workingMonth: target.month },
  });
  await inheritEventDatesFromPreviousMonth(organizationId, target);
}

/** Admin-driven change of the month the whole organization works on. */
export async function setWorkingMonth(organizationId: string, target: YearMonth): Promise<void> {
  if (!isValidYearMonth(target)) {
    throw new ConfigurationServiceError('Mês inválido.');
  }
  if (compareYearMonth(target, currentYearMonth(new Date())) < 0) {
    throw new ConfigurationServiceError('Não é possível trabalhar em meses anteriores.');
  }

  await moveWorkingMonth(organizationId, target);
}

/**
 * Working month for page loads. When the stored month has expired (or was never
 * set) it rolls forward to the current month and inherits its calendar, since
 * past months are read-only.
 */
export async function ensureWorkingMonth(organizationId: string): Promise<YearMonth> {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { workingYear: true, workingMonth: true },
  });

  const stored = { year: organization.workingYear, month: organization.workingMonth };
  const resolved = resolveWorkingMonth(stored, new Date());

  if (!isValidYearMonth(stored) || compareYearMonth(stored, resolved) !== 0) {
    await moveWorkingMonth(organizationId, resolved);
  }

  return resolved;
}
