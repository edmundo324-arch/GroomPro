-- Customer account / rewards foundation
ALTER TABLE `Customer`
  ADD COLUMN `creditCents` INT NOT NULL DEFAULT 0;

ALTER TABLE `Ticket`
  ADD COLUMN `noShowFeeCents` INT NOT NULL DEFAULT 0,
  ADD COLUMN `noShowFeeProcessedAt` DATETIME(3) NULL,
  ADD COLUMN `noShowFeePaymentId` VARCHAR(191) NULL;

ALTER TABLE `Ticket`
  MODIFY COLUMN `status` ENUM('OPEN','CONFIRMED','CHECKED_IN','IN_PROGRESS','READY','CLOSED','CANCELLED','NO_SHOW') NOT NULL DEFAULT 'OPEN';

CREATE TABLE `CustomerAccountLedger` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NULL,
  `actorUserId` VARCHAR(191) NULL,
  `entryType` ENUM('OWED','CREDIT') NOT NULL,
  `amountCents` INT NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `referenceId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CustomerAccountLedger_tenant_customer_created_idx` (`tenantId`,`customerId`,`createdAt`),
  INDEX `CustomerAccountLedger_ticket_idx` (`ticketId`),
  INDEX `CustomerAccountLedger_actor_idx` (`actorUserId`),
  CONSTRAINT `CustomerAccountLedger_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerAccountLedger_customer_fk` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerAccountLedger_ticket_fk` FOREIGN KEY (`ticketId`) REFERENCES `Ticket` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CustomerAccountLedger_actor_fk` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerRewardLedger` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `ticketId` VARCHAR(191) NULL,
  `actorUserId` VARCHAR(191) NULL,
  `rewardId` VARCHAR(191) NULL,
  `points` INT NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `referenceId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `CustomerRewardLedger_tenant_customer_created_idx` (`tenantId`,`customerId`,`createdAt`),
  INDEX `CustomerRewardLedger_ticket_idx` (`ticketId`),
  INDEX `CustomerRewardLedger_reward_idx` (`rewardId`),
  CONSTRAINT `CustomerRewardLedger_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerRewardLedger_customer_fk` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerRewardLedger_ticket_fk` FOREIGN KEY (`ticketId`) REFERENCES `Ticket` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `CustomerRewardLedger_actor_fk` FOREIGN KEY (`actorUserId`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `RewardCatalogItem` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` VARCHAR(500) NULL,
  `rewardType` ENUM('FREE_SERVICE','DISCOUNT_DOLLARS','FREE_DAYCARE','PRODUCT','OTHER') NOT NULL,
  `pointsCost` INT NOT NULL,
  `discountCents` INT NULL,
  `serviceId` VARCHAR(191) NULL,
  `productId` VARCHAR(191) NULL,
  `secret` BOOLEAN NOT NULL DEFAULT true,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `RewardCatalogItem_tenant_active_idx` (`tenantId`,`active`),
  CONSTRAINT `RewardCatalogItem_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `RewardCatalogItem_service_fk` FOREIGN KEY (`serviceId`) REFERENCES `Service` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `RewardCatalogItem_product_fk` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `CustomerPaymentMethod` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `providerCustomerId` VARCHAR(191) NULL,
  `providerPaymentMethodId` VARCHAR(191) NOT NULL,
  `brand` VARCHAR(50) NULL,
  `last4` VARCHAR(4) NULL,
  `expMonth` INT NULL,
  `expYear` INT NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT false,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `CustomerPaymentMethod_provider_payment_unique` (`provider`,`providerPaymentMethodId`),
  INDEX `CustomerPaymentMethod_tenant_customer_active_idx` (`tenantId`,`customerId`,`active`),
  CONSTRAINT `CustomerPaymentMethod_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `Tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `CustomerPaymentMethod_customer_fk` FOREIGN KEY (`customerId`) REFERENCES `Customer` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `TenantSetting` (`id`,`tenantId`,`settingKey`,`value`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, 'NO_SHOW_FEE_CENTS', '4500', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `TenantSetting` s WHERE s.`tenantId`=t.`id` AND s.`settingKey`='NO_SHOW_FEE_CENTS');

INSERT INTO `TenantSetting` (`id`,`tenantId`,`settingKey`,`value`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, 'REWARD_POINTS_PER_DOLLAR', '1', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `TenantSetting` s WHERE s.`tenantId`=t.`id` AND s.`settingKey`='REWARD_POINTS_PER_DOLLAR');
