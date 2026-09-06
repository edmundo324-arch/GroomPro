"use client";

import { useState } from "react";

const modules = ["Calendar", "Customers", "Pets", "Tickets", "Whiteboard", "Messaging", "Inventory", "Reports"];

export default function Home() {
  const [pin, setPin] = useState("");
  const [employee, setEmployee] = useState<string | null>(null);

  function enterPin() {
    if (pin.length >= 4 && pin.length <= 10) {
      setEmployee("Active Employee");
      setPin("");
    }
  }

  return (
    <main>
      <header style={{ background: "#17202a", color: "white", padding: "14px 20px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <strong style={{ fontSize: 22, marginRight: 16 }}>GroomPro Suite</strong>
        {modules.map((module) => <button key={module} style={{ background: "transparent", color: "white", border: 0, padding: "8px 10px", cursor: "pointer" }}>{module}</button>)}
        <span style={{ marginLeft: "auto" }}>{employee ? `Employee: ${employee}` : "Ready"}</span>
      </header>

      <section style={{ padding: 20 }}>
        <h1 style={{ marginTop: 0 }}>Calendar</h1>
        <p>GroomPro foundation is active. Calendar remains the primary workspace.</p>

        <div style={{ background: "white", borderRadius: 10, padding: 18, boxShadow: "0 1px 5px rgba(0,0,0,.12)" }}>
          <h2 style={{ marginTop: 0 }}>Quick Employee Switch</h2>
          <p style={{ marginBottom: 10 }}>Enter a 4–10 digit employee PIN when an action requires identification.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input aria-label="Employee PIN" inputMode="numeric" type="password" maxLength={10} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && enterPin()} placeholder="PIN" style={{ width: 150, padding: 10, border: "1px solid #bbb", borderRadius: 6 }} />
            <button onClick={enterPin} disabled={pin.length < 4} style={{ padding: "10px 16px", borderRadius: 6, border: "1px solid #888", cursor: "pointer" }}>Enter</button>
          </div>
        </div>
      </section>
    </main>
  );
}
