-- GroomPro demo customer contact update. Import into the existing GroomPro MySQL database.
-- 203 reviewed demo customer IDs, names, sample phones, and Cibolo addresses.
-- Fills missing phone numbers and compatible blank address components. Keeps existing values.
-- Each changed record receives a before-image in ImportRecord. Test phones are marked available for calling and SMS.
START TRANSACTION;
SET @groompro_demo_contact_run = UUID();

INSERT INTO ImportRecord (id, tenantId, source, entityType, sourceId, targetId, payload, createdAt, updatedAt)
SELECT UUID(), c.tenantId, 'groompro-demo-contacts-v1', 'CUSTOMER', c.id, c.id,
  JSON_OBJECT('run', @groompro_demo_contact_run, 'phoneFlagsVersion', 1, 'before', JSON_OBJECT('address1', c.address1, 'address2', c.address2, 'city', c.city, 'state', c.state, 'postalCode', c.postalCode),
    'after', JSON_OBJECT('address1', d.address1, 'address2', d.address2, 'city', d.city, 'state', d.state, 'postalCode', d.postalCode),
    'fillAddress', IF(((NULLIF(TRIM(c.address1), '') IS NULL) OR BINARY LOWER(TRIM(c.address1)) = BINARY LOWER(TRIM(d.address1)))
      AND ((NULLIF(TRIM(c.address2), '') IS NULL) OR BINARY LOWER(TRIM(c.address2)) = BINARY LOWER(TRIM(d.address2)))
      AND ((NULLIF(TRIM(c.city), '') IS NULL) OR BINARY LOWER(TRIM(c.city)) = BINARY LOWER(TRIM(d.city)))
      AND ((NULLIF(TRIM(c.state), '') IS NULL) OR BINARY LOWER(TRIM(c.state)) = BINARY LOWER(TRIM(d.state)))
      AND ((NULLIF(TRIM(c.postalCode), '') IS NULL) OR BINARY LOWER(TRIM(c.postalCode)) = BINARY LOWER(TRIM(d.postalCode))) AND (((NULLIF(TRIM(c.address1), '') IS NULL) AND d.address1 IS NOT NULL) OR ((NULLIF(TRIM(c.address2), '') IS NULL) AND d.address2 IS NOT NULL) OR ((NULLIF(TRIM(c.city), '') IS NULL) AND d.city IS NOT NULL) OR ((NULLIF(TRIM(c.state), '') IS NULL) AND d.state IS NOT NULL) OR ((NULLIF(TRIM(c.postalCode), '') IS NULL) AND d.postalCode IS NOT NULL)), 1, 0),
    'phone', IF(p.id IS NULL AND used.id IS NULL, d.phone, NULL)), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM (
  SELECT _utf8mb4'cmv3kbz780009v5kw1vowcjz6' AS sourceId, _utf8mb4'PIN' AS firstName, _utf8mb4'Customer' AS lastName, '210-555-0100' AS phone, '200 South Main Street' AS address1, NULL AS address2, 'Cibolo' AS city, 'TX' AS state, '78108' AS postalCode
  UNION ALL
  SELECT _utf8mb4'ui50_306d2c788aebdf16a0dac65fa9', _utf8mb4'William8', _utf8mb4'Eight', '210-555-0101', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_e518241a367d44942651a5a760', _utf8mb4'Charles18', _utf8mb4'Eighteen', '210-555-0102', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_69c238f0eea59882774138b0c1dd', _utf8mb4'Benjamin80', _utf8mb4'Eighty', '210-555-0103', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_7e0800b6128090ff9cc985ca440c', _utf8mb4'Patrick88', _utf8mb4'Eighty-Eight', '210-555-0104', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_b2f79e9d5dc0872567433e727453', _utf8mb4'Ruth85', _utf8mb4'Eighty-Five', '210-555-0105', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_eb765cd99be2e9cf3f637c85a224', _utf8mb4'Gregory84', _utf8mb4'Eighty-Four', '210-555-0106', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8b77a19207be7967f0432a71a31d', _utf8mb4'Catherine89', _utf8mb4'Eighty-Nine', '210-555-0107', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_abdb594091b0e37d8081aea00b0a', _utf8mb4'Katherine81', _utf8mb4'Eighty-One', '210-555-0108', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_d4e770d696d1fbdeb90bcdd9d76d', _utf8mb4'Christine87', _utf8mb4'Eighty-Seven', '210-555-0109', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_fe8ab6923fd25f8f834a8325daef', _utf8mb4'Alexander86', _utf8mb4'Eighty-Six', '210-555-0110', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_b684a4d836e129a3091f1a86cb0b', _utf8mb4'Emma83', _utf8mb4'Eighty-Three', '210-555-0111', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_efc266df9ad7f1cf379dc912f21c', _utf8mb4'Samuel82', _utf8mb4'Eighty-Two', '210-555-0112', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_6ef300a04829b15ac54d93b75a', _utf8mb4'Elizabeth11', _utf8mb4'Eleven', '210-555-0113', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_c0ac9ec88ac68d9740ee5cfadf', _utf8mb4'Susan15', _utf8mb4'Fifteen', '210-555-0114', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_7379d0dba272185a9cdc213775', _utf8mb4'Ronald50', _utf8mb4'Fifty', '210-555-0115', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f42a34ccd0ac7419b3c493e1bb5d', _utf8mb4'Ryan58', _utf8mb4'Fifty-Eight', '210-555-0116', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_642fba8518b280f43a045b9a10a2', _utf8mb4'Sharon55', _utf8mb4'Fifty-Five', '210-555-0117', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a90ca128f9b95074eb3d19c6aba7', _utf8mb4'Jason54', _utf8mb4'Fifty-Four', '210-555-0118', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_63905ef2e63f873db1489f87b9af', _utf8mb4'Cynthia59', _utf8mb4'Fifty-Nine', '210-555-0119', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_906ac2a4df5afd7780bfe78d7e59', _utf8mb4'Stephanie51', _utf8mb4'Fifty-One', '210-555-0120', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_bc8de011b5fa6786e5a00ca8da5e', _utf8mb4'Laura57', _utf8mb4'Fifty-Seven', '210-555-0121', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_abf684426ef5ed2261d20491e960', _utf8mb4'Jeffrey56', _utf8mb4'Fifty-Six', '210-555-0122', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_703fdb36641d02561360005dd4c6', _utf8mb4'Rebecca53', _utf8mb4'Fifty-Three', '210-555-0123', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a4b4d427d7ef35de221de3f126b1', _utf8mb4'Edward52', _utf8mb4'Fifty-Two', '210-555-0124', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_57a8d8ac4525b33461ad9fd73c', _utf8mb4'Patricia5', _utf8mb4'Five', '210-555-0125', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_fe2d9d7385def5d1bcbc5d5ead', _utf8mb4'Kenneth40', _utf8mb4'Forty', '210-555-0126', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_7f21aa46c9ab3d78852259a04f', _utf8mb4'Timothy48', _utf8mb4'Forty-Eight', '210-555-0127', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_abcf33193fd27f164f1805a0b3', _utf8mb4'Amanda45', _utf8mb4'Forty-Five', '210-555-0128', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_c345937f79329f964785161e5e', _utf8mb4'Brian44', _utf8mb4'Forty-Four', '210-555-0129', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_8ab11ea42ddd6d458984d57634', _utf8mb4'Deborah49', _utf8mb4'Forty-Nine', '210-555-0130', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_9b5aa1e5005f05ba56d2863407', _utf8mb4'Michelle41', _utf8mb4'Forty-One', '210-555-0131', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_4e24e5186e6a74e687ca646a8d', _utf8mb4'Melissa47', _utf8mb4'Forty-Seven', '210-555-0132', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_8f004c320b90654630e860c78e', _utf8mb4'George46', _utf8mb4'Forty-Six', '210-555-0133', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_fc2753c80143846ea4acc64883', _utf8mb4'Carol43', _utf8mb4'Forty-Three', '210-555-0134', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_12573d08d77bcb4231cc734202', _utf8mb4'Kevin42', _utf8mb4'Forty-Two', '210-555-0135', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_3c6a5edd05fd1bd28f565fff87', _utf8mb4'Robert4', _utf8mb4'Four', '210-555-0136', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_9de2c1e22f3ba985a3bc7d939d', _utf8mb4'Joseph14', _utf8mb4'Fourteen', '210-555-0137', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_8040ef56df19dadd3a8c623dc0', _utf8mb4'Linda9', _utf8mb4'Nine', '210-555-0138', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_8fddff0845bae36632606a135e', _utf8mb4'Sarah19', _utf8mb4'Nineteen', '210-555-0139', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_04b25d7afc829434d5b012243304', _utf8mb4'Frank90', _utf8mb4'Ninety', '210-555-0140', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a07737006450ac8063122083cdc1', _utf8mb4'Jerry98', _utf8mb4'Ninety-Eight', '210-555-0141', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_4562f36fc15f65ab6cafaae1506e', _utf8mb4'Carolyn95', _utf8mb4'Ninety-Five', '210-555-0142', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_87699b1eaf37dbfc4a86bb9b5ebd', _utf8mb4'Jack94', _utf8mb4'Ninety-Four', '210-555-0143', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a308d517f941afe0c673b1385b0e', _utf8mb4'Virginia99', _utf8mb4'Ninety-Nine', '210-555-0144', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_24d9b42772d5ed790a563c6bfbb0', _utf8mb4'Debra91', _utf8mb4'Ninety-One', '210-555-0145', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_4a81ec08355f4cf468c234f20679', _utf8mb4'Janet97', _utf8mb4'Ninety-Seven', '210-555-0146', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_7ebee5ed829a06f6c76425c569a0', _utf8mb4'Dennis96', _utf8mb4'Ninety-Six', '210-555-0147', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_64683b139c86bd6d9fc11f10e847', _utf8mb4'Rachel93', _utf8mb4'Ninety-Three', '210-555-0148', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_919fa1b0496216939f2770323c2b', _utf8mb4'Raymond92', _utf8mb4'Ninety-Two', '210-555-0149', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_5a03400a4ebd91f9082b59a047', _utf8mb4'John1', _utf8mb4'One', '210-555-0150', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_673fb34d6a7a4c908c248e1b8542', _utf8mb4'Tyler100', _utf8mb4'One Hundred', '210-555-0151', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_281379669f9d548917c0b56a4713', _utf8mb4'Peter108', _utf8mb4'One Hundred Eight', '210-555-0152', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_de2b5c1a4790b4279d420fba7bcf', _utf8mb4'Harold118', _utf8mb4'One Hundred Eighteen', '210-555-0153', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_d6d8c5e7a172e072f7bb4214eced', _utf8mb4'Philip180', _utf8mb4'One Hundred Eighty', '210-555-0154', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_85ff8b21cad878f275f3293437f9', _utf8mb4'John188', _utf8mb4'One Hundred Eighty-Eight', '210-555-0155', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_b24f7764e8056e0f9a42c2a27b1b', _utf8mb4'Diana185', _utf8mb4'One Hundred Eighty-Five', '210-555-0156', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_50a582ef70240481968aba7d7577', _utf8mb4'Johnny184', _utf8mb4'One Hundred Eighty-Four', '210-555-0157', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f901c07a91169be1179afbfb4bd9', _utf8mb4'James189', _utf8mb4'One Hundred Eighty-Nine', '210-555-0158', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_c5d6e8d72c3d7730aa2b38b063d0', _utf8mb4'Sophia181', _utf8mb4'One Hundred Eighty-One', '210-555-0159', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8003d225ebf39946d92b9c48c066', _utf8mb4'Brittany187', _utf8mb4'One Hundred Eighty-Seven', '210-555-0160', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_28633a69179f1891212a8d9d35e0', _utf8mb4'Bradley186', _utf8mb4'One Hundred Eighty-Six', '210-555-0161', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_18c88579d509d37fd1421cee7fb2', _utf8mb4'Marie183', _utf8mb4'One Hundred Eighty-Three', '210-555-0162', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_21330be2643cc6c825e39d2114a6', _utf8mb4'Bobby182', _utf8mb4'One Hundred Eighty-Two', '210-555-0163', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a44ae62c299371e7a733831a002e', _utf8mb4'Victoria111', _utf8mb4'One Hundred Eleven', '210-555-0164', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_6bf9c8e3c925f60149d179479cf5', _utf8mb4'Christina115', _utf8mb4'One Hundred Fifteen', '210-555-0165', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_6825cea5cc20fef6da1758c0e06c', _utf8mb4'Jesse150', _utf8mb4'One Hundred Fifty', '210-555-0166', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_c4244b7d40427cd22e757899ef15', _utf8mb4'Alan158', _utf8mb4'One Hundred Fifty-Eight', '210-555-0167', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_dfb7a10558a8a75f7c4d07177a9c', _utf8mb4'Alice155', _utf8mb4'One Hundred Fifty-Five', '210-555-0168', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_985e5d82f359d4e62a1f895afed4', _utf8mb4'Billy154', _utf8mb4'One Hundred Fifty-Four', '210-555-0169', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_e1bcbb492d8aa81f2678f9811912', _utf8mb4'Doris159', _utf8mb4'One Hundred Fifty-Nine', '210-555-0170', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_3a06ac6e30faa23ade49d0e4d2da', _utf8mb4'Janice151', _utf8mb4'One Hundred Fifty-One', '210-555-0171', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_e90a9565fe8693056f6cc0a2f584', _utf8mb4'Madison157', _utf8mb4'One Hundred Fifty-Seven', '210-555-0172', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_25c4b3e7c1c80a36d141b7b46e62', _utf8mb4'Bruce156', _utf8mb4'One Hundred Fifty-Six', '210-555-0173', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f0c8a0dd70ba25ec8705ad1092d4', _utf8mb4'Jean153', _utf8mb4'One Hundred Fifty-Three', '210-555-0174', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_fd2c5d8bcb48f6ac704ba6f2e334', _utf8mb4'Willie152', _utf8mb4'One Hundred Fifty-Two', '210-555-0175', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_501376913f697935a73494131d34', _utf8mb4'Diane105', _utf8mb4'One Hundred Five', '210-555-0176', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_19d23358fb2201c21cc98e02cf38', _utf8mb4'Christian140', _utf8mb4'One Hundred Forty', '210-555-0177', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_6300917345b3c70a9e2049f2e451', _utf8mb4'Austin148', _utf8mb4'One Hundred Forty-Eight', '210-555-0178', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_37fe103b11304f1411155019deb3', _utf8mb4'Teresa145', _utf8mb4'One Hundred Forty-Five', '210-555-0179', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_55b73a3bd69d96fc72c0a4ae19d0', _utf8mb4'Joe144', _utf8mb4'One Hundred Forty-Four', '210-555-0180', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8853f91f150bbb654e9132a7de71', _utf8mb4'Sara149', _utf8mb4'One Hundred Forty-Nine', '210-555-0181', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2491a9393ab973db4bf40c85dac2', _utf8mb4'Gloria141', _utf8mb4'One Hundred Forty-One', '210-555-0182', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a2be23d2202325f339c8e3c96601', _utf8mb4'Kathryn147', _utf8mb4'One Hundred Forty-Seven', '210-555-0183', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_aefbcbed3487ec936b01f2d1585b', _utf8mb4'Ethan146', _utf8mb4'One Hundred Forty-Six', '210-555-0184', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f53b34ac0efc4a1c5668df6e73d7', _utf8mb4'Ann143', _utf8mb4'One Hundred Forty-Three', '210-555-0185', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2387451bf9666e66736e432591da', _utf8mb4'Albert142', _utf8mb4'One Hundred Forty-Two', '210-555-0186', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_ce88c4f49d323081b3699676379b', _utf8mb4'Henry104', _utf8mb4'One Hundred Four', '210-555-0187', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_517d6f678ef87139788c358a5ba7', _utf8mb4'Zachary114', _utf8mb4'One Hundred Fourteen', '210-555-0188', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_7b4ad91af24fce8f8a46bbc45c31', _utf8mb4'Joyce109', _utf8mb4'One Hundred Nine', '210-555-0189', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_4c167f6c4ffdd9a2effde878e449', _utf8mb4'Joan119', _utf8mb4'One Hundred Nineteen', '210-555-0190', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_7a50fe74865eca91fe52ab4d5597', _utf8mb4'Mary190', _utf8mb4'One Hundred Ninety', '210-555-0191', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_5ccff917637b5d04cd5a6a666873', _utf8mb4'Elizabeth198', _utf8mb4'One Hundred Ninety-Eight', '210-555-0192', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_770bb6bb48d34a177d8b7f1c1926', _utf8mb4'William195', _utf8mb4'One Hundred Ninety-Five', '210-555-0193', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_6efd7ddae34c2d398778d2e4ff9a', _utf8mb4'Jennifer194', _utf8mb4'One Hundred Ninety-Four', '210-555-0194', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_730a8a0224a0b2ccb974e8f3e750', _utf8mb4'Richard199', _utf8mb4'One Hundred Ninety-Nine', '210-555-0195', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_e312f9eaf11266d36acc1e2d7323', _utf8mb4'Robert191', _utf8mb4'One Hundred Ninety-One', '210-555-0196', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2be99823a4f3e5b674f93c2f2ba2', _utf8mb4'David197', _utf8mb4'One Hundred Ninety-Seven', '210-555-0197', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_6974253635d903afb93d5266034e', _utf8mb4'Linda196', _utf8mb4'One Hundred Ninety-Six', '210-555-0198', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_bd4d10f6a78dabdb1a2e55dccde7', _utf8mb4'Michael193', _utf8mb4'One Hundred Ninety-Three', '210-555-0199', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8d9854040f9c49f931eb74ee1dc0', _utf8mb4'Patricia192', _utf8mb4'One Hundred Ninety-Two', '726-555-0100', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_51eef9786d508315bc61cdae9a40', _utf8mb4'Maria101', _utf8mb4'One Hundred One', '726-555-0101', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_0ef684ff6eed5e672c143fd67747', _utf8mb4'Julie107', _utf8mb4'One Hundred Seven', '726-555-0102', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_941cb3d9c3884dc368d18e8c9479', _utf8mb4'Lauren117', _utf8mb4'One Hundred Seventeen', '726-555-0103', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_196c75e802d5d3a0aafbcaa2c6f2', _utf8mb4'Randy170', _utf8mb4'One Hundred Seventy', '726-555-0104', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_cb79640113c46cb42aaeedf22205', _utf8mb4'Louis178', _utf8mb4'One Hundred Seventy-Eight', '726-555-0105', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f9757a3bef802618accfaba9be77', _utf8mb4'Beverly175', _utf8mb4'One Hundred Seventy-Five', '726-555-0106', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_36d715273528622d3bfddad0cf04', _utf8mb4'Vincent174', _utf8mb4'One Hundred Seventy-Four', '726-555-0107', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_c7ddbc23d97db98347dbd6f15afc', _utf8mb4'Theresa179', _utf8mb4'One Hundred Seventy-Nine', '726-555-0108', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_99b138b354f145ec37d2d9b495bf', _utf8mb4'Amber171', _utf8mb4'One Hundred Seventy-One', '726-555-0109', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_b8d69c18accb3c55340551c25e49', _utf8mb4'Danielle177', _utf8mb4'One Hundred Seventy-Seven', '726-555-0110', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a4be6339ee7e76441525807e70a9', _utf8mb4'Russell176', _utf8mb4'One Hundred Seventy-Six', '726-555-0111', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_bf94f68a9f5ebd3bafaeab515291', _utf8mb4'Marilyn173', _utf8mb4'One Hundred Seventy-Three', '726-555-0112', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f61aae40fed63317214490d2d75b', _utf8mb4'Eugene172', _utf8mb4'One Hundred Seventy-Two', '726-555-0113', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_b384b984ad96aacfa2d0d27780bb', _utf8mb4'Douglas106', _utf8mb4'One Hundred Six', '726-555-0114', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_276d622fd50309f987362ec5aa41', _utf8mb4'Walter116', _utf8mb4'One Hundred Sixteen', '726-555-0115', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_0786d0b762e21995c673786a15bd', _utf8mb4'Juan160', _utf8mb4'One Hundred Sixty', '726-555-0116', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_9e7a3ecbc805ede08b3000a31943', _utf8mb4'Ralph168', _utf8mb4'One Hundred Sixty-Eight', '726-555-0117', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_ede7de2f47e1291b61b5dbc2b3ee', _utf8mb4'Judy165', _utf8mb4'One Hundred Sixty-Five', '726-555-0118', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_08fefefb9b1c63f21cec01fd53c0', _utf8mb4'Jordan164', _utf8mb4'One Hundred Sixty-Four', '726-555-0119', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_193ed26fe84ef6e43d2f4337785f', _utf8mb4'Denise169', _utf8mb4'One Hundred Sixty-Nine', '726-555-0120', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_9b7f770beef8ed5ad66b6069d97e', _utf8mb4'Abigail161', _utf8mb4'One Hundred Sixty-One', '726-555-0121', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_eac4fba7f62d509b60573e8fb203', _utf8mb4'Grace167', _utf8mb4'One Hundred Sixty-Seven', '726-555-0122', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_c3ba4ce401c1c9b3ba09272aa5e0', _utf8mb4'Roy166', _utf8mb4'One Hundred Sixty-Six', '726-555-0123', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a091192e5a0192198f2ec18a8a25', _utf8mb4'Julia163', _utf8mb4'One Hundred Sixty-Three', '726-555-0124', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_0f6bef6c8e9a94c9394f2df0e941', _utf8mb4'Philip162', _utf8mb4'One Hundred Sixty-Two', '726-555-0125', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_41b1df757fa8c3773a23d13beda8', _utf8mb4'Adam110', _utf8mb4'One Hundred Ten', '726-555-0126', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f9aeb773704c461a110699f69681', _utf8mb4'Kelly113', _utf8mb4'One Hundred Thirteen', '726-555-0127', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_c190ce78304651e67be0ade138c5', _utf8mb4'Keith130', _utf8mb4'One Hundred Thirty', '726-555-0128', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_1a8d376e90f143548f82b8097d1b', _utf8mb4'Sean138', _utf8mb4'One Hundred Thirty-Eight', '726-555-0129', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_4d7f62d92ddc0ea398e74b6fb9dc', _utf8mb4'Martha135', _utf8mb4'One Hundred Thirty-Five', '726-555-0130', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_cf8a189ec31155ee3bf2327bb31e', _utf8mb4'Terry134', _utf8mb4'One Hundred Thirty-Four', '726-555-0131', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_40c706118834fc4732ad4ab7b60d', _utf8mb4'Frances139', _utf8mb4'One Hundred Thirty-Nine', '726-555-0132', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_0ef9f5951359f9455b6006ed8f3c', _utf8mb4'Andrea131', _utf8mb4'One Hundred Thirty-One', '726-555-0133', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_04db0ba3145ee8ef4e2bdde74d8c', _utf8mb4'Jacqueline137', _utf8mb4'One Hundred Thirty-Seven', '726-555-0134', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_021f038d4ad42e4614a25fce177b', _utf8mb4'Lawrence136', _utf8mb4'One Hundred Thirty-Six', '726-555-0135', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_1f461c3333a2ee73081e41a17eef', _utf8mb4'Hannah133', _utf8mb4'One Hundred Thirty-Three', '726-555-0136', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2193816424a435149ff798a237c3', _utf8mb4'Jeremy132', _utf8mb4'One Hundred Thirty-Two', '726-555-0137', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_be6d83a650164fb3be88a2a8a861', _utf8mb4'Heather103', _utf8mb4'One Hundred Three', '726-555-0138', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_7d110bcd23562b25524e063e8838', _utf8mb4'Nathan112', _utf8mb4'One Hundred Twelve', '726-555-0139', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8e8a3b5415741d0017a92da91a3a', _utf8mb4'Kyle120', _utf8mb4'One Hundred Twenty', '726-555-0140', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_458355b9011dd7e47ffd8ddda2ac', _utf8mb4'Roger128', _utf8mb4'One Hundred Twenty-Eight', '726-555-0141', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_00c0eb0cebdc3f678a6f9bcd5ae7', _utf8mb4'Judith125', _utf8mb4'One Hundred Twenty-Five', '726-555-0142', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_dfe2f634a4e54ea027ea06dab79a', _utf8mb4'Arthur124', _utf8mb4'One Hundred Twenty-Four', '726-555-0143', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_825fba5a6802ce456410d4422536', _utf8mb4'Cheryl129', _utf8mb4'One Hundred Twenty-Nine', '726-555-0144', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2d60076138641b03b746e2687a07', _utf8mb4'Evelyn121', _utf8mb4'One Hundred Twenty-One', '726-555-0145', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_4053ebaa2d51dc324881ec6470b8', _utf8mb4'Megan127', _utf8mb4'One Hundred Twenty-Seven', '726-555-0146', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_ff20ca836690b613acd8fe8c047e', _utf8mb4'Gerald126', _utf8mb4'One Hundred Twenty-Six', '726-555-0147', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_0e1dbe1664f288df9e5443379fd4', _utf8mb4'Olivia123', _utf8mb4'One Hundred Twenty-Three', '726-555-0148', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8a8b08cce3521cb9d00c194fbf4d', _utf8mb4'Carl122', _utf8mb4'One Hundred Twenty-Two', '726-555-0149', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_fe8d4957f18233dd496f938207ea', _utf8mb4'Aaron102', _utf8mb4'One Hundred Two', '726-555-0150', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_89614fdaf736c1a67b43a7a2cd', _utf8mb4'Jennifer7', _utf8mb4'Seven', '726-555-0151', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_1f1f41c6960b65d28057f6ec70', _utf8mb4'Jessica17', _utf8mb4'Seventeen', '726-555-0152', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_d46f9c1d5ef89dae7e04e567dc8d', _utf8mb4'Stephen70', _utf8mb4'Seventy', '726-555-0153', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_fe38392d17329320012ea25b092f', _utf8mb4'Brandon78', _utf8mb4'Seventy-Eight', '726-555-0154', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_374c64b425d788777048a3b4f2d2', _utf8mb4'Pamela75', _utf8mb4'Seventy-Five', '726-555-0155', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_8871baec85ec4c3f28746e31d6f7', _utf8mb4'Justin74', _utf8mb4'Seventy-Four', '726-555-0156', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2e4b559368db5ba488380cc1e964', _utf8mb4'Samantha79', _utf8mb4'Seventy-Nine', '726-555-0157', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_3168001a7a6ea321f339e2187138', _utf8mb4'Anna71', _utf8mb4'Seventy-One', '726-555-0158', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_c3962e8d9a8eb61c1b920f81e05c', _utf8mb4'Nicole77', _utf8mb4'Seventy-Seven', '726-555-0159', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_f798820d570c923a13cbdadf7ee1', _utf8mb4'Scott76', _utf8mb4'Seventy-Six', '726-555-0160', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_2faf6095c5ebcca6dd597ad69ac7', _utf8mb4'Brenda73', _utf8mb4'Seventy-Three', '726-555-0161', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_fc612e1f4140560c393e00b147ef', _utf8mb4'Larry72', _utf8mb4'Seventy-Two', '726-555-0162', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_a11b66e47714ab80c1993d9cd4', _utf8mb4'Michael6', _utf8mb4'Six', '726-555-0163', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_a17826e846abba6c6ddb2bd77d', _utf8mb4'Thomas16', _utf8mb4'Sixteen', '726-555-0164', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_ba7c403665e70249973b8bf4aaf8', _utf8mb4'Jacob60', _utf8mb4'Sixty', '726-555-0165', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_fe125042b3d5c51383b14d90b427', _utf8mb4'Jonathan68', _utf8mb4'Sixty-Eight', '726-555-0166', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_3ee0c908523d4ab26ab640da6755', _utf8mb4'Shirley65', _utf8mb4'Sixty-Five', '726-555-0167', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_01d266a87c192e1990e615145233', _utf8mb4'Nicholas64', _utf8mb4'Sixty-Four', '726-555-0168', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_cc083faab43b705450b971f5d798', _utf8mb4'Helen69', _utf8mb4'Sixty-Nine', '726-555-0169', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_a5fcbbb9815075c1de07da0d3a60', _utf8mb4'Kathleen61', _utf8mb4'Sixty-One', '726-555-0170', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_49f3880ea802373ba9c38502dd92', _utf8mb4'Angela67', _utf8mb4'Sixty-Seven', '726-555-0171', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_3c20c3a51c3ab4685498489d68fc', _utf8mb4'Eric66', _utf8mb4'Sixty-Six', '726-555-0172', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_110fa38caa7e151812f74692c596', _utf8mb4'Amy63', _utf8mb4'Sixty-Three', '726-555-0173', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_7f0560993fcf91226707e842e9ff', _utf8mb4'Gary62', _utf8mb4'Sixty-Two', '726-555-0174', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_22e49bdf0f68b1ac15f9cb0716', _utf8mb4'David10', _utf8mb4'Ten', '726-555-0175', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_31bc199c1c460cded1021840a7', _utf8mb4'Barbara13', _utf8mb4'Thirteen', '726-555-0176', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_48eabc28ccf64042751daf0c10', _utf8mb4'Donald30', _utf8mb4'Thirty', '726-555-0177', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_7356dbc8cf94855dc9bbef7fbf', _utf8mb4'Joshua38', _utf8mb4'Thirty-Eight', '726-555-0178', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_3dc901a7e69be0bd0b427b7cb4', _utf8mb4'Kimberly35', _utf8mb4'Thirty-Five', '726-555-0179', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_297e29030597c00e659ffd60c3', _utf8mb4'Paul34', _utf8mb4'Thirty-Four', '726-555-0180', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_bd6d41a1e46150e180e32660c3', _utf8mb4'Donna39', _utf8mb4'Thirty-Nine', '726-555-0181', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_65a740b90dc0896f99288ff067', _utf8mb4'Sandra31', _utf8mb4'Thirty-One', '726-555-0182', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_782860cd4a52d2dc2de6bf0d6d', _utf8mb4'Emily37', _utf8mb4'Thirty-Seven', '726-555-0183', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_e3467f7c3d47537dfb7ff66bf8', _utf8mb4'Andrew36', _utf8mb4'Thirty-Six', '726-555-0184', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_95d404b122e040293485bf6e22', _utf8mb4'Ashley33', _utf8mb4'Thirty-Three', '726-555-0185', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_f34fdcfa6caec1b7618632e023', _utf8mb4'Steven32', _utf8mb4'Thirty-Two', '726-555-0186', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'cmvj1o3as003gv5h4etugtz68', _utf8mb4'Edmundo', _utf8mb4'Three', '726-555-0187', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_31253a135e0b4275c0b4183332', _utf8mb4'Mary3', _utf8mb4'Three', '726-555-0188', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_c02038d29e1e9801dfd317ad9a', _utf8mb4'Richard12', _utf8mb4'Twelve', '726-555-0189', '850 FM 1103', 'Suite 100', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_05215e6f83302a2959e2d1dd74', _utf8mb4'Christopher20', _utf8mb4'Twenty', '726-555-0190', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_5ccb890a4f3ea45bc50ec8093a', _utf8mb4'Mark28', _utf8mb4'Twenty-Eight', '726-555-0191', '200 South Main Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_a74dbb6688d5efc4c00920f952', _utf8mb4'Lisa25', _utf8mb4'Twenty-Five', '726-555-0192', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_a6801d6f6c066e384736133de2', _utf8mb4'Matthew24', _utf8mb4'Twenty-Four', '726-555-0193', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_22723db57e99737b1231fb855a', _utf8mb4'Margaret29', _utf8mb4'Twenty-Nine', '726-555-0194', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_14cfb43b01661226b28fe60231', _utf8mb4'Karen21', _utf8mb4'Twenty-One', '726-555-0195', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_8420cde90e00702f9df0006e91', _utf8mb4'Betty27', _utf8mb4'Twenty-Seven', '726-555-0196', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_5db178210c02b3fb645ad43a89', _utf8mb4'Anthony26', _utf8mb4'Twenty-Six', '726-555-0197', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_84fff77309273f75db2c6b3561', _utf8mb4'Nancy23', _utf8mb4'Twenty-Three', '726-555-0198', '108 Cibolo Drive', 'Building 3', 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_6b2ef4f8936ec38ddb58eee5d8', _utf8mb4'Daniel22', _utf8mb4'Twenty-Two', '726-555-0199', '4093 Green Valley Road', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'ui50_92eba1796cfd612c27c5e57a23', _utf8mb4'James2', _utf8mb4'Two', '830-555-0100', '3864 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'demo200_0a03a91c0700b34ab8b42f484709', _utf8mb4'Barbara200', _utf8mb4'Two Hundred', '830-555-0101', '200 Schlather Street', NULL, 'Cibolo', 'TX', '78108'
  UNION ALL
  SELECT _utf8mb4'pos-layout-owner', _utf8mb4'Layout', _utf8mb4'Verification', '830-555-0102', '602 Cibolo Valley Drive', NULL, 'Cibolo', 'TX', '78108'
) d
LEFT JOIN ImportRecord r ON BINARY r.sourceId = BINARY d.sourceId
  AND r.source = 'GroomPro Local Demo 2026' AND r.entityType = 'CUSTOMER'
  AND JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.preparedFixture')) = '52d79f0b28915f4c8a58bc2a360366238d9eb0a2fe3590433aac17fe4514aede'
JOIN Customer c ON (BINARY c.id = BINARY d.sourceId OR BINARY c.importSourceId = BINARY d.sourceId OR (c.id = r.targetId AND c.tenantId = r.tenantId))
  AND BINARY LOWER(TRIM(c.firstName)) = BINARY LOWER(TRIM(d.firstName))
  AND BINARY LOWER(TRIM(c.lastName)) = BINARY LOWER(TRIM(d.lastName))
LEFT JOIN CustomerPhone p ON p.tenantId = c.tenantId AND p.customerId = c.id
LEFT JOIN CustomerPhone used ON used.tenantId = c.tenantId AND BINARY used.normalized = BINARY REPLACE(d.phone, '-', '')
WHERE (p.id IS NULL AND used.id IS NULL) OR (((NULLIF(TRIM(c.address1), '') IS NULL) OR BINARY LOWER(TRIM(c.address1)) = BINARY LOWER(TRIM(d.address1)))
      AND ((NULLIF(TRIM(c.address2), '') IS NULL) OR BINARY LOWER(TRIM(c.address2)) = BINARY LOWER(TRIM(d.address2)))
      AND ((NULLIF(TRIM(c.city), '') IS NULL) OR BINARY LOWER(TRIM(c.city)) = BINARY LOWER(TRIM(d.city)))
      AND ((NULLIF(TRIM(c.state), '') IS NULL) OR BINARY LOWER(TRIM(c.state)) = BINARY LOWER(TRIM(d.state)))
      AND ((NULLIF(TRIM(c.postalCode), '') IS NULL) OR BINARY LOWER(TRIM(c.postalCode)) = BINARY LOWER(TRIM(d.postalCode))) AND (((NULLIF(TRIM(c.address1), '') IS NULL) AND d.address1 IS NOT NULL) OR ((NULLIF(TRIM(c.address2), '') IS NULL) AND d.address2 IS NOT NULL) OR ((NULLIF(TRIM(c.city), '') IS NULL) AND d.city IS NOT NULL) OR ((NULLIF(TRIM(c.state), '') IS NULL) AND d.state IS NOT NULL) OR ((NULLIF(TRIM(c.postalCode), '') IS NULL) AND d.postalCode IS NOT NULL)))
ON DUPLICATE KEY UPDATE id = ImportRecord.id;

UPDATE Customer c JOIN ImportRecord b ON b.tenantId = c.tenantId AND b.targetId = c.id AND b.sourceId = c.id
  AND b.source = 'groompro-demo-contacts-v1' AND b.entityType = 'CUSTOMER' AND BINARY JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.run')) = BINARY @groompro_demo_contact_run
SET c.address1 = IF((NULLIF(TRIM(c.address1), '') IS NULL), IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.after.address1')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.after.address1'))), c.address1),
    c.address2 = IF((NULLIF(TRIM(c.address2), '') IS NULL), IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.after.address2')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.after.address2'))), c.address2),
    c.city = IF((NULLIF(TRIM(c.city), '') IS NULL), IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.after.city')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.after.city'))), c.city),
    c.state = IF((NULLIF(TRIM(c.state), '') IS NULL), IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.after.state')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.after.state'))), c.state),
    c.postalCode = IF((NULLIF(TRIM(c.postalCode), '') IS NULL), IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.after.postalCode')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.after.postalCode'))), c.postalCode),
    c.updatedAt = CURRENT_TIMESTAMP(3)
WHERE JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.fillAddress')) = '1'
  AND BINARY c.address1 <=> BINARY IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.before.address1')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.before.address1')))
  AND BINARY c.address2 <=> BINARY IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.before.address2')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.before.address2')))
  AND BINARY c.city <=> BINARY IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.before.city')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.before.city')))
  AND BINARY c.state <=> BINARY IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.before.state')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.before.state')))
  AND BINARY c.postalCode <=> BINARY IF(JSON_TYPE(JSON_EXTRACT(b.payload, '$.before.postalCode')) = 'NULL', NULL, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.before.postalCode')));
SET @groompro_addresses_filled = ROW_COUNT();

INSERT INTO CustomerPhone (id, tenantId, customerId, number, normalized, label, isPrimary, smsEnabled, callEnabled)
SELECT UUID(), b.tenantId, c.id, JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.phone')),
  REPLACE(JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.phone')), '-', ''), 'Demo phone', 1, 1, 1
FROM ImportRecord b JOIN Customer c ON c.tenantId = b.tenantId AND c.id = b.targetId
LEFT JOIN CustomerPhone p ON p.tenantId = c.tenantId AND p.customerId = c.id
WHERE b.source = 'groompro-demo-contacts-v1' AND b.entityType = 'CUSTOMER' AND BINARY JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.run')) = BINARY @groompro_demo_contact_run
  AND JSON_TYPE(JSON_EXTRACT(b.payload, '$.phone')) = 'STRING' AND p.id IS NULL
ON DUPLICATE KEY UPDATE id = CustomerPhone.id;
SET @groompro_phones_added = ROW_COUNT();

-- Restore only demo numbers inserted by the earlier contact file with both flags off.
UPDATE CustomerPhone p
JOIN ImportRecord b ON b.tenantId = p.tenantId AND b.targetId = p.customerId
  AND b.source = 'groompro-demo-contacts-v1' AND b.entityType = 'CUSTOMER'
  AND BINARY p.number = BINARY JSON_UNQUOTE(JSON_EXTRACT(b.payload, '$.phone'))
SET p.smsEnabled = 1, p.callEnabled = 1
WHERE p.label = 'Demo phone' AND p.smsEnabled = 0 AND p.callEnabled = 0
  AND JSON_EXTRACT(b.payload, '$.phoneFlagsVersion') IS NULL;
SET @groompro_phones_reenabled = ROW_COUNT();

UPDATE ImportRecord b
SET b.payload = JSON_SET(b.payload, '$.phoneFlagsVersion', 1), b.updatedAt = CURRENT_TIMESTAMP(3)
WHERE b.source = 'groompro-demo-contacts-v1' AND b.entityType = 'CUSTOMER'
  AND JSON_TYPE(JSON_EXTRACT(b.payload, '$.phone')) = 'STRING'
  AND JSON_EXTRACT(b.payload, '$.phoneFlagsVersion') IS NULL;
COMMIT;
SELECT @groompro_addresses_filled AS addresses_completed, @groompro_phones_added AS phones_added, @groompro_phones_reenabled AS phones_reenabled;
