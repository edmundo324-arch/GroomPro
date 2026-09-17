import { PrismaClient } from "@prisma/client";

const { databaseUrl } = require("../../scripts/database-config.cjs") as {
  databaseUrl: (env?: NodeJS.ProcessEnv) => string;
};
// Builds need no live database. Runtime and bootstrap resolve the same target.
if (process.env.DATABASE_URL || process.env.DB_HOST) process.env.DATABASE_URL = databaseUrl();

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const db = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = db;
