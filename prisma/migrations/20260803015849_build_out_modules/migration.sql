-- AlterTable
ALTER TABLE "businesses" ADD COLUMN     "address" TEXT,
ADD COLUMN     "filingFrequency" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "vatRate" DECIMAL(4,2);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "vatAmount" DECIMAL(12,2),
ADD COLUMN     "vatRate" DECIMAL(4,2);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "monthlyTarget" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "tax_filings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "vatCollected" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_filings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tax_filings_businessId_period_idx" ON "tax_filings"("businessId", "period");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
