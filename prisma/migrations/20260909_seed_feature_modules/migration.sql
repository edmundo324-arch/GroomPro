INSERT IGNORE INTO FeatureModule (id, code, name, description, active, createdAt, updatedAt) VALUES
  (UUID(), 'CALENDAR', 'Calendar', 'Primary appointment and schedule workspace.', true, NOW(), NOW()),
  (UUID(), 'CUSTOMERS', 'Customers', 'Customer records, search, profiles, and customer history.', true, NOW(), NOW()),
  (UUID(), 'PETS', 'Pets', 'Pet profiles, grooming history, and vaccination records.', true, NOW(), NOW()),
  (UUID(), 'TICKETS', 'Tickets & Appointments', 'The central Ticket/Appointment workflow.', true, NOW(), NOW()),
  (UUID(), 'WHITEBOARD', 'Whiteboard', 'Touch-first grooming-floor operational display.', true, NOW(), NOW()),
  (UUID(), 'MESSAGING', 'Messaging', 'Two-way customer messaging and communication history.', true, NOW(), NOW()),
  (UUID(), 'INVENTORY', 'Inventory', 'Products, supplies, and inventory management.', true, NOW(), NOW()),
  (UUID(), 'REPORTS', 'Reports', 'Business and operational reporting.', true, NOW(), NOW()),
  (UUID(), 'ONLINE_BOOKING', 'Online Booking', 'Customer-facing online appointment requests.', true, NOW(), NOW()),
  (UUID(), 'DAYCARE', 'Daycare', 'Daycare workflow and ticket-level daycare tracking.', true, NOW(), NOW()),
  (UUID(), 'BOARDING', 'Boarding', 'Boarding reservations and occupancy management.', true, NOW(), NOW()),
  (UUID(), 'SETTINGS', 'Settings', 'Business, location, pricing, permissions, and personalization controls.', true, NOW(), NOW());
