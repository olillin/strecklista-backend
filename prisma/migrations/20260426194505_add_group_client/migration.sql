/*
  Warnings:

  - You are about to drop the column `createdById` on the `Transaction` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[groupId,externalId]` on the table `GroupUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[groupId,externalId]` on the table `Price` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_createdById_fkey";

-- AlterTable
ALTER TABLE "GroupUser" ADD COLUMN     "externalId" INTEGER;

-- AlterTable
ALTER TABLE "Price" ADD COLUMN     "externalId" INTEGER,

ADD COLUMN "groupId" INTEGER;

UPDATE "Price" p
SET "groupId" = i."groupId"
FROM "Item" i
WHERE p."itemId" = i."id";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "createdById",
ADD COLUMN     "createdByClientId" VARCHAR(26),
ADD COLUMN     "createdByUserId" INTEGER;

-- CreateTable
CREATE TABLE "ApiClient" (
    "id" VARCHAR(26) NOT NULL,
    "salt" VARCHAR(31) NOT NULL,
    "secret" VARCHAR(255) NOT NULL,
    "scope" VARCHAR(255) NOT NULL,
    "groupId" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "displayName" VARCHAR(50) NOT NULL,
    "description" VARCHAR(255),

    CONSTRAINT "ApiClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupUser_groupId_externalId_key" ON "GroupUser"("groupId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Price_groupId_externalId_key" ON "Price"("groupId", "externalId");

-- AddForeignKey
ALTER TABLE "Price" ADD CONSTRAINT "Price_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdByClientId_fkey" FOREIGN KEY ("createdByClientId") REFERENCES "ApiClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
