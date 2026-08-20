import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10);
  const currency = process.env.DEFAULT_CURRENCY ?? 'LAK';

  // ── Super admin ──────────────────────────────────────
  const adminEmail = 'admin@vangclan.local';
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash('ChangeMe123!', saltRounds),
      role: 'SUPER_ADMIN',
    },
  });
  console.log(`Super admin: ${admin.email} (password: ChangeMe123!)`);

  // ── A sample household with members ──────────────────
  let household = await prisma.household.findFirst({
    where: { name: 'Vaj Tooj household' },
    include: { members: true },
  });

  if (!household) {
    household = await prisma.household.create({
      data: {
        name: 'Vaj Tooj household',
        address: 'Vientiane, Laos',
        contact: '+856 20 0000 0000',
        members: {
          create: [
            { nameHmong: 'Tooj Vaj', nameLatin: 'Tong Vang', gender: 'MALE' },
            { nameHmong: 'Maiv Vaj', nameLatin: 'Mai Vang', gender: 'FEMALE' },
          ],
        },
      },
      include: { members: true },
    });
  }

  // Set the head of household to the first member.
  let head = household.members[0];
  if (!head) {
    head = await prisma.member.create({
      data: {
        householdId: household.id,
        nameHmong: 'Tooj Vaj',
        nameLatin: 'Tong Vang',
        gender: 'MALE',
      },
    });
  }
  if (head) {
    await prisma.household.update({
      where: { id: household.id },
      data: { headMemberId: head.id },
    });

    const memberEmail = 'member@vangclan.local';
    const memberUser = await prisma.user.upsert({
      where: { email: memberEmail },
      update: {
        role: 'MEMBER',
        isActive: true,
        member: { connect: { id: head.id } },
      },
      create: {
        email: memberEmail,
        passwordHash: await bcrypt.hash('Member123!', saltRounds),
        role: 'MEMBER',
        isActive: true,
        member: { connect: { id: head.id } },
      },
    });
    console.log(`Member: ${memberUser.email} (password: Member123!)`);
  }
  console.log(`Household: ${household.name} with ${household.members.length} members`);

  // ── Dues for the current year ────────────────────────
  await prisma.dues.upsert({
    where: { householdId_period: { householdId: household.id, period: '2026' } },
    update: {},
    create: {
      householdId: household.id,
      period: '2026',
      amount: new Prisma.Decimal('100000.00'),
      currency,
      status: 'UNPAID',
    },
  });
  console.log('Dues: 2026 charge created (UNPAID)');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
