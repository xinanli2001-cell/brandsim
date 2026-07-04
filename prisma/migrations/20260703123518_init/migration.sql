-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teacherId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "brandName" TEXT NOT NULL,
    "brandBackground" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "seasonalContext" TEXT NOT NULL,
    "followerBase" INTEGER NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "startingTokens" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "availableActions" JSONB NOT NULL,
    "leaderboardEnabled" BOOLEAN NOT NULL,
    "joinCode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "tokenBalance" INTEGER NOT NULL,
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "finalScore" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "post" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Round_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_joinCode_key" ON "Challenge"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Group_challengeId_groupName_key" ON "Group"("challengeId", "groupName");

-- CreateIndex
CREATE UNIQUE INDEX "Round_groupId_round_key" ON "Round"("groupId", "round");
