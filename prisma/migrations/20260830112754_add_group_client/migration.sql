/*
  Warnings:

  - A unique constraint covering the columns `[groupId,externalId]` on the table `GroupUser` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_createdById_fkey";

-- AlterTable
ALTER TABLE "GroupUser" ADD COLUMN     "externalId" VARCHAR(100);

-- AlterTable
ALTER TABLE "Price" ADD COLUMN     "externalId" VARCHAR(100);

-- Create validation function for unique price externalId per group
CREATE OR REPLACE FUNCTION check_unique_external_id_per_group()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM "Price" p
    JOIN "Item" i ON p."itemId" = i."id"
    WHERE i."groupId" = (SELECT "groupId" FROM "Item" WHERE "id" = NEW."itemId")
      AND p."externalId" = NEW."externalId"
      AND (p."itemId", p."displayName") IS DISTINCT FROM (NEW."itemId", NEW."displayName")
  ) THEN
    RAISE EXCEPTION 'externalId % already exists for this group', NEW."externalId"
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach externalId validation trigger to Price table
CREATE TRIGGER enforce_unique_external_id_per_group
BEFORE INSERT OR UPDATE ON "Price"
FOR EACH ROW EXECUTE FUNCTION check_unique_external_id_per_group();

-- AlterTable
ALTER TABLE "Transaction" RENAME COLUMN "createdById" TO "createdByUserId";
ALTER TABLE "Transaction" ADD COLUMN "createdByClientId" VARCHAR(26);

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

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdByClientId_fkey" FOREIGN KEY ("createdByClientId") REFERENCES "ApiClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
