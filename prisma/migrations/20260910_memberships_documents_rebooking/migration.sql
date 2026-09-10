-- GroomPro membership lifecycle, tenant-configurable rebooking incentives, and signed-document storage.
CREATE TABLE IF NOT EXISTS `Membership` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `petId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  `startFeeCents` INT NOT NULL DEFAULT 100,
  `recurringPriceCents` INT NOT NULL DEFAULT 0,
  `billingDay` INT NOT NULL DEFAULT 1,
  `billingDaySecond` INT NULL,
  `billingInArrears` BOOLEAN NOT NULL DEFAULT true,
  `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `pauseRequestedAt` DATETIME(3) NULL,
  `pausedAt` DATETIME(3) NULL,
  `cancelRequestedAt` DATETIME(3) NULL,
  `finalBillingAt` DATETIME(3) NULL,
  `endedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Membership_tenant_customer_idx` (`tenantId`,`customerId`),
  INDEX `Membership_tenant_pet_idx` (`tenantId`,`petId`),
  INDEX `Membership_tenant_status_idx` (`tenantId`,`status`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MembershipBenefit` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `membershipId` VARCHAR(191) NOT NULL,
  `benefitType` VARCHAR(40) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `serviceId` VARCHAR(191) NULL,
  `packageId` VARCHAR(191) NULL,
  `productId` VARCHAR(191) NULL,
  `discountPct` DECIMAL(5,2) NULL,
  `discountCents` INT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `MembershipBenefit_tenant_membership_idx` (`tenantId`,`membershipId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MembershipPayment` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `membershipId` VARCHAR(191) NOT NULL,
  `amountCents` INT NOT NULL,
  `taxCents` INT NOT NULL DEFAULT 0,
  `paymentType` VARCHAR(32) NOT NULL DEFAULT 'CARD_ON_FILE',
  `status` VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  `scheduledFor` DATETIME(3) NOT NULL,
  `processedAt` DATETIME(3) NULL,
  `externalId` VARCHAR(191) NULL,
  `failureReason` VARCHAR(500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `MembershipPayment_tenant_membership_idx` (`tenantId`,`membershipId`,`scheduledFor`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MembershipRequest` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `membershipId` VARCHAR(191) NOT NULL,
  `requestType` VARCHAR(16) NOT NULL,
  `source` VARCHAR(32) NOT NULL,
  `receivedAt` DATETIME(3) NOT NULL,
  `receivedByUserId` VARCHAR(191) NULL,
  `emailFrom` VARCHAR(320) NULL,
  `emailSubject` VARCHAR(500) NULL,
  `emailBody` TEXT NULL,
  `documentPath` VARCHAR(1000) NULL,
  `effectiveAt` DATETIME(3) NULL,
  `finalBillingAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `MembershipRequest_tenant_membership_idx` (`tenantId`,`membershipId`,`receivedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `SignedDocument` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `petId` VARCHAR(191) NULL,
  `membershipId` VARCHAR(191) NULL,
  `documentType` VARCHAR(40) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `version` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'SIGNED',
  `signedAt` DATETIME(3) NULL,
  `signedByName` VARCHAR(255) NULL,
  `customerEmail` VARCHAR(320) NULL,
  `documentPath` VARCHAR(1000) NULL,
  `documentContent` LONGTEXT NULL,
  `signatureData` LONGTEXT NULL,
  `sentCopy` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `SignedDocument_tenant_customer_idx` (`tenantId`,`customerId`,`createdAt`),
  INDEX `SignedDocument_tenant_membership_idx` (`tenantId`,`membershipId`,`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RebookingDiscountRule` (
  `id` VARCHAR(191) NOT NULL,
  `tenantId` VARCHAR(191) NOT NULL,
  `weeks` INT NOT NULL,
  `discountPct` DECIMAL(5,2) NOT NULL,
  `label` VARCHAR(100) NOT NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `RebookingDiscountRule_tenant_weeks_key` (`tenantId`,`weeks`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Defaults: 6 weeks = 5%, 4 weeks = 10%, 2 weeks = 20% Touchup.
-- Rules are tenant-owned and can be changed without changing the application code.

INSERT INTO `TenantSetting` (`tenantId`,`settingKey`,`value`)
SELECT t.id, 'VIP_BILLING_DAYS', '1,15' FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `TenantSetting` s WHERE s.tenantId=t.id AND s.settingKey='VIP_BILLING_DAYS');

INSERT INTO `TenantSetting` (`tenantId`,`settingKey`,`value`)
SELECT t.id, 'VIP_BILLING_IN_ARREARS', 'true' FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `TenantSetting` s WHERE s.tenantId=t.id AND s.settingKey='VIP_BILLING_IN_ARREARS');

INSERT INTO `TenantSetting` (`tenantId`,`settingKey`,`value`)
SELECT t.id, 'VIP_CANCELLATION_NOTICE_DAYS', '30' FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `TenantSetting` s WHERE s.tenantId=t.id AND s.settingKey='VIP_CANCELLATION_NOTICE_DAYS');
