# Facility Control System

A universal Node.js + TypeScript backend for document-driven facility control, built to support multiple SQL databases via Prisma.

## Why this setup

- **Database-agnostic** using Prisma
- Supports **PostgreSQL, MySQL, SQL Server, SQLite**
- Starts simple with **SQLite local dev**
- Can later connect to **Supabase / PostgreSQL** with the same schema
- Includes basic document/template/version design and a publish workflow

## Getting started

1. Install Node.js 18+ and npm.
2. Copy `.env.example` to `.env`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```
5. Run the dev server:
   ```bash
   npm run dev
   ```

## Database targets

In `.env` you can switch between SQL engines.

- SQLite: `DATABASE_PROVIDER=sqlite`
- PostgreSQL: `DATABASE_PROVIDER=postgresql`
- MySQL: `DATABASE_PROVIDER=mysql`
- SQL Server: `DATABASE_PROVIDER=sqlserver`

Then update `DATABASE_URL` for the provider.

## Next step

- Open the project in your editor
- Run `npm install`
- Run `npx prisma migrate dev --name init`
- Start the server with `npm run dev`

