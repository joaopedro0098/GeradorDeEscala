-- DropForeignKey
ALTER TABLE "LoginOtp" DROP CONSTRAINT "LoginOtp_userId_fkey";

-- DropTable
DROP TABLE "LoginOtp";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerifiedAt";
