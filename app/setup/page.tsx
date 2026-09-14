"use client";

import { useState } from "react";

export default function SetupPage() {
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function seed() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/setup/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Seed failed.");
      setMessage(`Seeded ${data.seeded.customerCount} customers, ${data.seeded.employeeCount} employees, and ${data.seeded.assetCount} booking assets.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seed failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">GroomPro Setup</h1>
        <p className="mt-2 text-sm text-slate-600">Initialize the preview database with development data.</p>
        <label className="mt-6 block text-sm font-medium text-slate-700">Setup Secret</label>
        <input
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={seed}
          disabled={busy || !secret}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Seeding…" : "Seed Preview Database"}
        </button>
        {message && <p className="mt-4 text-sm text-slate-700">{message}</p>}
      </div>
    </main>
  );
}
