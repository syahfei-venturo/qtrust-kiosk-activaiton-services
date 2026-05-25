-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'kiosk',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_activations" (
    "id" TEXT NOT NULL,
    "hardware_id" TEXT NOT NULL,
    "activation_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "device_name" TEXT,
    "group_name" TEXT,
    "group_id" INTEGER,
    "dealer_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "take_pictures" (
    "id" TEXT NOT NULL,
    "hardware_id" TEXT NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "take_pictures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_activations_hardware_id_key" ON "hardware_activations"("hardware_id");

-- CreateIndex
CREATE INDEX "take_pictures_hardware_id_created_at_idx" ON "take_pictures"("hardware_id", "created_at" DESC);
