-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "EvalQuery" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalJudgment" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "relevance" INTEGER NOT NULL,
    "judgedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalJudgment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvalRun" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "strategy" TEXT NOT NULL,
    "resultPostIds" TEXT[],
    "ndcg" DOUBLE PRECISION NOT NULL,
    "mrr" DOUBLE PRECISION NOT NULL,
    "precisionAt5" DOUBLE PRECISION NOT NULL,
    "zeroResult" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvalQuery_text_key" ON "EvalQuery"("text");

-- CreateIndex
CREATE UNIQUE INDEX "EvalJudgment_queryId_postId_key" ON "EvalJudgment"("queryId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "EvalRun_queryId_strategy_key" ON "EvalRun"("queryId", "strategy");

-- AddForeignKey
ALTER TABLE "EvalJudgment" ADD CONSTRAINT "EvalJudgment_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "EvalQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvalRun" ADD CONSTRAINT "EvalRun_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "EvalQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
