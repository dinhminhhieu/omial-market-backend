-- CreateEnum
CREATE TYPE "ERole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EGender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "EProvider" AS ENUM ('EMAIL', 'GOOGLE', 'FACEBOOK');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedUntil" TIMESTAMP(3),
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "gender" "EGender",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isBanned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "nativeLanguage" TEXT DEFAULT 'vi',
ADD COLUMN     "notificationToken" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "provider" "EProvider" NOT NULL DEFAULT 'EMAIL',
ADD COLUMN     "role" "ERole" NOT NULL DEFAULT 'USER',
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Ho_Chi_Minh',
ADD COLUMN     "userName" TEXT;
