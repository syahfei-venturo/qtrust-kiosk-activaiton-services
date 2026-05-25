/*
  Warnings:

  - The `lat` column on the `hardware_activations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `lng` column on the `hardware_activations` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "hardware_activations" DROP COLUMN "lat",
ADD COLUMN     "lat" DOUBLE PRECISION,
DROP COLUMN "lng",
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login" TIMESTAMP(3),
ADD COLUMN     "name" TEXT;
