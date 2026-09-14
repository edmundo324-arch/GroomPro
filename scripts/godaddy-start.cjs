const { spawn } = require("node:child_process");

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Database configuration is missing: ${missing.join(", ")}.`);
  const user = encodeURIComponent(process.env.DB_USER);
  const password = encodeURIComponent(process.env.DB_PASSWORD);
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "3306";
  const database = encodeURIComponent(process.env.DB_NAME);
  return `mysql://${user}:${password}@${host}:${port}/${database}`;
}

process.env.DATABASE_URL = buildDatabaseUrl();
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

// Start Next immediately so GoDaddy's readiness check can see a live server.
const next = spawn(npm, ["exec", "--", "next", "start", "-p", process.env.PORT || "3000"], {
  stdio: "inherit",
  env: process.env,
});

// Apply migrations without blocking the application from becoming ready.
const migrate = spawn(npm, ["exec", "--", "prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});

migrate.on("exit", (code) => {
  if (code === 0) console.log("GroomPro: database migrations complete.");
  else console.error(`GroomPro: database migration exited with code ${code}.`);
});

next.on("exit", (code, signal) => {
  if (migrate.exitCode === null) migrate.kill("SIGTERM");
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (next.exitCode === null) next.kill(signal);
    if (migrate.exitCode === null) migrate.kill(signal);
  });
}
