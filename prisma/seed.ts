import { PrismaClient, Role, ShopStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Mật khẩu chung cho mọi tài khoản test.
const TEST_PASSWORD = '123456';

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await argon2.hash(TEST_PASSWORD);

  // ── Helper: upsert 1 user theo email ────────────────────────────────────
  const upsertUser = (
    email: string,
    displayName: string,
    role: Role,
    extra: { shopId?: string; isPremium?: boolean } = {},
  ) =>
    prisma.user.upsert({
      where: { email },
      update: { role, displayName, ...extra },
      create: {
        email,
        passwordHash,
        displayName,
        role,
        isEmailVerified: true,
        ...extra,
      },
    });

  // ── Platform accounts (shopId = null) ───────────────────────────────────
  const superAdmin = await upsertUser(
    'superadmin@gmail.com',
    'Super Admin',
    Role.SUPER_ADMIN,
  );
  console.log('✅ SUPER_ADMIN :', superAdmin.email);

  const admin = await upsertUser('admin@gmail.com', 'Admin', Role.ADMIN);
  console.log('✅ ADMIN       :', admin.email);

  const user = await upsertUser('user@gmail.com', 'Demo User', Role.USER);
  console.log('✅ USER        :', user.email);

  const premiumUser = await upsertUser(
    'premium@gmail.com',
    'Premium User',
    Role.USER,
    { isPremium: true },
  );
  console.log('✅ USER (prem) :', premiumUser.email);

  // ── B2B: OWNER + STAFF cần shopId ───────────────────────────────────────
  // Tạo OWNER trước (để gán shop.ownerId), rồi tạo Shop, rồi gắn shopId.
  const owner = await upsertUser('owner@gmail.com', 'Shop Owner', Role.OWNER);

  const shop = await prisma.shop.upsert({
    where: { slug: 'demo-karaoke' },
    update: { ownerId: owner.id },
    create: {
      name: 'Demo Karaoke',
      slug: 'demo-karaoke',
      ownerId: owner.id,
      status: ShopStatus.ACTIVE,
      address: '123 Đường ABC, Quận 1, TP.HCM',
      phone: '0900000000',
    },
  });
  console.log('✅ SHOP        :', shop.name, `(${shop.slug})`);

  // Gắn owner vào shop (shopId)
  await prisma.user.update({
    where: { id: owner.id },
    data: { shopId: shop.id },
  });
  console.log('✅ OWNER       :', owner.email, `→ shop ${shop.slug}`);

  const staff = await upsertUser('staff@gmail.com', 'Shop Staff', Role.STAFF, {
    shopId: shop.id,
  });
  console.log('✅ STAFF       :', staff.email, `→ shop ${shop.slug}`);

  console.log('\n🌱 Seeding done! Tất cả mật khẩu = "' + TEST_PASSWORD + '"');
  console.table([
    { role: 'SUPER_ADMIN', email: 'superadmin@gmail.com' },
    { role: 'ADMIN', email: 'admin@gmail.com' },
    { role: 'OWNER', email: 'owner@gmail.com' },
    { role: 'STAFF', email: 'staff@gmail.com' },
    { role: 'USER', email: 'user@gmail.com' },
    { role: 'USER (premium)', email: 'premium@gmail.com' },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
