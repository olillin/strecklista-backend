/*
  Warnings:

  - Made the column `groupId` on table `Price` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Price" ALTER COLUMN "groupId" SET NOT NULL;
