-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_createdById_fkey";

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "createdById" DROP NOT NULL;
ALTER TABLE "Transaction" RENAME COLUMN "createdById" TO "createdByUserId";
ALTER TABLE "Transaction" ADD COLUMN "createdByClientId" VARCHAR(26);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdByClientId_fkey" FOREIGN KEY ("createdByClientId") REFERENCES "ApiClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Enforce createdByUserId XOR createdByClientId
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_hasOneCreatedBy" CHECK (("createdByUserId" IS NULL) <> ("createdByClientId" IS NULL));
