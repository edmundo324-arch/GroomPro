INSERT INTO `RewardCatalogItem` (`id`,`tenantId`,`name`,`description`,`rewardType`,`pointsCost`,`discountCents`,`serviceId`,`productId`,`secret`,`active`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, 'Free Paw Balm Massage', 'Sales-team reward option.', 'FREE_SERVICE', 50, NULL, NULL, NULL, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `RewardCatalogItem` r WHERE r.`tenantId`=t.`id` AND r.`name`='Free Paw Balm Massage');

INSERT INTO `RewardCatalogItem` (`id`,`tenantId`,`name`,`description`,`rewardType`,`pointsCost`,`discountCents`,`serviceId`,`productId`,`secret`,`active`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, 'Free Deshedding Shampoo Treatment', 'Sales-team reward option.', 'FREE_SERVICE', 75, NULL, NULL, NULL, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `RewardCatalogItem` r WHERE r.`tenantId`=t.`id` AND r.`name`='Free Deshedding Shampoo Treatment');

INSERT INTO `RewardCatalogItem` (`id`,`tenantId`,`name`,`description`,`rewardType`,`pointsCost`,`discountCents`,`serviceId`,`productId`,`secret`,`active`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, '$5 Off', 'Sales-team reward option.', 'DISCOUNT_DOLLARS', 50, 500, NULL, NULL, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `RewardCatalogItem` r WHERE r.`tenantId`=t.`id` AND r.`name`='$5 Off');

INSERT INTO `RewardCatalogItem` (`id`,`tenantId`,`name`,`description`,`rewardType`,`pointsCost`,`discountCents`,`serviceId`,`productId`,`secret`,`active`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, '$10 Off', 'Sales-team reward option.', 'DISCOUNT_DOLLARS', 100, 1000, NULL, NULL, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `RewardCatalogItem` r WHERE r.`tenantId`=t.`id` AND r.`name`='$10 Off');

INSERT INTO `RewardCatalogItem` (`id`,`tenantId`,`name`,`description`,`rewardType`,`pointsCost`,`discountCents`,`serviceId`,`productId`,`secret`,`active`,`createdAt`,`updatedAt`)
SELECT UUID(), t.`id`, 'Free Daycare', 'Sales-team reward option.', 'FREE_DAYCARE', 150, NULL, NULL, NULL, true, true, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `Tenant` t
WHERE NOT EXISTS (SELECT 1 FROM `RewardCatalogItem` r WHERE r.`tenantId`=t.`id` AND r.`name`='Free Daycare');
