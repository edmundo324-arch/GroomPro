CREATE TABLE `PricingChangeBatch` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NULL,
  `changeType` VARCHAR(80) NOT NULL,
  `adjustmentPct` DECIMAL(7,3) NOT NULL,
  `reason` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PricingChangeBatch_tenantId_createdAt_idx` (`tenantId`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PricingChangeItem` (
  `id` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(30) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `oldBasePriceCents` INT NOT NULL,
  `newBasePriceCents` INT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `PricingChangeItem_batchId_idx` (`batchId`),
  INDEX `PricingChangeItem_entityId_idx` (`entityType`, `entityId`),
  CONSTRAINT `PricingChangeItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `PricingChangeBatch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
