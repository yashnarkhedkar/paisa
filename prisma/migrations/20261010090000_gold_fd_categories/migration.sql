-- Split Investment into Gold and FD so the home page can break investments down. Idempotent.
INSERT INTO "Category" ("name", "isSpending") VALUES ('Gold', false), ('FD', false)
ON CONFLICT ("name") DO NOTHING;

UPDATE "Rule" SET "categoryId" = (SELECT id FROM "Category" WHERE name = 'Gold')
WHERE keyword IN ('kalyan', 'gold scheme') AND "categoryId" = (SELECT id FROM "Category" WHERE name = 'Investment');

UPDATE "Rule" SET "categoryId" = (SELECT id FROM "Category" WHERE name = 'FD')
WHERE keyword = 'fixed deposit' AND "categoryId" = (SELECT id FROM "Category" WHERE name = 'Investment');

-- rows already tagged Investment by those rules move with them
UPDATE "Transaction" SET "categoryId" = (SELECT id FROM "Category" WHERE name = 'Gold')
WHERE "categoryId" = (SELECT id FROM "Category" WHERE name = 'Investment')
  AND (description ILIKE '%kalyan%' OR description ILIKE '%gold scheme%');

UPDATE "Transaction" SET "categoryId" = (SELECT id FROM "Category" WHERE name = 'FD')
WHERE "categoryId" = (SELECT id FROM "Category" WHERE name = 'Investment')
  AND description ILIKE '%fixed deposit%';
