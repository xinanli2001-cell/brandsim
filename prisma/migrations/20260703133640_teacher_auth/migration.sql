-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Challenge" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Challenge_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Challenge" ("availableActions", "brandBackground", "brandName", "createdAt", "difficulty", "followerBase", "goal", "id", "joinCode", "leaderboardEnabled", "seasonalContext", "startingTokens", "status", "targetAudience", "teacherId", "totalRounds") SELECT "availableActions", "brandBackground", "brandName", "createdAt", "difficulty", "followerBase", "goal", "id", "joinCode", "leaderboardEnabled", "seasonalContext", "startingTokens", "status", "targetAudience", "teacherId", "totalRounds" FROM "Challenge";
DROP TABLE "Challenge";
ALTER TABLE "new_Challenge" RENAME TO "Challenge";
CREATE UNIQUE INDEX "Challenge_joinCode_key" ON "Challenge"("joinCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_email_key" ON "Teacher"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
