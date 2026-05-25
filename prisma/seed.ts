import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const saltRounds = 10;

  const users = [
    {
      email: process.env.SEED_KIOSK_EMAIL || 'cbm_kiosk@qtrust.id',
      name: 'CBM Kiosk',
      password: await bcrypt.hash(process.env.SEED_KIOSK_PASSWORD || 'kiosk123', saltRounds),
      role: 'kiosk',
    },
    {
      email: process.env.SEED_TECHNICIAN_EMAIL || 'technician@qtrust.id',
      name: 'Technician',
      password: await bcrypt.hash(process.env.SEED_TECHNICIAN_PASSWORD || 'tech123', saltRounds),
      role: 'technician',
    },
    {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@qtrust.id',
      name: 'Admin',
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

  const kiosks = [
    {
      hardwareId: 'KIOSK-001',
      status: 'Activated',
      deviceName: 'Kiosk Display 001',
      groupName: 'Jakarta Group',
      groupId: 1,
      dealerName: 'Dealer Jakarta',
      qrcode: 'QR-KIOSK-001',
      serialNumber: 'SN-001',
      loginDate: '2026-01-15',
      defaultContentType: 'video',
      defaultContentUrl: 'https://cdn.example.com/content/default.mp4',
      linkUrl: 'https://example.com/kiosk/001',
      location: 'Jakarta Pusat',
      region: 'DKI Jakarta',
      kdDealer: 'KD-JKT-001',
      lat: -6.175110,
      lng: 106.865036,
      spesification: {
        aspectRatio: '16:9',
        screenWidth: 1920,
        screenHeight: 1080,
        appVersion: '1.0.0',
        serialNumber: 'SN-001',
        manufacturer: 'Samsung',
        model: 'Kiosk Pro',
        brand: 'Samsung',
        device: 'kiosk_pro',
        board: 'exynos9810',
        ram: '4GB',
      },
    },
    {
      hardwareId: 'KIOSK-002',
      status: 'Pending',
      deviceName: 'Kiosk Display 002',
      groupName: 'Surabaya Group',
      groupId: 2,
      dealerName: 'Dealer Surabaya',
      location: 'Surabaya',
      region: 'Jawa Timur',
    },
    {
      hardwareId: 'KIOSK-003',
      status: 'Pending',
      deviceName: 'Kiosk Display 003',
      groupName: 'Default Group',
      groupId: 1,
      dealerName: 'Default Dealer',
    },
  ];

  for (const kiosk of kiosks) {
    await prisma.hardwareActivation.upsert({
      where: { hardwareId: kiosk.hardwareId },
      update: {},
      create: kiosk,
    });

    await prisma.takePicture.create({
      data: {
        hardwareId: kiosk.hardwareId,
        status: 0,
        message: null,
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
