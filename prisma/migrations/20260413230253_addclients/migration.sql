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

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiClient" ADD CONSTRAINT "ApiClient_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
