import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter }) as any;

async function main() {
  const superAdminPhone = process.env.SEED_SUPER_ADMIN_PHONE;
  if (!superAdminPhone) {
    throw new Error(
      'SEED_SUPER_ADMIN_PHONE is not set. Add it to selfless-api/.env (e.g. SEED_SUPER_ADMIN_PHONE="+2519XXXXXXXX") before running the seed.',
    );
  }
  const demoOfficerPhone = process.env.SEED_DEMO_OFFICER_PHONE || '+251911000002';

  // ── Default Organization ──────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { code: 'SELFLESS' },
    update: {},
    create: { name: 'SelfLess Platform', code: 'SELFLESS', status: 'ACTIVE' },
  });
  console.log(`Org: ${org.name}`);

  // ── Super Admin (no PIN set — first login goes through the normal ────────
  // ── OTP + set-pin flow so the real owner of this phone chooses their PIN) ─
  const superAdmin = await prisma.account.upsert({
    where: { phone: superAdminPhone },
    update: {},
    create: {
      phone: superAdminPhone,
      firstName: 'Super',
      lastName: 'Admin',
      status: 'ACTIVE',
    },
  });
  await prisma.orgMembership.upsert({
    where: { accountId_organizationId: { accountId: superAdmin.id, organizationId: org.id } },
    update: {},
    create: {
      accountId: superAdmin.id,
      organizationId: org.id,
      branchId: null,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log(`Super admin seeded: ${superAdminPhone} (no PIN yet — sign up via /auth/request-otp to set one)`);

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

  // ── Demo Priority Flags ───────────────────────────────────────────────────
  await prisma.priorityFlag.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Elderly' } },
    update: {},
    create: { organizationId: org.id, name: 'Elderly', description: 'Age 65+', weight: 50, color: '#B5701F', isActive: true },
  });
  await prisma.priorityFlag.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Pregnant' } },
    update: {},
    create: { organizationId: org.id, name: 'Pregnant', weight: 50, color: '#8A4FA6', isActive: true },
  });
  await prisma.priorityFlag.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Disability' } },
    update: {},
    create: { organizationId: org.id, name: 'Disability', weight: 50, color: '#2E5C8A', isActive: true },
  });
  await prisma.priorityFlag.upsert({
    where: { organizationId_name: { organizationId: org.id, name: 'Emergency' } },
    update: {},
    create: { organizationId: org.id, name: 'Emergency', description: 'One-off, staff-assigned', weight: 100, color: '#B23A32', isActive: true },
  });
  console.log('Priority flags: Elderly, Pregnant, Disability, Emergency');

  // ── Demo Officer (also no PIN — signs up the same way) ────────────────────
  const officer = await prisma.account.upsert({
    where: { phone: demoOfficerPhone },
    update: {},
    create: {
      phone: demoOfficerPhone,
      firstName: 'Demo',
      lastName: 'Officer',
      status: 'ACTIVE',
    },
  });
  await prisma.orgMembership.upsert({
    where: { accountId_organizationId: { accountId: officer.id, organizationId: org.id } },
    update: {},
    create: {
      accountId: officer.id,
      organizationId: org.id,
      branchId: branch.id,
      role: 'OFFICER',
      isActive: true,
    },
  });
  console.log(`Officer seeded: ${demoOfficerPhone} (no PIN yet)`);

  console.log('\n✅ Seed complete');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
