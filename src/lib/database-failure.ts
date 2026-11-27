// Only return predefined categories. Driver messages can contain connection details.
export function databaseFailure(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const prisma = error as Error & { code?: string; errorCode?: string };
  const code = prisma.code || prisma.errorCode;
  if (code && /^P[0-9]{4}$/.test(code)) return code;
  const message = error.message;
  if (/too many connections|connection limit/i.test(message)) return 'connection-limit';
  if (/query engine|libquery_engine|libssl|openssl/i.test(message)) return 'database-engine';
  if (/did not initialize|prisma generate/i.test(message)) return 'client-generation';
  if (/environment variable not found/i.test(message)) return 'missing-configuration';
  if (/access denied|authentication failed/i.test(message)) return 'database-sign-in';
  if (/reach database|connection refused/i.test(message)) return 'database-unreachable';
  if (/table.*does not exist/i.test(message)) return 'missing-table';
  if (/proxy|read.only|is not a function/i.test(message)) return 'database-client-access';
  return error.name.replace(/[^A-Za-z]/g, '').slice(0, 64) || 'unknown';
}
