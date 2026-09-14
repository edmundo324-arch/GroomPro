-- Configurable non-employee booking resources used to control online availability.
CREATE TABLE IF NOT EXISTS `BookingAsset` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `onlineBookingRecipient` BOOLEAN NOT NULL DEFAULT true,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BookingAsset_tenantId_active_idx` (`tenantId`, `active`),
  INDEX `BookingAsset_locationId_category_idx` (`locationId`, `category`),
  CONSTRAINT `BookingAsset_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BookingAsset_locationId_fkey` FOREIGN KEY (`locationId`) REFERENCES `Location` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `BookingAssetSchedule` (
  `id` VARCHAR(191) NOT NULL,
  `assetId` VARCHAR(191) NOT NULL,
  `dayOfWeek` TINYINT NOT NULL,
  `startTime` VARCHAR(5) NOT NULL,
  `endTime` VARCHAR(5) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `BookingAssetSchedule_asset_day_start_end_key` (`assetId`, `dayOfWeek`, `startTime`, `endTime`),
  INDEX `BookingAssetSchedule_asset_day_idx` (`assetId`, `dayOfWeek`, `active`),
  CONSTRAINT `BookingAssetSchedule_assetId_fkey` FOREIGN KEY (`assetId`) REFERENCES `BookingAsset` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `User` ADD COLUMN `jobTitle` VARCHAR(191) NULL;
