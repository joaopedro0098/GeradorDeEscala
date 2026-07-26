import {
  DayOfWeek,
  MembershipStatus,
  NotificationType,
  PrismaClient,
  ScheduleGenerationStatus,
  ScheduleStatus,
} from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.notification.deleteMany();
  await prisma.scheduleSlot.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.membershipRolePreference.deleteMany();
  await prisma.dayOfWeekRequirement.deleteMany();
  await prisma.priorityRole.deleteMany();
  await prisma.participationConfig.deleteMany();
  await prisma.event.deleteMany();
  await prisma.role.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      passwordHash: '$2b$10$seedplaceholderhash000000000000000000000000000',
      name: 'Admin Seed',
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@example.com',
      passwordHash: '$2b$10$seedplaceholderhash000000000000000000000000000',
      name: 'Member Seed',
    },
  });

  const organization = await prisma.organization.create({
    data: {
      name: 'Igreja Seed',
      inviteCode: 'SEED-LOUVOR',
    },
  });

  const adminMembership = await prisma.membership.create({
    data: {
      userId: admin.id,
      organizationId: organization.id,
      status: MembershipStatus.ACTIVE,
      isAdmin: true,
      isPrimaryAdmin: true,
    },
  });

  const memberMembership = await prisma.membership.create({
    data: {
      userId: member.id,
      organizationId: organization.id,
      status: MembershipStatus.ACTIVE,
    },
  });

  const [drumsRole, vocalsRole] = await Promise.all([
    prisma.role.create({
      data: { organizationId: organization.id, name: 'Bateria' },
    }),
    prisma.role.create({
      data: { organizationId: organization.id, name: 'Vocal' },
    }),
  ]);

  await prisma.membershipRolePreference.createMany({
    data: [
      { membershipId: memberMembership.id, roleId: drumsRole.id, sortOrder: 1 },
      { membershipId: memberMembership.id, roleId: vocalsRole.id, sortOrder: 2 },
    ],
  });

  await prisma.participationConfig.create({
    data: {
      organizationId: organization.id,
      minimumDays: 4,
    },
  });

  await prisma.priorityRole.create({
    data: {
      organizationId: organization.id,
      roleId: vocalsRole.id,
      sortOrder: 1,
    },
  });

  await prisma.dayOfWeekRequirement.create({
    data: {
      organizationId: organization.id,
      dayOfWeek: DayOfWeek.SUNDAY,
      roleId: drumsRole.id,
      quantity: 1,
    },
  });

  const event = await prisma.event.create({
    data: {
      organizationId: organization.id,
      date: new Date('2026-08-03'),
    },
  });

  await prisma.availability.create({
    data: {
      membershipId: memberMembership.id,
      eventId: event.id,
    },
  });

  const schedule = await prisma.schedule.create({
    data: {
      organizationId: organization.id,
      year: 2026,
      month: 8,
      status: ScheduleStatus.DRAFT,
      generationStatus: ScheduleGenerationStatus.COMPLETE,
    },
  });

  await prisma.scheduleSlot.create({
    data: {
      scheduleId: schedule.id,
      eventId: event.id,
      roleId: drumsRole.id,
      membershipId: memberMembership.id,
      slotIndex: 0,
    },
  });

  await prisma.notification.create({
    data: {
      membershipId: adminMembership.id,
      type: NotificationType.ADMIN_PROMOTED,
      title: 'Promoção a admin',
      message: 'Você foi promovido a Admin.',
    },
  });

  console.log('Seed completed:', {
    organization: organization.inviteCode,
    admin: admin.email,
    member: member.email,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
