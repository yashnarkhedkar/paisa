-- CreateEnum
CREATE TYPE "StatementFormat" AS ENUM ('BOB', 'IDFC', 'AXIS', 'ICICI');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN "format" "StatementFormat";
