# MST Household Operations System

Admin operations system for a merchandising goods business with customer balances, invoices, payments, cheques, inventory, supplier payables, expenses, and daily/cutoff reports.

## Stack

- Next.js App Router
- Supabase Auth and Postgres
- Vercel deployment
- TypeScript and Tailwind CSS

## Setup

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor or through the Supabase CLI.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key.
4. Install dependencies with `npm.cmd install`.
5. Start development with `npm.cmd run dev`.

## First Admin

After signing up/signing in through Supabase Auth, insert a matching row into `profiles` with role `admin`, or update the created profile row:

```sql
update profiles set role = 'admin' where email = 'admin@example.com';
```

Staff users can use operational pages. Admin users can access settings and protected reporting/correction flows.
