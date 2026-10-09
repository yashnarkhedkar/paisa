-- Data for PDF statement import. Idempotent: safe on a DB that was seeded with the same rows.
-- Personal keywords (own name, phone VPA) are NOT here: this repo is public. Add those on /rules.

INSERT INTO "Category" ("name", "isSpending") VALUES ('Reimbursement', false)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Account" ("code", "name", "kind", "format") VALUES
  ('BOB-SAV',  'Bank of Baroda Savings', 'BANK', 'BOB'),
  ('IDFC-SAV', 'IDFC FIRST Savings',     'BANK', 'IDFC'),
  ('AXIS-FK',  'Axis Flipkart Card',     'CARD', 'AXIS'),
  ('AXIS-NEO', 'Axis Neo Card',          'CARD', 'AXIS'),
  ('ICICI-CC', 'ICICI Credit Card',      'CARD', 'ICICI')
ON CONFLICT ("code") DO UPDATE SET "format" = EXCLUDED."format" WHERE "Account"."format" IS NULL;

INSERT INTO "Rule" ("keyword", "categoryId")
SELECT v.k, c.id FROM (VALUES
  ('cred.club', 'Transfer'), ('payment received', 'Transfer'),
  ('kalyan', 'Investment'), ('hdfclifeins', 'Bills')
) AS v(k, cat) JOIN "Category" c ON c.name = v.cat
ON CONFLICT ("keyword") DO NOTHING;
