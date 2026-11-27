import {scopedClient} from './customer-sharing-query';
import { PrismaClient } from "@prisma/client";
import { offlineTransaction } from "./offline-transaction";

const { databaseUrl } = require("../../scripts/database-config.cjs") as {
  databaseUrl: (env?: NodeJS.ProcessEnv) => string;
};
// Builds need no live database. Runtime and bootstrap resolve the same target.
const runtimeUrl = process.env.DATABASE_URL || process.env.DB_HOST ? databaseUrl() : undefined;

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Route bundles share one connection pool in the running server. Pass the same
// resolved URL used by bootstrap directly to the generated database client.
const client = global.prisma ??= new PrismaClient(runtimeUrl ? { datasourceUrl: runtimeUrl } : {});

// Replay runs existing route handlers inside the same transaction as its receipt.
export const db = new Proxy(client, {
  get(original, key) {
    const scope = offlineTransaction.getStore();
    if (scope && key === '$transaction') return (operation: any) =>
      typeof operation === 'function' ? operation(scopedClient(scope.tx)) : Promise.all(operation);
    const owner = scope && key in scope.tx ? scope.tx : original;
    const secured = scopedClient(owner);
    const value = Reflect.get(secured, key, secured);
    return typeof value === 'function' ? value.bind(owner) : value;
  },
});
