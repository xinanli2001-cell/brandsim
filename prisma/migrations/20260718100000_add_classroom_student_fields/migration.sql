-- AlterTable
ALTER TABLE "User" ADD COLUMN     "displayName" TEXT;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "leftAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Group_challengeId_studentId_key" ON "Group"("challengeId", "studentId");

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
