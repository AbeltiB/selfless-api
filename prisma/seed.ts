import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { UserRole } from 'selfless-sdk';

async function seed() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as any) as any;

  console.log('Seeding database...');

  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@selfless.io' } });
  if (!adminExists) {
    await prisma.user.create({
      data: {
        email: 'admin@selfless.io',
        passwordHash: await bcrypt.hash('Admin@123', 12),
        name: 'System Admin',
        role: UserRole.ADMIN,
      },
    });
    console.log('Created admin: admin@selfless.io / Admin@123');
  }

  let branch = await prisma.branch.findUnique({ where: { code: 'DEMO-HQ' } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        name: 'Demo Headquarters',
        code: 'DEMO-HQ',
        address: '123 Demo Street, City',
        timezone: 'Africa/Addis_Ababa',
        maxQueueCapacity: 200,
      },
    });
    console.log('Created demo branch:', branch.name);
  }

  const services = [
    { code: 'GEN', name: 'General Inquiry', prefix: 'G', estimatedDuration: 10 },
    { code: 'ACC', name: 'Account Services', prefix: 'A', estimatedDuration: 15 },
    { code: 'LOAN', name: 'Loan Services', prefix: 'L', estimatedDuration: 30 },
    { code: 'CSH', name: 'Cashier', prefix: 'C', estimatedDuration: 5 },
  ];

  for (const svc of services) {
    const existing = await prisma.service.findUnique({
      where: { branchId_code: { branchId: branch.id, code: svc.code } },
    });
    if (!existing) {
      await prisma.service.create({
        data: { ...svc, branchId: branch.id },
      });
      console.log('Created service:', svc.name);
    }
  }

  const opExists = await prisma.user.findUnique({ where: { email: 'operator@selfless.io' } });
  if (!opExists) {
    await prisma.user.create({
      data: {
        email: 'operator@selfless.io',
        passwordHash: await bcrypt.hash('Operator@123', 12),
        name: 'Demo Operator',
        role: UserRole.OPERATOR,
        branchId: branch.id,
      },
    });
    console.log('Created operator: operator@selfless.io / Operator@123');
  }

  await prisma.$disconnect();
  console.log('Seeding complete.');
}

seed().catch((e) => { console.error(e); process.exit(1); });
