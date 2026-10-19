/* eslint-disable no-console */
/**
 * Creates a platform SUPERADMIN account that is NOT attached to any business.
 *
 * Platform admins sit above all stores, so they have no businessId of their
 * own (see the `platform_admin_no_business` migration).
 *
 * Usage:
 *   npx tsx scripts/create-platform-admin.ts <email> <password> <phone> [name]
 */
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/config/database";

async function main() {
  const [email, password, phone, name] = process.argv.slice(2);
  if (!email || !password || !phone) {
    console.error(
      'Usage: npx tsx scripts/create-platform-admin.ts <email> <password> <phone> [name]',
    );
    process.exit(1);
  }

  const normPhone = phone.trim().replace(/^\+/, "");
  const exists = await prisma.user.findFirst({
    where: {
      OR: [{ email: email.toLowerCase() }, { phone: normPhone }],
    },
  });
  if (exists) {
    console.error(
      `A user already exists with this ${exists.email === email.toLowerCase() ? "email" : "phone"}: ${exists.name} (${exists.email ?? exists.phone})`,
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      businessId: null,
      name: name || "Platform Admin",
      email: email.toLowerCase(),
      phone: normPhone,
      passwordHash,
      role: Role.SUPERADMIN,
      platformAdmin: true,
      phoneVerified: true,
      emailVerified: true,
    },
  });

  console.log(`Created platform admin ${user.name}`);
  console.log(`  email : ${user.email}`);
  console.log(`  phone : ${user.phone}`);
  console.log(`  business: (none — platform-wide)`);
  console.log(`  role  : ${user.role} (platformAdmin=${user.platformAdmin})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
