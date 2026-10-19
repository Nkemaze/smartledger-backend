/* eslint-disable no-console */
/**
 * Creates a platform SUPERADMIN account attached to an existing business.
 *
 * Usage:
 *   npx tsx scripts/create-platform-admin.ts <email> <password> <phone> "<business name>"
 */
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../src/config/database";

async function main() {
  const [email, password, phone, businessName] = process.argv.slice(2);
  if (!email || !password || !phone || !businessName) {
    console.error(
      'Usage: npx tsx scripts/create-platform-admin.ts <email> <password> <phone> "<business name>"',
    );
    process.exit(1);
  }

  const business = await prisma.business.findFirst({
    where: { name: { equals: businessName, mode: "insensitive" } },
  });
  if (!business) {
    console.error(`No business found named "${businessName}"`);
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
      businessId: business.id,
      name: "Nkemaze Bless",
      email: email.toLowerCase(),
      phone: normPhone,
      passwordHash,
      role: Role.SUPERADMIN,
      platformAdmin: true,
      phoneVerified: true,
      emailVerified: true,
    },
    include: { business: true },
  });

  console.log(`Created platform admin ${user.name}`);
  console.log(`  email : ${user.email}`);
  console.log(`  phone : ${user.phone}`);
  console.log(`  business: ${user.business.name}`);
  console.log(`  role  : ${user.role} (platformAdmin=${user.platformAdmin})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
