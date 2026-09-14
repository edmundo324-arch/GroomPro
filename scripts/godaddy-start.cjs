const { spawnSync } = require("node:child_process");

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(
      `Database configuration is missing: ${missing.join(", ")}. GoDaddy Hosted Database should provide the DB_* secrets automatically.`
    );
  }

  const user = encodeURIComponent(process.env.DB_USER);
  const password = encodeURIComponent(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "3306";
  const database = encodeURIComponent(process.env.DB_NAME);

  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

process.env.DATABASE_URL = buildDatabaseUrl();

console.log("GroomPro: applying pending database migrations...");
const migrate = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["prisma", "migrate", "deploy"],
  { stdio: "inherit", env: process.env }
);

if (migrate.status !== 0) {
  process.exit(migrate.status ?? 1);
}

console.log("GroomPro: starting application...");
const next = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "-p", process.env.PORT || "3000"],
  { stdio: "inherit", env: process.env }
);

process.exit(next.status ?? 1);
