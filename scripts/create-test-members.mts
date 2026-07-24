import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { createTestMemberForOrganization } from '../src/modules/auth/auth.service.ts';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const members = [
  { name: 'Gabriel Guita', email: 'email4@gmail.com', password: 'teste1234' },
  { name: 'Luzineide', email: 'email5@gmail.com', password: 'teste1234' },
  { name: 'Rafael Moura', email: 'email6@gmail.com', password: 'teste1234' },
  { name: 'Xande', email: 'email7@gmail.com', password: 'teste1234' },
  { name: 'André Luiz', email: 'email8@gmail.com', password: 'teste1234' },
  { name: 'Breno', email: 'email9@gmail.com', password: 'teste1234' },
  { name: 'Samuel Coimbra', email: 'email10@gmail.com', password: 'teste1234' },
  { name: 'Daniel Goes', email: 'email11@gmail.com', password: 'teste1234' },
  { name: 'Dani filha do pastor', email: 'email12@gmail.com', password: 'teste1234' },
  { name: 'Diego', email: 'email13@gmail.com', password: 'teste1234' },
  { name: 'Edson', email: 'email14@gmail.com', password: 'teste1234' },
  { name: 'Gabriel Zanelatti', email: 'email16@gmail.com', password: 'teste1234' },
  { name: 'Gabriel Mafra', email: 'email17@gmail.com', password: 'teste1234' },
  { name: 'Mauro', email: 'email18@gmail.com', password: 'teste1234' },
  { name: 'Pr Maurício', email: 'email19@gmail.com', password: 'teste1234' },
  { name: 'Samuca', email: 'email20@gmail.com', password: 'teste1234' },
  { name: 'Tati', email: 'email21@gmail.com', password: 'teste1234' },
  { name: 'Vagner', email: 'email22@gmail.com', password: 'teste1234' },
  { name: 'Camila', email: 'email23@gmail.com', password: 'teste1234' },
  { name: 'Cláudinéia', email: 'email24@gmail.com', password: 'teste1234' },
  { name: 'Érica', email: 'email25@gmail.com', password: 'teste1234' },
  { name: 'Isabelly', email: 'email26@gmail.com', password: 'teste1234' },
  { name: 'Karina', email: 'email27@gmail.com', password: 'teste1234' },
  { name: 'Leticia Sayuri', email: 'email28@gmail.com', password: 'teste1234' },
  { name: 'Lucas', email: 'email29@gmail.com', password: 'teste1234' },
  { name: 'Luis Henrique', email: 'email30@gmail.com', password: 'teste1234' },
  { name: 'Luana', email: 'email31@gmail.com', password: 'teste1234' },
  { name: 'Rafael Maurinho', email: 'email32@gmail.com', password: 'teste1234' },
  { name: 'Raphael Pimentel', email: 'email33@gmail.com', password: 'teste1234' },
  { name: 'Roberto', email: 'email34@gmail.com', password: 'teste1234' },
  { name: 'William', email: 'email35@gmail.com', password: 'teste1234' },
  { name: 'Yasmin', email: 'email36@gmail.com', password: 'teste1234' },
];

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: 'joaopedro.suporte98@gmail.com' },
    select: {
      email: true,
      memberships: {
        where: { status: 'ACTIVE', isAdmin: true },
        select: {
          organizationId: true,
          isPrimaryAdmin: true,
          organization: { select: { name: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!admin || admin.memberships.length === 0) {
    throw new Error('Admin joaopedro.suporte98@gmail.com não encontrado com organização ativa.');
  }

  const membership =
    admin.memberships.find((item) => item.isPrimaryAdmin) ?? admin.memberships[0];
  const organizationId = membership.organizationId;
  const organizationName = membership.organization.name;

  console.log(`Organização alvo: ${organizationName} (${organizationId})`);
  console.log(`Criando ${members.length} membros...\n`);

  let created = 0;
  let linked = 0;
  let failed = 0;

  for (const member of members) {
    try {
      const result = await createTestMemberForOrganization({
        organizationId,
        name: member.name,
        email: member.email,
        password: member.password,
      });
      if (result.createdUser) {
        created += 1;
        console.log(`OK criado: ${member.name} <${member.email}>`);
      } else {
        linked += 1;
        console.log(`OK vinculado: ${member.name} <${member.email}>`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`FALHOU: ${member.name} <${member.email}> — ${message}`);
    }
  }

  console.log(`\nResumo: ${created} criados, ${linked} vinculados, ${failed} falhas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
