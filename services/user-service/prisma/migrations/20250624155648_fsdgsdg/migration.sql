-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "experience" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalPointsEarned" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "quiz_history" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "quizId" TEXT NOT NULL,
    "quizTitle" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "score" INTEGER NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "timeSpent" INTEGER NOT NULL,
    "difficulty" VARCHAR(20) NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "bonusPoints" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "icon" VARCHAR(50),
    "rarity" VARCHAR(20) NOT NULL DEFAULT 'common',
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_stats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "totalQuizzes" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpent" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "lastQuizAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topic_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_stats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "quizzesPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "averageScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeSpent" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_ranking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userName" VARCHAR(101) NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "quizzesPlayed" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_ranking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userName" VARCHAR(101) NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "quizzesPlayed" INTEGER NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_ranking" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userName" VARCHAR(101) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "quizzesPlayed" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_history_userId_idx" ON "quiz_history"("userId");

-- CreateIndex
CREATE INDEX "quiz_history_quizId_idx" ON "quiz_history"("quizId");

-- CreateIndex
CREATE INDEX "quiz_history_category_idx" ON "quiz_history"("category");

-- CreateIndex
CREATE INDEX "quiz_history_completedAt_idx" ON "quiz_history"("completedAt");

-- CreateIndex
CREATE INDEX "quiz_history_userId_completedAt_idx" ON "quiz_history"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "achievements_userId_idx" ON "achievements"("userId");

-- CreateIndex
CREATE INDEX "achievements_type_idx" ON "achievements"("type");

-- CreateIndex
CREATE INDEX "achievements_rarity_idx" ON "achievements"("rarity");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_userId_name_key" ON "achievements"("userId", "name");

-- CreateIndex
CREATE INDEX "topic_stats_userId_idx" ON "topic_stats"("userId");

-- CreateIndex
CREATE INDEX "topic_stats_category_idx" ON "topic_stats"("category");

-- CreateIndex
CREATE INDEX "topic_stats_averageScore_idx" ON "topic_stats"("averageScore");

-- CreateIndex
CREATE UNIQUE INDEX "topic_stats_userId_category_key" ON "topic_stats"("userId", "category");

-- CreateIndex
CREATE INDEX "weekly_stats_userId_idx" ON "weekly_stats"("userId");

-- CreateIndex
CREATE INDEX "weekly_stats_weekStartDate_idx" ON "weekly_stats"("weekStartDate");

-- CreateIndex
CREATE INDEX "weekly_stats_totalScore_idx" ON "weekly_stats"("totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_stats_userId_weekStartDate_key" ON "weekly_stats"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "global_ranking_rank_idx" ON "global_ranking"("rank");

-- CreateIndex
CREATE INDEX "global_ranking_totalScore_idx" ON "global_ranking"("totalScore");

-- CreateIndex
CREATE INDEX "global_ranking_lastUpdated_idx" ON "global_ranking"("lastUpdated");

-- CreateIndex
CREATE INDEX "weekly_ranking_weekStartDate_rank_idx" ON "weekly_ranking"("weekStartDate", "rank");

-- CreateIndex
CREATE INDEX "weekly_ranking_totalScore_idx" ON "weekly_ranking"("totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_ranking_userId_weekStartDate_key" ON "weekly_ranking"("userId", "weekStartDate");

-- CreateIndex
CREATE INDEX "category_ranking_category_rank_idx" ON "category_ranking"("category", "rank");

-- CreateIndex
CREATE INDEX "category_ranking_totalScore_idx" ON "category_ranking"("totalScore");

-- CreateIndex
CREATE UNIQUE INDEX "category_ranking_userId_category_key" ON "category_ranking"("userId", "category");

-- CreateIndex
CREATE INDEX "users_totalScore_idx" ON "users"("totalScore");

-- CreateIndex
CREATE INDEX "users_level_experience_idx" ON "users"("level", "experience");

-- AddForeignKey
ALTER TABLE "quiz_history" ADD CONSTRAINT "quiz_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_stats" ADD CONSTRAINT "topic_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_stats" ADD CONSTRAINT "weekly_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
