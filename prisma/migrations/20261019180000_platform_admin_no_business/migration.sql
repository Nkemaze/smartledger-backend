-- Platform/super-admin accounts are not tied to a single business.
-- Make users.businessId nullable so a platform admin can exist without
-- belonging to any store. Regular business users always have one.
ALTER TABLE "users" ALTER COLUMN "businessId" DROP NOT NULL;
