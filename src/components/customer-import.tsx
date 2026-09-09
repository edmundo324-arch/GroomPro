"use client";
import { useMemo, useState } from "react";
import { CUSTOMER_IMPORT_FIELDS, type ImportFieldKey } from "@/src/lib/import-fields";
import { validateImportMapping } from "@/src/lib/import-validation";

const fields = Object.entries(CUSTOMER_IMPORT_FIELDS) as [ImportFieldKey, { label: string; description: string }][];
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i + 1] === '"') { cell += '"'; i++; } else quote = !quote;
    } else if (c === ',' && !quote) { row.push(cell); cell = ""; }
    else if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some(x => x.trim())) rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function guess(header: string): ImportFieldKey | "" {
  const n = normalize(header);
  const exact = fields.find(([key, f]) => normalize(f.label) === n || normalize(key) === n);
  if (exact) return exact[0];
  const aliases: Record<string, ImportFieldKey> = {
    firstname: "firstName", fname: "firstName", lastname: "lastName", lname: "lastName",
    emailaddress: "email", phone: "phone", phonenumber: "phone", mobile: "phone",
    address: "address1", address1: "address1", street: "address1", address2: "address2",
    zipcode: "postalCode", zip: "postalCode", postalcode: "postalCode", city: "city", state: "state",
    dogname: "dog1Name", dog1: "dog1Name", dog1name: "dog1Name", dog2: "dog2Name", dog2name: "dog2Name",
    dog3: "dog3Name", dog3name: "dog3Name", dog4: "dog4Name", dog4name: "dog4Name",
    dog5: "dog5Name", dog5name: "dog5Name",
  };
  return aliases[n] || "";
}

export function CustomerImport() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const mappingErrors = useMemo(() => validateImportMapping(mapping), [mapping]);
  const invalid = mappingErrors.length > 0;

  async function loadFile(file: File) {
    const raw = parseCsv(await file.text());
    if (!raw.length) return;
    const hs = raw[0].map(x => x.trim());
    setHeaders(hs);
    setRows(raw.slice(1).map(r => Object.fromEntries(hs.map((h, i) => [h, r[i] || ""]))));
    const guessed: Record<string, string> = {};
    hs.forEach(h => { const g = guess(h); if (g && !Object.values(guessed).includes(g)) guessed[h] = g; });
    setMapping(guessed); setFileName(file.name); setResult(null);
  }

  async function submit(dryRun: boolean) {
    if (invalid) { setResult({ error: mappingErrors.join(" ") }); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/import/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows, mapping, dryRun }) });
      setResult(await r.json());
    } catch { setResult({ error: "Import could not be completed." }); }
    finally { setBusy(false); }
  }

  return <section className="gp-settings-card gp-settings-wide">
    <div className="gp-settings-card-head"><div><h2>Import Client Data</h2><p>Upload a CSV, let GroomPro recognize familiar headers, then manually map anything unfamiliar before data enters the database.</p></div>
      <label className="gp-btn primary">Choose CSV<input type="file" accept=".csv,text/csv" hidden onChange={e => e.target.files?.[0] && loadFile(e.target.files[0])} /></label>
    </div>
    {fileName && <>
      <div className="gp-import-file"><strong>{fileName}</strong><span>{rows.length.toLocaleString()} client rows detected</span></div>
      <div className="gp-import-help"><strong>Unfamiliar source headers are welcome.</strong> A source header such as <code>Ab2</code> can be mapped to <strong>Address</strong>; <code>ID311</code> can be mapped to <strong>1st Dog</strong>. The source database's technical names never need to match GroomPro's field names.</div>
      <div className="gp-import-table"><div className="gp-import-row header"><span>Source table header</span><span>GroomPro field</span><span>What this field means</span></div>
        {headers.map(h => { const key = mapping[h] || ""; const f = fields.find(([k]) => k === key)?.[1]; return <div className="gp-import-row" key={h}>
          <span><strong>{h}</strong></span>
          <span><select value={key} onChange={e => setMapping({ ...mapping, [h]: e.target.value })}><option value="">Do not import</option>{fields.map(([k, x]) => <option key={k} value={k}>{x.label}</option>)}</select></span>
          <span>{f?.description || "Choose the correct meaning for this source column."}</span>
        </div>; })}
      </div>
      {mappingErrors.length > 0 && <div className="gp-form-error">{mappingErrors.join(" ")}</div>}
      <div className="gp-modal-actions"><button className="gp-btn" disabled={busy || invalid} onClick={() => submit(true)}>Preview Import</button><button className="gp-btn primary" disabled={busy || invalid} onClick={() => submit(false)}>{busy ? "Importing…" : "Import Client Data"}</button></div>
      {result && <pre className="gp-import-result">{JSON.stringify(result, null, 2)}</pre>}
    </>}
  </section>;
}
