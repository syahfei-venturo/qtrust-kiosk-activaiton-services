import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const saltRounds = 10;

  const users = [
    {
      email: process.env.SEED_KIOSK_EMAIL || 'cbm_kiosk@qtrust.id',
      password: await bcrypt.hash(process.env.SEED_KIOSK_PASSWORD || 'kiosk123', saltRounds),
      role: 'kiosk',
    },
    {
      email: process.env.SEED_TECHNICIAN_EMAIL || 'technician@qtrust.id',
      password: await bcrypt.hash(process.env.SEED_TECHNICIAN_PASSWORD || 'tech123', saltRounds),
      role: 'technician',
    },
    {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@qtrust.id',
      password: await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'admin123', saltRounds),
      role: 'admin',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { password: user.password, role: user.role },
      create: user,
    });
  }

  const kiosks = ['KIOSK-001', 'KIOSK-002', 'KIOSK-003'];

  for (const hardwareId of kiosks) {
    await prisma.hardwareActivation.upsert({
      where: { hardwareId },
      update: {},
      create: {
        hardwareId,
        status: 'Pending',
        deviceName: `Device ${hardwareId}`,
        groupName: 'Default Group',
        groupId: 1,
        dealerName: 'Default Dealer',
      },
    });

    await prisma.takePicture.create({
      data: {
        hardwareId,
        status: 0,
      },
    });
  }

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
