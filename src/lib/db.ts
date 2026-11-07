import { PrismaClient } from "@prisma/client";
import { offlineTransaction } from "./offline-transaction";

const { databaseUrl } = require("../../scripts/database-config.cjs") as {
  databaseUrl: (env?: NodeJS.ProcessEnv) => string;
};
// Builds need no live database. Runtime and bootstrap resolve the same target.
if (process.env.DATABASE_URL || process.env.DB_HOST) process.env.DATABASE_URL = databaseUrl();

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const client = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = client;

// Replay runs existing route handlers inside the same transaction as its receipt.
export const db = new Proxy(client, {
  get(original, key) {
    const scope = offlineTransaction.getStore();
    if (scope && key === '$transaction') return (operation: any) =>
      typeof operation === 'function' ? operation(scope.tx) : Promise.all(operation);
    const owner = scope && key in scope.tx ? scope.tx : original;
    const value = Reflect.get(owner, key, owner);
    return typeof value === 'function' ? value.bind(owner) : value;
  },
});
