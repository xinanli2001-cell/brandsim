-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "Round" DROP CONSTRAINT "Round_groupId_fkey";

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
