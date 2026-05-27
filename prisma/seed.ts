import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as any;

async function main() {
  // ── Default Organization ──────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { code: 'SELFLESS' },
    update: {},
    create: { name: 'SelfLess Platform', code: 'SELFLESS', status: 'ACTIVE' },
  });
  console.log(`Org: ${org.name}`);

  // ── Super Admin ───────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@selfless.io' },
    update: {},
    create: {
      email: 'admin@selfless.io',
      passwordHash: hash,
      name: 'System Admin',
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log('Admin: admin@selfless.io / Admin@123');

  // ── Demo Branch ───────────────────────────────────────────────────────────
  const branch = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'HQ' } },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Headquarters',
      code: 'HQ',
      address: 'Main Street, Addis Ababa',
      timezone: 'Africa/Addis_Ababa',
      maxCapacity: 200,
      status: 'ACTIVE',
    },
  });
  console.log(`Branch: ${branch.name}`);

  // ── Demo Workflow ─────────────────────────────────────────────────────────
  const workflow = await prisma.workflow.upsert({
    where: { id: 'seed-workflow-001' },
    update: {},
    create: {
      id: 'seed-workflow-001',
      organizationId: org.id,
      name: 'Standard Registration',
      description: 'Registration → Payment → Approval',
      isActive: true,
    },
  });

  const step1 = await prisma.workflowStep.upsert({
    where: { id: 'seed-step-001' },
    update: {},
    create: { id: 'seed-step-001', workflowId: workflow.id, name: 'Registration', stepType: 'SERVICE', order: 1, slaMinutes: 15, isInitial: true, isFinal: false },
  });
  const step2 = await prisma.workflowStep.upsert({
    where: { id: 'seed-step-002' },
    update: {},
    create: { id: 'seed-step-002', workflowId: workflow.id, name: 'Payment', stepType: 'PAYMENT', order: 2, slaMinutes: 10, isInitial: false, isFinal: false },
  });
  const step3 = await prisma.workflowStep.upsert({
    where: { id: 'seed-step-003' },
    update: {},
    create: { id: 'seed-step-003', workflowId: workflow.id, name: 'Approval', stepType: 'APPROVAL', order: 3, slaMinutes: 20, isInitial: false, isFinal: true },
  });

  for (const [id, src, dst, label] of [
    ['seed-trans-001', step1.id, step2.id, 'Proceed to Payment'],
    ['seed-trans-002', step2.id, step3.id, 'Proceed to Approval'],
  ] as [string, string, string, string][]) {
    await prisma.workflowTransition.upsert({
      where: { id },
      update: {},
      create: { id, workflowId: workflow.id, sourceStepId: src, destinationStepId: dst, label, order: 1 },
    });
  }
  console.log(`Workflow: ${workflow.name}`);

  // ── Demo Service ──────────────────────────────────────────────────────────
  await prisma.service.upsert({
    where: { branchId_code: { branchId: branch.id, code: 'REG' } },
    update: {},
    create: {
      branchId: branch.id,
      workflowId: workflow.id,
      name: 'General Registration',
      code: 'REG',
      description: 'Registration with payment and approval workflow',
      estimatedDuration: 30,
      prefix: 'A',
      serviceType: 'WALK_IN',
      isActive: true,
    },
  });
  console.log('Service: General Registration');

  // ── Counter Group + Counters ──────────────────────────────────────────────
  const cg = await prisma.counterGroup.upsert({
    where: { id: 'seed-cg-001' },
    update: {},
    create: { id: 'seed-cg-001', organizationId: org.id, name: 'Registration Desks' },
  });

  for (let i = 1; i <= 3; i++) {
    await prisma.counter.upsert({
      where: { branchId_code: { branchId: branch.id, code: `R${i}` } },
      update: {},
      create: { branchId: branch.id, groupId: cg.id, name: `Desk ${i}`, code: `R${i}`, isActive: true },
    });
  }
  console.log('Counters: Desk 1-3');

  // ── Demo Officer ──────────────────────────────────────────────────────────
  const officerHash = await bcrypt.hash('Officer@123', 12);
  await prisma.user.upsert({
    where: { email: 'officer@selfless.io' },
    update: {},
    create: {
      email: 'officer@selfless.io',
      passwordHash: officerHash,
      name: 'Demo Officer',
      firstName: 'Demo',
      lastName: 'Officer',
      role: 'OFFICER',
      organizationId: org.id,
      branchId: branch.id,
      isActive: true,
    },
  });
  console.log('Officer: officer@selfless.io / Officer@123');

  console.log('\n✅ Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
