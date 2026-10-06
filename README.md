# Paisa — personal money tracker

Single-user. Upload bank/credit-card statements as CSV, auto-categorise with rules you teach, see a monthly dashboard, track holdings. Next.js 16 + Prisma + Postgres.

## CSV format (convert every statement to this)

```
date,account,description,amount,type,ref
2026-09-03,HDFC-SAV,SWIGGY BANGALORE,-450.00,DEBIT,UPI123456
2026-09-05,HDFC-SAV,SALARY XBP ASIA,117483.00,CREDIT,NEFT987
2026-09-07,CC-1,AMAZON PAY,-1299.00,DEBIT,
2026-09-10,HDFC-SAV,CC-1 CARD PAYMENT,-25000.00,DEBIT,
```

| Column | Rule |
|---|---|
| date | `YYYY-MM-DD` |
| account | must match an account code in the app (Accounts page) |
| description | raw narration from the statement |
| amount | signed. Negative = money out, positive = money in. Same for cards. |
| type | `DEBIT` or `CREDIT`. Must agree with the sign or the row is rejected. |
| ref | optional (UPI ref, cheque no) |

Re-uploading the same file is safe: duplicates are detected by a hash of account+date+amount+description and skipped.

Credit-card bill payments: categorise as **Transfer** so they are not counted as spending twice (once on the bank side, once as card purchases).

## Run locally

```
cp .env.example .env        # fill DATABASE_URL, APP_PASSWORD_HASH_B64, SESSION_SECRET
npm run db                  # local Postgres (prisma dev), prints a URL → put in .env (use 127.0.0.1 and add &pgbouncer=true&connection_limit=1)
npx prisma migrate dev
npx prisma db seed
npm run dev                 # also starts the local DB if it is down
```

**Local DB is throwaway.** `prisma dev` is a background process on this laptop. If it dies or the laptop reboots, run `npm run db` again. Data usually survives, but treat local uploads as practice. The real data home is Neon (see Deploy). Pages show a 500 when the DB is down.

Password hash (base64 so `$` chars survive env loaders): `node -e "console.log(Buffer.from(require('bcryptjs').hashSync('yourpass',10)).toString('base64'))"`

## Deploy (free)

1. Neon.tech → new project → copy connection string.
2. Locally: `DATABASE_URL=<neon> npx prisma migrate deploy && DATABASE_URL=<neon> npx prisma db seed`
3. Push to GitHub. Vercel → import repo → set the 3 env vars → deploy.
4. Open on phone → "Add to Home Screen".

## Tests

`npm test` — CSV parser and categoriser.
