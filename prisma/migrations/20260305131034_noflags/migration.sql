/*
  Warnings:

  - You are about to drop the column `flags` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `flags` on the `Transaction` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Item" DROP COLUMN "flags",
ADD COLUMN     "invisible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "flags",
ADD COLUMN     "removed" BOOLEAN NOT NULL DEFAULT false;
