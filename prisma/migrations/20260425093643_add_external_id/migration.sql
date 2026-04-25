/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `GroupUser` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[externalId]` on the table `Price` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "GroupUser" ADD COLUMN     "externalId" INTEGER;

-- AlterTable
ALTER TABLE "Price" ADD COLUMN     "externalId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "GroupUser_externalId_key" ON "GroupUser"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Price_externalId_key" ON "Price"("externalId");
