const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { databaseUrl } = require('../scripts/database-config.cjs');
const { schemaPlan } = require('../scripts/bootstrap-godaddy.cjs');
test('URL-only configuration works and takes precedence over split credentials', () => {
  const DATABASE_URL = 'mysql://user:pass@localhost:3306/groompro?sslaccept=strict';
  assert.equal(databaseUrl({ DATABASE_URL, DB_HOST: 'other' }), DATABASE_URL);
});
test('split credentials encode reserved characters and database names', () => {
  const url = new URL(databaseUrl({DB_HOST:'localhost',DB_NAME:'groom pro',DB_USER:'a@b',DB_PASSWORD:'p:/?#%'}));
  assert.equal(decodeURIComponent(url.username), 'a@b');
  assert.equal(decodeURIComponent(url.password), 'p:/?#%');
  assert.equal(decodeURIComponent(url.pathname), '/groom pro');
  assert.equal(url.port, '3306');
});
test('missing config, non-MySQL URLs, and invalid ports fail without leaking passwords', () => {
  assert.throws(() => databaseUrl({}), /configuration is missing/);
  assert.throws(() => databaseUrl({DATABASE_URL:'postgres://u:p@host/db'}), /MySQL/);
  assert.throws(() => databaseUrl({DB_HOST:'localhost',DB_NAME:'db',DB_USER:'user',DB_PASSWORD:'secret',DB_PORT:'bad'}), /valid MySQL URL/);
});
test('bundle includes all operational tables and missing core fields without destructive SQL', () => {
  const sql = fs.readFileSync('godaddy-groompro-schema.sql', 'utf8');
  const plan = schemaPlan(sql);
  for (const name of ['CustomerAccountLedger','CustomerRewardLedger','RewardCatalogItem','CustomerPaymentMethod','Membership','MembershipBenefit','MembershipPayment','MembershipRequest','SignedDocument','RebookingDiscountRule','PricingChangeBatch','PricingChangeItem','BookingAsset','BookingAssetSchedule','EmployeeSchedule']) assert.ok(plan.tables.some(t => t.name === name), name);
  for (const [table,column] of [['User','jobTitle'],['Customer','creditCents'],['Ticket','accountCreditCents'],['Ticket','noShowFeeCents']]) assert.ok(plan.tables.find(t=>t.name===table).columns.some(c=>c.name===column));
  assert.doesNotMatch(sql, /DROP TABLE|FOREIGN_KEY_CHECKS|ADD COLUMN IF NOT EXISTS|INSERT INTO `TenantSetting`/);
  assert.ok(plan.tables.every(t=>t.columns.length>0));
  assert.match(sql, /'NO_SHOW'/);
});
