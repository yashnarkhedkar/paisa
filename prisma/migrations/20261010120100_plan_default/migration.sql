-- align with Prisma default for @db.Date now()
ALTER TABLE "Goal" ALTER COLUMN "countFrom" SET DEFAULT CURRENT_TIMESTAMP;
