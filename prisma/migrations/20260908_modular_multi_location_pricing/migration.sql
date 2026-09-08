-- GroomPro modular SaaS / multi-location pricing foundation
-- This migration is intentionally additive. Existing tenant/location/service data remains intact.

CREATE TABLE `FeatureModule` (
  `id` VARCHAR(191) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `FeatureModule_code_key` (`code`),
  INDEX `FeatureModule_active_idx` (`active`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantFeature` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `featureCode` VARCHAR(100) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `config` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TenantFeature_tenantId_featureCode_key` (`tenantId`, `featureCode`),
  INDEX `TenantFeature_tenantId_enabled_idx` (`tenantId`, `enabled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RolePermission` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `role` VARCHAR(100) NOT NULL,
  `permissionCode` VARCHAR(150) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `RolePermission_tenantId_role_permissionCode_key` (`tenantId`, `role`, `permissionCode`),
  INDEX `RolePermission_tenantId_role_enabled_idx` (`tenantId`, `role`, `enabled`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantSetting` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `settingKey` VARCHAR(150) NOT NULL,
  `value` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TenantSetting_tenantId_settingKey_key` (`tenantId`, `settingKey`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LocationServicePricing` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `serviceId` VARCHAR(191) NOT NULL,
  `priceAdjustmentPct` DECIMAL(7,3) NOT NULL DEFAULT 0,
  `priceOverrideCents` INT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LocationServicePricing_locationId_serviceId_key` (`locationId`, `serviceId`),
  INDEX `LocationServicePricing_tenantId_locationId_idx` (`tenantId`, `locationId`),
  INDEX `LocationServicePricing_tenantId_serviceId_idx` (`tenantId`, `serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Package` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `basePriceCents` INT NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `Package_tenantId_active_idx` (`tenantId`, `active`),
  INDEX `Package_tenantId_name_idx` (`tenantId`, `name`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `PackageItem` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `packageId` VARCHAR(191) NOT NULL,
  `serviceId` VARCHAR(191) NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `PackageItem_tenantId_packageId_idx` (`tenantId`, `packageId`),
  INDEX `PackageItem_tenantId_serviceId_idx` (`tenantId`, `serviceId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LocationPackagePricing` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `packageId` VARCHAR(191) NOT NULL,
  `priceAdjustmentPct` DECIMAL(7,3) NOT NULL DEFAULT 0,
  `priceOverrideCents` INT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `LocationPackagePricing_locationId_packageId_key` (`locationId`, `packageId`),
  INDEX `LocationPackagePricing_tenantId_locationId_idx` (`tenantId`, `locationId`),
  INDEX `LocationPackagePricing_tenantId_packageId_idx` (`tenantId`, `packageId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerLocationAccess` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `locationId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `CustomerLocationAccess_customerId_locationId_key` (`customerId`, `locationId`),
  INDEX `CustomerLocationAccess_tenantId_locationId_idx` (`tenantId`, `locationId`),
  INDEX `CustomerLocationAccess_tenantId_customerId_idx` (`tenantId`, `customerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
