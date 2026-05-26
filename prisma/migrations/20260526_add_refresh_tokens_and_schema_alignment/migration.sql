-- CreateEnum
CREATE TYPE "Role" AS ENUM ('kiosk', 'technician', 'admin');

-- AlterTable: convert users.role from TEXT to Role enum (data-safe)
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'kiosk';

-- AlterTable: convert login_date from TEXT to TIMESTAMP (best-effort cast)
ALTER TABLE "hardware_activations" ALTER COLUMN "login_date" TYPE TIMESTAMP(3)
  USING CASE WHEN "login_date" IS NOT NULL THEN "login_date"::TIMESTAMP(3) ELSE NULL END;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "hardware_activations_status_idx" ON "hardware_activations"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "take_pictures" ADD CONSTRAINT "take_pictures_hardware_id_fkey" FOREIGN KEY ("hardware_id") REFERENCES "hardware_activations"("hardware_id") ON DELETE CASCADE ON UPDATE CASCADE;
