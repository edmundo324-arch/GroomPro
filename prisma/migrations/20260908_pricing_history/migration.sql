-- Auditable pricing changes for the modular multi-location pricing engine.
-- Historical TicketLine.unitPriceCents remains the source of truth for past sales.

CREATE TABLE `PricingChangeBatch` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `actorUserId` VARCHAR(191) NULL,
  `changeType` VARCHAR(50) NOT NULL,
  `adjustmentPct` DECIMAL(7,3) NULL,
  `reason` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PricingChangeBatch_tenantId_createdAt_idx` (`tenantId`, `createdAt`),
  INDEX `PricingChangeBatch_tenantId_actorUserId_idx` (`tenantId`, `actorUserId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PricingChangeItem` (
  `id` VARCHAR(191) NOT NULL,
  `batchId` VARCHAR(191) NOT NULL,
  `entityType` VARCHAR(30) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NULL,
  `oldBasePriceCents` INT NULL,
  `newBasePriceCents` INT NULL,
  `oldAdjustmentPct` DECIMAL(7,3) NULL,
  `newAdjustmentPct` DECIMAL(7,3) NULL,
  `oldOverrideCents` INT NULL,
  `newOverrideCents` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `PricingChangeItem_batchId_idx` (`batchId`),
  INDEX `PricingChangeItem_entity_idx` (`entityType`, `entityId`),
  CONSTRAINT `PricingChangeItem_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `PricingChangeBatch` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
