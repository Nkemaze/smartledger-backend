/* eslint-disable no-console */
/**
 * Promotes an existing user account to platform SUPERADMIN.
 *
 * Usage:
 *   npx tsx scripts/promote-admin.ts <phone-or-email>
 *   e.g. npx tsx scripts/promote-admin.ts alex@example.com
 */
import { Role } from "@prisma/client";
import { prisma } from "../src/config/database";

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.error("Usage: npx tsx scripts/promote-admin.ts <phone-or-email>");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier, mode: "insensitive" } },
        { phone: identifier.trim() },
      ],
    },
  });

  if (!user) {
    console.error(`No user found matching "${identifier}"`);
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: Role.SUPERADMIN, platformAdmin: true },
  });

  console.log(`Promoted ${updated.name} (${updated.phone}) to platform SUPERADMIN.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
