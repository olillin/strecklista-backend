-- DropForeignKey
ALTER TABLE "ItemStockUpdate" DROP CONSTRAINT "ItemStockUpdate_itemId_fkey";

-- AlterTable
ALTER TABLE "ItemStockUpdate" ALTER COLUMN "itemId" DROP NOT NULL;
ALTER TABLE "ItemStockUpdate" ADD COLUMN     "displayName" VARCHAR(100),
ADD COLUMN     "iconUrl" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "ItemStockUpdate" ADD CONSTRAINT "ItemStockUpdate_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update ItemStockUpdate
UPDATE "ItemStockUpdate" u SET "displayName" = i."displayName", "iconUrl" = i."iconUrl" FROM "Item" i WHERE u."itemId" = i."id";
UPDATE "ItemStockUpdate" SET "displayName" = 'N/A' WHERE "displayName" IS NULL;

-- AlterTable
ALTER TABLE "ItemStockUpdate" ALTER COLUMN "displayName" SET NOT NULL;
