-- AlterTable
ALTER TABLE "hardware_activations" ADD COLUMN     "default_content_type" TEXT,
ADD COLUMN     "default_content_url" TEXT,
ADD COLUMN     "kd_dealer" TEXT,
ADD COLUMN     "lat" TEXT,
ADD COLUMN     "link_url" TEXT,
ADD COLUMN     "lng" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "login_date" TEXT,
ADD COLUMN     "qrcode" TEXT,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "serial_number" TEXT,
ADD COLUMN     "spesification" JSONB;

-- AlterTable
ALTER TABLE "take_pictures" ADD COLUMN     "message" TEXT;
